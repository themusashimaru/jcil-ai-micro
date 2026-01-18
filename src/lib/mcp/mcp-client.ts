/**
 * REAL MCP CLIENT IMPLEMENTATION
 *
 * Implements the actual Model Context Protocol:
 * - Spawns MCP server processes
 * - JSON-RPC communication over stdio
 * - Tool discovery from real servers
 * - Proper protocol message handling
 *
 * This is REAL MCP, not a facade.
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { logger } from '@/lib/logger';
import { v4 as uuidv4 } from 'uuid';

const log = logger('MCPClient');

// ============================================================================
// MCP PROTOCOL TYPES (Based on official MCP spec)
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
}

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: {
    type: 'object';
    properties?: Record<string, unknown>;
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
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

export interface MCPCapabilities {
  tools?: { listChanged?: boolean };
  resources?: { subscribe?: boolean; listChanged?: boolean };
  prompts?: { listChanged?: boolean };
  logging?: Record<string, unknown>;
}

export interface MCPServerInfo {
  name: string;
  version: string;
  protocolVersion: string;
}

// JSON-RPC types
interface JSONRPCRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: unknown;
}

interface JSONRPCResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

interface JSONRPCNotification {
  jsonrpc: '2.0';
  method: string;
  params?: unknown;
}

// ============================================================================
// MCP CLIENT
// ============================================================================

export class MCPClient extends EventEmitter {
  private config: MCPServerConfig;
  private process: ChildProcess | null = null;
  private pendingRequests: Map<string | number, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();
  private buffer = '';
  private requestId = 0;
  private initialized = false;

  // Server capabilities and info
  public serverInfo: MCPServerInfo | null = null;
  public capabilities: MCPCapabilities | null = null;
  public tools: MCPTool[] = [];
  public resources: MCPResource[] = [];
  public prompts: MCPPrompt[] = [];

  constructor(config: MCPServerConfig) {
    super();
    this.config = config;
  }

  /**
   * Start the MCP server and establish connection
   */
  async connect(): Promise<void> {
    if (this.process) {
      throw new Error('Already connected');
    }

    log.info('Starting MCP server', { id: this.config.id, command: this.config.command });

    // Resolve environment variables
    const env: Record<string, string> = { ...process.env as Record<string, string> };
    if (this.config.env) {
      for (const [key, value] of Object.entries(this.config.env)) {
        // Resolve ${VAR} patterns from process.env
        env[key] = value.replace(/\$\{(\w+)\}/g, (_, varName) => process.env[varName] || '');
      }
    }

    // Spawn the MCP server process
    this.process = spawn(this.config.command, this.config.args || [], {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Set up stdout handling (JSON-RPC messages)
    this.process.stdout?.on('data', (data) => {
      this.handleData(data.toString());
    });

    // Set up stderr handling (logging)
    this.process.stderr?.on('data', (data) => {
      log.debug(`[${this.config.id}] stderr: ${data.toString().trim()}`);
    });

    // Handle process exit
    this.process.on('exit', (code, signal) => {
      log.info('MCP server exited', { id: this.config.id, code, signal });
      this.cleanup();
      this.emit('exit', { code, signal });
    });

    this.process.on('error', (error) => {
      log.error('MCP server error', error);
      this.emit('error', error);
    });

    // Wait a bit for the process to start
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Initialize the connection
    await this.initialize();
  }

  /**
   * Initialize the MCP connection (handshake)
   */
  private async initialize(): Promise<void> {
    try {
      // Send initialize request
      const result = await this.sendRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {
          roots: {
            listChanged: true,
          },
          sampling: {},
        },
        clientInfo: {
          name: 'CodeLab',
          version: '1.0.0',
        },
      });

      const initResult = result as {
        protocolVersion: string;
        capabilities: MCPCapabilities;
        serverInfo: MCPServerInfo;
      };

      this.serverInfo = initResult.serverInfo;
      this.capabilities = initResult.capabilities;

      // Send initialized notification
      await this.sendNotification('notifications/initialized', {});

      this.initialized = true;

      log.info('MCP server initialized', {
        id: this.config.id,
        serverName: this.serverInfo?.name,
        serverVersion: this.serverInfo?.version,
      });

      // Discover available tools, resources, and prompts
      await this.discoverCapabilities();

    } catch (error) {
      log.error('MCP initialization failed', error as Error);
      throw error;
    }
  }

  /**
   * Discover tools, resources, and prompts from the server
   */
  private async discoverCapabilities(): Promise<void> {
    // Discover tools
    if (this.capabilities?.tools) {
      try {
        const result = await this.sendRequest('tools/list', {});
        this.tools = (result as { tools: MCPTool[] }).tools || [];
        log.info('Discovered tools', { id: this.config.id, count: this.tools.length });
      } catch (error) {
        log.warn('Failed to list tools', { error });
      }
    }

    // Discover resources
    if (this.capabilities?.resources) {
      try {
        const result = await this.sendRequest('resources/list', {});
        this.resources = (result as { resources: MCPResource[] }).resources || [];
        log.info('Discovered resources', { id: this.config.id, count: this.resources.length });
      } catch (error) {
        log.warn('Failed to list resources', { error });
      }
    }

    // Discover prompts
    if (this.capabilities?.prompts) {
      try {
        const result = await this.sendRequest('prompts/list', {});
        this.prompts = (result as { prompts: MCPPrompt[] }).prompts || [];
        log.info('Discovered prompts', { id: this.config.id, count: this.prompts.length });
      } catch (error) {
        log.warn('Failed to list prompts', { error });
      }
    }
  }

  /**
   * Call a tool
   */
  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    if (!this.initialized) {
      throw new Error('MCP client not initialized');
    }

    log.debug('Calling MCP tool', { id: this.config.id, tool: name });

    const result = await this.sendRequest('tools/call', {
      name,
      arguments: args,
    });

    return (result as { content: unknown[] }).content;
  }

  /**
   * Read a resource
   */
  async readResource(uri: string): Promise<{ contents: Array<{ uri: string; mimeType?: string; text?: string; blob?: string }> }> {
    if (!this.initialized) {
      throw new Error('MCP client not initialized');
    }

    log.debug('Reading MCP resource', { id: this.config.id, uri });

    const result = await this.sendRequest('resources/read', { uri });

    return result as { contents: Array<{ uri: string; mimeType?: string; text?: string; blob?: string }> };
  }

  /**
   * Get a prompt
   */
  async getPrompt(name: string, args?: Record<string, string>): Promise<{ description?: string; messages: Array<{ role: string; content: unknown }> }> {
    if (!this.initialized) {
      throw new Error('MCP client not initialized');
    }

    log.debug('Getting MCP prompt', { id: this.config.id, name });

    const result = await this.sendRequest('prompts/get', {
      name,
      arguments: args,
    });

    return result as { description?: string; messages: Array<{ role: string; content: unknown }> };
  }

  /**
   * Send a JSON-RPC request
   */
  private sendRequest(method: string, params?: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = ++this.requestId;
      const timeout = this.config.timeout || 30000;

      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, timeout);

      this.pendingRequests.set(id, { resolve, reject, timeout: timeoutHandle });

      const request: JSONRPCRequest = {
        jsonrpc: '2.0',
        id,
        method,
        params,
      };

      this.send(request);
    });
  }

  /**
   * Send a JSON-RPC notification
   */
  private sendNotification(method: string, params?: unknown): void {
    const notification: JSONRPCNotification = {
      jsonrpc: '2.0',
      method,
      params,
    };

    this.send(notification);
  }

  /**
   * Send a message to the server
   */
  private send(message: JSONRPCRequest | JSONRPCNotification): void {
    if (!this.process?.stdin?.writable) {
      throw new Error('Server stdin not writable');
    }

    const data = JSON.stringify(message) + '\n';
    this.process.stdin.write(data);
  }

  /**
   * Handle incoming data from the server
   */
  private handleData(data: string): void {
    this.buffer += data;

    // Process complete lines
    let newlineIndex: number;
    while ((newlineIndex = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.slice(0, newlineIndex).trim();
      this.buffer = this.buffer.slice(newlineIndex + 1);

      if (line) {
        try {
          const message = JSON.parse(line);
          this.handleMessage(message);
        } catch (error) {
          log.warn('Failed to parse message', { line, error });
        }
      }
    }
  }

  /**
   * Handle a parsed JSON-RPC message
   */
  private handleMessage(message: JSONRPCResponse | JSONRPCNotification): void {
    // Check if it's a response
    if ('id' in message && message.id !== undefined) {
      const response = message as JSONRPCResponse;
      const pending = this.pendingRequests.get(response.id);

      if (pending) {
        clearTimeout(pending.timeout);
        this.pendingRequests.delete(response.id);

        if (response.error) {
          pending.reject(new Error(`${response.error.code}: ${response.error.message}`));
        } else {
          pending.resolve(response.result);
        }
      }
    } else {
      // It's a notification
      const notification = message as JSONRPCNotification;
      this.emit('notification', notification);

      // Handle specific notifications
      if (notification.method === 'notifications/tools/list_changed') {
        this.discoverCapabilities();
      }
    }
  }

  /**
   * Disconnect from the server
   */
  async disconnect(): Promise<void> {
    if (!this.process) return;

    log.info('Disconnecting MCP server', { id: this.config.id });

    // Cancel pending requests
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Client disconnected'));
    }
    this.pendingRequests.clear();

    // Kill the process
    this.process.kill();
    this.cleanup();
  }

  /**
   * Clean up state
   */
  private cleanup(): void {
    this.process = null;
    this.initialized = false;
    this.serverInfo = null;
    this.capabilities = null;
    this.tools = [];
    this.resources = [];
    this.prompts = [];
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.process !== null && this.initialized;
  }

  /**
   * Get server status
   */
  getStatus(): 'running' | 'stopped' | 'error' {
    if (this.isConnected()) return 'running';
    if (this.process) return 'error';
    return 'stopped';
  }
}

