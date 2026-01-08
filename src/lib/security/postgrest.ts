/**
 * POSTGREST SECURITY UTILITIES
 *
 * Functions to prevent PostgREST filter injection attacks.
 * PostgREST allows filtering via URL query parameters, which can be
 * manipulated if user input is not properly sanitized.
 *
 * @module lib/security/postgrest
 */

/**
 * Sanitize user input for use in PostgREST filter strings.
 *
 * PostgREST uses special characters for filter syntax:
 * - . (dot) for column access
 * - , (comma) for OR conditions
 * - () (parentheses) for grouping
 * - : (colon) for operators
 * - % and _ for LIKE patterns
 * - & | ! for boolean operators
 *
 * This function removes or escapes these characters to prevent injection.
 *
 * @param input - The user input to sanitize
 * @param options - Sanitization options
 * @returns Sanitized string safe for PostgREST filters
 *
 * @example
 * // Safe usage in PostgREST filter:
 * const sanitized = sanitizePostgrestInput(userSearch);
 * query = query.or(`name.ilike.%${sanitized}%`);
 */
export function sanitizePostgrestInput(
  input: string,
  options: {
    /** Maximum length for the sanitized string (default: 100) */
    maxLength?: number;
    /** Additional characters to remove */
    additionalChars?: string;
  } = {}
): string {
  const { maxLength = 100, additionalChars = '' } = options;

  if (!input || typeof input !== 'string') {
    return '';
  }

  // Characters that could manipulate PostgREST filters
  // . , ( ) : ; % _ * & | ! = < > ~ @ \ are special in PostgREST
  const dangerousChars = /[.,():;%_*&|!=<>~@\\]/g;

  let result = input
    // Remove dangerous filter characters
    .replace(dangerousChars, '')
    // Escape single quotes (SQL injection prevention)
    .replace(/'/g, "''")
    // Remove any null bytes
    .replace(/\0/g, '')
    // Limit length to prevent DoS
    .slice(0, maxLength)
    // Trim whitespace
    .trim();

  // Remove additional custom characters if specified
  if (additionalChars) {
    const customPattern = new RegExp(`[${additionalChars.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]`, 'g');
    result = result.replace(customPattern, '');
  }

  return result;
}

/**
 * Validate that a string is safe for PostgREST column names.
 * Column names should only contain alphanumeric characters and underscores.
 *
 * @param columnName - The column name to validate
 * @returns true if the column name is safe
 */
export function isValidColumnName(columnName: string): boolean {
  if (!columnName || typeof columnName !== 'string') {
    return false;
  }

  // Column names must be alphanumeric with underscores, starting with letter
  return /^[a-zA-Z][a-zA-Z0-9_]*$/.test(columnName);
}

/**
 * Sanitize a sort order parameter for PostgREST.
 * Only allows 'asc' or 'desc' (case-insensitive).
 *
 * @param order - The order to validate
 * @param defaultOrder - Default order if invalid (default: 'desc')
 * @returns 'asc' or 'desc'
 */
export function sanitizeSortOrder(
  order: string | null | undefined,
  defaultOrder: 'asc' | 'desc' = 'desc'
): 'asc' | 'desc' {
  if (!order || typeof order !== 'string') {
    return defaultOrder;
  }

  const normalized = order.toLowerCase().trim();
  return normalized === 'asc' ? 'asc' : normalized === 'desc' ? 'desc' : defaultOrder;
}

/**
 * Build a safe ILIKE search pattern for PostgREST.
 * Ensures the pattern is properly escaped and bounded.
 *
 * @param searchTerm - The search term
 * @param options - Pattern options
 * @returns Safe search pattern for PostgREST ILIKE
 */
export function buildSearchPattern(
  searchTerm: string,
  options: {
    /** Prefix match only (no trailing wildcard) */
    prefixOnly?: boolean;
    /** Suffix match only (no leading wildcard) */
    suffixOnly?: boolean;
    /** Maximum length */
    maxLength?: number;
  } = {}
): string {
  const { prefixOnly = false, suffixOnly = false, maxLength = 100 } = options;

  const sanitized = sanitizePostgrestInput(searchTerm, { maxLength });

  if (!sanitized) {
    return '';
  }

  const prefix = suffixOnly ? '' : '%';
  const suffix = prefixOnly ? '' : '%';

  return `${prefix}${sanitized}${suffix}`;
}
