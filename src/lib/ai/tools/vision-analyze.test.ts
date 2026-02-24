import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeVisionAnalyze, visionAnalyzeTool } from './vision-analyze';

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

// Mock global fetch (for image URL fetching)
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function makeCall(args: Record<string, unknown>) {
  return { id: 'vis-1', name: 'analyze_image', arguments: args, sessionId: 'test-session' };
}

beforeEach(() => {
  mockCreate.mockReset();
  mockFetch.mockReset();
  process.env.ANTHROPIC_API_KEY = 'test-key';
});

// -------------------------------------------------------------------
// Metadata
// -------------------------------------------------------------------
describe('visionAnalyzeTool metadata', () => {
  it('should have correct name', () => {
    expect(visionAnalyzeTool.name).toBe('analyze_image');
  });

  it('should require image_source', () => {
    expect(visionAnalyzeTool.parameters.required).toContain('image_source');
  });

  it('should have analysis_type enum', () => {
    const props = visionAnalyzeTool.parameters.properties as Record<string, { enum?: string[] }>;
    expect(props.analysis_type.enum).toContain('general');
    expect(props.analysis_type.enum).toContain('text_extraction');
    expect(props.analysis_type.enum).toContain('table_extraction');
    expect(props.analysis_type.enum).toContain('chart_data');
    expect(props.analysis_type.enum).toContain('describe');
  });
});

// -------------------------------------------------------------------
// Validation
// -------------------------------------------------------------------
describe('executeVisionAnalyze - validation', () => {
  it('should error for wrong tool name', async () => {
    const res = await executeVisionAnalyze({
      id: 'x',
      name: 'wrong_tool',
      arguments: { image_source: 'url', image_url: 'https://example.com/img.png' },
    });
    expect(res.isError).toBe(true);
    expect(res.content).toContain('Unknown tool');
  });

  it('should return toolCallId', async () => {
    const res = await executeVisionAnalyze({
      id: 'vis-2',
      name: 'wrong_tool',
      arguments: {},
    });
    expect(res.toolCallId).toBe('vis-2');
  });
});

// -------------------------------------------------------------------
// Cost control
// -------------------------------------------------------------------
describe('executeVisionAnalyze - cost control', () => {
  it('should reject when cost budget exceeded', async () => {
    const { canExecuteTool } = await import('./safety');
    (canExecuteTool as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      allowed: false,
      reason: 'Budget exceeded',
    });
    const res = await executeVisionAnalyze(
      makeCall({ image_source: 'url', image_url: 'https://example.com/img.png' })
    );
    expect(res.isError).toBe(true);
    expect(res.content).toContain('Budget exceeded');
  });
});

// -------------------------------------------------------------------
// URL image fetching
// -------------------------------------------------------------------
describe('executeVisionAnalyze - URL source', () => {
  it('should fetch image from URL and analyze', async () => {
    const imgData = Buffer.from('fake-image-data');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'image/png']]),
      arrayBuffer: () => Promise.resolve(imgData.buffer),
    });
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'This image shows a cat.' }],
    });

    const res = await executeVisionAnalyze(
      makeCall({
        image_source: 'url',
        image_url: 'https://example.com/cat.png',
        analysis_type: 'describe',
      })
    );
    expect(res.isError).toBe(false);
    expect(res.content).toContain('cat');
  });

  it('should handle HTTP error when fetching image', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      headers: new Map(),
    });

    const res = await executeVisionAnalyze(
      makeCall({ image_source: 'url', image_url: 'https://example.com/missing.png' })
    );
    expect(res.isError).toBe(true);
    expect(res.content).toContain('404');
  });

  it('should reject non-image content type', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'text/html']]),
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
    });

    const res = await executeVisionAnalyze(
      makeCall({ image_source: 'url', image_url: 'https://example.com/page.html' })
    );
    expect(res.isError).toBe(true);
    expect(res.content).toContain('Not an image');
  });

  it('should require image_url for URL source', async () => {
    const res = await executeVisionAnalyze(makeCall({ image_source: 'url' }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('URL');
  });

  it('should handle network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network failed'));
    const res = await executeVisionAnalyze(
      makeCall({ image_source: 'url', image_url: 'https://example.com/img.png' })
    );
    expect(res.isError).toBe(true);
    expect(res.content).toContain('Network failed');
  });
});

// -------------------------------------------------------------------
// Conversation source
// -------------------------------------------------------------------
describe('executeVisionAnalyze - conversation source', () => {
  it('should attempt analysis with conversation source', async () => {
    // Conversation source without _imageContext still proceeds (may fail at API)
    mockCreate.mockRejectedValueOnce(new Error('No image in request'));
    const res = await executeVisionAnalyze(
      makeCall({ image_source: 'conversation', analysis_type: 'general' })
    );
    // The tool attempts to analyze even without explicit image data
    expect(res.toolCallId).toBe('vis-1');
  });
});

// -------------------------------------------------------------------
// Anthropic API error
// -------------------------------------------------------------------
describe('executeVisionAnalyze - API errors', () => {
  it('should handle Anthropic API error', async () => {
    const imgData = Buffer.from('fake-image');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'image/jpeg']]),
      arrayBuffer: () => Promise.resolve(imgData.buffer),
    });
    mockCreate.mockRejectedValueOnce(new Error('API rate limited'));

    const res = await executeVisionAnalyze(
      makeCall({ image_source: 'url', image_url: 'https://example.com/img.jpg' })
    );
    expect(res.isError).toBe(true);
    expect(res.content).toContain('API rate limited');
  });
});
