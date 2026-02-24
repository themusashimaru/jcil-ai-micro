import { describe, it, expect } from 'vitest';
import { executePrettier, isPrettierAvailable, prettierTool } from './prettier-tool';

function makeCall(args: Record<string, unknown>) {
  return { id: 'test', name: 'format_code', arguments: args };
}

async function getResult(args: Record<string, unknown>) {
  const res = await executePrettier(makeCall(args));
  return JSON.parse(res.content);
}

// -------------------------------------------------------------------
// Metadata
// -------------------------------------------------------------------
describe('prettierTool metadata', () => {
  it('should have correct name', () => {
    expect(prettierTool.name).toBe('format_code');
  });

  it('should require code and language', () => {
    expect(prettierTool.parameters.required).toContain('code');
    expect(prettierTool.parameters.required).toContain('language');
  });
});

describe('isPrettierAvailable', () => {
  it('should return true', () => {
    expect(isPrettierAvailable()).toBe(true);
  });
});

// -------------------------------------------------------------------
// JavaScript formatting
// -------------------------------------------------------------------
describe('executePrettier - javascript', () => {
  it('should format JavaScript', async () => {
    const result = await getResult({
      code: 'const x=1;const y=2;console.log(x+y)',
      language: 'javascript',
    });
    expect(result.language).toBe('javascript');
    expect(result.formatted_code).toContain('const x');
    expect(result.formatted_length).toBeGreaterThan(0);
  });

  it('should add semicolons by default', async () => {
    const result = await getResult({
      code: 'const x = 1',
      language: 'javascript',
    });
    expect(result.formatted_code).toContain(';');
  });

  it('should remove semicolons when requested', async () => {
    const result = await getResult({
      code: 'const x = 1;',
      language: 'javascript',
      semicolons: false,
    });
    expect(result.formatted_code.trim()).not.toMatch(/;$/);
  });
});

// -------------------------------------------------------------------
// TypeScript formatting
// -------------------------------------------------------------------
describe('executePrettier - typescript', () => {
  it('should format TypeScript', async () => {
    const result = await getResult({
      code: 'interface Foo{bar:string;baz:number}',
      language: 'typescript',
    });
    expect(result.language).toBe('typescript');
    expect(result.formatted_code).toContain('interface Foo');
  });
});

// -------------------------------------------------------------------
// JSON formatting
// -------------------------------------------------------------------
describe('executePrettier - json', () => {
  it('should format JSON', async () => {
    const result = await getResult({
      code: '{"a":1,"b":[1,2,3]}',
      language: 'json',
    });
    expect(result.formatted_code).toContain('"a": 1');
  });
});

// -------------------------------------------------------------------
// CSS formatting
// -------------------------------------------------------------------
describe('executePrettier - css', () => {
  it('should format CSS', async () => {
    const result = await getResult({
      code: '.foo{color:red;font-size:12px}',
      language: 'css',
    });
    expect(result.formatted_code).toContain('color: red');
  });
});

// -------------------------------------------------------------------
// HTML formatting
// -------------------------------------------------------------------
describe('executePrettier - html', () => {
  it('should format HTML', async () => {
    const result = await getResult({
      code: '<div><p>hello</p></div>',
      language: 'html',
    });
    expect(result.formatted_code).toContain('<div>');
    expect(result.formatted_code).toContain('<p>');
  });
});

// -------------------------------------------------------------------
// Markdown formatting
// -------------------------------------------------------------------
describe('executePrettier - markdown', () => {
  it('should format Markdown', async () => {
    const result = await getResult({
      code: '# Title\n\n\n\nSome text',
      language: 'markdown',
    });
    expect(result.formatted_code).toContain('# Title');
  });
});

// -------------------------------------------------------------------
// Options
// -------------------------------------------------------------------
describe('executePrettier - options', () => {
  it('should respect tab_width', async () => {
    const result = await getResult({
      code: 'function f() {\nreturn 1;\n}',
      language: 'javascript',
      tab_width: 4,
    });
    expect(result.formatted_code).toContain('    return');
  });

  it('should respect single_quote', async () => {
    const result = await getResult({
      code: 'const x = "hello"',
      language: 'javascript',
      single_quote: true,
    });
    expect(result.formatted_code).toContain("'hello'");
  });

  it('should respect print_width', async () => {
    const result = await getResult({
      code: 'const x = { a: 1, b: 2, c: 3, d: 4, e: 5 }',
      language: 'javascript',
      print_width: 30,
    });
    // Should wrap to multiple lines
    expect(result.formatted_code.split('\n').length).toBeGreaterThan(1);
  });
});

// -------------------------------------------------------------------
// Error handling
// -------------------------------------------------------------------
describe('executePrettier - errors', () => {
  it('should error without code', async () => {
    const res = await executePrettier(makeCall({ language: 'javascript' }));
    expect(res.isError).toBe(true);
  });

  it('should error without language', async () => {
    const res = await executePrettier(makeCall({ code: 'const x = 1' }));
    expect(res.isError).toBe(true);
  });

  it('should error for unsupported language', async () => {
    const res = await executePrettier(makeCall({ code: 'test', language: 'brainfuck' }));
    expect(res.isError).toBe(true);
  });

  it('should error on malformed code', async () => {
    const res = await executePrettier(makeCall({ code: 'function {{{', language: 'javascript' }));
    expect(res.isError).toBe(true);
  });

  it('should return toolCallId', async () => {
    const res = await executePrettier({
      id: 'my-id',
      name: 'format_code',
      arguments: { code: 'const x = 1', language: 'javascript' },
    });
    expect(res.toolCallId).toBe('my-id');
  });
});
