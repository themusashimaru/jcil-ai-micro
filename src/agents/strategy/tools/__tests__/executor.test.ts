// @ts-nocheck - Test file with extensive mocking
/**
 * COMPREHENSIVE TESTS for src/agents/strategy/tools/executor.ts
 *
 * Tests all exported functions:
 *   - setSessionId
 *   - executeScoutTool
 *   - executeManyTools
 *   - cleanupAllSandboxes
 *   - getClaudeToolDefinitions
 *   - parseClaudeToolCall
 *
 * All external dependencies are mocked.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('@/lib/logger', () => ({
  logger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({ messages: { create: vi.fn() } })),
  };
});

const mockSearchBrave = vi.fn();
vi.mock('../braveSearch', () => ({
  searchBrave: (...args: unknown[]) => mockSearchBrave(...args),
}));

const mockBrowserVisit = vi.fn();
const mockBrowserScreenshot = vi.fn();
const mockCleanupBrowserSandbox = vi.fn();
vi.mock('../e2bBrowser', () => ({
  browserVisit: (...args: unknown[]) => mockBrowserVisit(...args),
  browserScreenshot: (...args: unknown[]) => mockBrowserScreenshot(...args),
  cleanupBrowserSandbox: (...args: unknown[]) => mockCleanupBrowserSandbox(...args),
}));

const mockRunCode = vi.fn();
const mockCleanupCodeSandbox = vi.fn();
vi.mock('../e2bCode', () => ({
  runCode: (...args: unknown[]) => mockRunCode(...args),
  cleanupCodeSandbox: (...args: unknown[]) => mockCleanupCodeSandbox(...args),
}));

const mockAnalyzeScreenshot = vi.fn();
const mockExtractTableFromScreenshot = vi.fn();
const mockCompareScreenshots = vi.fn();
vi.mock('../visionAnalysis', () => ({
  analyzeScreenshot: (...args: unknown[]) => mockAnalyzeScreenshot(...args),
  extractTableFromScreenshot: (...args: unknown[]) => mockExtractTableFromScreenshot(...args),
  compareScreenshots: (...args: unknown[]) => mockCompareScreenshots(...args),
}));

const mockSafeFormFill = vi.fn();
const mockHandlePagination = vi.fn();
const mockHandleInfiniteScroll = vi.fn();
const mockClickAndNavigate = vi.fn();
const mockExtractPdf = vi.fn();
vi.mock('../e2bBrowserEnhanced', () => ({
  safeFormFill: (...args: unknown[]) => mockSafeFormFill(...args),
  handlePagination: (...args: unknown[]) => mockHandlePagination(...args),
  handleInfiniteScroll: (...args: unknown[]) => mockHandleInfiniteScroll(...args),
  clickAndNavigate: (...args: unknown[]) => mockClickAndNavigate(...args),
  extractPdf: (...args: unknown[]) => mockExtractPdf(...args),
}));

const mockGenerateComparisonTable = vi.fn();
vi.mock('../comparisonTable', () => ({
  generateComparisonTable: (...args: unknown[]) => mockGenerateComparisonTable(...args),
}));

const mockIsUrlSafe = vi.fn();
const mockCanVisitPage = vi.fn();
const mockRecordPageVisit = vi.fn();
const mockSanitizeOutput = vi.fn();
const mockLogBlockedAction = vi.fn();
vi.mock('../safety', () => ({
  isUrlSafe: (...args: unknown[]) => mockIsUrlSafe(...args),
  canVisitPage: (...args: unknown[]) => mockCanVisitPage(...args),
  recordPageVisit: (...args: unknown[]) => mockRecordPageVisit(...args),
  sanitizeOutput: (...args: unknown[]) => mockSanitizeOutput(...args),
  logBlockedAction: (...args: unknown[]) => mockLogBlockedAction(...args),
}));

const mockGetDynamicToolById = vi.fn();
const mockExecuteDynamicTool = vi.fn();
const mockGenerateDynamicTool = vi.fn();
const mockRegisterDynamicTool = vi.fn();
const mockGetDynamicToolCreationDefinition = vi.fn();
vi.mock('../dynamicTools', () => ({
  getDynamicToolById: (...args: unknown[]) => mockGetDynamicToolById(...args),
  executeDynamicTool: (...args: unknown[]) => mockExecuteDynamicTool(...args),
  generateDynamicTool: (...args: unknown[]) => mockGenerateDynamicTool(...args),
  registerDynamicTool: (...args: unknown[]) => mockRegisterDynamicTool(...args),
  getDynamicToolCreationDefinition: () => mockGetDynamicToolCreationDefinition(),
}));

// ── Import after mocks ─────────────────────────────────────────────────────────

import {
  setSessionId,
  executeScoutTool,
  executeManyTools,
  cleanupAllSandboxes,
  getClaudeToolDefinitions,
  parseClaudeToolCall,
} from '../executor';

// ── Helpers ─────────────────────────────────────────────────────────────────────

/** Default: all URL safety checks pass */
function allowAllUrls() {
  mockIsUrlSafe.mockReturnValue({ safe: true });
  mockCanVisitPage.mockReturnValue({ safe: true });
}

