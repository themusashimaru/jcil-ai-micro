/**
 * CODE LAB MCP (MODEL CONTEXT PROTOCOL) INTEGRATION
 *
 * Provides MCP server support for extending Code Lab with external tools.
 * This implementation properly uses the real MCPClient from mcp-client.ts
 * for dynamic tool discovery and protocol-compliant communication.
 *
 * Architecture:
 * - Uses MCPClientManager from mcp-client.ts for real MCP servers
 * - Falls back to built-in implementations for common tools when servers unavailable
 * - Supports .mcp.json configuration files
 * - Persists user preferences to code_lab_user_mcp_servers table
 */

import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import {
  MCPClientManager,
  getMCPManager as getRealMCPManager,
  MCPServerConfig as RealMCPServerConfig,
} from '@/lib/mcp/mcp-client';
import Anthropic from '@anthropic-ai/sdk';
import { ContainerManager } from './container';
import { Octokit } from '@octokit/rest';

const log = logger('MCP');

// ============================================================================
// TYPES
// ============================================================================

export interface MCPServerConfig {
  id: string;
  name: string;
  description?: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  enabled: boolean;
  timeout?: number;
  workspaceId?: string;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  serverId: string;
}

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  serverId: string;
}

export interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
  serverId: string;
}

export interface MCPServerStatus {
  id: string;
  name: string;
  status: 'running' | 'stopped' | 'error' | 'starting';
  error?: string;
  tools: MCPTool[];
  resources: MCPResource[];
  prompts: MCPPrompt[];
  lastPing?: string;
}

export interface MCPToolResult {
  success: boolean;
  result?: unknown;
  error?: string;
}

export interface MCPToolExecutionOptions {
  workspaceId?: string;
  githubToken?: string;
  timeout?: number;
}

// Database row type for MCP server preferences
interface MCPServerRow {
  user_id: string;
  server_id: string;
  name?: string;
  description?: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  enabled: boolean;
  timeout?: number;
}

// ============================================================================
// DEFAULT MCP SERVERS
// ============================================================================

export const DEFAULT_MCP_SERVERS: MCPServerConfig[] = [
  {
    id: 'filesystem',
    name: 'Filesystem',
    description: 'Access files and directories on the local filesystem',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '/workspace'],
    enabled: false,
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'Interact with GitHub repositories, issues, and pull requests',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    env: { GITHUB_PERSONAL_ACCESS_TOKEN: '${GITHUB_TOKEN}' },
    enabled: false,
  },
  {
    id: 'puppeteer',
    name: 'Puppeteer',
    description: 'Browser automation for web scraping and testing',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-puppeteer'],
    enabled: false,
  },
  {
    id: 'postgres',
    name: 'PostgreSQL',
    description: 'Query and manage PostgreSQL databases',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-postgres', '${DATABASE_URL}'],
    enabled: false,
  },
  {
    id: 'memory',
    name: 'Memory',
    description: 'Store and retrieve data across conversations',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory'],
    enabled: false,
  },
];

// ============================================================================
// MCP MANAGER - USES REAL MCPClient
// ============================================================================

class MCPManager {
  private realManager: MCPClientManager;
  private serverConfigs: Map<string, MCPServerConfig> = new Map();
  private serverStatuses: Map<string, MCPServerStatus> = new Map();
  private fallbackTools: Map<string, MCPTool> = new Map();

  // Fallback stores for when real MCP servers aren't available
  private memoryStore: Map<string, unknown> = new Map();
  private containerManager: ContainerManager;

  constructor() {
    this.realManager = getRealMCPManager();
    this.containerManager = new ContainerManager();
    this.initializeDefaultServers();
  }

  /**
   * Initialize default server configurations
   */
  private initializeDefaultServers(): void {
    for (const server of DEFAULT_MCP_SERVERS) {
      this.serverConfigs.set(server.id, server);
      this.serverStatuses.set(server.id, {
        id: server.id,
        name: server.name,
        status: 'stopped',
        tools: [],
        resources: [],
        prompts: [],
      });
    }
  }

