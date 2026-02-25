import { describe, it, expect, vi } from 'vitest';

// ============================================================================
// Mocks — MUST come before imports of the module under test
// ============================================================================

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

vi.mock('@/lib/redis/client', () => ({
  redis: null,
  cacheGet: vi.fn(),
  cacheSet: vi.fn(),
  cacheDelete: vi.fn(),
  isRedisAvailable: vi.fn().mockReturnValue(false),
}));

vi.mock('@/lib/realtime', () => ({
  useWebSocket: vi.fn().mockReturnValue({
    send: vi.fn(),
    on: vi.fn().mockReturnValue(vi.fn()),
    isConnected: false,
    connectionState: 'disconnected',
    clientId: null,
    sessionId: null,
    members: [],
    connect: vi.fn(),
    disconnect: vi.fn(),
    joinSession: vi.fn(),
    leaveSession: vi.fn(),
    updatePresence: vi.fn(),
    presenceList: [],
  }),
}));

import * as CollaborationModule from './index';

// ============================================================================
// Tests
// ============================================================================

describe('collaboration index (barrel exports)', () => {
  // ============================================================================
  // crdt-document exports
  // ============================================================================

  describe('crdt-document exports', () => {
    it('should export CRDTDocument class', () => {
      expect(CollaborationModule.CRDTDocument).toBeDefined();
      expect(typeof CollaborationModule.CRDTDocument).toBe('function');
    });

    it('should export DocumentStore class', () => {
      expect(CollaborationModule.DocumentStore).toBeDefined();
      expect(typeof CollaborationModule.DocumentStore).toBe('function');
    });

    it('should export getDocumentStore function', () => {
      expect(CollaborationModule.getDocumentStore).toBeDefined();
      expect(typeof CollaborationModule.getDocumentStore).toBe('function');
    });

    it('should allow creating CRDTDocument instances', () => {
      const doc = new CollaborationModule.CRDTDocument('doc-1', 'user-1', 'content');
      expect(doc.getContent()).toBe('content');
    });

    it('should allow creating DocumentStore instances', () => {
      const store = new CollaborationModule.DocumentStore();
      expect(store.hasDocument('test')).toBe(false);
    });
  });

  // ============================================================================
  // collaboration-manager exports
  // ============================================================================

  describe('collaboration-manager exports', () => {
    it('should export CollaborationManager class', () => {
      expect(CollaborationModule.CollaborationManager).toBeDefined();
      expect(typeof CollaborationModule.CollaborationManager).toBe('function');
    });

    it('should export getCollaborationManager function', () => {
      expect(CollaborationModule.getCollaborationManager).toBeDefined();
      expect(typeof CollaborationModule.getCollaborationManager).toBe('function');
    });

    it('should allow creating CollaborationManager instances', () => {
      const mgr = new CollaborationModule.CollaborationManager();
      expect(mgr).toBeInstanceOf(CollaborationModule.CollaborationManager);
      mgr.cleanup();
    });
  });

  // ============================================================================
  // useCollaboration exports
  // ============================================================================

  describe('useCollaboration exports', () => {
    it('should export useCollaboration hook', () => {
      expect(CollaborationModule.useCollaboration).toBeDefined();
      expect(typeof CollaborationModule.useCollaboration).toBe('function');
    });
  });

  // ============================================================================
  // redis-persistence exports
  // ============================================================================

  describe('redis-persistence exports', () => {
    it('should export checkRedisHealth function', () => {
      expect(CollaborationModule.checkRedisHealth).toBeDefined();
      expect(typeof CollaborationModule.checkRedisHealth).toBe('function');
    });

    it('should export isRedisAvailable function', () => {
      expect(CollaborationModule.isRedisAvailable).toBeDefined();
      expect(typeof CollaborationModule.isRedisAvailable).toBe('function');
    });

    it('should export startEventPolling function', () => {
      expect(CollaborationModule.startEventPolling).toBeDefined();
      expect(typeof CollaborationModule.startEventPolling).toBe('function');
    });

    it('should export stopEventPolling function', () => {
      expect(CollaborationModule.stopEventPolling).toBeDefined();
      expect(typeof CollaborationModule.stopEventPolling).toBe('function');
    });
  });

  // ============================================================================
  // Module completeness check
  // ============================================================================

  describe('module completeness', () => {
    it('should export all expected symbols', () => {
      const expectedExports = [
        'CRDTDocument',
        'DocumentStore',
        'getDocumentStore',
        'CollaborationManager',
        'getCollaborationManager',
        'useCollaboration',
        'checkRedisHealth',
        'isRedisAvailable',
        'startEventPolling',
        'stopEventPolling',
      ];

      for (const name of expectedExports) {
        expect(
          (CollaborationModule as Record<string, unknown>)[name],
          `Expected export "${name}" to be defined`
        ).toBeDefined();
      }
    });
  });
});
