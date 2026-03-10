import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Mock tool registry
const mockCanExecuteTool = vi.fn().mockReturnValue({ allowed: true });
const mockRecordToolCost = vi.fn();
const mockShouldRunQC = vi.fn().mockReturnValue(false);
const mockVerifyOutput = vi.fn();
const mockIsNativeServerTool = vi.fn().mockReturnValue(false);

vi.mock('@/lib/ai/tools', () => ({
  canExecuteTool: (...args: unknown[]) => mockCanExecuteTool(...args),
  recordToolCost: (...args: unknown[]) => mockRecordToolCost(...args),
  shouldRunQC: (...args: unknown[]) => mockShouldRunQC(...args),
  verifyOutput: (...args: unknown[]) => mockVerifyOutput(...args),
  isNativeServerTool: (...args: unknown[]) => mockIsNativeServerTool(...args),
}));

// Mock tool loader
const mockLoadAvailableToolDefinitions = vi.fn().mockResolvedValue([
  {
    name: 'web_search',
    description: 'Search the web',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'run_code',
    description: 'Run code',
    parameters: { type: 'object', properties: {}, required: [] },
  },
]);
const mockExecuteToolByName = vi.fn();
const mockHasToolLoader = vi.fn().mockReturnValue(true);

vi.mock('@/lib/ai/tools/tool-loader', () => ({
  loadAvailableToolDefinitions: () => mockLoadAvailableToolDefinitions(),
  executeToolByName: (...args: unknown[]) => mockExecuteToolByName(...args),
  hasToolLoader: (...args: unknown[]) => mockHasToolLoader(...args),
}));

// Mock MCP
const mockGetAllTools = vi.fn().mockReturnValue([]);
const mockGetClient = vi.fn().mockReturnValue(null);
const mockCallTool = vi.fn();
vi.mock('@/lib/mcp/mcp-client', () => ({
  getMCPManager: () => ({
    getAllTools: () => mockGetAllTools(),
    getClient: (...args: unknown[]) => mockGetClient(...args),
    callTool: (...args: unknown[]) => mockCallTool(...args),
  }),
  MCPClientManager: vi.fn(),
}));

// Mock Composio
const mockGetComposioToolsForUser = vi
  .fn()
  .mockResolvedValue({ tools: [], connectedApps: [], hasGitHub: false });
const mockExecuteComposioTool = vi.fn();
const mockIsComposioTool = vi.fn().mockReturnValue(false);
const mockIsComposioConfigured = vi.fn().mockReturnValue(false);

vi.mock('@/lib/composio', () => ({
  getComposioToolsForUser: (...args: unknown[]) => mockGetComposioToolsForUser(...args),
  executeComposioTool: (...args: unknown[]) => mockExecuteComposioTool(...args),
  isComposioTool: (...args: unknown[]) => mockIsComposioTool(...args),
  isComposioConfigured: () => mockIsComposioConfigured(),
}));

// Mock MCP helpers
vi.mock('@/app/api/chat/mcp/helpers', () => ({
  ensureServerRunning: vi.fn().mockResolvedValue({ success: true, tools: [] }),
  getUserServers: vi.fn().mockReturnValue(new Map()),
  getKnownToolsForServer: vi.fn().mockReturnValue([]),
}));

// Mock rate limiting
const mockCheckResearchRateLimit = vi.fn().mockResolvedValue({ allowed: true });
const mockCheckToolRateLimit = vi.fn().mockResolvedValue({ allowed: true });
vi.mock('@/app/api/chat/rate-limiting', () => ({
  checkResearchRateLimit: (...args: unknown[]) => mockCheckResearchRateLimit(...args),
  checkToolRateLimit: (...args: unknown[]) => mockCheckToolRateLimit(...args),
}));

// Mock helpers
vi.mock('@/app/api/chat/helpers', () => ({
  sanitizeToolError: (tool: string, error: string) => `Error in ${tool}: ${error}`,
}));

// Import after mocks
const { loadAllTools, createToolExecutor } = await import('../chat-tools');

