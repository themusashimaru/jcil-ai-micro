import { describe, it, expect } from 'vitest';
import { executeDiff, isDiffAvailable, diffTool } from './diff-tool';

function makeCall(args: Record<string, unknown>) {
  return { id: 'test', name: 'diff_compare', arguments: args };
}

async function getResult(args: Record<string, unknown>) {
  const res = await executeDiff(makeCall(args));
  return JSON.parse(res.content);
}

// -------------------------------------------------------------------
// Metadata
// -------------------------------------------------------------------
describe('diffTool metadata', () => {
  it('should have correct name', () => {
    expect(diffTool.name).toBe('diff_compare');
  });

  it('should require text1 and text2', () => {
    expect(diffTool.parameters.required).toContain('text1');
    expect(diffTool.parameters.required).toContain('text2');
  });
});

describe('isDiffAvailable', () => {
  it('should return true', async () => {
    expect(await isDiffAvailable()).toBe(true);
  });
});

// -------------------------------------------------------------------
// lines mode (default)
// -------------------------------------------------------------------
describe('executeDiff - lines mode', () => {
  it('should detect no differences for identical texts', async () => {
    const result = await getResult({ text1: 'hello\nworld', text2: 'hello\nworld' });
    expect(result.hasChanges).toBe(false);
    expect(result.statistics.totalChanges).toBe(0);
    expect(result.statistics.similarityPercent).toBe(100);
  });

  it('should detect line additions', async () => {
    const result = await getResult({
      text1: 'line1\nline2',
      text2: 'line1\nline2\nline3',
    });
    expect(result.hasChanges).toBe(true);
    expect(result.statistics.additions).toBeGreaterThan(0);
    expect(result.mode).toBe('lines');
  });

  it('should detect line deletions', async () => {
    const result = await getResult({
      text1: 'line1\nline2\nline3',
      text2: 'line1\nline3',
    });
    expect(result.hasChanges).toBe(true);
    expect(result.statistics.deletions).toBeGreaterThan(0);
  });

  it('should use unified output format by default', async () => {
    const result = await getResult({
      text1: 'old text',
      text2: 'new text',
    });
    expect(result.outputFormat).toBe('unified');
    expect(result.diff).toBeDefined();
  });
});

// -------------------------------------------------------------------
// chars mode
// -------------------------------------------------------------------
describe('executeDiff - chars mode', () => {
  it('should compare character by character', async () => {
    const result = await getResult({
      text1: 'hello',
      text2: 'hallo',
      mode: 'chars',
    });
    expect(result.hasChanges).toBe(true);
    expect(result.mode).toBe('chars');
    expect(result.changes.length).toBeGreaterThan(1);
  });
});

// -------------------------------------------------------------------
// words mode
// -------------------------------------------------------------------
describe('executeDiff - words mode', () => {
  it('should compare word by word', async () => {
    const result = await getResult({
      text1: 'the quick fox',
      text2: 'the slow fox',
      mode: 'words',
    });
    expect(result.hasChanges).toBe(true);
    expect(result.mode).toBe('words');
  });
});

// -------------------------------------------------------------------
// sentences mode
// -------------------------------------------------------------------
describe('executeDiff - sentences mode', () => {
  it('should compare sentence by sentence', async () => {
    const result = await getResult({
      text1: 'First sentence. Second sentence.',
      text2: 'First sentence. Third sentence.',
      mode: 'sentences',
    });
    expect(result.hasChanges).toBe(true);
    expect(result.mode).toBe('sentences');
  });
});

// -------------------------------------------------------------------
// json mode
// -------------------------------------------------------------------
describe('executeDiff - json mode', () => {
  it('should compare JSON structures', async () => {
    const result = await getResult({
      text1: '{"a":1,"b":2}',
      text2: '{"a":1,"b":3}',
      mode: 'json',
    });
    expect(result.hasChanges).toBe(true);
    expect(result.mode).toBe('json');
  });

  it('should error on invalid JSON', async () => {
    const res = await executeDiff(makeCall({ text1: 'not json', text2: '{"a":1}', mode: 'json' }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('Invalid JSON');
  });
});

// -------------------------------------------------------------------
// inline output format
// -------------------------------------------------------------------
describe('executeDiff - inline format', () => {
  it('should show inline markers', async () => {
    const result = await getResult({
      text1: 'hello world',
      text2: 'hello earth',
      mode: 'words',
      output_format: 'inline',
    });
    expect(result.outputFormat).toBe('inline');
    expect(result.diff).toContain('[+');
    expect(result.diff).toContain('[-');
  });
});

// -------------------------------------------------------------------
// stats output format
// -------------------------------------------------------------------
describe('executeDiff - stats format', () => {
  it('should show statistics only', async () => {
    const result = await getResult({
      text1: 'aaa\nbbb',
      text2: 'aaa\nccc',
      output_format: 'stats',
    });
    expect(result.outputFormat).toBe('stats');
    expect(result.diff).toContain('Additions');
    expect(result.diff).toContain('Deletions');
    expect(result.diff).toContain('Similarity');
  });
});

// -------------------------------------------------------------------
// options
// -------------------------------------------------------------------
describe('executeDiff - options', () => {
  it('should ignore case', async () => {
    const result = await getResult({
      text1: 'HELLO',
      text2: 'hello',
      ignore_case: true,
    });
    expect(result.hasChanges).toBe(false);
    expect(result.options.ignoreCase).toBe(true);
  });

  it('should ignore whitespace', async () => {
    const result = await getResult({
      text1: 'hello   world',
      text2: 'hello world',
      ignore_whitespace: true,
    });
    expect(result.hasChanges).toBe(false);
    expect(result.options.ignoreWhitespace).toBe(true);
  });

  it('should use custom labels', async () => {
    const result = await getResult({
      text1: 'a',
      text2: 'b',
      label1: 'v1',
      label2: 'v2',
    });
    expect(result.labels.original).toBe('v1');
    expect(result.labels.modified).toBe('v2');
  });
});

// -------------------------------------------------------------------
// Error handling
// -------------------------------------------------------------------
describe('executeDiff - errors', () => {
  it('should error without text1 and text2', async () => {
    const res = await executeDiff(makeCall({}));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('required');
  });

  it('should return toolCallId', async () => {
    const res = await executeDiff({
      id: 'my-id',
      name: 'diff_compare',
      arguments: { text1: 'a', text2: 'b' },
    });
    expect(res.toolCallId).toBe('my-id');
  });
});
