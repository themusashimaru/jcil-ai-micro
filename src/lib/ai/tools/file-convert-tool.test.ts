import { describe, it, expect } from 'vitest';
import { executeFileConvert, isFileConvertAvailable, fileConvertTool } from './file-convert-tool';

function makeCall(args: Record<string, unknown>) {
  return { id: 'test', name: 'convert_file', arguments: args };
}

async function getResult(args: Record<string, unknown>) {
  const res = await executeFileConvert(makeCall(args));
  return JSON.parse(res.content);
}

// -------------------------------------------------------------------
// Metadata
// -------------------------------------------------------------------
describe('fileConvertTool metadata', () => {
  it('should have correct name', () => {
    expect(fileConvertTool.name).toBe('convert_file');
  });

  it('should require from_format and to_format', () => {
    expect(fileConvertTool.parameters.required).toContain('from_format');
    expect(fileConvertTool.parameters.required).toContain('to_format');
  });
});

describe('isFileConvertAvailable', () => {
  it('should return true', () => {
    expect(isFileConvertAvailable()).toBe(true);
  });
});

// -------------------------------------------------------------------
// HTML → Text
// -------------------------------------------------------------------
describe('executeFileConvert - html→txt', () => {
  it('should strip HTML tags', async () => {
    const result = await getResult({
      from_format: 'html',
      to_format: 'txt',
      content: '<p>Hello <strong>world</strong></p>',
    });
    expect(result.success).toBe(true);
    expect(result.fullContent).toContain('Hello');
    expect(result.fullContent).toContain('world');
    expect(result.fullContent).not.toContain('<strong>');
  });

  it('should convert br tags to newlines', async () => {
    const result = await getResult({
      from_format: 'html',
      to_format: 'txt',
      content: 'Line 1<br>Line 2',
    });
    expect(result.fullContent).toContain('Line 1\nLine 2');
  });

  it('should strip script and style tags', async () => {
    const result = await getResult({
      from_format: 'html',
      to_format: 'txt',
      content: '<p>Visible</p><script>alert("x")</script><style>.hidden{}</style>',
    });
    expect(result.fullContent).toContain('Visible');
    expect(result.fullContent).not.toContain('alert');
    expect(result.fullContent).not.toContain('.hidden');
  });

  it('should decode HTML entities', async () => {
    const result = await getResult({
      from_format: 'html',
      to_format: 'txt',
      content: '<p>&amp; &lt; &gt; &quot; &#39;</p>',
    });
    expect(result.fullContent).toContain('&');
    expect(result.fullContent).toContain('<');
    expect(result.fullContent).toContain('>');
  });
});

// -------------------------------------------------------------------
// HTML → Markdown
// -------------------------------------------------------------------
describe('executeFileConvert - html→markdown', () => {
  it('should convert headings', async () => {
    const result = await getResult({
      from_format: 'html',
      to_format: 'markdown',
      content: '<h1>Title</h1><h2>Subtitle</h2>',
    });
    expect(result.fullContent).toContain('# Title');
    expect(result.fullContent).toContain('## Subtitle');
  });

  it('should convert bold and italic', async () => {
    const result = await getResult({
      from_format: 'html',
      to_format: 'markdown',
      content: '<strong>bold</strong> and <em>italic</em>',
    });
    expect(result.fullContent).toContain('**bold**');
    expect(result.fullContent).toContain('*italic*');
  });

  it('should convert links', async () => {
    const result = await getResult({
      from_format: 'html',
      to_format: 'markdown',
      content: '<a href="https://example.com">Link</a>',
    });
    expect(result.fullContent).toContain('[Link](https://example.com)');
  });

  it('should convert code elements', async () => {
    const result = await getResult({
      from_format: 'html',
      to_format: 'markdown',
      content: '<code>inline</code>',
    });
    expect(result.fullContent).toContain('`inline`');
  });

  it('should convert horizontal rules', async () => {
    const result = await getResult({
      from_format: 'html',
      to_format: 'markdown',
      content: '<p>Above</p><hr><p>Below</p>',
    });
    expect(result.fullContent).toContain('---');
  });
});

// -------------------------------------------------------------------
// JSON → CSV
// -------------------------------------------------------------------
describe('executeFileConvert - json→csv', () => {
  it('should convert array of objects to CSV', async () => {
    const data = JSON.stringify([
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 25 },
    ]);
    const result = await getResult({
      from_format: 'json',
      to_format: 'csv',
      content: data,
    });
    expect(result.fullContent).toContain('name,age');
    expect(result.fullContent).toContain('Alice,30');
    expect(result.fullContent).toContain('Bob,25');
  });

  it('should escape CSV values with commas', async () => {
    const data = JSON.stringify([{ name: 'Smith, John', city: 'NYC' }]);
    const result = await getResult({
      from_format: 'json',
      to_format: 'csv',
      content: data,
    });
    expect(result.fullContent).toContain('"Smith, John"');
  });

  it('should handle empty array', async () => {
    const result = await getResult({
      from_format: 'json',
      to_format: 'csv',
      content: '[]',
    });
    expect(result.fullContent).toBe('');
  });
});

// -------------------------------------------------------------------
// CSV → JSON
// -------------------------------------------------------------------
describe('executeFileConvert - csv→json', () => {
  it('should convert CSV to JSON', async () => {
    const csv = 'name,age\nAlice,30\nBob,25';
    const result = await getResult({
      from_format: 'csv',
      to_format: 'json',
      content: csv,
    });
    const parsed = JSON.parse(result.fullContent);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].name).toBe('Alice');
    expect(parsed[0].age).toBe('30');
  });

  it('should handle quoted CSV fields', async () => {
    const csv = 'name,city\n"Smith, John","New York"';
    const result = await getResult({
      from_format: 'csv',
      to_format: 'json',
      content: csv,
    });
    const parsed = JSON.parse(result.fullContent);
    expect(parsed[0].name).toBe('Smith, John');
  });
});

// -------------------------------------------------------------------
// Error handling
// -------------------------------------------------------------------
describe('executeFileConvert - errors', () => {
  it('should error without content', async () => {
    const res = await executeFileConvert(makeCall({ from_format: 'html', to_format: 'txt' }));
    expect(res.isError).toBe(true);
  });

  it('should error for unsupported conversion', async () => {
    const res = await executeFileConvert(
      makeCall({ from_format: 'txt', to_format: 'html', content: 'hello' })
    );
    expect(res.isError).toBe(true);
    expect(res.content).toContain('not supported');
  });

  it('should error without formats', async () => {
    const res = await executeFileConvert(makeCall({ content: 'hello' }));
    expect(res.isError).toBe(true);
  });

  it('should return toolCallId', async () => {
    const res = await executeFileConvert({
      id: 'my-id',
      name: 'convert_file',
      arguments: { from_format: 'html', to_format: 'txt', content: '<p>Test</p>' },
    });
    expect(res.toolCallId).toBe('my-id');
  });
});