describe('loadAllTools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAllTools.mockReturnValue([]);
    mockIsComposioConfigured.mockReturnValue(false);
  });

  it('loads built-in tools from registry', async () => {
    const result = await loadAllTools(null);

    expect(mockLoadAvailableToolDefinitions).toHaveBeenCalled();
    expect(result.tools.length).toBeGreaterThanOrEqual(2);
    expect(result.tools.map((t) => t.name)).toContain('web_search');
    expect(result.tools.map((t) => t.name)).toContain('run_code');
  });

  it('includes MCP tools from running servers', async () => {
    mockGetAllTools.mockReturnValue([
      {
        serverId: 'filesystem',
        name: 'read_file',
        description: 'Read a file',
        inputSchema: { properties: {}, required: [] },
      },
    ]);

    const result = await loadAllTools('user-123');

    expect(result.mcpToolNames).toContain('mcp_filesystem_read_file');
    expect(result.tools.find((t) => t.name === 'mcp_filesystem_read_file')).toBeDefined();
  });

  it('returns empty MCP tools when no servers running', async () => {
    mockGetAllTools.mockReturnValue([]);

    const result = await loadAllTools('user-123');

    expect(result.mcpToolNames).toHaveLength(0);
  });

  it('loads Composio tools when configured', async () => {
    mockIsComposioConfigured.mockReturnValue(true);
    mockGetComposioToolsForUser.mockResolvedValue({
      tools: [
        {
          name: 'GITHUB_STAR_REPO',
          description: 'Star a repository',
          input_schema: { properties: {}, required: [] },
        },
      ],
      connectedApps: ['github'],
      hasGitHub: true,
    });

    const result = await loadAllTools('user-123');

    expect(result.composioToolContext).not.toBeNull();
    expect(result.tools.find((t) => t.name === 'GITHUB_STAR_REPO')).toBeDefined();
  });

  it('skips Composio when not configured', async () => {
    mockIsComposioConfigured.mockReturnValue(false);

    const result = await loadAllTools('user-123');

    expect(result.composioToolContext).toBeNull();
    expect(mockGetComposioToolsForUser).not.toHaveBeenCalled();
  });

  it('handles Composio load failure gracefully', async () => {
    mockIsComposioConfigured.mockReturnValue(true);
    mockGetComposioToolsForUser.mockRejectedValue(new Error('Composio API down'));

    const result = await loadAllTools('user-123');

    expect(result.composioToolContext).toBeNull();
    // Should not throw
  });

  it('skips Composio when userId is null', async () => {
    mockIsComposioConfigured.mockReturnValue(true);

    const result = await loadAllTools(null);

    expect(result.composioToolContext).toBeNull();
    expect(mockGetComposioToolsForUser).not.toHaveBeenCalled();
  });
});

