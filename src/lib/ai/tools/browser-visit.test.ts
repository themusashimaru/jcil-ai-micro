import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeBrowserVisitTool, browserVisitTool } from './browser-visit';

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
  canVisitPage: vi.fn().mockReturnValue({ safe: true }),
  recordPageVisit: vi.fn(),
  isDomainTrusted: vi.fn().mockReturnValue(true),
  sanitizeOutput: vi.fn((s: string) => s),
  canExecuteTool: vi.fn().mockReturnValue({ allowed: true }),
  recordToolCost: vi.fn(),
}));

// Mock E2B sandbox
const mockRun = vi.fn();
const mockWriteFile = vi.fn();
const mockRemoveFile = vi.fn();
const mockCreate = vi.fn().mockResolvedValue({
  commands: { run: mockRun },
  files: { write: mockWriteFile, remove: mockRemoveFile },
  kill: vi.fn(),
});

vi.mock('@e2b/code-interpreter', () => ({
  Sandbox: {
    create: (...args: unknown[]) => mockCreate(...args),
  },
}));

function makeCall(args: Record<string, unknown>) {
  return { id: 'bv-1', name: 'browser_visit', arguments: args, sessionId: 'test-session' };
}

beforeEach(() => {
  mockRun.mockReset();
  mockWriteFile.mockReset().mockResolvedValue(undefined);
  mockRemoveFile.mockReset().mockResolvedValue(undefined);
  process.env.E2B_API_KEY = 'test-key';
});

// -------------------------------------------------------------------
// Metadata
// -------------------------------------------------------------------
describe('browserVisitTool metadata', () => {
  it('should have correct name', () => {
    expect(browserVisitTool.name).toBe('browser_visit');
  });

  it('should require url', () => {
    expect(browserVisitTool.parameters.required).toContain('url');
  });

  it('should have action enum', () => {
    const props = browserVisitTool.parameters.properties as Record<string, { enum?: string[] }>;
    expect(props.action.enum).toContain('extract_content');
    expect(props.action.enum).toContain('screenshot');
    expect(props.action.enum).toContain('extract_links');
    expect(props.action.enum).toContain('click_and_extract');
  });
});

// -------------------------------------------------------------------
// Validation
// -------------------------------------------------------------------
describe('executeBrowserVisitTool - validation', () => {
  it('should error for wrong tool name', async () => {
    const res = await executeBrowserVisitTool({
      id: 'x',
      name: 'wrong_tool',
      arguments: { url: 'https://example.com' },
    });
    expect(res.isError).toBe(true);
    expect(res.content).toContain('Unknown tool');
  });

  it('should error when no URL provided', async () => {
    const res = await executeBrowserVisitTool(makeCall({}));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('No URL');
  });

  it('should return toolCallId', async () => {
    const res = await executeBrowserVisitTool(makeCall({}));
    expect(res.toolCallId).toBe('bv-1');
  });
});

