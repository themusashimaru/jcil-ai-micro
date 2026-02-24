// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeScreenshot, screenshotTool, isScreenshotAvailable } from './screenshot-tool';

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
  isUrlSafe: vi.fn().mockReturnValue({ safe: true }),
}));

// Mock E2B sandbox
const mockRunCode = vi.fn();
const mockKill = vi.fn().mockResolvedValue(undefined);
const mockCreate = vi.fn().mockResolvedValue({
  runCode: mockRunCode,
  kill: mockKill,
});

vi.mock('@e2b/code-interpreter', () => ({
  Sandbox: {
    create: (...args: unknown[]) => mockCreate(...args),
  },
}));

function makeCall(args: Record<string, unknown>) {
  return { id: 'ss-1', name: 'screenshot', arguments: args, sessionId: 'test-session' };
}

beforeEach(() => {
  mockRunCode.mockReset();
  mockKill.mockReset().mockResolvedValue(undefined);
  mockCreate.mockClear();
  process.env.E2B_API_KEY = 'test-key';
});

// -------------------------------------------------------------------
// Metadata
// -------------------------------------------------------------------
describe('screenshotTool metadata', () => {
  it('should have correct name', () => {
    expect(screenshotTool.name).toBe('screenshot');
  });

  it('should require url', () => {
    expect(screenshotTool.parameters.required).toContain('url');
  });

  it('should have full_page, width, height, wait_for, delay_ms properties', () => {
    const props = screenshotTool.parameters.properties as Record<string, unknown>;
    expect(props).toHaveProperty('full_page');
    expect(props).toHaveProperty('width');
    expect(props).toHaveProperty('height');
    expect(props).toHaveProperty('wait_for');
    expect(props).toHaveProperty('delay_ms');
  });
});

// -------------------------------------------------------------------
// Validation
// -------------------------------------------------------------------
describe('executeScreenshot - validation', () => {
  it('should error for wrong tool name', async () => {
    const res = await executeScreenshot({
      id: 'x',
      name: 'wrong_tool',
      arguments: { url: 'https://example.com' },
    });
    expect(res.isError).toBe(true);
    expect(res.content).toContain('Unknown tool');
  });

  it('should return toolCallId', async () => {
    const res = await executeScreenshot({
      id: 'ss-99',
      name: 'wrong_tool',
      arguments: {},
    });
    expect(res.toolCallId).toBe('ss-99');
  });

  it('should error when no URL provided', async () => {
    const res = await executeScreenshot(makeCall({}));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('No URL');
  });
});

// -------------------------------------------------------------------
// URL safety
// -------------------------------------------------------------------
describe('executeScreenshot - URL safety', () => {
  it('should block unsafe URLs', async () => {
    const { isUrlSafe } = await import('./safety');
    (isUrlSafe as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      safe: false,
      reason: 'Private IP',
    });
    const res = await executeScreenshot(makeCall({ url: 'http://10.0.0.1' }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('Cannot screenshot');
  });
});

// -------------------------------------------------------------------
// Successful screenshot
// -------------------------------------------------------------------
describe('executeScreenshot - success', () => {
  it('should capture screenshot and return base64 image', async () => {
    mockRunCode.mockResolvedValueOnce({
      logs: {
        stdout: ['__SCREENSHOT__\niVBORw0KGgoAAAANSUhEUg=='],
        stderr: [],
      },
    });

    const res = await executeScreenshot(makeCall({ url: 'https://example.com' }));
    expect(res.isError).toBe(false);
    expect(res.content).toContain('Screenshot of https://example.com');
    expect(res.content).toContain('data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==');
    expect(res.content).toContain('1280x720');
  });

  it('should include full page indicator when full_page is true', async () => {
    mockRunCode.mockResolvedValueOnce({
      logs: {
        stdout: ['__SCREENSHOT__\nabc123'],
        stderr: [],
      },
    });

    const res = await executeScreenshot(makeCall({ url: 'https://example.com', full_page: true }));
    expect(res.isError).toBe(false);
    expect(res.content).toContain('full page');
  });

  it('should use custom viewport dimensions', async () => {
    mockRunCode.mockResolvedValueOnce({
      logs: {
        stdout: ['__SCREENSHOT__\nabc123'],
        stderr: [],
      },
    });

    const res = await executeScreenshot(
      makeCall({ url: 'https://example.com', width: 1920, height: 1080 })
    );
    expect(res.isError).toBe(false);
    expect(res.content).toContain('1920x1080');
  });

  it('should kill sandbox after execution', async () => {
    mockRunCode.mockResolvedValueOnce({
      logs: {
        stdout: ['__SCREENSHOT__\nabc'],
        stderr: [],
      },
    });

    await executeScreenshot(makeCall({ url: 'https://example.com' }));
    expect(mockKill).toHaveBeenCalledOnce();
  });
});

// -------------------------------------------------------------------
// Error handling
// -------------------------------------------------------------------
describe('executeScreenshot - errors', () => {
  it('should handle stderr without screenshot marker', async () => {
    mockRunCode.mockResolvedValueOnce({
      logs: {
        stdout: ['some other output'],
        stderr: ['Playwright error: navigation failed'],
      },
    });

    const res = await executeScreenshot(makeCall({ url: 'https://example.com' }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('Screenshot failed');
  });

  it('should handle no output at all', async () => {
    mockRunCode.mockResolvedValueOnce({
      logs: {
        stdout: [''],
        stderr: [],
      },
    });

    const res = await executeScreenshot(makeCall({ url: 'https://example.com' }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('no output');
  });

  it('should handle empty screenshot data after marker', async () => {
    mockRunCode.mockResolvedValueOnce({
      logs: {
        stdout: ['__SCREENSHOT__'],
        stderr: [],
      },
    });

    const res = await executeScreenshot(makeCall({ url: 'https://example.com' }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('empty output');
  });

  it('should handle sandbox creation failure', async () => {
    mockCreate.mockRejectedValueOnce(new Error('E2B connection failed'));

    const res = await executeScreenshot(makeCall({ url: 'https://example.com' }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('E2B connection failed');
  });

  it('should still kill sandbox on error', async () => {
    mockRunCode.mockRejectedValueOnce(new Error('Execution timeout'));

    const res = await executeScreenshot(makeCall({ url: 'https://example.com' }));
    expect(res.isError).toBe(true);
    expect(mockKill).toHaveBeenCalled();
  });
});

// -------------------------------------------------------------------
// Availability
// -------------------------------------------------------------------
describe('isScreenshotAvailable', () => {
  it('should return true when E2B_API_KEY is set', async () => {
    process.env.E2B_API_KEY = 'test-key';
    const result = await isScreenshotAvailable();
    expect(result).toBe(true);
  });

  it('should return false when E2B_API_KEY is not set', async () => {
    delete process.env.E2B_API_KEY;
    const result = await isScreenshotAvailable();
    expect(result).toBe(false);
  });
});
