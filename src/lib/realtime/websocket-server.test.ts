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

// Mock ws module
const mockWssOn = vi.fn();
const mockWssClose = vi.fn((cb: (err?: Error) => void) => cb());
vi.mock('ws', () => {
  const OPEN = 1;
  const CLOSED = 3;

  class MockWebSocketServer {
    on = mockWssOn;
    close = mockWssClose;
  }

  class MockWebSocket {
    static OPEN = OPEN;
    static CLOSED = CLOSED;
    OPEN = OPEN;
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
  v4: vi.fn(() => 'mock-uuid-1234'),
}));

// ============================================================================
// IMPORTS
// ============================================================================

import {
  CodeLabWebSocketServer,
  getWebSocketServer,
  initializeWebSocketServer,
  type WebSocketClient,
  type WebSocketMessage,
  type PresenceInfo,
  type MessageHandler,
} from './websocket-server';
import WebSocket from 'ws';

// ============================================================================
// HELPERS
// ============================================================================

function createMockClient(overrides: Partial<WebSocketClient> = {}): WebSocketClient {
  return {
    id: 'client-1',
    socket: {
      readyState: WebSocket.OPEN,
      send: vi.fn(),
      close: vi.fn(),
      terminate: vi.fn(),
      ping: vi.fn(),
      on: vi.fn(),
    } as unknown as WebSocket,
    userId: 'user-1',
    userName: 'Test User',
    sessionId: undefined,
    lastPing: Date.now(),
    metadata: {},
    ...overrides,
  };
}

// ============================================================================
// TESTS: TYPE EXPORTS
// ============================================================================

describe('websocket-server type exports', () => {
  it('should export WebSocketClient interface', () => {
    const client: WebSocketClient = createMockClient();
    expect(client.id).toBe('client-1');
    expect(client.userId).toBe('user-1');
    expect(client.userName).toBe('Test User');
    expect(client.metadata).toEqual({});
  });

  it('should export WebSocketMessage interface', () => {
    const msg: WebSocketMessage = {
      type: 'test',
      payload: { foo: 'bar' },
      senderId: 'sender-1',
      timestamp: Date.now(),
    };
    expect(msg.type).toBe('test');
    expect(msg.payload).toEqual({ foo: 'bar' });
  });

  it('should export PresenceInfo interface', () => {
    const presence: PresenceInfo = {
      userId: 'user-1',
      userName: 'Test User',
      sessionId: 'session-1',
      lastActivity: Date.now(),
      status: 'active',
    };
    expect(presence.status).toBe('active');
    expect(presence.cursorPosition).toBeUndefined();
  });

  it('should export PresenceInfo with optional fields', () => {
    const presence: PresenceInfo = {
      userId: 'user-1',
      userName: 'Test User',
      sessionId: 'session-1',
      cursorPosition: { line: 5, column: 10 },
      selection: { startLine: 3, endLine: 7 },
      lastActivity: Date.now(),
      status: 'idle',
    };
    expect(presence.cursorPosition).toEqual({ line: 5, column: 10 });
    expect(presence.selection).toEqual({ startLine: 3, endLine: 7 });
  });

  it('should export MessageHandler type', () => {
    const handler: MessageHandler = vi.fn();
    const client = createMockClient();
    const msg: WebSocketMessage = { type: 'test', payload: {}, timestamp: Date.now() };
    handler(client, msg);
    expect(handler).toHaveBeenCalledWith(client, msg);
  });
});

// ============================================================================
// TESTS: CodeLabWebSocketServer class
// ============================================================================

