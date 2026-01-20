/**
 * COLLABORATION MANAGER - REAL-TIME COLLABORATIVE EDITING
 *
 * Manages collaborative editing sessions:
 * - Session lifecycle (create, join, leave)
 * - User presence tracking
 * - Operation broadcasting
 * - Conflict resolution via CRDT
 * - Redis-backed persistence for horizontal scaling
 *
 * This is REAL collaboration, not a mock.
 */

import { EventEmitter } from 'events';
import {
  CRDTDocument,
  CRDTOperation,
  CursorPosition,
  getDocumentStore,
  CRDTState,
} from './crdt-document';
import { logger } from '@/lib/logger';
import {
  saveSession,
  loadSession,
  saveDocumentState,
  loadDocumentState,
  publishEvent,
  subscribeToEvents,
  startEventPolling,
  isRedisAvailable,
  getBufferedOperations,
  clearBufferedOperations,
  type SerializedSession,
  type CollaborationEvent as RedisCollaborationEvent,
} from './redis-persistence';

const log = logger('CollaborationManager');

// ============================================================================
// TYPES
// ============================================================================

export interface CollaborationSession {
  id: string;
  documentId: string;
  ownerId: string;
  createdAt: Date;
  users: Map<string, CollaborationUser>;
  isActive: boolean;
}

export interface CollaborationUser {
  id: string;
  name: string;
  email?: string;
  color: string;
  joinedAt: Date;
  lastActivity: Date;
  cursor?: CursorPosition;
  isTyping: boolean;
}

export interface CollaborationEvent {
  type: 'operation' | 'cursor' | 'presence' | 'sync';
  sessionId: string;
  userId: string;
  payload: unknown;
  timestamp: number;
}

export interface JoinSessionResult {
  session: CollaborationSession;
  document: CRDTDocument;
  users: CollaborationUser[];
  content: string;
}

// ============================================================================
// COLLABORATION MANAGER
// ============================================================================

export class CollaborationManager extends EventEmitter {
  private sessions: Map<string, CollaborationSession> = new Map();
  private userSessions: Map<string, Set<string>> = new Map(); // userId -> sessionIds
  private documentStore = getDocumentStore();
  private redisEnabled: boolean;
  private unsubscribeFromRedis: (() => void) | null = null;

  // User colors for cursors
  private colors = [
    '#FF6B6B',
    '#4ECDC4',
    '#45B7D1',
    '#96CEB4',
    '#FFEAA7',
    '#DDA0DD',
    '#98D8C8',
    '#F7DC6F',
    '#BB8FCE',
    '#85C1E9',
    '#82E0AA',
    '#F8C471',
  ];
  private colorIndex = 0;

  constructor() {
    super();
    this.redisEnabled = isRedisAvailable();

    if (this.redisEnabled) {
      log.info('Redis persistence enabled for collaboration');
      // Subscribe to cross-server events
      this.unsubscribeFromRedis = subscribeToEvents((event) => {
        this.handleRemoteEvent(event);
      });
      // Start polling for events (Upstash doesn't support real pub/sub)
      startEventPolling(500);
    } else {
      log.info('Redis not available, using in-memory collaboration only');
    }
  }

  /**
   * Cleanup resources (call on shutdown)
   */
  cleanup(): void {
    if (this.unsubscribeFromRedis) {
      this.unsubscribeFromRedis();
      this.unsubscribeFromRedis = null;
    }
    log.info('CollaborationManager cleaned up');
  }

  /**
   * Handle events from other servers (Redis pub/sub)
   */
  private handleRemoteEvent(event: RedisCollaborationEvent): void {
    const session = this.sessions.get(event.sessionId);
    if (!session) return;

    switch (event.type) {
      case 'operation': {
        const document = this.documentStore.getDocument(session.documentId, event.userId);
        document.applyRemoteOperation(event.payload as CRDTOperation);
        this.emit('remoteOperation', { sessionId: event.sessionId, operation: event.payload });
        break;
      }
      case 'cursor': {
        const payload = event.payload as {
          position: number;
          selection?: { start: number; end: number };
        };
        const document = this.documentStore.getDocument(session.documentId, event.userId);
        document.applyRemoteCursor({
          userId: event.userId,
          userName: session.users.get(event.userId)?.name || 'Unknown',
          position: payload.position,
          selection: payload.selection,
          color: session.users.get(event.userId)?.color || '#888',
        });
        break;
      }
      case 'join':
      case 'leave':
        // Reload session from Redis to get updated user list
        this.reloadSessionFromRedis(event.sessionId);
        break;
    }
  }

