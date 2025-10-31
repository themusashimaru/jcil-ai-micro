import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { rateLimiters, getClientIdentifier } from '@/lib/rate-limit';

export async function middleware(request: NextRequest) {
  // Get client identifier for rate limiting
  const clientId = getClientIdentifier(request);
  const { pathname } = request.nextUrl;

  // ============================================
  // RATE LIMITING FOR SENSITIVE ENDPOINTS
  // ============================================

  // Login rate limiting: 5 attempts per 15 minutes
  if (pathname === '/login' || pathname === '/api/auth/login') {
    const result = rateLimiters.login(clientId);
    
    if (!result.success) {
      const resetDate = new Date(result.reset);
      const minutesUntilReset = Math.ceil((result.reset - Date.now()) / 60000);
      
      return NextResponse.json(
        { 
          error: `Too many login attempts. Please try again in ${minutesUntilReset} minutes.`,
          resetAt: resetDate.toISOString()
        },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': result.limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': result.reset.toString(),
          }
        }
      );
    }
  }

  // Password reset rate limiting: 3 attempts per hour
  if (pathname === '/forgot-password' || pathname === '/api/auth/reset-password') {
    const result = rateLimiters.passwordReset(clientId);
    
    if (!result.success) {
      const minutesUntilReset = Math.ceil((result.reset - Date.now()) / 60000);
      
      return NextResponse.json(
        { error: `Too many password reset attempts. Please try again in ${minutesUntilReset} minutes.` },
        { status: 429 }
      );
    }
  }

  // Signup rate limiting: 3 attempts per hour per IP
  if (pathname === '/signup' || pathname === '/api/auth/signup') {
    const result = rateLimiters.signup(clientId);
    
    if (!result.success) {
      const minutesUntilReset = Math.ceil((result.reset - Date.now()) / 60000);
      
      return NextResponse.json(
        { error: `Too many signup attempts. Please try again in ${minutesUntilReset} minutes.` },
        { status: 429 }
      );
    }
  }

  // ============================================
  // EXISTING MIDDLEWARE CODE (YOUR AUTH LOGIC)
  // ============================================

  // Create the response object first
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Create Supabase client
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            response.cookies.set({ name, value, ...options });
          } catch (error) {
            // Can fail in read-only environments
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            response.cookies.set({ name, value: '', ...options });
          } catch (error) {
            // Can fail in read-only environments
          }
        },
      },
    }
  );

  // Refresh session
  const { data: { session } } = await supabase.auth.getSession();

  // Handle redirects
  const publicRoutes = ['/login', '/signup', '/auth/callback', '/forgot-password', '/reset-password', '/privacy'];

  // Redirect to login if not authenticated and trying to access protected route
  if (!session && !publicRoutes.includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Redirect to home if authenticated and trying to access auth pages
  if (session && publicRoutes.includes(pathname) && pathname !== '/auth/callback') {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|service-worker.js|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};