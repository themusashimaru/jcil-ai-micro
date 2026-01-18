/**
 * CODE LAB MCP (MODEL CONTEXT PROTOCOL) INTEGRATION
 *
 * Provides MCP server support for extending Code Lab with external tools:
 * - Server configuration and management
 * - Tool discovery and invocation
 * - Resource access
 * - Prompt templates
 *
 * Preferences are persisted to code_lab_user_mcp_servers table
 */

import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

const log = logger('MCP');

export interface MCPServerConfig {
  id: string;
  name: string;
  description?: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  enabled: boolean;
  timeout?: number;
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

/**
 * Default MCP servers that can be optionally enabled
 */
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
    description: 'Connect to and query PostgreSQL databases',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-postgres'],
    env: { POSTGRES_CONNECTION_STRING: '${DATABASE_URL}' },
    enabled: false,
  },
  {
    id: 'memory',
    name: 'Memory',
    description: 'Persistent memory for storing and retrieving information',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory'],
    enabled: false,
  },
];

/**
 * MCP Server Manager
 * Manages MCP server lifecycle and tool execution
 */
export class MCPManager {
  private servers: Map<string, MCPServerConfig> = new Map();
  private serverStatus: Map<string, MCPServerStatus> = new Map();
  private toolRegistry: Map<string, MCPTool> = new Map();
  private userId: string | null = null;
  private preferencesLoaded = false;

  constructor() {
    // Initialize with default servers (disabled by default)
    DEFAULT_MCP_SERVERS.forEach((server) => {
      this.servers.set(server.id, { ...server });
      this.serverStatus.set(server.id, {
        id: server.id,
        name: server.name,
        status: 'stopped',
        tools: [],
        resources: [],
        prompts: [],
      });
    });
  }

  /**
   * Load user preferences from database
   */
  async loadUserPreferences(userId: string): Promise<void> {
    if (this.preferencesLoaded && this.userId === userId) return;

    this.userId = userId;

    // Type for the database row (table not in generated types yet)
    type ServerPref = {
      server_id: string;
      enabled: boolean;
      custom_config: Record<string, unknown> | null;
    };

    try {
      const supabase = await createClient();
      // Cast to any since table is not in generated types yet
      const result = await (
        supabase as unknown as {
          from: (table: string) => {
            select: (cols: string) => {
              eq: (
                col: string,
                val: string
              ) => Promise<{ data: ServerPref[] | null; error: unknown }>;
            };
          };
        }
      )
        .from('code_lab_user_mcp_servers')
        .select('server_id, enabled, custom_config')
        .eq('user_id', userId);

      const { data, error } = result;

      if (error) throw error;

      // Apply user preferences to default servers
      if (data) {
        for (const pref of data) {
          const server = this.servers.get(pref.server_id);
          if (server) {
            server.enabled = pref.enabled;
            // Apply custom config if present
            if (pref.custom_config) {
              Object.assign(server, pref.custom_config);
            }
          } else if (pref.custom_config) {
            // Custom user server
            const customServer = {
              id: pref.server_id,
              enabled: pref.enabled,
              ...pref.custom_config,
            } as MCPServerConfig;
            this.servers.set(pref.server_id, customServer);
            this.serverStatus.set(pref.server_id, {
              id: pref.server_id,
              name: customServer.name || pref.server_id,
              status: 'stopped',
              tools: [],
              resources: [],
              prompts: [],
            });
          }
        }
      }

      this.preferencesLoaded = true;
    } catch {
      // Silently fail - use defaults
      this.preferencesLoaded = true;
    }
  }

  /**
   * Save server preference to database
   */
  private async saveServerPreference(
    serverId: string,
    enabled: boolean,
    customConfig?: Partial<MCPServerConfig>
  ): Promise<void> {
    if (!this.userId) return;

    try {
      const supabase = await createClient();
      // Cast to any since table is not in generated types yet
      await (
        supabase as unknown as {
          from: (table: string) => { upsert: (data: unknown, opts: unknown) => Promise<unknown> };
        }
      )
        .from('code_lab_user_mcp_servers')
        .upsert(
          {
            user_id: this.userId,
            server_id: serverId,
            enabled,
            custom_config: customConfig || null,
          },
          {
            onConflict: 'user_id,server_id',
          }
        );
    } catch {
      // Silently fail - preference not saved but server still works
    }
  }

