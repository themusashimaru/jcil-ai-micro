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

// Mock MCP manager
const mockAddServer = vi.fn();
const mockRemoveServer = vi.fn();
const mockGetClient = vi.fn();

vi.mock('@/lib/mcp/mcp-client', () => ({
  getMCPManager: () => ({
    addServer: (...args: unknown[]) => mockAddServer(...args),
    removeServer: (...args: unknown[]) => mockRemoveServer(...args),
    getClient: (...args: unknown[]) => mockGetClient(...args),
  }),
  MCPServerConfig: {},
}));

// Import after mocks
const { getUserServers, getKnownToolsForServer, ensureServerRunning, DEFAULT_MCP_SERVERS } =
  await import('../mcp/helpers');

describe('DEFAULT_MCP_SERVERS', () => {
  it('includes filesystem server', () => {
    const fs = DEFAULT_MCP_SERVERS.find((s) => s.id === 'filesystem');
    expect(fs).toBeDefined();
    expect(fs!.command).toBe('npx');
    expect(fs!.builtIn).toBe(true);
  });

  it('includes github server', () => {
    const gh = DEFAULT_MCP_SERVERS.find((s) => s.id === 'github');
    expect(gh).toBeDefined();
  });

  it('includes puppeteer server', () => {
    const pp = DEFAULT_MCP_SERVERS.find((s) => s.id === 'puppeteer');
    expect(pp).toBeDefined();
  });

  it('includes postgres server', () => {
    const pg = DEFAULT_MCP_SERVERS.find((s) => s.id === 'postgres');
    expect(pg).toBeDefined();
  });

  it('all servers are disabled by default', () => {
    for (const server of DEFAULT_MCP_SERVERS) {
      expect(server.enabled).toBe(false);
    }
  });
});

describe('getUserServers', () => {
  it('initializes default servers for new user', () => {
    const servers = getUserServers('new-user-1');

    expect(servers.size).toBe(DEFAULT_MCP_SERVERS.length);
    for (const server of DEFAULT_MCP_SERVERS) {
      const state = servers.get(server.id);
      expect(state).toBeDefined();
      expect(state!.enabled).toBe(false);
      expect(state!.status).toBe('stopped');
      expect(state!.tools).toEqual([]);
    }
  });

  it('returns same map for same user on subsequent calls', () => {
    const first = getUserServers('same-user-1');
    const second = getUserServers('same-user-1');
    expect(first).toBe(second);
  });

  it('returns different maps for different users', () => {
    const user1 = getUserServers('user-a');
    const user2 = getUserServers('user-b');
    expect(user1).not.toBe(user2);
  });
});

describe('getKnownToolsForServer', () => {
  it('returns filesystem tools', () => {
    const tools = getKnownToolsForServer('filesystem');
    expect(tools.length).toBeGreaterThan(0);
    expect(tools.find((t) => t.name === 'read_file')).toBeDefined();
    expect(tools.find((t) => t.name === 'write_file')).toBeDefined();
    expect(tools.find((t) => t.name === 'list_directory')).toBeDefined();
    tools.forEach((t) => expect(t.serverId).toBe('filesystem'));
  });

  it('returns github tools', () => {
    const tools = getKnownToolsForServer('github');
    expect(tools.length).toBeGreaterThan(0);
    expect(tools.find((t) => t.name === 'create_issue')).toBeDefined();
    expect(tools.find((t) => t.name === 'create_pull_request')).toBeDefined();
  });

  it('returns puppeteer tools', () => {
    const tools = getKnownToolsForServer('puppeteer');
    expect(tools.length).toBeGreaterThan(0);
    expect(tools.find((t) => t.name === 'puppeteer_navigate')).toBeDefined();
  });

  it('returns postgres tools', () => {
    const tools = getKnownToolsForServer('postgres');
    expect(tools.length).toBeGreaterThan(0);
    expect(tools.find((t) => t.name === 'query')).toBeDefined();
  });

  it('returns empty array for unknown server', () => {
    const tools = getKnownToolsForServer('nonexistent');
    expect(tools).toEqual([]);
  });
});

describe('ensureServerRunning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetClient.mockReturnValue(null);
  });

  it('returns error when server is not enabled', async () => {
    const result = await ensureServerRunning('filesystem', 'user-ensure-1');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Server not enabled');
  });

  it('returns existing tools when server is already connected', async () => {
    // Enable the server first
    const servers = getUserServers('user-ensure-2');
    servers.set('filesystem', {
      enabled: true,
      status: 'running',
      tools: [],
    });

    mockGetClient.mockReturnValue({
      isConnected: () => true,
      tools: [{ name: 'read_file', description: 'Read a file', inputSchema: {} }],
    });

    const result = await ensureServerRunning('filesystem', 'user-ensure-2');

    expect(result.success).toBe(true);
    expect(result.tools).toHaveLength(1);
    expect(result.tools[0].name).toBe('read_file');
    expect(mockAddServer).not.toHaveBeenCalled();
  });

  it('starts server on-demand when enabled but not running', async () => {
    const servers = getUserServers('user-ensure-3');
    servers.set('filesystem', {
      enabled: true,
      status: 'available',
      tools: [],
    });

    mockGetClient.mockReturnValue(null);
    mockAddServer.mockResolvedValue({
      tools: [
        { name: 'read_file', description: 'Read a file', inputSchema: {} },
        { name: 'write_file', description: 'Write a file', inputSchema: {} },
      ],
    });

    const result = await ensureServerRunning('filesystem', 'user-ensure-3');

    expect(result.success).toBe(true);
    expect(result.tools).toHaveLength(2);
    expect(mockAddServer).toHaveBeenCalled();

    // Verify state updated to running
    const updated = servers.get('filesystem');
    expect(updated?.status).toBe('running');
  });

  it('handles server start failure', async () => {
    const servers = getUserServers('user-ensure-4');
    servers.set('filesystem', {
      enabled: true,
      status: 'available',
      tools: [],
    });

    mockGetClient.mockReturnValue(null);
    mockAddServer.mockRejectedValue(new Error('Connection refused'));

    const result = await ensureServerRunning('filesystem', 'user-ensure-4');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Connection refused');

    // Verify state updated to error
    const updated = servers.get('filesystem');
    expect(updated?.status).toBe('error');
  });

  it('returns error for unknown server config', async () => {
    const servers = getUserServers('user-ensure-5');
    servers.set('custom_server', {
      enabled: true,
      status: 'available',
      tools: [],
    });

    mockGetClient.mockReturnValue(null);

    const result = await ensureServerRunning('custom_server', 'user-ensure-5');

    expect(result.success).toBe(false);
    expect(result.error).toBe('Server config not found');
  });
});