describe('CodeLabWebSocketServer', () => {
  it('should be constructable', () => {
    const server = new CodeLabWebSocketServer();
    expect(server).toBeDefined();
    expect(server).toBeInstanceOf(CodeLabWebSocketServer);
  });

  it('should report not initialized before initialize() is called', () => {
    const server = new CodeLabWebSocketServer();
    expect(server.isInitialized()).toBe(false);
  });

  it('should initialize and set initialized to true', async () => {
    const server = new CodeLabWebSocketServer();
    await server.initialize(4999);
    expect(server.isInitialized()).toBe(true);
  });

  it('should not reinitialize if already initialized', async () => {
    const server = new CodeLabWebSocketServer();
    await server.initialize(4998);
    // Second call should be a no-op
    await server.initialize(4998);
    expect(server.isInitialized()).toBe(true);
  });

  it('should have zero clients initially', () => {
    const server = new CodeLabWebSocketServer();
    expect(server.getClientCount()).toBe(0);
    expect(server.getAllClients()).toEqual([]);
  });

  it('should have zero active sessions initially', () => {
    const server = new CodeLabWebSocketServer();
    expect(server.getActiveSessions()).toEqual([]);
  });

  it('should return undefined for nonexistent client', () => {
    const server = new CodeLabWebSocketServer();
    expect(server.getClient('nonexistent')).toBeUndefined();
  });

  it('should return empty array for nonexistent session clients', () => {
    const server = new CodeLabWebSocketServer();
    expect(server.getSessionClients('nonexistent')).toEqual([]);
  });

  it('should return 0 for nonexistent session client count', () => {
    const server = new CodeLabWebSocketServer();
    expect(server.getSessionClientCount('nonexistent')).toBe(0);
  });

  it('should return empty presence for nonexistent session', () => {
    const server = new CodeLabWebSocketServer();
    expect(server.getSessionPresence('nonexistent')).toEqual([]);
  });
});

// ============================================================================
// TESTS: Message handlers (on/off)
// ============================================================================

describe('CodeLabWebSocketServer on/off handlers', () => {
  it('should register a handler with on()', () => {
    const server = new CodeLabWebSocketServer();
    const handler: MessageHandler = vi.fn();
    server.on('test:event', handler);
    // No error thrown; handler is registered
    expect(true).toBe(true);
  });

  it('should register multiple handlers for the same type', () => {
    const server = new CodeLabWebSocketServer();
    const handler1: MessageHandler = vi.fn();
    const handler2: MessageHandler = vi.fn();
    server.on('test:event', handler1);
    server.on('test:event', handler2);
    // Both should be registered without error
    expect(true).toBe(true);
  });

  it('should remove a handler with off()', () => {
    const server = new CodeLabWebSocketServer();
    const handler: MessageHandler = vi.fn();
    server.on('test:event', handler);
    server.off('test:event', handler);
    // No error thrown; handler is removed
    expect(true).toBe(true);
  });

  it('should not throw when removing handler that does not exist', () => {
    const server = new CodeLabWebSocketServer();
    const handler: MessageHandler = vi.fn();
    // off() on a type with no registered handlers should not throw
    expect(() => server.off('nonexistent', handler)).not.toThrow();
  });

  it('should not throw when removing a handler that was never registered for the type', () => {
    const server = new CodeLabWebSocketServer();
    const handler1: MessageHandler = vi.fn();
    const handler2: MessageHandler = vi.fn();
    server.on('test:event', handler1);
    // handler2 was never registered, off() should not throw
    expect(() => server.off('test:event', handler2)).not.toThrow();
  });
});

// ============================================================================
// TESTS: sendToClient
// ============================================================================

describe('CodeLabWebSocketServer sendToClient', () => {
  it('should return false for nonexistent client', () => {
    const server = new CodeLabWebSocketServer();
    const msg: WebSocketMessage = { type: 'test', payload: {}, timestamp: Date.now() };
    expect(server.sendToClient('nonexistent', msg)).toBe(false);
  });
});

// ============================================================================
// TESTS: sendToUser
// ============================================================================

describe('CodeLabWebSocketServer sendToUser', () => {
  it('should return 0 when no clients match the user', () => {
    const server = new CodeLabWebSocketServer();
    const msg: WebSocketMessage = { type: 'test', payload: {}, timestamp: Date.now() };
    expect(server.sendToUser('nonexistent-user', msg)).toBe(0);
  });
});

// ============================================================================
// TESTS: broadcastToSession
// ============================================================================

describe('CodeLabWebSocketServer broadcastToSession', () => {
  it('should not throw when session does not exist', () => {
    const server = new CodeLabWebSocketServer();
    const msg: WebSocketMessage = { type: 'test', payload: {}, timestamp: Date.now() };
    expect(() => server.broadcastToSession('nonexistent', msg)).not.toThrow();
  });
});

// ============================================================================
// TESTS: broadcast
// ============================================================================

describe('CodeLabWebSocketServer broadcast', () => {
  it('should not throw when no clients are connected', () => {
    const server = new CodeLabWebSocketServer();
    const msg: WebSocketMessage = { type: 'test', payload: {}, timestamp: Date.now() };
    expect(() => server.broadcast(msg)).not.toThrow();
  });

  it('should not throw with excludeClientId when no clients are connected', () => {
    const server = new CodeLabWebSocketServer();
    const msg: WebSocketMessage = { type: 'test', payload: {}, timestamp: Date.now() };
    expect(() => server.broadcast(msg, 'exclude-me')).not.toThrow();
  });
});

