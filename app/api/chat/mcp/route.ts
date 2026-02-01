/**
 * CHAT MCP API ROUTE
 *
 * Handles MCP (Model Context Protocol) server operations for the main Chat.
 * Allows users to enable/disable MCP servers that extend AI capabilities.
 *
 * GET  /api/chat/mcp - List all MCP servers and their status
 * POST /api/chat/mcp - Start/stop MCP servers, call tools
 *
 * NOW USING REAL MCP CLIENT (Enhancement #1)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/user-guard';
import { logger } from '@/lib/logger';
import { getMCPManager, MCPServerConfig } from '@/lib/mcp/mcp-client';

const log = logger('chat-mcp-api');

// Default MCP servers available in Chat
const DEFAULT_MCP_SERVERS = [
  {
    id: 'filesystem',
    name: 'Filesystem',
    description: 'Read, write, and navigate files in the workspace',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '/workspace'],
    enabled: false,
    builtIn: true,
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'Manage repositories, issues, and pull requests',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    enabled: false,
    builtIn: true,
  },
  {
    id: 'memory',
    name: 'Memory',
    description: 'Persistent key-value storage across conversations',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory'],
    enabled: false,
    builtIn: true,
  },
  {
    id: 'puppeteer',
    name: 'Puppeteer',
    description: 'Browser automation for web testing and scraping',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-puppeteer'],
    enabled: false,
    builtIn: true,
  },
  {
    id: 'postgres',
    name: 'PostgreSQL',
    description: 'Query and manage PostgreSQL databases',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-postgres'],
    enabled: false,
    builtIn: true,
  },
];

// In-memory server state (per user)
// In production, this should be stored in database
const userServerState = new Map<
  string,
  Map<
    string,
    {
      enabled: boolean;
      status: 'running' | 'stopped' | 'error' | 'starting';
      tools: Array<{ name: string; description: string; serverId: string }>;
      error?: string;
    }
  >
>();

function getUserServers(userId: string) {
  if (!userServerState.has(userId)) {
    const serverMap = new Map<string, {
      enabled: boolean;
      status: 'running' | 'stopped' | 'error' | 'starting';
      tools: Array<{ name: string; description: string; serverId: string }>;
      error?: string;
    }>();

    // Initialize with default servers
    for (const server of DEFAULT_MCP_SERVERS) {
      serverMap.set(server.id, {
        enabled: false,
        status: 'stopped',
        tools: [],
      });
    }
    userServerState.set(userId, serverMap);
  }
  return userServerState.get(userId)!;
}

/**
 * GET /api/chat/mcp
 * Returns list of MCP servers with their current status
 */
export async function GET() {
  try {
    const auth = await requireUser();
    if (!auth.authorized) {
      return auth.response;
    }

    const userServers = getUserServers(auth.user.id);

    // Combine default servers with user state
    const servers = DEFAULT_MCP_SERVERS.map((server) => {
      const state = userServers.get(server.id) || {
        enabled: false,
        status: 'stopped' as const,
        tools: [],
      };

      return {
        ...server,
        ...state,
      };
    });

    return NextResponse.json({ servers });
  } catch (error) {
    log.error('Failed to get MCP servers', { error: (error as Error).message });
    return NextResponse.json({ error: 'Failed to get servers' }, { status: 500 });
  }
}

