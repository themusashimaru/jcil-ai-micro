/**
 * VS CODE EXTENSION API
 *
 * API for integrating Code Lab with VS Code and other IDEs.
 * Provides WebSocket-based real-time communication.
 *
 * @version 1.0.0
 */

// ============================================================================
// TYPES
// ============================================================================

export interface IDEMessage {
  id: string;
  type: IDEMessageType;
  payload: unknown;
  timestamp: number;
}

export type IDEMessageType =
  // Client → Server
  | 'file.open'
  | 'file.change'
  | 'file.save'
  | 'file.close'
  | 'selection.change'
  | 'command.execute'
  | 'chat.send'
  | 'ping'
  // Server → Client
  | 'file.update'
  | 'file.create'
  | 'file.delete'
  | 'chat.response'
  | 'chat.stream'
  | 'status.update'
  | 'error'
  | 'pong';

export interface Position {
  line: number;
  column: number;
}

export interface Range {
  start: Position;
  end: Position;
}

export interface TextChange {
  range: Range;
  text: string;
}

export interface FileOpenPayload {
  path: string;
  content: string;
  language: string;
}

export interface FileChangePayload {
  path: string;
  changes: TextChange[];
}

export interface FileSavePayload {
  path: string;
  content: string;
}

export interface SelectionChangePayload {
  path: string;
  selections: Range[];
  selectedText?: string;
}

export interface CommandExecutePayload {
  command: string;
  args?: string;
  context?: {
    file?: string;
    selection?: string;
  };
}

export interface ChatSendPayload {
  message: string;
  attachments?: Array<{
    type: 'code' | 'image' | 'file';
    path?: string;
    content?: string;
    language?: string;
  }>;
}

export interface FileUpdatePayload {
  path: string;
  content: string;
  diff?: {
    hunks: Array<{
      oldStart: number;
      oldLines: number;
      newStart: number;
      newLines: number;
      lines: string[];
    }>;
  };
}

export interface ChatResponsePayload {
  requestId: string;
  content: string;
  isStreaming: boolean;
}

export interface ChatStreamPayload {
  requestId: string;
  chunk: string;
  isComplete: boolean;
}

export interface StatusUpdatePayload {
  connected: boolean;
  sessionId?: string;
  model?: string;
  tokensUsed?: number;
}

export interface ErrorPayload {
  code: IDEErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export type IDEErrorCode =
  | 'AUTH_FAILED'
  | 'PERMISSION_DENIED'
  | 'FILE_NOT_FOUND'
  | 'INVALID_MESSAGE'
  | 'RATE_LIMITED'
  | 'SESSION_EXPIRED'
  | 'SERVER_ERROR';

// ============================================================================
// MESSAGE BUILDERS
// ============================================================================

/**
 * Create a unique message ID
 */
export function createMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Build an IDE message
 */
export function buildMessage<T>(type: IDEMessageType, payload: T): IDEMessage {
  return {
    id: createMessageId(),
    type,
    payload,
    timestamp: Date.now(),
  };
}

/**
 * Build a file open message
 */
export function buildFileOpen(path: string, content: string, language: string): IDEMessage {
  return buildMessage<FileOpenPayload>('file.open', { path, content, language });
}

/**
 * Build a file change message
 */
export function buildFileChange(path: string, changes: TextChange[]): IDEMessage {
  return buildMessage<FileChangePayload>('file.change', { path, changes });
}

/**
 * Build a file save message
 */
export function buildFileSave(path: string, content: string): IDEMessage {
  return buildMessage<FileSavePayload>('file.save', { path, content });
}

/**
 * Build a selection change message
 */
export function buildSelectionChange(
  path: string,
  selections: Range[],
  selectedText?: string
): IDEMessage {
  return buildMessage<SelectionChangePayload>('selection.change', {
    path,
    selections,
    selectedText,
  });
}

/**
 * Build a command execute message
 */
export function buildCommandExecute(
  command: string,
  args?: string,
  context?: { file?: string; selection?: string }
): IDEMessage {
  return buildMessage<CommandExecutePayload>('command.execute', { command, args, context });
}

/**
 * Build a chat send message
 */
export function buildChatSend(
  message: string,
  attachments?: ChatSendPayload['attachments']
): IDEMessage {
  return buildMessage<ChatSendPayload>('chat.send', { message, attachments });
}

/**
 * Build an error message
 */
export function buildError(
  code: IDEErrorCode,
  message: string,
  details?: Record<string, unknown>
): IDEMessage {
  return buildMessage<ErrorPayload>('error', { code, message, details });
}

// ============================================================================
// MESSAGE PARSERS
// ============================================================================

/**
 * Parse an incoming IDE message
 */
export function parseMessage(data: string): IDEMessage | null {
  try {
    const message = JSON.parse(data);
    if (!message.id || !message.type || message.payload === undefined) {
      return null;
    }
    return message as IDEMessage;
  } catch {
    return null;
  }
}

/**
 * Validate message type
 */
export function isValidMessageType(type: string): type is IDEMessageType {
  const validTypes: IDEMessageType[] = [
    'file.open',
    'file.change',
    'file.save',
    'file.close',
    'selection.change',
    'command.execute',
    'chat.send',
    'ping',
    'file.update',
    'file.create',
    'file.delete',
    'chat.response',
    'chat.stream',
    'status.update',
    'error',
    'pong',
  ];
  return validTypes.includes(type as IDEMessageType);
}

// ============================================================================
// WEBSOCKET CLIENT
// ============================================================================

export interface IDEClientConfig {
  serverUrl: string;
  token: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  onMessage?: (message: IDEMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
}

/**
 * IDE WebSocket client for connecting to Code Lab
 */
export class IDEClient {
  private ws: WebSocket | null = null;
  private config: Required<IDEClientConfig>;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private pendingRequests = new Map<string, (response: IDEMessage) => void>();

