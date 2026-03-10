/**
 * Comprehensive tests for validator-tool.ts
 *
 * Tests cover:
 * - Exported tool definition (validatorTool)
 * - Exported availability check (isValidatorAvailable)
 * - Exported executor (executeValidator)
 * - All 25 validation types
 * - Error handling (missing args, unknown type, thrown exceptions)
 * - Single value vs array of values
 * - Locale and options support
 * - Edge cases and branch coverage
 */

import { describe, it, expect } from 'vitest';
import { executeValidator, isValidatorAvailable, validatorTool } from './validator-tool';
import type { UnifiedToolCall, UnifiedToolResult, UnifiedTool } from '../providers/types';

// ============================================================================
// HELPERS
// ============================================================================

function makeCall(args: Record<string, unknown>, id = 'test-call-1'): UnifiedToolCall {
  return { id, name: 'validate_data', arguments: args };
}

function parseContent(result: UnifiedToolResult): Record<string, unknown> {
  return JSON.parse(result.content) as Record<string, unknown>;
}

// ============================================================================
// EXPORT CHECKS
// ============================================================================

describe('validator-tool exports', () => {
  it('should export validatorTool as a UnifiedTool', () => {
    expect(validatorTool).toBeDefined();
    const tool: UnifiedTool = validatorTool;
    expect(tool.name).toBe('validate_data');
    expect(typeof tool.description).toBe('string');
    expect(tool.parameters).toBeDefined();
    expect(tool.parameters.type).toBe('object');
  });

  it('should export isValidatorAvailable as a function', () => {
    expect(typeof isValidatorAvailable).toBe('function');
  });

  it('should export executeValidator as an async function', () => {
    expect(typeof executeValidator).toBe('function');
  });
});

// ============================================================================
// TOOL DEFINITION SHAPE
// ============================================================================

describe('validatorTool definition', () => {
  it('should have name "validate_data"', () => {
    expect(validatorTool.name).toBe('validate_data');
  });

  it('should have a non-empty description', () => {
    expect(validatorTool.description.length).toBeGreaterThan(0);
  });

  it('should define validation_type parameter with all 25 enum values', () => {
    const props = validatorTool.parameters.properties;
    expect(props.validation_type).toBeDefined();
    expect(props.validation_type.type).toBe('string');
    const expectedEnums = [
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
    ];
    expect(props.validation_type.enum).toEqual(expectedEnums);
  });

  it('should define value parameter as string type', () => {
    const props = validatorTool.parameters.properties;
    expect(props.value).toBeDefined();
    expect(props.value.type).toBe('string');
  });

  it('should define values parameter as array of strings', () => {
    const props = validatorTool.parameters.properties;
    expect(props.values).toBeDefined();
    expect(props.values.type).toBe('array');
    expect(props.values.items).toEqual({ type: 'string' });
  });

  it('should define locale parameter as string type', () => {
    const props = validatorTool.parameters.properties;
    expect(props.locale).toBeDefined();
    expect(props.locale.type).toBe('string');
  });

  it('should define options parameter as object type', () => {
    const props = validatorTool.parameters.properties;
    expect(props.options).toBeDefined();
    expect(props.options.type).toBe('object');
  });

  it('should require only validation_type', () => {
    expect(validatorTool.parameters.required).toEqual(['validation_type']);
  });
});

// ============================================================================
// isValidatorAvailable
// ============================================================================

