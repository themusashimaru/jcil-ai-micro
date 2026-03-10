import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { extractJSON, extractAllJSON } from './jsonRepair';

// -------------------------------------------------------------------
// extractJSON
// -------------------------------------------------------------------
describe('extractJSON', () => {
  it('should parse valid JSON directly', () => {
    const result = extractJSON<{ name: string }>('{"name": "test"}');
    expect(result).toEqual({ name: 'test' });
  });

  it('should extract JSON from markdown code block', () => {
    const text = 'Here is the result:\n```json\n{"value": 42}\n```\n';
    const result = extractJSON<{ value: number }>(text);
    expect(result).toEqual({ value: 42 });
  });

  it('should extract JSON from code block without language tag', () => {
    const text = '```\n{"a": 1}\n```';
    const result = extractJSON(text);
    expect(result).toEqual({ a: 1 });
  });

  it('should extract JSON object from surrounding text', () => {
    const text = 'The answer is {"result": true} as shown';
    const result = extractJSON(text);
    expect(result).toEqual({ result: true });
  });

  it('should extract JSON array from text', () => {
    const text = 'Here are results: [1, 2, 3]';
    const result = extractJSON(text);
    expect(result).toEqual([1, 2, 3]);
  });

  it('should fix trailing commas', () => {
    const text = '{"a": 1, "b": 2,}';
    const result = extractJSON(text);
    expect(result).toEqual({ a: 1, b: 2 });
  });

  it('should fix single quotes', () => {
    const text = "{'name': 'test'}";
    const result = extractJSON(text);
    expect(result).toEqual({ name: 'test' });
  });

  it('should fix unquoted property names', () => {
    const text = '{name: "test", value: 42}';
    const result = extractJSON(text);
    expect(result).toEqual({ name: 'test', value: 42 });
  });

  it('should fix unclosed braces', () => {
    const text = '{"name": "test"';
    const result = extractJSON(text);
    expect(result).toEqual({ name: 'test' });
  });

  it('should fix undefined values', () => {
    const text = '{"name": undefined}';
    const result = extractJSON(text);
    expect(result).toEqual({ name: null });
  });

  it('should fix NaN values', () => {
    const text = '{"value": NaN}';
    const result = extractJSON(text);
    expect(result).toEqual({ value: null });
  });

  it('should return null for completely invalid input', () => {
    const result = extractJSON('this is just text');
    expect(result).toBeNull();
  });

  it('should return fallback when provided and parsing fails', () => {
    const result = extractJSON('invalid', { default: true });
    expect(result).toEqual({ default: true });
  });

  it('should return null for empty string', () => {
    const result = extractJSON('');
    expect(result).toBeNull();
  });

  it('should handle nested objects', () => {
    const text = '{"a": {"b": {"c": 1}}}';
    const result = extractJSON(text);
    expect(result).toEqual({ a: { b: { c: 1 } } });
  });

  it('should prefer the largest code block', () => {
    const text =
      '```json\n{"small": true}\n```\nSome text\n```json\n{"large": true, "extra": "data"}\n```';
    const result = extractJSON<Record<string, unknown>>(text);
    // Should pick the larger one
    expect(result).toHaveProperty('large');
  });

  it('should remove JavaScript comments', () => {
    const text = '{\n// comment\n"name": "test" /* block */\n}';
    const result = extractJSON(text);
    expect(result).toEqual({ name: 'test' });
  });
});

// -------------------------------------------------------------------
// extractAllJSON
// -------------------------------------------------------------------
describe('extractAllJSON', () => {
  it('should extract multiple JSON from code blocks', () => {
    const text = '```json\n{"a": 1}\n```\ntext\n```json\n{"b": 2}\n```';
    const results = extractAllJSON(text);
    expect(results).toHaveLength(2);
  });

  it('should return empty array for no JSON', () => {
    const results = extractAllJSON('just plain text');
    expect(results).toHaveLength(0);
  });

  it('should find inline JSON objects when no code blocks', () => {
    const text = 'First: {"a": 1} and second: {"b": 2}';
    const results = extractAllJSON(text);
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it('should return array of parsed objects', () => {
    const text = '```json\n{"name": "alice"}\n```\n```json\n{"name": "bob"}\n```';
    const results = extractAllJSON<{ name: string }>(text);
    expect(results[0].name).toBe('alice');
    expect(results[1].name).toBe('bob');
  });

  it('should handle single code block', () => {
    const text = '```json\n{"single": true}\n```';
    const results = extractAllJSON(text);
    expect(results).toHaveLength(1);
  });
});
