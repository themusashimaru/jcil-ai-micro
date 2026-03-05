/**
 * CHAT MCP API TESTS
 *
 * Tests for /api/chat/mcp endpoint:
 * - GET: List MCP servers
 * - POST: Start/stop servers, call tools, list tools, get status
 * - Auth requirements
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ============================================================================
// MOCKS
// ============================================================================

vi.mock('@/lib/auth/user-guard', () => ({
  requireUser: vi.fn().mockResolvedValue({
    authorized: true,
    user: { id: 'test-user-id', email: 'test@example.com' },
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

const mockGetClient = vi.fn().mockReturnValue(null);
const mockRemoveServer = vi.fn().mockResolvedValue(undefined);
const mockCallTool = vi.fn().mockResolvedValue('tool result');
const mockGetHealthStatus = vi.fn().mockResolvedValue({ healthy: true });

vi.mock('@/lib/mcp/mcp-client', () => ({
  getMCPManager: vi.fn(() => ({
    getClient: mockGetClient,
    removeServer: mockRemoveServer,
    callTool: mockCallTool,
    getHealthStatus: mockGetHealthStatus,
  })),
}));

const mockGetUserServers = vi.fn().mockReturnValue(new Map());
const mockGetKnownToolsForServer = vi
  .fn()
  .mockReturnValue([{ name: 'test-tool', description: 'A test tool', serverId: 'test-server' }]);
const mockDefaultServers = [
  { id: 'test-server', name: 'Test Server', description: 'A test MCP server' },
  { id: 'another-server', name: 'Another Server', description: 'Another MCP server' },
];

vi.mock('./helpers', () => ({
  getUserServers: mockGetUserServers,
  getKnownToolsForServer: mockGetKnownToolsForServer,
  DEFAULT_MCP_SERVERS: mockDefaultServers,
}));

// ============================================================================
// HELPERS
// ============================================================================

function createRequest(url: string): NextRequest {
  return new NextRequest(url);
}

function createPostRequest(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

// ============================================================================
// TESTS
// ============================================================================

describe('Chat MCP API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUserServers.mockReturnValue(new Map());
  });

  describe('GET /api/chat/mcp', () => {
    it('should export GET handler', async () => {
      const routeModule = await import('./route');
      expect(routeModule.GET).toBeDefined();
    });

    it('should reject unauthenticated requests', async () => {
      const { requireUser } = await import('@/lib/auth/user-guard');
      vi.mocked(requireUser).mockResolvedValueOnce({
        authorized: false,
        response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
      } as never);

      const { GET } = await import('./route');
      const response = await GET();
      expect(response.status).toBe(401);
    });

    it('should return server list', async () => {
      const { GET } = await import('./route');
      const response = await GET();
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.servers).toBeDefined();
      expect(body.servers.length).toBe(2);
    });

    it('should merge user server state with defaults', async () => {
      const userMap = new Map();
      userMap.set('test-server', { enabled: true, status: 'running', tools: [{ name: 'tool1' }] });
      mockGetUserServers.mockReturnValue(userMap);

      const { GET } = await import('./route');
      const response = await GET();
      const body = await response.json();
      expect(body.servers[0].enabled).toBe(true);
      expect(body.servers[0].status).toBe('running');
    });
  });

  describe('POST /api/chat/mcp', () => {
    it('should export POST handler', async () => {
      const routeModule = await import('./route');
      expect(routeModule.POST).toBeDefined();
    });

    it('should reject unauthenticated requests', async () => {
      const { requireUser } = await import('@/lib/auth/user-guard');
      vi.mocked(requireUser).mockResolvedValueOnce({
        authorized: false,
        response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
      } as never);

      const { POST } = await import('./route');
      const response = await POST(
        createPostRequest('http://localhost/api/chat/mcp', {
          action: 'startServer',
          serverId: 'test',
        })
      );
      expect(response.status).toBe(401);
    });

    it('should require action field', async () => {
      const { POST } = await import('./route');
      const response = await POST(createPostRequest('http://localhost/api/chat/mcp', {}));
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.error).toContain('Action is required');
    });

    it('should reject unknown actions', async () => {
      const { POST } = await import('./route');
      const response = await POST(
        createPostRequest('http://localhost/api/chat/mcp', { action: 'unknownAction' })
      );
      expect(response.status).toBe(400);
    });

    describe('startServer action', () => {
      it('should require serverId', async () => {
        const { POST } = await import('./route');
        const response = await POST(
          createPostRequest('http://localhost/api/chat/mcp', { action: 'startServer' })
        );
        expect(response.status).toBe(400);
      });

      it('should reject unknown server IDs', async () => {
        const { POST } = await import('./route');
        const response = await POST(
          createPostRequest('http://localhost/api/chat/mcp', {
            action: 'startServer',
            serverId: 'nonexistent-server',
          })
        );
        expect(response.status).toBe(404);
      });

      it('should mark server as available (on-demand)', async () => {
        const userMap = new Map();
        mockGetUserServers.mockReturnValue(userMap);

        const { POST } = await import('./route');
        const response = await POST(
          createPostRequest('http://localhost/api/chat/mcp', {
            action: 'startServer',
            serverId: 'test-server',
          })
        );
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.status).toBe('available');
        expect(body.onDemand).toBe(true);
      });

      it('should return running status if already connected', async () => {
        const userMap = new Map();
        mockGetUserServers.mockReturnValue(userMap);
        mockGetClient.mockReturnValueOnce({
          isConnected: () => true,
          tools: [{ name: 'tool1', description: 'Test tool' }],
        });

        const { POST } = await import('./route');
        const response = await POST(
          createPostRequest('http://localhost/api/chat/mcp', {
            action: 'startServer',
            serverId: 'test-server',
          })
        );
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.status).toBe('running');
      });
    });

    describe('stopServer action', () => {
      it('should require serverId', async () => {
        const { POST } = await import('./route');
        const response = await POST(
          createPostRequest('http://localhost/api/chat/mcp', { action: 'stopServer' })
        );
        expect(response.status).toBe(400);
      });

      it('should stop server successfully', async () => {
        const userMap = new Map();
        mockGetUserServers.mockReturnValue(userMap);

        const { POST } = await import('./route');
        const response = await POST(
          createPostRequest('http://localhost/api/chat/mcp', {
            action: 'stopServer',
            serverId: 'test-server',
          })
        );
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.status).toBe('stopped');
        expect(mockRemoveServer).toHaveBeenCalledWith('test-server');
      });
    });

    describe('callTool action', () => {
      it('should require serverId and toolName', async () => {
        const { POST } = await import('./route');
        const response = await POST(
          createPostRequest('http://localhost/api/chat/mcp', { action: 'callTool' })
        );
        expect(response.status).toBe(400);
      });

      it('should reject if server not running', async () => {
        const userMap = new Map();
        userMap.set('test-server', { enabled: true, status: 'available', tools: [] });
        mockGetUserServers.mockReturnValue(userMap);

        const { POST } = await import('./route');
        const response = await POST(
          createPostRequest('http://localhost/api/chat/mcp', {
            action: 'callTool',
            serverId: 'test-server',
            toolName: 'test-tool',
          })
        );
        expect(response.status).toBe(400);
      });

      it('should call tool successfully', async () => {
        const userMap = new Map();
        userMap.set('test-server', { enabled: true, status: 'running', tools: [] });
        mockGetUserServers.mockReturnValue(userMap);

        const { POST } = await import('./route');
        const response = await POST(
          createPostRequest('http://localhost/api/chat/mcp', {
            action: 'callTool',
            serverId: 'test-server',
            toolName: 'test-tool',
            toolArgs: { param: 'value' },
          })
        );
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.result).toBeDefined();
      });
    });

    describe('healthCheck action', () => {
      it('should return health status', async () => {
        const { POST } = await import('./route');
        const response = await POST(
          createPostRequest('http://localhost/api/chat/mcp', { action: 'healthCheck' })
        );
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.health).toBeDefined();
      });
    });
  });
});
