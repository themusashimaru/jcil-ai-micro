// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { executePDF, isPDFAvailable, pdfTool } from './pdf-tool';

function makeCall(args: Record<string, unknown>) {
  return { id: 'test', name: 'pdf_manipulate', arguments: args };
}

async function getResult(args: Record<string, unknown>) {
  const res = await executePDF(makeCall(args));
  return JSON.parse(res.content);
}

// Helper: create a simple 1-page PDF and return its base64
async function createSimplePdf(content = 'Hello World'): Promise<string> {
  const result = await getResult({
    operation: 'create',
    content,
    title: 'Test PDF',
  });
  return result.pdf_base64;
}

// -------------------------------------------------------------------
// Metadata
// -------------------------------------------------------------------
describe('pdfTool metadata', () => {
  it('should have correct name', () => {
    expect(pdfTool.name).toBe('pdf_manipulate');
  });

  it('should require operation', () => {
    expect(pdfTool.parameters.required).toContain('operation');
  });
});

describe('isPDFAvailable', () => {
  it('should return true', () => {
    expect(isPDFAvailable()).toBe(true);
  });
});

// -------------------------------------------------------------------
// create operation
// -------------------------------------------------------------------
describe('executePDF - create', () => {
  it('should create a PDF from text', async () => {
    const result = await getResult({
      operation: 'create',
      content: 'Hello, World!',
      title: 'Test Doc',
    });
    expect(result.operation).toBe('create');
    expect(result.title).toBe('Test Doc');
    expect(result.pages).toBe(1);
    expect(result.pdf_base64).toBeDefined();
    expect(result.size_bytes).toBeGreaterThan(0);
  });

  it('should handle multi-line content', async () => {
    const lines = Array.from({ length: 100 }, (_, i) => `Line ${i + 1}`).join('\n');
    const result = await getResult({
      operation: 'create',
      content: lines,
    });
    expect(result.pages).toBeGreaterThanOrEqual(1);
    expect(result.pdf_base64).toBeDefined();
  });

  it('should error without content', async () => {
    const res = await executePDF(makeCall({ operation: 'create' }));
    expect(res.isError).toBe(true);
  });
});

// -------------------------------------------------------------------
// get_info operation
// -------------------------------------------------------------------
describe('executePDF - get_info', () => {
  it('should return PDF metadata', async () => {
    const pdfData = await createSimplePdf();
    const result = await getResult({
      operation: 'get_info',
      pdf_data: pdfData,
    });
    expect(result.operation).toBe('get_info');
    expect(result.page_count).toBe(1);
    expect(result.title).toBe('Test PDF');
  });

  it('should error without pdf_data', async () => {
    const res = await executePDF(makeCall({ operation: 'get_info' }));
    expect(res.isError).toBe(true);
  });
});

// -------------------------------------------------------------------
// merge operation
// -------------------------------------------------------------------
describe('executePDF - merge', () => {
  it('should merge two PDFs', async () => {
    const pdf1 = await createSimplePdf('Page from PDF 1');
    const pdf2 = await createSimplePdf('Page from PDF 2');
    const result = await getResult({
      operation: 'merge',
      pdf_data_list: [pdf1, pdf2],
    });
    expect(result.operation).toBe('merge');
    expect(result.input_count).toBe(2);
    expect(result.total_pages).toBe(2);
    expect(result.pdf_base64).toBeDefined();
  });

  it('should error with fewer than 2 PDFs', async () => {
    const pdf1 = await createSimplePdf();
    const res = await executePDF(makeCall({ operation: 'merge', pdf_data_list: [pdf1] }));
    expect(res.isError).toBe(true);
  });

  it('should error without pdf_data_list', async () => {
    const res = await executePDF(makeCall({ operation: 'merge' }));
    expect(res.isError).toBe(true);
  });
});

// -------------------------------------------------------------------
// split operation
// -------------------------------------------------------------------
describe('executePDF - split', () => {
  it('should extract specific page', async () => {
    // Create a 2-page PDF by merging two
    const pdf1 = await createSimplePdf('Page 1');
    const pdf2 = await createSimplePdf('Page 2');
    const mergedResult = await getResult({
      operation: 'merge',
      pdf_data_list: [pdf1, pdf2],
    });

    const result = await getResult({
      operation: 'split',
      pdf_data: mergedResult.pdf_base64,
      pages: [1],
    });
    expect(result.operation).toBe('split');
    expect(result.extracted_pages).toEqual([1]);
    expect(result.pdf_base64).toBeDefined();
  });

  it('should error without pdf_data', async () => {
    const res = await executePDF(makeCall({ operation: 'split', pages: [1] }));
    expect(res.isError).toBe(true);
  });

  it('should error without pages', async () => {
    const pdf = await createSimplePdf();
    const res = await executePDF(makeCall({ operation: 'split', pdf_data: pdf }));
    expect(res.isError).toBe(true);
  });
});

// -------------------------------------------------------------------
// watermark operation
// -------------------------------------------------------------------
describe('executePDF - watermark', () => {
  it('should add watermark to PDF', async () => {
    const pdfData = await createSimplePdf();
    const result = await getResult({
      operation: 'watermark',
      pdf_data: pdfData,
      watermark_text: 'DRAFT',
    });
    expect(result.operation).toBe('watermark');
    expect(result.watermark).toBe('DRAFT');
    expect(result.pages_watermarked).toBe(1);
    expect(result.pdf_base64).toBeDefined();
  });

  it('should error without required fields', async () => {
    const res = await executePDF(makeCall({ operation: 'watermark' }));
    expect(res.isError).toBe(true);
  });
});

// -------------------------------------------------------------------
// add_text operation
// -------------------------------------------------------------------
describe('executePDF - add_text', () => {
  it('should add text to existing PDF', async () => {
    const pdfData = await createSimplePdf();
    const result = await getResult({
      operation: 'add_text',
      pdf_data: pdfData,
      text: 'Added annotation',
      x: 100,
      y: 100,
    });
    expect(result.operation).toBe('add_text');
    expect(result.text_added).toBe('Added annotation');
    expect(result.page).toBe(1);
    expect(result.pdf_base64).toBeDefined();
  });

  it('should error without required fields', async () => {
    const res = await executePDF(makeCall({ operation: 'add_text' }));
    expect(res.isError).toBe(true);
  });
});

// -------------------------------------------------------------------
// Error handling
// -------------------------------------------------------------------
describe('executePDF - errors', () => {
  it('should error for unknown operation', async () => {
    const res = await executePDF(makeCall({ operation: 'xyz' }));
    expect(res.isError).toBe(true);
  });

  it('should error without operation', async () => {
    const res = await executePDF(makeCall({}));
    expect(res.isError).toBe(true);
  });

  it('should return toolCallId', async () => {
    const res = await executePDF({
      id: 'my-id',
      name: 'pdf_manipulate',
      arguments: { operation: 'create', content: 'test' },
    });
    expect(res.toolCallId).toBe('my-id');
  });
});
