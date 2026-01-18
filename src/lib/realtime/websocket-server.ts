/**
 * WEBSOCKET SERVER - REAL-TIME COMMUNICATION INFRASTRUCTURE
 *
 * Foundation for:
 * - Real-time collaboration
 * - Debugger events
 * - Live updates
 * - Presence tracking
 *
 * This is REAL infrastructure, not a mock.
 */

import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { logger } from '@/lib/logger';
import { createClient } from '@/lib/supabase/server';

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
// WEBSOCKET SERVER
// ============================================================================

export class CodeLabWebSocketServer {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, WebSocketClient> = new Map();
  private sessions: Map<string, Set<string>> = new Map(); // sessionId -> clientIds
  private handlers: Map<string, MessageHandler[]> = new Map();
  private pingInterval: NodeJS.Timer | null = null;

  private readonly PING_INTERVAL = 30000; // 30 seconds
  private readonly PING_TIMEOUT = 60000; // 60 seconds

  /**
   * Initialize WebSocket server
   */
  async initialize(port: number = 3001): Promise<void> {
    if (this.wss) {
      log.warn('WebSocket server already initialized');
      return;
    }

    this.wss = new WebSocketServer({ port });

    this.wss.on('connection', (socket, request) => {
      this.handleConnection(socket, request);
    });

    this.wss.on('error', (error) => {
      log.error('WebSocket server error', error);
    });

    // Start ping interval to detect stale connections
    this.pingInterval = setInterval(() => {
      this.pingClients();
    }, this.PING_INTERVAL);

    log.info('WebSocket server initialized', { port });
  }

  /**
   * Handle new connection
   */
  private async handleConnection(socket: WebSocket, request: IncomingMessage) {
    const clientId = this.generateClientId();
    const url = new URL(request.url || '', `http://${request.headers.host}`);

    // Extract auth token from query string
    const token = url.searchParams.get('token');
    const sessionId = url.searchParams.get('sessionId');

    // Verify auth token
    const user = await this.verifyToken(token);
    if (!user) {
      log.warn('Unauthorized WebSocket connection attempt');
      socket.close(4001, 'Unauthorized');
      return;
    }

    const client: WebSocketClient = {
      id: clientId,
      socket,
      userId: user.id,
      userName: user.name || 'Anonymous',
      sessionId: sessionId || undefined,
      lastPing: Date.now(),
      metadata: {},
    };

    this.clients.set(clientId, client);

    // Add to session if specified
    if (sessionId) {
      this.addToSession(clientId, sessionId);
    }

    log.info('Client connected', {
      clientId,
      userId: user.id,
      sessionId,
    });

    // Set up message handling
    socket.on('message', (data) => {
      this.handleMessage(client, data);
    });

    socket.on('close', () => {
      this.handleDisconnect(client);
    });

    socket.on('error', (error) => {
      log.error('Client socket error', error, { clientId });
    });

    socket.on('pong', () => {
      client.lastPing = Date.now();
    });

    // Send welcome message
    this.sendToClient(client, {
      type: 'connected',
      payload: {
        clientId,
        userId: user.id,
        sessionId,
      },
      timestamp: Date.now(),
    });

    // Broadcast join to session
    if (sessionId) {
      this.broadcastToSession(sessionId, {
        type: 'presence:join',
        payload: {
          userId: user.id,
          userName: user.name,
          clientId,
        },
        timestamp: Date.now(),
      }, clientId);
    }
  }

  /**
   * Handle incoming message
   */
  private async handleMessage(client: WebSocketClient, data: WebSocket.RawData) {
    try {
      const message: WebSocketMessage = JSON.parse(data.toString());
      message.senderId = client.id;
      message.timestamp = message.timestamp || Date.now();

      // Update last activity
      client.lastPing = Date.now();

      log.debug('Message received', {
        clientId: client.id,
        type: message.type,
      });

      // Call registered handlers
      const handlers = this.handlers.get(message.type) || [];
      for (const handler of handlers) {
        try {
          await handler(client, message);
        } catch (error) {
          log.error('Handler error', error as Error, { type: message.type });
        }
      }

      // Built-in message types
      switch (message.type) {
        case 'ping':
          this.sendToClient(client, { type: 'pong', payload: null, timestamp: Date.now() });
          break;

        case 'presence:update':
          this.handlePresenceUpdate(client, message.payload as Partial<PresenceInfo>);
          break;

        case 'session:join':
          this.handleSessionJoin(client, message.payload as { sessionId: string });
          break;

        case 'session:leave':
          this.handleSessionLeave(client);
          break;

        case 'broadcast':
          this.handleBroadcast(client, message);
          break;
      }
    } catch (error) {
      log.error('Message parse error', error as Error);
    }
  }

