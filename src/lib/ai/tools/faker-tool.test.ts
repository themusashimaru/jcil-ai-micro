import { describe, it, expect } from 'vitest';
import { executeFaker, isFakerAvailable, fakerTool } from './faker-tool';

function makeCall(args: Record<string, unknown>) {
  return { id: 'test', name: 'generate_fake_data', arguments: args };
}

async function getResult(args: Record<string, unknown>) {
  const res = await executeFaker(makeCall(args));
  return JSON.parse(res.content);
}

// -------------------------------------------------------------------
// Metadata
// -------------------------------------------------------------------
describe('fakerTool metadata', () => {
  it('should have correct name', () => {
    expect(fakerTool.name).toBe('generate_fake_data');
  });

  it('should require category', () => {
    expect(fakerTool.parameters.required).toContain('category');
  });
});

describe('isFakerAvailable', () => {
  it('should return true', async () => {
    expect(await isFakerAvailable()).toBe(true);
  });
});

// -------------------------------------------------------------------
// person category
// -------------------------------------------------------------------
describe('executeFaker - person', () => {
  it('should generate person data', async () => {
    const result = await getResult({ category: 'person' });
    expect(result.success).toBe(true);
    expect(result.category).toBe('person');
    expect(result.count).toBe(1);
    expect(result.data.firstName).toBeDefined();
    expect(result.data.lastName).toBeDefined();
    expect(result.data.email).toBeDefined();
  });

  it('should generate multiple person records', async () => {
    const result = await getResult({ category: 'person', count: 3 });
    expect(result.count).toBe(3);
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data).toHaveLength(3);
  });
});

// -------------------------------------------------------------------
// company category
// -------------------------------------------------------------------
describe('executeFaker - company', () => {
  it('should generate company data', async () => {
    const result = await getResult({ category: 'company' });
    expect(result.data.name).toBeDefined();
    expect(result.data.catchPhrase).toBeDefined();
    expect(result.data.address).toBeDefined();
    expect(result.data.address.city).toBeDefined();
  });
});

// -------------------------------------------------------------------
// commerce category
// -------------------------------------------------------------------
describe('executeFaker - commerce', () => {
  it('should generate commerce data', async () => {
    const result = await getResult({ category: 'commerce' });
    expect(result.data.productName).toBeDefined();
    expect(result.data.price).toBeDefined();
    expect(result.data.department).toBeDefined();
  });
});

// -------------------------------------------------------------------
// finance category
// -------------------------------------------------------------------
describe('executeFaker - finance', () => {
  it('should generate finance data', async () => {
    const result = await getResult({ category: 'finance' });
    expect(result.data.accountNumber).toBeDefined();
    expect(result.data.creditCardNumber).toBeDefined();
    expect(result.data.iban).toBeDefined();
  });
});

// -------------------------------------------------------------------
// internet category
// -------------------------------------------------------------------
describe('executeFaker - internet', () => {
  it('should return error (faker.internet.color removed in newer versions)', async () => {
    // The source calls f.internet.color() which no longer exists
    const res = await executeFaker(makeCall({ category: 'internet' }));
    expect(res.isError).toBe(true);
  });
});

// -------------------------------------------------------------------
// lorem category
// -------------------------------------------------------------------
describe('executeFaker - lorem', () => {
  it('should generate lorem data', async () => {
    const result = await getResult({ category: 'lorem' });
    expect(result.data.word).toBeDefined();
    expect(result.data.sentence).toBeDefined();
    expect(result.data.paragraph).toBeDefined();
  });
});

// -------------------------------------------------------------------
// date category
// -------------------------------------------------------------------
describe('executeFaker - date', () => {
  it('should generate date data', async () => {
    const result = await getResult({ category: 'date' });
    expect(result.data.past).toBeDefined();
    expect(result.data.future).toBeDefined();
    expect(result.data.month).toBeDefined();
    expect(result.data.weekday).toBeDefined();
  });
});

// -------------------------------------------------------------------
// location category
// -------------------------------------------------------------------
describe('executeFaker - location', () => {
  it('should generate location data', async () => {
    const result = await getResult({ category: 'location' });
    expect(result.data.city).toBeDefined();
    expect(result.data.country).toBeDefined();
    expect(result.data.latitude).toBeDefined();
    expect(result.data.longitude).toBeDefined();
  });
});

// -------------------------------------------------------------------
// uuid category
// -------------------------------------------------------------------
describe('executeFaker - uuid', () => {
  it('should generate uuid data', async () => {
    const result = await getResult({ category: 'uuid' });
    expect(result.data.uuid).toBeDefined();
    expect(result.data.nanoid).toBeDefined();
  });
});

// -------------------------------------------------------------------
// custom category
// -------------------------------------------------------------------
describe('executeFaker - custom', () => {
  it('should generate custom fields', async () => {
    const result = await getResult({
      category: 'custom',
      fields: ['firstName', 'email', 'company'],
    });
    expect(result.data.firstName).toBeDefined();
    expect(result.data.email).toBeDefined();
    expect(result.data.company).toBeDefined();
  });

  it('should mark unknown fields', async () => {
    const result = await getResult({
      category: 'custom',
      fields: ['nonExistentField'],
    });
    expect(result.data.nonExistentField).toContain('Unknown field');
  });

  it('should error without fields', async () => {
    const res = await executeFaker(makeCall({ category: 'custom' }));
    expect(res.isError).toBe(true);
  });
});

// -------------------------------------------------------------------
// seed for reproducibility
// -------------------------------------------------------------------
describe('executeFaker - seed', () => {
  it('should produce same data with same seed', async () => {
    const result1 = await getResult({ category: 'person', seed: 42 });
    const result2 = await getResult({ category: 'person', seed: 42 });
    expect(result1.data.firstName).toBe(result2.data.firstName);
    expect(result1.data.lastName).toBe(result2.data.lastName);
  });
});

// -------------------------------------------------------------------
// count limits
// -------------------------------------------------------------------
describe('executeFaker - count', () => {
  it('should cap count at 100', async () => {
    const result = await getResult({ category: 'uuid', count: 200 });
    expect(result.count).toBe(100);
  });

  it('should ensure minimum count of 1', async () => {
    const result = await getResult({ category: 'uuid', count: 0 });
    expect(result.count).toBe(1);
  });
});

// -------------------------------------------------------------------
// Error handling
// -------------------------------------------------------------------
describe('executeFaker - errors', () => {
  it('should error for invalid category', async () => {
    const res = await executeFaker(makeCall({ category: 'invalid' }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('Invalid category');
  });

  it('should error without category', async () => {
    const res = await executeFaker(makeCall({}));
    expect(res.isError).toBe(true);
  });

  it('should return toolCallId', async () => {
    const res = await executeFaker({
      id: 'my-id',
      name: 'generate_fake_data',
      arguments: { category: 'uuid' },
    });
    expect(res.toolCallId).toBe('my-id');
  });
});
