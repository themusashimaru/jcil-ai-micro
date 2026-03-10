/**
 * MCP CLIENT PROTOCOL
 *
 * Model Context Protocol client for tool extensibility.
 * Allows Code Lab to connect to MCP servers and use their tools.
 *
 * Features:
 * - MCP server connection
 * - Tool discovery
 * - Tool execution
 * - Resource management
 * - Prompt templates
 * - Sampling requests
 */

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description?: string;
      enum?: string[];
      default?: unknown;
    }>;
    required?: string[];
  };
}

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: {
    name: string;
    description?: string;
    required?: boolean;
  }[];
}

export interface MCPServer {
  name: string;
  version: string;
  capabilities: {
    tools?: boolean;
    resources?: boolean;
    prompts?: boolean;
    sampling?: boolean;
  };
}

export interface MCPToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface MCPToolResult {
  content: {
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
    resource?: MCPResource;
  }[];
  isError?: boolean;
}

type MCPTransport = 'stdio' | 'sse' | 'websocket';

interface MCPClientConfig {
  serverUrl?: string;
  transport?: MCPTransport;
  timeout?: number;
  apiKey?: string;
}

export class MCPClient {
  private config: MCPClientConfig;
  private connected: boolean = false;
  private serverInfo: MCPServer | null = null;
  private tools: Map<string, MCPTool> = new Map();
  private resources: Map<string, MCPResource> = new Map();
  private prompts: Map<string, MCPPrompt> = new Map();
  private eventSource: EventSource | null = null;
  private messageId: number = 0;

  constructor(config: MCPClientConfig = {}) {
    this.config = {
      transport: 'sse',
      timeout: 30000,
      ...config,
    };
  }

  /**
   * Connect to an MCP server
   */
  async connect(serverUrl: string): Promise<MCPServer> {
    this.config.serverUrl = serverUrl;

    try {
      // Initialize connection
      const initResponse = await this.sendRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {
          roots: { listChanged: true },
          sampling: {},
        },
        clientInfo: {
          name: 'code-lab',
          version: '1.0.0',
        },
      });

      this.serverInfo = initResponse as MCPServer;
      this.connected = true;

      // Fetch available tools, resources, and prompts
      await this.refreshCapabilities();

      return this.serverInfo;
    } catch (error) {
      this.connected = false;
      throw new Error(`Failed to connect to MCP server: ${error}`);
    }
  }

  /**
   * Disconnect from server
   */
  async disconnect(): Promise<void> {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    this.connected = false;
    this.serverInfo = null;
    this.tools.clear();
    this.resources.clear();
    this.prompts.clear();
  }

  /**
   * Refresh available capabilities from server
   */
  async refreshCapabilities(): Promise<void> {
    if (!this.connected) {
      throw new Error('Not connected to MCP server');
    }

    // Fetch tools
    if (this.serverInfo?.capabilities.tools) {
      const toolsResponse = await this.sendRequest('tools/list', {});
      const toolsList = (toolsResponse as { tools: MCPTool[] }).tools || [];
      this.tools.clear();
      for (const tool of toolsList) {
        this.tools.set(tool.name, tool);
      }
    }

    // Fetch resources
    if (this.serverInfo?.capabilities.resources) {
      const resourcesResponse = await this.sendRequest('resources/list', {});
      const resourcesList = (resourcesResponse as { resources: MCPResource[] }).resources || [];
      this.resources.clear();
      for (const resource of resourcesList) {
        this.resources.set(resource.uri, resource);
      }
    }

    // Fetch prompts
    if (this.serverInfo?.capabilities.prompts) {
      const promptsResponse = await this.sendRequest('prompts/list', {});
      const promptsList = (promptsResponse as { prompts: MCPPrompt[] }).prompts || [];
      this.prompts.clear();
      for (const prompt of promptsList) {
        this.prompts.set(prompt.name, prompt);
      }
    }
  }

  /**
   * Call a tool on the MCP server
   */
  async callTool(name: string, args: Record<string, unknown>): Promise<MCPToolResult> {
    if (!this.connected) {
      throw new Error('Not connected to MCP server');
    }

    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }

    // Validate arguments against schema
    this.validateToolArgs(tool, args);

    const response = await this.sendRequest('tools/call', {
      name,
      arguments: args,
    });

    return response as MCPToolResult;
  }

  /**
   * Read a resource from the MCP server
   */
  async readResource(uri: string): Promise<{ contents: { uri: string; text?: string; blob?: string; mimeType?: string }[] }> {
    if (!this.connected) {
      throw new Error('Not connected to MCP server');
    }

    const response = await this.sendRequest('resources/read', { uri });
    return response as { contents: { uri: string; text?: string; blob?: string; mimeType?: string }[] };
  }

  /**
   * Get a prompt from the MCP server
   */
  async getPrompt(name: string, args?: Record<string, string>): Promise<{
    description?: string;
    messages: { role: 'user' | 'assistant'; content: { type: 'text'; text: string }[] }[];
  }> {
    if (!this.connected) {
      throw new Error('Not connected to MCP server');
    }

    const response = await this.sendRequest('prompts/get', { name, arguments: args });
    return response as {
      description?: string;
      messages: { role: 'user' | 'assistant'; content: { type: 'text'; text: string }[] }[];
    };
  }

  /**
   * Request sampling from the MCP server (for AI-in-the-loop)
   */
  async createSamplingRequest(params: {
    messages: { role: 'user' | 'assistant'; content: { type: 'text'; text: string }[] }[];
    modelPreferences?: { hints?: { name?: string }[]; costPriority?: number; speedPriority?: number; intelligencePriority?: number };
    systemPrompt?: string;
    maxTokens: number;
  }): Promise<{
    role: 'assistant';
    content: { type: 'text'; text: string };
    model: string;
    stopReason?: string;
  }> {
    if (!this.connected) {
      throw new Error('Not connected to MCP server');
    }

    if (!this.serverInfo?.capabilities.sampling) {
      throw new Error('Server does not support sampling');
    }

    const response = await this.sendRequest('sampling/createMessage', params);
    return response as {
      role: 'assistant';
      content: { type: 'text'; text: string };
      model: string;
      stopReason?: string;
    };
  }

  // Getters
  get isConnected(): boolean {
    return this.connected;
  }

  get server(): MCPServer | null {
    return this.serverInfo;
  }

  get availableTools(): MCPTool[] {
    return Array.from(this.tools.values());
  }

  get availableResources(): MCPResource[] {
    return Array.from(this.resources.values());
  }

  get availablePrompts(): MCPPrompt[] {
    return Array.from(this.prompts.values());
  }

  /**
   * Get tool by name
   */
  getTool(name: string): MCPTool | undefined {
    return this.tools.get(name);
  }

  // Private: Send JSON-RPC request
  private async sendRequest(method: string, params: Record<string, unknown>): Promise<unknown> {
    if (!this.config.serverUrl) {
      throw new Error('Server URL not configured');
    }

    const id = ++this.messageId;
    const request = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    const response = await fetch(this.config.serverUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {}),
      },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(this.config.timeout || 30000),
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const result = await response.json();

    if (result.error) {
      throw new Error(result.error.message || 'MCP request failed');
    }

    return result.result;
  }

  // Private: Validate tool arguments
  private validateToolArgs(tool: MCPTool, args: Record<string, unknown>): void {
    const schema = tool.inputSchema;

    // Check required fields
    for (const required of schema.required || []) {
      if (!(required in args)) {
        throw new Error(`Missing required argument: ${required}`);
      }
    }

    // Type check (basic)
    for (const [key, value] of Object.entries(args)) {
      const propSchema = schema.properties[key];
      if (!propSchema) {
        // Allow extra properties
        continue;
      }

      const expectedType = propSchema.type;
      const actualType = typeof value;

      if (expectedType === 'string' && actualType !== 'string') {
        throw new Error(`Argument ${key} must be a string`);
      }
      if (expectedType === 'number' && actualType !== 'number') {
        throw new Error(`Argument ${key} must be a number`);
      }
      if (expectedType === 'boolean' && actualType !== 'boolean') {
        throw new Error(`Argument ${key} must be a boolean`);
      }
      if (expectedType === 'array' && !Array.isArray(value)) {
        throw new Error(`Argument ${key} must be an array`);
      }

      // Enum check
      if (propSchema.enum && !propSchema.enum.includes(value as string)) {
        throw new Error(`Argument ${key} must be one of: ${propSchema.enum.join(', ')}`);
      }
    }
  }
}

