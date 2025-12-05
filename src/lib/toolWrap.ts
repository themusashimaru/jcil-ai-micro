/**
 * Tool Response Wrapper
 *
 * Normalizes all tool responses to consistent { ok: true/false } format
 * Ensures proper error handling and logging
 */

import { logError } from './log';

/**
 * Success response type
 */
export interface ToolSuccess<T> {
  ok: true;
  data: T;
}

/**
 * Error response type
 */
export interface ToolError {
  ok: false;
  error: {
    code: string;
    message: string;
  };
}

/**
 * Combined tool response type
 */
export type ToolResponse<T> = ToolSuccess<T> | ToolError;

/**
 * Wrap an async tool function to normalize its response
 *
 * @param fn - Async function to wrap
 * @param context - Optional context for error logging
 * @returns Normalized response { ok: true, data } or { ok: false, error }
 */
export async function toolWrap<T>(
  fn: () => Promise<T>,
  context?: { tool_name?: string; user_id?: string }
): Promise<ToolResponse<T>> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));

    // Log the error
    if (context) {
      logError(error, context);
    }

    // Extract error code if available
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const code = (err as any)?.code || (err as any)?.status || error.name || 'INTERNAL';

    return {
      ok: false,
      error: {
        code: String(code),
        message: error.message,
      },
    };
  }
}

/**
 * Check if response is a success
 */
export function isToolSuccess<T>(response: ToolResponse<T>): response is ToolSuccess<T> {
  return response.ok === true;
}

/**
 * Check if response is an error
 */
export function isToolError<T>(response: ToolResponse<T>): response is ToolError {
  return response.ok === false;
}

/**
 * Wrap a synchronous function
 */
export function toolWrapSync<T>(
  fn: () => T,
  context?: { tool_name?: string; user_id?: string }
): ToolResponse<T> {
  try {
    const data = fn();
    return { ok: true, data };
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));

    if (context) {
      logError(error, context);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const code = (err as any)?.code || error.name || 'INTERNAL';

    return {
      ok: false,
      error: {
        code: String(code),
        message: error.message,
      },
    };
  }
}

/**
 * Convert legacy response format to tool response
 */
export function normalizeResponse<T>(
  result: T | { error: string; status?: number } | { success: boolean; result?: T; error?: string }
): ToolResponse<T> {
  // Check for explicit error object
  if (result && typeof result === 'object') {
    // Legacy { error: string } format
    if ('error' in result && typeof (result as { error: string }).error === 'string') {
      return {
        ok: false,
        error: {
          code: String((result as { status?: number }).status || 'ERROR'),
          message: (result as { error: string }).error,
        },
      };
    }

    // Legacy { success: boolean, result?, error? } format
    if ('success' in result) {
      const legacy = result as { success: boolean; result?: T; error?: string };
      if (legacy.success && legacy.result !== undefined) {
        return { ok: true, data: legacy.result };
      }
      if (!legacy.success) {
        return {
          ok: false,
          error: {
            code: 'FAILED',
            message: legacy.error || 'Operation failed',
          },
        };
      }
    }
  }

  // Assume success if no error indicators
  return { ok: true, data: result as T };
}

/**
 * Create a standardized error response
 */
export function createError(code: string, message: string): ToolError {
  return {
    ok: false,
    error: { code, message },
  };
}

/**
 * Create a standardized success response
 */
export function createSuccess<T>(data: T): ToolSuccess<T> {
  return { ok: true, data };
}

/**
 * Common error codes
 */
export const ErrorCodes = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION: 'VALIDATION',
  RATE_LIMITED: 'RATE_LIMITED',
  TIMEOUT: 'TIMEOUT',
  INTERNAL: 'INTERNAL',
  NETWORK: 'NETWORK',
  DUPLICATE: 'DUPLICATE',
} as const;