// ── Setup ───────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  allowAllUrls();
  mockSanitizeOutput.mockImplementation((s: string) => s);
  // Reset session to default so tests are isolated
  setSessionId('test-session');

  // Provide a sane default for getDynamicToolCreationDefinition
  mockGetDynamicToolCreationDefinition.mockReturnValue({
    name: 'create_custom_tool',
    description: 'Create a custom tool',
    input_schema: { type: 'object', properties: {}, required: [] },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// =============================================================================
// setSessionId
// =============================================================================

describe('setSessionId', () => {
  it('should set the session id without throwing', () => {
    expect(() => setSessionId('my-session')).not.toThrow();
  });

  it('should accept empty string', () => {
    expect(() => setSessionId('')).not.toThrow();
  });
});

// =============================================================================
// executeScoutTool — brave_search
// =============================================================================

describe('executeScoutTool — brave_search', () => {
  it('should execute brave_search and return success', async () => {
    const mockOutput = {
      success: true,
      results: [{ title: 'Test', url: 'https://example.com', description: 'desc' }],
    };
    mockSearchBrave.mockResolvedValue(mockOutput);

    const result = await executeScoutTool({ tool: 'brave_search', input: { query: 'test' } });

    expect(result.tool).toBe('brave_search');
    expect(result.success).toBe(true);
    expect(result.output).toEqual(mockOutput);
    expect(result.costIncurred).toBe(0.005);
    expect(result.timeElapsed).toBeGreaterThanOrEqual(0);
    expect(mockSearchBrave).toHaveBeenCalledWith({ query: 'test' });
  });

  it('should handle brave_search failure', async () => {
    mockSearchBrave.mockRejectedValue(new Error('API key invalid'));

    const result = await executeScoutTool({ tool: 'brave_search', input: { query: 'test' } });

    expect(result.success).toBe(false);
    expect((result.output as { error: string }).error).toBe('API key invalid');
    expect(result.costIncurred).toBe(0);
  });
});

// =============================================================================
// executeScoutTool — browser_visit
// =============================================================================

describe('executeScoutTool — browser_visit', () => {
  it('should execute browser_visit, record visit, and sanitize output', async () => {
    const mockOutput = { success: true, url: 'https://example.com', textContent: 'Hello world' };
    mockBrowserVisit.mockResolvedValue(mockOutput);
    mockSanitizeOutput.mockReturnValue('Hello world (sanitized)');

    const result = await executeScoutTool({
      tool: 'browser_visit',
      input: { url: 'https://example.com' },
    });

    expect(result.success).toBe(true);
    expect(result.costIncurred).toBe(0.02);
    expect(mockRecordPageVisit).toHaveBeenCalledWith('test-session', 'https://example.com');
    expect(mockSanitizeOutput).toHaveBeenCalledWith('Hello world');
    // The output should have sanitized content
    expect(mockOutput.textContent).toBe('Hello world (sanitized)');
  });

  it('should skip sanitization when textContent is absent', async () => {
    const mockOutput = { success: true, url: 'https://example.com' };
    mockBrowserVisit.mockResolvedValue(mockOutput);

    await executeScoutTool({ tool: 'browser_visit', input: { url: 'https://example.com' } });

    expect(mockSanitizeOutput).not.toHaveBeenCalled();
  });

  it('should block browser_visit when URL is unsafe', async () => {
    mockIsUrlSafe.mockReturnValue({
      safe: false,
      reason: 'Blocked TLD',
      category: 'url',
      severity: 'critical',
    });

    const result = await executeScoutTool({
      tool: 'browser_visit',
      input: { url: 'https://example.gov' },
    });

    expect(result.success).toBe(false);
    expect((result.output as { error: string }).error).toContain('BLOCKED');
    expect((result.output as { category: string }).category).toBe('url');
    expect(result.costIncurred).toBe(0);
    expect(mockBrowserVisit).not.toHaveBeenCalled();
    expect(mockLogBlockedAction).toHaveBeenCalled();
  });

  it('should block browser_visit when session rate limit is exceeded', async () => {
    mockIsUrlSafe.mockReturnValue({ safe: true });
    mockCanVisitPage.mockReturnValue({
      safe: false,
      reason: 'Rate limit exceeded',
      category: 'rate_limit',
      severity: 'warning',
    });

    const result = await executeScoutTool({
      tool: 'browser_visit',
      input: { url: 'https://example.com' },
    });

    expect(result.success).toBe(false);
    expect((result.output as { error: string }).error).toContain('BLOCKED');
    expect(mockLogBlockedAction).toHaveBeenCalled();
  });
});

// =============================================================================
// executeScoutTool — run_code
// =============================================================================

describe('executeScoutTool — run_code', () => {
  it('should execute run_code successfully', async () => {
    const mockOutput = { success: true, stdout: '42', stderr: '' };
    mockRunCode.mockResolvedValue(mockOutput);

    const result = await executeScoutTool({
      tool: 'run_code',
      input: { code: 'print(42)', language: 'python' },
    });

    expect(result.success).toBe(true);
    expect(result.costIncurred).toBe(0.01);
    expect(mockRunCode).toHaveBeenCalledWith({ code: 'print(42)', language: 'python' });
  });
});

// =============================================================================
// executeScoutTool — screenshot
// =============================================================================

describe('executeScoutTool — screenshot', () => {
  it('should execute screenshot successfully', async () => {
    const mockOutput = { success: true, imageBase64: 'abc123' };
    mockBrowserScreenshot.mockResolvedValue(mockOutput);

    const result = await executeScoutTool({
      tool: 'screenshot',
      input: { url: 'https://example.com' },
    });

    expect(result.success).toBe(true);
    expect(result.costIncurred).toBe(0.03);
    expect(mockBrowserScreenshot).toHaveBeenCalledWith({ url: 'https://example.com' });
  });

  it('should block screenshot for unsafe URL', async () => {
    mockIsUrlSafe.mockReturnValue({
      safe: false,
      reason: 'Blocked',
      category: 'url',
      severity: 'critical',
    });

    const result = await executeScoutTool({
      tool: 'screenshot',
      input: { url: 'https://malicious.kp' },
    });

    expect(result.success).toBe(false);
    expect(mockBrowserScreenshot).not.toHaveBeenCalled();
  });
});

// =============================================================================
// executeScoutTool — vision tools
// =============================================================================

describe('executeScoutTool — vision_analyze', () => {
  it('should execute vision_analyze successfully', async () => {
    const mockOutput = { success: true, analysis: 'Chart shows upward trend' };
    mockAnalyzeScreenshot.mockResolvedValue(mockOutput);

    const result = await executeScoutTool({
      tool: 'vision_analyze',
      input: { url: 'https://example.com/chart', prompt: 'describe this chart' },
    });

    expect(result.success).toBe(true);
    expect(result.costIncurred).toBe(0.05);
    expect(mockAnalyzeScreenshot).toHaveBeenCalled();
    // Verify Anthropic client was passed as first argument
    expect(mockAnalyzeScreenshot.mock.calls[0][0]).toBeDefined();
  });
});

describe('executeScoutTool — extract_table', () => {
  it('should execute extract_table successfully', async () => {
    const mockOutput = { success: true, headers: ['Name', 'Price'], rows: [['A', '$10']] };
    mockExtractTableFromScreenshot.mockResolvedValue(mockOutput);

    const result = await executeScoutTool({
      tool: 'extract_table',
      input: { url: 'https://example.com/pricing', tableDescription: 'pricing table' },
    });

    expect(result.success).toBe(true);
    expect(result.costIncurred).toBe(0.05);
  });
});

describe('executeScoutTool — compare_screenshots', () => {
  it('should execute compare_screenshots successfully', async () => {
    const mockOutput = { success: true, analysis: 'Product A is cheaper' };
    mockCompareScreenshots.mockResolvedValue(mockOutput);

    const result = await executeScoutTool({
      tool: 'compare_screenshots',
      input: { urls: ['https://a.com', 'https://b.com'], comparisonPrompt: 'compare prices' },
    });

    expect(result.success).toBe(true);
    expect(result.costIncurred).toBe(0.1);
    expect(mockCompareScreenshots).toHaveBeenCalledWith(
      expect.anything(),
      ['https://a.com', 'https://b.com'],
      'compare prices'
    );
  });
});

// =============================================================================
// executeScoutTool — enhanced browser tools
// =============================================================================

describe('executeScoutTool — safe_form_fill', () => {
  it('should execute safe_form_fill successfully', async () => {
    const mockOutput = {
      success: true,
      resultUrl: 'https://example.com/results',
      resultContent: 'results',
    };
    mockSafeFormFill.mockResolvedValue(mockOutput);

    const result = await executeScoutTool({
      tool: 'safe_form_fill',
      input: {
        url: 'https://example.com/search',
        sessionId: 'ses-1',
        fields: [{ selector: '#q', value: 'test' }],
      },
    });

    expect(result.success).toBe(true);
    expect(result.costIncurred).toBe(0.03);
  });
});

describe('executeScoutTool — paginate', () => {
  it('should execute paginate successfully', async () => {
    const mockOutput = {
      success: true,
      pages: [{ pageNumber: 1, url: 'https://example.com', content: 'p1' }],
      totalPages: 1,
    };
    mockHandlePagination.mockResolvedValue(mockOutput);

    const result = await executeScoutTool({
      tool: 'paginate',
      input: {
        url: 'https://example.com',
        sessionId: 'ses-1',
        nextButtonSelector: '.next',
        contentSelector: '.content',
      },
    });

    expect(result.success).toBe(true);
    expect(result.costIncurred).toBe(0.04);
  });
});

describe('executeScoutTool — infinite_scroll', () => {
  it('should execute infinite_scroll successfully', async () => {
    const mockOutput = { success: true, content: 'loaded items', itemCount: 50 };
    mockHandleInfiniteScroll.mockResolvedValue(mockOutput);

    const result = await executeScoutTool({
      tool: 'infinite_scroll',
      input: {
        url: 'https://example.com/feed',
        sessionId: 'ses-1',
        contentSelector: '.items',
      },
    });

    expect(result.success).toBe(true);
    expect(result.costIncurred).toBe(0.04);
  });
});

describe('executeScoutTool — click_navigate', () => {
  it('should execute click_navigate successfully', async () => {
    const mockOutput = {
      success: true,
      resultUrl: 'https://example.com/detail',
      content: 'detail page',
    };
    mockClickAndNavigate.mockResolvedValue(mockOutput);

    const result = await executeScoutTool({
      tool: 'click_navigate',
      input: {
        url: 'https://example.com',
        sessionId: 'ses-1',
        clickSelector: '.detail-link',
      },
    });

    expect(result.success).toBe(true);
    expect(result.costIncurred).toBe(0.02);
  });
});

describe('executeScoutTool — extract_pdf', () => {
  it('should execute extract_pdf successfully', async () => {
    const mockOutput = { success: true, text: 'PDF content here', pageCount: 5 };
    mockExtractPdf.mockResolvedValue(mockOutput);

    const result = await executeScoutTool({
      tool: 'extract_pdf',
      input: {
        url: 'https://example.com/doc.pdf',
        sessionId: 'ses-1',
      },
    });

    expect(result.success).toBe(true);
    expect(result.costIncurred).toBe(0.02);
  });
});

// =============================================================================
// executeScoutTool — generate_comparison
// =============================================================================

describe('executeScoutTool — generate_comparison', () => {
  it('should execute generate_comparison successfully', async () => {
    const mockOutput = {
      success: true,
      table: { title: 'Test', headers: [], rows: [], summary: { bestByAttribute: {} } },
      markdown: '| ... |',
    };
    mockGenerateComparisonTable.mockReturnValue(mockOutput);

    const result = await executeScoutTool({
      tool: 'generate_comparison',
      input: {
        title: 'Product Comparison',
        items: [{ name: 'A', attributes: { price: 10 } }],
      },
    });

    expect(result.success).toBe(true);
    expect(result.costIncurred).toBe(0.001);
    expect(mockGenerateComparisonTable).toHaveBeenCalled();
  });
});

// =============================================================================
// executeScoutTool — create_custom_tool
// =============================================================================

describe('executeScoutTool — create_custom_tool', () => {
  it('should create a custom tool successfully', async () => {
    const dynamicTool = { id: 'tool-123', name: 'my_tool', description: 'Custom tool' };
    mockGenerateDynamicTool.mockResolvedValue(dynamicTool);

    const result = await executeScoutTool({
      tool: 'create_custom_tool' as any,
      input: {
        purpose: 'Extract specific data',
        justification: 'No existing tool can do this',
        inputs: [{ name: 'url', type: 'string', description: 'URL' }],
        outputType: 'object',
      },
    });

    expect(result.success).toBe(true);
    expect((result.output as any).toolId).toBe('tool-123');
    expect((result.output as any).toolName).toBe('my_tool');
    expect(result.costIncurred).toBe(0.01);
    expect(mockRegisterDynamicTool).toHaveBeenCalledWith('test-session', dynamicTool);
  });

  it('should use custom sessionId when provided in input', async () => {
    const dynamicTool = { id: 'tool-456', name: 'tool_456', description: 'Tool' };
    mockGenerateDynamicTool.mockResolvedValue(dynamicTool);

    await executeScoutTool({
      tool: 'create_custom_tool' as any,
      input: {
        purpose: 'test',
        justification: 'test',
        inputs: [],
        outputType: 'string',
        sessionId: 'custom-session-id',
      },
    });

    expect(mockGenerateDynamicTool).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 'custom-session-id' })
    );
    expect(mockRegisterDynamicTool).toHaveBeenCalledWith('custom-session-id', dynamicTool);
  });

  it('should return failure when dynamic tool generation fails', async () => {
    mockGenerateDynamicTool.mockResolvedValue(null);

    const result = await executeScoutTool({
      tool: 'create_custom_tool' as any,
      input: {
        purpose: 'test',
        justification: 'test',
        inputs: [],
        outputType: 'string',
      },
    });

    expect(result.success).toBe(false);
    expect((result.output as any).error).toContain('Tool creation failed');
    expect(mockRegisterDynamicTool).not.toHaveBeenCalled();
  });
});

