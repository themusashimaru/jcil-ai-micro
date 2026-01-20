/**
 * API UTILITIES
 *
 * Centralized utilities for API routes including:
 * - Request validation with Zod
 * - Rate limiting
 * - Standardized responses
 * - Error handling
 */

import { NextRequest, NextResponse } from 'next/server';
import { z, ZodSchema } from 'zod';
import { checkRateLimit, RateLimitConfig } from '@/lib/security/rate-limit';
import { HTTP_STATUS, ERROR_CODES } from '@/lib/constants';
import { logger } from '@/lib/logger';

// ========================================
// TYPES
// ========================================

export interface APIResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
  message?: string;
  code?: string;
  details?: Array<{ field: string; message: string }>;
}

export type ValidationResult<T> =
  | {
      success: true;
      data: T;
    }
  | {
      success: false;
      response: NextResponse;
    };

export type RateLimitCheckResult =
  | {
      allowed: true;
    }
  | {
      allowed: false;
      response: NextResponse;
    };

// ========================================
// RESPONSE HELPERS
// ========================================

/**
 * Create a successful API response
 */
export function successResponse<T>(
  data: T,
  status: number = HTTP_STATUS.OK
): NextResponse<APIResponse<T>> {
  return NextResponse.json({ ok: true, data }, { status });
}

/**
 * Create an error API response
 */
export function errorResponse(
  status: number,
  code: string,
  message: string,
  details?: Array<{ field: string; message: string }>
): NextResponse<APIResponse> {
  const response: APIResponse = {
    ok: false,
    error: message,
    code,
  };

  if (details && details.length > 0) {
    response.details = details;
  }

  return NextResponse.json(response, { status });
}

/**
 * Common error responses
 * MEDIUM-005: Standardized error response format across all APIs
 */
export const errors = {
  unauthorized: () =>
    errorResponse(HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED, 'Authentication required'),

  forbidden: (message = 'Access denied') =>
    errorResponse(HTTP_STATUS.FORBIDDEN, ERROR_CODES.FORBIDDEN, message),

  notFound: (resource = 'Resource') =>
    errorResponse(HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND, `${resource} not found`),

  badRequest: (message = 'Invalid request') =>
    errorResponse(HTTP_STATUS.BAD_REQUEST, ERROR_CODES.INVALID_INPUT, message),

  rateLimited: (retryAfter?: number) => {
    const response = errorResponse(
      HTTP_STATUS.TOO_MANY_REQUESTS,
      ERROR_CODES.RATE_LIMITED,
      'Too many requests. Please try again later.'
    );

    if (retryAfter) {
      response.headers.set('Retry-After', String(retryAfter));
    }

    return response;
  },

  serverError: (message?: string) =>
    errorResponse(
      HTTP_STATUS.INTERNAL_ERROR,
      ERROR_CODES.INTERNAL_ERROR,
      message || 'An unexpected error occurred'
    ),

  validationError: (errors: Array<{ field: string; message: string }>) =>
    errorResponse(HTTP_STATUS.BAD_REQUEST, ERROR_CODES.INVALID_INPUT, 'Validation failed', errors),

  // Code Lab specific errors
  sessionNotFound: () =>
    errorResponse(HTTP_STATUS.NOT_FOUND, 'SESSION_NOT_FOUND', 'Session not found'),

  sessionAccessDenied: () =>
    errorResponse(
      HTTP_STATUS.FORBIDDEN,
      'SESSION_ACCESS_DENIED',
      'You do not have access to this session'
    ),

  fileNotFound: () => errorResponse(HTTP_STATUS.NOT_FOUND, 'FILE_NOT_FOUND', 'File not found'),

  pathTraversal: () => errorResponse(HTTP_STATUS.FORBIDDEN, 'PATH_TRAVERSAL', 'Invalid file path'),

  csrfFailed: () =>
    errorResponse(HTTP_STATUS.FORBIDDEN, ERROR_CODES.CSRF_VALIDATION_FAILED, 'Invalid CSRF token'),

  conflict: (message = 'Resource conflict') =>
    errorResponse(HTTP_STATUS.CONFLICT, ERROR_CODES.ALREADY_EXISTS, message),

  serviceUnavailable: (message = 'Service temporarily unavailable') =>
    errorResponse(HTTP_STATUS.SERVICE_UNAVAILABLE, ERROR_CODES.SERVICE_UNAVAILABLE, message),

  payloadTooLarge: (maxSize?: string) =>
    errorResponse(
      HTTP_STATUS.PAYLOAD_TOO_LARGE,
      ERROR_CODES.REQUEST_TOO_LARGE,
      maxSize ? `Request too large. Maximum size: ${maxSize}` : 'Request too large'
    ),
};

/**
 * Convert an exception to an appropriate error response
 * Useful for catch blocks in API handlers
 */
