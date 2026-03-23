// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { executePDF, isPDFAvailable, pdfTool } from './pdf-tool';

function makeCall(args: Record<string, unknown>) {
  return { id: 'test', name: 'pdf_manipulate', arguments: args };
}

// For operations that still return JSON (get_info, extract_text, errors)
async function getJsonResult(args: Record<string, unknown>) {
  const res = await executePDF(makeCall(args));
  return JSON.parse(res.content);
}

// For operations that now return markdown (anything producing pdf_base64)
async function getRawResult(args: Record<string, unknown>) {
  const res = await executePDF(makeCall(args));
  return res.content;
}

// Extract base64 from the markdown download link
function extractBase64(markdownContent: string): string {
  const match = markdownContent.match(
    /\[Download [^\]]+\]\(data:application\/pdf;base64,([^)]+)\)/
  );
  if (!match) throw new Error('No base64 download link found in: ' + markdownContent.slice(0, 200));
  return match[1];
}

// Helper: create a simple 1-page PDF and return its base64
async function createSimplePdf(content = 'Hello World'): Promise<string> {
  const raw = await getRawResult({
    operation: 'create',
    content,
    title: 'Test PDF',
  });
  return extractBase64(raw);
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
    const content = await getRawResult({
      operation: 'create',
      content: 'Hello, World!',
      title: 'Test Doc',
    });
    expect(content).toContain('**Operation:** create');
    expect(content).toContain('**Pages:** 1');
    expect(content).toContain('**Size:**');
    expect(content).toMatch(/\[Download Test_Doc_\d+\.pdf\]/);
    // Verify base64 is extractable
    const base64 = extractBase64(content);
    expect(base64.length).toBeGreaterThan(0);
  });

  it('should handle multi-line content', async () => {
    const lines = Array.from({ length: 100 }, (_, i) => `Line ${i + 1}`).join('\n');
    const content = await getRawResult({
      operation: 'create',
      content: lines,
    });
    expect(content).toContain('**Operation:** create');
    expect(extractBase64(content).length).toBeGreaterThan(0);
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
    const result = await getJsonResult({
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
    const content = await getRawResult({
      operation: 'merge',
      pdf_data_list: [pdf1, pdf2],
    });
    expect(content).toContain('**Operation:** merge');
    expect(extractBase64(content).length).toBeGreaterThan(0);
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
    const mergedContent = await getRawResult({
      operation: 'merge',
      pdf_data_list: [pdf1, pdf2],
    });
    const mergedBase64 = extractBase64(mergedContent);

    const content = await getRawResult({
      operation: 'split',
      pdf_data: mergedBase64,
      pages: [1],
    });
    expect(content).toContain('**Operation:** split');
    expect(extractBase64(content).length).toBeGreaterThan(0);
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
    const content = await getRawResult({
      operation: 'watermark',
      pdf_data: pdfData,
      watermark_text: 'DRAFT',
    });
    expect(content).toContain('**Operation:** watermark');
    expect(extractBase64(content).length).toBeGreaterThan(0);
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
    const content = await getRawResult({
      operation: 'add_text',
      pdf_data: pdfData,
      text: 'Added annotation',
      x: 100,
      y: 100,
    });
    expect(content).toContain('**Operation:** add_text');
    expect(extractBase64(content).length).toBeGreaterThan(0);
  });

  it('should error without required fields', async () => {
    const res = await executePDF(makeCall({ operation: 'add_text' }));
    expect(res.isError).toBe(true);
  });
});