/**
 * MCP Server Registry - manage multiple MCP connections
 */
export class MCPRegistry {
  private clients: Map<string, MCPClient> = new Map();

  /**
   * Register and connect to an MCP server
   */
  async register(id: string, serverUrl: string, config?: Partial<MCPClientConfig>): Promise<MCPServer> {
    const client = new MCPClient(config);
    const serverInfo = await client.connect(serverUrl);
    this.clients.set(id, client);
    return serverInfo;
  }

  /**
   * Unregister and disconnect from an MCP server
   */
  async unregister(id: string): Promise<void> {
    const client = this.clients.get(id);
    if (client) {
      await client.disconnect();
      this.clients.delete(id);
    }
  }

  /**
   * Get client by ID
   */
  getClient(id: string): MCPClient | undefined {
    return this.clients.get(id);
  }

  /**
   * Get all registered clients
   */
  getAllClients(): { id: string; client: MCPClient }[] {
    return Array.from(this.clients.entries()).map(([id, client]) => ({ id, client }));
  }

  /**
   * Get all available tools across all connected servers
   */
  getAllTools(): { serverId: string; tool: MCPTool }[] {
    const tools: { serverId: string; tool: MCPTool }[] = [];

    for (const [id, client] of this.clients) {
      for (const tool of client.availableTools) {
        tools.push({ serverId: id, tool });
      }
    }

    return tools;
  }

  /**
   * Call a tool on a specific server
   */
  async callTool(serverId: string, toolName: string, args: Record<string, unknown>): Promise<MCPToolResult> {
    const client = this.clients.get(serverId);
    if (!client) {
      throw new Error(`MCP server not found: ${serverId}`);
    }
    return client.callTool(toolName, args);
  }

  /**
   * Find and call a tool by name (searches all servers)
   */
  async callToolByName(toolName: string, args: Record<string, unknown>): Promise<MCPToolResult> {
    for (const [, client] of this.clients) {
      if (client.getTool(toolName)) {
        return client.callTool(toolName, args);
      }
    }
    throw new Error(`Tool not found: ${toolName}`);
  }
}

// Singleton registry
let registryInstance: MCPRegistry | null = null;

export function getMCPRegistry(): MCPRegistry {
  if (!registryInstance) {
    registryInstance = new MCPRegistry();
  }
  return registryInstance;
}