// =============================================================================
// executeScoutTool — execute_custom_tool
// =============================================================================

describe('executeScoutTool — execute_custom_tool', () => {
  it('should execute a custom tool successfully', async () => {
    const dynamicTool = { id: 'tool-123', name: 'my_tool', code: 'return 42;' };
    mockGetDynamicToolById.mockReturnValue(dynamicTool);
    mockExecuteDynamicTool.mockResolvedValue({
      success: true,
      output: { data: 42 },
      executionTimeMs: 100,
    });

    const result = await executeScoutTool({
      tool: 'execute_custom_tool' as any,
      input: { toolId: 'tool-123', inputs: { x: 1 } },
    });

    expect(result.success).toBe(true);
    expect((result.output as any).result).toEqual({ data: 42 });
    expect(result.costIncurred).toBe(0.01);
    expect(mockExecuteDynamicTool).toHaveBeenCalledWith(dynamicTool, { x: 1 }, 'test-session');
  });

  it('should return failure when custom tool is not found', async () => {
    mockGetDynamicToolById.mockReturnValue(undefined);

    const result = await executeScoutTool({
      tool: 'execute_custom_tool' as any,
      input: { toolId: 'nonexistent', inputs: {} },
    });

    expect(result.success).toBe(false);
    expect((result.output as any).error).toContain('Custom tool not found');
    expect(mockExecuteDynamicTool).not.toHaveBeenCalled();
  });

  it('should propagate execution error from dynamic tool', async () => {
    const dynamicTool = { id: 'tool-err', name: 'err_tool', code: 'throw new Error()' };
    mockGetDynamicToolById.mockReturnValue(dynamicTool);
    mockExecuteDynamicTool.mockResolvedValue({
      success: false,
      error: 'Sandbox timeout',
      executionTimeMs: 30000,
    });

    const result = await executeScoutTool({
      tool: 'execute_custom_tool' as any,
      input: { toolId: 'tool-err', inputs: {} },
    });

    expect(result.success).toBe(false);
    expect((result.output as any).error).toBe('Sandbox timeout');
  });
});