describe('createToolExecutor', () => {
  let executor: ReturnType<typeof createToolExecutor>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCanExecuteTool.mockReturnValue({ allowed: true });
    mockCheckResearchRateLimit.mockResolvedValue({ allowed: true });
    mockCheckToolRateLimit.mockResolvedValue({ allowed: true });
    mockIsNativeServerTool.mockReturnValue(false);
    mockHasToolLoader.mockReturnValue(true);
    mockShouldRunQC.mockReturnValue(false);
    executor = createToolExecutor('user-123', 'session-456');
  });

  it('executes a built-in tool successfully', async () => {
    mockExecuteToolByName.mockResolvedValue({
      toolCallId: 'call-1',
      content: 'Result data',
      isError: false,
    });

    const result = await executor({
      id: 'call-1',
      name: 'run_code',
      arguments: '{"code": "print(1)"}',
    });

    expect(result.isError).toBe(false);
    expect(result.content).toBe('Result data');
    expect(mockRecordToolCost).toHaveBeenCalled();
  });

  it('blocks execution when cost limit exceeded', async () => {
    mockCanExecuteTool.mockReturnValue({ allowed: false, reason: 'Session cost limit exceeded' });

    const result = await executor({
      id: 'call-1',
      name: 'run_code',
      arguments: '{}',
    });

    expect(result.isError).toBe(true);
    expect(result.content).toContain('Session cost limit exceeded');
    expect(mockExecuteToolByName).not.toHaveBeenCalled();
  });

  it('blocks search tools when research rate limit exceeded', async () => {
    mockCheckResearchRateLimit.mockResolvedValue({ allowed: false });

    const result = await executor({
      id: 'call-1',
      name: 'web_search',
      arguments: '{"query": "test"}',
    });

    expect(result.isError).toBe(true);
    expect(result.content).toContain('Search rate limit exceeded');
  });

  it('applies research rate limit to fetch_url', async () => {
    mockCheckResearchRateLimit.mockResolvedValue({ allowed: false });

    const result = await executor({
      id: 'call-1',
      name: 'fetch_url',
      arguments: '{"url": "https://example.com"}',
    });

    expect(result.isError).toBe(true);
    expect(result.content).toContain('Search rate limit exceeded');
  });

  it('blocks when per-tool rate limit exceeded', async () => {
    mockCheckToolRateLimit.mockResolvedValue({ allowed: false, limit: 10 });

    const result = await executor({
      id: 'call-1',
      name: 'run_code',
      arguments: '{}',
    });

    expect(result.isError).toBe(true);
    expect(result.content).toContain('Rate limit exceeded for run_code');
  });

  it('skips native server tools (web_search handled by Anthropic)', async () => {
    mockIsNativeServerTool.mockReturnValue(true);

    const result = await executor({
      id: 'call-1',
      name: 'web_search',
      arguments: '{"query": "test"}',
    });

    expect(result.isError).toBe(false);
    expect(result.content).toBe('Handled by server');
    expect(mockExecuteToolByName).not.toHaveBeenCalled();
  });

  it('returns error for unknown tools', async () => {
    mockHasToolLoader.mockReturnValue(false);
    mockIsComposioTool.mockReturnValue(false);

    const result = await executor({
      id: 'call-1',
      name: 'nonexistent_tool',
      arguments: '{}',
    });

    expect(result.isError).toBe(true);
    expect(result.content).toContain('Unknown tool: nonexistent_tool');
  });

  it('catches and sanitizes tool execution errors', async () => {
    mockExecuteToolByName.mockRejectedValue(new Error('Sandbox crashed'));

    const result = await executor({
      id: 'call-1',
      name: 'run_code',
      arguments: '{}',
    });

    expect(result.isError).toBe(true);
    expect(result.content).toContain('Sandbox crashed');
  });

  it('does not record cost for failed tool executions', async () => {
    mockExecuteToolByName.mockResolvedValue({
      toolCallId: 'call-1',
      content: 'Error occurred',
      isError: true,
    });

    await executor({
      id: 'call-1',
      name: 'run_code',
      arguments: '{}',
    });

    expect(mockRecordToolCost).not.toHaveBeenCalled();
  });

  it('runs quality control for high-value tools', async () => {
    mockShouldRunQC.mockReturnValue(true);
    mockVerifyOutput.mockResolvedValue({ passed: true, issues: [] });
    mockExecuteToolByName.mockResolvedValue({
      toolCallId: 'call-1',
      content: 'Analysis result',
      isError: false,
    });

    const result = await executor({
      id: 'call-1',
      name: 'analyze_code',
      arguments: '{"code": "const x = 1"}',
    });

    expect(result.isError).toBe(false);
    expect(mockVerifyOutput).toHaveBeenCalled();
  });

  it('appends QC warning when quality check fails', async () => {
    mockShouldRunQC.mockReturnValue(true);
    mockVerifyOutput.mockResolvedValue({
      passed: false,
      issues: ['Output lacks detail'],
    });
    mockExecuteToolByName.mockResolvedValue({
      toolCallId: 'call-1',
      content: 'Analysis result',
      isError: false,
    });

    const result = await executor({
      id: 'call-1',
      name: 'analyze_code',
      arguments: '{"code": "const x = 1"}',
    });

    expect(result.content).toContain('Quality check');
    expect(result.content).toContain('Output lacks detail');
  });

  it('handles QC check errors gracefully', async () => {
    mockShouldRunQC.mockReturnValue(true);
    mockVerifyOutput.mockRejectedValue(new Error('QC service down'));
    mockExecuteToolByName.mockResolvedValue({
      toolCallId: 'call-1',
      content: 'Analysis result',
      isError: false,
    });

    const result = await executor({
      id: 'call-1',
      name: 'analyze_code',
      arguments: '{"code": "const x = 1"}',
    });

    // Should still return the original result, not crash
    expect(result.isError).toBe(false);
    expect(result.content).toBe('Analysis result');
  });

  it('uses default cost estimate for unknown tool names', async () => {
    mockHasToolLoader.mockReturnValue(true);
    mockExecuteToolByName.mockResolvedValue({
      toolCallId: 'call-1',
      content: 'ok',
      isError: false,
    });

    await executor({
      id: 'call-1',
      name: 'some_custom_tool',
      arguments: '{}',
    });

    // Should use default 0.01 cost
    expect(mockCanExecuteTool).toHaveBeenCalledWith('session-456', 'some_custom_tool', 0.01);
  });

  it('uses specific cost estimate for known tools', async () => {
    mockExecuteToolByName.mockResolvedValue({
      toolCallId: 'call-1',
      content: 'ok',
      isError: false,
    });

    await executor({
      id: 'call-1',
      name: 'run_code',
      arguments: '{}',
    });

    expect(mockCanExecuteTool).toHaveBeenCalledWith('session-456', 'run_code', 0.02);
  });
});