// -------------------------------------------------------------------
// add_image operation
// -------------------------------------------------------------------
describe('executePDF - add_image', () => {
  it('should error without pdf_data', async () => {
    const res = await executePDF(makeCall({ operation: 'add_image', image_data: 'abc' }));
    expect(res.isError).toBe(true);
  });

  it('should error without image source', async () => {
    const pdf = await createSimplePdf();
    const res = await executePDF(makeCall({ operation: 'add_image', pdf_data: pdf }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('image_url or image_data');
  });
});

// -------------------------------------------------------------------
// fill_form operation
// -------------------------------------------------------------------
describe('executePDF - fill_form', () => {
  it('should error without pdf_data', async () => {
    const res = await executePDF(
      makeCall({ operation: 'fill_form', form_fields: { name: 'test' } })
    );
    expect(res.isError).toBe(true);
  });

  it('should error without form_fields', async () => {
    const pdf = await createSimplePdf();
    const res = await executePDF(makeCall({ operation: 'fill_form', pdf_data: pdf }));
    expect(res.isError).toBe(true);
  });

  it('should handle PDF without form fields gracefully', async () => {
    const pdf = await createSimplePdf();
    const res = await executePDF(
      makeCall({ operation: 'fill_form', pdf_data: pdf, form_fields: { name: 'test' } })
    );
    // Should either fill successfully (returning markdown with download link)
    // or return a JSON error about no form fields
    if (res.isError) {
      const parsed = JSON.parse(res.content);
      expect(parsed.error).toContain('overlay_fields');
    } else {
      // Successful fill returns markdown with a download link
      expect(res.content).toContain('**Operation:** fill_form');
      expect(extractBase64(res.content).length).toBeGreaterThan(0);
    }
  });
});

// -------------------------------------------------------------------
// overlay_fields operation
// -------------------------------------------------------------------
describe('executePDF - overlay_fields', () => {
  it('should place multiple text fields on a PDF', async () => {
    const pdfData = await createSimplePdf();
    const content = await getRawResult({
      operation: 'overlay_fields',
      pdf_data: pdfData,
      fields: [
        { text: 'John Doe', x: 150, y: 700, font_size: 11 },
        { text: '03/06/2026', x: 400, y: 700, font_size: 10 },
        { text: '123 Main St', x: 150, y: 650 },
      ],
    });
    expect(content).toContain('**Operation:** overlay_fields');
    expect(extractBase64(content).length).toBeGreaterThan(0);
  });

  it('should skip fields with missing required properties', async () => {
    const pdfData = await createSimplePdf();
    // overlay_fields with partial valid fields still produces pdf_base64 -> markdown
    const content = await getRawResult({
      operation: 'overlay_fields',
      pdf_data: pdfData,
      fields: [
        { text: 'Valid', x: 100, y: 100 },
        { text: 'Missing Y', x: 100 }, // no y
        { x: 100, y: 100 }, // no text
      ],
    });
    // The markdown won't contain fields_placed directly, but we can verify it succeeded
    expect(content).toContain('**Operation:** overlay_fields');
    expect(extractBase64(content).length).toBeGreaterThan(0);
  });

  it('should error without pdf_data', async () => {
    const res = await executePDF(
      makeCall({ operation: 'overlay_fields', fields: [{ text: 'a', x: 1, y: 1 }] })
    );
    expect(res.isError).toBe(true);
  });

  it('should error without fields', async () => {
    const pdf = await createSimplePdf();
    const res = await executePDF(makeCall({ operation: 'overlay_fields', pdf_data: pdf }));
    expect(res.isError).toBe(true);
  });
});

// -------------------------------------------------------------------
// draw_shapes operation
// -------------------------------------------------------------------
describe('executePDF - draw_shapes', () => {
  it('should draw lines, rectangles, circles, and checkboxes', async () => {
    const pdfData = await createSimplePdf();
    const content = await getRawResult({
      operation: 'draw_shapes',
      pdf_data: pdfData,
      shapes: [
        { type: 'line', x1: 72, y1: 700, x2: 300, y2: 700 },
        { type: 'rectangle', x: 72, y: 600, width: 100, height: 30 },
        { type: 'circle', cx: 400, cy: 600, radius: 20 },
        { type: 'checkbox', x: 72, y: 550, checked: true },
        { type: 'checkbox', x: 72, y: 520, checked: false },
      ],
    });
    expect(content).toContain('**Operation:** draw_shapes');
    expect(extractBase64(content).length).toBeGreaterThan(0);
  });

  it('should skip invalid shapes', async () => {
    const pdfData = await createSimplePdf();
    const content = await getRawResult({
      operation: 'draw_shapes',
      pdf_data: pdfData,
      shapes: [
        { type: 'line', x1: 0, y1: 0 }, // missing x2,y2
        { type: 'rectangle', x: 10, y: 10 }, // missing width/height
        { type: 'checkbox', x: 72, y: 500, checked: true }, // valid
      ],
    });
    // Still produces a PDF with at least the valid shape
    expect(content).toContain('**Operation:** draw_shapes');
    expect(extractBase64(content).length).toBeGreaterThan(0);
  });

  it('should error without pdf_data', async () => {
    const res = await executePDF(
      makeCall({
        operation: 'draw_shapes',
        shapes: [{ type: 'line', x1: 0, y1: 0, x2: 100, y2: 100 }],
      })
    );
    expect(res.isError).toBe(true);
  });

  it('should error without shapes', async () => {
    const pdf = await createSimplePdf();
    const res = await executePDF(makeCall({ operation: 'draw_shapes', pdf_data: pdf }));
    expect(res.isError).toBe(true);
  });
});

// -------------------------------------------------------------------
// rotate_pages operation
// -------------------------------------------------------------------
describe('executePDF - rotate_pages', () => {
  it('should rotate all pages by 90 degrees', async () => {
    const pdfData = await createSimplePdf();
    const content = await getRawResult({
      operation: 'rotate_pages',
      pdf_data: pdfData,
      rotation: 90,
    });
    expect(content).toContain('**Operation:** rotate_pages');
    expect(extractBase64(content).length).toBeGreaterThan(0);
  });

  it('should error with invalid rotation', async () => {
    const pdf = await createSimplePdf();
    const res = await executePDF(
      makeCall({ operation: 'rotate_pages', pdf_data: pdf, rotation: 45 })
    );
    expect(res.isError).toBe(true);
  });

  it('should error without pdf_data', async () => {
    const res = await executePDF(makeCall({ operation: 'rotate_pages', rotation: 90 }));
    expect(res.isError).toBe(true);
  });
});

// -------------------------------------------------------------------
// encrypt operation
// -------------------------------------------------------------------
describe('executePDF - encrypt', () => {
  it('should add encryption metadata', async () => {
    const pdfData = await createSimplePdf();
    const content = await getRawResult({
      operation: 'encrypt',
      pdf_data: pdfData,
      user_password: 'secret123',
      owner_password: 'admin456',
      permissions: { printing: true, copying: false },
    });
    expect(content).toContain('PDF encrypt completed successfully');
    expect(content).toContain('[Download ');
    const base64 = extractBase64(content);
    expect(base64.length).toBeGreaterThan(100);
  });

  it('should error without user_password', async () => {
    const pdf = await createSimplePdf();
    const res = await executePDF(makeCall({ operation: 'encrypt', pdf_data: pdf }));
    expect(res.isError).toBe(true);
  });
});

// -------------------------------------------------------------------
// get_info with page_sizes
// -------------------------------------------------------------------
describe('executePDF - get_info enhanced', () => {
  it('should return page sizes and form field hints', async () => {
    const pdfData = await createSimplePdf();
    const result = await getJsonResult({
      operation: 'get_info',
      pdf_data: pdfData,
    });
    expect(result.page_sizes).toBeDefined();
    expect(result.page_sizes[0].width).toBe(612);
    expect(result.page_sizes[0].height).toBe(792);
    expect(result.has_form).toBe(false);
    expect(result.hint).toContain('overlay_fields');
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