// =============================================================================
// executeScoutTool — unknown tool
// =============================================================================

describe('executeScoutTool — unknown tool', () => {
  it('should return error for unknown tool', async () => {
    const result = await executeScoutTool({
      tool: 'nonexistent_tool' as any,
      input: {} as any,
    });

    expect(result.success).toBe(false);
    expect((result.output as { error: string }).error).toContain('Unknown tool');
    expect(result.costIncurred).toBe(0);
  });
});

// =============================================================================
// executeScoutTool — error handling / sandbox cleanup
// =============================================================================

describe('executeScoutTool — error handling', () => {
  it('should handle non-Error throws gracefully', async () => {
    mockSearchBrave.mockRejectedValue('string error');

    const result = await executeScoutTool({
      tool: 'brave_search',
      input: { query: 'test' },
    });

    expect(result.success).toBe(false);
    expect((result.output as { error: string }).error).toBe('string error');
  });

  it('should schedule sandbox cleanup on error via setImmediate', async () => {
    const originalSetImmediate = globalThis.setImmediate;
    const capturedCallbacks: Array<() => void> = [];
    globalThis.setImmediate = vi.fn((cb: () => void) => {
      capturedCallbacks.push(cb);
      return 0 as any;
    }) as any;

    mockCleanupBrowserSandbox.mockResolvedValue(undefined);
    mockCleanupCodeSandbox.mockResolvedValue(undefined);
    mockSearchBrave.mockRejectedValue(new Error('fail'));

    await executeScoutTool({ tool: 'brave_search', input: { query: 'test' } });

    expect(capturedCallbacks.length).toBe(1);

    // Execute the captured callback
    await capturedCallbacks[0]();

    expect(mockCleanupBrowserSandbox).toHaveBeenCalled();
    expect(mockCleanupCodeSandbox).toHaveBeenCalled();

    globalThis.setImmediate = originalSetImmediate;
  });

  it('should handle sandbox cleanup failure without crashing', async () => {
    const originalSetImmediate = globalThis.setImmediate;
    const capturedCallbacks: Array<() => void> = [];
    globalThis.setImmediate = vi.fn((cb: () => void) => {
      capturedCallbacks.push(cb);
      return 0 as any;
    }) as any;

    mockCleanupBrowserSandbox.mockRejectedValue(new Error('cleanup failed'));
    mockCleanupCodeSandbox.mockResolvedValue(undefined);
    mockSearchBrave.mockRejectedValue(new Error('fail'));

    await executeScoutTool({ tool: 'brave_search', input: { query: 'test' } });

    // Should not throw — the callback catches internally so it returns void
    expect(() => capturedCallbacks[0]()).not.toThrow();

    globalThis.setImmediate = originalSetImmediate;
  });
});

