/**
 * Session Forking
 *
 * Enables forking (branching) conversations/sessions to explore
 * different approaches without losing the original context.
 * Similar to Claude Code's conversation forking feature.
 */

import { logger } from '@/lib/logger';
import crypto from 'crypto';

const log = logger('session-fork');

// ============================================================================
// TYPES
// ============================================================================

export interface SessionSnapshot {
  /** Unique ID for this snapshot */
  id: string;

  /** Original session ID */
  sessionId: string;

  /** Workspace ID */
  workspaceId: string;

  /** User ID */
  userId: string;

  /** Label for this snapshot */
  label?: string;

  /** Message index at which this snapshot was taken */
  messageIndex: number;

  /** Full conversation history up to this point */
  messages: SessionMessage[];

  /** Context variables at snapshot time */
  context: SessionContext;

  /** When the snapshot was created */
  createdAt: Date;
}

export interface SessionMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface SessionContext {
  /** Current working directory */
  cwd?: string;

  /** Environment variables */
  env?: Record<string, string>;

  /** Active files being worked on */
  activeFiles?: string[];

  /** Tool permissions state */
  toolPermissions?: string[];

  /** Any custom context data */
  custom?: Record<string, unknown>;
}

export interface ForkedSession {
  /** New forked session ID */
  id: string;

  /** Original session ID this was forked from */
  parentSessionId: string;

  /** Snapshot ID this fork is based on */
  snapshotId: string;

  /** Fork label/name */
  label: string;

  /** When the fork was created */
  createdAt: Date;

  /** Message history inherited from parent */
  messages: SessionMessage[];

  /** Context inherited from parent */
  context: SessionContext;
}

export interface ForkOptions {
  /** Label for the forked session */
  label?: string;

  /** Message index to fork from (default: latest) */
  fromMessageIndex?: number;

  /** Additional context to inject into the fork */
  additionalContext?: Partial<SessionContext>;

  /** Message to add to start the fork */
  initialMessage?: string;
}

// ============================================================================
// SESSION FORK MANAGER
// ============================================================================

export class SessionForkManager {
  private snapshots: Map<string, SessionSnapshot> = new Map();
  private forks: Map<string, ForkedSession> = new Map();
  private sessionSnapshots: Map<string, string[]> = new Map(); // sessionId -> snapshotIds

  constructor() {
    log.info('SessionForkManager initialized');
  }

  /**
   * Generate a unique ID
   */
  private generateId(prefix: string): string {
    return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
  }

  /**
   * Create a snapshot of a session at a specific point
   */
  createSnapshot(
    sessionId: string,
    workspaceId: string,
    userId: string,
    messages: SessionMessage[],
    context: SessionContext,
    label?: string
  ): SessionSnapshot {
    const id = this.generateId('snap');

    const snapshot: SessionSnapshot = {
      id,
      sessionId,
      workspaceId,
      userId,
      label: label || `Snapshot at message ${messages.length}`,
      messageIndex: messages.length,
      messages: [...messages],
      context: { ...context },
      createdAt: new Date(),
    };

    this.snapshots.set(id, snapshot);

    // Track snapshots per session
    const sessionSnaps = this.sessionSnapshots.get(sessionId) || [];
    sessionSnaps.push(id);
    this.sessionSnapshots.set(sessionId, sessionSnaps);

    log.info('Snapshot created', {
      id,
      sessionId,
      messageCount: messages.length,
    });

    return snapshot;
  }

  /**
   * Fork a session from a snapshot or current state
   */
  fork(
    sessionId: string,
    workspaceId: string,
    userId: string,
    messages: SessionMessage[],
    context: SessionContext,
    options: ForkOptions = {}
  ): ForkedSession {
    const { label, fromMessageIndex, additionalContext, initialMessage } = options;

    // Determine the message index to fork from
    const forkIndex = fromMessageIndex ?? messages.length;
    const forkMessages = messages.slice(0, forkIndex);

    // Create a snapshot at the fork point
    const snapshot = this.createSnapshot(
      sessionId,
      workspaceId,
      userId,
      forkMessages,
      context,
      `Fork point: ${label || 'unnamed'}`
    );

    // Create the forked session
    const forkId = this.generateId('fork');
    const forkedSession: ForkedSession = {
      id: forkId,
      parentSessionId: sessionId,
      snapshotId: snapshot.id,
      label: label || `Fork from ${sessionId}`,
      createdAt: new Date(),
      messages: [...forkMessages],
      context: {
        ...context,
        ...additionalContext,
      },
    };

    // Add initial message if provided
    if (initialMessage) {
      forkedSession.messages.push({
        role: 'user',
        content: initialMessage,
        timestamp: new Date(),
        metadata: { isForkInitialMessage: true },
      });
    }

    this.forks.set(forkId, forkedSession);

    log.info('Session forked', {
      forkId,
      parentSessionId: sessionId,
      snapshotId: snapshot.id,
      messageCount: forkMessages.length,
    });

    return forkedSession;
  }