/**
 * POST /api/chat/mcp
 * Handle MCP server operations
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (!auth.authorized) {
      return auth.response;
    }

    const body = await request.json();
    const { action, serverId, toolName, toolArgs } = body;

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    const userServers = getUserServers(auth.user.id);

    switch (action) {
      case 'startServer': {
        if (!serverId) {
          return NextResponse.json({ error: 'Server ID is required' }, { status: 400 });
        }

        const server = DEFAULT_MCP_SERVERS.find((s) => s.id === serverId);
        if (!server) {
          return NextResponse.json({ error: 'Server not found' }, { status: 404 });
        }

        // Update state to starting
        userServers.set(serverId, {
          enabled: true,
          status: 'starting',
          tools: [],
        });

        // Use REAL MCP Client Manager (Enhancement #1)
        const manager = getMCPManager();

        try {
          // Check if server already exists in manager
          const existingClient = manager.getClient(serverId);
          if (existingClient && existingClient.isConnected()) {
            // Already running, get tools
            const tools = existingClient.tools.map(t => ({
              name: t.name,
              description: t.description || '',
              serverId: serverId
            }));

            userServers.set(serverId, {
              enabled: true,
              status: 'running',
              tools,
            });

            return NextResponse.json({
              status: 'running',
              serverId,
              message: `${server.name} already running`,
              tools,
            });
          }

          // Create real MCP server config
          const config: MCPServerConfig = {
            id: serverId,
            name: server.name,
            description: server.description,
            command: server.command,
            args: server.args,
            enabled: true,
            timeout: 30000,
          };

          // Start the real MCP server (async)
          manager.addServer(config).then((client) => {
            const tools = client.tools.map(t => ({
              name: t.name,
              description: t.description || '',
              serverId: serverId
            }));

            userServers.set(serverId, {
              enabled: true,
              status: 'running',
              tools,
            });

            log.info('MCP server started successfully', { serverId, toolCount: tools.length });
          }).catch((error) => {
            log.error('Failed to start MCP server', { serverId, error: (error as Error).message });
            userServers.set(serverId, {
              enabled: false,
              status: 'error',
              tools: [],
              error: (error as Error).message,
            });
          });

          // Return immediately with starting status
          return NextResponse.json({
            status: 'starting',
            serverId,
            message: `Starting ${server.name}...`,
          });
        } catch (error) {
          log.error('Failed to initialize MCP server', { serverId, error: (error as Error).message });
          userServers.set(serverId, {
            enabled: false,
            status: 'error',
            tools: [],
            error: (error as Error).message,
          });
          return NextResponse.json({ error: `Failed to start: ${(error as Error).message}` }, { status: 500 });
        }
      }

      case 'stopServer': {
        if (!serverId) {
          return NextResponse.json({ error: 'Server ID is required' }, { status: 400 });
        }

        // Use REAL MCP Client Manager (Enhancement #1)
        const manager = getMCPManager();
        try {
          await manager.removeServer(serverId);
          log.info('MCP server stopped', { serverId });
        } catch (error) {
          log.warn('Error stopping MCP server (may not have been running)', {
            serverId,
            error: (error as Error).message
          });
        }

        userServers.set(serverId, {
          enabled: false,
          status: 'stopped',
          tools: [],
        });

        return NextResponse.json({
          status: 'stopped',
          serverId,
          message: 'Server stopped',
        });
      }

      case 'callTool': {
        if (!serverId || !toolName) {
          return NextResponse.json({ error: 'Server ID and tool name required' }, { status: 400 });
        }

        const serverState = userServers.get(serverId);
        if (!serverState || serverState.status !== 'running') {
          return NextResponse.json({ error: 'Server not running' }, { status: 400 });
        }

        // Use REAL MCP Client Manager (Enhancement #1)
        const manager = getMCPManager();
        try {
          const result = await manager.callTool(serverId, toolName, toolArgs || {});
          log.info('MCP tool called successfully', { serverId, toolName });

          return NextResponse.json({
            result: { content: result },
            toolName,
            serverId,
          });
        } catch (error) {
          log.error('MCP tool call failed', { serverId, toolName, error: (error as Error).message });
          return NextResponse.json({
            error: `Tool execution failed: ${(error as Error).message}`,
            toolName,
            serverId,
          }, { status: 500 });
        }
      }

      case 'listTools': {
        if (!serverId) {
          return NextResponse.json({ error: 'Server ID is required' }, { status: 400 });
        }

        // Use REAL MCP Client Manager (Enhancement #1)
        const manager = getMCPManager();
        const client = manager.getClient(serverId);

        if (!client || !client.isConnected()) {
          // Fall back to cached state if server not connected
          const serverState = userServers.get(serverId);
          if (!serverState) {
            return NextResponse.json({ error: 'Server not found' }, { status: 404 });
          }
          return NextResponse.json({
            tools: serverState.tools,
            serverId,
            source: 'cache',
          });
        }

        // Get real tools from the MCP client
        const tools = client.tools.map(t => ({
          name: t.name,
          description: t.description || '',
          serverId: serverId,
          inputSchema: t.inputSchema,
        }));

        return NextResponse.json({
          tools,
          serverId,
          source: 'live',
        });
      }

      case 'getStatus': {
        // New action: Get real-time status of all or specific servers
        const manager = getMCPManager();

        if (serverId) {
          const client = manager.getClient(serverId);
          const serverState = userServers.get(serverId);

          return NextResponse.json({
            serverId,
            connected: client?.isConnected() || false,
            status: client?.getStatus() || serverState?.status || 'stopped',
            tools: client?.tools.length || serverState?.tools.length || 0,
          });
        }

        // Return status of all servers
        const statuses = [];
        for (const server of DEFAULT_MCP_SERVERS) {
          const client = manager.getClient(server.id);
          const serverState = userServers.get(server.id);

          statuses.push({
            serverId: server.id,
            name: server.name,
            connected: client?.isConnected() || false,
            status: client?.getStatus() || serverState?.status || 'stopped',
            tools: client?.tools.length || serverState?.tools.length || 0,
          });
        }

        return NextResponse.json({ statuses });
      }

      case 'healthCheck': {
        // New action: Run health check on servers
        const manager = getMCPManager();
        const healthResults = await manager.getHealthStatus();

        return NextResponse.json({ health: healthResults });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    log.error('MCP operation failed', { error: (error as Error).message });
    return NextResponse.json({ error: 'Operation failed' }, { status: 500 });
  }
}

// Mock functions removed - now using REAL MCP Client (Enhancement #1)
// The getMCPManager() singleton from @/lib/mcp/mcp-client handles all operations