// =============================================================================
// executeScoutTool — URL safety for different URL-based tools
// =============================================================================

describe('executeScoutTool — URL safety checks for all URL-based tools', () => {
  const urlBasedTools = [
    'vision_analyze',
    'extract_table',
    'safe_form_fill',
    'paginate',
    'infinite_scroll',
    'click_navigate',
    'extract_pdf',
  ] as const;

  it.each(urlBasedTools)('should block %s when URL is unsafe', async (toolName) => {
    mockIsUrlSafe.mockReturnValue({
      safe: false,
      reason: 'Blocked domain',
      category: 'url',
      severity: 'critical',
    });

    const result = await executeScoutTool({
      tool: toolName,
      input: { url: 'https://bad.kp', sessionId: 's' } as any,
    });

    expect(result.success).toBe(false);
    expect((result.output as any).error).toContain('BLOCKED');
  });

  it('should check all urls in a multi-url tool input', async () => {
    // The urls field is checked for screenshot tool with urls array
    mockIsUrlSafe.mockReturnValueOnce({ safe: true });
    mockCanVisitPage.mockReturnValueOnce({ safe: true });
    mockIsUrlSafe.mockReturnValueOnce({
      safe: false,
      reason: 'Blocked',
      category: 'url',
      severity: 'high',
    });

    const result = await executeScoutTool({
      tool: 'browser_visit',
      input: { urls: ['https://ok.com', 'https://bad.com'] } as any,
    });

    expect(result.success).toBe(false);
  });

  it('should pass safety when there is no url or urls in input for URL-based tool', async () => {
    // If a URL-based tool input has neither url nor urls, the URL check loop simply never runs
    mockBrowserVisit.mockResolvedValue({ success: true, url: '' });

    const result = await executeScoutTool({
      tool: 'browser_visit',
      input: {} as any,
    });

    // The tool itself may still succeed since no URL blocking happened
    expect(result.success).toBe(true);
  });
});