  /**
   * Get all server configurations
   */
  getServerConfigs(): MCPServerConfig[] {
    return Array.from(this.serverConfigs.values());
  }

  /**
   * Get server status
   */
  getServerStatus(serverId: string): MCPServerStatus | undefined {
    return this.serverStatuses.get(serverId);
  }

  /**
   * Get all server statuses
   */
  getAllServerStatuses(): MCPServerStatus[] {
    return Array.from(this.serverStatuses.values());
  }

  /**
   * Start an MCP server - uses real MCPClient
   */
  async startServer(
    serverId: string,
    workspaceId?: string,
    envOverrides?: Record<string, string>
  ): Promise<void> {
    const config = this.serverConfigs.get(serverId);
    if (!config) {
      throw new Error(`Unknown server: ${serverId}`);
    }

    const status = this.serverStatuses.get(serverId);
    if (status) {
      status.status = 'starting';
    }

    try {
      // Build environment with overrides
      const env: Record<string, string> = {};
      if (config.env) {
        for (const [key, value] of Object.entries(config.env)) {
          // Replace ${VAR} placeholders
          if (value.startsWith('${') && value.endsWith('}')) {
            const envVar = value.slice(2, -1);
            const override = envOverrides?.[envVar] || process.env[envVar];
            if (override) {
              env[key] = override;
            }
          } else {
            env[key] = value;
          }
        }
      }

      // Create real MCP server config
      const realConfig: RealMCPServerConfig = {
        id: serverId,
        name: config.name,
        description: config.description,
        command: config.command,
        args: config.args,
        env,
        enabled: true,
        timeout: config.timeout || 30000,
        workspaceId, // Run in E2B container if provided
      };

      // Try to start the real MCP server
      try {
        const client = await this.realManager.addServer(realConfig);
        await client.connect();

        // Update status with dynamically discovered tools
        if (status) {
          status.status = 'running';
          status.tools = client.tools.map((t) => ({
            ...t,
            description: t.description || '',
            inputSchema: t.inputSchema as MCPTool['inputSchema'],
            serverId,
          }));
          status.resources = client.resources.map((r) => ({ ...r, serverId }));
          status.prompts = client.prompts.map((p) => ({ ...p, serverId }));
          status.lastPing = new Date().toISOString();
        }

        log.info('MCP server started with real client', {
          serverId,
          tools: client.tools.length,
          resources: client.resources.length,
        });
      } catch (clientError) {
        // Fall back to built-in tools if real server fails
        log.warn('Real MCP server failed, using fallback', { serverId, error: clientError });
        this.registerFallbackTools(serverId);

        if (status) {
          status.status = 'running';
          status.tools = this.getFallbackTools(serverId);
          status.lastPing = new Date().toISOString();
        }
      }
    } catch (error) {
      log.error('Failed to start MCP server', { serverId, error });
      if (status) {
        status.status = 'error';
        status.error = error instanceof Error ? error.message : 'Unknown error';
      }
      throw error;
    }
  }

  /**
   * Stop an MCP server
   */
  async stopServer(serverId: string): Promise<void> {
    try {
      await this.realManager.removeServer(serverId);
    } catch {
      // Ignore - server may not have been started with real client
    }

    const status = this.serverStatuses.get(serverId);
    if (status) {
      status.status = 'stopped';
      status.tools = [];
      status.resources = [];
      status.prompts = [];
    }

    log.info('MCP server stopped', { serverId });
  }

  /**
   * Execute a tool - routes to real MCP server if available, otherwise uses fallback
   */
  async executeTool(
    toolName: string,
    input: Record<string, unknown>,
    options?: MCPToolExecutionOptions
  ): Promise<MCPToolResult> {
    // Parse tool name to get server ID
    // Format: mcp__serverId__toolName
    const parts = toolName.split('__');
    if (parts.length < 3 || parts[0] !== 'mcp') {
      return { success: false, error: `Invalid MCP tool name: ${toolName}` };
    }

    const serverId = parts[1];
    const actualToolName = parts.slice(2).join('__');

    log.debug('Executing MCP tool', { serverId, tool: actualToolName });

    // Try real MCP client first
    const client = this.realManager.getClient(serverId);
    if (client?.isConnected()) {
      try {
        const result = await client.callTool(actualToolName, input);
        return { success: true, result };
      } catch (error) {
        log.warn('Real MCP call failed, trying fallback', { error });
      }
    }

    // Fall back to built-in implementations
    return this.executeFallbackTool(serverId, actualToolName, input, options);
  }

