/**
 * CSRF PROTECTION UTILITY
 *
 * PURPOSE:
 * - Prevent Cross-Site Request Forgery (CSRF) attacks
 * - Validate Origin/Referer headers for state-changing requests
 * - Protect admin panel and sensitive operations
 *
 * USAGE:
 * import { validateCSRF } from '@/lib/security/csrf';
 *
 * // In API route handler:
 * const csrfCheck = validateCSRF(request);
 * if (!csrfCheck.valid) return csrfCheck.response;
 *
 * HOW IT WORKS:
 * - Checks Origin and Referer headers match application domain
 * - Only enforced on state-changing methods (POST, PUT, DELETE, PATCH)
 * - GET requests bypass CSRF check (must be idempotent)
 * - Logs blocked attempts for security monitoring
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

const log = logger('CSRF');

interface CSRFValidationResult {
  valid: boolean;
  response?: NextResponse;
}

/**
 * Get allowed origins for CSRF validation
 * Includes production domain and localhost for development
 */
function getAllowedOrigins(): string[] {
  const origins: string[] = [];

  // Production domain from environment
  if (process.env.NEXT_PUBLIC_APP_URL) {
    origins.push(process.env.NEXT_PUBLIC_APP_URL);
  }

  // Vercel deployment URLs
  if (process.env.VERCEL_URL) {
    origins.push(`https://${process.env.VERCEL_URL}`);
  }

  // Development origins
  if (process.env.NODE_ENV === 'development') {
    origins.push('http://localhost:3000');
    origins.push('http://127.0.0.1:3000');
  }

  return origins;
}

/**
 * Extract origin from a URL string
 */
function extractOrigin(url: string): string | null {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

/**
 * Validate request origin to prevent CSRF attacks
 * @param request - The incoming request
 * @param options - Validation options
 * @returns Validation result with optional error response
 */
export function validateCSRF(
  request: NextRequest,
  options: {
    /** Skip CSRF check (use for public endpoints) */
    skipCheck?: boolean;
    /** Custom allowed origins (overrides defaults) */
    allowedOrigins?: string[];
  } = {}
): CSRFValidationResult {
  // Skip validation if explicitly requested
  if (options.skipCheck) {
    return { valid: true };
  }

  // Only check state-changing methods
  const method = request.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return { valid: true };
  }

  const allowedOrigins = options.allowedOrigins || getAllowedOrigins();

  // Get request origin from headers
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const requestUrl = request.url;

  // Extract origins for comparison
  const requestOrigin = extractOrigin(requestUrl);
  const originHeader = origin || (referer ? extractOrigin(referer) : null);

  // SECURITY: Reject if no origin/referer found (possible CSRF attack)
  if (!originHeader) {
    log.warn('Blocked request with missing Origin/Referer header', {
      method,
      path: new URL(requestUrl).pathname,
    });

    return {
      valid: false,
      response: NextResponse.json(
        {
          error: 'CSRF validation failed',
          message: 'Missing origin information. This request appears to be a cross-site request.',
          code: 'CSRF_VALIDATION_FAILED',
        },
        { status: 403 }
      ),
    };
  }

  // Check if origin is in allowed list
  const isAllowed = allowedOrigins.some(allowed => {
    // Exact match
    if (originHeader === allowed) return true;

    // Same origin as request URL
    if (requestOrigin && originHeader === requestOrigin) return true;

    return false;
  });

  if (!isAllowed) {
    log.warn('Blocked cross-origin request', {
      method,
      path: new URL(requestUrl).pathname,
      origin: originHeader,
    });

    return {
      valid: false,
      response: NextResponse.json(
        {
          error: 'CSRF validation failed',
          message: 'Cross-origin requests are not allowed for this endpoint.',
          code: 'CSRF_VALIDATION_FAILED',
        },
        { status: 403 }
      ),
    };
  }

  // Valid same-origin request
  return { valid: true };
}

/**
 * Middleware helper to enforce CSRF protection on admin routes
 * Use this for admin-only endpoints that modify data
 */
export function requireCSRFProtection(request: NextRequest): CSRFValidationResult {
  return validateCSRF(request, {
    skipCheck: false,
  });
}

/**
 * Check if request is same-origin (for conditional logic)
 */
export function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const requestUrl = request.url;

  const requestOrigin = extractOrigin(requestUrl);
  const originHeader = origin || (referer ? extractOrigin(referer) : null);

  if (!originHeader || !requestOrigin) return false;

  return originHeader === requestOrigin;
}
