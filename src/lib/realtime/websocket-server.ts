/**
 * WEBSOCKET SERVER - REAL-TIME COMMUNICATION INFRASTRUCTURE
 *
 * Full implementation providing:
 * - Real-time collaboration
 * - Debugger events
 * - Live updates
 * - Presence tracking
 */

import WebSocket, { WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/lib/logger';

const log = logger('WebSocketServer');

// ============================================================================
// TYPES
// ============================================================================

export interface WebSocketClient {
  id: string;
  socket: WebSocket;
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
// WEBSOCKET SERVER - FULL IMPLEMENTATION
// ============================================================================

/**
 * WebSocket server for real-time communication.
 * Full implementation using the 'ws' package.
 */
export class CodeLabWebSocketServer {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, WebSocketClient> = new Map();
  private sessions: Map<string, Set<string>> = new Map();
  private handlers: Map<string, MessageHandler[]> = new Map();
  private initialized = false;
  private pingInterval: NodeJS.Timeout | null = null;

  // Ping/pong configuration
  private readonly PING_INTERVAL = 30000; // 30 seconds
  private readonly PING_TIMEOUT = 10000; // 10 seconds timeout for pong

  /**
   * Initialize the WebSocket server
   * @param port Port to listen on
   */
  async initialize(port: number = 3001): Promise<void> {
    if (this.initialized) {
      log.warn('WebSocket server already initialized');
      return;
    }

    try {
      this.wss = new WebSocketServer({ port });

      this.wss.on('connection', (socket: WebSocket, request: IncomingMessage) => {
        this.handleConnection(socket, request);
      });

      this.wss.on('error', (error: Error) => {
        log.error('WebSocket server error', error);
      });

      // Start ping interval to detect dead connections
      this.pingInterval = setInterval(() => {
        this.pingAllClients();
      }, this.PING_INTERVAL);

      this.initialized = true;
      log.info(`WebSocket server listening on port ${port}`);
    } catch (error) {
      log.error('Failed to initialize WebSocket server', error as Error);
      throw error;
    }
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(socket: WebSocket, request: IncomingMessage): void {
    const clientId = uuidv4();
    const url = new URL(request.url || '', `http://${request.headers.host}`);

    // Extract auth info from query params or headers
    const userId = url.searchParams.get('userId') || 'anonymous';
    const userName = url.searchParams.get('userName') || 'Anonymous';
    const sessionId = url.searchParams.get('sessionId') || undefined;

    const client: WebSocketClient = {
      id: clientId,
      socket,
      userId,
      userName,
      sessionId,
      lastPing: Date.now(),
      metadata: {},
    };

    this.clients.set(clientId, client);

    // Join session if provided
    if (sessionId) {
      this.addClientToSession(clientId, sessionId);
    }

    log.info('Client connected', { clientId, userId, sessionId });

    // Set up event handlers
    socket.on('message', (data: Buffer | string) => {
      this.handleMessage(client, data);
    });

    socket.on('close', () => {
      this.handleDisconnect(client);
    });

    socket.on('error', (error: Error) => {
      log.error('Client socket error', { clientId, error: error.message });
    });

    socket.on('pong', () => {
      client.lastPing = Date.now();
    });

    // Send welcome message
    this.sendToClient(clientId, {
      type: 'connected',
      payload: { clientId, userId, sessionId },
      timestamp: Date.now(),
    });

    // Notify others in session
    if (sessionId) {
      this.broadcastToSession(
        sessionId,
        {
          type: 'user:joined',
          payload: { userId, userName, clientId },
          timestamp: Date.now(),
        },
        clientId
      );
    }
  }

  /**
   * Handle incoming message from client
   */
  private handleMessage(client: WebSocketClient, data: Buffer | string): void {
    try {
      const messageStr = typeof data === 'string' ? data : data.toString('utf-8');
      const message = JSON.parse(messageStr) as WebSocketMessage;

      // Add sender info
      message.senderId = client.id;
      message.timestamp = message.timestamp || Date.now();

      // Update last activity
      client.lastPing = Date.now();

      // Handle special messages
      switch (message.type) {
        case 'ping':
          this.sendToClient(client.id, {
            type: 'pong',
            payload: {},
            timestamp: Date.now(),
          });
          return;

        case 'join:session':
          const { sessionId } = message.payload as { sessionId: string };
          this.joinClientToSession(client, sessionId);
          return;

        case 'leave:session':
          this.leaveClientFromSession(client);
          return;

        case 'presence:update':
          this.handlePresenceUpdate(client, message);
          return;
      }

      // Call registered handlers
      const handlers = this.handlers.get(message.type);
      if (handlers) {
        for (const handler of handlers) {
          try {
            handler(client, message);
          } catch (error) {
            log.error('Handler error', { type: message.type, error: (error as Error).message });
          }
        }
      }

      // Broadcast to session if applicable
      if (client.sessionId && message.type.startsWith('broadcast:')) {
        this.broadcastToSession(client.sessionId, message, client.id);
      }
    } catch (error) {
      log.error('Failed to parse message', {
        clientId: client.id,
        error: (error as Error).message,
      });
    }
  }

  /**
   * Handle client disconnect
   */
  private handleDisconnect(client: WebSocketClient): void {
    const { id: clientId, userId, sessionId } = client;

    // Remove from session
    if (sessionId) {
      this.removeClientFromSession(clientId, sessionId);

      // Notify others
      this.broadcastToSession(sessionId, {
        type: 'user:left',
        payload: { userId, clientId },
        timestamp: Date.now(),
      });
    }

    // Remove client
    this.clients.delete(clientId);
    log.info('Client disconnected', { clientId, userId, sessionId });
  }

  /**
   * Join client to a session
   */
  private joinClientToSession(client: WebSocketClient, sessionId: string): void {
    // Leave current session if any
    if (client.sessionId) {
      this.leaveClientFromSession(client);
    }

    client.sessionId = sessionId;
    this.addClientToSession(client.id, sessionId);

    // Notify the client
    this.sendToClient(client.id, {
      type: 'session:joined',
      payload: { sessionId, users: this.getSessionPresence(sessionId) },
      timestamp: Date.now(),
    });

    // Notify others
    this.broadcastToSession(
      sessionId,
      {
        type: 'user:joined',
        payload: { userId: client.userId, userName: client.userName, clientId: client.id },
        timestamp: Date.now(),
      },
      client.id
    );

    log.info('Client joined session', { clientId: client.id, sessionId });
  }

  /**
   * Remove client from their current session
   */
  private leaveClientFromSession(client: WebSocketClient): void {
    if (!client.sessionId) return;

    const sessionId = client.sessionId;
    this.removeClientFromSession(client.id, sessionId);

    // Notify others
    this.broadcastToSession(sessionId, {
      type: 'user:left',
      payload: { userId: client.userId, clientId: client.id },
      timestamp: Date.now(),
    });

    // Notify the client
    this.sendToClient(client.id, {
      type: 'session:left',
      payload: { sessionId },
      timestamp: Date.now(),
    });

    client.sessionId = undefined;
    log.info('Client left session', { clientId: client.id, sessionId });
  }

  /**
   * Handle presence update from client
   */
  private handlePresenceUpdate(client: WebSocketClient, message: WebSocketMessage): void {
    const payload = message.payload as {
      cursorPosition?: { line: number; column: number };
      selection?: { startLine: number; endLine: number };
      status?: 'active' | 'idle' | 'away';
    };

    // Update client metadata
    if (payload.cursorPosition) {
      client.metadata.cursorPosition = payload.cursorPosition;
    }
    if (payload.selection) {
      client.metadata.selection = payload.selection;
    }
    if (payload.status) {
      client.metadata.status = payload.status;
    }

    // Broadcast to session
    if (client.sessionId) {
      this.broadcastToSession(
        client.sessionId,
        {
          type: 'presence:updated',
          payload: {
            userId: client.userId,
            userName: client.userName,
            ...payload,
          },
          senderId: client.id,
          timestamp: Date.now(),
        },
        client.id
      );
    }
  }

  /**
   * Add client to session tracking
   */
  private addClientToSession(clientId: string, sessionId: string): void {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, new Set());
    }
    this.sessions.get(sessionId)!.add(clientId);
  }

  /**
   * Remove client from session tracking
   */
  private removeClientFromSession(clientId: string, sessionId: string): void {
    const sessionClients = this.sessions.get(sessionId);
    if (sessionClients) {
      sessionClients.delete(clientId);
      if (sessionClients.size === 0) {
        this.sessions.delete(sessionId);
      }
    }
  }

  /**
   * Ping all clients to detect dead connections
   */
  private pingAllClients(): void {
    const now = Date.now();

    for (const [clientId, client] of this.clients) {
      // Check if client missed too many pings
      if (now - client.lastPing > this.PING_INTERVAL + this.PING_TIMEOUT) {
        log.warn('Client timed out', { clientId });
        client.socket.terminate();
        continue;
      }

      // Send ping
      if (client.socket.readyState === WebSocket.OPEN) {
        client.socket.ping();
      }
    }
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
  broadcastToSession(sessionId: string, message: WebSocketMessage, excludeClientId?: string): void {
    const clientIds = this.sessions.get(sessionId);
    if (!clientIds) return;

    const messageStr = JSON.stringify(message);

    for (const clientId of clientIds) {
      if (clientId === excludeClientId) continue;

      const client = this.clients.get(clientId);
      if (client && client.socket.readyState === WebSocket.OPEN) {
        client.socket.send(messageStr);
      }
    }
  }

  /**
   * Broadcast message to all connected clients
   */
  broadcast(message: WebSocketMessage, excludeClientId?: string): void {
    const messageStr = JSON.stringify(message);

    for (const [clientId, client] of this.clients) {
      if (clientId === excludeClientId) continue;

      if (client.socket.readyState === WebSocket.OPEN) {
        client.socket.send(messageStr);
      }
    }
  }

  /**
   * Send message to a specific client
   */
  sendToClient(clientId: string, message: WebSocketMessage): boolean {
    const client = this.clients.get(clientId);
    if (!client || client.socket.readyState !== WebSocket.OPEN) {
      return false;
    }

    client.socket.send(JSON.stringify(message));
    return true;
  }

  /**
   * Send message to a user (all their connected clients)
   */
  sendToUser(userId: string, message: WebSocketMessage): number {
    let sent = 0;
    const messageStr = JSON.stringify(message);

    for (const client of this.clients.values()) {
      if (client.userId === userId && client.socket.readyState === WebSocket.OPEN) {
        client.socket.send(messageStr);
        sent++;
      }
    }

    return sent;
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
   * Get clients by user ID
   */
  getClientsByUser(userId: string): WebSocketClient[] {
    return Array.from(this.clients.values()).filter((c) => c.userId === userId);
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
      status: (client.metadata.status as 'active' | 'idle' | 'away') || 'active',
      ...((client.metadata.cursorPosition as { line: number; column: number } | undefined) && {
        cursorPosition: client.metadata.cursorPosition as { line: number; column: number },
      }),
      ...((client.metadata.selection as { startLine: number; endLine: number } | undefined) && {
        selection: client.metadata.selection as { startLine: number; endLine: number },
      }),
    }));
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): string[] {
    return Array.from(this.sessions.keys());
  }

  /**
   * Get session client count
   */
  getSessionClientCount(sessionId: string): number {
    return this.sessions.get(sessionId)?.size || 0;
  }

  /**
   * Get total connected client count
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Shutdown the server
   */
  async shutdown(): Promise<void> {
    // Stop ping interval
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    // Close all client connections
    for (const client of this.clients.values()) {
      client.socket.close(1001, 'Server shutting down');
    }

    // Close the server
    if (this.wss) {
      await new Promise<void>((resolve, reject) => {
        this.wss!.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }

    this.clients.clear();
    this.sessions.clear();
    this.handlers.clear();
    this.initialized = false;
    this.wss = null;

    log.info('WebSocket server shutdown complete');
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