  /**
   * Handle client disconnect
   */
  private handleDisconnect(client: WebSocketClient) {
    log.info('Client disconnected', { clientId: client.id, userId: client.userId });

    // Broadcast leave to session
    if (client.sessionId) {
      this.broadcastToSession(client.sessionId, {
        type: 'presence:leave',
        payload: {
          userId: client.userId,
          userName: client.userName,
          clientId: client.id,
        },
        timestamp: Date.now(),
      }, client.id);

      this.removeFromSession(client.id, client.sessionId);
    }

    this.clients.delete(client.id);
  }

  /**
   * Handle presence update
   */
  private handlePresenceUpdate(client: WebSocketClient, presence: Partial<PresenceInfo>) {
    if (!client.sessionId) return;

    const update: PresenceInfo = {
      userId: client.userId,
      userName: client.userName,
      sessionId: client.sessionId,
      cursorPosition: presence.cursorPosition,
      selection: presence.selection,
      lastActivity: Date.now(),
      status: presence.status || 'active',
    };

    this.broadcastToSession(client.sessionId, {
      type: 'presence:update',
      payload: update,
      senderId: client.id,
      timestamp: Date.now(),
    }, client.id);
  }

  /**
   * Handle session join
   */
  private handleSessionJoin(client: WebSocketClient, payload: { sessionId: string }) {
    const { sessionId } = payload;

    // Leave current session if any
    if (client.sessionId) {
      this.handleSessionLeave(client);
    }

    // Join new session
    client.sessionId = sessionId;
    this.addToSession(client.id, sessionId);

    // Get current session members
    const sessionClients = this.sessions.get(sessionId) || new Set();
    const members = Array.from(sessionClients)
      .map((id) => this.clients.get(id))
      .filter((c): c is WebSocketClient => c !== undefined)
      .map((c) => ({
        userId: c.userId,
        userName: c.userName,
        clientId: c.id,
      }));

    // Send session info to joining client
    this.sendToClient(client, {
      type: 'session:joined',
      payload: {
        sessionId,
        members,
      },
      timestamp: Date.now(),
    });

    // Broadcast join to others
    this.broadcastToSession(sessionId, {
      type: 'presence:join',
      payload: {
        userId: client.userId,
        userName: client.userName,
        clientId: client.id,
      },
      timestamp: Date.now(),
    }, client.id);
  }

  /**
   * Handle session leave
   */
  private handleSessionLeave(client: WebSocketClient) {
    if (!client.sessionId) return;

    const sessionId = client.sessionId;

    // Broadcast leave
    this.broadcastToSession(sessionId, {
      type: 'presence:leave',
      payload: {
        userId: client.userId,
        userName: client.userName,
        clientId: client.id,
      },
      timestamp: Date.now(),
    }, client.id);

    this.removeFromSession(client.id, sessionId);
    client.sessionId = undefined;

    this.sendToClient(client, {
      type: 'session:left',
      payload: { sessionId },
      timestamp: Date.now(),
    });
  }

  /**
   * Handle broadcast message
   */
  private handleBroadcast(client: WebSocketClient, message: WebSocketMessage) {
    if (!client.sessionId) return;

    this.broadcastToSession(client.sessionId, message, client.id);
  }

  // ============================================================================
  // PUBLIC METHODS
  // ============================================================================

  /**
   * Register a message handler
   */
  on(type: string, handler: MessageHandler): void {
    const handlers = this.handlers.get(type) || [];
    handlers.push(handler);
    this.handlers.set(type, handlers);
  }

