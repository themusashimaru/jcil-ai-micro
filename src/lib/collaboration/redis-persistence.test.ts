import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// Mocks — MUST come before imports of the module under test
// vi.hoisted() ensures variables are available when vi.mock factories run
// ============================================================================

const { mockRedis, mockCacheGet, mockCacheSet, mockCacheDelete, mockIsRedisAvailable } = vi.hoisted(
  () => ({
    mockRedis: {
      keys: vi.fn(),
      rpush: vi.fn(),
      lrange: vi.fn(),
      ltrim: vi.fn(),
      expire: vi.fn(),
      ping: vi.fn(),
    },
    mockCacheGet: vi.fn(),
    mockCacheSet: vi.fn(),
    mockCacheDelete: vi.fn(),
    mockIsRedisAvailable: vi.fn(),
  })
);

vi.mock('@/lib/redis/client', () => ({
  redis: mockRedis,
  cacheGet: mockCacheGet,
  cacheSet: mockCacheSet,
  cacheDelete: mockCacheDelete,
  isRedisAvailable: mockIsRedisAvailable,
}));

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(),
}));

import {
  saveSession,
  loadSession,
  deleteSession,
  listActiveSessions,
  saveDocumentState,
  loadDocumentState,
  deleteDocumentState,
  publishEvent,
  subscribeToEvents,
  startEventPolling,
  stopEventPolling,
  pushEventToQueue,
  bufferOperation,
  getBufferedOperations,
  clearBufferedOperations,
  checkRedisHealth,
  isRedisAvailable,
  SERVER_ID,
} from './redis-persistence';
import type { SerializedSession, CollaborationEvent } from './redis-persistence';
import type { CRDTOperation, CRDTState } from './crdt-document';

// ============================================================================
// Tests
// ============================================================================

