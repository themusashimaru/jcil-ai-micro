// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeExtractTable, extractTableTool } from './extract-table';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock safety
vi.mock('./safety', () => ({
  canExecuteTool: vi.fn().mockReturnValue({ allowed: true }),
  recordToolCost: vi.fn(),
}));

// Mock Anthropic
const mockCreate = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: (...args: unknown[]) => mockCreate(...args) };
  },
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function makeCall(args: Record<string, unknown>) {
  return { id: 'tbl-1', name: 'extract_table', arguments: args, sessionId: 'test-session' };
}

beforeEach(() => {
  mockCreate.mockReset();
  mockFetch.mockReset();
  process.env.ANTHROPIC_API_KEY = 'test-key';
});

// -------------------------------------------------------------------
// Metadata
// -------------------------------------------------------------------
describe('extractTableTool metadata', () => {
  it('should have correct name', () => {
    expect(extractTableTool.name).toBe('extract_table');
  });

  it('should require image_url', () => {
    expect(extractTableTool.parameters.required).toContain('image_url');
  });

  it('should have output_format enum', () => {
    const props = extractTableTool.parameters.properties as Record<string, { enum?: string[] }>;
    expect(props.output_format.enum).toContain('markdown');
    expect(props.output_format.enum).toContain('json');
    expect(props.output_format.enum).toContain('csv');
  });

  it('should have table_hint property', () => {
    const props = extractTableTool.parameters.properties as Record<string, unknown>;
    expect(props).toHaveProperty('table_hint');
  });
});

// -------------------------------------------------------------------
// Validation
// -------------------------------------------------------------------
describe('executeExtractTable - validation', () => {
  it('should error for wrong tool name', async () => {
    const res = await executeExtractTable({
      id: 'x',
      name: 'wrong_tool',
      arguments: { image_url: 'https://example.com/table.png' },
    });
    expect(res.isError).toBe(true);
    expect(res.content).toContain('Unknown tool');
  });

  it('should return toolCallId', async () => {
    const res = await executeExtractTable({
      id: 'tbl-99',
      name: 'wrong_tool',
      arguments: {},
    });
    expect(res.toolCallId).toBe('tbl-99');
  });

  it('should error when no image URL provided', async () => {
    const res = await executeExtractTable(makeCall({}));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('No image URL');
  });
});

// -------------------------------------------------------------------
// Cost control
// -------------------------------------------------------------------
describe('executeExtractTable - cost control', () => {
  it('should reject when cost budget exceeded', async () => {
    const { canExecuteTool } = await import('./safety');
    (canExecuteTool as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      allowed: false,
      reason: 'Budget exceeded',
    });
    const res = await executeExtractTable(makeCall({ image_url: 'https://example.com/table.png' }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('Budget exceeded');
  });
});

// -------------------------------------------------------------------
// Image fetching
// -------------------------------------------------------------------
describe('executeExtractTable - image fetching', () => {
  it('should handle HTTP error when fetching image', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      headers: { get: () => 'text/html' },
    });

    const res = await executeExtractTable(
      makeCall({ image_url: 'https://example.com/missing.png' })
    );
    expect(res.isError).toBe(true);
    expect(res.content).toContain('Failed to fetch image');
    expect(res.content).toContain('404');
  });

  it('should reject non-image content type', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => 'text/html' },
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
    });

    const res = await executeExtractTable(makeCall({ image_url: 'https://example.com/page.html' }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('Not an image');
  });

  it('should handle network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network failed'));
    const res = await executeExtractTable(makeCall({ image_url: 'https://example.com/table.png' }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('Network failed');
  });

  it('should reject images larger than 20MB', async () => {
    const largeBuffer = new ArrayBuffer(21 * 1024 * 1024);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => 'image/png' },
      arrayBuffer: () => Promise.resolve(largeBuffer),
    });

    const res = await executeExtractTable(makeCall({ image_url: 'https://example.com/huge.png' }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('too large');
  });
});

// -------------------------------------------------------------------
// Successful extraction
// -------------------------------------------------------------------
describe('executeExtractTable - success', () => {
  function mockFetchImage() {
    const imgData = Buffer.from('fake-image-data');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => 'image/png' },
      arrayBuffer: () => Promise.resolve(imgData.buffer),
    });
  }

  it('should extract table in markdown format by default', async () => {
    mockFetchImage();
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: '| Name | Price |\n|------|-------|\n| Widget | $10 |',
        },
      ],
    });

    const res = await executeExtractTable(makeCall({ image_url: 'https://example.com/table.png' }));
    expect(res.isError).toBe(false);
    expect(res.content).toContain('Table Extracted');
    expect(res.content).toContain('markdown');
    expect(res.content).toContain('Widget');
    expect(res.content).toContain('$10');
  });

  it('should pass output_format to extraction', async () => {
    mockFetchImage();
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'text',
          text: '{"headers":["Name"],"rows":[["Widget"]]}',
        },
      ],
    });

    const res = await executeExtractTable(
      makeCall({ image_url: 'https://example.com/table.png', output_format: 'json' })
    );
    expect(res.isError).toBe(false);
    expect(res.content).toContain('json');
  });

  it('should pass csv format', async () => {
    mockFetchImage();
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Name,Price\nWidget,$10' }],
    });

    const res = await executeExtractTable(
      makeCall({ image_url: 'https://example.com/table.png', output_format: 'csv' })
    );
    expect(res.isError).toBe(false);
    expect(res.content).toContain('csv');
  });

  it('should record tool cost after extraction', async () => {
    mockFetchImage();
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '| A | B |' }],
    });

    await executeExtractTable(makeCall({ image_url: 'https://example.com/table.png' }));
    const { recordToolCost } = await import('./safety');
    expect(recordToolCost).toHaveBeenCalledWith('test-session', 'extract_table', 0.03);
  });
});

// -------------------------------------------------------------------
// API errors
// -------------------------------------------------------------------
describe('executeExtractTable - API errors', () => {
  it('should handle Anthropic API error', async () => {
    const imgData = Buffer.from('fake-image');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => 'image/jpeg' },
      arrayBuffer: () => Promise.resolve(imgData.buffer),
    });
    mockCreate.mockRejectedValueOnce(new Error('API rate limited'));

    const res = await executeExtractTable(makeCall({ image_url: 'https://example.com/table.jpg' }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('API rate limited');
  });
});
