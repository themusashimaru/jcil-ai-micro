/**
 * WEBSOCKET SERVER - REAL-TIME COMMUNICATION INFRASTRUCTURE
 *
 * Foundation for:
 * - Real-time collaboration
 * - Debugger events
 * - Live updates
 * - Presence tracking
 *
 * NOTE: This module requires the 'ws' package to be installed.
 * Run: pnpm add ws @types/ws
 *
 * Until then, this provides type exports and stub implementations.
 */

import { logger } from '@/lib/logger';

const log = logger('WebSocketServer');

// ============================================================================
// TYPES
// ============================================================================

export interface WebSocketClient {
  id: string;
  socket: unknown; // WebSocket when ws is installed
  userId: string;
  userName: string;
  sessionId?: string;
  lastPing: number;
  metadata: Record<string, unknown>;
}

export interface WebSocketMessage {
  type: string;
  payload: unknown;
  senderId?: string;
  timestamp: number;
}

export interface PresenceInfo {
  userId: string;
  userName: string;
  sessionId: string;
  cursorPosition?: { line: number; column: number };
  selection?: { startLine: number; endLine: number };
  lastActivity: number;
  status: 'active' | 'idle' | 'away';
}

export type MessageHandler = (
  client: WebSocketClient,
  message: WebSocketMessage
) => void | Promise<void>;

// ============================================================================
// WEBSOCKET SERVER (Stub - requires 'ws' package)
// ============================================================================

/**
 * WebSocket server for real-time communication.
 *
 * To enable full functionality, install the ws package:
 * pnpm add ws @types/ws
 */
export class CodeLabWebSocketServer {
  private clients: Map<string, WebSocketClient> = new Map();
  private sessions: Map<string, Set<string>> = new Map();
  private handlers: Map<string, MessageHandler[]> = new Map();
  private initialized = false;

  /**
   * Initialize the WebSocket server
   * @param _port Port to listen on (requires ws package)
   */
  async initialize(_port: number = 3001): Promise<void> {
    log.warn('WebSocket server requires "ws" package. Install with: pnpm add ws @types/ws');
    this.initialized = true;
  }

  /**
   * Check if server is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Register a message handler
   */
  on(type: string, handler: MessageHandler): void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, []);
    }
    this.handlers.get(type)!.push(handler);
  }

  /**
   * Remove a message handler
   */
  off(type: string, handler: MessageHandler): void {
    const handlers = this.handlers.get(type);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Broadcast message to all clients in a session
   */
  broadcastToSession(
    sessionId: string,
    message: WebSocketMessage,
    _excludeClientId?: string
  ): void {
    log.debug('broadcastToSession (stub)', { sessionId, type: message.type });
  }

  /**
   * Send message to a specific client
   */
  sendToClient(clientId: string, message: WebSocketMessage): void {
    log.debug('sendToClient (stub)', { clientId, type: message.type });
  }

  /**
   * Get all clients in a session
   */
  getSessionClients(sessionId: string): WebSocketClient[] {
    const clientIds = this.sessions.get(sessionId);
    if (!clientIds) return [];

    return Array.from(clientIds)
      .map((id) => this.clients.get(id))
      .filter((c): c is WebSocketClient => c !== undefined);
  }

  /**
   * Get client by ID
   */
  getClient(clientId: string): WebSocketClient | undefined {
    return this.clients.get(clientId);
  }

  /**
   * Get all connected clients
   */
  getAllClients(): WebSocketClient[] {
    return Array.from(this.clients.values());
  }

  /**
   * Get presence info for a session
   */
  getSessionPresence(sessionId: string): PresenceInfo[] {
    const clients = this.getSessionClients(sessionId);
    return clients.map((client) => ({
      userId: client.userId,
      userName: client.userName,
      sessionId,
      lastActivity: client.lastPing,
      status: 'active' as const,
      ...((client.metadata.cursorPosition as { line: number; column: number } | undefined) && {
        cursorPosition: client.metadata.cursorPosition as { line: number; column: number },
      }),
      ...((client.metadata.selection as { startLine: number; endLine: number } | undefined) && {
        selection: client.metadata.selection as { startLine: number; endLine: number },
      }),
    }));
  }

  /**
   * Shutdown the server
   */
  async shutdown(): Promise<void> {
    this.clients.clear();
    this.sessions.clear();
    this.initialized = false;
    log.info('WebSocket server shutdown (stub)');
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let wsServerInstance: CodeLabWebSocketServer | null = null;

export function getWebSocketServer(): CodeLabWebSocketServer {
  if (!wsServerInstance) {
    wsServerInstance = new CodeLabWebSocketServer();
  }
  return wsServerInstance;
}

export async function initializeWebSocketServer(port?: number): Promise<CodeLabWebSocketServer> {
  const server = getWebSocketServer();
  if (!server.isInitialized()) {
    await server.initialize(port);
  }
  return server;
}