  constructor(config: IDEClientConfig) {
    this.config = {
      reconnectInterval: 3000,
      maxReconnectAttempts: 10,
      onMessage: () => {},
      onConnect: () => {},
      onDisconnect: () => {},
      onError: () => {},
      ...config,
    };
  }

  /**
   * Connect to Code Lab server
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const url = `${this.config.serverUrl}/api/ide/ws?token=${encodeURIComponent(this.config.token)}`;
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
          this.reconnectAttempts = 0;
          this.startPing();
          this.config.onConnect();
          resolve();
        };

        this.ws.onclose = () => {
          this.stopPing();
          this.config.onDisconnect();
          this.scheduleReconnect();
        };

        this.ws.onerror = () => {
          const error = new Error('WebSocket connection failed');
          this.config.onError(error);
          reject(error);
        };

        this.ws.onmessage = (event) => {
          const message = parseMessage(event.data);
          if (message) {
            // Check for pending request
            const resolver = this.pendingRequests.get(message.id);
            if (resolver) {
              resolver(message);
              this.pendingRequests.delete(message.id);
            }
            this.config.onMessage(message);
          }
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Disconnect from server
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    this.stopPing();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Send a message
   */
  send(message: IDEMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Send a message and wait for response
   */
  async sendAndWait(message: IDEMessage, timeoutMs = 30000): Promise<IDEMessage> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(message.id);
        reject(new Error('Request timeout'));
      }, timeoutMs);

      this.pendingRequests.set(message.id, (response) => {
        clearTimeout(timeout);
        resolve(response);
      });

      this.send(message);
    });
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  // ============================================
  // CONVENIENCE METHODS
  // ============================================

  /**
   * Send file open notification
   */
  sendFileOpen(path: string, content: string, language: string): void {
    this.send(buildFileOpen(path, content, language));
  }

  /**
   * Send file change notification
   */
  sendFileChange(path: string, changes: TextChange[]): void {
    this.send(buildFileChange(path, changes));
  }

  /**
   * Send file save notification
   */
  sendFileSave(path: string, content: string): void {
    this.send(buildFileSave(path, content));
  }

  /**
   * Send selection change notification
   */
  sendSelectionChange(path: string, selections: Range[], selectedText?: string): void {
    this.send(buildSelectionChange(path, selections, selectedText));
  }

  /**
   * Execute a command
   */
  async executeCommand(
    command: string,
    args?: string,
    context?: { file?: string; selection?: string }
  ): Promise<IDEMessage> {
    return this.sendAndWait(buildCommandExecute(command, args, context));
  }

  /**
   * Send a chat message
   */
  async sendChat(
    message: string,
    attachments?: ChatSendPayload['attachments']
  ): Promise<IDEMessage> {
    return this.sendAndWait(buildChatSend(message, attachments));
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  private startPing(): void {
    this.pingInterval = setInterval(() => {
      this.send(buildMessage('ping', {}));
    }, 30000);
  }

  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      this.config.onError(new Error('Max reconnect attempts reached'));
      return;
    }

    this.reconnectAttempts++;
    const delay = this.config.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1);

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(() => {
        // Error handled in connect
      });
    }, delay);
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default IDEClient;