// -------------------------------------------------------------------
// URL safety
// -------------------------------------------------------------------
describe('executeBrowserVisitTool - URL safety', () => {
  it('should block unsafe URLs', async () => {
    const { isUrlSafe } = await import('./safety');
    (isUrlSafe as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      safe: false,
      reason: 'Private IP',
      category: 'internal',
    });
    const res = await executeBrowserVisitTool(makeCall({ url: 'http://10.0.0.1/admin' }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('Cannot visit URL');
  });

  it('should block when visit limit reached', async () => {
    const { canVisitPage } = await import('./safety');
    (canVisitPage as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      safe: false,
      reason: 'Visit limit reached',
    });
    const res = await executeBrowserVisitTool(makeCall({ url: 'https://example.com' }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('Cannot visit page');
  });

  it('should block when cost budget exceeded', async () => {
    const { canExecuteTool } = await import('./safety');
    (canExecuteTool as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      allowed: false,
      reason: 'Budget exceeded',
    });
    const res = await executeBrowserVisitTool(makeCall({ url: 'https://example.com' }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('Budget exceeded');
  });
});

// -------------------------------------------------------------------
// Click selector safety
// -------------------------------------------------------------------
describe('executeBrowserVisitTool - click selector safety', () => {
  const dangerousSelectors = [
    'login-button',
    '.signin-form',
    '#sign-in',
    '.signup-link',
    '#sign-up',
    '.register-btn',
    '#checkout-submit',
    '.payment-form',
    '.pay-now',
    '#purchase-btn',
    '.buy-button',
    'input[type=submit]',
    '#password-field',
  ];

  for (const selector of dangerousSelectors) {
    it(`should block clicking "${selector}"`, async () => {
      const res = await executeBrowserVisitTool(
        makeCall({
          url: 'https://example.com',
          action: 'click_and_extract',
          click_selector: selector,
        })
      );
      expect(res.isError).toBe(true);
      expect(res.content).toContain('sensitive element');
    });
  }

  it('should allow clicking safe selectors', async () => {
    // Should proceed past the selector check (will reach E2B execution)
    mockRun.mockResolvedValueOnce({
      stdout: '{"type":"content","data":{"title":"Test","content":"Safe content"}}',
      stderr: '',
    });

    const res = await executeBrowserVisitTool(
      makeCall({
        url: 'https://example.com',
        action: 'click_and_extract',
        click_selector: '.read-more',
      })
    );
    // Should not error on selector check
    expect(res.content).not.toContain('sensitive element');
  });
});

// -------------------------------------------------------------------
// Successful execution
// -------------------------------------------------------------------
describe('executeBrowserVisitTool - success', () => {
  it('should extract content', async () => {
    mockRun.mockResolvedValueOnce({
      stdout: '{"type":"content","data":{"title":"Test Page","content":"Hello World"}}',
      stderr: '',
    });

    const res = await executeBrowserVisitTool(
      makeCall({ url: 'https://example.com', action: 'extract_content' })
    );
    expect(res.isError).toBe(false);
    expect(res.content).toContain('Test Page');
    expect(res.content).toContain('Hello World');
    expect(res.content).toContain('Source: https://example.com');
  });

  it('should extract links', async () => {
    mockRun.mockResolvedValueOnce({
      stdout: JSON.stringify({
        type: 'links',
        data: [
          { text: 'Home', href: 'https://example.com/' },
          { text: 'About', href: 'https://example.com/about' },
        ],
      }),
      stderr: '',
    });

    const res = await executeBrowserVisitTool(
      makeCall({ url: 'https://example.com', action: 'extract_links' })
    );
    expect(res.isError).toBe(false);
    expect(res.content).toContain('Found 2 links');
    expect(res.content).toContain('[Home]');
    expect(res.content).toContain('[About]');
  });

  it('should take screenshot', async () => {
    mockRun.mockResolvedValueOnce({
      stdout: '{"type":"screenshot","data":"iVBORw0KGgo..."}',
      stderr: '',
    });

    const res = await executeBrowserVisitTool(
      makeCall({ url: 'https://example.com', action: 'screenshot' })
    );
    expect(res.isError).toBe(false);
    expect(res.content).toContain('Screenshot captured');
  });

  it('should normalize URL without protocol', async () => {
    mockRun.mockResolvedValueOnce({
      stdout: '{"type":"content","data":{"title":"Test","content":"ok"}}',
      stderr: '',
    });

    const res = await executeBrowserVisitTool(makeCall({ url: 'example.com' }));
    expect(res.isError).toBe(false);
    expect(res.content).toContain('Source: https://example.com');
  });
});

// -------------------------------------------------------------------
// Error handling
// -------------------------------------------------------------------
describe('executeBrowserVisitTool - errors', () => {
  it('should handle browser execution error', async () => {
    mockRun.mockResolvedValueOnce({
      stdout: '{"type":"error","message":"Page not found"}',
      stderr: '',
    });

    const res = await executeBrowserVisitTool(makeCall({ url: 'https://example.com/missing' }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('Page not found');
  });

  it('should handle no output from browser', async () => {
    mockRun.mockResolvedValueOnce({ stdout: '', stderr: '' });

    const res = await executeBrowserVisitTool(makeCall({ url: 'https://example.com' }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('No output');
  });
});