describe('isValidatorAvailable', () => {
  it('should return true', () => {
    expect(isValidatorAvailable()).toBe(true);
  });

  it('should return a boolean type', () => {
    expect(typeof isValidatorAvailable()).toBe('boolean');
  });
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

describe('executeValidator error handling', () => {
  it('should return error when validation_type is missing', async () => {
    const result = await executeValidator(makeCall({}));
    const parsed = parseContent(result);
    expect(result.isError).toBe(true);
    expect(result.toolCallId).toBe('test-call-1');
    expect(parsed.error).toBe('Validation type is required');
  });

  it('should return error when neither value nor values is provided', async () => {
    const result = await executeValidator(makeCall({ validation_type: 'email' }));
    const parsed = parseContent(result);
    expect(result.isError).toBe(true);
    expect(parsed.error).toBe('Value or values array is required');
  });

  it('should return error when values is an empty array', async () => {
    const result = await executeValidator(makeCall({ validation_type: 'email', values: [] }));
    const parsed = parseContent(result);
    expect(result.isError).toBe(true);
    expect(parsed.error).toBe('Value or values array is required');
  });

  it('should return the correct toolCallId on error', async () => {
    const result = await executeValidator(makeCall({}, 'custom-id-42'));
    expect(result.toolCallId).toBe('custom-id-42');
  });

  it('should return the correct toolCallId on success', async () => {
    const result = await executeValidator(
      makeCall({ validation_type: 'numeric', value: '123' }, 'success-id')
    );
    expect(result.toolCallId).toBe('success-id');
  });
});

// ============================================================================
// UNKNOWN VALIDATION TYPE
// ============================================================================

describe('executeValidator unknown validation type', () => {
  it('should return valid=false with error details for unknown type', async () => {
    const result = await executeValidator(
      makeCall({ validation_type: 'unknown_type', value: 'foo' })
    );
    const parsed = parseContent(result);
    expect(result.isError).toBe(false);
    expect(parsed.all_valid).toBe(false);
    expect(parsed.valid_count).toBe(0);
    const results = parsed.results as { value: string; valid: boolean; details: { error: string } };
    expect(results.valid).toBe(false);
    expect(results.details.error).toContain('Unknown validation type');
    expect(results.details.error).toContain('unknown_type');
  });
});

// ============================================================================
// EMAIL VALIDATION
// ============================================================================

describe('executeValidator email', () => {
  it('should validate a correct email and include normalized form', async () => {
    const result = await executeValidator(
      makeCall({ validation_type: 'email', value: 'test@example.com' })
    );
    const parsed = parseContent(result);
    expect(result.isError).toBe(false);
    expect(parsed.all_valid).toBe(true);
    expect(parsed.valid_count).toBe(1);
    expect(parsed.total_count).toBe(1);
    const res = parsed.results as {
      value: string;
      valid: boolean;
      details: { normalized: string };
    };
    expect(res.valid).toBe(true);
    expect(res.details.normalized).toBeDefined();
  });

  it('should reject an invalid email', async () => {
    const result = await executeValidator(
      makeCall({ validation_type: 'email', value: 'not-an-email' })
    );
    const parsed = parseContent(result);
    expect(parsed.all_valid).toBe(false);
    const res = parsed.results as { value: string; valid: boolean };
    expect(res.valid).toBe(false);
  });
});

// ============================================================================
// URL VALIDATION
// ============================================================================

describe('executeValidator url', () => {
  it('should validate a correct URL', async () => {
    const result = await executeValidator(
      makeCall({ validation_type: 'url', value: 'https://example.com' })
    );
    const parsed = parseContent(result);
    expect(parsed.all_valid).toBe(true);
    const res = parsed.results as { value: string; valid: boolean };
    expect(res.valid).toBe(true);
  });

  it('should reject an invalid URL', async () => {
    const result = await executeValidator(makeCall({ validation_type: 'url', value: 'not a url' }));
    const parsed = parseContent(result);
    expect(parsed.all_valid).toBe(false);
  });
});

// ============================================================================
// DOMAIN VALIDATION
// ============================================================================

describe('executeValidator domain', () => {
  it('should validate a correct domain (FQDN)', async () => {
    const result = await executeValidator(
      makeCall({ validation_type: 'domain', value: 'example.com' })
    );
    const parsed = parseContent(result);
    expect(parsed.all_valid).toBe(true);
  });

  it('should reject an invalid domain', async () => {
    const result = await executeValidator(
      makeCall({ validation_type: 'domain', value: 'not a domain!' })
    );
    const parsed = parseContent(result);
    expect(parsed.all_valid).toBe(false);
  });
});

// ============================================================================
// IP VALIDATION
// ============================================================================

describe('executeValidator ip', () => {
  it('should validate an IPv4 address and report version v4', async () => {
    const result = await executeValidator(
      makeCall({ validation_type: 'ip', value: '192.168.1.1' })
    );
    const parsed = parseContent(result);
    expect(parsed.all_valid).toBe(true);
    const res = parsed.results as { value: string; valid: boolean; details: { version: string } };
    expect(res.details.version).toBe('v4');
  });

  it('should validate an IPv6 address and report version v6', async () => {
    const result = await executeValidator(makeCall({ validation_type: 'ip', value: '::1' }));
    const parsed = parseContent(result);
    expect(parsed.all_valid).toBe(true);
    const res = parsed.results as { value: string; valid: boolean; details: { version: string } };
    expect(res.details.version).toBe('v6');
  });

  it('should reject an invalid IP address', async () => {
    const result = await executeValidator(
      makeCall({ validation_type: 'ip', value: '999.999.999.999' })
    );
    const parsed = parseContent(result);
    expect(parsed.all_valid).toBe(false);
  });
});

// ============================================================================
// CREDIT CARD VALIDATION
// ============================================================================

describe('executeValidator credit_card', () => {
  it('should validate a valid credit card number and mask it', async () => {
    // Valid test card number (Visa test)
    const result = await executeValidator(
      makeCall({ validation_type: 'credit_card', value: '4111111111111111' })
    );
    const parsed = parseContent(result);
    expect(parsed.all_valid).toBe(true);
    const res = parsed.results as { value: string; valid: boolean; details: { masked: string } };
    expect(res.details.masked).toBe('4111********1111');
  });

  it('should reject an invalid credit card number', async () => {
    const result = await executeValidator(
      makeCall({ validation_type: 'credit_card', value: '1234567890' })
    );
    const parsed = parseContent(result);
    expect(parsed.all_valid).toBe(false);
  });
});

// ============================================================================
// IBAN VALIDATION
// ============================================================================

describe('executeValidator iban', () => {
  it('should validate a valid IBAN', async () => {
    const result = await executeValidator(
      makeCall({ validation_type: 'iban', value: 'DE89370400440532013000' })
    );
    const parsed = parseContent(result);
    expect(parsed.all_valid).toBe(true);
  });

  it('should reject an invalid IBAN', async () => {
    const result = await executeValidator(
      makeCall({ validation_type: 'iban', value: 'INVALID_IBAN' })
    );
    const parsed = parseContent(result);
    expect(parsed.all_valid).toBe(false);
  });
});

// ============================================================================
// UUID VALIDATION
// ============================================================================

describe('executeValidator uuid', () => {
  it('should validate a valid UUID and detect version', async () => {
    const result = await executeValidator(
      makeCall({ validation_type: 'uuid', value: '550e8400-e29b-41d4-a716-446655440000' })
    );
    const parsed = parseContent(result);
    expect(parsed.all_valid).toBe(true);
    const res = parsed.results as { value: string; valid: boolean; details: { version: number } };
    expect(res.details.version).toBeDefined();
  });

  it('should reject an invalid UUID', async () => {
    const result = await executeValidator(
      makeCall({ validation_type: 'uuid', value: 'not-a-uuid' })
    );
    const parsed = parseContent(result);
    expect(parsed.all_valid).toBe(false);
  });
});

// ============================================================================
// JSON VALIDATION
// ============================================================================

describe('executeValidator json', () => {
  it('should validate a JSON object and report type "object"', async () => {
    const result = await executeValidator(
      makeCall({ validation_type: 'json', value: '{"key":"value"}' })
    );
    const parsed = parseContent(result);
    expect(parsed.all_valid).toBe(true);
    const res = parsed.results as { value: string; valid: boolean; details: { type: string } };
    expect(res.details.type).toBe('object');
  });

  it('should validate a JSON array and report type "array"', async () => {
    const result = await executeValidator(makeCall({ validation_type: 'json', value: '[1,2,3]' }));
    const parsed = parseContent(result);
    expect(parsed.all_valid).toBe(true);
    const res = parsed.results as { value: string; valid: boolean; details: { type: string } };
    expect(res.details.type).toBe('array');
  });

  it('should reject invalid JSON', async () => {
    const result = await executeValidator(makeCall({ validation_type: 'json', value: '{invalid' }));
    const parsed = parseContent(result);
    expect(parsed.all_valid).toBe(false);
  });
});

// ============================================================================
// JWT VALIDATION
// ============================================================================

describe('executeValidator jwt', () => {
  it('should validate a valid JWT and report 3 parts', async () => {
    // Structurally valid JWT (header.payload.signature)
    const jwt =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
    const result = await executeValidator(makeCall({ validation_type: 'jwt', value: jwt }));
    const parsed = parseContent(result);
    expect(parsed.all_valid).toBe(true);
    const res = parsed.results as { value: string; valid: boolean; details: { parts: number } };
    expect(res.details.parts).toBe(3);
  });

  it('should reject an invalid JWT', async () => {
    const result = await executeValidator(
      makeCall({ validation_type: 'jwt', value: 'not.a.jwt.at.all' })
    );
    const parsed = parseContent(result);
    expect(parsed.all_valid).toBe(false);
  });
});

// ============================================================================
// PHONE VALIDATION
// ============================================================================

describe('executeValidator phone', () => {
  it('should validate a phone number with explicit locale', async () => {
    const result = await executeValidator(
      makeCall({ validation_type: 'phone', value: '+14155552671', locale: 'en-US' })
    );
    const parsed = parseContent(result);
    expect(parsed.all_valid).toBe(true);
  });

  it('should use "any" locale by default', async () => {
    const result = await executeValidator(
      makeCall({ validation_type: 'phone', value: '+14155552671' })
    );
    // Should not error out; the "any" locale should be used
    expect(result.isError).toBe(false);
  });
});

// ============================================================================
// POSTAL CODE VALIDATION
// ============================================================================

describe('executeValidator postal_code', () => {
  it('should validate a US ZIP code with locale', async () => {
    const result = await executeValidator(
      makeCall({ validation_type: 'postal_code', value: '90210', locale: 'US' })
    );
    const parsed = parseContent(result);
    expect(parsed.all_valid).toBe(true);
  });

  it('should use "any" locale by default', async () => {
    const result = await executeValidator(
      makeCall({ validation_type: 'postal_code', value: '90210' })
    );
    expect(result.isError).toBe(false);
  });
});

// ============================================================================
// DATE VALIDATION
// ============================================================================

describe('executeValidator date', () => {
  it('should validate an ISO8601 date and report format', async () => {
    const result = await executeValidator(
      makeCall({ validation_type: 'date', value: '2026-01-15' })
    );
    const parsed = parseContent(result);
    expect(parsed.all_valid).toBe(true);
    const res = parsed.results as { value: string; valid: boolean; details: { format: string } };
    expect(res.details.format).toBe('ISO8601');
  });

  it('should validate an ISO8601 datetime', async () => {
    const result = await executeValidator(
      makeCall({ validation_type: 'date', value: '2026-01-15T10:30:00Z' })
    );
    const parsed = parseContent(result);
    expect(parsed.all_valid).toBe(true);
  });

  it('should reject an invalid date', async () => {
    const result = await executeValidator(
      makeCall({ validation_type: 'date', value: 'not-a-date' })
    );
    const parsed = parseContent(result);
    expect(parsed.all_valid).toBe(false);
  });
});

// ============================================================================
// SIMPLE BOOLEAN VALIDATORS
// ============================================================================

describe('executeValidator hex_color', () => {
  it('should validate a valid hex color', async () => {
    const result = await executeValidator(
      makeCall({ validation_type: 'hex_color', value: '#ff0000' })
    );
    const parsed = parseContent(result);
    expect(parsed.all_valid).toBe(true);
  });

  it('should reject an invalid hex color', async () => {
    const result = await executeValidator(makeCall({ validation_type: 'hex_color', value: 'red' }));
    const parsed = parseContent(result);
    expect(parsed.all_valid).toBe(false);
  });
});

describe('executeValidator mac_address', () => {
  it('should validate a valid MAC address', async () => {
    const result = await executeValidator(
      makeCall({ validation_type: 'mac_address', value: '00:1B:44:11:3A:B7' })
    );
    const parsed = parseContent(result);
    expect(parsed.all_valid).toBe(true);
  });
});

describe('executeValidator mime_type', () => {
  it('should validate a valid MIME type', async () => {
    const result = await executeValidator(
      makeCall({ validation_type: 'mime_type', value: 'application/json' })
    );
    const parsed = parseContent(result);
    expect(parsed.all_valid).toBe(true);
  });
});

describe('executeValidator slug', () => {
  it('should validate a valid slug', async () => {
    const result = await executeValidator(
      makeCall({ validation_type: 'slug', value: 'my-slug-123' })
    );
    const parsed = parseContent(result);
    expect(parsed.all_valid).toBe(true);
  });

  it('should reject an invalid slug (spaces)', async () => {
    const result = await executeValidator(
      makeCall({ validation_type: 'slug', value: 'not a slug' })
    );
    const parsed = parseContent(result);
    expect(parsed.all_valid).toBe(false);
  });
});

describe('executeValidator numeric', () => {
  it('should validate a numeric string', async () => {
    const result = await executeValidator(makeCall({ validation_type: 'numeric', value: '12345' }));
    const parsed = parseContent(result);
    expect(parsed.all_valid).toBe(true);
  });

  it('should reject a non-numeric string', async () => {
    const result = await executeValidator(makeCall({ validation_type: 'numeric', value: 'abc' }));
    const parsed = parseContent(result);
    expect(parsed.all_valid).toBe(false);
  });
});

describe('executeValidator base64', () => {
  it('should validate a valid base64 string', async () => {
    const result = await executeValidator(
      makeCall({ validation_type: 'base64', value: 'SGVsbG8gV29ybGQ=' })
    );
    const parsed = parseContent(result);
    expect(parsed.all_valid).toBe(true);
  });
});

describe('executeValidator md5', () => {
  it('should validate a valid MD5 hash', async () => {
    const result = await executeValidator(
      makeCall({ validation_type: 'md5', value: 'd41d8cd98f00b204e9800998ecf8427e' })
    );
    const parsed = parseContent(result);
    expect(parsed.all_valid).toBe(true);
  });

  it('should reject an invalid MD5', async () => {
    const result = await executeValidator(
      makeCall({ validation_type: 'md5', value: 'not-a-hash' })
    );
    const parsed = parseContent(result);
    expect(parsed.all_valid).toBe(false);
  });
});

// ============================================================================
// SHA256 / SHA512 VALIDATION
// ============================================================================

describe('executeValidator sha256', () => {
  it('should validate a valid SHA256 hash', async () => {
    const sha256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    const result = await executeValidator(makeCall({ validation_type: 'sha256', value: sha256 }));
    const parsed = parseContent(result);
    expect(parsed.all_valid).toBe(true);
  });

  it('should reject an invalid SHA256 hash', async () => {
    const result = await executeValidator(
      makeCall({ validation_type: 'sha256', value: 'tooshort' })
    );
    const parsed = parseContent(result);
    expect(parsed.all_valid).toBe(false);
  });
});

describe('executeValidator sha512', () => {
  it('should validate a valid SHA512 hash', async () => {
    const sha512 =
      'cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e';
    const result = await executeValidator(makeCall({ validation_type: 'sha512', value: sha512 }));
    const parsed = parseContent(result);
    expect(parsed.all_valid).toBe(true);
  });
});

// ============================================================================
// MONGO ID VALIDATION
// ============================================================================

describe('executeValidator mongo_id', () => {
  it('should validate a valid MongoDB ObjectId', async () => {
    const result = await executeValidator(
      makeCall({ validation_type: 'mongo_id', value: '507f1f77bcf86cd799439011' })
    );
    const parsed = parseContent(result);
    expect(parsed.all_valid).toBe(true);
  });

  it('should reject an invalid MongoDB ObjectId', async () => {
    const result = await executeValidator(
      makeCall({ validation_type: 'mongo_id', value: 'not-a-mongo-id' })
    );
    const parsed = parseContent(result);
    expect(parsed.all_valid).toBe(false);
  });
});

// ============================================================================
// ISBN VALIDATION
// ============================================================================

describe('executeValidator isbn', () => {
  it('should validate a valid ISBN-10', async () => {
    const result = await executeValidator(
      makeCall({ validation_type: 'isbn', value: '0306406152' })
    );
    const parsed = parseContent(result);
    expect(parsed.all_valid).toBe(true);
    const res = parsed.results as { value: string; valid: boolean; details: { version: string } };
    expect(res.details.version).toBe('ISBN-10');
  });

  it('should validate a valid ISBN-13', async () => {
    const result = await executeValidator(
      makeCall({ validation_type: 'isbn', value: '9783161484100' })
    );
    const parsed = parseContent(result);
    expect(parsed.all_valid).toBe(true);
    const res = parsed.results as { value: string; valid: boolean; details: { version: string } };
    expect(res.details.version).toBe('ISBN-13');
  });

  it('should reject an invalid ISBN', async () => {
    const result = await executeValidator(
      makeCall({ validation_type: 'isbn', value: '1234567890' })
    );
    const parsed = parseContent(result);
    expect(parsed.all_valid).toBe(false);
  });
});

// ============================================================================
// ALPHANUMERIC VALIDATION
// ============================================================================

describe('executeValidator alphanumeric', () => {
  it('should validate alphanumeric string', async () => {
    const result = await executeValidator(
      makeCall({ validation_type: 'alphanumeric', value: 'abc123' })
    );
    const parsed = parseContent(result);
    expect(parsed.all_valid).toBe(true);
  });

  it('should validate alphanumeric with explicit locale', async () => {
    const result = await executeValidator(
      makeCall({ validation_type: 'alphanumeric', value: 'abc123', locale: 'en-US' })
    );
    const parsed = parseContent(result);
    expect(parsed.all_valid).toBe(true);
  });

  it('should reject non-alphanumeric string', async () => {
    const result = await executeValidator(
      makeCall({ validation_type: 'alphanumeric', value: 'abc 123!' })
    );
    const parsed = parseContent(result);
    expect(parsed.all_valid).toBe(false);
  });
});

// ============================================================================
// STRONG PASSWORD VALIDATION
// ============================================================================

describe('executeValidator strong_password', () => {
  it('should validate a strong password with detail fields', async () => {
    const result = await executeValidator(
      makeCall({ validation_type: 'strong_password', value: 'MyP@ssw0rd!' })
    );
    const parsed = parseContent(result);
    expect(parsed.all_valid).toBe(true);
    const res = parsed.results as {
      value: string;
      valid: boolean;
      details: {
        length: number;
        has_lowercase: boolean;
        has_uppercase: boolean;
        has_numbers: boolean;
        has_symbols: boolean;
      };
    };
    expect(res.details.length).toBe(11);
    expect(res.details.has_lowercase).toBe(true);
    expect(res.details.has_uppercase).toBe(true);
    expect(res.details.has_numbers).toBe(true);
    expect(res.details.has_symbols).toBe(true);
  });

  it('should include details even for a weak password', async () => {
    const result = await executeValidator(
      makeCall({ validation_type: 'strong_password', value: 'weak' })
    );
    const parsed = parseContent(result);
    expect(parsed.all_valid).toBe(false);
    const res = parsed.results as {
      value: string;
      valid: boolean;
      details: {
        length: number;
        has_lowercase: boolean;
        has_uppercase: boolean;
        has_numbers: boolean;
        has_symbols: boolean;
      };
    };
    expect(res.details).toBeDefined();
    expect(res.details.length).toBe(4);
    expect(res.details.has_lowercase).toBe(true);
    expect(res.details.has_uppercase).toBe(false);
    expect(res.details.has_numbers).toBe(false);
    expect(res.details.has_symbols).toBe(false);
  });
});

// ============================================================================
// BATCH VALIDATION (values array)
// ============================================================================

describe('executeValidator batch validation', () => {
  it('should validate multiple values and return array of results', async () => {
    const result = await executeValidator(
      makeCall({
        validation_type: 'email',
        values: ['test@example.com', 'invalid-email', 'also@valid.org'],
      })
    );
    const parsed = parseContent(result);
    expect(parsed.total_count).toBe(3);
    expect(parsed.valid_count).toBe(2);
    expect(parsed.all_valid).toBe(false);
    expect(Array.isArray(parsed.results)).toBe(true);
    const results = parsed.results as Array<{ value: string; valid: boolean }>;
    expect(results).toHaveLength(3);
    expect(results[0].valid).toBe(true);
    expect(results[1].valid).toBe(false);
    expect(results[2].valid).toBe(true);
  });

  it('should report all_valid=true when all values in batch are valid', async () => {
    const result = await executeValidator(
      makeCall({ validation_type: 'numeric', values: ['123', '456', '789'] })
    );
    const parsed = parseContent(result);
    expect(parsed.all_valid).toBe(true);
    expect(parsed.valid_count).toBe(3);
    expect(parsed.total_count).toBe(3);
  });

  it('should return single result object (not array) when single value is used', async () => {
    const result = await executeValidator(makeCall({ validation_type: 'numeric', value: '123' }));
    const parsed = parseContent(result);
    expect(Array.isArray(parsed.results)).toBe(false);
    const res = parsed.results as { value: string; valid: boolean };
    expect(res.value).toBe('123');
    expect(res.valid).toBe(true);
  });
});

// ============================================================================
// RESPONSE STRUCTURE
// ============================================================================

describe('executeValidator response structure', () => {
  it('should include validation_type in successful response', async () => {
    const result = await executeValidator(makeCall({ validation_type: 'slug', value: 'my-slug' }));
    const parsed = parseContent(result);
    expect(parsed.validation_type).toBe('slug');
  });

  it('should include all_valid, valid_count, total_count fields', async () => {
    const result = await executeValidator(makeCall({ validation_type: 'base64', value: '!!!' }));
    const parsed = parseContent(result);
    expect('all_valid' in parsed).toBe(true);
    expect('valid_count' in parsed).toBe(true);
    expect('total_count' in parsed).toBe(true);
  });

  it('should set isError=false on successful validation', async () => {
    const result = await executeValidator(
      makeCall({ validation_type: 'md5', value: 'd41d8cd98f00b204e9800998ecf8427e' })
    );
    expect(result.isError).toBe(false);
  });

  it('should omit details when there are none for the validation type', async () => {
    const result = await executeValidator(makeCall({ validation_type: 'url', value: 'not-a-url' }));
    const parsed = parseContent(result);
    const res = parsed.results as {
      value: string;
      valid: boolean;
      details?: Record<string, unknown>;
    };
    expect(res.details).toBeUndefined();
  });

  it('should return content as a JSON string', async () => {
    const result = await executeValidator(makeCall({ validation_type: 'numeric', value: '42' }));
    expect(typeof result.content).toBe('string');
    expect(() => JSON.parse(result.content)).not.toThrow();
  });
});