// =============================================================================
// executeManyTools
// =============================================================================

describe('executeManyTools', () => {
  it('should execute tools sequentially by default', async () => {
    const order: string[] = [];
    mockSearchBrave.mockImplementation(async () => {
      order.push('brave');
      return { success: true, results: [] };
    });
    mockRunCode.mockImplementation(async () => {
      order.push('code');
      return { success: true, stdout: '', stderr: '' };
    });

    const calls = [
      { tool: 'brave_search' as const, input: { query: 'a' } },
      { tool: 'run_code' as const, input: { code: 'x', language: 'python' as const } },
    ];

    const results = await executeManyTools(calls);

    expect(results).toHaveLength(2);
    expect(results[0].tool).toBe('brave_search');
    expect(results[1].tool).toBe('run_code');
    expect(order).toEqual(['brave', 'code']);
  });

  it('should execute tools in parallel when parallel=true', async () => {
    mockSearchBrave.mockResolvedValue({ success: true, results: [] });
    mockRunCode.mockResolvedValue({ success: true, stdout: '', stderr: '' });

    const calls = [
      { tool: 'brave_search' as const, input: { query: 'a' } },
      { tool: 'run_code' as const, input: { code: 'x', language: 'python' as const } },
    ];

    const results = await executeManyTools(calls, { parallel: true });

    expect(results).toHaveLength(2);
  });

  it('should respect maxConcurrent option for parallel execution', async () => {
    let concurrentCount = 0;
    let maxConcurrent = 0;

    const slowMock = async () => {
      concurrentCount++;
      if (concurrentCount > maxConcurrent) maxConcurrent = concurrentCount;
      await new Promise((r) => setTimeout(r, 10));
      concurrentCount--;
      return { success: true, results: [] };
    };

    mockSearchBrave.mockImplementation(slowMock);

    const calls = Array.from({ length: 6 }, () => ({
      tool: 'brave_search' as const,
      input: { query: 'test' },
    }));

    const results = await executeManyTools(calls, { parallel: true, maxConcurrent: 2 });

    expect(results).toHaveLength(6);
    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });

  it('should return empty array for empty input', async () => {
    const results = await executeManyTools([]);
    expect(results).toEqual([]);
  });

  it('should return empty array for empty input in parallel mode', async () => {
    const results = await executeManyTools([], { parallel: true });
    expect(results).toEqual([]);
  });

  it('should handle mixed success/failure in parallel mode', async () => {
    mockSearchBrave.mockResolvedValue({ success: true, results: [] });
    mockRunCode.mockRejectedValue(new Error('code error'));

    const calls = [
      { tool: 'brave_search' as const, input: { query: 'a' } },
      { tool: 'run_code' as const, input: { code: 'bad', language: 'python' as const } },
    ];

    const results = await executeManyTools(calls, { parallel: true });

    expect(results).toHaveLength(2);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(false);
  });
});

