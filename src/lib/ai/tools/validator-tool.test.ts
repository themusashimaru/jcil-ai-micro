import { describe, it, expect } from 'vitest';
import { executeValidator, isValidatorAvailable, validatorTool } from './validator-tool';

function makeCall(args: Record<string, unknown>) {
  return { id: 'test', name: 'validate_data', arguments: args };
}

async function getResult(args: Record<string, unknown>) {
  const res = await executeValidator(makeCall(args));
  return JSON.parse(res.content);
}

// -------------------------------------------------------------------
// Metadata
// -------------------------------------------------------------------
describe('validatorTool metadata', () => {
  it('should have correct name', () => {
    expect(validatorTool.name).toBe('validate_data');
  });

  it('should require validation_type', () => {
    expect(validatorTool.parameters.required).toContain('validation_type');
  });
});

describe('isValidatorAvailable', () => {
  it('should return true', () => {
    expect(isValidatorAvailable()).toBe(true);
  });
});

// -------------------------------------------------------------------
// email validation
// -------------------------------------------------------------------
describe('executeValidator - email', () => {
  it('should validate correct email', async () => {
    const result = await getResult({ validation_type: 'email', value: 'test@example.com' });
    expect(result.all_valid).toBe(true);
    expect(result.results.valid).toBe(true);
    expect(result.results.details.normalized).toBeDefined();
  });

  it('should reject invalid email', async () => {
    const result = await getResult({ validation_type: 'email', value: 'not-an-email' });
    expect(result.all_valid).toBe(false);
    expect(result.results.valid).toBe(false);
  });
});

// -------------------------------------------------------------------
// url validation
// -------------------------------------------------------------------
describe('executeValidator - url', () => {
  it('should validate correct URL', async () => {
    const result = await getResult({ validation_type: 'url', value: 'https://example.com' });
    expect(result.results.valid).toBe(true);
  });

  it('should reject invalid URL', async () => {
    const result = await getResult({ validation_type: 'url', value: 'not a url' });
    expect(result.results.valid).toBe(false);
  });
});

// -------------------------------------------------------------------
// ip validation
// -------------------------------------------------------------------
describe('executeValidator - ip', () => {
  it('should validate IPv4', async () => {
    const result = await getResult({ validation_type: 'ip', value: '192.168.1.1' });
    expect(result.results.valid).toBe(true);
    expect(result.results.details.version).toBe('v4');
  });

  it('should validate IPv6', async () => {
    const result = await getResult({ validation_type: 'ip', value: '::1' });
    expect(result.results.valid).toBe(true);
    expect(result.results.details.version).toBe('v6');
  });

  it('should reject invalid IP', async () => {
    const result = await getResult({ validation_type: 'ip', value: '999.999.999.999' });
    expect(result.results.valid).toBe(false);
  });
});

// -------------------------------------------------------------------
// uuid validation
// -------------------------------------------------------------------
describe('executeValidator - uuid', () => {
  it('should validate UUID v4', async () => {
    const result = await getResult({
      validation_type: 'uuid',
      value: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.results.valid).toBe(true);
  });

  it('should reject invalid UUID', async () => {
    const result = await getResult({ validation_type: 'uuid', value: 'not-a-uuid' });
    expect(result.results.valid).toBe(false);
  });
});

// -------------------------------------------------------------------
// json validation
// -------------------------------------------------------------------
describe('executeValidator - json', () => {
  it('should validate JSON object', async () => {
    const result = await getResult({ validation_type: 'json', value: '{"a":1}' });
    expect(result.results.valid).toBe(true);
    expect(result.results.details.type).toBe('object');
  });

  it('should validate JSON array', async () => {
    const result = await getResult({ validation_type: 'json', value: '[1,2,3]' });
    expect(result.results.valid).toBe(true);
    expect(result.results.details.type).toBe('array');
  });

  it('should reject invalid JSON', async () => {
    const result = await getResult({ validation_type: 'json', value: '{invalid' });
    expect(result.results.valid).toBe(false);
  });
});

// -------------------------------------------------------------------
// other validation types
// -------------------------------------------------------------------
describe('executeValidator - various types', () => {
  it('should validate hex color', async () => {
    const result = await getResult({ validation_type: 'hex_color', value: '#ff0000' });
    expect(result.results.valid).toBe(true);
  });

  it('should validate MAC address', async () => {
    const result = await getResult({ validation_type: 'mac_address', value: '00:1B:44:11:3A:B7' });
    expect(result.results.valid).toBe(true);
  });

  it('should validate MIME type', async () => {
    const result = await getResult({ validation_type: 'mime_type', value: 'application/json' });
    expect(result.results.valid).toBe(true);
  });

  it('should validate slug', async () => {
    const result = await getResult({ validation_type: 'slug', value: 'my-slug-123' });
    expect(result.results.valid).toBe(true);
  });

  it('should validate numeric', async () => {
    const result = await getResult({ validation_type: 'numeric', value: '12345' });
    expect(result.results.valid).toBe(true);
  });

  it('should validate base64', async () => {
    const result = await getResult({ validation_type: 'base64', value: 'SGVsbG8gV29ybGQ=' });
    expect(result.results.valid).toBe(true);
  });

  it('should validate date (ISO8601)', async () => {
    const result = await getResult({ validation_type: 'date', value: '2024-01-15T10:30:00Z' });
    expect(result.results.valid).toBe(true);
    expect(result.results.details.format).toBe('ISO8601');
  });
});

// -------------------------------------------------------------------
// batch validation
// -------------------------------------------------------------------
describe('executeValidator - batch', () => {
  it('should validate multiple values', async () => {
    const result = await getResult({
      validation_type: 'email',
      values: ['test@example.com', 'bad-email', 'also@valid.org'],
    });
    expect(result.total_count).toBe(3);
    expect(result.valid_count).toBe(2);
    expect(result.all_valid).toBe(false);
    expect(Array.isArray(result.results)).toBe(true);
  });

  it('should report all valid for valid batch', async () => {
    const result = await getResult({
      validation_type: 'numeric',
      values: ['123', '456', '789'],
    });
    expect(result.all_valid).toBe(true);
    expect(result.valid_count).toBe(3);
  });
});

// -------------------------------------------------------------------
// Error handling
// -------------------------------------------------------------------
describe('executeValidator - errors', () => {
  it('should error without validation_type', async () => {
    const res = await executeValidator(makeCall({}));
    expect(res.isError).toBe(true);
  });

  it('should error without value or values', async () => {
    const res = await executeValidator(makeCall({ validation_type: 'email' }));
    expect(res.isError).toBe(true);
  });

  it('should handle unknown validation type', async () => {
    const result = await getResult({ validation_type: 'unknown_type', value: 'test' });
    expect(result.results.valid).toBe(false);
    expect(result.results.details.error).toContain('Unknown');
  });

  it('should return toolCallId', async () => {
    const res = await executeValidator({
      id: 'my-id',
      name: 'validate_data',
      arguments: { validation_type: 'email', value: 'x@y.com' },
    });
    expect(res.toolCallId).toBe('my-id');
  });
});
