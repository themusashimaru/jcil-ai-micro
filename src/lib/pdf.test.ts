// @ts-nocheck - Test file with extensive mocking
/**
 * @vitest-environment node
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import {
  markdownToHtml,
  generateHtmlDocument,
  markdownToPdf,
  htmlToPdf,
  isValidPdf,
  estimatePdfPages,
} from './pdf';

// ---------------------------------------------------------------------------
// markdownToHtml
// ---------------------------------------------------------------------------

describe('markdownToHtml', () => {
  it('should convert h1 headers', () => {
    expect(markdownToHtml('# Hello')).toContain('<h1>Hello</h1>');
  });

  it('should convert h2 headers', () => {
    expect(markdownToHtml('## Section')).toContain('<h2>Section</h2>');
  });

  it('should convert h3 headers', () => {
    expect(markdownToHtml('### Subsection')).toContain('<h3>Subsection</h3>');
  });

  it('should convert bold text', () => {
    expect(markdownToHtml('This is **bold** text')).toContain('<strong>bold</strong>');
  });

  it('should convert italic text', () => {
    expect(markdownToHtml('This is *italic* text')).toContain('<em>italic</em>');
  });

  it('should convert inline code', () => {
    expect(markdownToHtml('Use `npm install`')).toContain('<code>npm install</code>');
  });

  it('should convert code blocks', () => {
    const result = markdownToHtml('```typescript\nconst x = 1;\n```');
    expect(result).toContain('<pre><code class="language-typescript">');
    expect(result).toContain('const x = 1;');
  });

  it('should convert links', () => {
    const result = markdownToHtml('[Click here](https://example.com)');
    expect(result).toContain('<a href="https://example.com">Click here</a>');
  });

  it('should convert unordered list items', () => {
    const result = markdownToHtml('- Item 1\n- Item 2');
    expect(result).toContain('<li>Item 1</li>');
    expect(result).toContain('<li>Item 2</li>');
  });

  it('should wrap list items in ul', () => {
    const result = markdownToHtml('- Item 1\n- Item 2');
    expect(result).toContain('<ul>');
  });

  it('should convert double newlines to paragraphs', () => {
    const result = markdownToHtml('Para 1\n\nPara 2');
    expect(result).toContain('</p><p>');
  });

  it('should convert single newlines to br', () => {
    const result = markdownToHtml('Line 1\nLine 2');
    expect(result).toContain('<br>');
  });

  it('should handle empty string', () => {
    const result = markdownToHtml('');
    expect(result).toContain('<p>');
  });

  it('should handle multiple formatting in one line', () => {
    const result = markdownToHtml('**bold** and *italic* and `code`');
    expect(result).toContain('<strong>bold</strong>');
    expect(result).toContain('<em>italic</em>');
    expect(result).toContain('<code>code</code>');
  });

  it('should handle complex markdown', () => {
    const md = `# Title

## Section 1

This is **important** text with a [link](http://example.com).

- Item 1
- Item 2

### Code Example

\`\`\`js
console.log("hello");
\`\`\``;

    const result = markdownToHtml(md);
    expect(result).toContain('<h1>Title</h1>');
    expect(result).toContain('<h2>Section 1</h2>');
    expect(result).toContain('<strong>important</strong>');
    expect(result).toContain('<a href="http://example.com">link</a>');
    expect(result).toContain('<li>Item 1</li>');
  });
});

// ---------------------------------------------------------------------------
// generateHtmlDocument
// ---------------------------------------------------------------------------

describe('generateHtmlDocument', () => {
  it('should return valid HTML document', () => {
    const result = generateHtmlDocument('<p>Hello</p>');
    expect(result).toContain('<!DOCTYPE html>');
    expect(result).toContain('<html');
    expect(result).toContain('</html>');
  });

  it('should include content in body', () => {
    const result = generateHtmlDocument('<p>My content</p>');
    expect(result).toContain('<p>My content</p>');
  });

  it('should use custom title', () => {
    const result = generateHtmlDocument('<p>Hi</p>', 'My Report');
    expect(result).toContain('<title>My Report</title>');
  });

  it('should default title to "Document"', () => {
    const result = generateHtmlDocument('<p>Hi</p>');
    expect(result).toContain('<title>Document</title>');
  });

  it('should include CSS styles', () => {
    const result = generateHtmlDocument('<p>Hi</p>');
    expect(result).toContain('<style>');
    expect(result).toContain('font-family');
  });

  it('should include meta charset', () => {
    const result = generateHtmlDocument('<p>Hi</p>');
    expect(result).toContain('charset="UTF-8"');
  });

  it('should include viewport meta', () => {
    const result = generateHtmlDocument('<p>Hi</p>');
    expect(result).toContain('viewport');
  });

  it('should handle empty content', () => {
    const result = generateHtmlDocument('');
    expect(result).toContain('<body>');
    expect(result).toContain('</body>');
  });
});

// ---------------------------------------------------------------------------
// markdownToPdf
// ---------------------------------------------------------------------------

describe('markdownToPdf', () => {
  it('should throw when puppeteer is not available', async () => {
    await expect(markdownToPdf('# Test')).rejects.toThrow('Puppeteer');
  });

  it('should throw with install instructions', async () => {
    await expect(markdownToPdf('# Test')).rejects.toThrow('npm install puppeteer');
  });
});

// ---------------------------------------------------------------------------
// htmlToPdf
// ---------------------------------------------------------------------------

describe('htmlToPdf', () => {
  it('should throw when puppeteer is not available', async () => {
    await expect(htmlToPdf('<p>Test</p>')).rejects.toThrow('Puppeteer');
  });
});

// ---------------------------------------------------------------------------
// isValidPdf
// ---------------------------------------------------------------------------

describe('isValidPdf', () => {
  it('should return true for valid PDF buffer', () => {
    const buf = Buffer.from('%PDF-1.4 content here');
    expect(isValidPdf(buf)).toBe(true);
  });

  it('should return false for non-PDF buffer', () => {
    const buf = Buffer.from('<html>Not a PDF</html>');
    expect(isValidPdf(buf)).toBe(false);
  });

  it('should return false for empty buffer', () => {
    const buf = Buffer.from('');
    expect(isValidPdf(buf)).toBe(false);
  });

  it('should return true when buffer starts with %PDF exactly', () => {
    const buf = Buffer.from('%PDF');
    expect(isValidPdf(buf)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// estimatePdfPages
// ---------------------------------------------------------------------------

describe('estimatePdfPages', () => {
  it('should return 1 for small buffer', () => {
    const buf = Buffer.alloc(1000);
    expect(estimatePdfPages(buf)).toBe(1);
  });

  it('should return 1 for empty buffer', () => {
    const buf = Buffer.alloc(0);
    expect(estimatePdfPages(buf)).toBe(1);
  });

  it('should return 1 for ~100KB', () => {
    const buf = Buffer.alloc(100_000);
    expect(estimatePdfPages(buf)).toBe(1);
  });

  it('should return 2 for ~150KB', () => {
    const buf = Buffer.alloc(150_000);
    expect(estimatePdfPages(buf)).toBe(2);
  });

  it('should return 10 for ~1MB', () => {
    const buf = Buffer.alloc(1_000_000);
    expect(estimatePdfPages(buf)).toBe(10);
  });

  it('should scale linearly with file size', () => {
    const small = estimatePdfPages(Buffer.alloc(200_000));
    const big = estimatePdfPages(Buffer.alloc(400_000));
    expect(big).toBe(small * 2);
  });
});
