import { describe, it, expect } from 'vitest';
import { executePhone, isPhoneAvailable, phoneTool } from './phone-tool';

function makeCall(args: Record<string, unknown>) {
  return { id: 'test', name: 'phone_validate', arguments: args };
}

async function getResult(args: Record<string, unknown>) {
  const res = await executePhone(makeCall(args));
  return JSON.parse(res.content);
}

// -------------------------------------------------------------------
// Metadata
// -------------------------------------------------------------------
describe('phoneTool metadata', () => {
  it('should have correct name', () => {
    expect(phoneTool.name).toBe('phone_validate');
  });

  it('should require operation and phone_number', () => {
    expect(phoneTool.parameters.required).toContain('operation');
    expect(phoneTool.parameters.required).toContain('phone_number');
  });
});

describe('isPhoneAvailable', () => {
  it('should return true', () => {
    expect(isPhoneAvailable()).toBe(true);
  });
});

// -------------------------------------------------------------------
// validate operation
// -------------------------------------------------------------------
describe('executePhone - validate', () => {
  it('should validate a valid US number', async () => {
    const result = await getResult({
      operation: 'validate',
      phone_number: '+12025551234',
    });
    expect(result.operation).toBe('validate');
    expect(result.valid).toBe(true);
    expect(result.country).toBe('US');
  });

  it('should validate with country_code hint', async () => {
    const result = await getResult({
      operation: 'validate',
      phone_number: '2025551234',
      country_code: 'US',
    });
    expect(result.valid).toBe(true);
    expect(result.country).toBe('US');
  });

  it('should validate a UK number', async () => {
    const result = await getResult({
      operation: 'validate',
      phone_number: '+442071234567',
    });
    expect(result.valid).toBe(true);
    expect(result.country).toBe('GB');
  });

  it('should reject invalid number', async () => {
    const result = await getResult({
      operation: 'validate',
      phone_number: '123',
      country_code: 'US',
    });
    expect(result.valid).toBe(false);
  });
});

// -------------------------------------------------------------------
// format operation
// -------------------------------------------------------------------
describe('executePhone - format', () => {
  it('should format in international', async () => {
    const result = await getResult({
      operation: 'format',
      phone_number: '+12025551234',
      format: 'INTERNATIONAL',
    });
    expect(result.operation).toBe('format');
    expect(result.formatted).toContain('+1');
    expect(result.allFormats).toBeDefined();
  });

  it('should return all format variants', async () => {
    const result = await getResult({
      operation: 'format',
      phone_number: '+12025551234',
    });
    expect(result.allFormats.E164).toBe('+12025551234');
    expect(result.allFormats.NATIONAL).toBeDefined();
    expect(result.allFormats.RFC3966).toContain('tel:');
  });

  it('should format in E164', async () => {
    const result = await getResult({
      operation: 'format',
      phone_number: '2025551234',
      country_code: 'US',
      format: 'E164',
    });
    expect(result.formatted).toBe('+12025551234');
  });
});

// -------------------------------------------------------------------
// parse operation
// -------------------------------------------------------------------
describe('executePhone - parse', () => {
  it('should parse and return full details', async () => {
    const result = await getResult({
      operation: 'parse',
      phone_number: '+12025551234',
    });
    expect(result.operation).toBe('parse');
    expect(result.country).toBe('US');
    expect(result.countryCallingCode).toBe('+1');
    expect(result.nationalNumber).toBeDefined();
    expect(result.formats).toBeDefined();
    expect(result.formats.e164).toBe('+12025551234');
  });

  it('should include type info', async () => {
    const result = await getResult({
      operation: 'parse',
      phone_number: '+12025551234',
    });
    expect(result.type).toBeDefined();
    expect(result.typeDescription).toBeDefined();
  });
});

// -------------------------------------------------------------------
// type operation
// -------------------------------------------------------------------
describe('executePhone - type', () => {
  it('should detect phone type', async () => {
    const result = await getResult({
      operation: 'type',
      phone_number: '+12025551234',
    });
    expect(result.operation).toBe('type');
    expect(result.type).toBeDefined();
    expect(result.description).toBeDefined();
    expect(typeof result.isMobile).toBe('boolean');
    expect(typeof result.isFixedLine).toBe('boolean');
    expect(typeof result.isTollFree).toBe('boolean');
    expect(typeof result.isPremiumRate).toBe('boolean');
  });
});

// -------------------------------------------------------------------
// Error handling
// -------------------------------------------------------------------
describe('executePhone - errors', () => {
  it('should handle unparseable number gracefully', async () => {
    const result = await getResult({
      operation: 'validate',
      phone_number: 'not-a-number',
    });
    // Should not throw - returns valid:false
    expect(result.valid).toBe(false);
  });

  it('should handle unknown operation', async () => {
    const res = await executePhone(makeCall({ operation: 'xyz', phone_number: '+12025551234' }));
    expect(res.isError).toBe(true);
  });

  it('should return toolCallId', async () => {
    const res = await executePhone({
      id: 'my-id',
      name: 'phone_validate',
      arguments: { operation: 'validate', phone_number: '+12025551234' },
    });
    expect(res.toolCallId).toBe('my-id');
  });

  it('should handle string arguments', async () => {
    const res = await executePhone({
      id: 'test',
      name: 'phone_validate',
      arguments: JSON.stringify({ operation: 'validate', phone_number: '+12025551234' }),
    });
    const result = JSON.parse(res.content);
    expect(result.valid).toBe(true);
  });
});