// =============================================================================
// cleanupAllSandboxes
// =============================================================================

describe('cleanupAllSandboxes', () => {
  it('should call both cleanup functions', async () => {
    mockCleanupBrowserSandbox.mockResolvedValue(undefined);
    mockCleanupCodeSandbox.mockResolvedValue(undefined);

    await cleanupAllSandboxes();

    expect(mockCleanupBrowserSandbox).toHaveBeenCalledTimes(1);
    expect(mockCleanupCodeSandbox).toHaveBeenCalledTimes(1);
  });

  it('should propagate errors from cleanup', async () => {
    mockCleanupBrowserSandbox.mockRejectedValue(new Error('browser cleanup error'));
    mockCleanupCodeSandbox.mockResolvedValue(undefined);

    await expect(cleanupAllSandboxes()).rejects.toThrow('browser cleanup error');
  });
});

// =============================================================================
// getClaudeToolDefinitions
// =============================================================================

describe('getClaudeToolDefinitions', () => {
  it('should return an array of tool definitions', () => {
    const tools = getClaudeToolDefinitions();
    expect(Array.isArray(tools)).toBe(true);
    expect(tools.length).toBeGreaterThan(0);
  });

  it('should include all expected tool names', () => {
    const tools = getClaudeToolDefinitions();
    const names = tools.map((t) => t.name);

    const expectedTools = [
      'brave_search',
      'browser_visit',
      'run_code',
      'screenshot',
      'vision_analyze',
      'extract_table',
      'compare_screenshots',
      'safe_form_fill',
      'paginate',
      'infinite_scroll',
      'click_navigate',
      'extract_pdf',
      'generate_comparison',
      'execute_custom_tool',
    ];

    for (const expected of expectedTools) {
      expect(names).toContain(expected);
    }
  });

  it('each definition should have name, description, and input_schema', () => {
    const tools = getClaudeToolDefinitions();

    for (const tool of tools) {
      expect(tool.name).toBeDefined();
      expect(typeof tool.name).toBe('string');
      expect(tool.description).toBeDefined();
      expect(typeof tool.description).toBe('string');
      expect(tool.input_schema).toBeDefined();
      expect(typeof tool.input_schema).toBe('object');
    }
  });

  it('input_schema should have required fields where applicable', () => {
    const tools = getClaudeToolDefinitions();
    const braveSearch = tools.find((t) => t.name === 'brave_search');
    expect(braveSearch).toBeDefined();

    const schema = braveSearch!.input_schema as { required: string[] };
    expect(schema.required).toContain('query');
  });

  it('should include the dynamic tool creation definition from dynamicTools module', () => {
    const tools = getClaudeToolDefinitions();
    const createTool = tools.find((t) => t.name === 'create_custom_tool');
    expect(createTool).toBeDefined();
    expect(mockGetDynamicToolCreationDefinition).toHaveBeenCalled();
  });
});

// =============================================================================
// parseClaudeToolCall
// =============================================================================

