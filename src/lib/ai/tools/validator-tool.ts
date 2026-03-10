/**
 * DATA VALIDATION TOOL
 *
 * Validate various data formats using validator.js.
 * Runs entirely locally - no external API costs.
 *
 * Validates:
 * - Emails, URLs, domains
 * - Credit cards, IBANs
 * - Phone numbers, postal codes
 * - UUIDs, JSON, IP addresses
 * - And much more...
 *
 * Created: 2026-01-31
 */

import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '../providers/types';

// Lazy-loaded validator
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let validator: any = null;

async function initValidator(): Promise<boolean> {
  if (validator) return true;
  try {
    const mod = await import('validator');
    validator = mod.default || mod;
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const validatorTool: UnifiedTool = {
  name: 'validate_data',
  description: `Validate various data formats and patterns.

Validation types:
- email: Email addresses
- url: URLs (with protocol options)
- domain: Domain names (FQDN)
- ip: IP addresses (v4, v6, or both)
- credit_card: Credit card numbers (Luhn check)
- iban: International Bank Account Numbers
- uuid: UUIDs (v1-v5)
- json: Valid JSON strings
- jwt: JWT tokens (structure only)
- phone: Phone numbers (with locale)
- postal_code: Postal/ZIP codes (with locale)
- date: Date strings (ISO8601, RFC2822)
- hex_color: Hex color codes
- mac_address: MAC addresses
- mime_type: MIME type strings
- slug: URL slugs
- strong_password: Password strength
- alphanumeric: Alphanumeric strings
- numeric: Numeric strings
- base64: Base64 encoded strings
- md5/sha256/sha512: Hash formats

Can validate single value or array of values.`,
  parameters: {
    type: 'object',
    properties: {
      validation_type: {
        type: 'string',
        enum: [
          'email',
          'url',
          'domain',
          'ip',
          'credit_card',
          'iban',
          'uuid',
          'json',
          'jwt',
          'phone',
          'postal_code',
          'date',
          'hex_color',
          'mac_address',
          'mime_type',
          'slug',
          'strong_password',
          'alphanumeric',
          'numeric',
          'base64',
          'md5',
          'sha256',
          'sha512',
          'mongo_id',
          'isbn',
        ],
        description: 'Type of validation to perform',
      },
      value: {
        type: 'string',
        description: 'Single value to validate',
      },
      values: {
        type: 'array',
        items: { type: 'string' },
        description: 'Multiple values to validate (alternative to value)',
      },
      locale: {
        type: 'string',
        description: 'Locale for phone/postal validation (e.g., "en-US", "de-DE")',
      },
      options: {
        type: 'object',
        description: 'Additional validation options (varies by type)',
      },
    },
    required: ['validation_type'],
  },
};

// ============================================================================
// AVAILABILITY CHECK
// ============================================================================

export function isValidatorAvailable(): boolean {
  return true;
}

// ============================================================================
// EXECUTOR
// ============================================================================

export async function executeValidator(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = toolCall.arguments as {
    validation_type: string;
    value?: string;
    values?: string[];
    locale?: string;
    options?: Record<string, unknown>;
  };

  if (!args.validation_type) {
    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({ error: 'Validation type is required' }),
      isError: true,
    };
  }

  if (!args.value && (!args.values || args.values.length === 0)) {
    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({ error: 'Value or values array is required' }),
      isError: true,
    };
  }

  try {
    const initialized = await initValidator();
    if (!initialized) {
      return {
        toolCallId: toolCall.id,
        content: JSON.stringify({ error: 'Failed to initialize validator' }),
        isError: true,
      };
    }

    const valuesToValidate = args.values || [args.value!];
    const results: { value: string; valid: boolean; details?: Record<string, unknown> }[] = [];

    for (const val of valuesToValidate) {
      const validationResult = validateValue(val, args.validation_type, args.locale, args.options);
      results.push(validationResult);
    }

    const allValid = results.every((r) => r.valid);
    const validCount = results.filter((r) => r.valid).length;

    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({
        validation_type: args.validation_type,
        all_valid: allValid,
        valid_count: validCount,
        total_count: results.length,
        results: args.value ? results[0] : results,
      }),
      isError: false,
    };
  } catch (error) {
    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({
        error: 'Validation failed',
        details: error instanceof Error ? error.message : String(error),
      }),
      isError: true,
    };
  }
}

