/**
 * CHAT MCP API ROUTE
 *
 * Handles MCP (Model Context Protocol) server operations for the main Chat.
 * Allows users to enable/disable MCP servers that extend AI capabilities.
 *
 * GET  /api/chat/mcp - List all MCP servers and their status
 * POST /api/chat/mcp - Start/stop MCP servers, call tools
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/user-guard';
import { logger } from '@/lib/logger';

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

        // Simulate server startup and tool discovery
        // In production, this would actually start the MCP server
        setTimeout(() => {
          const tools = getMockToolsForServer(serverId);
          userServers.set(serverId, {
            enabled: true,
            status: 'running',
            tools,
          });
        }, 1000);

        // Return immediately with starting status
        return NextResponse.json({
          status: 'starting',
          serverId,
          message: `Starting ${server.name}...`,
        });
      }

      case 'stopServer': {
        if (!serverId) {
          return NextResponse.json({ error: 'Server ID is required' }, { status: 400 });
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

        // Execute tool (mock implementation)
        // In production, this would call the actual MCP server
        const result = await executeMockTool(serverId, toolName, toolArgs || {});

        return NextResponse.json({
          result,
          toolName,
          serverId,
        });
      }

      case 'listTools': {
        if (!serverId) {
          return NextResponse.json({ error: 'Server ID is required' }, { status: 400 });
        }

        const serverState = userServers.get(serverId);
        if (!serverState) {
          return NextResponse.json({ error: 'Server not found' }, { status: 404 });
        }

        return NextResponse.json({
          tools: serverState.tools,
          serverId,
        });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    log.error('MCP operation failed', { error: (error as Error).message });
    return NextResponse.json({ error: 'Operation failed' }, { status: 500 });
  }
}

/**
 * Get mock tools for a server (for demo purposes)
 * In production, these would be discovered from the actual MCP server
 */
function getMockToolsForServer(serverId: string) {
  const toolsByServer: Record<string, Array<{ name: string; description: string; serverId: string }>> = {
    filesystem: [
      { name: 'read_file', description: 'Read contents of a file', serverId: 'filesystem' },
      { name: 'write_file', description: 'Write contents to a file', serverId: 'filesystem' },
      { name: 'list_directory', description: 'List files in a directory', serverId: 'filesystem' },
      { name: 'create_directory', description: 'Create a new directory', serverId: 'filesystem' },
      { name: 'delete_file', description: 'Delete a file', serverId: 'filesystem' },
      { name: 'move_file', description: 'Move or rename a file', serverId: 'filesystem' },
    ],
    github: [
      { name: 'list_repos', description: 'List your GitHub repositories', serverId: 'github' },
      { name: 'create_issue', description: 'Create a new issue', serverId: 'github' },
      { name: 'list_issues', description: 'List issues in a repository', serverId: 'github' },
      { name: 'create_pr', description: 'Create a pull request', serverId: 'github' },
      { name: 'list_prs', description: 'List pull requests', serverId: 'github' },
      { name: 'get_file_contents', description: 'Get file from repository', serverId: 'github' },
    ],
    memory: [
      { name: 'store', description: 'Store a value with a key', serverId: 'memory' },
      { name: 'retrieve', description: 'Retrieve a stored value', serverId: 'memory' },
      { name: 'list_keys', description: 'List all stored keys', serverId: 'memory' },
      { name: 'delete', description: 'Delete a stored value', serverId: 'memory' },
    ],
    puppeteer: [
      { name: 'navigate', description: 'Navigate to a URL', serverId: 'puppeteer' },
      { name: 'screenshot', description: 'Take a screenshot', serverId: 'puppeteer' },
      { name: 'click', description: 'Click an element', serverId: 'puppeteer' },
      { name: 'type', description: 'Type text into an input', serverId: 'puppeteer' },
      { name: 'evaluate', description: 'Run JavaScript in the page', serverId: 'puppeteer' },
    ],
    postgres: [
      { name: 'query', description: 'Execute a SQL query', serverId: 'postgres' },
      { name: 'list_tables', description: 'List database tables', serverId: 'postgres' },
      { name: 'describe_table', description: 'Get table schema', serverId: 'postgres' },
    ],
  };

  return toolsByServer[serverId] || [];
}

/**
 * Execute a mock tool (for demo purposes)
 * In production, this would call the actual MCP server
 */
async function executeMockTool(
  serverId: string,
  toolName: string,
  _args: Record<string, unknown>
): Promise<{ content: string }> {
  // Simulate some processing time
  await new Promise((resolve) => setTimeout(resolve, 500));

  return {
    content: `[Mock] Executed ${toolName} on ${serverId} server. In production, this would execute the actual MCP tool.`,
  };
}
