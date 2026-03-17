/**
 * Tests for chat-tools.ts
 *
 * Covers: selectToolTiers, loadAllTools, createToolExecutor
 * including MCP tool dispatch, Composio tool dispatch, rate limiting,
 * cost control, QC checks, and error handling.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

const mockCanExecuteTool = vi.fn().mockReturnValue({ allowed: true });
const mockRecordToolCost = vi.fn();
const mockShouldRunQC = vi.fn().mockReturnValue(false);
const mockVerifyOutput = vi.fn().mockResolvedValue({ passed: true, issues: [] });
const mockIsNativeServerTool = vi.fn().mockReturnValue(false);

vi.mock('@/lib/ai/tools', () => ({
  canExecuteTool: (...args: unknown[]) => mockCanExecuteTool(...args),
  recordToolCost: (...args: unknown[]) => mockRecordToolCost(...args),
  shouldRunQC: (...args: unknown[]) => mockShouldRunQC(...args),
  verifyOutput: (...args: unknown[]) => mockVerifyOutput(...args),
  isNativeServerTool: (...args: unknown[]) => mockIsNativeServerTool(...args),
}));

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
const mockExecuteToolByName = vi.fn().mockResolvedValue({
  toolCallId: 'call-1',
  content: 'tool result',
  isError: false,
});
const mockHasToolLoader = vi.fn().mockReturnValue(false);

vi.mock('@/lib/ai/tools/tool-loader', () => ({
  loadAvailableToolDefinitions: (...args: unknown[]) => mockLoadAvailableToolDefinitions(...args),
  executeToolByName: (...args: unknown[]) => mockExecuteToolByName(...args),
  hasToolLoader: (...args: unknown[]) => mockHasToolLoader(...args),
}));

const mockGetAllTools = vi.fn().mockReturnValue([]);
const mockCallTool = vi.fn();
const mockMCPManager = {
  getAllTools: mockGetAllTools,
  callTool: mockCallTool,
};

vi.mock('@/lib/mcp/mcp-client', () => ({
  getMCPManager: () => mockMCPManager,
  MCPClientManager: vi.fn(),
}));

const mockGetComposioToolsForUser = vi.fn().mockResolvedValue({
  tools: [],
  connectedApps: [],
  hasGitHub: false,
});
const mockExecuteComposioTool = vi.fn();
const mockIsComposioTool = vi.fn().mockReturnValue(false);
const mockIsComposioConfigured = vi.fn().mockReturnValue(false);

vi.mock('@/lib/composio', () => ({
  getComposioToolsForUser: (...args: unknown[]) => mockGetComposioToolsForUser(...args),
  executeComposioTool: (...args: unknown[]) => mockExecuteComposioTool(...args),
  isComposioTool: (...args: unknown[]) => mockIsComposioTool(...args),
  isComposioConfigured: () => mockIsComposioConfigured(),
}));

const mockEnsureServerRunning = vi.fn().mockResolvedValue({ success: true, tools: [] });
const mockGetMCPUserServers = vi.fn().mockReturnValue(new Map());
const mockGetKnownToolsForServer = vi.fn().mockReturnValue([]);

vi.mock('@/app/api/chat/mcp/helpers', () => ({
  ensureServerRunning: (...args: unknown[]) => mockEnsureServerRunning(...args),
  getUserServers: (...args: unknown[]) => mockGetMCPUserServers(...args),
  getKnownToolsForServer: (...args: unknown[]) => mockGetKnownToolsForServer(...args),
}));

const mockCheckResearchRateLimit = vi.fn().mockResolvedValue({ allowed: true });
const mockCheckToolRateLimit = vi.fn().mockResolvedValue({ allowed: true });

vi.mock('./rate-limiting', () => ({
  checkResearchRateLimit: (...args: unknown[]) => mockCheckResearchRateLimit(...args),
  checkToolRateLimit: (...args: unknown[]) => mockCheckToolRateLimit(...args),
}));

vi.mock('./helpers', () => ({
  sanitizeToolError: (_tool: string, msg: string) => `Sanitized: ${msg}`,
}));

// ── Import after mocks ────────────────────────────────────────────────────

import { selectToolTiers, loadAllTools, createToolExecutor } from './chat-tools';

// ── Tests ──────────────────────────────────────────────────────────────────

describe('selectToolTiers', () => {
  it('returns all tiers for plain messages', () => {
    expect(selectToolTiers('Hello, how are you?')).toEqual(['core', 'extended', 'specialist']);
  });

  it('adds specialist tier for DNA keyword', () => {
    const tiers = selectToolTiers('Can you analyze this DNA sequence?');
    expect(tiers).toContain('specialist');
  });

  it('adds specialist tier for protein keyword', () => {
    expect(selectToolTiers('protein folding analysis')).toContain('specialist');
  });

  it('adds specialist tier for genome keyword', () => {
    expect(selectToolTiers('map this genome')).toContain('specialist');
  });

  it('adds specialist tier for FFT/signal keyword', () => {
    expect(selectToolTiers('apply fft to the signal')).toContain('specialist');
  });

  it('adds specialist tier for geospatial keyword', () => {
    expect(selectToolTiers('geospatial data processing')).toContain('specialist');
  });

  it('adds specialist tier for latitude keyword', () => {
    expect(selectToolTiers('what is the latitude of Tokyo?')).toContain('specialist');
  });

  it('adds specialist tier for medical/BMI keyword', () => {
    expect(selectToolTiers('calculate my bmi')).toContain('specialist');
  });

  it('adds specialist tier for QR code keyword', () => {
    expect(selectToolTiers('generate a qr code')).toContain('specialist');
  });

  it('adds specialist tier for encrypt/decrypt keyword', () => {
    expect(selectToolTiers('encrypt this message')).toContain('specialist');
  });

  it('adds specialist tier for accessibility/WCAG keyword', () => {
    expect(selectToolTiers('check wcag compliance')).toContain('specialist');
  });

  it('adds specialist tier for NLP/sentiment keyword', () => {
    expect(selectToolTiers('run sentiment analysis')).toContain('specialist');
  });

  it('adds specialist tier for barcode keyword', () => {
    expect(selectToolTiers('generate a barcode')).toContain('specialist');
  });

  it('adds specialist tier for zip/compress keyword', () => {
    expect(selectToolTiers('compress these files into a zip')).toContain('specialist');
  });

  it('adds specialist tier for fake data keyword', () => {
    expect(selectToolTiers('generate fake data for testing')).toContain('specialist');
  });

  it('is case insensitive', () => {
    expect(selectToolTiers('DNA SEQUENCE')).toContain('specialist');
    expect(selectToolTiers('Encrypt')).toContain('specialist');
  });

  it('returns all tiers even for unrelated messages', () => {
    const tiers = selectToolTiers('Write me a poem about cats');
    expect(tiers).toEqual(['core', 'extended', 'specialist']);
  });

  it('always includes core and extended even when specialist is added', () => {
    const tiers = selectToolTiers('analyze dna');
    expect(tiers).toContain('core');
    expect(tiers).toContain('extended');
    expect(tiers).toContain('specialist');
  });
});

describe('loadAllTools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAllTools.mockReturnValue([]);
    mockGetMCPUserServers.mockReturnValue(new Map());
    mockIsComposioConfigured.mockReturnValue(false);
    mockLoadAvailableToolDefinitions.mockResolvedValue([
      {
        name: 'web_search',
        description: 'Search',
        parameters: { type: 'object', properties: {}, required: [] },
      },
    ]);
  });

  it('loads built-in tools from the registry', async () => {
    const result = await loadAllTools('user-1', 'hello');
    expect(mockLoadAvailableToolDefinitions).toHaveBeenCalled();
    expect(result.tools.length).toBeGreaterThanOrEqual(1);
    expect(result.tools[0].name).toBe('web_search');
  });

  it('passes tiers from selectToolTiers when messageContext is provided', async () => {
    await loadAllTools('user-1', 'analyze this dna');
    const calledTiers = mockLoadAvailableToolDefinitions.mock.calls[0][0];
    expect(calledTiers).toContain('specialist');
  });

  it('passes undefined tiers when messageContext is omitted', async () => {
    await loadAllTools('user-1');
    expect(mockLoadAvailableToolDefinitions).toHaveBeenCalledWith(undefined);
  });

  it('adds MCP tools from running servers', async () => {
    mockGetAllTools.mockReturnValue([
      {
        serverId: 'myserver',
        name: 'my_tool',
        description: 'A tool from MCP',
        inputSchema: { properties: { arg: { type: 'string' } }, required: ['arg'] },
      },
    ]);

    const result = await loadAllTools('user-1', 'hello');
    expect(result.mcpToolNames).toContain('mcp_myserver_my_tool');
    const mcpTool = result.tools.find((t) => t.name === 'mcp_myserver_my_tool');
    expect(mcpTool).toBeDefined();
    expect(mcpTool!.description).toContain('[MCP: myserver]');
  });

  it('adds MCP tools from available (not-yet-started) servers for authenticated users', async () => {
    const serverMap = new Map();
    serverMap.set('lazy-server', { enabled: true, status: 'available' });
    mockGetMCPUserServers.mockReturnValue(serverMap);
    mockGetKnownToolsForServer.mockReturnValue([
      { name: 'lazy_tool', description: 'Lazy loaded tool' },
    ]);

    const result = await loadAllTools('user-1', 'hello');
    expect(result.mcpToolNames).toContain('mcp_lazy-server_lazy_tool');
  });

  it('does not load MCP user servers when userId is null', async () => {
    const serverMap = new Map();
    serverMap.set('lazy-server', { enabled: true, status: 'available' });
    mockGetMCPUserServers.mockReturnValue(serverMap);

    await loadAllTools(null, 'hello');
    expect(mockGetMCPUserServers).not.toHaveBeenCalled();
  });

  it('does not duplicate MCP tools already loaded from running servers', async () => {
    mockGetAllTools.mockReturnValue([
      {
        serverId: 'srv',
        name: 'tool_a',
        description: 'A',
        inputSchema: { properties: {}, required: [] },
      },
    ]);
    const serverMap = new Map();
    serverMap.set('srv', { enabled: true, status: 'available' });
    mockGetMCPUserServers.mockReturnValue(serverMap);
    mockGetKnownToolsForServer.mockReturnValue([{ name: 'tool_a', description: 'A' }]);

    const result = await loadAllTools('user-1', 'hello');
    const count = result.mcpToolNames.filter((n) => n === 'mcp_srv_tool_a').length;
    expect(count).toBe(1);
  });

  it('loads Composio tools when configured and userId provided', async () => {
    mockIsComposioConfigured.mockReturnValue(true);
    mockGetComposioToolsForUser.mockResolvedValue({
      tools: [
        {
          name: 'composio_github_create_issue',
          description: 'Create a GitHub issue',
          input_schema: { properties: { title: { type: 'string' } }, required: ['title'] },
        },
      ],
      connectedApps: ['github'],
      hasGitHub: true,
    });

    const result = await loadAllTools('user-1', 'hello');
    expect(result.composioToolContext).not.toBeNull();
    const composioTool = result.tools.find((t) => t.name === 'composio_github_create_issue');
    expect(composioTool).toBeDefined();
  });

  it('does not load Composio tools when userId is null', async () => {
    mockIsComposioConfigured.mockReturnValue(true);
    const result = await loadAllTools(null, 'hello');
    expect(mockGetComposioToolsForUser).not.toHaveBeenCalled();
    expect(result.composioToolContext).toBeNull();
  });

  it('handles Composio load errors gracefully', async () => {
    mockIsComposioConfigured.mockReturnValue(true);
    mockGetComposioToolsForUser.mockRejectedValue(new Error('Composio down'));

    const result = await loadAllTools('user-1', 'hello');
    // Should not throw, composioToolContext stays null
    expect(result.composioToolContext).toBeNull();
  });

  it('handles MCP tools with missing inputSchema properties', async () => {
    mockGetAllTools.mockReturnValue([
      { serverId: 'srv', name: 'bare_tool', description: '', inputSchema: {} },
    ]);

    const result = await loadAllTools('user-1', 'hello');
    const tool = result.tools.find((t) => t.name === 'mcp_srv_bare_tool');
    expect(tool).toBeDefined();
    expect(tool!.parameters.properties).toEqual({});
    expect(tool!.parameters.required).toEqual([]);
  });
});

describe('createToolExecutor', () => {
  const userId = 'user-123';
  const sessionId = 'session-abc';

  beforeEach(() => {
    vi.clearAllMocks();
    mockCanExecuteTool.mockReturnValue({ allowed: true });
    mockCheckResearchRateLimit.mockResolvedValue({ allowed: true });
    mockCheckToolRateLimit.mockResolvedValue({ allowed: true });
    mockIsNativeServerTool.mockReturnValue(false);
    mockHasToolLoader.mockReturnValue(false);
    mockIsComposioTool.mockReturnValue(false);
    mockShouldRunQC.mockReturnValue(false);
  });

  const makeToolCall = (name: string, args: Record<string, unknown> = {}) => ({
    id: 'call-1',
    name,
    arguments: args,
  });

  // ── Cost limit checks ──

  it('blocks execution when cost limit exceeded', async () => {
    mockCanExecuteTool.mockReturnValue({ allowed: false, reason: 'Session budget exceeded' });

    const executor = createToolExecutor(userId, sessionId);
    const result = await executor(makeToolCall('run_code'));

    expect(result.isError).toBe(true);
    expect(result.content).toContain('Session budget exceeded');
  });

  it('passes correct cost estimate for known tools', async () => {
    mockHasToolLoader.mockReturnValue(true);
    mockExecuteToolByName.mockResolvedValue({
      toolCallId: 'call-1',
      content: 'ok',
      isError: false,
    });

    const executor = createToolExecutor(userId, sessionId);
    await executor(makeToolCall('run_code'));

    // run_code cost = 0.02
    expect(mockCanExecuteTool).toHaveBeenCalledWith(sessionId, 'run_code', 0.02);
  });

  it('uses default cost for unknown tools', async () => {
    const executor = createToolExecutor(userId, sessionId);
    await executor(makeToolCall('completely_unknown_tool'));

    // default cost = 0.01
    expect(mockCanExecuteTool).toHaveBeenCalledWith(sessionId, 'completely_unknown_tool', 0.01);
  });

  // ── Research rate limiting ──

  it('checks research rate limit for web_search', async () => {
    const executor = createToolExecutor(userId, sessionId);
    await executor(makeToolCall('web_search'));
    expect(mockCheckResearchRateLimit).toHaveBeenCalledWith(userId);
  });

  it('checks research rate limit for browser_visit', async () => {
    const executor = createToolExecutor(userId, sessionId);
    await executor(makeToolCall('browser_visit'));
    expect(mockCheckResearchRateLimit).toHaveBeenCalledWith(userId);
  });

  it('checks research rate limit for fetch_url', async () => {
    const executor = createToolExecutor(userId, sessionId);
    await executor(makeToolCall('fetch_url'));
    expect(mockCheckResearchRateLimit).toHaveBeenCalledWith(userId);
  });

  it('blocks when research rate limit exceeded', async () => {
    mockCheckResearchRateLimit.mockResolvedValue({ allowed: false });

    const executor = createToolExecutor(userId, sessionId);
    const result = await executor(makeToolCall('fetch_url'));

    expect(result.isError).toBe(true);
    expect(result.content).toContain('Search rate limit exceeded');
  });

  it('does not check research rate limit for non-search tools', async () => {
    mockHasToolLoader.mockReturnValue(true);
    mockExecuteToolByName.mockResolvedValue({
      toolCallId: 'call-1',
      content: 'ok',
      isError: false,
    });

    const executor = createToolExecutor(userId, sessionId);
    await executor(makeToolCall('run_code'));
    expect(mockCheckResearchRateLimit).not.toHaveBeenCalled();
  });

  // ── Per-tool rate limiting ──

  it('blocks when per-tool rate limit exceeded', async () => {
    mockCheckToolRateLimit.mockResolvedValue({ allowed: false, limit: 10 });

    const executor = createToolExecutor(userId, sessionId);
    const result = await executor(makeToolCall('run_code'));

    expect(result.isError).toBe(true);
    expect(result.content).toContain('Rate limit exceeded for run_code');
  });

  // ── Native server tools ──

  it('skips native server tools', async () => {
    mockIsNativeServerTool.mockReturnValue(true);

    const executor = createToolExecutor(userId, sessionId);
    const result = await executor(makeToolCall('web_search'));

    expect(result.isError).toBe(false);
    expect(result.content).toBe('Handled by server');
    expect(mockHasToolLoader).not.toHaveBeenCalled();
  });

  // ── Built-in tool execution ──

  it('executes built-in tools via tool loader', async () => {
    mockHasToolLoader.mockReturnValue(true);
    mockExecuteToolByName.mockResolvedValue({
      toolCallId: 'call-1',
      content: 'Code executed successfully',
      isError: false,
    });

    const executor = createToolExecutor(userId, sessionId);
    const result = await executor(makeToolCall('run_code', { code: 'console.log(1)' }));

    expect(result.content).toBe('Code executed successfully');
    expect(result.isError).toBe(false);
    expect(mockExecuteToolByName).toHaveBeenCalled();
  });

  it('injects sessionId into tool call for built-in tools', async () => {
    mockHasToolLoader.mockReturnValue(true);
    mockExecuteToolByName.mockResolvedValue({
      toolCallId: 'call-1',
      content: 'ok',
      isError: false,
    });

    const executor = createToolExecutor(userId, sessionId);
    await executor(makeToolCall('run_code'));

    const passedCall = mockExecuteToolByName.mock.calls[0][0];
    expect(passedCall.sessionId).toBe(sessionId);
  });

  it('returns default error when tool loader returns null', async () => {
    mockHasToolLoader.mockReturnValue(true);
    mockExecuteToolByName.mockResolvedValue(null);

    const executor = createToolExecutor(userId, sessionId);
    const result = await executor(makeToolCall('run_code'));

    expect(result.isError).toBe(true);
    expect(result.content).toContain('Tool not executed');
  });

  // ── MCP tool execution ──

  it('routes mcp_ prefixed tools to MCP handler', async () => {
    mockCallTool.mockResolvedValue('MCP result text');
    mockEnsureServerRunning.mockResolvedValue({ success: true, tools: ['tool_a'] });

    const executor = createToolExecutor(userId, sessionId);
    const result = await executor(makeToolCall('mcp_myserver_tool_a', { query: 'test' }));

    expect(result.isError).toBe(false);
    expect(result.content).toBe('MCP result text');
    expect(mockCallTool).toHaveBeenCalledWith('myserver', 'tool_a', { query: 'test' });
  });

  it('handles MCP tool with object result (JSON stringified)', async () => {
    mockCallTool.mockResolvedValue({ data: [1, 2, 3] });
    mockEnsureServerRunning.mockResolvedValue({ success: true, tools: [] });

    const executor = createToolExecutor(userId, sessionId);
    const result = await executor(makeToolCall('mcp_srv_get_data'));

    expect(result.isError).toBe(false);
    expect(JSON.parse(result.content)).toEqual({ data: [1, 2, 3] });
  });

  it('handles MCP tool with string arguments (JSON parse)', async () => {
    mockCallTool.mockResolvedValue('ok');
    mockEnsureServerRunning.mockResolvedValue({ success: true, tools: [] });

    const executor = createToolExecutor(userId, sessionId);
    const result = await executor({
      id: 'call-1',
      name: 'mcp_srv_my_tool',
      arguments: '{"key":"value"}',
    });

    expect(result.isError).toBe(false);
    expect(mockCallTool).toHaveBeenCalledWith('srv', 'my_tool', { key: 'value' });
  });

  it('returns error for invalid MCP tool name format (too few parts)', async () => {
    const executor = createToolExecutor(userId, sessionId);
    const result = await executor(makeToolCall('mcp_short'));

    expect(result.isError).toBe(true);
    expect(result.content).toContain('Invalid MCP tool name format');
  });

  it('returns error when MCP server fails to start', async () => {
    mockEnsureServerRunning.mockResolvedValue({ success: false, error: 'Timeout', tools: [] });

    const executor = createToolExecutor(userId, sessionId);
    const result = await executor(makeToolCall('mcp_badserver_tool'));

    expect(result.isError).toBe(true);
    expect(result.content).toContain('Failed to start MCP server');
  });

  it('returns error for invalid JSON arguments in MCP tool', async () => {
    mockEnsureServerRunning.mockResolvedValue({ success: true, tools: [] });

    const executor = createToolExecutor(userId, sessionId);
    const result = await executor({
      id: 'call-1',
      name: 'mcp_srv_my_tool',
      arguments: '{invalid json}',
    });

    expect(result.isError).toBe(true);
    expect(result.content).toContain('Invalid JSON arguments');
  });

  it('handles MCP tool execution errors', async () => {
    mockEnsureServerRunning.mockResolvedValue({ success: true, tools: [] });
    mockCallTool.mockRejectedValue(new Error('MCP connection lost'));

    const executor = createToolExecutor(userId, sessionId);
    const result = await executor(makeToolCall('mcp_srv_tool'));

    expect(result.isError).toBe(true);
    expect(result.content).toContain('Sanitized: MCP connection lost');
  });

  // ── Composio tool execution ──

  it('routes Composio tools correctly', async () => {
    mockIsComposioTool.mockReturnValue(true);
    mockExecuteComposioTool.mockResolvedValue({ success: true, result: 'Issue created' });

    const executor = createToolExecutor(userId, sessionId);
    const result = await executor(makeToolCall('composio_github_create_issue', { title: 'Bug' }));

    expect(result.isError).toBe(false);
    expect(result.content).toBe('Issue created');
    expect(mockExecuteComposioTool).toHaveBeenCalledWith(userId, 'composio_github_create_issue', {
      title: 'Bug',
    });
  });

  it('handles Composio tool with object result', async () => {
    mockIsComposioTool.mockReturnValue(true);
    mockExecuteComposioTool.mockResolvedValue({ success: true, result: { id: 42 } });

    const executor = createToolExecutor(userId, sessionId);
    const result = await executor(makeToolCall('composio_tool'));

    expect(JSON.parse(result.content)).toEqual({ id: 42 });
  });

  it('handles Composio tool failure result', async () => {
    mockIsComposioTool.mockReturnValue(true);
    mockExecuteComposioTool.mockResolvedValue({ success: false, error: 'Auth expired' });

    const executor = createToolExecutor(userId, sessionId);
    const result = await executor(makeToolCall('composio_tool'));

    expect(result.isError).toBe(true);
    expect(result.content).toContain('Sanitized: Auth expired');
  });

  it('handles Composio tool with string arguments', async () => {
    mockIsComposioTool.mockReturnValue(true);
    mockExecuteComposioTool.mockResolvedValue({ success: true, result: 'ok' });

    const executor = createToolExecutor(userId, sessionId);
    await executor({
      id: 'call-1',
      name: 'composio_tool',
      arguments: '{"foo":"bar"}',
    });

    expect(mockExecuteComposioTool).toHaveBeenCalledWith(userId, 'composio_tool', { foo: 'bar' });
  });

  it('returns error for invalid JSON in Composio tool arguments', async () => {
    mockIsComposioTool.mockReturnValue(true);

    const executor = createToolExecutor(userId, sessionId);
    const result = await executor({
      id: 'call-1',
      name: 'composio_tool',
      arguments: 'not json',
    });

    expect(result.isError).toBe(true);
    expect(result.content).toContain('Invalid JSON arguments');
  });

  it('handles Composio execution exception', async () => {
    mockIsComposioTool.mockReturnValue(true);
    mockExecuteComposioTool.mockRejectedValue(new Error('Network error'));

    const executor = createToolExecutor(userId, sessionId);
    const result = await executor(makeToolCall('composio_tool'));

    expect(result.isError).toBe(true);
    expect(result.content).toContain('Sanitized: Network error');
  });

  // ── Unknown tools ──

  it('returns error for completely unknown tools', async () => {
    const executor = createToolExecutor(userId, sessionId);
    const result = await executor(makeToolCall('nonexistent_tool'));

    expect(result.isError).toBe(true);
    expect(result.content).toContain('Unknown tool: nonexistent_tool');
  });

  // ── Cost recording ──

  it('records cost after successful execution', async () => {
    mockHasToolLoader.mockReturnValue(true);
    mockExecuteToolByName.mockResolvedValue({
      toolCallId: 'call-1',
      content: 'ok',
      isError: false,
    });

    const executor = createToolExecutor(userId, sessionId);
    await executor(makeToolCall('run_code'));

    expect(mockRecordToolCost).toHaveBeenCalledWith(sessionId, 'run_code', 0.02);
  });

  it('does not record cost after failed execution', async () => {
    mockHasToolLoader.mockReturnValue(true);
    mockExecuteToolByName.mockResolvedValue({
      toolCallId: 'call-1',
      content: 'error',
      isError: true,
    });

    const executor = createToolExecutor(userId, sessionId);
    await executor(makeToolCall('run_code'));

    expect(mockRecordToolCost).not.toHaveBeenCalled();
  });

  // ── QC checks ──

  it('runs QC check on successful high-value tool execution', async () => {
    mockHasToolLoader.mockReturnValue(true);
    mockExecuteToolByName.mockResolvedValue({
      toolCallId: 'call-1',
      content: 'generated code',
      isError: false,
    });
    mockShouldRunQC.mockReturnValue(true);
    mockVerifyOutput.mockResolvedValue({ passed: true, issues: [] });

    const executor = createToolExecutor(userId, sessionId);
    const result = await executor(makeToolCall('generate_code', { prompt: 'hello world' }));

    expect(mockVerifyOutput).toHaveBeenCalledWith(
      'generate_code',
      expect.any(String),
      'generated code'
    );
    expect(result.content).toBe('generated code');
  });

  it('appends QC warning when QC check fails', async () => {
    mockHasToolLoader.mockReturnValue(true);
    mockExecuteToolByName.mockResolvedValue({
      toolCallId: 'call-1',
      content: 'output',
      isError: false,
    });
    mockShouldRunQC.mockReturnValue(true);
    mockVerifyOutput.mockResolvedValue({
      passed: false,
      issues: ['Missing error handling', 'No types'],
    });

    const executor = createToolExecutor(userId, sessionId);
    const result = await executor(makeToolCall('generate_code'));

    expect(result.content).toContain('Quality check');
    expect(result.content).toContain('Missing error handling');
    expect(result.content).toContain('No types');
  });

  it('handles QC check errors gracefully', async () => {
    mockHasToolLoader.mockReturnValue(true);
    mockExecuteToolByName.mockResolvedValue({
      toolCallId: 'call-1',
      content: 'output',
      isError: false,
    });
    mockShouldRunQC.mockReturnValue(true);
    mockVerifyOutput.mockRejectedValue(new Error('QC service down'));

    const executor = createToolExecutor(userId, sessionId);
    const result = await executor(makeToolCall('generate_code'));

    // Should not throw, content should remain unchanged
    expect(result.content).toBe('output');
    expect(result.isError).toBe(false);
  });

  it('does not run QC on failed executions', async () => {
    mockHasToolLoader.mockReturnValue(true);
    mockExecuteToolByName.mockResolvedValue({
      toolCallId: 'call-1',
      content: 'err',
      isError: true,
    });
    mockShouldRunQC.mockReturnValue(true);

    const executor = createToolExecutor(userId, sessionId);
    await executor(makeToolCall('generate_code'));

    expect(mockVerifyOutput).not.toHaveBeenCalled();
  });

  // ── Error handling (unhandled exceptions) ──

  it('catches unhandled exceptions during tool execution', async () => {
    mockHasToolLoader.mockReturnValue(true);
    mockExecuteToolByName.mockRejectedValue(new Error('Unexpected crash'));

    const executor = createToolExecutor(userId, sessionId);
    const result = await executor(makeToolCall('run_code'));

    expect(result.isError).toBe(true);
    expect(result.content).toContain('Sanitized: Unexpected crash');
  });

  it('handles non-Error throws during tool execution', async () => {
    mockHasToolLoader.mockReturnValue(true);
    mockExecuteToolByName.mockRejectedValue('string error');

    const executor = createToolExecutor(userId, sessionId);
    const result = await executor(makeToolCall('run_code'));

    expect(result.isError).toBe(true);
    expect(result.content).toContain('Sanitized: string error');
  });

  // ── MCP tool name parsing ──

  it('correctly parses MCP tool name with multiple underscores', async () => {
    mockCallTool.mockResolvedValue('ok');
    mockEnsureServerRunning.mockResolvedValue({ success: true, tools: [] });

    const executor = createToolExecutor(userId, sessionId);
    await executor(makeToolCall('mcp_myserver_my_complex_tool'));

    // serverId = 'myserver', actualToolName = 'my_complex_tool'
    expect(mockCallTool).toHaveBeenCalledWith('myserver', 'my_complex_tool', {});
  });

  // ── Rate limit ordering ──

  it('checks cost limit before research rate limit', async () => {
    mockCanExecuteTool.mockReturnValue({ allowed: false, reason: 'Over budget' });

    const executor = createToolExecutor(userId, sessionId);
    await executor(makeToolCall('web_search'));

    // Cost check failed first, so research rate limit should not be called
    expect(mockCheckResearchRateLimit).not.toHaveBeenCalled();
  });

  it('checks research rate limit before per-tool rate limit for search tools', async () => {
    mockCheckResearchRateLimit.mockResolvedValue({ allowed: false });

    const executor = createToolExecutor(userId, sessionId);
    await executor(makeToolCall('web_search'));

    // Research limit failed, per-tool limit should not be called
    expect(mockCheckToolRateLimit).not.toHaveBeenCalled();
  });
});