// ============================================================================
// MCP CLIENT MANAGER
// ============================================================================

export class MCPClientManager {
  private clients: Map<string, MCPClient> = new Map();

  /**
   * Add and connect a server
   */
  async addServer(config: MCPServerConfig): Promise<MCPClient> {
    if (this.clients.has(config.id)) {
      throw new Error(`Server already exists: ${config.id}`);
    }

    const client = new MCPClient(config);
    this.clients.set(config.id, client);

    if (config.enabled) {
      await client.connect();
    }

    return client;
  }

  /**
   * Remove and disconnect a server
   */
  async removeServer(id: string): Promise<void> {
    const client = this.clients.get(id);
    if (client) {
      await client.disconnect();
      this.clients.delete(id);
    }
  }

  /**
   * Get a client by ID
   */
  getClient(id: string): MCPClient | undefined {
    return this.clients.get(id);
  }

  /**
   * Get all clients
   */
  getAllClients(): MCPClient[] {
    return Array.from(this.clients.values());
  }

  /**
   * Get all available tools across all connected servers
   */
  getAllTools(): Array<MCPTool & { serverId: string }> {
    const tools: Array<MCPTool & { serverId: string }> = [];

    for (const [id, client] of this.clients) {
      if (client.isConnected()) {
        for (const tool of client.tools) {
          tools.push({ ...tool, serverId: id });
        }
      }
    }

    return tools;
  }

  /**
   * Call a tool on a specific server
   */
  async callTool(serverId: string, name: string, args: Record<string, unknown>): Promise<unknown> {
    const client = this.clients.get(serverId);
    if (!client) {
      throw new Error(`Server not found: ${serverId}`);
    }

    return client.callTool(name, args);
  }

  /**
   * Disconnect all servers
   */
  async disconnectAll(): Promise<void> {
    for (const client of this.clients.values()) {
      await client.disconnect();
    }
    this.clients.clear();
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let mcpManagerInstance: MCPClientManager | null = null;

export function getMCPManager(): MCPClientManager {
  if (!mcpManagerInstance) {
    mcpManagerInstance = new MCPClientManager();
  }
  return mcpManagerInstance;
}