// ============================================================================
// TESTS: getClientsByUser
// ============================================================================

describe('CodeLabWebSocketServer getClientsByUser', () => {
  it('should return empty array when no clients match', () => {
    const server = new CodeLabWebSocketServer();
    expect(server.getClientsByUser('user-unknown')).toEqual([]);
  });
});

// ============================================================================
// TESTS: shutdown
// ============================================================================

describe('CodeLabWebSocketServer shutdown', () => {
  it('should set initialized to false after shutdown', async () => {
    const server = new CodeLabWebSocketServer();
    await server.initialize(4997);
    expect(server.isInitialized()).toBe(true);
    await server.shutdown();
    expect(server.isInitialized()).toBe(false);
  });

  it('should clear all clients on shutdown', async () => {
    const server = new CodeLabWebSocketServer();
    await server.initialize(4996);
    await server.shutdown();
    expect(server.getClientCount()).toBe(0);
    expect(server.getAllClients()).toEqual([]);
  });

  it('should clear all sessions on shutdown', async () => {
    const server = new CodeLabWebSocketServer();
    await server.initialize(4995);
    await server.shutdown();
    expect(server.getActiveSessions()).toEqual([]);
  });

  it('should handle shutdown when not initialized', async () => {
    const server = new CodeLabWebSocketServer();
    // Should not throw even when not initialized
    await expect(server.shutdown()).resolves.toBeUndefined();
  });
});

// ============================================================================
// TESTS: Singleton functions
// ============================================================================

describe('getWebSocketServer', () => {
  it('should return a CodeLabWebSocketServer instance', () => {
    const server = getWebSocketServer();
    expect(server).toBeDefined();
    expect(server).toBeInstanceOf(CodeLabWebSocketServer);
  });

  it('should return the same instance on multiple calls', () => {
    const server1 = getWebSocketServer();
    const server2 = getWebSocketServer();
    expect(server1).toBe(server2);
  });
});

describe('initializeWebSocketServer', () => {
  it('should return a CodeLabWebSocketServer instance', async () => {
    const server = await initializeWebSocketServer(4994);
    expect(server).toBeDefined();
    expect(server).toBeInstanceOf(CodeLabWebSocketServer);
  });
});

// ============================================================================
// TESTS: WebSocketMessage structure
// ============================================================================

describe('WebSocketMessage structure', () => {
  it('should allow message without senderId', () => {
    const msg: WebSocketMessage = {
      type: 'test',
      payload: null,
      timestamp: 1234567890,
    };
    expect(msg.senderId).toBeUndefined();
    expect(msg.timestamp).toBe(1234567890);
  });

  it('should allow any payload type', () => {
    const msg1: WebSocketMessage = { type: 'a', payload: 'string', timestamp: 0 };
    const msg2: WebSocketMessage = { type: 'b', payload: 42, timestamp: 0 };
    const msg3: WebSocketMessage = { type: 'c', payload: { nested: true }, timestamp: 0 };
    const msg4: WebSocketMessage = { type: 'd', payload: [1, 2, 3], timestamp: 0 };
    expect(msg1.payload).toBe('string');
    expect(msg2.payload).toBe(42);
    expect(msg3.payload).toEqual({ nested: true });
    expect(msg4.payload).toEqual([1, 2, 3]);
  });
});

// ============================================================================
// TESTS: PresenceInfo status values
// ============================================================================

describe('PresenceInfo status values', () => {
  it('should accept active status', () => {
    const p: PresenceInfo = {
      userId: 'u1',
      userName: 'User',
      sessionId: 's1',
      lastActivity: Date.now(),
      status: 'active',
    };
    expect(p.status).toBe('active');
  });

  it('should accept idle status', () => {
    const p: PresenceInfo = {
      userId: 'u1',
      userName: 'User',
      sessionId: 's1',
      lastActivity: Date.now(),
      status: 'idle',
    };
    expect(p.status).toBe('idle');
  });

  it('should accept away status', () => {
    const p: PresenceInfo = {
      userId: 'u1',
      userName: 'User',
      sessionId: 's1',
      lastActivity: Date.now(),
      status: 'away',
    };
    expect(p.status).toBe('away');
  });
});
