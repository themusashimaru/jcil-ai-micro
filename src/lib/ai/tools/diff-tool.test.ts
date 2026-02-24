/**
 * Comprehensive tests for TEXT DIFF COMPARISON TOOL
 * src/lib/ai/tools/diff-tool.ts
 */

// ============================================================================
// MOCKS — must be before any imports of the module under test
// ============================================================================

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: vi.fn() },
  })),
}));

vi.mock('@/lib/logger', () => ({
  logger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

// We do NOT mock 'diff' — it is a real library available in node_modules and the tool
// lazy-loads it via dynamic import. We let the real library be used for accurate testing.

import { describe, it, expect, vi } from 'vitest';
import { diffTool, isDiffAvailable, executeDiff } from './diff-tool';
import type { UnifiedToolCall, UnifiedToolResult, UnifiedTool } from '../providers/types';

// ============================================================================
// HELPERS
// ============================================================================

function makeToolCall(args: Record<string, unknown>, id = 'test-call-1'): UnifiedToolCall {
  return {
    id,
    name: 'diff_compare',
    arguments: args,
  };
}

function parseContent(result: UnifiedToolResult): Record<string, unknown> {
  return JSON.parse(result.content) as Record<string, unknown>;
}

// ============================================================================
// 1. TOOL DEFINITION (diffTool)
// ============================================================================

describe('diffTool definition', () => {
  it('should export diffTool as a UnifiedTool', () => {
    const tool: UnifiedTool = diffTool;
    expect(tool).toBeDefined();
    expect(tool.name).toBe('diff_compare');
  });

  it('should have a non-empty description', () => {
    expect(typeof diffTool.description).toBe('string');
    expect(diffTool.description.length).toBeGreaterThan(0);
  });

  it('should describe all five comparison modes', () => {
    expect(diffTool.description).toContain('chars');
    expect(diffTool.description).toContain('words');
    expect(diffTool.description).toContain('lines');
    expect(diffTool.description).toContain('sentences');
    expect(diffTool.description).toContain('json');
  });

  it('should describe all three output formats', () => {
    expect(diffTool.description).toContain('unified');
    expect(diffTool.description).toContain('inline');
    expect(diffTool.description).toContain('stats');
  });

  it('should have parameters of type object', () => {
    expect(diffTool.parameters.type).toBe('object');
  });

  it('should require text1 and text2', () => {
    expect(diffTool.parameters.required).toEqual(['text1', 'text2']);
  });

  it('should define text1 and text2 as string parameters', () => {
    expect(diffTool.parameters.properties.text1.type).toBe('string');
    expect(diffTool.parameters.properties.text2.type).toBe('string');
  });

  it('should define mode with correct enum values', () => {
    const mode = diffTool.parameters.properties.mode;
    expect(mode.type).toBe('string');
    expect(mode.enum).toEqual(['chars', 'words', 'lines', 'sentences', 'json']);
  });

  it('should define output_format with correct enum values', () => {
    const fmt = diffTool.parameters.properties.output_format;
    expect(fmt.type).toBe('string');
    expect(fmt.enum).toEqual(['unified', 'inline', 'stats']);
  });

  it('should define context_lines as number', () => {
    expect(diffTool.parameters.properties.context_lines.type).toBe('number');
  });

  it('should define boolean parameters for ignore_whitespace and ignore_case', () => {
    expect(diffTool.parameters.properties.ignore_whitespace.type).toBe('boolean');
    expect(diffTool.parameters.properties.ignore_case.type).toBe('boolean');
  });

  it('should define label1 and label2 as string parameters', () => {
    expect(diffTool.parameters.properties.label1.type).toBe('string');
    expect(diffTool.parameters.properties.label2.type).toBe('string');
  });
});

// ============================================================================
// 2. isDiffAvailable
// ============================================================================

describe('isDiffAvailable', () => {
  it('should return a boolean', async () => {
    const result = await isDiffAvailable();
    expect(typeof result).toBe('boolean');
  });

  it('should return true when diff library is available', async () => {
    expect(await isDiffAvailable()).toBe(true);
  });

  it('should return true on subsequent (cached) calls', async () => {
    const first = await isDiffAvailable();
    const second = await isDiffAvailable();
    expect(first).toBe(true);
    expect(second).toBe(true);
  });
});

// ============================================================================
// 3. executeDiff — validation errors
// ============================================================================

describe('executeDiff — validation', () => {
  it('should return error when text1 is undefined', async () => {
    const result = await executeDiff(makeToolCall({ text2: 'hello' }));
    expect(result.isError).toBe(true);
    expect(result.content).toContain('Both text1 and text2 are required');
    expect(result.toolCallId).toBe('test-call-1');
  });

  it('should return error when text2 is undefined', async () => {
    const result = await executeDiff(makeToolCall({ text1: 'hello' }));
    expect(result.isError).toBe(true);
    expect(result.content).toContain('Both text1 and text2 are required');
  });

  it('should return error when both text1 and text2 are undefined', async () => {
    const result = await executeDiff(makeToolCall({}));
    expect(result.isError).toBe(true);
    expect(result.content).toContain('Both text1 and text2 are required');
  });

  it('should always include the correct toolCallId', async () => {
    const result = await executeDiff(makeToolCall({ text1: 'a', text2: 'b' }, 'custom-id-42'));
    expect(result.toolCallId).toBe('custom-id-42');
  });
});

// ============================================================================
// 4. executeDiff — identical texts
// ============================================================================

describe('executeDiff — identical texts', () => {
  it('should report no differences for identical texts', async () => {
    const result = await executeDiff(makeToolCall({ text1: 'hello world', text2: 'hello world' }));
    const parsed = parseContent(result);
    expect(parsed.success).toBe(true);
    expect(parsed.hasChanges).toBe(false);
    expect(parsed.message).toContain('No differences found');
  });

  it('should report 100% similarity for identical texts', async () => {
    const result = await executeDiff(makeToolCall({ text1: 'same', text2: 'same' }));
    const parsed = parseContent(result);
    const stats = parsed.statistics as Record<string, number>;
    expect(stats.similarityPercent).toBe(100);
    expect(stats.totalChanges).toBe(0);
  });
});

// ============================================================================
// 5. executeDiff — diff modes
// ============================================================================

describe('executeDiff — diff modes', () => {
  it('should default to lines mode', async () => {
    const result = await executeDiff(
      makeToolCall({ text1: 'line1\nline2', text2: 'line1\nline3' })
    );
    const parsed = parseContent(result);
    expect(parsed.mode).toBe('lines');
  });

  it('should support chars mode', async () => {
    const result = await executeDiff(makeToolCall({ text1: 'abc', text2: 'adc', mode: 'chars' }));
    const parsed = parseContent(result);
    expect(parsed.mode).toBe('chars');
    expect(parsed.hasChanges).toBe(true);
  });

  it('should support words mode', async () => {
    const result = await executeDiff(
      makeToolCall({ text1: 'hello world', text2: 'hello universe', mode: 'words' })
    );
    const parsed = parseContent(result);
    expect(parsed.mode).toBe('words');
    expect(parsed.hasChanges).toBe(true);
  });

  it('should support lines mode explicitly', async () => {
    const result = await executeDiff(
      makeToolCall({ text1: 'line1\nline2\n', text2: 'line1\nline3\n', mode: 'lines' })
    );
    const parsed = parseContent(result);
    expect(parsed.mode).toBe('lines');
    expect(parsed.hasChanges).toBe(true);
  });

  it('should support sentences mode', async () => {
    const result = await executeDiff(
      makeToolCall({
        text1: 'Hello there. How are you?',
        text2: 'Hello there. How is it going?',
        mode: 'sentences',
      })
    );
    const parsed = parseContent(result);
    expect(parsed.mode).toBe('sentences');
    expect(parsed.hasChanges).toBe(true);
  });

  it('should support json mode with structural comparison', async () => {
    const result = await executeDiff(
      makeToolCall({
        text1: JSON.stringify({ a: 1, b: 2 }),
        text2: JSON.stringify({ a: 1, b: 3 }),
        mode: 'json',
      })
    );
    const parsed = parseContent(result);
    expect(parsed.mode).toBe('json');
    expect(parsed.hasChanges).toBe(true);
  });

  it('should return error for invalid JSON in first text (json mode)', async () => {
    const result = await executeDiff(
      makeToolCall({ text1: 'not json', text2: '{"valid": true}', mode: 'json' })
    );
    expect(result.isError).toBe(true);
    expect(result.content).toContain('Invalid JSON');
  });

  it('should return error for invalid JSON in second text (json mode)', async () => {
    const result = await executeDiff(
      makeToolCall({ text1: '{"valid": true}', text2: 'not json', mode: 'json' })
    );
    expect(result.isError).toBe(true);
    expect(result.content).toContain('Invalid JSON');
  });

  it('should fall back to lines mode for unknown mode value', async () => {
    const result = await executeDiff(
      makeToolCall({ text1: 'line1\nline2', text2: 'line1\nline3', mode: 'unknown_mode' })
    );
    expect(result.isError).toBeUndefined();
    const parsed = parseContent(result);
    expect(parsed.success).toBe(true);
  });
});

// ============================================================================
// 6. executeDiff — output formats
// ============================================================================

describe('executeDiff — output formats', () => {
  it('should default to unified format', async () => {
    const result = await executeDiff(makeToolCall({ text1: 'old', text2: 'new' }));
    const parsed = parseContent(result);
    expect(parsed.outputFormat).toBe('unified');
  });

  it('should produce unified format with --- and +++ markers', async () => {
    const result = await executeDiff(
      makeToolCall({ text1: 'line1\nline2\n', text2: 'line1\nline3\n', output_format: 'unified' })
    );
    const parsed = parseContent(result);
    expect(parsed.outputFormat).toBe('unified');
    const diffStr = parsed.diff as string;
    expect(diffStr).toContain('---');
    expect(diffStr).toContain('+++');
  });

  it('should produce inline format with [+] and [-] markers', async () => {
    const result = await executeDiff(
      makeToolCall({
        text1: 'hello world',
        text2: 'hello universe',
        mode: 'words',
        output_format: 'inline',
      })
    );
    const parsed = parseContent(result);
    expect(parsed.outputFormat).toBe('inline');
    const diffStr = parsed.diff as string;
    expect(diffStr).toContain('[+');
    expect(diffStr).toContain('[-');
  });

  it('should produce stats format with all statistic fields', async () => {
    const result = await executeDiff(
      makeToolCall({
        text1: 'hello world',
        text2: 'hello universe',
        mode: 'words',
        output_format: 'stats',
      })
    );
    const parsed = parseContent(result);
    expect(parsed.outputFormat).toBe('stats');
    const diffStr = parsed.diff as string;
    expect(diffStr).toContain('Comparison Statistics:');
    expect(diffStr).toContain('Additions:');
    expect(diffStr).toContain('Deletions:');
    expect(diffStr).toContain('Unchanged:');
    expect(diffStr).toContain('Total Changes:');
    expect(diffStr).toContain('Similarity:');
  });

  it('should fall back to unified for unknown output_format', async () => {
    const result = await executeDiff(
      makeToolCall({ text1: 'a\n', text2: 'b\n', output_format: 'nonexistent' })
    );
    const parsed = parseContent(result);
    expect(parsed.success).toBe(true);
    expect(typeof parsed.diff).toBe('string');
  });
});

// ============================================================================
// 7. executeDiff — preprocessing options
// ============================================================================

describe('executeDiff — preprocessing options', () => {
  it('should ignore whitespace differences when ignore_whitespace is true', async () => {
    const result = await executeDiff(
      makeToolCall({ text1: 'hello   world', text2: 'hello world', ignore_whitespace: true })
    );
    const parsed = parseContent(result);
    expect(parsed.hasChanges).toBe(false);
    expect((parsed.options as Record<string, unknown>).ignoreWhitespace).toBe(true);
  });

  it('should detect whitespace differences when ignore_whitespace is false', async () => {
    const result = await executeDiff(
      makeToolCall({
        text1: 'hello   world',
        text2: 'hello world',
        ignore_whitespace: false,
        mode: 'chars',
      })
    );
    const parsed = parseContent(result);
    expect(parsed.hasChanges).toBe(true);
  });

  it('should ignore case when ignore_case is true', async () => {
    const result = await executeDiff(
      makeToolCall({ text1: 'Hello World', text2: 'hello world', ignore_case: true })
    );
    const parsed = parseContent(result);
    expect(parsed.hasChanges).toBe(false);
    expect((parsed.options as Record<string, unknown>).ignoreCase).toBe(true);
  });

  it('should detect case differences when ignore_case is false', async () => {
    const result = await executeDiff(
      makeToolCall({ text1: 'Hello', text2: 'hello', ignore_case: false, mode: 'chars' })
    );
    const parsed = parseContent(result);
    expect(parsed.hasChanges).toBe(true);
  });

  it('should apply both ignore_whitespace and ignore_case together', async () => {
    const result = await executeDiff(
      makeToolCall({
        text1: 'Hello   World',
        text2: 'hello world',
        ignore_whitespace: true,
        ignore_case: true,
      })
    );
    const parsed = parseContent(result);
    expect(parsed.hasChanges).toBe(false);
  });

  it('should use custom context_lines value', async () => {
    const result = await executeDiff(
      makeToolCall({
        text1: 'a\nb\nc\nd\ne\nf\n',
        text2: 'a\nb\nX\nd\ne\nf\n',
        context_lines: 1,
        output_format: 'unified',
      })
    );
    const parsed = parseContent(result);
    expect((parsed.options as Record<string, unknown>).contextLines).toBe(1);
  });

  it('should default context_lines to 3', async () => {
    const result = await executeDiff(makeToolCall({ text1: 'old\n', text2: 'new\n' }));
    const parsed = parseContent(result);
    expect((parsed.options as Record<string, unknown>).contextLines).toBe(3);
  });

  it('should use custom labels', async () => {
    const result = await executeDiff(
      makeToolCall({ text1: 'old', text2: 'new', label1: 'Before', label2: 'After' })
    );
    const parsed = parseContent(result);
    const labels = parsed.labels as Record<string, string>;
    expect(labels.original).toBe('Before');
    expect(labels.modified).toBe('After');
  });

  it('should default labels to Original and Modified', async () => {
    const result = await executeDiff(makeToolCall({ text1: 'a', text2: 'b' }));
    const parsed = parseContent(result);
    const labels = parsed.labels as Record<string, string>;
    expect(labels.original).toBe('Original');
    expect(labels.modified).toBe('Modified');
  });
});

// ============================================================================
// 8. executeDiff — statistics
// ============================================================================

describe('executeDiff — statistics', () => {
  it('should include all expected statistic fields', async () => {
    const result = await executeDiff(
      makeToolCall({ text1: 'hello', text2: 'world', mode: 'chars' })
    );
    const parsed = parseContent(result);
    const stats = parsed.statistics as Record<string, number>;
    expect(typeof stats.additions).toBe('number');
    expect(typeof stats.deletions).toBe('number');
    expect(typeof stats.unchanged).toBe('number');
    expect(typeof stats.totalChanges).toBe('number');
    expect(typeof stats.similarityPercent).toBe('number');
  });

  it('should calculate totalChanges = additions + deletions', async () => {
    const result = await executeDiff(
      makeToolCall({ text1: 'abc\n', text2: 'xyz\n', mode: 'lines' })
    );
    const parsed = parseContent(result);
    const stats = parsed.statistics as Record<string, number>;
    expect(stats.totalChanges).toBe(stats.additions + stats.deletions);
  });

  it('should report 0% similarity for completely different char texts', async () => {
    const result = await executeDiff(makeToolCall({ text1: 'aaa', text2: 'bbb', mode: 'chars' }));
    const parsed = parseContent(result);
    const stats = parsed.statistics as Record<string, number>;
    expect(stats.similarityPercent).toBe(0);
  });

  it('should count additions correctly for appended content', async () => {
    const result = await executeDiff(
      makeToolCall({ text1: 'hello', text2: 'hello world', mode: 'chars' })
    );
    const parsed = parseContent(result);
    const stats = parsed.statistics as Record<string, number>;
    expect(stats.additions).toBeGreaterThan(0);
    expect(stats.deletions).toBe(0);
  });
});

// ============================================================================
// 9. executeDiff — changes array
// ============================================================================

describe('executeDiff — changes array', () => {
  it('should include a changes array', async () => {
    const result = await executeDiff(makeToolCall({ text1: 'abc', text2: 'adc', mode: 'chars' }));
    const parsed = parseContent(result);
    expect(Array.isArray(parsed.changes)).toBe(true);
  });

  it('should have type field on each change entry', async () => {
    const result = await executeDiff(makeToolCall({ text1: 'abc', text2: 'adc', mode: 'chars' }));
    const parsed = parseContent(result);
    const changes = parsed.changes as Array<{ type: string; value: string; count?: number }>;
    for (const change of changes) {
      expect(['added', 'removed', 'unchanged']).toContain(change.type);
      expect(typeof change.value).toBe('string');
    }
  });

  it('should include unchanged parts in changes', async () => {
    const result = await executeDiff(makeToolCall({ text1: 'abc', text2: 'adc', mode: 'chars' }));
    const parsed = parseContent(result);
    const changes = parsed.changes as Array<{ type: string }>;
    const unchanged = changes.filter((c) => c.type === 'unchanged');
    expect(unchanged.length).toBeGreaterThan(0);
  });

  it('should have at least one added and one removed entry for different texts', async () => {
    const result = await executeDiff(makeToolCall({ text1: 'abc', text2: 'adc', mode: 'chars' }));
    const parsed = parseContent(result);
    const changes = parsed.changes as Array<{ type: string }>;
    expect(changes.some((c) => c.type === 'added')).toBe(true);
    expect(changes.some((c) => c.type === 'removed')).toBe(true);
  });
});

// ============================================================================
// 10. executeDiff — result structure
// ============================================================================

describe('executeDiff — result structure', () => {
  it('should return success:true for valid comparisons', async () => {
    const result = await executeDiff(makeToolCall({ text1: 'a', text2: 'b' }));
    const parsed = parseContent(result);
    expect(parsed.success).toBe(true);
  });

  it('should include mode in output', async () => {
    const result = await executeDiff(makeToolCall({ text1: 'a', text2: 'b', mode: 'words' }));
    const parsed = parseContent(result);
    expect(parsed.mode).toBe('words');
  });

  it('should include outputFormat in output', async () => {
    const result = await executeDiff(
      makeToolCall({ text1: 'a', text2: 'b', output_format: 'inline' })
    );
    const parsed = parseContent(result);
    expect(parsed.outputFormat).toBe('inline');
  });

  it('should include hasChanges as a boolean', async () => {
    const result = await executeDiff(makeToolCall({ text1: 'same', text2: 'same' }));
    const parsed = parseContent(result);
    expect(typeof parsed.hasChanges).toBe('boolean');
  });

  it('should include labels object with original and modified keys', async () => {
    const result = await executeDiff(makeToolCall({ text1: 'a', text2: 'b' }));
    const parsed = parseContent(result);
    const labels = parsed.labels as Record<string, string>;
    expect(typeof labels.original).toBe('string');
    expect(typeof labels.modified).toBe('string');
  });

  it('should include options object with all three flags', async () => {
    const result = await executeDiff(makeToolCall({ text1: 'a', text2: 'b' }));
    const parsed = parseContent(result);
    const options = parsed.options as Record<string, unknown>;
    expect(typeof options.ignoreWhitespace).toBe('boolean');
    expect(typeof options.ignoreCase).toBe('boolean');
    expect(typeof options.contextLines).toBe('number');
  });

  it('should include diff string in output', async () => {
    const result = await executeDiff(makeToolCall({ text1: 'a', text2: 'b' }));
    const parsed = parseContent(result);
    expect(typeof parsed.diff).toBe('string');
  });

  it('should have a message indicating changes exist when texts differ', async () => {
    const result = await executeDiff(makeToolCall({ text1: 'old', text2: 'new', mode: 'chars' }));
    const parsed = parseContent(result);
    expect(parsed.message).toContain('difference(s) between texts');
  });
});

// ============================================================================
// 11. executeDiff — edge cases
// ============================================================================

describe('executeDiff — edge cases', () => {
  it('should handle empty strings', async () => {
    const result = await executeDiff(makeToolCall({ text1: '', text2: '' }));
    const parsed = parseContent(result);
    expect(parsed.success).toBe(true);
    expect(parsed.hasChanges).toBe(false);
  });

  it('should handle comparing empty string to non-empty string', async () => {
    const result = await executeDiff(makeToolCall({ text1: '', text2: 'hello', mode: 'chars' }));
    const parsed = parseContent(result);
    expect(parsed.hasChanges).toBe(true);
    const stats = parsed.statistics as Record<string, number>;
    expect(stats.additions).toBeGreaterThan(0);
    expect(stats.deletions).toBe(0);
  });

  it('should handle comparing non-empty string to empty string', async () => {
    const result = await executeDiff(makeToolCall({ text1: 'hello', text2: '', mode: 'chars' }));
    const parsed = parseContent(result);
    expect(parsed.hasChanges).toBe(true);
    const stats = parsed.statistics as Record<string, number>;
    expect(stats.deletions).toBeGreaterThan(0);
    expect(stats.additions).toBe(0);
  });

  it('should handle very long texts', async () => {
    const long1 = 'a'.repeat(10000);
    const long2 = 'b'.repeat(10000);
    const result = await executeDiff(makeToolCall({ text1: long1, text2: long2, mode: 'chars' }));
    expect(result.isError).toBeUndefined();
    const parsed = parseContent(result);
    expect(parsed.success).toBe(true);
  });

  it('should handle multiline text diffs correctly', async () => {
    const result = await executeDiff(
      makeToolCall({
        text1: 'line1\nline2\nline3',
        text2: 'line1\nmodified\nline3',
        mode: 'lines',
      })
    );
    const parsed = parseContent(result);
    expect(parsed.success).toBe(true);
    expect(parsed.hasChanges).toBe(true);
  });

  it('should treat identical JSON with different formatting as equal in json mode', async () => {
    const result = await executeDiff(
      makeToolCall({
        text1: '{"a":1,"b":2}',
        text2: '{ "a": 1, "b": 2 }',
        mode: 'json',
      })
    );
    const parsed = parseContent(result);
    expect(parsed.success).toBe(true);
    expect(parsed.hasChanges).toBe(false);
  });

  it('should handle context_lines of 0', async () => {
    const result = await executeDiff(
      makeToolCall({
        text1: 'a\nb\nc\nd\ne\n',
        text2: 'a\nb\nX\nd\ne\n',
        context_lines: 0,
        output_format: 'unified',
      })
    );
    const parsed = parseContent(result);
    expect(parsed.success).toBe(true);
    expect((parsed.options as Record<string, unknown>).contextLines).toBe(0);
  });

  it('should handle special characters in text', async () => {
    const result = await executeDiff(
      makeToolCall({
        text1: 'hello <world> & "friends"',
        text2: 'hello <universe> & "foes"',
        mode: 'words',
      })
    );
    const parsed = parseContent(result);
    expect(parsed.success).toBe(true);
    expect(parsed.hasChanges).toBe(true);
  });

  it('should handle unicode text', async () => {
    const result = await executeDiff(
      makeToolCall({ text1: 'caf\u00e9', text2: 'cafe', mode: 'chars' })
    );
    const parsed = parseContent(result);
    expect(parsed.success).toBe(true);
    expect(parsed.hasChanges).toBe(true);
  });
});
