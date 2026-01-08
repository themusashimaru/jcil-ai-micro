/**
 * NEXT.JS MIDDLEWARE
 *
 * Global request processing for security and performance:
 * - Correlation IDs for request tracing (X-Request-ID)
 * - Security headers on all responses
 * - Request size validation for POST/PUT/PATCH
 * - Early rejection of oversized payloads
 *
 * @see https://nextjs.org/docs/app/building-your-application/routing/middleware
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * Generate a unique correlation ID for request tracing
 * Uses crypto.randomUUID() for secure, globally unique IDs
 */
function generateRequestId(): string {
  return crypto.randomUUID();
}

// Size limits by route type (in bytes)
const SIZE_LIMITS = {
  DEFAULT: 1 * 1024 * 1024, // 1MB - default for most routes
  UPLOAD: 10 * 1024 * 1024, // 10MB - file uploads
  ADMIN: 5 * 1024 * 1024, // 5MB - admin operations
  CHAT: 500 * 1024, // 500KB - chat messages
  WEBHOOK: 5 * 1024 * 1024, // 5MB - webhook payloads
} as const;

/**
 * Get size limit based on route path
 */
function getSizeLimit(pathname: string): number {
  if (pathname.startsWith('/api/upload')) return SIZE_LIMITS.UPLOAD;
  if (pathname.startsWith('/api/admin')) return SIZE_LIMITS.ADMIN;
  if (pathname.startsWith('/api/chat')) return SIZE_LIMITS.CHAT;
  if (pathname.startsWith('/api/stripe/webhook')) return SIZE_LIMITS.WEBHOOK;
  if (pathname.startsWith('/api/documents')) return SIZE_LIMITS.ADMIN;
  return SIZE_LIMITS.DEFAULT;
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Security headers to add to all responses
 * Note: X-Frame-Options must match next.config.js for consistency
 * Using SAMEORIGIN to match CSP frame-ancestors 'self'
 */
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Generate or use existing correlation ID for request tracing
  // Check common headers: X-Request-ID, X-Correlation-ID, or generate new
  const requestId =
    request.headers.get('x-request-id') ||
    request.headers.get('x-correlation-id') ||
    generateRequestId();

  // Skip middleware for static assets and internal routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.includes('.') // Static files like .ico, .png, etc.
  ) {
    const response = NextResponse.next();
    response.headers.set('X-Request-ID', requestId);
    return response;
  }

  // For state-changing requests, check content-length before processing
  if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
    const contentLength = request.headers.get('content-length');

    if (contentLength) {
      const size = parseInt(contentLength, 10);
      const limit = getSizeLimit(pathname);

      if (!isNaN(size) && size > limit) {
        return NextResponse.json(
          {
            ok: false,
            error: 'Request too large',
            message: `Request size (${formatBytes(size)}) exceeds the maximum allowed size of ${formatBytes(limit)}.`,
            code: 'REQUEST_TOO_LARGE',
            requestId,
          },
          {
            status: 413,
            headers: {
              ...securityHeaders,
              'X-Request-ID': requestId,
            },
          }
        );
      }
    }
  }

  // Create response with request headers forwarding the correlation ID
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-request-id', requestId);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // Apply security headers
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  // Add correlation ID to response for client-side tracing
  response.headers.set('X-Request-ID', requestId);

  return response;
}

/**
 * Configure which paths the middleware runs on
 * Exclude static assets for performance
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt (static files)
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};