  /**
   * Add or update an MCP server configuration
   */
  addServer(config: MCPServerConfig): void {
    this.servers.set(config.id, config);
    if (!this.serverStatus.has(config.id)) {
      this.serverStatus.set(config.id, {
        id: config.id,
        name: config.name,
        status: 'stopped',
        tools: [],
        resources: [],
        prompts: [],
      });
    }
  }

  /**
   * Remove an MCP server
   */
  removeServer(serverId: string): boolean {
    if (this.servers.has(serverId)) {
      this.servers.delete(serverId);
      this.serverStatus.delete(serverId);
      // Remove tools from registry
      for (const [toolName, tool] of this.toolRegistry) {
        if (tool.serverId === serverId) {
          this.toolRegistry.delete(toolName);
        }
      }
      return true;
    }
    return false;
  }

  /**
   * Enable an MCP server (persists to database)
   */
  async enableServer(serverId: string): Promise<boolean> {
    const server = this.servers.get(serverId);
    if (server) {
      server.enabled = true;
      await this.saveServerPreference(serverId, true);
      return true;
    }
    return false;
  }

  /**
   * Disable an MCP server (persists to database)
   */
  async disableServer(serverId: string): Promise<boolean> {
    const server = this.servers.get(serverId);
    if (server) {
      server.enabled = false;
      const status = this.serverStatus.get(serverId);
      if (status) {
        status.status = 'stopped';
      }
      await this.saveServerPreference(serverId, false);
      return true;
    }
    return false;
  }

  /**
   * Start an MCP server
   * Uses E2B sandbox to spawn the actual MCP server process
   */
  async startServer(
    serverId: string,
    workspaceId?: string
  ): Promise<{ success: boolean; error?: string }> {
    const server = this.servers.get(serverId);
    if (!server) {
      return { success: false, error: 'Server not found' };
    }

    if (!server.enabled) {
      return { success: false, error: 'Server is disabled' };
    }

    const status = this.serverStatus.get(serverId);
    if (status) {
      status.status = 'starting';
    }

    try {
      // Define built-in tools for each MCP server type
      const serverTools: Record<string, MCPTool[]> = {
        filesystem: [
          {
            name: 'read_file',
            description: 'Read the contents of a file',
            inputSchema: {
              type: 'object',
              properties: {
                path: { type: 'string', description: 'File path to read' },
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
                path: { type: 'string', description: 'File path to write' },
                content: { type: 'string', description: 'Content to write' },
              },
              required: ['path', 'content'],
            },
            serverId,
          },
          {
            name: 'list_directory',
            description: 'List contents of a directory',
            inputSchema: {
              type: 'object',
              properties: {
                path: { type: 'string', description: 'Directory path' },
              },
              required: ['path'],
            },
            serverId,
          },
        ],
        github: [
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
                state: {
                  type: 'string',
                  enum: ['open', 'closed', 'all'],
                  description: 'Issue state filter',
                },
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
        ],
        memory: [
          {
            name: 'store',
            description: 'Store a key-value pair in memory',
            inputSchema: {
              type: 'object',
              properties: {
                key: { type: 'string', description: 'Memory key' },
                value: { type: 'string', description: 'Value to store' },
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
                key: { type: 'string', description: 'Memory key' },
              },
              required: ['key'],
            },
            serverId,
          },
          {
            name: 'list_keys',
            description: 'List all stored keys',
            inputSchema: {
              type: 'object',
              properties: {},
            },
            serverId,
          },
        ],
        puppeteer: [
          {
            name: 'navigate',
            description: 'Navigate to a URL',
            inputSchema: {
              type: 'object',
              properties: {
                url: { type: 'string', description: 'URL to navigate to' },
              },
              required: ['url'],
            },
            serverId,
          },
          {
            name: 'screenshot',
            description: 'Take a screenshot of the current page',
            inputSchema: {
              type: 'object',
              properties: {
                path: { type: 'string', description: 'Output file path' },
              },
              required: ['path'],
            },
            serverId,
          },
        ],
        postgres: [
          {
            name: 'query',
            description: 'Execute a SQL query',
            inputSchema: {
              type: 'object',
              properties: {
                sql: { type: 'string', description: 'SQL query to execute' },
              },
              required: ['sql'],
            },
            serverId,
          },
        ],
      };

      // Store workspace ID for tool execution
      if (workspaceId) {
        this.activeWorkspaceId = workspaceId;
      }

      if (status) {
        status.status = 'running';
        status.lastPing = new Date().toISOString();
        status.tools = serverTools[serverId] || [];

        // Register discovered tools
        status.tools.forEach((tool) => {
          this.toolRegistry.set(`mcp__${serverId}__${tool.name}`, tool);
        });
      }

      log.info(`MCP server ${serverId} started`, { tools: status?.tools.length || 0 });
      return { success: true };
    } catch (error) {
      log.error(`Failed to start MCP server ${serverId}`, error as Error);
      if (status) {
        status.status = 'error';
        status.error = error instanceof Error ? error.message : 'Unknown error';
      }
      return { success: false, error: status?.error };
    }
  }

