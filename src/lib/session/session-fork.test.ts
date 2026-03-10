/**
 * Session Forking Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  SessionForkManager,
  getSessionForkManager,
  resetSessionForkManager,
  type SessionMessage,
  type SessionContext,
} from './session-fork';

// Mock the logger
vi.mock('@/lib/logger', () => ({
  logger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// ============================================
// TEST DATA
// ============================================

const createTestMessages = (count: number): SessionMessage[] => {
  return Array.from({ length: count }, (_, i) => ({
    role: i % 2 === 0 ? ('user' as const) : ('assistant' as const),
    content: `Message ${i + 1}`,
    timestamp: new Date(Date.now() - (count - i) * 1000),
  }));
};

const createTestContext = (): SessionContext => ({
  cwd: '/workspace/project',
  env: { NODE_ENV: 'development' },
  activeFiles: ['src/index.ts', 'package.json'],
  toolPermissions: ['Read', 'Edit'],
  custom: { theme: 'dark' },
});

// ============================================
// SESSION FORK MANAGER TESTS
// ============================================

describe('SessionForkManager', () => {
  let manager: SessionForkManager;
  const sessionId = 'test-session-123';
  const workspaceId = 'workspace-456';
  const userId = 'user-789';

  beforeEach(() => {
    resetSessionForkManager();
    manager = new SessionForkManager();
  });

  describe('Snapshot Creation', () => {
    it('should create a snapshot of current session state', () => {
      const messages = createTestMessages(5);
      const context = createTestContext();

      const snapshot = manager.createSnapshot(
        sessionId,
        workspaceId,
        userId,
        messages,
        context,
        'Test snapshot'
      );

      expect(snapshot.id).toMatch(/^snap_/);
      expect(snapshot.sessionId).toBe(sessionId);
      expect(snapshot.workspaceId).toBe(workspaceId);
      expect(snapshot.userId).toBe(userId);
      expect(snapshot.label).toBe('Test snapshot');
      expect(snapshot.messageIndex).toBe(5);
      expect(snapshot.messages).toHaveLength(5);
      expect(snapshot.context.cwd).toBe('/workspace/project');
      expect(snapshot.createdAt).toBeInstanceOf(Date);
    });

    it('should create independent copy of messages', () => {
      const messages = createTestMessages(3);
      const context = createTestContext();

      const snapshot = manager.createSnapshot(sessionId, workspaceId, userId, messages, context);

      // Modify original
      messages.push({
        role: 'user',
        content: 'New message',
        timestamp: new Date(),
      });

      // Snapshot should be unchanged
      expect(snapshot.messages).toHaveLength(3);
    });

    it('should track multiple snapshots per session', () => {
      const messages1 = createTestMessages(3);
      const messages2 = createTestMessages(5);
      const context = createTestContext();

      manager.createSnapshot(sessionId, workspaceId, userId, messages1, context, 'First');
      manager.createSnapshot(sessionId, workspaceId, userId, messages2, context, 'Second');

      const snapshots = manager.getSessionSnapshots(sessionId);
      expect(snapshots).toHaveLength(2);
    });
  });

  describe('Session Forking', () => {
    it('should fork a session at current state', () => {
      const messages = createTestMessages(5);
      const context = createTestContext();

      const fork = manager.fork(sessionId, workspaceId, userId, messages, context, {
        label: 'Experiment branch',
      });

      expect(fork.id).toMatch(/^fork_/);
      expect(fork.parentSessionId).toBe(sessionId);
      expect(fork.snapshotId).toMatch(/^snap_/);
      expect(fork.label).toBe('Experiment branch');
      expect(fork.messages).toHaveLength(5);
      expect(fork.context.cwd).toBe('/workspace/project');
    });

    it('should fork from specific message index', () => {
      const messages = createTestMessages(10);
      const context = createTestContext();

      const fork = manager.fork(sessionId, workspaceId, userId, messages, context, {
        fromMessageIndex: 5,
        label: 'Midpoint fork',
      });

      expect(fork.messages).toHaveLength(5);
    });

    it('should inject initial message when provided', () => {
      const messages = createTestMessages(3);
      const context = createTestContext();

      const fork = manager.fork(sessionId, workspaceId, userId, messages, context, {
        initialMessage: 'Let me try a different approach...',
      });

      expect(fork.messages).toHaveLength(4);
      expect(fork.messages[3].role).toBe('user');
      expect(fork.messages[3].content).toBe('Let me try a different approach...');
      expect(fork.messages[3].metadata?.isForkInitialMessage).toBe(true);
    });

    it('should merge additional context', () => {
      const messages = createTestMessages(3);
      const context = createTestContext();

      const fork = manager.fork(sessionId, workspaceId, userId, messages, context, {
        additionalContext: {
          cwd: '/workspace/different',
          custom: { experimental: true },
        },
      });

      expect(fork.context.cwd).toBe('/workspace/different');
      expect(fork.context.custom).toEqual({ experimental: true });
      expect(fork.context.env).toEqual({ NODE_ENV: 'development' });
    });
  });

  describe('Fork from Snapshot', () => {
    it('should fork from existing snapshot', () => {
      const messages = createTestMessages(5);
      const context = createTestContext();

      const snapshot = manager.createSnapshot(
        sessionId,
        workspaceId,
        userId,
        messages,
        context,
        'Checkpoint'
      );

      const fork = manager.forkFromSnapshot(snapshot.id, {
        label: 'From checkpoint',
      });

      expect(fork).not.toBeNull();
      expect(fork!.snapshotId).toBe(snapshot.id);
      expect(fork!.messages).toHaveLength(5);
    });

    it('should return null for non-existent snapshot', () => {
      const fork = manager.forkFromSnapshot('nonexistent');
      expect(fork).toBeNull();
    });
  });

  describe('Fork Management', () => {
    it('should add messages to fork', () => {
      const messages = createTestMessages(3);
      const context = createTestContext();

      const fork = manager.fork(sessionId, workspaceId, userId, messages, context);

      const result = manager.addMessageToFork(fork.id, 'assistant', 'New response');

      expect(result).toBe(true);
      const updated = manager.getFork(fork.id);
      expect(updated!.messages).toHaveLength(4);
      expect(updated!.messages[3].content).toBe('New response');
    });

    it('should update fork context', () => {
      const messages = createTestMessages(3);
      const context = createTestContext();

      const fork = manager.fork(sessionId, workspaceId, userId, messages, context);

      const result = manager.updateForkContext(fork.id, {
        cwd: '/new/path',
        activeFiles: ['new-file.ts'],
      });

      expect(result).toBe(true);
      const updated = manager.getFork(fork.id);
      expect(updated!.context.cwd).toBe('/new/path');
      expect(updated!.context.activeFiles).toEqual(['new-file.ts']);
    });

    it('should get all forks for a session', () => {
      const messages = createTestMessages(5);
      const context = createTestContext();

      manager.fork(sessionId, workspaceId, userId, messages, context, { label: 'Fork 1' });
      manager.fork(sessionId, workspaceId, userId, messages, context, { label: 'Fork 2' });
      manager.fork(sessionId, workspaceId, userId, messages, context, { label: 'Fork 3' });

      const forks = manager.getSessionForks(sessionId);
      expect(forks).toHaveLength(3);
    });
  });

  describe('Fork Delta', () => {
    it('should get messages added after fork point', () => {
      const messages = createTestMessages(5);
      const context = createTestContext();

      const fork = manager.fork(sessionId, workspaceId, userId, messages, context);

      // Add messages to fork
      manager.addMessageToFork(fork.id, 'user', 'New user message');
      manager.addMessageToFork(fork.id, 'assistant', 'New assistant message');

      const delta = manager.getForkDelta(fork.id);

      expect(delta).toHaveLength(2);
      expect(delta![0].content).toBe('New user message');
      expect(delta![1].content).toBe('New assistant message');
    });

    it('should return null for non-existent fork', () => {
      const delta = manager.getForkDelta('nonexistent');
      expect(delta).toBeNull();
    });
  });

  describe('Fork Tree', () => {
    it('should get complete fork tree for session', () => {
      const messages = createTestMessages(5);
      const context = createTestContext();

      manager.createSnapshot(
        sessionId,
        workspaceId,
        userId,
        messages.slice(0, 2),
        context,
        'Early'
      );
      manager.createSnapshot(sessionId, workspaceId, userId, messages.slice(0, 4), context, 'Mid');
      manager.fork(sessionId, workspaceId, userId, messages, context, { label: 'Fork A' });
      manager.fork(sessionId, workspaceId, userId, messages, context, { label: 'Fork B' });

      const tree = manager.getForkTree(sessionId);

      expect(tree.snapshots.length).toBeGreaterThanOrEqual(2);
      expect(tree.forks).toHaveLength(2);
    });
  });

  describe('Deletion', () => {
    it('should delete snapshot', () => {
      const messages = createTestMessages(3);
      const context = createTestContext();

      const snapshot = manager.createSnapshot(sessionId, workspaceId, userId, messages, context);

      const result = manager.deleteSnapshot(snapshot.id);

      expect(result).toBe(true);
      expect(manager.getSnapshot(snapshot.id)).toBeUndefined();
      expect(manager.getSessionSnapshots(sessionId)).toHaveLength(0);
    });

    it('should delete fork', () => {
      const messages = createTestMessages(3);
      const context = createTestContext();

      const fork = manager.fork(sessionId, workspaceId, userId, messages, context);

      const result = manager.deleteFork(fork.id);

      expect(result).toBe(true);
      expect(manager.getFork(fork.id)).toBeUndefined();
    });

    it('should return false when deleting non-existent snapshot', () => {
      expect(manager.deleteSnapshot('nonexistent')).toBe(false);
    });

    it('should return false when deleting non-existent fork', () => {
      expect(manager.deleteFork('nonexistent')).toBe(false);
    });
  });

  describe('Clear', () => {
    it('should clear all data', () => {
      const messages = createTestMessages(5);
      const context = createTestContext();

      manager.createSnapshot(sessionId, workspaceId, userId, messages, context);
      manager.fork(sessionId, workspaceId, userId, messages, context);

      manager.clear();

      expect(manager.getSessionSnapshots(sessionId)).toHaveLength(0);
      expect(manager.getSessionForks(sessionId)).toHaveLength(0);
    });
  });
});

// ============================================
// SINGLETON TESTS
// ============================================

describe('getSessionForkManager', () => {
  beforeEach(() => {
    resetSessionForkManager();
  });

  it('should return singleton instance', () => {
    const manager1 = getSessionForkManager();
    const manager2 = getSessionForkManager();
    expect(manager1).toBe(manager2);
  });

  it('should reset singleton', () => {
    const manager1 = getSessionForkManager();
    resetSessionForkManager();
    const manager2 = getSessionForkManager();
    expect(manager1).not.toBe(manager2);
  });
});