  /**
   * Get all available tools from all servers
   */
  getAllTools(): MCPTool[] {
    const tools: MCPTool[] = [];

    // Get tools from real MCP servers
    const realTools = this.realManager.getAllTools();
    for (const tool of realTools) {
      tools.push({
        ...tool,
        description: tool.description || '',
        inputSchema: tool.inputSchema as MCPTool['inputSchema'],
      });
    }

    // Add fallback tools for servers not using real client
    for (const [serverId, status] of this.serverStatuses) {
      if (status.status === 'running' && !this.realManager.getClient(serverId)?.isConnected()) {
        tools.push(...status.tools);
      }
    }

    return tools;
  }

  // ============================================================================
  // FALLBACK IMPLEMENTATIONS
  // ============================================================================

  /**
   * Register fallback tools for a server
   */
  private registerFallbackTools(serverId: string): void {
    const tools = this.getFallbackTools(serverId);
    for (const tool of tools) {
      this.fallbackTools.set(`${serverId}__${tool.name}`, tool);
    }
  }

  /**
   * Get fallback tool definitions for a server
   */
  private getFallbackTools(serverId: string): MCPTool[] {
    switch (serverId) {
      case 'filesystem':
        return [
          {
            name: 'read_file',
            description: 'Read the contents of a file',
            inputSchema: {
              type: 'object',
              properties: {
                path: { type: 'string', description: 'File path' },
              },
              required: ['path'],
            },
            serverId,
          },
          {
            name: 'write_file',
            description: 'Write content to a file',
            inputSchema: {
              type: 'object',
              properties: {
                path: { type: 'string', description: 'File path' },
                content: { type: 'string', description: 'File content' },
              },
              required: ['path', 'content'],
            },
            serverId,
          },
          {
            name: 'list_directory',
            description: 'List files in a directory',
            inputSchema: {
              type: 'object',
              properties: {
                path: { type: 'string', description: 'Directory path' },
              },
              required: ['path'],
            },
            serverId,
          },
        ];

      case 'github':
        return [
          {
            name: 'get_repo',
            description: 'Get repository information',
            inputSchema: {
              type: 'object',
              properties: {
                owner: { type: 'string', description: 'Repository owner' },
                repo: { type: 'string', description: 'Repository name' },
              },
              required: ['owner', 'repo'],
            },
            serverId,
          },
          {
            name: 'list_issues',
            description: 'List repository issues',
            inputSchema: {
              type: 'object',
              properties: {
                owner: { type: 'string', description: 'Repository owner' },
                repo: { type: 'string', description: 'Repository name' },
                state: { type: 'string', enum: ['open', 'closed', 'all'] },
              },
              required: ['owner', 'repo'],
            },
            serverId,
          },
          {
            name: 'create_issue',
            description: 'Create a new issue',
            inputSchema: {
              type: 'object',
              properties: {
                owner: { type: 'string', description: 'Repository owner' },
                repo: { type: 'string', description: 'Repository name' },
                title: { type: 'string', description: 'Issue title' },
                body: { type: 'string', description: 'Issue body' },
              },
              required: ['owner', 'repo', 'title'],
            },
            serverId,
          },
        ];

      case 'memory':
        return [
          {
            name: 'store',
            description: 'Store a value in memory',
            inputSchema: {
              type: 'object',
              properties: {
                key: { type: 'string', description: 'Storage key' },
                value: { description: 'Value to store' },
              },
              required: ['key', 'value'],
            },
            serverId,
          },
          {
            name: 'retrieve',
            description: 'Retrieve a value from memory',
            inputSchema: {
              type: 'object',
              properties: {
                key: { type: 'string', description: 'Storage key' },
              },
              required: ['key'],
            },
            serverId,
          },
          {
            name: 'delete',
            description: 'Delete a value from memory',
            inputSchema: {
              type: 'object',
              properties: {
                key: { type: 'string', description: 'Storage key' },
              },
              required: ['key'],
            },
            serverId,
          },
          {
            name: 'list',
            description: 'List all stored keys',
            inputSchema: {
              type: 'object',
              properties: {},
            },
            serverId,
          },
        ];

      default:
        return [];
    }
  }

