/**
 * LSP CLIENT
 *
 * Language Server Protocol client for code intelligence features.
 * Supports TypeScript, Python, and Go language servers.
 *
 * Features:
 * - Go-to-definition
 * - Find references
 * - Hover information
 * - Code completions
 * - Diagnostics
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { logger } from '@/lib/logger';
import * as path from 'path';

const log = logger('LSPClient');

// ============================================================================
// LSP PROTOCOL TYPES
// ============================================================================

export interface Position {
  line: number; // 0-based
  character: number; // 0-based
}

export interface Range {
  start: Position;
  end: Position;
}

export interface Location {
  uri: string;
  range: Range;
}

export interface TextDocumentIdentifier {
  uri: string;
}

export interface TextDocumentPositionParams {
  textDocument: TextDocumentIdentifier;
  position: Position;
}

export interface TextDocumentItem {
  uri: string;
  languageId: string;
  version: number;
  text: string;
}

export interface VersionedTextDocumentIdentifier extends TextDocumentIdentifier {
  version: number;
}

export interface TextDocumentContentChangeEvent {
  text: string;
}

export interface Diagnostic {
  range: Range;
  severity?: DiagnosticSeverity;
  code?: string | number;
  source?: string;
  message: string;
  relatedInformation?: DiagnosticRelatedInformation[];
}

export interface DiagnosticRelatedInformation {
  location: Location;
  message: string;
}

export enum DiagnosticSeverity {
  Error = 1,
  Warning = 2,
  Information = 3,
  Hint = 4,
}

export interface CompletionItem {
  label: string;
  kind?: CompletionItemKind;
  detail?: string;
  documentation?: string | MarkupContent;
  insertText?: string;
  textEdit?: TextEdit;
}

export enum CompletionItemKind {
  Text = 1,
  Method = 2,
  Function = 3,
  Constructor = 4,
  Field = 5,
  Variable = 6,
  Class = 7,
  Interface = 8,
  Module = 9,
  Property = 10,
  Unit = 11,
  Value = 12,
  Enum = 13,
  Keyword = 14,
  Snippet = 15,
  Color = 16,
  File = 17,
  Reference = 18,
  Folder = 19,
  EnumMember = 20,
  Constant = 21,
  Struct = 22,
  Event = 23,
  Operator = 24,
  TypeParameter = 25,
}

export interface MarkupContent {
  kind: 'plaintext' | 'markdown';
  value: string;
}

export interface Hover {
  contents: MarkupContent | string | Array<MarkupContent | string>;
  range?: Range;
}

export interface TextEdit {
  range: Range;
  newText: string;
}

export interface WorkspaceEdit {
  changes?: { [uri: string]: TextEdit[] };
}

export interface SignatureHelp {
  signatures: SignatureInformation[];
  activeSignature?: number;
  activeParameter?: number;
}

export interface SignatureInformation {
  label: string;
  documentation?: string | MarkupContent;
  parameters?: ParameterInformation[];
}

export interface ParameterInformation {
  label: string | [number, number];
  documentation?: string | MarkupContent;
}

// ============================================================================
// SERVER CONFIGURATIONS
// ============================================================================

export type LanguageServerType = 'typescript' | 'python' | 'go';

interface ServerConfig {
  command: string;
  args: string[];
  rootPattern: string[];
  initializationOptions?: Record<string, unknown>;
}

const SERVER_CONFIGS: Record<LanguageServerType, ServerConfig> = {
  typescript: {
    command: 'typescript-language-server',
    args: ['--stdio'],
    rootPattern: ['tsconfig.json', 'package.json', 'jsconfig.json'],
    initializationOptions: {
      preferences: {
        includeInlayParameterNameHints: 'all',
        includeInlayPropertyDeclarationTypeHints: true,
        includeInlayFunctionLikeReturnTypeHints: true,
      },
    },
  },
  python: {
    command: 'pylsp',
    args: [],
    rootPattern: ['pyproject.toml', 'setup.py', 'requirements.txt', '.python-version'],
    initializationOptions: {
      pylsp: {
        plugins: {
          pycodestyle: { enabled: false },
          mccabe: { enabled: false },
          pyflakes: { enabled: true },
        },
      },
    },
  },
  go: {
    command: 'gopls',
    args: ['serve'],
    rootPattern: ['go.mod', 'go.sum'],
    initializationOptions: {
      'ui.diagnostic.analyses': {
        unusedparams: true,
        shadow: true,
      },
    },
  },
};

// ============================================================================
// JSON-RPC MESSAGE HANDLING
// ============================================================================

interface JsonRpcMessage {
  jsonrpc: '2.0';
  id?: number | string;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

interface PendingRequest {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  method: string;
  startTime: number;
}

// ============================================================================
// LSP CLIENT CLASS
// ============================================================================

export class LSPClient extends EventEmitter {
  private process: ChildProcess | null = null;
  private serverType: LanguageServerType;
  private workspaceRoot: string;
  private initialized: boolean = false;
  private requestId: number = 0;
  private pendingRequests: Map<number, PendingRequest> = new Map();
  private buffer: Buffer = Buffer.alloc(0);
  private openDocuments: Map<string, number> = new Map(); // uri -> version
  private capabilities: Record<string, unknown> = {};

  constructor(serverType: LanguageServerType, workspaceRoot: string) {
    super();
    this.serverType = serverType;
    this.workspaceRoot = workspaceRoot;
  }

  /**
   * Start the language server process
   */
  async start(): Promise<void> {
    if (this.process) {
      log.warn('LSP server already running', { type: this.serverType });
      return;
    }

    const config = SERVER_CONFIGS[this.serverType];

    log.info('Starting LSP server', {
      type: this.serverType,
      command: config.command,
      args: config.args,
    });

    try {
      this.process = spawn(config.command, config.args, {
        cwd: this.workspaceRoot,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          // Ensure proper PATH for language servers
          PATH: `${process.env.PATH}:/usr/local/bin:/usr/bin`,
        },
      });

      this.process.stdout?.on('data', (data: Buffer) => this.handleData(data));
      this.process.stderr?.on('data', (data: Buffer) => {
        log.debug('LSP stderr', { type: this.serverType, data: data.toString() });
      });

      this.process.on('error', (error) => {
        log.error('LSP process error', { type: this.serverType, error });
        this.emit('error', error);
      });

      this.process.on('exit', (code) => {
        log.info('LSP process exited', { type: this.serverType, code });
        this.initialized = false;
        this.process = null;
        this.emit('exit', code);
      });

      // Initialize the server
      await this.initialize();
    } catch (error) {
      log.error('Failed to start LSP server', { type: this.serverType, error });
      throw error;
    }
  }

  /**
   * Stop the language server
   */
  async stop(): Promise<void> {
    if (!this.process) return;

    try {
      await this.sendRequest('shutdown', null);
      this.sendNotification('exit', null);
    } catch {
      // Ignore errors during shutdown
    }

    this.process.kill();
    this.process = null;
    this.initialized = false;
    this.openDocuments.clear();
    this.pendingRequests.clear();
  }

  /**
   * Check if the server is running and initialized
   */
  isReady(): boolean {
    return this.initialized && this.process !== null;
  }

  // ============================================================================
  // DOCUMENT MANAGEMENT
  // ============================================================================

  /**
   * Open a document in the language server
   */
  async openDocument(uri: string, text: string, languageId?: string): Promise<void> {
    if (!this.isReady()) {
      throw new Error('LSP server not ready');
    }

    const lang = languageId || this.detectLanguage(uri);
    const version = 1;

    this.sendNotification('textDocument/didOpen', {
      textDocument: {
        uri: this.toFileUri(uri),
        languageId: lang,
        version,
        text,
      } as TextDocumentItem,
    });

    this.openDocuments.set(uri, version);
  }

  /**
   * Update a document in the language server
   */
  async updateDocument(uri: string, text: string): Promise<void> {
    if (!this.isReady()) {
      throw new Error('LSP server not ready');
    }

    const currentVersion = this.openDocuments.get(uri) || 0;
    const newVersion = currentVersion + 1;

    this.sendNotification('textDocument/didChange', {
      textDocument: {
        uri: this.toFileUri(uri),
        version: newVersion,
      } as VersionedTextDocumentIdentifier,
      contentChanges: [{ text }] as TextDocumentContentChangeEvent[],
    });

    this.openDocuments.set(uri, newVersion);
  }

  /**
   * Close a document in the language server
   */
  async closeDocument(uri: string): Promise<void> {
    if (!this.isReady()) return;

    this.sendNotification('textDocument/didClose', {
      textDocument: {
        uri: this.toFileUri(uri),
      } as TextDocumentIdentifier,
    });

    this.openDocuments.delete(uri);
  }

  // ============================================================================
  // LSP OPERATIONS
  // ============================================================================

  /**
   * Go to definition
   */
  async gotoDefinition(uri: string, position: Position): Promise<Location | Location[] | null> {
    if (!this.isReady()) {
      throw new Error('LSP server not ready');
    }

    const result = await this.sendRequest('textDocument/definition', {
      textDocument: { uri: this.toFileUri(uri) },
      position,
    } as TextDocumentPositionParams);

    return this.normalizeLocations(result);
  }

  /**
   * Find all references
   */
  async findReferences(
    uri: string,
    position: Position,
    includeDeclaration: boolean = true
  ): Promise<Location[]> {
    if (!this.isReady()) {
      throw new Error('LSP server not ready');
    }

    const result = await this.sendRequest('textDocument/references', {
      textDocument: { uri: this.toFileUri(uri) },
      position,
      context: { includeDeclaration },
    });

    const locations = this.normalizeLocations(result);
    return Array.isArray(locations) ? locations : locations ? [locations] : [];
  }

  /**
   * Get hover information
   */
  async hover(uri: string, position: Position): Promise<Hover | null> {
    if (!this.isReady()) {
      throw new Error('LSP server not ready');
    }

    const result = (await this.sendRequest('textDocument/hover', {
      textDocument: { uri: this.toFileUri(uri) },
      position,
    } as TextDocumentPositionParams)) as Hover | null;

    return result;
  }

  /**
   * Get completions
   */
  async completion(uri: string, position: Position): Promise<CompletionItem[]> {
    if (!this.isReady()) {
      throw new Error('LSP server not ready');
    }

    const result = await this.sendRequest('textDocument/completion', {
      textDocument: { uri: this.toFileUri(uri) },
      position,
    } as TextDocumentPositionParams);

    if (!result) return [];

    // Handle both CompletionList and CompletionItem[] responses
    if (Array.isArray(result)) {
      return result as CompletionItem[];
    }
    if (typeof result === 'object' && 'items' in result) {
      return (result as { items: CompletionItem[] }).items;
    }

    return [];
  }

  /**
   * Get signature help
   */
  async signatureHelp(uri: string, position: Position): Promise<SignatureHelp | null> {
    if (!this.isReady()) {
      throw new Error('LSP server not ready');
    }

    const result = (await this.sendRequest('textDocument/signatureHelp', {
      textDocument: { uri: this.toFileUri(uri) },
      position,
    } as TextDocumentPositionParams)) as SignatureHelp | null;

    return result;
  }

  /**
   * Get document symbols
   */
  async documentSymbols(
    uri: string
  ): Promise<Array<{ name: string; kind: number; range: Range; selectionRange: Range }>> {
    if (!this.isReady()) {
      throw new Error('LSP server not ready');
    }

    const result = await this.sendRequest('textDocument/documentSymbol', {
      textDocument: { uri: this.toFileUri(uri) },
    });

    return (
      (result as Array<{ name: string; kind: number; range: Range; selectionRange: Range }>) || []
    );
  }

  /**
   * Rename a symbol
   */
  async rename(uri: string, position: Position, newName: string): Promise<WorkspaceEdit | null> {
    if (!this.isReady()) {
      throw new Error('LSP server not ready');
    }

    const result = (await this.sendRequest('textDocument/rename', {
      textDocument: { uri: this.toFileUri(uri) },
      position,
      newName,
    })) as WorkspaceEdit | null;

    return result;
  }

  /**
   * Format document
   */
  async formatDocument(uri: string): Promise<TextEdit[]> {
    if (!this.isReady()) {
      throw new Error('LSP server not ready');
    }

    const result = await this.sendRequest('textDocument/formatting', {
      textDocument: { uri: this.toFileUri(uri) },
      options: {
        tabSize: 2,
        insertSpaces: true,
      },
    });

    return (result as TextEdit[]) || [];
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  /**
   * Initialize the language server
   */
  private async initialize(): Promise<void> {
    const config = SERVER_CONFIGS[this.serverType];

    const result = (await this.sendRequest('initialize', {
      processId: process.pid,
      rootUri: this.toFileUri(this.workspaceRoot),
      rootPath: this.workspaceRoot,
      capabilities: {
        textDocument: {
          synchronization: {
            dynamicRegistration: true,
            willSave: true,
            willSaveWaitUntil: true,
            didSave: true,
          },
          completion: {
            dynamicRegistration: true,
            completionItem: {
              snippetSupport: true,
              documentationFormat: ['markdown', 'plaintext'],
              resolveSupport: { properties: ['documentation', 'detail'] },
            },
          },
          hover: {
            dynamicRegistration: true,
            contentFormat: ['markdown', 'plaintext'],
          },
          signatureHelp: {
            dynamicRegistration: true,
            signatureInformation: {
              documentationFormat: ['markdown', 'plaintext'],
            },
          },
          definition: { dynamicRegistration: true },
          references: { dynamicRegistration: true },
          documentSymbol: { dynamicRegistration: true },
          rename: { dynamicRegistration: true },
          formatting: { dynamicRegistration: true },
          publishDiagnostics: {
            relatedInformation: true,
          },
        },
        workspace: {
          applyEdit: true,
          workspaceEdit: { documentChanges: true },
          didChangeConfiguration: { dynamicRegistration: true },
          workspaceFolders: true,
        },
      },
      initializationOptions: config.initializationOptions,
      workspaceFolders: [
        {
          uri: this.toFileUri(this.workspaceRoot),
          name: path.basename(this.workspaceRoot),
        },
      ],
    })) as { capabilities: Record<string, unknown> };

    this.capabilities = result?.capabilities || {};

    // Send initialized notification
    this.sendNotification('initialized', {});

    this.initialized = true;
    log.info('LSP server initialized', {
      type: this.serverType,
      capabilities: Object.keys(this.capabilities),
    });
  }

  /**
   * Handle incoming data from the language server
   */
  private handleData(data: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, data]);

    while (true) {
      const headerEnd = this.buffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) break;

      const header = this.buffer.slice(0, headerEnd).toString();
      const contentLengthMatch = header.match(/Content-Length:\s*(\d+)/i);
      if (!contentLengthMatch) {
        log.error('Invalid LSP message: no Content-Length');
        break;
      }

      const contentLength = parseInt(contentLengthMatch[1], 10);
      const messageStart = headerEnd + 4;
      const messageEnd = messageStart + contentLength;

      if (this.buffer.length < messageEnd) break;

      const messageBuffer = this.buffer.slice(messageStart, messageEnd);
      this.buffer = this.buffer.slice(messageEnd);

      try {
        const message: JsonRpcMessage = JSON.parse(messageBuffer.toString());
        this.handleMessage(message);
      } catch (error) {
        log.error('Failed to parse LSP message', { error });
      }
    }
  }

  /**
   * Handle a parsed JSON-RPC message
   */
  private handleMessage(message: JsonRpcMessage): void {
    // Response to a request
    if (message.id !== undefined && !message.method) {
      const pending = this.pendingRequests.get(message.id as number);
      if (pending) {
        this.pendingRequests.delete(message.id as number);
        const elapsed = Date.now() - pending.startTime;
        log.debug('LSP response', { method: pending.method, elapsed, hasError: !!message.error });

        if (message.error) {
          pending.reject(new Error(message.error.message));
        } else {
          pending.resolve(message.result);
        }
      }
      return;
    }

    // Notification or request from server
    if (message.method) {
      this.handleServerMessage(message);
    }
  }

  /**
   * Handle notifications and requests from the server
   */
  private handleServerMessage(message: JsonRpcMessage): void {
    switch (message.method) {
      case 'textDocument/publishDiagnostics': {
        const params = message.params as { uri: string; diagnostics: Diagnostic[] };
        this.emit('diagnostics', {
          uri: this.fromFileUri(params.uri),
          diagnostics: params.diagnostics,
        });
        break;
      }

      case 'window/logMessage':
      case 'window/showMessage': {
        const params = message.params as { type: number; message: string };
        log.debug('LSP server message', { type: params.type, message: params.message });
        break;
      }

      case 'window/showMessageRequest': {
        // Respond to server requests (we just accept the first action)
        if (message.id !== undefined) {
          const params = message.params as { actions?: Array<{ title: string }> };
          this.sendResponse(message.id as number, params.actions?.[0] || null);
        }
        break;
      }

      default:
        log.debug('Unhandled LSP notification', { method: message.method });
    }
  }

  /**
   * Send a JSON-RPC request
   */
  private sendRequest(method: string, params: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.process?.stdin) {
        reject(new Error('LSP process not running'));
        return;
      }

      const id = ++this.requestId;
      const message: JsonRpcMessage = {
        jsonrpc: '2.0',
        id,
        method,
        params,
      };

      this.pendingRequests.set(id, {
        resolve,
        reject,
        method,
        startTime: Date.now(),
      });

      // Set a timeout
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`LSP request timeout: ${method}`));
        }
      }, 30000);

      this.writeMessage(message);
    });
  }

  /**
   * Send a JSON-RPC notification (no response expected)
   */
  private sendNotification(method: string, params: unknown): void {
    if (!this.process?.stdin) return;

    const message: JsonRpcMessage = {
      jsonrpc: '2.0',
      method,
      params,
    };

    this.writeMessage(message);
  }

  /**
   * Send a JSON-RPC response
   */
  private sendResponse(id: number, result: unknown): void {
    if (!this.process?.stdin) return;

    const message: JsonRpcMessage = {
      jsonrpc: '2.0',
      id,
      result,
    };

    this.writeMessage(message);
  }

  /**
   * Write a message to the language server
   */
  private writeMessage(message: JsonRpcMessage): void {
    const content = JSON.stringify(message);
    const contentLength = Buffer.byteLength(content, 'utf8');
    const header = `Content-Length: ${contentLength}\r\n\r\n`;

    this.process?.stdin?.write(header + content);
  }

  /**
   * Convert a file path to a file:// URI
   */
  private toFileUri(filePath: string): string {
    if (filePath.startsWith('file://')) return filePath;
    // Handle absolute paths
    if (path.isAbsolute(filePath)) {
      return `file://${filePath}`;
    }
    // Handle relative paths
    return `file://${path.join(this.workspaceRoot, filePath)}`;
  }

  /**
   * Convert a file:// URI to a file path
   */
  private fromFileUri(uri: string): string {
    if (uri.startsWith('file://')) {
      return uri.slice(7);
    }
    return uri;
  }

  /**
   * Detect language ID from file extension
   */
  private detectLanguage(uri: string): string {
    const ext = path.extname(uri).toLowerCase();
    const languageMap: Record<string, string> = {
      '.ts': 'typescript',
      '.tsx': 'typescriptreact',
      '.js': 'javascript',
      '.jsx': 'javascriptreact',
      '.mjs': 'javascript',
      '.cjs': 'javascript',
      '.py': 'python',
      '.go': 'go',
      '.json': 'json',
      '.md': 'markdown',
      '.html': 'html',
      '.css': 'css',
      '.scss': 'scss',
      '.yaml': 'yaml',
      '.yml': 'yaml',
    };
    return languageMap[ext] || 'plaintext';
  }

  /**
   * Normalize location results (can be single, array, or null)
   */
  private normalizeLocations(result: unknown): Location | Location[] | null {
    if (!result) return null;

    if (Array.isArray(result)) {
      return result.map((loc) => ({
        uri: this.fromFileUri(loc.uri || loc.targetUri),
        range: loc.range || loc.targetRange || loc.targetSelectionRange,
      }));
    }

    const loc = result as {
      uri?: string;
      targetUri?: string;
      range?: Range;
      targetRange?: Range;
      targetSelectionRange?: Range;
    };
    return {
      uri: this.fromFileUri(loc.uri || loc.targetUri || ''),
      range: loc.range ||
        loc.targetRange ||
        loc.targetSelectionRange || {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 0 },
        },
    };
  }
}

