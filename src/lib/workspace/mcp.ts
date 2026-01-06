/**
 * CODE LAB MCP (MODEL CONTEXT PROTOCOL) INTEGRATION
 *
 * Provides MCP server support for extending Code Lab with external tools:
 * - Server configuration and management
 * - Tool discovery and invocation
 * - Resource access
 * - Prompt templates
 */

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

  constructor() {
    // Initialize with default servers (disabled by default)
    DEFAULT_MCP_SERVERS.forEach(server => {
      this.servers.set(server.id, server);
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
   * Enable an MCP server
   */
  enableServer(serverId: string): boolean {
    const server = this.servers.get(serverId);
    if (server) {
      server.enabled = true;
      return true;
    }
    return false;
  }

  /**
   * Disable an MCP server
   */
  disableServer(serverId: string): boolean {
    const server = this.servers.get(serverId);
    if (server) {
      server.enabled = false;
      const status = this.serverStatus.get(serverId);
      if (status) {
        status.status = 'stopped';
      }
      return true;
    }
    return false;
  }

  /**
   * Start an MCP server (simulated for E2B sandbox)
   * In a real implementation, this would spawn the process
   */
  async startServer(serverId: string): Promise<{ success: boolean; error?: string }> {
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
      // Simulate server startup and tool discovery
      // In production, this would actually spawn the MCP server process
      // and communicate via JSON-RPC over stdio

      await new Promise(resolve => setTimeout(resolve, 100));

      if (status) {
        status.status = 'running';
        status.lastPing = new Date().toISOString();

        // Register discovered tools
        status.tools.forEach(tool => {
          this.toolRegistry.set(`mcp__${serverId}__${tool.name}`, tool);
        });
      }

      return { success: true };
    } catch (error) {
      if (status) {
        status.status = 'error';
        status.error = error instanceof Error ? error.message : 'Unknown error';
      }
      return { success: false, error: status?.error };
    }
  }

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
   */
  async executeTool(
    toolName: string,
    input: Record<string, unknown>
  ): Promise<{ success: boolean; result?: unknown; error?: string }> {
    const tool = this.toolRegistry.get(toolName);
    if (!tool) {
      return { success: false, error: `Tool not found: ${toolName}` };
    }

    const status = this.serverStatus.get(tool.serverId);
    if (!status || status.status !== 'running') {
      return { success: false, error: `Server ${tool.serverId} is not running` };
    }

    try {
      // In production, this would send a JSON-RPC request to the MCP server
      // For now, we simulate the execution
      console.log(`[MCP] Executing tool ${toolName} with input:`, input);

      return {
        success: true,
        result: `MCP tool ${toolName} executed successfully (simulated)`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Tool execution failed',
      };
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
    return Array.from(this.toolRegistry.values()).map(tool => ({
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
      description: 'Enable an MCP server by ID. Available servers: filesystem, github, puppeteer, postgres, memory.',
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