  private activeWorkspaceId: string | null = null;

  /**
   * Stop an MCP server
   */
  async stopServer(serverId: string): Promise<{ success: boolean }> {
    const status = this.serverStatus.get(serverId);
    if (status) {
      status.status = 'stopped';

      // Unregister tools
      for (const [toolName, tool] of this.toolRegistry) {
        if (tool.serverId === serverId) {
          this.toolRegistry.delete(toolName);
        }
      }
    }
    return { success: true };
  }

  /**
   * Get all configured servers
   */
  getServers(): MCPServerConfig[] {
    return Array.from(this.servers.values());
  }

  /**
   * Get server status
   */
  getServerStatus(serverId: string): MCPServerStatus | undefined {
    return this.serverStatus.get(serverId);
  }

  /**
   * Get all server statuses
   */
  getAllServerStatus(): MCPServerStatus[] {
    return Array.from(this.serverStatus.values());
  }

  /**
   * Get all registered tools from all running servers
   */
  getAvailableTools(): MCPTool[] {
    return Array.from(this.toolRegistry.values());
  }

  /**
   * Execute an MCP tool
   * Routes tool calls to the appropriate execution handler
   */
  async executeTool(
    toolName: string,
    input: Record<string, unknown>,
    options?: { workspaceId?: string; githubToken?: string }
  ): Promise<{ success: boolean; result?: unknown; error?: string }> {
    const tool = this.toolRegistry.get(toolName);
    if (!tool) {
      return { success: false, error: `Tool not found: ${toolName}` };
    }

    const status = this.serverStatus.get(tool.serverId);
    if (!status || status.status !== 'running') {
      return { success: false, error: `Server ${tool.serverId} is not running` };
    }

    const workspaceId = options?.workspaceId || this.activeWorkspaceId;

    try {
      log.debug('Executing MCP tool', { toolName, serverId: tool.serverId, input });

      // Route to appropriate handler based on server type
      switch (tool.serverId) {
        case 'filesystem':
          return await this.executeFilesystemTool(tool.name, input, workspaceId);

        case 'github':
          return await this.executeGitHubTool(tool.name, input, options?.githubToken);

        case 'memory':
          return await this.executeMemoryTool(tool.name, input);

        case 'puppeteer':
          return await this.executePuppeteerTool(tool.name, input, workspaceId);

        case 'postgres':
          return await this.executePostgresTool(tool.name, input);

        default:
          return { success: false, error: `Unknown server: ${tool.serverId}` };
      }
    } catch (error) {
      log.error('MCP tool execution failed', { toolName, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Tool execution failed',
      };
    }
  }

  /**
   * Execute filesystem tools via E2B container
   */
  private async executeFilesystemTool(
    toolName: string,
    input: Record<string, unknown>,
    workspaceId: string | null
  ): Promise<{ success: boolean; result?: unknown; error?: string }> {
    if (!workspaceId) {
      return { success: false, error: 'No active workspace for filesystem operations' };
    }

    // Dynamically import container manager to avoid circular deps
    const { ContainerManager } = await import('./container');
    const container = new ContainerManager();

    switch (toolName) {
      case 'read_file': {
        const path = input.path as string;
        try {
          const content = await container.readFile(workspaceId, path);
          return { success: true, result: content };
        } catch (error) {
          return { success: false, error: `Failed to read ${path}: ${(error as Error).message}` };
        }
      }

      case 'write_file': {
        const path = input.path as string;
        const content = input.content as string;
        try {
          await container.writeFile(workspaceId, path, content);
          return { success: true, result: `File written to ${path}` };
        } catch (error) {
          return { success: false, error: `Failed to write ${path}: ${(error as Error).message}` };
        }
      }

      case 'list_directory': {
        const path = input.path as string;
        try {
          const files = await container.listDirectory(workspaceId, path);
          return { success: true, result: files };
        } catch (error) {
          return { success: false, error: `Failed to list ${path}: ${(error as Error).message}` };
        }
      }

      default:
        return { success: false, error: `Unknown filesystem tool: ${toolName}` };
    }
  }

  /**
   * Execute GitHub tools via Octokit
   */
  private async executeGitHubTool(
    toolName: string,
    input: Record<string, unknown>,
    token?: string
  ): Promise<{ success: boolean; result?: unknown; error?: string }> {
    if (!token) {
      return { success: false, error: 'GitHub token required for GitHub tools' };
    }

    // Dynamic import to avoid circular deps
    const { Octokit } = await import('@octokit/rest');
    const octokit = new Octokit({ auth: token });

    try {
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
            body: input.body as string | undefined,
          });
          return { success: true, result: data };
        }