  /**
   * Execute a fallback tool implementation
   */
  private async executeFallbackTool(
    serverId: string,
    toolName: string,
    input: Record<string, unknown>,
    options?: MCPToolExecutionOptions
  ): Promise<MCPToolResult> {
    try {
      switch (serverId) {
        case 'filesystem':
          return this.executeFilesystemTool(toolName, input, options?.workspaceId);

        case 'github':
          return this.executeGitHubTool(toolName, input, options?.githubToken);

        case 'memory':
          return this.executeMemoryTool(toolName, input);

        default:
          return { success: false, error: `No fallback for server: ${serverId}` };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Tool execution failed',
      };
    }
  }

  /**
   * Filesystem tool fallback
   */
  private async executeFilesystemTool(
    toolName: string,
    input: Record<string, unknown>,
    workspaceId?: string
  ): Promise<MCPToolResult> {
    if (!workspaceId) {
      return { success: false, error: 'workspaceId required for filesystem tools' };
    }

    switch (toolName) {
      case 'read_file': {
        const content = await this.containerManager.readFile(workspaceId, input.path as string);
        return { success: true, result: content };
      }

      case 'write_file': {
        await this.containerManager.writeFile(
          workspaceId,
          input.path as string,
          input.content as string
        );
        return { success: true, result: 'File written successfully' };
      }

      case 'list_directory': {
        const files = await this.containerManager.listDirectory(workspaceId, input.path as string);
        return { success: true, result: files };
      }

      default:
        return { success: false, error: `Unknown filesystem tool: ${toolName}` };
    }
  }

  /**
   * GitHub tool fallback
   */
  private async executeGitHubTool(
    toolName: string,
    input: Record<string, unknown>,
    githubToken?: string
  ): Promise<MCPToolResult> {
    if (!githubToken) {
      return { success: false, error: 'GitHub token required' };
    }

    const octokit = new Octokit({ auth: githubToken });

    switch (toolName) {
      case 'get_repo': {
        const { data } = await octokit.repos.get({
          owner: input.owner as string,
          repo: input.repo as string,
        });
        return { success: true, result: data };
      }

      case 'list_issues': {
        const { data } = await octokit.issues.listForRepo({
          owner: input.owner as string,
          repo: input.repo as string,
          state: (input.state as 'open' | 'closed' | 'all') || 'open',
        });
        return { success: true, result: data };
      }

      case 'create_issue': {
        const { data } = await octokit.issues.create({
          owner: input.owner as string,
          repo: input.repo as string,
          title: input.title as string,
          body: input.body as string,
        });
        return { success: true, result: data };
      }

      default:
        return { success: false, error: `Unknown GitHub tool: ${toolName}` };
    }
  }

  /**
   * Memory tool fallback
   */
  private executeMemoryTool(toolName: string, input: Record<string, unknown>): MCPToolResult {
    switch (toolName) {
      case 'store':
        this.memoryStore.set(input.key as string, input.value);
        return { success: true, result: 'Stored successfully' };

      case 'retrieve': {
        const value = this.memoryStore.get(input.key as string);
        if (value === undefined) {
          return { success: false, error: `Key not found: ${input.key}` };
        }
        return { success: true, result: value };
      }

      case 'delete':
        this.memoryStore.delete(input.key as string);
        return { success: true, result: 'Deleted successfully' };

      case 'list':
        return { success: true, result: Array.from(this.memoryStore.keys()) };

      default:
        return { success: false, error: `Unknown memory tool: ${toolName}` };
    }
  }

  // ============================================================================
  // CONFIGURATION PERSISTENCE
  // ============================================================================

