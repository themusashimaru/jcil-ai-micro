// src/middleware.ts
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Auth redirects only (no page-level rate limiting)
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

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
          } catch {}
        },
        remove(name: string, options: CookieOptions) {
          try {
            response.cookies.set({ name, value: '', ...options });
          } catch {}
        },
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();

  // Routes allowed for logged-out users
  const publicRoutes = [
    '/login',
    '/signup',
    '/auth/callback',
    '/forgot-password',
    '/reset-password',
    '/privacy',
  ];

  // Not logged in → protect non-public pages
  if (!session && !publicRoutes.includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Logged in → keep them off login/signup/etc (except callback)
  if (session && publicRoutes.includes(pathname) && pathname !== '/auth/callback') {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return response;
}

// Allow static assets, icons, api, etc.
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|service-worker.js|robots.txt|sitemap.xml|icons/|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
