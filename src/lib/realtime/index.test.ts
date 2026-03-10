import { describe, it, expect, vi } from 'vitest';

// ============================================================================
// MOCKS — must appear before imports of the module under test
// ============================================================================

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock ws module (needed by websocket-server which is imported for types)
vi.mock('ws', () => {
  const OPEN = 1;

  class MockWebSocketServer {
    on = vi.fn();
    close = vi.fn();
  }

  class MockWebSocket {
    static OPEN = OPEN;
    readyState = OPEN;
    send = vi.fn();
    close = vi.fn();
    terminate = vi.fn();
    ping = vi.fn();
    on = vi.fn();
  }

  return {
    default: MockWebSocket,
    WebSocket: MockWebSocket,
    WebSocketServer: MockWebSocketServer,
  };
});

vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mock-uuid'),
}));

// Mock React hooks for useWebSocket
vi.mock('react', () => ({
  useState: (init: unknown) => [init, vi.fn()],
  useEffect: vi.fn(),
  useCallback: (fn: (...args: unknown[]) => unknown) => fn,
  useRef: (init: unknown) => ({ current: init }),
}));

// ============================================================================
// IMPORTS
// ============================================================================

import {
  useWebSocket,
  usePresence,
  type UseWebSocketOptions,
  type UseWebSocketReturn,
  type ConnectionState,
  type SessionMember,
  type WebSocketClient,
  type WebSocketMessage,
  type PresenceInfo,
  type MessageHandler,
  type PresenceData,
  type SessionPresence,
} from './index';

// ============================================================================
// TESTS: Client-safe function exports
// ============================================================================

describe('realtime index client-safe exports', () => {
  it('should export useWebSocket hook', () => {
    expect(useWebSocket).toBeDefined();
    expect(typeof useWebSocket).toBe('function');
  });

  it('should export usePresence hook', () => {
    expect(usePresence).toBeDefined();
    expect(typeof usePresence).toBe('function');
  });

  it('should make useWebSocket callable with options', () => {
    const result = useWebSocket({ token: 'test' });
    expect(result).toBeDefined();
    expect(result).toHaveProperty('connectionState');
    expect(result).toHaveProperty('isConnected');
    expect(result).toHaveProperty('connect');
  });

  it('should make usePresence callable with token and sessionId', () => {
    const result = usePresence('token', 'session');
    expect(result).toBeDefined();
    expect(result).toHaveProperty('members');
    expect(result).toHaveProperty('presenceList');
    expect(result).toHaveProperty('updateCursor');
  });
});

// ============================================================================
// TESTS: Type exports from useWebSocket
// ============================================================================

describe('realtime index type exports from useWebSocket', () => {
  it('should export UseWebSocketOptions type', () => {
    const opts: UseWebSocketOptions = {
      token: 'test',
    };
    expect(opts.token).toBe('test');
  });

  it('should export UseWebSocketReturn type', () => {
    const ret: UseWebSocketReturn = {
      connectionState: 'disconnected',
      isConnected: false,
      clientId: null,
      sessionId: null,
      members: [],
      connect: vi.fn(),
      disconnect: vi.fn(),
      send: vi.fn(),
      joinSession: vi.fn(),
      leaveSession: vi.fn(),
      updatePresence: vi.fn(),
      presenceList: [],
      on: vi.fn(),
    };
    expect(ret.connectionState).toBe('disconnected');
  });

  it('should export ConnectionState type', () => {
    const states: ConnectionState[] = ['connecting', 'connected', 'disconnected', 'error'];
    expect(states).toHaveLength(4);
  });

  it('should export SessionMember type', () => {
    const member: SessionMember = {
      userId: 'u1',
      userName: 'User',
      clientId: 'c1',
    };
    expect(member.userId).toBe('u1');
  });
});

// ============================================================================
// TESTS: Type exports from websocket-server
// ============================================================================