describe('parseClaudeToolCall', () => {
  it('should parse valid tool names', () => {
    const result = parseClaudeToolCall('brave_search', { query: 'test' });
    expect(result).not.toBeNull();
    expect(result!.tool).toBe('brave_search');
    expect(result!.input).toEqual({ query: 'test' });
  });

  it('should return null for invalid tool names', () => {
    const result = parseClaudeToolCall('nonexistent_tool', { foo: 'bar' });
    expect(result).toBeNull();
  });

  it('should handle all valid core tool names', () => {
    const validNames = [
      'brave_search',
      'browser_visit',
      'run_code',
      'screenshot',
      'vision_analyze',
      'extract_table',
      'compare_screenshots',
      'safe_form_fill',
      'paginate',
      'infinite_scroll',
      'click_navigate',
      'extract_pdf',
      'generate_comparison',
    ];

    for (const name of validNames) {
      const result = parseClaudeToolCall(name, {});
      expect(result).not.toBeNull();
      expect(result!.tool).toBe(name);
    }
  });

  it('should handle create_custom_tool', () => {
    const result = parseClaudeToolCall('create_custom_tool', {
      purpose: 'test',
      justification: 'needed',
      inputs: [],
      outputType: 'string',
    });
    expect(result).not.toBeNull();
    expect(result!.tool).toBe('create_custom_tool');
  });

  it('should handle execute_custom_tool', () => {
    const result = parseClaudeToolCall('execute_custom_tool', {
      toolId: 'tool-123',
      inputs: {},
    });
    expect(result).not.toBeNull();
    expect(result!.tool).toBe('execute_custom_tool');
  });

  it('should return null for empty string tool name', () => {
    const result = parseClaudeToolCall('', {});
    expect(result).toBeNull();
  });

  it('should pass through all input fields unchanged', () => {
    const input = { query: 'test', count: 5, extra: true };
    const result = parseClaudeToolCall('brave_search', input);
    expect(result!.input).toEqual(input);
  });
});

// =============================================================================
// getAnthropicClient (lazy singleton, tested indirectly)
// =============================================================================

describe('getAnthropicClient (lazy singleton via vision tools)', () => {
  it('should reuse the same Anthropic client across multiple calls', async () => {
    mockAnalyzeScreenshot.mockResolvedValue({ success: true, analysis: 'ok' });
    mockExtractTableFromScreenshot.mockResolvedValue({ success: true, headers: [], rows: [] });

    await executeScoutTool({
      tool: 'vision_analyze',
      input: { url: 'https://a.com', prompt: 'test' },
    });

    await executeScoutTool({
      tool: 'extract_table',
      input: { url: 'https://b.com', tableDescription: 'table' },
    });

    // Both calls should receive the same client instance
    const client1 = mockAnalyzeScreenshot.mock.calls[0][0];
    const client2 = mockExtractTableFromScreenshot.mock.calls[0][0];
    expect(client1).toBe(client2);
  });
});

// =============================================================================
// checkUrlSafety (private, tested indirectly through executeScoutTool)
// =============================================================================

describe('checkUrlSafety — indirect tests', () => {
  it('should call isUrlSafe first, then canVisitPage', async () => {
    const callOrder: string[] = [];
    mockIsUrlSafe.mockImplementation(() => {
      callOrder.push('isUrlSafe');
      return { safe: true };
    });
    mockCanVisitPage.mockImplementation(() => {
      callOrder.push('canVisitPage');
      return { safe: true };
    });
    mockBrowserVisit.mockResolvedValue({ success: true, url: 'https://example.com' });

    await executeScoutTool({
      tool: 'browser_visit',
      input: { url: 'https://example.com' },
    });

    expect(callOrder).toEqual(['isUrlSafe', 'canVisitPage']);
  });

  it('should not call canVisitPage when isUrlSafe fails', async () => {
    mockIsUrlSafe.mockReturnValue({
      safe: false,
      reason: 'blocked',
      category: 'url',
      severity: 'critical',
    });

    await executeScoutTool({
      tool: 'browser_visit',
      input: { url: 'https://bad.com' },
    });

    expect(mockCanVisitPage).not.toHaveBeenCalled();
  });
});

// =============================================================================
// Edge cases
// =============================================================================

describe('executeScoutTool — edge cases', () => {
  it('should return correct timeElapsed even for fast operations', async () => {
    mockSearchBrave.mockResolvedValue({ success: true, results: [] });

    const result = await executeScoutTool({ tool: 'brave_search', input: { query: 'fast' } });

    expect(typeof result.timeElapsed).toBe('number');
    expect(result.timeElapsed).toBeGreaterThanOrEqual(0);
  });

  it('should handle tool that returns success: false from implementation', async () => {
    mockSearchBrave.mockResolvedValue({ success: false, results: [], error: 'No results' });

    const result = await executeScoutTool({ tool: 'brave_search', input: { query: 'nothing' } });

    // The executor does not override the tool's own success flag
    expect(result.success).toBe(false);
    expect(result.costIncurred).toBe(0.005);
  });
});
