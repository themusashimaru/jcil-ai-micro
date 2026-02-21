/**
 * STANDARDIZED API RESPONSE UTILITIES
 *
 * Ensures consistent error/success response format across all API routes.
 * Every response includes: { ok, data?, error?, code? }
 *
 * Usage:
 *   return apiSuccess({ users })
 *   return apiError('Not found', 404, 'NOT_FOUND')
 *   return apiValidationError('Email is required')
 */

import { NextResponse } from 'next/server';

/** Standard success response */
export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

/** Standard error response */
export function apiError(message: string, status = 500, code?: string) {
  return NextResponse.json(
    {
      ok: false,
      error: message,
      ...(code && { code }),
    },
    { status }
  );
}

/** 400 — validation error */
export function apiValidationError(message: string, field?: string) {
  return NextResponse.json(
    {
      ok: false,
      error: message,
      code: 'VALIDATION_ERROR',
      ...(field && { field }),
    },
    { status: 400 }
  );
}

/** 401 — authentication required */
export function apiUnauthorized(message = 'Authentication required') {
  return NextResponse.json({ ok: false, error: message, code: 'UNAUTHORIZED' }, { status: 401 });
}

/** 403 — forbidden */
export function apiForbidden(message = 'Forbidden') {
  return NextResponse.json({ ok: false, error: message, code: 'FORBIDDEN' }, { status: 403 });
}

/** 404 — not found */
export function apiNotFound(resource = 'Resource') {
  return NextResponse.json(
    { ok: false, error: `${resource} not found`, code: 'NOT_FOUND' },
    { status: 404 }
  );
}

/** 429 — rate limited */
export function apiRateLimited(retryAfter?: number) {
  return NextResponse.json(
    {
      ok: false,
      error: 'Rate limit exceeded',
      code: 'RATE_LIMITED',
      ...(retryAfter && { retryAfter }),
    },
    { status: 429 }
  );
}

/** 500 — internal error (logs the real error, returns generic message) */
export function apiInternalError(message = 'Internal server error') {
  return NextResponse.json({ ok: false, error: message, code: 'INTERNAL_ERROR' }, { status: 500 });
}
