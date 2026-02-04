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
 *
 * ON-DEMAND ARCHITECTURE (Enhancement #2):
 * - Toggling ON marks server as "available" (doesn't start process)
 * - Server actually starts on first tool call (lazy start)
 * - Auto-stops after 1 minute of inactivity (idle timeout)
 * - Saves resources by not running unused servers
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/user-guard';
import { logger } from '@/lib/logger';
import { getMCPManager, MCPServerConfig } from '@/lib/mcp/mcp-client';

const log = logger('chat-mcp-api');

// Idle timeout: auto-stop servers after 1 minute of no tool calls
const IDLE_TIMEOUT_MS = 60 * 1000; // 1 minute

// Track last activity time per server for idle timeout
const serverLastActivity = new Map<string, number>();
const idleTimeoutHandles = new Map<string, NodeJS.Timeout>();

/**
 * Reset the idle timeout for a server
 * Called whenever a tool is executed on that server
 */
function resetIdleTimeout(serverId: string, userId: string) {
  serverLastActivity.set(serverId, Date.now());

  // Clear existing timeout
  const existingTimeout = idleTimeoutHandles.get(serverId);
  if (existingTimeout) {
    clearTimeout(existingTimeout);
  }

  // Set new timeout to auto-stop server
  const timeoutHandle = setTimeout(async () => {
    log.info('MCP server idle timeout - auto-stopping', { serverId, idleMs: IDLE_TIMEOUT_MS });

    const manager = getMCPManager();
    try {
      await manager.removeServer(serverId);
      log.info('MCP server auto-stopped due to inactivity', { serverId });
    } catch (error) {
      log.warn('Failed to auto-stop idle MCP server', { serverId, error: (error as Error).message });
    }

    // Update user state to show server as available (not running)
    const userServers = getUserServers(userId);
    const currentState = userServers.get(serverId);
    if (currentState?.enabled) {
      userServers.set(serverId, {
        enabled: true,
        status: 'available',
        tools: currentState.tools || [],
      });
    }

    idleTimeoutHandles.delete(serverId);
    serverLastActivity.delete(serverId);
  }, IDLE_TIMEOUT_MS);

  idleTimeoutHandles.set(serverId, timeoutHandle);
}

/**
 * Ensure an MCP server is running (start on-demand if needed)
 * Returns the tools available from the server
 */
export async function ensureServerRunning(
  serverId: string,
  userId: string
): Promise<{ success: boolean; tools: Array<{ name: string; description: string; inputSchema?: unknown }>; error?: string }> {
  const manager = getMCPManager();
  const userServers = getUserServers(userId);
  const serverState = userServers.get(serverId);

  // Check if server is enabled
  if (!serverState?.enabled) {
    return { success: false, tools: [], error: 'Server not enabled' };
  }

  // Check if already running
  const existingClient = manager.getClient(serverId);
  if (existingClient && existingClient.isConnected()) {
    // Reset idle timeout on activity
    resetIdleTimeout(serverId, userId);
    return {
      success: true,
      tools: existingClient.tools.map(t => ({
        name: t.name,
        description: t.description || '',
        inputSchema: t.inputSchema,
      })),
    };
  }

  // Need to start the server (on-demand)
  const server = DEFAULT_MCP_SERVERS.find((s) => s.id === serverId);
  if (!server) {
    return { success: false, tools: [], error: 'Server config not found' };
  }

  log.info('Starting MCP server on-demand', { serverId });

  try {
    const config: MCPServerConfig = {
      id: serverId,
      name: server.name,
      description: server.description,
      command: server.command,
      args: server.args,
      enabled: true,
      timeout: 30000,
    };

    const client = await manager.addServer(config);
    const tools = client.tools.map(t => ({
      name: t.name,
      description: t.description || '',
      inputSchema: t.inputSchema,
    }));

    // Update state to running
    userServers.set(serverId, {
      enabled: true,
      status: 'running',
      tools: tools.map(t => ({ ...t, serverId })),
    });

    // Start idle timeout
    resetIdleTimeout(serverId, userId);

    log.info('MCP server started on-demand successfully', { serverId, toolCount: tools.length });

    return { success: true, tools };
  } catch (error) {
    log.error('Failed to start MCP server on-demand', { serverId, error: (error as Error).message });
    userServers.set(serverId, {
      enabled: true,
      status: 'error',
      tools: [],
      error: (error as Error).message,
    });
    return { success: false, tools: [], error: (error as Error).message };
  }
}

/**
 * Get known tools for a server type (for pre-populating before server starts)
 * These are the standard tools each MCP server provides
 */
export function getKnownToolsForServer(serverId: string): Array<{ name: string; description: string; serverId: string }> {
  const knownTools: Record<string, Array<{ name: string; description: string }>> = {
    filesystem: [
      { name: 'read_file', description: 'Read the contents of a file' },
      { name: 'write_file', description: 'Write content to a file' },
      { name: 'list_directory', description: 'List files and directories' },
      { name: 'create_directory', description: 'Create a new directory' },
      { name: 'move_file', description: 'Move or rename a file' },
      { name: 'search_files', description: 'Search for files matching a pattern' },
      { name: 'get_file_info', description: 'Get metadata about a file' },
    ],
    github: [
      { name: 'search_repositories', description: 'Search for GitHub repositories' },
      { name: 'get_file_contents', description: 'Get contents of a file from a repo' },
      { name: 'create_or_update_file', description: 'Create or update a file in a repo' },
      { name: 'push_files', description: 'Push multiple files to a repo' },
      { name: 'create_issue', description: 'Create a new issue' },
      { name: 'create_pull_request', description: 'Create a new pull request' },
      { name: 'fork_repository', description: 'Fork a repository' },
      { name: 'create_branch', description: 'Create a new branch' },
    ],
    memory: [
      { name: 'store', description: 'Store a value with a key' },
      { name: 'retrieve', description: 'Retrieve a value by key' },
      { name: 'delete', description: 'Delete a stored value' },
      { name: 'list', description: 'List all stored keys' },
    ],
    puppeteer: [
      { name: 'puppeteer_navigate', description: 'Navigate to a URL' },
      { name: 'puppeteer_screenshot', description: 'Take a screenshot of the page' },
      { name: 'puppeteer_click', description: 'Click an element on the page' },
      { name: 'puppeteer_fill', description: 'Fill in a form field' },
      { name: 'puppeteer_evaluate', description: 'Execute JavaScript in the page' },
      { name: 'puppeteer_select', description: 'Select an option from a dropdown' },
      { name: 'puppeteer_hover', description: 'Hover over an element' },
    ],
    postgres: [
      { name: 'query', description: 'Execute a SQL query' },
      { name: 'list_tables', description: 'List all tables in the database' },
      { name: 'describe_table', description: 'Get schema information for a table' },
    ],
  };

  const tools = knownTools[serverId] || [];
  return tools.map(t => ({ ...t, serverId }));
}

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

// Server status types:
// - 'stopped': Server is disabled
// - 'available': Server is enabled but not running (will start on-demand)
// - 'starting': Server is in the process of starting
// - 'running': Server process is active
// - 'error': Server failed to start
type MCPServerStatus = 'running' | 'stopped' | 'error' | 'starting' | 'available';

// In-memory server state (per user)
// In production, this should be stored in database
const userServerState = new Map<
  string,
  Map<
    string,
    {
      enabled: boolean;
      status: MCPServerStatus;
      tools: Array<{ name: string; description: string; serverId: string }>;
      error?: string;
    }
  >
>();

// Export for use by chat route
export function getUserServers(userId: string) {
  if (!userServerState.has(userId)) {
    const serverMap = new Map<string, {
      enabled: boolean;
      status: MCPServerStatus;
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
        // ON-DEMAND/LAZY START (Enhancement #2)
        // Just mark the server as "available" - it will actually start
        // when Claude first tries to use one of its tools
        if (!serverId) {
          return NextResponse.json({ error: 'Server ID is required' }, { status: 400 });
        }

        const server = DEFAULT_MCP_SERVERS.find((s) => s.id === serverId);
        if (!server) {
          return NextResponse.json({ error: 'Server not found' }, { status: 404 });
        }

        // Check if already running
        const manager = getMCPManager();
        const existingClient = manager.getClient(serverId);
        if (existingClient && existingClient.isConnected()) {
          // Already running, just return current state
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
            message: `${server.name} is running`,
            tools,
          });
        }

        // Mark as available (will start on-demand when tool is called)
        // Pre-populate with known tools for this server type
        const knownTools = getKnownToolsForServer(serverId);

        userServers.set(serverId, {
          enabled: true,
          status: 'available',
          tools: knownTools,
        });

        log.info('MCP server marked as available (on-demand)', { serverId });

        return NextResponse.json({
          status: 'available',
          serverId,
          message: `${server.name} enabled - will start automatically when needed`,
          tools: knownTools,
          onDemand: true,
        });
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