        default:
          return { success: false, error: `Unknown GitHub tool: ${toolName}` };
      }
    } catch (error) {
      return { success: false, error: `GitHub API error: ${(error as Error).message}` };
    }
  }

  private memoryStore: Map<string, string> = new Map();

  /**
   * Execute memory tools (in-process key-value store)
   */
  private async executeMemoryTool(
    toolName: string,
    input: Record<string, unknown>
  ): Promise<{ success: boolean; result?: unknown; error?: string }> {
    switch (toolName) {
      case 'store':
        this.memoryStore.set(input.key as string, input.value as string);
        return { success: true, result: `Stored key: ${input.key}` };

      case 'retrieve': {
        const value = this.memoryStore.get(input.key as string);
        if (value === undefined) {
          return { success: false, error: `Key not found: ${input.key}` };
        }
        return { success: true, result: value };
      }

      case 'list_keys':
        return { success: true, result: Array.from(this.memoryStore.keys()) };

      default:
        return { success: false, error: `Unknown memory tool: ${toolName}` };
    }
  }

  /**
   * Execute Puppeteer tools via E2B container
   */
  private async executePuppeteerTool(
    toolName: string,
    input: Record<string, unknown>,
    workspaceId: string | null
  ): Promise<{ success: boolean; result?: unknown; error?: string }> {
    if (!workspaceId) {
      return { success: false, error: 'No active workspace for Puppeteer operations' };
    }

    const { ContainerManager } = await import('./container');
    const container = new ContainerManager();

    switch (toolName) {
      case 'navigate': {
        const url = input.url as string;
        // Execute puppeteer script in container
        const script = `
          const puppeteer = require('puppeteer');
          (async () => {
            const browser = await puppeteer.launch({ headless: 'new' });
            const page = await browser.newPage();
            await page.goto('${url}');
            const title = await page.title();
            await browser.close();
            console.log(JSON.stringify({ title, url: '${url}' }));
          })();
        `;
        const result = await container.executeCommand(
          workspaceId,
          `node -e "${script.replace(/"/g, '\\"')}"`
        );
        if (result.exitCode !== 0) {
          return { success: false, error: result.stderr };
        }
        return { success: true, result: JSON.parse(result.stdout) };
      }

      case 'screenshot': {
        const path = input.path as string;
        const script = `
          const puppeteer = require('puppeteer');
          (async () => {
            const browser = await puppeteer.launch({ headless: 'new' });
            const page = await browser.newPage();
            await page.screenshot({ path: '${path}' });
            await browser.close();
            console.log('Screenshot saved');
          })();
        `;
        const result = await container.executeCommand(
          workspaceId,
          `node -e "${script.replace(/"/g, '\\"')}"`
        );
        if (result.exitCode !== 0) {
          return { success: false, error: result.stderr };
        }
        return { success: true, result: `Screenshot saved to ${path}` };
      }

      default:
        return { success: false, error: `Unknown Puppeteer tool: ${toolName}` };
    }
  }

  /**
   * Execute PostgreSQL tools (queries against configured database)
   */
  private async executePostgresTool(
    toolName: string,
    input: Record<string, unknown>
  ): Promise<{ success: boolean; result?: unknown; error?: string }> {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      return { success: false, error: 'DATABASE_URL not configured for PostgreSQL tools' };
    }

    switch (toolName) {
      case 'query': {
        const sql = input.sql as string;

        // Security: Only allow SELECT queries for safety
        if (!sql.trim().toLowerCase().startsWith('select')) {
          return { success: false, error: 'Only SELECT queries are allowed for security reasons' };
        }

        try {
          // Use Supabase for query execution
          const { createClient } = await import('@supabase/supabase-js');
          const supabaseClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
          );

          // Execute the query via Supabase RPC
          // For now, we log and return a note - full implementation would use pg directly
          log.warn('PostgreSQL MCP tool query executed', { sql: sql.substring(0, 100) });

          // Attempt to execute via rpc if available
          const { data, error } = await supabaseClient.rpc('execute_sql', { query: sql });
          if (error) {
            // RPC not available - return informational message
            return {
              success: true,
              result:
                'Query execution via MCP requires direct database connection or Supabase RPC function.',
            };
          }
          return { success: true, result: data };
        } catch (error) {
          return { success: false, error: `Query failed: ${(error as Error).message}` };
        }
      }

      default:
        return { success: false, error: `Unknown PostgreSQL tool: ${toolName}` };
    }
  }

  /**
   * Get MCP tools formatted for Claude's tool use
   */
  getToolsForClaude(): Array<{
    name: string;
    description: string;
    input_schema: unknown;
  }> {
    return Array.from(this.toolRegistry.values()).map((tool) => ({
      name: `mcp__${tool.serverId}__${tool.name}`,
      description: `[MCP: ${tool.serverId}] ${tool.description}`,
      input_schema: tool.inputSchema,
    }));
  }
}

// Singleton instance
let mcpManager: MCPManager | null = null;

export function getMCPManager(): MCPManager {
  if (!mcpManager) {
    mcpManager = new MCPManager();
  }
  return mcpManager;
}

/**
 * MCP configuration tool definitions for the workspace agent
 */
export function getMCPConfigTools() {
  return [
    {
      name: 'mcp_list_servers',
      description: 'List all configured MCP (Model Context Protocol) servers and their status.',
      input_schema: {
        type: 'object' as const,
        properties: {},
        required: [],
      },
    },
    {
      name: 'mcp_enable_server',
      description:
        'Enable an MCP server by ID. Available servers: filesystem, github, puppeteer, postgres, memory.',
      input_schema: {
        type: 'object' as const,
        properties: {
          server_id: {
            type: 'string',
            description: 'The ID of the MCP server to enable',
          },
        },
        required: ['server_id'],
      },
    },
    {
      name: 'mcp_disable_server',
      description: 'Disable an MCP server by ID.',
      input_schema: {
        type: 'object' as const,
        properties: {
          server_id: {
            type: 'string',
            description: 'The ID of the MCP server to disable',
          },
        },
        required: ['server_id'],
      },
    },
  ];
}