describe('redis-persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsRedisAvailable.mockReturnValue(true);
    stopEventPolling();
  });

  // ============================================================================
  // SERVER_ID
  // ============================================================================

  describe('SERVER_ID', () => {
    it('should be a non-empty string', () => {
      expect(typeof SERVER_ID).toBe('string');
      expect(SERVER_ID.length).toBeGreaterThan(0);
    });

    it('should start with "server-"', () => {
      expect(SERVER_ID.startsWith('server-')).toBe(true);
    });
  });

  // ============================================================================
  // isRedisAvailable (re-exported)
  // ============================================================================

  describe('isRedisAvailable', () => {
    it('should re-export isRedisAvailable from redis client', () => {
      expect(typeof isRedisAvailable).toBe('function');
    });
  });

  // ============================================================================
  // saveSession
  // ============================================================================

  describe('saveSession', () => {
    const mockSession: SerializedSession = {
      id: 'session-1',
      documentId: 'doc-1',
      ownerId: 'user-1',
      createdAt: '2026-01-01T00:00:00.000Z',
      users: [
        {
          id: 'user-1',
          name: 'Alice',
          color: '#FF6B6B',
          joinedAt: '2026-01-01T00:00:00.000Z',
          lastActivity: '2026-01-01T00:00:00.000Z',
          isTyping: false,
        },
      ],
      isActive: true,
    };

    it('should save session to Redis when available', async () => {
      mockCacheSet.mockResolvedValue(true);

      const result = await saveSession(mockSession);
      expect(result).toBe(true);
      expect(mockCacheSet).toHaveBeenCalledWith('collab:session:session-1', mockSession, 86400);
    });

    it('should return false when Redis is not available', async () => {
      mockIsRedisAvailable.mockReturnValue(false);

      const result = await saveSession(mockSession);
      expect(result).toBe(false);
      expect(mockCacheSet).not.toHaveBeenCalled();
    });

    it('should use correct TTL of 86400 seconds (24 hours)', async () => {
      mockCacheSet.mockResolvedValue(true);

      await saveSession(mockSession);
      const ttlArg = mockCacheSet.mock.calls[0][2];
      expect(ttlArg).toBe(86400);
    });
  });

  // ============================================================================
  // loadSession
  // ============================================================================

  describe('loadSession', () => {
    it('should load session from Redis when available', async () => {
      const mockData: SerializedSession = {
        id: 'session-1',
        documentId: 'doc-1',
        ownerId: 'user-1',
        createdAt: '2026-01-01T00:00:00.000Z',
        users: [],
        isActive: true,
      };
      mockCacheGet.mockResolvedValue(mockData);

      const result = await loadSession('session-1');
      expect(result).toEqual(mockData);
      expect(mockCacheGet).toHaveBeenCalledWith('collab:session:session-1');
    });

    it('should return null when Redis is not available', async () => {
      mockIsRedisAvailable.mockReturnValue(false);

      const result = await loadSession('session-1');
      expect(result).toBeNull();
    });

    it('should return null when session does not exist', async () => {
      mockCacheGet.mockResolvedValue(null);

      const result = await loadSession('nonexistent');
      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // deleteSession
  // ============================================================================

  describe('deleteSession', () => {
    it('should delete session from Redis when available', async () => {
      mockCacheDelete.mockResolvedValue(true);

      const result = await deleteSession('session-1');
      expect(result).toBe(true);
      expect(mockCacheDelete).toHaveBeenCalledWith('collab:session:session-1');
    });

    it('should return false when Redis is not available', async () => {
      mockIsRedisAvailable.mockReturnValue(false);

      const result = await deleteSession('session-1');
      expect(result).toBe(false);
    });
  });

  // ============================================================================
  // listActiveSessions
  // ============================================================================

  describe('listActiveSessions', () => {
    it('should list active session IDs from Redis', async () => {
      mockRedis.keys.mockResolvedValue(['collab:session:session-1', 'collab:session:session-2']);

      const result = await listActiveSessions();
      expect(result).toEqual(['session-1', 'session-2']);
      expect(mockRedis.keys).toHaveBeenCalledWith('collab:session:*');
    });

    it('should return empty array when no sessions', async () => {
      mockRedis.keys.mockResolvedValue([]);

      const result = await listActiveSessions();
      expect(result).toEqual([]);
    });

    it('should return empty array on Redis error', async () => {
      mockRedis.keys.mockRejectedValue(new Error('Redis error'));

      const result = await listActiveSessions();
      expect(result).toEqual([]);
    });
  });

  // ============================================================================
  // saveDocumentState
  // ============================================================================

  describe('saveDocumentState', () => {
    const mockState: CRDTState = {
      content: 'Hello',
      operations: [],
      vectorClock: { 'user-1': 1 },
      version: 1,
    };

    it('should save document state to Redis', async () => {
      mockCacheSet.mockResolvedValue(true);

      const result = await saveDocumentState('doc-1', mockState);
      expect(result).toBe(true);
      expect(mockCacheSet).toHaveBeenCalledWith('collab:doc:doc-1', mockState, 604800);
    });

    it('should return false when Redis is not available', async () => {
      mockIsRedisAvailable.mockReturnValue(false);

      const result = await saveDocumentState('doc-1', mockState);
      expect(result).toBe(false);
    });

    it('should use correct TTL of 604800 seconds (7 days)', async () => {
      mockCacheSet.mockResolvedValue(true);

      await saveDocumentState('doc-1', mockState);
      const ttlArg = mockCacheSet.mock.calls[0][2];
      expect(ttlArg).toBe(604800);
    });
  });

  // ============================================================================
  // loadDocumentState
  // ============================================================================

  describe('loadDocumentState', () => {
    it('should load document state from Redis', async () => {
      const mockState: CRDTState = {
        content: 'Hello',
        operations: [],
        vectorClock: {},
        version: 1,
      };
      mockCacheGet.mockResolvedValue(mockState);

      const result = await loadDocumentState('doc-1');
      expect(result).toEqual(mockState);
      expect(mockCacheGet).toHaveBeenCalledWith('collab:doc:doc-1');
    });

    it('should return null when Redis is not available', async () => {
      mockIsRedisAvailable.mockReturnValue(false);

      const result = await loadDocumentState('doc-1');
      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // deleteDocumentState
  // ============================================================================

  describe('deleteDocumentState', () => {
    it('should delete document state from Redis', async () => {
      mockCacheDelete.mockResolvedValue(true);

      const result = await deleteDocumentState('doc-1');
      expect(result).toBe(true);
      expect(mockCacheDelete).toHaveBeenCalledWith('collab:doc:doc-1');
    });

    it('should return false when Redis is not available', async () => {
      mockIsRedisAvailable.mockReturnValue(false);

      const result = await deleteDocumentState('doc-1');
      expect(result).toBe(false);
    });
  });

  // ============================================================================
  // publishEvent
  // ============================================================================

  describe('publishEvent', () => {
    it('should publish event to Redis event queue', async () => {
      mockRedis.rpush.mockResolvedValue(1);

      const result = await publishEvent('operation', 'session-1', 'user-1', { data: 'test' });
      expect(result).toBe(true);
      expect(mockRedis.rpush).toHaveBeenCalledTimes(1);

      const pushArgs = mockRedis.rpush.mock.calls[0];
      expect(pushArgs[0]).toBe('collab:event_queue');

      const event = JSON.parse(pushArgs[1] as string) as CollaborationEvent;
      expect(event.type).toBe('operation');
      expect(event.sessionId).toBe('session-1');
      expect(event.userId).toBe('user-1');
      expect(event.serverId).toBe(SERVER_ID);
    });

    it('should return false on Redis error', async () => {
      mockRedis.rpush.mockRejectedValue(new Error('Redis error'));

      const result = await publishEvent('cursor', 'session-1', 'user-1', {});
      expect(result).toBe(false);
    });

    it('should include timestamp in published event', async () => {
      mockRedis.rpush.mockResolvedValue(1);
      const before = Date.now();

      await publishEvent('join', 'session-1', 'user-1', {});

      const event = JSON.parse(mockRedis.rpush.mock.calls[0][1] as string) as CollaborationEvent;
      expect(event.timestamp).toBeGreaterThanOrEqual(before);
      expect(event.timestamp).toBeLessThanOrEqual(Date.now());
    });
  });

  // ============================================================================
  // subscribeToEvents
  // ============================================================================

  describe('subscribeToEvents', () => {
    it('should register an event handler', () => {
      const handler = vi.fn();
      const unsubscribe = subscribeToEvents(handler);
      expect(typeof unsubscribe).toBe('function');

      // Clean up
      unsubscribe();
    });

    it('should return an unsubscribe function that removes handler', () => {
      const handler = vi.fn();
      const unsubscribe = subscribeToEvents(handler);
      // Unsubscribe and verify it doesn't throw
      expect(() => unsubscribe()).not.toThrow();
    });

    it('should allow multiple handlers', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const unsub1 = subscribeToEvents(handler1);
      const unsub2 = subscribeToEvents(handler2);

      // Clean up
      unsub1();
      unsub2();
    });
  });

  // ============================================================================
  // startEventPolling / stopEventPolling
  // ============================================================================

  describe('startEventPolling', () => {
    it('should not throw when called', () => {
      expect(() => startEventPolling(10000)).not.toThrow();
      stopEventPolling();
    });

    it('should be idempotent (calling twice does not create duplicate intervals)', () => {
      startEventPolling(10000);
      startEventPolling(10000); // Second call should be no-op
      stopEventPolling();
    });
  });

  describe('stopEventPolling', () => {
    it('should stop polling without error', () => {
      startEventPolling(10000);
      expect(() => stopEventPolling()).not.toThrow();
    });

    it('should be idempotent (safe to call multiple times)', () => {
      expect(() => stopEventPolling()).not.toThrow();
      expect(() => stopEventPolling()).not.toThrow();
    });
  });

  // ============================================================================
  // pushEventToQueue
  // ============================================================================

  describe('pushEventToQueue', () => {
    it('should push event to Redis queue', async () => {
      mockRedis.rpush.mockResolvedValue(1);

      const event: CollaborationEvent = {
        type: 'operation',
        sessionId: 'session-1',
        userId: 'user-1',
        payload: {},
        timestamp: Date.now(),
        serverId: 'server-test',
      };

      const result = await pushEventToQueue(event);
      expect(result).toBe(true);
      expect(mockRedis.rpush).toHaveBeenCalledWith('collab:event_queue', JSON.stringify(event));
    });

    it('should return false on Redis error', async () => {
      mockRedis.rpush.mockRejectedValue(new Error('Redis error'));

      const event: CollaborationEvent = {
        type: 'cursor',
        sessionId: 'session-1',
        userId: 'user-1',
        payload: {},
        timestamp: Date.now(),
        serverId: 'server-test',
      };

      const result = await pushEventToQueue(event);
      expect(result).toBe(false);
    });
  });

  // ============================================================================
  // bufferOperation
  // ============================================================================

  describe('bufferOperation', () => {
    const mockOp: CRDTOperation = {
      id: 'op-1',
      type: 'insert',
      position: 0,
      content: 'Hello',
      userId: 'user-1',
      timestamp: 1,
      vectorClock: { 'user-1': 1 },
    };

    it('should buffer operation in Redis', async () => {
      mockRedis.rpush.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      const result = await bufferOperation('session-1', 'user-1', mockOp);
      expect(result).toBe(true);
      expect(mockRedis.rpush).toHaveBeenCalledWith(
        'collab:ops:session-1:user-1',
        JSON.stringify(mockOp)
      );
      expect(mockRedis.expire).toHaveBeenCalledWith('collab:ops:session-1:user-1', 3600);
    });

    it('should return false on Redis error', async () => {
      mockRedis.rpush.mockRejectedValue(new Error('Redis error'));

      const result = await bufferOperation('session-1', 'user-1', mockOp);
      expect(result).toBe(false);
    });

    it('should set TTL of 1 hour on buffer key', async () => {
      mockRedis.rpush.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      await bufferOperation('session-1', 'user-1', mockOp);
      expect(mockRedis.expire).toHaveBeenCalledWith(expect.stringContaining('collab:ops:'), 3600);
    });
  });

  // ============================================================================
  // getBufferedOperations
  // ============================================================================

  describe('getBufferedOperations', () => {
    it('should return buffered operations from Redis', async () => {
      const op1 = JSON.stringify({
        id: 'op-1',
        type: 'insert',
        position: 0,
        content: 'a',
        userId: 'user-1',
        timestamp: 1,
        vectorClock: { 'user-1': 1 },
      });
      const op2 = JSON.stringify({
        id: 'op-2',
        type: 'insert',
        position: 1,
        content: 'b',
        userId: 'user-1',
        timestamp: 2,
        vectorClock: { 'user-1': 2 },
      });

      mockRedis.lrange.mockResolvedValue([op1, op2]);

      const result = await getBufferedOperations('session-1', 'user-1');
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('op-1');
      expect(result[1].id).toBe('op-2');
    });

    it('should return empty array on Redis error', async () => {
      mockRedis.lrange.mockRejectedValue(new Error('Redis error'));

      const result = await getBufferedOperations('session-1', 'user-1');
      expect(result).toEqual([]);
    });

    it('should query correct Redis key', async () => {
      mockRedis.lrange.mockResolvedValue([]);

      await getBufferedOperations('session-1', 'user-1');
      expect(mockRedis.lrange).toHaveBeenCalledWith('collab:ops:session-1:user-1', 0, -1);
    });
  });

  // ============================================================================
  // clearBufferedOperations
  // ============================================================================

  describe('clearBufferedOperations', () => {
    it('should clear buffered operations via cacheDelete', async () => {
      mockCacheDelete.mockResolvedValue(true);

      const result = await clearBufferedOperations('session-1', 'user-1');
      expect(result).toBe(true);
      expect(mockCacheDelete).toHaveBeenCalledWith('collab:ops:session-1:user-1');
    });
  });

  // ============================================================================
  // checkRedisHealth
  // ============================================================================

  describe('checkRedisHealth', () => {
    it('should return available=true and latency when Redis is healthy', async () => {
      mockRedis.ping.mockResolvedValue('PONG');

      const health = await checkRedisHealth();
      expect(health.available).toBe(true);
      expect(health.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should return available=false when Redis ping fails', async () => {
      mockRedis.ping.mockRejectedValue(new Error('Connection failed'));

      const health = await checkRedisHealth();
      expect(health.available).toBe(false);
      expect(health.latencyMs).toBe(-1);
    });
  });
});
