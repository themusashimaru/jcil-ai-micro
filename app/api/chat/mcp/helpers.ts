/**
 * MCP HELPERS
 *
 * Helper functions for MCP server management, extracted from route.ts
 * because Next.js routes can only export route handlers.
 */

import { logger } from '@/lib/logger';
import { getMCPManager, MCPServerConfig } from '@/lib/mcp/mcp-client';

const log = logger('chat-mcp-helpers');

// Idle timeout: auto-stop servers after 1 minute of no tool calls
const IDLE_TIMEOUT_MS = 60 * 1000; // 1 minute

// Track last activity time per server for idle timeout
const serverLastActivity = new Map<string, number>();
const idleTimeoutHandles = new Map<string, NodeJS.Timeout>();

// Default MCP servers available in Chat
export const DEFAULT_MCP_SERVERS = [
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
  // Memory server removed - persistent memory is always-on via Supabase (conversation_memory table)
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

// Server status types
export type MCPServerStatus = 'running' | 'stopped' | 'error' | 'starting' | 'available';

// In-memory server state (per user)
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

/**
 * Get or initialize user's server state
 */
export function getUserServers(userId: string) {
  if (!userServerState.has(userId)) {
    const serverMap = new Map<
      string,
      {
        enabled: boolean;
        status: MCPServerStatus;
        tools: Array<{ name: string; description: string; serverId: string }>;
        error?: string;
      }
    >();

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
 * Reset the idle timeout for a server
 * Called whenever a tool is executed on that server
 */
export function resetIdleTimeout(serverId: string, userId: string) {
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
      log.warn('Failed to auto-stop idle MCP server', {
        serverId,
        error: (error as Error).message,
      });
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
): Promise<{
  success: boolean;
  tools: Array<{ name: string; description: string; inputSchema?: unknown }>;
  error?: string;
}> {
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
      tools: existingClient.tools.map((t) => ({
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
    const tools = client.tools.map((t) => ({
      name: t.name,
      description: t.description || '',
      inputSchema: t.inputSchema,
    }));

    // Update state to running
    userServers.set(serverId, {
      enabled: true,
      status: 'running',
      tools: tools.map((t) => ({ ...t, serverId })),
    });

    // Start idle timeout
    resetIdleTimeout(serverId, userId);

    log.info('MCP server started on-demand successfully', { serverId, toolCount: tools.length });

    return { success: true, tools };
  } catch (error) {
    log.error('Failed to start MCP server on-demand', {
      serverId,
      error: (error as Error).message,
    });
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
export function getKnownToolsForServer(
  serverId: string
): Array<{ name: string; description: string; serverId: string }> {
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
    // memory server removed - persistent memory is always-on via Supabase
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
  return tools.map((t) => ({ ...t, serverId }));
}