// ============================================================================
// LSP MANAGER - Manages multiple language server instances
// ============================================================================

export class LSPManager {
  private clients: Map<string, LSPClient> = new Map();
  private workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }

  /**
   * Get or start a language server for a specific language
   */
  async getClient(language: LanguageServerType): Promise<LSPClient> {
    const key = `${language}:${this.workspaceRoot}`;
    let client = this.clients.get(key);

    if (!client) {
      client = new LSPClient(language, this.workspaceRoot);
      await client.start();
      this.clients.set(key, client);
    }

    return client;
  }

  /**
   * Get the appropriate client for a file based on extension
   */
  async getClientForFile(filePath: string): Promise<LSPClient | null> {
    const ext = path.extname(filePath).toLowerCase();
    const languageMap: Record<string, LanguageServerType> = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'typescript',
      '.jsx': 'typescript',
      '.mjs': 'typescript',
      '.cjs': 'typescript',
      '.py': 'python',
      '.go': 'go',
    };

    const language = languageMap[ext];
    if (!language) return null;

    return this.getClient(language);
  }

  /**
   * Stop all language servers
   */
  async stopAll(): Promise<void> {
    const stopPromises = Array.from(this.clients.values()).map((client) => client.stop());
    await Promise.all(stopPromises);
    this.clients.clear();
  }

  /**
   * Get status of all running servers
   */
  getStatus(): Array<{ language: LanguageServerType; ready: boolean }> {
    return Array.from(this.clients.entries()).map(([key, client]) => ({
      language: key.split(':')[0] as LanguageServerType,
      ready: client.isReady(),
    }));
  }
}

// Export singleton factory
let managerInstance: LSPManager | null = null;

export function getLSPManager(workspaceRoot: string): LSPManager {
  if (!managerInstance || managerInstance['workspaceRoot'] !== workspaceRoot) {
    managerInstance = new LSPManager(workspaceRoot);
  }
  return managerInstance;
}
