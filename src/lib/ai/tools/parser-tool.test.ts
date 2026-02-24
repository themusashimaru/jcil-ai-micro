import { describe, it, expect } from 'vitest';
import { executeParser, isParserAvailable, parserTool } from './parser-tool';

function makeCall(args: Record<string, unknown>) {
  return { id: 'test', name: 'parse_grammar', arguments: args };
}

async function getResult(args: Record<string, unknown>) {
  const res = await executeParser(makeCall(args));
  return JSON.parse(res.content);
}

// -------------------------------------------------------------------
// Metadata
// -------------------------------------------------------------------
describe('parserTool metadata', () => {
  it('should have correct name', () => {
    expect(parserTool.name).toBe('parse_grammar');
  });

  it('should require operation and input', () => {
    expect(parserTool.parameters.required).toContain('operation');
    expect(parserTool.parameters.required).toContain('input');
  });
});

describe('isParserAvailable', () => {
  it('should return true', () => {
    expect(isParserAvailable()).toBe(true);
  });
});

// -------------------------------------------------------------------
// parse_arithmetic operation
// -------------------------------------------------------------------
describe('executeParser - parse_arithmetic', () => {
  it('should evaluate simple addition', async () => {
    const result = await getResult({ operation: 'parse_arithmetic', input: '1+2' });
    expect(result.operation).toBe('parse_arithmetic');
    expect(result.result).toBe(3);
  });

  it('should evaluate multiplication', async () => {
    const result = await getResult({ operation: 'parse_arithmetic', input: '3*4' });
    expect(result.result).toBe(12);
  });

  it('should respect operator precedence', async () => {
    const result = await getResult({ operation: 'parse_arithmetic', input: '1+2*3' });
    expect(result.result).toBe(7);
  });

  it('should handle parentheses', async () => {
    const result = await getResult({ operation: 'parse_arithmetic', input: '(1+2)*3' });
    expect(result.result).toBe(9);
  });

  it('should handle subtraction', async () => {
    const result = await getResult({ operation: 'parse_arithmetic', input: '10-3' });
    expect(result.result).toBe(7);
  });

  it('should handle division', async () => {
    const result = await getResult({ operation: 'parse_arithmetic', input: '10/2' });
    expect(result.result).toBe(5);
  });

  it('should strip whitespace', async () => {
    const result = await getResult({ operation: 'parse_arithmetic', input: '1 + 2 * 3' });
    expect(result.result).toBe(7);
  });

  it('should error on invalid expression', async () => {
    const res = await executeParser(makeCall({ operation: 'parse_arithmetic', input: 'abc' }));
    expect(res.isError).toBe(true);
  });
});

// -------------------------------------------------------------------
// validate operation
// -------------------------------------------------------------------
describe('executeParser - validate', () => {
  it('should validate valid arithmetic', async () => {
    const result = await getResult({
      operation: 'validate',
      input: '1+2',
      grammar: 'arithmetic',
    });
    expect(result.operation).toBe('validate');
    expect(result.valid).toBe(true);
  });

  it('should reject invalid arithmetic', async () => {
    const result = await getResult({
      operation: 'validate',
      input: 'hello',
      grammar: 'arithmetic',
    });
    expect(result.valid).toBe(false);
  });

  it('should validate valid JSON', async () => {
    const result = await getResult({
      operation: 'validate',
      input: '{"key": "value"}',
      grammar: 'json',
    });
    expect(result.valid).toBe(true);
    expect(result.grammar).toBe('json');
  });

  it('should reject invalid JSON', async () => {
    const result = await getResult({
      operation: 'validate',
      input: '{invalid}',
      grammar: 'json',
    });
    expect(result.valid).toBe(false);
  });
});

// -------------------------------------------------------------------
// tokenize operation
// -------------------------------------------------------------------
describe('executeParser - tokenize', () => {
  it('should tokenize code-like input', async () => {
    const result = await getResult({
      operation: 'tokenize',
      input: 'x = 42 + y',
    });
    expect(result.operation).toBe('tokenize');
    expect(result.token_count).toBeGreaterThan(0);
    expect(result.tokens.some((t: { type: string }) => t.type === 'identifier')).toBe(true);
    expect(result.tokens.some((t: { type: string }) => t.type === 'number')).toBe(true);
    expect(result.tokens.some((t: { type: string }) => t.type === 'operator')).toBe(true);
  });

  it('should tokenize strings', async () => {
    const result = await getResult({
      operation: 'tokenize',
      input: '"hello" + "world"',
    });
    const strings = result.tokens.filter((t: { type: string }) => t.type === 'string');
    expect(strings).toHaveLength(2);
  });

  it('should tokenize punctuation', async () => {
    const result = await getResult({
      operation: 'tokenize',
      input: 'foo(1, 2)',
    });
    const puncts = result.tokens.filter((t: { type: string }) => t.type === 'punctuation');
    expect(puncts.length).toBeGreaterThan(0);
  });

  it('should track positions', async () => {
    const result = await getResult({
      operation: 'tokenize',
      input: 'a + b',
    });
    expect(result.tokens[0].position).toBe(0);
    expect(result.tokens[0].value).toBe('a');
  });
});

// -------------------------------------------------------------------
// parse_custom operation
// -------------------------------------------------------------------
describe('executeParser - parse_custom', () => {
  it('should return message about custom parsing', async () => {
    const result = await getResult({
      operation: 'parse_custom',
      input: 'test',
    });
    expect(result.operation).toBe('parse_custom');
    expect(result.message.toLowerCase()).toContain('custom');
  });
});

// -------------------------------------------------------------------
// Error handling
// -------------------------------------------------------------------
describe('executeParser - errors', () => {
  it('should error for unknown operation', async () => {
    const res = await executeParser(makeCall({ operation: 'unknown', input: 'test' }));
    expect(res.isError).toBe(true);
  });

  it('should return toolCallId', async () => {
    const res = await executeParser({
      id: 'my-id',
      name: 'parse_grammar',
      arguments: { operation: 'tokenize', input: 'test' },
    });
    expect(res.toolCallId).toBe('my-id');
  });
});