export function exceptionToResponse(
  error: unknown,
  defaultMessage = 'Operation failed'
): NextResponse<APIResponse> {
  if (error instanceof Error) {
    // Check for specific error types
    if (error.message.includes('not found') || error.message.includes('NOT_FOUND')) {
      return errors.notFound();
    }
    if (error.message.includes('unauthorized') || error.message.includes('UNAUTHORIZED')) {
      return errors.unauthorized();
    }
    if (error.message.includes('forbidden') || error.message.includes('FORBIDDEN')) {
      return errors.forbidden();
    }
    if (error.message.includes('rate limit') || error.message.includes('RATE_LIMITED')) {
      return errors.rateLimited();
    }
    // Log the actual error but return generic message for security
    return errors.serverError(defaultMessage);
  }
  return errors.serverError(defaultMessage);
}

// ========================================
// VALIDATION
// ========================================

/**
 * Validate request body against a Zod schema
 */
export async function validateBody<T extends ZodSchema>(
  request: NextRequest,
  schema: T
): Promise<ValidationResult<z.infer<T>>> {
  try {
    const body = await request.json();
    const result = schema.safeParse(body);

    if (!result.success) {
      const details = result.error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      }));

      return {
        success: false,
        response: errors.validationError(details),
      };
    }

    return { success: true, data: result.data };
  } catch {
    return {
      success: false,
      response: errors.badRequest('Invalid JSON body'),
    };
  }
}

/**
 * Validate query parameters against a Zod schema
 */
export function validateQuery<T extends ZodSchema>(
  request: NextRequest,
  schema: T
): ValidationResult<z.infer<T>> {
  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const result = schema.safeParse(params);

  if (!result.success) {
    const details = result.error.errors.map((err) => ({
      field: err.path.join('.'),
      message: err.message,
    }));

    return {
      success: false,
      response: errors.validationError(details),
    };
  }

  return { success: true, data: result.data };
}

/**
 * Validate route parameters
 */
export function validateParams<T extends ZodSchema>(
  params: Record<string, string>,
  schema: T
): ValidationResult<z.infer<T>> {
  const result = schema.safeParse(params);

  if (!result.success) {
    const details = result.error.errors.map((err) => ({
      field: err.path.join('.'),
      message: err.message,
    }));

    return {
      success: false,
      response: errors.validationError(details),
    };
  }

  return { success: true, data: result.data };
}

// ========================================
// RATE LIMITING
// ========================================

/**
 * Check rate limit for a request
 */
export async function checkRequestRateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitCheckResult> {
  const result = await checkRateLimit(identifier, config);

  if (!result.allowed) {
    return {
      allowed: false,
      response: errors.rateLimited(result.retryAfter),
    };
  }

  return { allowed: true };
}

/**
 * Pre-configured rate limit configs
 */
export const rateLimits = {
  /** Standard API rate limit: 60 req/min */
  standard: { limit: 60, windowMs: 60_000 },

  /** Strict rate limit: 10 req/min */
  strict: { limit: 10, windowMs: 60_000 },

  /** Auth rate limit: 5 req/min */
  auth: { limit: 5, windowMs: 60_000 },

  /** Search rate limit: 30 req/min */
  search: { limit: 30, windowMs: 60_000 },

  /** Upload rate limit: 10 req/min */
  upload: { limit: 10, windowMs: 60_000 },

  /** Admin rate limit: 60 req/min (same as standard, but explicit for admin routes) */
  admin: { limit: 60, windowMs: 60_000 },

  /** AI/Chat rate limit: 20 req/min */
  ai: { limit: 20, windowMs: 60_000 },
};

// ========================================
// ERROR HANDLING
// ========================================

/**
 * Wrap an API handler with error handling
 */
export function withErrorHandler<T>(
  handler: () => Promise<NextResponse<T>>,
  moduleName = 'API'
): Promise<NextResponse<T | APIResponse>> {
  const moduleLog = logger(moduleName);

  return handler().catch((error: unknown) => {
    moduleLog.error('Unhandled error', error instanceof Error ? error : { error });
    return errors.serverError() as NextResponse<T | APIResponse>;
  });
}

/**
 * Safe JSON parse with validation
 */
export function safeJsonParse<T extends ZodSchema>(
  json: string,
  schema: T
): { success: true; data: z.infer<T> } | { success: false; error: string } {
  try {
    const parsed = JSON.parse(json);
    const result = schema.safeParse(parsed);

    if (!result.success) {
      return { success: false, error: 'Validation failed' };
    }

    return { success: true, data: result.data };
  } catch {
    return { success: false, error: 'Invalid JSON' };
  }
}

// ========================================
// REQUEST HELPERS
// ========================================

/**
 * Get client IP from request
 */
export function getClientIP(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

/**
 * Get user agent from request
 */
export function getUserAgent(request: NextRequest): string {
  return request.headers.get('user-agent') || 'unknown';
}

/**
 * Check if request is from a bot
 */
export function isBot(request: NextRequest): boolean {
  const ua = getUserAgent(request).toLowerCase();
  const botPatterns = ['bot', 'crawler', 'spider', 'scraper', 'curl', 'wget'];
  return botPatterns.some((pattern) => ua.includes(pattern));
}