  /**
   * Load user MCP server preferences from database
   */
  async loadUserPreferences(userId: string): Promise<void> {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from('code_lab_user_mcp_servers')
        .select('*')
        .eq('user_id', userId);

      if (error) {
        log.warn('Failed to load MCP preferences', { error });
        return;
      }

      for (const row of (data || []) as MCPServerRow[]) {
        const config: MCPServerConfig = {
          id: row.server_id,
          name: row.name || row.server_id,
          description: row.description,
          command: row.command,
          args: row.args,
          env: row.env,
          enabled: row.enabled,
          timeout: row.timeout,
        };

        this.serverConfigs.set(config.id, config);

        if (config.enabled) {
          // Start enabled servers
          this.startServer(config.id).catch((err) => {
            log.error('Failed to start user MCP server', { serverId: config.id, error: err });
          });
        }
      }
    } catch (error) {
      log.error('Error loading MCP preferences', { error });
    }
  }

  /**
   * Save MCP server configuration to database
   */
  async saveServerConfig(userId: string, config: MCPServerConfig): Promise<void> {
    try {
      const supabase = await createClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('code_lab_user_mcp_servers') as any).upsert({
        user_id: userId,
        server_id: config.id,
        name: config.name,
        description: config.description,
        command: config.command,
        args: config.args,
        env: config.env,
        enabled: config.enabled,
        timeout: config.timeout,
      });

      this.serverConfigs.set(config.id, config);
    } catch (error) {
      log.error('Error saving MCP config', { error });
      throw error;
    }
  }

  /**
   * Load .mcp.json configuration from workspace
   */
  async loadWorkspaceConfig(workspaceId: string): Promise<MCPServerConfig[]> {
    try {
      const content = await this.containerManager.readFile(workspaceId, '.mcp.json');
      const config = JSON.parse(content);

      const servers: MCPServerConfig[] = [];

      if (config.mcpServers) {
        for (const [id, serverConfig] of Object.entries(config.mcpServers)) {
          const server = serverConfig as {
            command: string;
            args?: string[];
            env?: Record<string, string>;
          };

          servers.push({
            id,
            name: id,
            command: server.command,
            args: server.args,
            env: server.env,
            enabled: true,
          });
        }
      }

      // Register workspace configs
      for (const server of servers) {
        this.serverConfigs.set(server.id, server);
      }

      log.info('Loaded workspace MCP config', { workspaceId, servers: servers.length });
      return servers;
    } catch {
      // .mcp.json is optional
      log.debug('No .mcp.json found in workspace', { workspaceId });
      return [];
    }
  }
}

// ============================================================================
// SINGLETON & EXPORTS
// ============================================================================

let mcpManagerInstance: MCPManager | null = null;

export function getMCPManager(): MCPManager {
  if (!mcpManagerInstance) {
    mcpManagerInstance = new MCPManager();
  }
  return mcpManagerInstance;
}

/**
 * Get MCP tool definitions for Anthropic API
 */
export function getMCPConfigTools(): Anthropic.Tool[] {
  return [
    {
      name: 'mcp_list_servers',
      description: 'List available MCP servers and their status',
      input_schema: {
        type: 'object' as const,
        properties: {},
        required: [],
      },
    },
    {
      name: 'mcp_start_server',
      description: 'Start an MCP server to access its tools',
      input_schema: {
        type: 'object' as const,
        properties: {
          serverId: {
            type: 'string',
            description: 'ID of the server to start (e.g., "filesystem", "github", "memory")',
          },
        },
        required: ['serverId'],
      },
    },
    {
      name: 'mcp_stop_server',
      description: 'Stop a running MCP server',
      input_schema: {
        type: 'object' as const,
        properties: {
          serverId: {
            type: 'string',
            description: 'ID of the server to stop',
          },
        },
        required: ['serverId'],
      },
    },
    {
      name: 'mcp_list_tools',
      description: 'List all available tools from running MCP servers',
      input_schema: {
        type: 'object' as const,
        properties: {},
        required: [],
      },
    },
  ];
}
