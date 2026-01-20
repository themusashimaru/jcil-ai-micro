/**
 * INPUT VALIDATION UTILITIES
 *
 * PURPOSE:
 * - Prevent injection attacks through validated inputs
 * - Safe numeric parsing with bounds checking
 * - Centralized validation for API routes
 *
 * USAGE:
 * import { safeParseInt, validatePositiveInt } from '@/lib/security/validation';
 *
 * const limit = safeParseInt(searchParams.get('limit'), { default: 20, min: 1, max: 100 });
 */

/**
 * Safely parse an integer with bounds checking
 * Returns default value if parsing fails or value is out of bounds
 */
export function safeParseInt(
  value: string | null | undefined,
  options: {
    default: number;
    min?: number;
    max?: number;
  }
): number {
  if (value === null || value === undefined || value === '') {
    return options.default;
  }

  const parsed = parseInt(value, 10);

  // Return default if NaN or not finite
  if (!Number.isFinite(parsed)) {
    return options.default;
  }

  // Apply bounds
  const min = options.min ?? Number.MIN_SAFE_INTEGER;
  const max = options.max ?? Number.MAX_SAFE_INTEGER;

  if (parsed < min) return min;
  if (parsed > max) return max;

  return parsed;
}

/**
 * Validate a positive integer parameter
 * Returns { valid: true, value } or { valid: false, error }
 */
export function validatePositiveInt(
  value: string | null | undefined,
  options: {
    name: string;
    default: number;
    max?: number;
  }
): { valid: true; value: number } | { valid: false; error: string } {
  if (value === null || value === undefined || value === '') {
    return { valid: true, value: options.default };
  }

  // Check if it's a valid integer string (no injection characters)
  if (!/^\d+$/.test(value)) {
    return { valid: false, error: `Invalid ${options.name}: must be a positive integer` };
  }

  const parsed = parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return { valid: false, error: `Invalid ${options.name}: must be a positive integer` };
  }

  const max = options.max ?? 1000;
  if (parsed > max) {
    return { valid: false, error: `Invalid ${options.name}: exceeds maximum of ${max}` };
  }

  return { valid: true, value: parsed };
}

/**
 * Validate path parameter is safe (no traversal)
 * HIGH-004: Comprehensive path traversal detection
 *
 * Checks:
 * - Null bytes (literal and encoded)
 * - URL-encoded traversal attempts
 * - Double-encoding attacks
 * - Windows-style backslashes
 * - Shell metacharacters
 * - Suspicious patterns (/./, //)
 *
 * Basic check - use sanitizeFilePath for full sanitization
 */
export function isPathSafe(path: string): boolean {
  if (!path) return false;

  // Check for null bytes (both literal and encoded)
  if (path.includes('\0')) return false;
  if (path.toLowerCase().includes('%00')) return false;

  // URL-decode the path to catch encoded traversal attempts
  // e.g., %2e%2e = .., %2f = /, %5c = \
  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(path);
  } catch {
    // If decoding fails, the path contains invalid encoding - reject it
    return false;
  }

  // HIGH-004: Check for double-encoding attacks
  // e.g., %252e%252e = %2e%2e = ..
  try {
    const doubleDecoded = decodeURIComponent(decodedPath);
    if (doubleDecoded !== decodedPath) {
      // Path was double-encoded, check if it reveals traversal
      if (doubleDecoded.includes('..') || doubleDecoded.includes('\\')) {
        return false;
      }
    }
  } catch {
    // Double-decoding failed, that's OK - continue with single decoded path
  }

  // Check for path traversal (both original and decoded)
  if (path.includes('..') || decodedPath.includes('..')) return false;

  // Check for backslash traversal (Windows-style)
  if (path.includes('\\') || decodedPath.includes('\\')) return false;

  // Check for shell metacharacters (extended list)
  if (/[;&|`$(){}[\]<>!'"\n\r]/.test(path)) return false;
  if (/[;&|`$(){}[\]<>!'"\n\r]/.test(decodedPath)) return false;

  // HIGH-004: Check for suspicious patterns that could confuse path resolution
  // e.g., /./  or multiple slashes
  if (/\/\.\/|\/\//.test(decodedPath)) return false;

  return true;
}

/**
 * Validate and normalize a limit parameter for database queries
 */
export function validateQueryLimit(
  value: string | null | undefined,
  options: { default?: number; max?: number } = {}
): number {
  const defaultLimit = options.default ?? 50;
  const maxLimit = options.max ?? 200;

  return safeParseInt(value, {
    default: defaultLimit,
    min: 1,
    max: maxLimit,
  });
}

/**
 * Safely parse JSON from a Request object
 * Returns { success: true, data } or { success: false, error }
 *
 * USAGE:
 * const result = await safeParseJSON<{ name: string }>(request);
 * if (!result.success) {
 *   return NextResponse.json({ error: result.error }, { status: 400 });
 * }
 * const { name } = result.data;
 */
export async function safeParseJSON<T = Record<string, unknown>>(
  request: Request
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  try {
    const data = (await request.json()) as T;
    return { success: true, data };
  } catch (error) {
    // SyntaxError indicates malformed JSON
    if (error instanceof SyntaxError) {
      return { success: false, error: 'Invalid JSON in request body' };
    }
    // Other errors (e.g., body already read, network issues)
    return { success: false, error: 'Failed to parse request body' };
  }
}
