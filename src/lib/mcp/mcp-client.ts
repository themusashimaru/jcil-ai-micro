/**
 * REAL MCP CLIENT IMPLEMENTATION
 *
 * Implements the actual Model Context Protocol:
 * - Spawns MCP server processes (locally or in E2B containers)
 * - JSON-RPC communication over stdio
 * - Tool discovery from real servers
 * - Proper protocol message handling
 * - Container-aware transport for workspace integration
 *
 * This is REAL MCP, not a facade.
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { logger } from '@/lib/logger';
import { ContainerManager } from '@/lib/workspace/container';

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
  // Container integration
  workspaceId?: string; // If provided, run MCP server in E2B container
  containerCwd?: string; // Working directory in container (default: /workspace)
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
// MCP TRANSPORT INTERFACE
// ============================================================================

interface MCPTransport {
  send(message: string): Promise<void>;
  onData(handler: (data: string) => void): void;
  onError(handler: (error: Error) => void): void;
  onClose(handler: (code: number | null, signal: string | null) => void): void;
  close(): Promise<void>;
}

// ============================================================================
// LOCAL STDIO TRANSPORT
// ============================================================================

class LocalStdioTransport implements MCPTransport {
  private process: ChildProcess;
  private dataHandler: ((data: string) => void) | null = null;
  private errorHandler: ((error: Error) => void) | null = null;
  private closeHandler: ((code: number | null, signal: string | null) => void) | null = null;

  constructor(command: string, args: string[], env: Record<string, string>) {
    this.process = spawn(command, args, {
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.process.stdout?.on('data', (data) => {
      this.dataHandler?.(data.toString());
    });

    this.process.stderr?.on('data', (data) => {
      log.debug(`[LocalTransport] stderr: ${data.toString().trim()}`);
    });

    this.process.on('exit', (code, signal) => {
      this.closeHandler?.(code, signal);
    });

    this.process.on('error', (error) => {
      this.errorHandler?.(error);
    });
  }

  async send(message: string): Promise<void> {
    if (!this.process.stdin?.writable) {
      throw new Error('Transport stdin not writable');
    }
    this.process.stdin.write(message + '\n');
  }

  onData(handler: (data: string) => void): void {
    this.dataHandler = handler;
  }

  onError(handler: (error: Error) => void): void {
    this.errorHandler = handler;
  }

  onClose(handler: (code: number | null, signal: string | null) => void): void {
    this.closeHandler = handler;
  }

  async close(): Promise<void> {
    this.process.kill();
  }
}

// ============================================================================
// CONTAINER TRANSPORT (E2B)
// ============================================================================

class ContainerTransport implements MCPTransport {
  private container: ContainerManager;
  private workspaceId: string;
  private command: string;
  private args: string[];
  private env: Record<string, string>;
  private cwd: string;
  private dataHandler: ((data: string) => void) | null = null;
  private errorHandler: ((error: Error) => void) | null = null;
  private closeHandler: ((code: number | null, signal: string | null) => void) | null = null;
  private isConnected = false;
  private requestQueue: Array<{
    message: string;
    resolve: () => void;
    reject: (error: Error) => void;
  }> = [];
  private isSending = false;

  constructor(
    workspaceId: string,
    command: string,
    args: string[],
    env: Record<string, string>,
    cwd: string
  ) {
    this.container = new ContainerManager();
    this.workspaceId = workspaceId;
    this.command = command;
    this.args = args;
    this.env = env;
    this.cwd = cwd;
    this.isConnected = true;
  }

  /**
   * Send a message by executing MCP server with request via stdin
   * Uses a wrapper approach for request-response communication
   */
  async send(message: string): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Transport not connected');
    }

    return new Promise((resolve, reject) => {
      this.requestQueue.push({ message, resolve, reject });
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isSending || this.requestQueue.length === 0) {
      return;
    }

    this.isSending = true;
    const request = this.requestQueue.shift()!;

    try {
      // Build environment string for the container command
      const envStr = Object.entries(this.env)
        .map(([k, v]) => `${k}="${v}"`)
        .join(' ');

      // Create a helper script that sends the request and captures response
      // The MCP server reads from stdin and writes to stdout
      const argsStr = this.args.map((a) => `"${a}"`).join(' ');
      const escapedMessage = request.message.replace(/"/g, '\\"').replace(/\n/g, '\\n');

      // Use echo to pipe the message to the MCP server
      const command = `cd ${this.cwd} && echo '${escapedMessage}' | ${envStr} ${this.command} ${argsStr}`;

      log.debug('Container MCP command', { command: command.substring(0, 200) });

      const result = await this.container.executeCommand(this.workspaceId, command, {
        timeout: 30000,
      });

      if (result.exitCode !== 0 && result.stderr) {
        log.warn('Container MCP stderr', { stderr: result.stderr });
      }

      // Parse and emit response data
      if (result.stdout) {
        this.dataHandler?.(result.stdout);
      }

      request.resolve();
    } catch (error) {
      log.error('Container MCP send failed', error as Error);
      request.reject(error as Error);
      this.errorHandler?.(error as Error);
    } finally {
      this.isSending = false;
      // Process next request in queue
      if (this.requestQueue.length > 0) {
        this.processQueue();
      }
    }
  }

  onData(handler: (data: string) => void): void {
    this.dataHandler = handler;
  }

  onError(handler: (error: Error) => void): void {
    this.errorHandler = handler;
  }

  onClose(handler: (code: number | null, signal: string | null) => void): void {
    this.closeHandler = handler;
  }

  async close(): Promise<void> {
    this.isConnected = false;
    this.closeHandler?.(0, null);
  }
}