describe('realtime index type exports from websocket-server', () => {
  it('should export WebSocketClient type', () => {
    const client: WebSocketClient = {
      id: 'client-1',
      socket: {} as WebSocketClient['socket'],
      userId: 'user-1',
      userName: 'Test',
      lastPing: Date.now(),
      metadata: {},
    };
    expect(client.id).toBe('client-1');
  });

  it('should export WebSocketMessage type', () => {
    const msg: WebSocketMessage = {
      type: 'test',
      payload: {},
      timestamp: Date.now(),
    };
    expect(msg.type).toBe('test');
  });

  it('should export PresenceInfo type', () => {
    const presence: PresenceInfo = {
      userId: 'user-1',
      userName: 'Test',
      sessionId: 'session-1',
      lastActivity: Date.now(),
      status: 'active',
    };
    expect(presence.status).toBe('active');
  });

  it('should export MessageHandler type', () => {
    const handler: MessageHandler = vi.fn();
    expect(typeof handler).toBe('function');
  });
});

// ============================================================================
// TESTS: Type exports from presence-service
// ============================================================================

describe('realtime index type exports from presence-service', () => {
  it('should export PresenceData type', () => {
    const data: PresenceData = {
      userId: 'user-1',
      userName: 'Test',
      clientId: 'client-1',
      status: 'active',
    };
    expect(data.userId).toBe('user-1');
    expect(data.status).toBe('active');
  });

  it('should export PresenceData with all optional fields', () => {
    const data: PresenceData = {
      userId: 'user-1',
      userName: 'Test',
      clientId: 'client-1',
      status: 'idle',
      userEmail: 'test@test.com',
      color: '#aabbcc',
      cursorLine: 1,
      cursorColumn: 2,
      cursorPosition: 3,
      selectionStartLine: 4,
      selectionEndLine: 5,
      selectionStart: 6,
      selectionEnd: 7,
      isTyping: false,
      lastActivity: new Date(),
    };
    expect(data.userEmail).toBe('test@test.com');
    expect(data.cursorLine).toBe(1);
  });

  it('should export SessionPresence type', () => {
    const sp: SessionPresence = {
      sessionId: 'session-1',
      users: [],
    };
    expect(sp.sessionId).toBe('session-1');
    expect(sp.users).toEqual([]);
  });

  it('should export SessionPresence with users', () => {
    const sp: SessionPresence = {
      sessionId: 'session-1',
      users: [
        {
          userId: 'u1',
          userName: 'User 1',
          clientId: 'c1',
          status: 'active',
        },
        {
          userId: 'u2',
          userName: 'User 2',
          clientId: 'c2',
          status: 'away',
        },
      ],
    };
    expect(sp.users).toHaveLength(2);
    expect(sp.users[0].userId).toBe('u1');
    expect(sp.users[1].status).toBe('away');
  });
});

// ============================================================================
// TESTS: Module structure verification
// ============================================================================

describe('realtime index module structure', () => {
  it('should export at least useWebSocket and usePresence functions', () => {
    // These are the two client-safe function exports from the barrel
    expect(typeof useWebSocket).toBe('function');
    expect(typeof usePresence).toBe('function');
  });

  it('should not export server-only modules directly', async () => {
    // The index file notes: "For server-only modules, import directly"
    // So getWebSocketServer and getPresenceService should NOT be exported from index
    const indexModule = await import('./index');
    expect((indexModule as Record<string, unknown>).getWebSocketServer).toBeUndefined();
    expect((indexModule as Record<string, unknown>).getPresenceService).toBeUndefined();
    expect((indexModule as Record<string, unknown>).initializeWebSocketServer).toBeUndefined();
    expect((indexModule as Record<string, unknown>).initializePresenceService).toBeUndefined();
  });

  it('should not export CodeLabWebSocketServer class directly', async () => {
    const indexModule = await import('./index');
    expect((indexModule as Record<string, unknown>).CodeLabWebSocketServer).toBeUndefined();
  });
});
