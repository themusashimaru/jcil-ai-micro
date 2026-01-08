/**
 * REQUEST ID / CORRELATION ID UTILITIES
 *
 * Provides utilities for working with correlation IDs in API routes.
 * The middleware automatically generates and forwards X-Request-ID headers.
 *
 * Usage:
 * import { getRequestId } from '@/lib/request-id';
 *
 * export async function POST(request: NextRequest) {
 *   const requestId = getRequestId(request);
 *   log.info('Processing request', { requestId });
 *   // ...
 * }
 */

import { NextRequest } from 'next/server';

/**
 * Get the correlation ID from a request
 *
 * The middleware ensures this header is always present.
 * Falls back to generating a new ID if somehow missing.
 */
export function getRequestId(request: NextRequest | Request): string {
  return (
    request.headers.get('x-request-id') ||
    request.headers.get('x-correlation-id') ||
    crypto.randomUUID()
  );
}

/**
 * Create headers with the request ID included
 *
 * Useful for passing correlation to downstream services.
 */
export function withRequestId(requestId: string, headers: HeadersInit = {}): Headers {
  const result = new Headers(headers);
  result.set('X-Request-ID', requestId);
  return result;
}

/**
 * Add request ID to an existing response
 */
export function addRequestIdToResponse(response: Response, requestId: string): Response {
  const newHeaders = new Headers(response.headers);
  newHeaders.set('X-Request-ID', requestId);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}