  /**
   * Remove a message handler
   */
  off(type: string, handler: MessageHandler): void {
    const handlers = this.handlers.get(type) || [];
    const index = handlers.indexOf(handler);
    if (index !== -1) {
      handlers.splice(index, 1);
    }
  }

  /**
   * Send message to a specific client
   */
  sendToClient(client: WebSocketClient, message: WebSocketMessage): void {
    if (client.socket.readyState === WebSocket.OPEN) {
      client.socket.send(JSON.stringify(message));
    }
  }

  /**
   * Send message to a specific user (all their connections)
   */
  sendToUser(userId: string, message: WebSocketMessage): void {
    for (const client of this.clients.values()) {
      if (client.userId === userId) {
        this.sendToClient(client, message);
      }
    }
  }

  /**
   * Broadcast to all clients in a session
   */
  broadcastToSession(
    sessionId: string,
    message: WebSocketMessage,
    excludeClientId?: string
  ): void {
    const clientIds = this.sessions.get(sessionId);
    if (!clientIds) return;

    for (const clientId of clientIds) {
      if (clientId === excludeClientId) continue;
      const client = this.clients.get(clientId);
      if (client) {
        this.sendToClient(client, message);
      }
    }
  }

  /**
   * Broadcast to all connected clients
   */
  broadcast(message: WebSocketMessage, excludeClientId?: string): void {
    for (const client of this.clients.values()) {
      if (client.id === excludeClientId) continue;
      this.sendToClient(client, message);
    }
  }

  /**
   * Get clients in a session
   */
  getSessionClients(sessionId: string): WebSocketClient[] {
    const clientIds = this.sessions.get(sessionId);
    if (!clientIds) return [];

    return Array.from(clientIds)
      .map((id) => this.clients.get(id))
      .filter((c): c is WebSocketClient => c !== undefined);
  }

  /**
   * Get active sessions
   */
  getActiveSessions(): string[] {
    return Array.from(this.sessions.keys());
  }

  /**
   * Get server stats
   */
  getStats(): {
    totalClients: number;
    activeSessions: number;
    clientsPerSession: Record<string, number>;
  } {
    const clientsPerSession: Record<string, number> = {};
    for (const [sessionId, clients] of this.sessions) {
      clientsPerSession[sessionId] = clients.size;
    }

    return {
      totalClients: this.clients.size,
      activeSessions: this.sessions.size,
      clientsPerSession,
    };
  }

  /**
   * Shutdown server
   */
  async shutdown(): Promise<void> {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    // Close all client connections
    for (const client of this.clients.values()) {
      client.socket.close(1001, 'Server shutting down');
    }

    if (this.wss) {
      await new Promise<void>((resolve) => {
        this.wss!.close(() => resolve());
      });
    }

    this.clients.clear();
    this.sessions.clear();

    log.info('WebSocket server shut down');
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private generateClientId(): string {
    return `client-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }

  private async verifyToken(token: string | null): Promise<{ id: string; name: string } | null> {
    if (!token) return null;

    try {
      const supabase = createClient();
      const { data: { user }, error } = await supabase.auth.getUser(token);

      if (error || !user) {
        return null;
      }

      return {
        id: user.id,
        name: user.user_metadata?.name || user.email || 'Anonymous',
      };
    } catch {
      return null;
    }
  }

  private addToSession(clientId: string, sessionId: string): void {
    let session = this.sessions.get(sessionId);
    if (!session) {
      session = new Set();
      this.sessions.set(sessionId, session);
    }
    session.add(clientId);
  }

  private removeFromSession(clientId: string, sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.delete(clientId);
      if (session.size === 0) {
        this.sessions.delete(sessionId);
      }
    }
  }

  private pingClients(): void {
    const now = Date.now();
    for (const client of this.clients.values()) {
      if (now - client.lastPing > this.PING_TIMEOUT) {
        log.info('Client timed out', { clientId: client.id });
        client.socket.terminate();
        continue;
      }

      if (client.socket.readyState === WebSocket.OPEN) {
        client.socket.ping();
      }
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
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
  await server.initialize(port);
  return server;
}
