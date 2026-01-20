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
import { ContainerManager, getContainerManager } from '@/lib/workspace/container';

const log = logger('MCPClient');

// ============================================================================
// ENVIRONMENT VARIABLE SECURITY (HIGH-007 FIX)
// ============================================================================

/**
 * Dangerous environment variables that should never be overridden by user config
 * These can lead to code execution, library injection, or security bypass
 */
const BLOCKED_ENV_VARS = new Set([
  // Path manipulation
  'PATH',
  'LD_LIBRARY_PATH',
  'LD_PRELOAD',
  'DYLD_LIBRARY_PATH',
  'DYLD_INSERT_LIBRARIES',
  // Home/config directory hijacking
  'HOME',
  'USERPROFILE',
  'XDG_CONFIG_HOME',
  'XDG_DATA_HOME',
  // Node.js security
  'NODE_OPTIONS',
  'NODE_PATH',
  'NODE_ENV',
  'NODE_DEBUG',
  'NODE_EXTRA_CA_CERTS',
  // Shell/command execution
  'SHELL',
  'COMSPEC',
  'IFS',
  'BASH_ENV',
  'ENV',
  'CDPATH',
  // Python security
  'PYTHONPATH',
  'PYTHONSTARTUP',
  'PYTHONHOME',
  // Ruby security
  'RUBYLIB',
  'RUBYOPT',
  // Proxy hijacking (could redirect traffic)
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'ALL_PROXY',
  'NO_PROXY',
  'http_proxy',
  'https_proxy',
  // SSL/TLS certificate manipulation
  'SSL_CERT_FILE',
  'SSL_CERT_DIR',
  'CURL_CA_BUNDLE',
  'REQUESTS_CA_BUNDLE',
  // Git security
  'GIT_SSH',
  'GIT_SSH_COMMAND',
  'GIT_ASKPASS',
  'GIT_EXEC_PATH',
  // AWS/Cloud credentials (prevent exfiltration vectors)
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'AWS_SESSION_TOKEN',
  'GOOGLE_APPLICATION_CREDENTIALS',
  'AZURE_CLIENT_SECRET',
]);

/**
 * Sanitize environment variables from user config
 * Removes blocked variables and validates format
 */
