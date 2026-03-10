import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeExtractPdf, extractPdfTool } from './extract-pdf';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock safety module
vi.mock('./safety', () => ({
  isUrlSafe: vi.fn().mockReturnValue({ safe: true }),
  canExecuteTool: vi.fn().mockReturnValue({ allowed: true }),
  recordToolCost: vi.fn(),
}));

// Mock unpdf
const mockExtractText = vi.fn();
const mockGetDocumentProxy = vi.fn();
vi.mock('unpdf', () => ({
  extractText: (...args: unknown[]) => mockExtractText(...args),
  getDocumentProxy: (...args: unknown[]) => mockGetDocumentProxy(...args),
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function makeCall(args: Record<string, unknown>) {
  return { id: 'pdf-1', name: 'extract_pdf', arguments: args, sessionId: 'test-session' };
}

beforeEach(() => {
  mockFetch.mockReset();
  mockExtractText.mockReset();
  mockGetDocumentProxy.mockReset();
});

// -------------------------------------------------------------------
// Metadata
// -------------------------------------------------------------------
describe('extractPdfTool metadata', () => {
  it('should have correct name', () => {
    expect(extractPdfTool.name).toBe('extract_pdf');
  });

  it('should require url', () => {
    expect(extractPdfTool.parameters.required).toContain('url');
  });
});

// -------------------------------------------------------------------
// Validation
// -------------------------------------------------------------------
describe('executeExtractPdf - validation', () => {
  it('should error for wrong tool name', async () => {
    const res = await executeExtractPdf({
      id: 'x',
      name: 'wrong_tool',
      arguments: { url: 'https://example.com/doc.pdf' },
    });
    expect(res.isError).toBe(true);
    expect(res.content).toContain('Unknown tool');
  });

  it('should error when no URL provided', async () => {
    const res = await executeExtractPdf(makeCall({}));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('No URL');
  });

  it('should return toolCallId', async () => {
    const res = await executeExtractPdf(makeCall({}));
    expect(res.toolCallId).toBe('pdf-1');
  });
});

// -------------------------------------------------------------------
// URL safety
// -------------------------------------------------------------------
describe('executeExtractPdf - URL safety', () => {
  it('should block unsafe URLs', async () => {
    const { isUrlSafe } = await import('./safety');
    (isUrlSafe as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      safe: false,
      reason: 'Private IP',
    });
    const res = await executeExtractPdf(makeCall({ url: 'http://10.0.0.1/secret.pdf' }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('Cannot access URL');
  });

  it('should normalize URLs without protocol', async () => {
    // Will fail at fetch, but URL should be normalized
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      headers: new Map([['content-type', 'text/html']]),
    });
    await executeExtractPdf(makeCall({ url: 'example.com/doc.pdf' }));
    // Should have added https://
    expect(mockFetch).toHaveBeenCalledWith('https://example.com/doc.pdf', expect.any(Object));
  });
});

// -------------------------------------------------------------------
// Cost control
// -------------------------------------------------------------------
describe('executeExtractPdf - cost control', () => {
  it('should reject when cost budget exceeded', async () => {
    const { canExecuteTool } = await import('./safety');
    (canExecuteTool as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      allowed: false,
      reason: 'Budget exceeded',
    });
    const res = await executeExtractPdf(makeCall({ url: 'https://example.com/doc.pdf' }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('Budget exceeded');
  });
});

// -------------------------------------------------------------------
// Fetch errors
// -------------------------------------------------------------------
describe('executeExtractPdf - fetch errors', () => {
  it('should handle HTTP error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      headers: new Map([['content-type', 'text/html']]),
    });
    const res = await executeExtractPdf(makeCall({ url: 'https://example.com/missing.pdf' }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('Failed to download PDF');
    expect(res.content).toContain('404');
  });

  it('should handle non-PDF content type', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'text/html']]),
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
    });
    const res = await executeExtractPdf(makeCall({ url: 'https://example.com/page.html' }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('Not a PDF');
  });

  it('should handle network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network failed'));
    const res = await executeExtractPdf(makeCall({ url: 'https://example.com/doc.pdf' }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('Network failed');
  });

  it('should handle timeout/abort', async () => {
    mockFetch.mockRejectedValueOnce(new Error('The operation was aborted'));
    const res = await executeExtractPdf(makeCall({ url: 'https://example.com/doc.pdf' }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('timed out');
  });
});

// -------------------------------------------------------------------
// Successful extraction
// -------------------------------------------------------------------
describe('executeExtractPdf - success', () => {
  function mockFetchPdf(size = 1000) {
    const buffer = new ArrayBuffer(size);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'application/pdf']]),
      arrayBuffer: () => Promise.resolve(buffer),
    });
  }

  it('should extract text from PDF', async () => {
    mockFetchPdf();
    mockGetDocumentProxy.mockResolvedValueOnce({ numPages: 3 });
    mockExtractText.mockResolvedValueOnce({ text: 'Extracted PDF content here' });

    const res = await executeExtractPdf(makeCall({ url: 'https://example.com/doc.pdf' }));
    expect(res.isError).toBe(false);
    expect(res.content).toContain('PDF Extracted');
    expect(res.content).toContain('3 pages');
    expect(res.content).toContain('Extracted PDF content here');
    expect(res.content).toContain('Source: https://example.com/doc.pdf');
  });

  it('should handle PDF URLs ending in .pdf without content-type', async () => {
    const buffer = new ArrayBuffer(500);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'application/octet-stream']]),
      arrayBuffer: () => Promise.resolve(buffer),
    });
    mockGetDocumentProxy.mockResolvedValueOnce({ numPages: 1 });
    mockExtractText.mockResolvedValueOnce({ text: 'content' });

    const res = await executeExtractPdf(makeCall({ url: 'https://example.com/report.pdf' }));
    expect(res.isError).toBe(false);
  });

  it('should handle empty text extraction', async () => {
    mockFetchPdf();
    mockGetDocumentProxy.mockResolvedValueOnce({ numPages: 1 });
    mockExtractText.mockResolvedValueOnce({ text: '' });

    const res = await executeExtractPdf(makeCall({ url: 'https://example.com/blank.pdf' }));
    expect(res.isError).toBe(false);
    expect(res.content).toContain('No text content extracted');
  });
});