function validateValue(
  value: string,
  type: string,
  locale?: string,
  options?: Record<string, unknown>
): { value: string; valid: boolean; details?: Record<string, unknown> } {
  let valid = false;
  const details: Record<string, unknown> = {};

  switch (type) {
    case 'email':
      valid = validator.isEmail(value, options);
      if (valid) {
        details.normalized = validator.normalizeEmail(value);
      }
      break;

    case 'url':
      valid = validator.isURL(value, options);
      break;

    case 'domain':
      valid = validator.isFQDN(value, options);
      break;

    case 'ip':
      valid = validator.isIP(value);
      if (valid) {
        details.version = validator.isIP(value, 4) ? 'v4' : 'v6';
      }
      break;

    case 'credit_card':
      valid = validator.isCreditCard(value);
      if (valid) {
        // Mask the card number for security
        details.masked = value.slice(0, 4) + '********' + value.slice(-4);
      }
      break;

    case 'iban':
      valid = validator.isIBAN(value);
      break;

    case 'uuid':
      valid = validator.isUUID(value);
      if (valid) {
        // Detect version
        for (let v = 1; v <= 5; v++) {
          if (validator.isUUID(value, v)) {
            details.version = v;
            break;
          }
        }
      }
      break;

    case 'json':
      valid = validator.isJSON(value);
      if (valid) {
        try {
          const parsed = JSON.parse(value);
          details.type = Array.isArray(parsed) ? 'array' : typeof parsed;
        } catch {
          // Ignore parsing errors
        }
      }
      break;

    case 'jwt':
      valid = validator.isJWT(value);
      if (valid) {
        const parts = value.split('.');
        details.parts = parts.length;
      }
      break;

    case 'phone':
      valid = validator.isMobilePhone(value, locale || 'any');
      break;

    case 'postal_code':
      valid = validator.isPostalCode(value, locale || 'any');
      break;

    case 'date':
      valid = validator.isISO8601(value) || validator.isRFC3339(value);
      if (valid) {
        details.format = validator.isISO8601(value) ? 'ISO8601' : 'RFC3339';
      }
      break;

    case 'hex_color':
      valid = validator.isHexColor(value);
      break;

    case 'mac_address':
      valid = validator.isMACAddress(value);
      break;

    case 'mime_type':
      valid = validator.isMimeType(value);
      break;

    case 'slug':
      valid = validator.isSlug(value);
      break;

    case 'strong_password':
      valid = validator.isStrongPassword(value, {
        minLength: 8,
        minLowercase: 1,
        minUppercase: 1,
        minNumbers: 1,
        minSymbols: 1,
        ...options,
      });
      details.length = value.length;
      details.has_lowercase = /[a-z]/.test(value);
      details.has_uppercase = /[A-Z]/.test(value);
      details.has_numbers = /[0-9]/.test(value);
      details.has_symbols = /[^a-zA-Z0-9]/.test(value);
      break;

    case 'alphanumeric':
      valid = validator.isAlphanumeric(value, locale || 'en-US');
      break;

    case 'numeric':
      valid = validator.isNumeric(value);
      break;

    case 'base64':
      valid = validator.isBase64(value);
      break;

    case 'md5':
      valid = validator.isMD5(value);
      break;

    case 'sha256':
      valid = validator.isHash(value, 'sha256');
      break;

    case 'sha512':
      valid = validator.isHash(value, 'sha512');
      break;

    case 'mongo_id':
      valid = validator.isMongoId(value);
      break;

    case 'isbn':
      valid = validator.isISBN(value);
      if (valid) {
        details.version = validator.isISBN(value, 10) ? 'ISBN-10' : 'ISBN-13';
      }
      break;

    default:
      return { value, valid: false, details: { error: `Unknown validation type: ${type}` } };
  }

  return { value, valid, details: Object.keys(details).length > 0 ? details : undefined };
}