function sanitizeEnvVars(env: Record<string, string> | undefined): Record<string, string> {
  if (!env) return {};

  const sanitized: Record<string, string> = {};

  for (const [key, value] of Object.entries(env)) {
    // Check if key is blocked (case-insensitive)
    if (BLOCKED_ENV_VARS.has(key) || BLOCKED_ENV_VARS.has(key.toUpperCase())) {
      log.warn('Blocked dangerous environment variable', { key });
      continue;
    }

    // Validate key format (alphanumeric and underscore only)
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      log.warn('Invalid environment variable name', { key });
      continue;
    }

    // Validate value (no null bytes or shell metacharacters in value)
    if (value.includes('\0') || /[`$]/.test(value)) {
      log.warn('Invalid environment variable value', { key });
      continue;
    }

    sanitized[key] = value;
  }

  return sanitized;
}

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
    this.container = getContainerManager();
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

    // HIGH-007 FIX: Sanitize environment variables to prevent injection attacks
    // 1. First sanitize raw env vars (block dangerous keys)
    const sanitizedConfig = sanitizeEnvVars(this.config.env);

    // 2. Resolve ${VAR} patterns from process.env
    const customEnv: Record<string, string> = {};
    for (const [key, value] of Object.entries(sanitizedConfig)) {
      customEnv[key] = value.replace(/\$\{(\w+)\}/g, (_, varName) => process.env[varName] || '');
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
  async readResource(uri: string): Promise<{
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
   * Subscribe to resource updates (MCP spec feature)
   * Server will send notifications when the resource changes
   */
  async subscribeToResource(uri: string): Promise<boolean> {
    if (!this.initialized) {
      throw new Error('MCP client not initialized');
    }

    // Check if server supports resource subscriptions
    if (!this.capabilities?.resources?.subscribe) {
      log.warn('Server does not support resource subscriptions', { id: this.config.id });
      return false;
    }

    log.debug('Subscribing to resource', { id: this.config.id, uri });

    try {
      await this.sendRequest('resources/subscribe', { uri });
      log.info('Subscribed to resource', { id: this.config.id, uri });
      return true;
    } catch (error) {
      log.error('Failed to subscribe to resource', { id: this.config.id, uri, error });
      return false;
    }
  }

  /**
   * Unsubscribe from resource updates
   */
  async unsubscribeFromResource(uri: string): Promise<boolean> {
    if (!this.initialized) {
      throw new Error('MCP client not initialized');
    }

    if (!this.capabilities?.resources?.subscribe) {
      return false;
    }

    log.debug('Unsubscribing from resource', { id: this.config.id, uri });

    try {
      await this.sendRequest('resources/unsubscribe', { uri });
      log.info('Unsubscribed from resource', { id: this.config.id, uri });
      return true;
    } catch (error) {
      log.error('Failed to unsubscribe from resource', { id: this.config.id, uri, error });
      return false;
    }
  }

  /**
   * Set handler for resource update notifications
   */
  onResourceUpdated(handler: (uri: string) => void): () => void {
    const listener = (data: { uri: string }) => {
      handler(data.uri);
    };
    this.on('resourceUpdated', listener);
    return () => this.off('resourceUpdated', listener);
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
      switch (notification.method) {
        case 'notifications/tools/list_changed':
          this.discoverCapabilities();
          break;
        case 'notifications/resources/list_changed':
          this.discoverCapabilities();
          break;
        case 'notifications/resources/updated': {
          // MCP spec: Resource subscription update notification
          const params = notification.params as { uri: string } | undefined;
          if (params?.uri) {
            log.debug('Resource updated notification', { id: this.config.id, uri: params.uri });
            this.emit('resourceUpdated', { uri: params.uri });
          }
          break;
        }
        case 'notifications/prompts/list_changed':
          this.discoverCapabilities();
          break;
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

  /**
   * Reconnect to the server (crash recovery)
   */
  async reconnect(): Promise<void> {
    log.info('Reconnecting MCP server', { id: this.config.id });

    // Clean up existing connection
    if (this.transport) {
      try {
        await this.transport.close();
      } catch {
        // Ignore close errors during reconnect
      }
    }
    this.cleanup();

    // Reconnect
    await this.connect();
    log.info('MCP server reconnected', { id: this.config.id });
  }

  /**
   * Health check - verify server is responsive
   */
  async healthCheck(): Promise<{ healthy: boolean; latencyMs: number }> {
    if (!this.isConnected()) {
      return { healthy: false, latencyMs: -1 };
    }

    const startTime = Date.now();
    try {
      // Try listing tools as a health probe (lightweight, always supported)
      await Promise.race([
        this.sendRequest('ping', {}),
        // Fallback to tools/list if ping not supported
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
      ]).catch(async () => {
        // If ping fails, try tools/list as alternative health check
        await this.sendRequest('tools/list', {});
      });

      const latencyMs = Date.now() - startTime;
      return { healthy: true, latencyMs };
    } catch {
      return { healthy: false, latencyMs: -1 };
    }
  }
}

// ============================================================================
// MCP CLIENT MANAGER
// ============================================================================

/** Health monitoring interval in milliseconds */
const MCP_HEALTH_CHECK_INTERVAL_MS = 60000; // 1 minute

/** Maximum consecutive failures before restart */
const MCP_MAX_CONSECUTIVE_FAILURES = 3;

export class MCPClientManager {
  private clients: Map<string, MCPClient> = new Map();
  private configs: Map<string, MCPServerConfig> = new Map();
  private healthMonitorInterval: NodeJS.Timeout | null = null;
  private failureCounts: Map<string, number> = new Map();
  private autoRestartEnabled: boolean = true;

  constructor() {
    // Start health monitoring
    this.startHealthMonitor();
  }

  /**
   * Start health monitoring for all servers
   */
  private startHealthMonitor(): void {
    if (this.healthMonitorInterval) return;

    this.healthMonitorInterval = setInterval(async () => {
      await this.runHealthChecks();
    }, MCP_HEALTH_CHECK_INTERVAL_MS);

    log.debug('MCP health monitor started', { interval: MCP_HEALTH_CHECK_INTERVAL_MS });
  }

  /**
   * Run health checks on all active servers
   */
  private async runHealthChecks(): Promise<void> {
    for (const [id, client] of this.clients.entries()) {
      try {
        const result = await client.healthCheck();

        if (result.healthy) {
          // Reset failure count on success
          this.failureCounts.set(id, 0);
          log.debug('MCP health check passed', { id, latencyMs: result.latencyMs });
        } else {
          // Increment failure count
          const failures = (this.failureCounts.get(id) || 0) + 1;
          this.failureCounts.set(id, failures);
          log.warn('MCP health check failed', { id, failures });

          // Auto-restart after max consecutive failures
          if (this.autoRestartEnabled && failures >= MCP_MAX_CONSECUTIVE_FAILURES) {
            const config = this.configs.get(id);
            if (config) {
              log.warn('MCP auto-restarting due to health failures', { id, failures });
              try {
                await client.reconnect();
                this.failureCounts.set(id, 0);
                log.info('MCP auto-restart successful', { id });
              } catch (error) {
                log.error('MCP auto-restart failed', { id, error });
              }
            }
          }
        }
      } catch (error) {
        log.error('MCP health check error', { id, error });
      }
    }
  }

  /**
   * Stop health monitoring
   */
  stopHealthMonitor(): void {
    if (this.healthMonitorInterval) {
      clearInterval(this.healthMonitorInterval);
      this.healthMonitorInterval = null;
      log.debug('MCP health monitor stopped');
    }
  }

  /**
   * Enable or disable auto-restart on failures
   */
  setAutoRestart(enabled: boolean): void {
    this.autoRestartEnabled = enabled;
    log.info('MCP auto-restart', { enabled });
  }

  /**
   * Add and connect a server
   */
  async addServer(config: MCPServerConfig): Promise<MCPClient> {
    if (this.clients.has(config.id)) {
      throw new Error(`Server already exists: ${config.id}`);
    }

    const client = new MCPClient(config);
    this.clients.set(config.id, client);
    this.configs.set(config.id, config);

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
      this.configs.delete(id);
      this.failureCounts.delete(id);
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
    // Stop health monitoring first
    this.stopHealthMonitor();

    for (const client of this.clients.values()) {
      await client.disconnect();
    }
    this.clients.clear();
    this.configs.clear();
    this.failureCounts.clear();
  }

  /**
   * Get health status of all servers
   */
  async getHealthStatus(): Promise<
    Array<{
      id: string;
      status: 'running' | 'stopped' | 'error';
      healthy: boolean;
      latencyMs: number;
      failureCount: number;
    }>
  > {
    const results = [];

    for (const [id, client] of this.clients.entries()) {
      const status = client.getStatus();
      const failureCount = this.failureCounts.get(id) || 0;

      if (status === 'running') {
        const health = await client.healthCheck();
        results.push({
          id,
          status,
          healthy: health.healthy,
          latencyMs: health.latencyMs,
          failureCount,
        });
      } else {
        results.push({
          id,
          status,
          healthy: false,
          latencyMs: -1,
          failureCount,
        });
      }
    }

    return results;
  }

  /**
   * Force restart a specific server
   */
  async restartServer(id: string): Promise<boolean> {
    const client = this.clients.get(id);
    if (!client) {
      log.warn('Cannot restart: server not found', { id });
      return false;
    }

    try {
      await client.reconnect();
      this.failureCounts.set(id, 0);
      log.info('MCP server restarted manually', { id });
      return true;
    } catch (error) {
      log.error('Failed to restart MCP server', { id, error });
      return false;
    }
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
