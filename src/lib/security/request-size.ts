/**
 * REQUEST SIZE VALIDATION
 *
 * PURPOSE:
 * - Prevent DoS attacks from large request payloads
 * - Protect server memory and processing resources
 * - Enforce reasonable size limits per endpoint type
 *
 * USAGE:
 * import { validateRequestSize } from '@/lib/security/request-size';
 *
 * // In API route handler:
 * const body = await request.json();
 * const sizeCheck = validateRequestSize(body);
 * if (!sizeCheck.valid) return sizeCheck.response;
 *
 * HOW IT WORKS:
 * - Calculates JSON payload size in bytes
 * - Enforces configurable size limits
 * - Returns error response if exceeded
 * - Logs large request attempts
 */

import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

const log = logger('RequestSize');

interface SizeValidationResult {
  valid: boolean;
  size?: number;
  response?: NextResponse;
}

/**
 * Calculate size of object when serialized to JSON
 */
function calculateJSONSize(obj: unknown): number {
  try {
    const jsonString = JSON.stringify(obj);
    // Calculate size in bytes (UTF-8 encoding)
    return new Blob([jsonString]).size;
  } catch {
    // If serialization fails, return 0
    return 0;
  }
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
 * Validate request body size to prevent DoS attacks
 * @param body - The request body to validate
 * @param maxSizeBytes - Maximum allowed size in bytes (default: 1MB)
 * @returns Validation result with optional error response
 */
export function validateRequestSize(
  body: unknown,
  maxSizeBytes: number = 1 * 1024 * 1024 // Default: 1MB
): SizeValidationResult {
  const bodySize = calculateJSONSize(body);

  if (bodySize > maxSizeBytes) {
    log.warn('Blocked oversized request', {
      size: formatBytes(bodySize),
      limit: formatBytes(maxSizeBytes),
    });

    return {
      valid: false,
      size: bodySize,
      response: NextResponse.json(
        {
          error: 'Request too large',
          message: `Request body size (${formatBytes(bodySize)}) exceeds the maximum allowed size of ${formatBytes(maxSizeBytes)}.`,
          code: 'REQUEST_TOO_LARGE',
          details: {
            size: bodySize,
            limit: maxSizeBytes,
            sizeFormatted: formatBytes(bodySize),
            limitFormatted: formatBytes(maxSizeBytes),
          },
        },
        { status: 413 } // 413 Payload Too Large
      ),
    };
  }

  return {
    valid: true,
    size: bodySize,
  };
}

/**
 * Predefined size limits for common use cases
 */
export const SIZE_LIMITS = {
  /** Small JSON requests (settings, notifications, etc.) - 100KB */
  SMALL: 100 * 1024,

  /** Medium JSON requests (conversations, messages) - 500KB */
  MEDIUM: 500 * 1024,

  /** Large JSON requests (exports, batch operations) - 1MB */
  LARGE: 1 * 1024 * 1024,

  /** Extra large (file uploads, bulk data) - 5MB */
  XLARGE: 5 * 1024 * 1024,

  /** Form data with files - 10MB */
  FILE_UPLOAD: 10 * 1024 * 1024,
} as const;

/**
 * Validate form data size (for multipart/form-data requests)
 * @param formData - The FormData object to validate
 * @param maxSizeBytes - Maximum allowed size in bytes
 * @returns Validation result
 */
export async function validateFormDataSize(
  formData: FormData,
  maxSizeBytes: number = SIZE_LIMITS.FILE_UPLOAD
): Promise<SizeValidationResult> {
  let totalSize = 0;

  // Calculate total size of all form data entries
  for (const [, value] of formData.entries()) {
    if (value instanceof File) {
      totalSize += value.size;
    } else {
      // String values
      totalSize += new Blob([value]).size;
    }
  }

  if (totalSize > maxSizeBytes) {
    log.warn('Blocked oversized form data', {
      size: formatBytes(totalSize),
      limit: formatBytes(maxSizeBytes),
    });

    return {
      valid: false,
      size: totalSize,
      response: NextResponse.json(
        {
          error: 'Upload too large',
          message: `Upload size (${formatBytes(totalSize)}) exceeds the maximum allowed size of ${formatBytes(maxSizeBytes)}.`,
          code: 'UPLOAD_TOO_LARGE',
          details: {
            size: totalSize,
            limit: maxSizeBytes,
            sizeFormatted: formatBytes(totalSize),
            limitFormatted: formatBytes(maxSizeBytes),
          },
        },
        { status: 413 }
      ),
    };
  }

  return {
    valid: true,
    size: totalSize,
  };
}

/**
 * Middleware helper to enforce size limits on admin routes
 */
export function enforceAdminSizeLimit(body: unknown): SizeValidationResult {
  return validateRequestSize(body, SIZE_LIMITS.MEDIUM);
}

/**
 * Check if request content-length header exceeds limit
 * (Use this before parsing body for early rejection)
 */
export function checkContentLength(
  request: Request,
  maxSizeBytes: number
): SizeValidationResult {
  const contentLength = request.headers.get('content-length');

  if (!contentLength) {
    // If no content-length header, allow and rely on body validation
    return { valid: true };
  }

  const size = parseInt(contentLength, 10);

  if (isNaN(size)) {
    return { valid: true };
  }

  if (size > maxSizeBytes) {
    log.warn('Blocked request with large content-length', {
      size: formatBytes(size),
      limit: formatBytes(maxSizeBytes),
    });

    return {
      valid: false,
      size,
      response: NextResponse.json(
        {
          error: 'Request too large',
          message: `Request size (${formatBytes(size)}) exceeds the maximum allowed size of ${formatBytes(maxSizeBytes)}.`,
          code: 'REQUEST_TOO_LARGE',
        },
        { status: 413 }
      ),
    };
  }

  return { valid: true, size };
}