// ============================================================================
// MCP CLIENT
// ============================================================================

export class MCPClient extends EventEmitter {
  private config: MCPServerConfig;
  private transport: MCPTransport | null = null;
  private pendingRequests: Map<
    string | number,
    {
      resolve: (value: unknown) => void;
      reject: (error: Error) => void;
      timeout: NodeJS.Timeout;
    }
  > = new Map();
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
    if (this.transport) {
      throw new Error('Already connected');
    }

    log.info('Starting MCP server', {
      id: this.config.id,
      command: this.config.command,
      workspaceId: this.config.workspaceId,
    });

    // Resolve environment variables - spread process.env and add custom vars
    const customEnv: Record<string, string> = {};
    if (this.config.env) {
      for (const [key, value] of Object.entries(this.config.env)) {
        // Resolve ${VAR} patterns from process.env
        customEnv[key] = value.replace(/\$\{(\w+)\}/g, (_, varName) => process.env[varName] || '');
      }
    }

    // Choose transport based on configuration
    if (this.config.workspaceId) {
      // Use container transport for workspace execution
      this.transport = new ContainerTransport(
        this.config.workspaceId,
        this.config.command,
        this.config.args || [],
        customEnv,
        this.config.containerCwd || '/workspace'
      );
      log.info('Using container transport', { workspaceId: this.config.workspaceId });
    } else {
      // Use local stdio transport
      this.transport = new LocalStdioTransport(
        this.config.command,
        this.config.args || [],
        customEnv
      );
      log.info('Using local stdio transport');
    }

    // Set up transport event handlers
    this.transport.onData((data) => {
      this.handleData(data);
    });

    this.transport.onError((error) => {
      log.error('MCP server error', error);
      this.emit('error', error);
    });

    this.transport.onClose((code, signal) => {
      log.info('MCP server exited', { id: this.config.id, code, signal });
      this.cleanup();
      this.emit('exit', { code, signal });
    });

    // Wait a bit for the process to start (only needed for local transport)
    if (!this.config.workspaceId) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

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
  async readResource(
    uri: string
  ): Promise<{
    contents: Array<{ uri: string; mimeType?: string; text?: string; blob?: string }>;
  }> {
    if (!this.initialized) {
      throw new Error('MCP client not initialized');
    }

    log.debug('Reading MCP resource', { id: this.config.id, uri });

    const result = await this.sendRequest('resources/read', { uri });

    return result as {
      contents: Array<{ uri: string; mimeType?: string; text?: string; blob?: string }>;
    };
  }

  /**
   * Get a prompt
   */
  async getPrompt(
    name: string,
    args?: Record<string, string>
  ): Promise<{ description?: string; messages: Array<{ role: string; content: unknown }> }> {
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

      // Send is now async but we don't await it here
      // The response will come through handleData
      this.send(request).catch((err) => {
        this.pendingRequests.delete(id);
        clearTimeout(timeoutHandle);
        reject(err);
      });
    });
  }

  /**
   * Send a JSON-RPC notification
   */
  private async sendNotification(method: string, params?: unknown): Promise<void> {
    const notification: JSONRPCNotification = {
      jsonrpc: '2.0',
      method,
      params,
    };

    await this.send(notification);
  }

  /**
   * Send a message to the server
   */
  private async send(message: JSONRPCRequest | JSONRPCNotification): Promise<void> {
    if (!this.transport) {
      throw new Error('Transport not connected');
    }

    const data = JSON.stringify(message);
    await this.transport.send(data);
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
    if (!this.transport) return;

    log.info('Disconnecting MCP server', { id: this.config.id });

    // Cancel pending requests
    for (const pending of this.pendingRequests.values()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Client disconnected'));
    }
    this.pendingRequests.clear();

    // Close the transport
    await this.transport.close();
    this.cleanup();
  }

  /**
   * Clean up state
   */
  private cleanup(): void {
    this.transport = null;
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
    return this.transport !== null && this.initialized;
  }

  /**
   * Get server status
   */
  getStatus(): 'running' | 'stopped' | 'error' {
    if (this.isConnected()) return 'running';
    if (this.transport) return 'error';
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