  /**
   * Reload session from Redis (for cross-server sync)
   */
  private async reloadSessionFromRedis(sessionId: string): Promise<void> {
    if (!this.redisEnabled) return;

    const serialized = await loadSession(sessionId);
    if (serialized) {
      const session = this.deserializeSession(serialized);
      this.sessions.set(sessionId, session);
      this.emit('sessionUpdated', session);
    }
  }

  /**
   * Serialize session for Redis storage
   */
  private serializeSession(session: CollaborationSession): SerializedSession {
    return {
      id: session.id,
      documentId: session.documentId,
      ownerId: session.ownerId,
      createdAt: session.createdAt.toISOString(),
      users: Array.from(session.users.values()).map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        color: user.color,
        joinedAt: user.joinedAt.toISOString(),
        lastActivity: user.lastActivity.toISOString(),
        cursor: user.cursor,
        isTyping: user.isTyping,
      })),
      isActive: session.isActive,
    };
  }

  /**
   * Deserialize session from Redis storage
   */
  private deserializeSession(serialized: SerializedSession): CollaborationSession {
    const users = new Map<string, CollaborationUser>();
    for (const u of serialized.users) {
      users.set(u.id, {
        id: u.id,
        name: u.name,
        email: u.email,
        color: u.color,
        joinedAt: new Date(u.joinedAt),
        lastActivity: new Date(u.lastActivity),
        cursor: u.cursor,
        isTyping: u.isTyping,
      });
    }

    return {
      id: serialized.id,
      documentId: serialized.documentId,
      ownerId: serialized.ownerId,
      createdAt: new Date(serialized.createdAt),
      users,
      isActive: serialized.isActive,
    };
  }

  /**
   * Persist session to Redis
   */
  private async persistSession(session: CollaborationSession): Promise<void> {
    if (!this.redisEnabled) return;

    const serialized = this.serializeSession(session);
    await saveSession(serialized);
  }

  /**
   * Persist document state to Redis
   */
  private async persistDocumentState(documentId: string, state: CRDTState): Promise<void> {
    if (!this.redisEnabled) return;
    await saveDocumentState(documentId, state);
  }

  /**
   * Create a new collaboration session
   */
  createSession(
    documentId: string,
    ownerId: string,
    ownerName: string,
    initialContent: string = ''
  ): CollaborationSession {
    const sessionId = `session-${documentId}-${Date.now()}`;

    // Create or get the CRDT document
    const document = this.documentStore.getDocument(documentId, ownerId, initialContent);

    // Create session
    const session: CollaborationSession = {
      id: sessionId,
      documentId,
      ownerId,
      createdAt: new Date(),
      users: new Map(),
      isActive: true,
    };

    // Add owner as first user
    const owner: CollaborationUser = {
      id: ownerId,
      name: ownerName,
      color: this.getNextColor(),
      joinedAt: new Date(),
      lastActivity: new Date(),
      isTyping: false,
    };
    session.users.set(ownerId, owner);

    // Store session
    this.sessions.set(sessionId, session);
    this.trackUserSession(ownerId, sessionId);

    // Set up document event listeners
    this.setupDocumentListeners(sessionId, document);

    // Persist to Redis for cross-server sync
    this.persistSession(session);

    log.info('Created collaboration session', {
      sessionId,
      documentId,
      ownerId,
      redisEnabled: this.redisEnabled,
    });

    return session;
  }

  /**
   * Join an existing collaboration session
   * Supports session recovery from Redis on reconnect
   */
  async joinSession(
    sessionId: string,
    userId: string,
    userName: string
  ): Promise<JoinSessionResult | null> {
    let session = this.sessions.get(sessionId);

    // CRITICAL-005: Try to recover session from Redis if not found locally
    if (!session && this.redisEnabled) {
      log.info('Attempting session recovery from Redis', { sessionId, userId });
      const serialized = await loadSession(sessionId);
      if (serialized && serialized.isActive) {
        session = this.deserializeSession(serialized);
        this.sessions.set(sessionId, session);
        log.info('Session recovered from Redis', { sessionId });

        // Also try to recover document state
        const docState = await loadDocumentState(session.documentId);
        if (docState) {
          const document = this.documentStore.getDocument(session.documentId, userId);
          document.syncWithState(docState);
          log.info('Document state recovered from Redis', { documentId: session.documentId });
        }
      }
    }

    if (!session || !session.isActive) {
      log.warn('Session not found or inactive', { sessionId });
      return null;
    }

    // Check if user already in session
    if (!session.users.has(userId)) {
      // Add user to session
      const user: CollaborationUser = {
        id: userId,
        name: userName,
        color: this.getNextColor(),
        joinedAt: new Date(),
        lastActivity: new Date(),
        isTyping: false,
      };
      session.users.set(userId, user);
      this.trackUserSession(userId, sessionId);

      // Notify others
      this.broadcastPresence(sessionId, userId, 'joined');

      // Persist to Redis and publish event for cross-server sync
      this.persistSession(session);
      publishEvent('join', sessionId, userId, { userName });
    }

    // Get document
    const document = this.documentStore.getDocument(session.documentId, userId);

    // Setup listeners if not already done
    this.setupDocumentListeners(sessionId, document);

    // CRITICAL-005: Replay any buffered operations for this user
    if (this.redisEnabled) {
      const bufferedOps = await getBufferedOperations(sessionId, userId);
      if (bufferedOps.length > 0) {
        log.info('Replaying buffered operations', { sessionId, userId, count: bufferedOps.length });
        for (const op of bufferedOps) {
          document.applyRemoteOperation(op);
        }
        // Clear the buffer after replay
        await clearBufferedOperations(sessionId, userId);
      }
    }

    log.info('User joined session', { sessionId, userId });

    return {
      session,
      document,
      users: Array.from(session.users.values()),
      content: document.getContent(),
    };
  }

  /**
   * Leave a collaboration session
   */
  leaveSession(sessionId: string, userId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.users.delete(userId);
    this.untrackUserSession(userId, sessionId);

    // Remove cursor
    const document = this.documentStore.getDocument(session.documentId, userId);
    document.removeCursor(userId);

    // Notify others
    this.broadcastPresence(sessionId, userId, 'left');

    // If no users left, mark session as inactive
    if (session.users.size === 0) {
      session.isActive = false;
      // Persist final document state to Redis
      this.persistDocumentState(session.documentId, document.getState());
      log.info('Session became inactive', { sessionId });
    }

    // Persist to Redis and publish event for cross-server sync
    this.persistSession(session);
    publishEvent('leave', sessionId, userId, {});

    log.info('User left session', { sessionId, userId });
  }

  /**
   * SECURITY: Check if user is a member of the session
   */
  private isSessionMember(session: CollaborationSession, userId: string): boolean {
    return session.users.has(userId);
  }

  /**
   * Apply an operation to a session's document
   */
  applyOperation(sessionId: string, userId: string, operation: CRDTOperation): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive) {
      return false;
    }

    // CRITICAL-007: Verify user is a member of the session
    if (!this.isSessionMember(session, userId)) {
      log.warn('Unauthorized operation attempt', { sessionId, userId });
      return false;
    }

    const document = this.documentStore.getDocument(session.documentId, userId);

    // Apply remote operation
    const applied = document.applyRemoteOperation(operation);

    if (applied) {
      // Update user activity
      const user = session.users.get(userId);
      if (user) {
        user.lastActivity = new Date();
        user.isTyping = true;
        // Reset typing indicator after 2 seconds
        setTimeout(() => {
          user.isTyping = false;
        }, 2000);
      }

      // Broadcast to other users
      this.broadcastOperation(sessionId, userId, operation);

      // Publish to Redis for cross-server sync
      publishEvent('operation', sessionId, userId, operation);
    }

    return applied;
  }

  /**
   * Update cursor position
   */
  updateCursor(
    sessionId: string,
    userId: string,
    position: number,
    selection?: { start: number; end: number }
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // CRITICAL-007: Verify user is a member of the session
    if (!this.isSessionMember(session, userId)) {
      log.warn('Unauthorized cursor update attempt', { sessionId, userId });
      return;
    }

    const document = this.documentStore.getDocument(session.documentId, userId);
    document.updateCursor(position, selection);

    // Update user in session
    const user = session.users.get(userId);
    if (user) {
      user.cursor = {
        userId,
        userName: user.name,
        position,
        selection,
        color: user.color,
      };
      user.lastActivity = new Date();
    }

    // Broadcast cursor update
    this.broadcastCursor(sessionId, userId, position, selection);

    // Publish to Redis for cross-server sync
    publishEvent('cursor', sessionId, userId, { position, selection });
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): CollaborationSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all sessions for a document
   */
  getDocumentSessions(documentId: string): CollaborationSession[] {
    return Array.from(this.sessions.values()).filter(
      (s) => s.documentId === documentId && s.isActive
    );
  }

  /**
   * Get all sessions for a user
   */
  getUserSessions(userId: string): CollaborationSession[] {
    const sessionIds = this.userSessions.get(userId);
    if (!sessionIds) return [];

    return Array.from(sessionIds)
      .map((id) => this.sessions.get(id))
      .filter((s): s is CollaborationSession => s !== undefined && s.isActive);
  }

  /**
   * Sync document state with a remote state
   */
  syncDocument(
    sessionId: string,
    userId: string,
    remoteState: {
      content: string;
      operations: CRDTOperation[];
      vectorClock: Record<string, number>;
      version: number;
    }
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const document = this.documentStore.getDocument(session.documentId, userId);
    document.syncWithState(remoteState);

    log.info('Document synced', { sessionId, newVersion: remoteState.version });
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private setupDocumentListeners(sessionId: string, document: CRDTDocument): void {
    document.on('operation', (op: CRDTOperation) => {
      this.emit('operation', {
        type: 'operation',
        sessionId,
        userId: op.userId,
        payload: op,
        timestamp: Date.now(),
      });
    });

    document.on('cursorUpdate', (cursor: CursorPosition) => {
      this.emit('cursor', {
        type: 'cursor',
        sessionId,
        userId: cursor.userId,
        payload: cursor,
        timestamp: Date.now(),
      });
    });
  }

  private broadcastOperation(sessionId: string, userId: string, operation: CRDTOperation): void {
    this.emit('broadcast', {
      type: 'operation',
      sessionId,
      userId,
      payload: operation,
      timestamp: Date.now(),
    } as CollaborationEvent);
  }

  private broadcastCursor(
    sessionId: string,
    userId: string,
    position: number,
    selection?: { start: number; end: number }
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const user = session.users.get(userId);
    if (!user) return;

    this.emit('broadcast', {
      type: 'cursor',
      sessionId,
      userId,
      payload: {
        userId,
        userName: user.name,
        position,
        selection,
        color: user.color,
      },
      timestamp: Date.now(),
    } as CollaborationEvent);
  }

  private broadcastPresence(sessionId: string, userId: string, action: 'joined' | 'left'): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    this.emit('broadcast', {
      type: 'presence',
      sessionId,
      userId,
      payload: {
        action,
        user: session.users.get(userId),
        users: Array.from(session.users.values()),
      },
      timestamp: Date.now(),
    } as CollaborationEvent);
  }

  private trackUserSession(userId: string, sessionId: string): void {
    if (!this.userSessions.has(userId)) {
      this.userSessions.set(userId, new Set());
    }
    this.userSessions.get(userId)!.add(sessionId);
  }

  private untrackUserSession(userId: string, sessionId: string): void {
    const sessions = this.userSessions.get(userId);
    if (sessions) {
      sessions.delete(sessionId);
      if (sessions.size === 0) {
        this.userSessions.delete(userId);
      }
    }
  }

  private getNextColor(): string {
    const color = this.colors[this.colorIndex % this.colors.length];
    this.colorIndex++;
    return color;
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let collaborationManagerInstance: CollaborationManager | null = null;

export function getCollaborationManager(): CollaborationManager {
  if (!collaborationManagerInstance) {
    collaborationManagerInstance = new CollaborationManager();
  }
  return collaborationManagerInstance;
}