  /**
   * Fork from a specific snapshot
   */
  forkFromSnapshot(snapshotId: string, options: ForkOptions = {}): ForkedSession | null {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) {
      log.warn('Snapshot not found', { snapshotId });
      return null;
    }

    const { label, additionalContext, initialMessage } = options;

    const forkId = this.generateId('fork');
    const forkedSession: ForkedSession = {
      id: forkId,
      parentSessionId: snapshot.sessionId,
      snapshotId: snapshot.id,
      label: label || `Fork from snapshot ${snapshotId}`,
      createdAt: new Date(),
      messages: [...snapshot.messages],
      context: {
        ...snapshot.context,
        ...additionalContext,
      },
    };

    if (initialMessage) {
      forkedSession.messages.push({
        role: 'user',
        content: initialMessage,
        timestamp: new Date(),
        metadata: { isForkInitialMessage: true },
      });
    }

    this.forks.set(forkId, forkedSession);

    log.info('Forked from snapshot', {
      forkId,
      snapshotId,
      parentSessionId: snapshot.sessionId,
    });

    return forkedSession;
  }

  /**
   * Get a snapshot by ID
   */
  getSnapshot(snapshotId: string): SessionSnapshot | undefined {
    return this.snapshots.get(snapshotId);
  }

  /**
   * Get all snapshots for a session
   */
  getSessionSnapshots(sessionId: string): SessionSnapshot[] {
    const snapshotIds = this.sessionSnapshots.get(sessionId) || [];
    return snapshotIds
      .map((id) => this.snapshots.get(id))
      .filter((s): s is SessionSnapshot => s !== undefined)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Get a forked session by ID
   */
  getFork(forkId: string): ForkedSession | undefined {
    return this.forks.get(forkId);
  }

  /**
   * Get all forks of a session
   */
  getSessionForks(sessionId: string): ForkedSession[] {
    return Array.from(this.forks.values())
      .filter((f) => f.parentSessionId === sessionId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Add a message to a forked session
   */
  addMessageToFork(
    forkId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    metadata?: Record<string, unknown>
  ): boolean {
    const fork = this.forks.get(forkId);
    if (!fork) {
      return false;
    }

    fork.messages.push({
      role,
      content,
      timestamp: new Date(),
      metadata,
    });

    return true;
  }

  /**
   * Update context for a forked session
   */
  updateForkContext(forkId: string, contextUpdate: Partial<SessionContext>): boolean {
    const fork = this.forks.get(forkId);
    if (!fork) {
      return false;
    }

    fork.context = { ...fork.context, ...contextUpdate };
    return true;
  }

  /**
   * Delete a snapshot
   */
  deleteSnapshot(snapshotId: string): boolean {
    const snapshot = this.snapshots.get(snapshotId);
    if (!snapshot) {
      return false;
    }

    // Remove from session's snapshot list
    const sessionSnaps = this.sessionSnapshots.get(snapshot.sessionId) || [];
    const index = sessionSnaps.indexOf(snapshotId);
    if (index !== -1) {
      sessionSnaps.splice(index, 1);
      this.sessionSnapshots.set(snapshot.sessionId, sessionSnaps);
    }

    this.snapshots.delete(snapshotId);
    log.info('Snapshot deleted', { snapshotId });
    return true;
  }

  /**
   * Delete a forked session
   */
  deleteFork(forkId: string): boolean {
    if (!this.forks.has(forkId)) {
      return false;
    }

    this.forks.delete(forkId);
    log.info('Fork deleted', { forkId });
    return true;
  }

  /**
   * Merge changes from a fork back to the original session
   * Returns the messages that were added in the fork
   */
  getForkDelta(forkId: string): SessionMessage[] | null {
    const fork = this.forks.get(forkId);
    if (!fork) {
      return null;
    }

    const snapshot = this.snapshots.get(fork.snapshotId);
    if (!snapshot) {
      return fork.messages;
    }

    // Return only the messages added after the fork point
    return fork.messages.slice(snapshot.messageIndex);
  }

  /**
   * Get the fork tree for a session (parent -> children)
   */
  getForkTree(sessionId: string): {
    snapshots: SessionSnapshot[];
    forks: ForkedSession[];
  } {
    return {
      snapshots: this.getSessionSnapshots(sessionId),
      forks: this.getSessionForks(sessionId),
    };
  }

  /**
   * Clear all data (for testing)
   */
  clear(): void {
    this.snapshots.clear();
    this.forks.clear();
    this.sessionSnapshots.clear();
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let forkManagerInstance: SessionForkManager | null = null;

export function getSessionForkManager(): SessionForkManager {
  if (!forkManagerInstance) {
    forkManagerInstance = new SessionForkManager();
  }
  return forkManagerInstance;
}

export function resetSessionForkManager(): void {
  forkManagerInstance = null;
}
