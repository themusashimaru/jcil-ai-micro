import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// MOCKS — must appear before imports of the module under test
// ============================================================================

// Mock React hooks since this is a 'use client' hook file
const mockSetState = vi.fn();
const mockUseRef = vi.fn();
const mockUseEffect = vi.fn();
const mockUseCallback = vi.fn();

vi.mock('react', () => ({
  useState: (init: unknown) => [init, mockSetState],
  useEffect: (fn: () => void | (() => void)) => mockUseEffect(fn),
  useCallback: (fn: (...args: unknown[]) => unknown) => {
    mockUseCallback(fn);
    return fn;
  },
  useRef: (init: unknown) => {
    const ref = { current: init };
    mockUseRef(ref);
    return ref;
  },
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
  type WebSocketMessage,
  type PresenceInfo,
} from './useWebSocket';

// ============================================================================
// SETUP
// ============================================================================

beforeEach(() => {
  vi.clearAllMocks();
});

// ============================================================================
// TESTS: TYPE EXPORTS
// ============================================================================

describe('useWebSocket type exports', () => {
  it('should export ConnectionState type with connecting value', () => {
    const state: ConnectionState = 'connecting';
    expect(state).toBe('connecting');
  });

  it('should export ConnectionState type with connected value', () => {
    const state: ConnectionState = 'connected';
    expect(state).toBe('connected');
  });

  it('should export ConnectionState type with disconnected value', () => {
    const state: ConnectionState = 'disconnected';
    expect(state).toBe('disconnected');
  });

  it('should export ConnectionState type with error value', () => {
    const state: ConnectionState = 'error';
    expect(state).toBe('error');
  });

  it('should export SessionMember interface', () => {
    const member: SessionMember = {
      userId: 'user-1',
      userName: 'Test',
      clientId: 'client-1',
    };
    expect(member.userId).toBe('user-1');
    expect(member.userName).toBe('Test');
    expect(member.clientId).toBe('client-1');
  });

  it('should export WebSocketMessage interface', () => {
    const msg: WebSocketMessage = {
      type: 'test:message',
      payload: { data: 42 },
      senderId: 'sender-1',
      timestamp: Date.now(),
    };
    expect(msg.type).toBe('test:message');
    expect(msg.payload).toEqual({ data: 42 });
  });

  it('should export WebSocketMessage without optional senderId', () => {
    const msg: WebSocketMessage = {
      type: 'test',
      payload: null,
      timestamp: 1000,
    };
    expect(msg.senderId).toBeUndefined();
  });

  it('should export PresenceInfo interface with required fields', () => {
    const presence: PresenceInfo = {
      userId: 'user-1',
      userName: 'Test User',
      sessionId: 'session-1',
      lastActivity: Date.now(),
      status: 'active',
    };
    expect(presence.userId).toBe('user-1');
    expect(presence.status).toBe('active');
  });

  it('should export PresenceInfo interface with optional fields', () => {
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

  it('should export UseWebSocketOptions interface', () => {
    const opts: UseWebSocketOptions = {
      token: 'my-token',
      url: 'ws://localhost:9999',
      sessionId: 'session-1',
      autoConnect: false,
      reconnect: true,
      maxReconnectAttempts: 3,
      onMessage: vi.fn(),
      onConnect: vi.fn(),
      onDisconnect: vi.fn(),
      onError: vi.fn(),
    };
    expect(opts.token).toBe('my-token');
    expect(opts.url).toBe('ws://localhost:9999');
    expect(opts.autoConnect).toBe(false);
    expect(opts.maxReconnectAttempts).toBe(3);
  });

  it('should export UseWebSocketOptions with only required fields', () => {
    const opts: UseWebSocketOptions = {
      token: 'my-token',
    };
    expect(opts.token).toBe('my-token');
    expect(opts.url).toBeUndefined();
    expect(opts.sessionId).toBeUndefined();
    expect(opts.autoConnect).toBeUndefined();
  });
});

// ============================================================================
// TESTS: UseWebSocketReturn interface
// ============================================================================

describe('UseWebSocketReturn interface', () => {
  it('should define all expected return properties', () => {
    const returnVal: UseWebSocketReturn = {
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
    expect(returnVal.connectionState).toBe('disconnected');
    expect(returnVal.isConnected).toBe(false);
    expect(returnVal.clientId).toBeNull();
    expect(returnVal.sessionId).toBeNull();
    expect(returnVal.members).toEqual([]);
    expect(returnVal.presenceList).toEqual([]);
    expect(typeof returnVal.connect).toBe('function');
    expect(typeof returnVal.disconnect).toBe('function');
    expect(typeof returnVal.send).toBe('function');
    expect(typeof returnVal.joinSession).toBe('function');
    expect(typeof returnVal.leaveSession).toBe('function');
    expect(typeof returnVal.updatePresence).toBe('function');
    expect(typeof returnVal.on).toBe('function');
  });
});

// ============================================================================
// TESTS: useWebSocket hook behavior
// ============================================================================

describe('useWebSocket hook', () => {
  it('should return an object with the expected shape', () => {
    const result = useWebSocket({ token: 'test-token' });
    expect(result).toHaveProperty('connectionState');
    expect(result).toHaveProperty('isConnected');
    expect(result).toHaveProperty('clientId');
    expect(result).toHaveProperty('sessionId');
    expect(result).toHaveProperty('members');
    expect(result).toHaveProperty('connect');
    expect(result).toHaveProperty('disconnect');
    expect(result).toHaveProperty('send');
    expect(result).toHaveProperty('joinSession');
    expect(result).toHaveProperty('leaveSession');
    expect(result).toHaveProperty('updatePresence');
    expect(result).toHaveProperty('presenceList');
    expect(result).toHaveProperty('on');
  });

  it('should default connectionState to disconnected', () => {
    const result = useWebSocket({ token: 'test-token' });
    expect(result.connectionState).toBe('disconnected');
  });

  it('should default isConnected to false', () => {
    const result = useWebSocket({ token: 'test-token' });
    expect(result.isConnected).toBe(false);
  });

  it('should default clientId to null', () => {
    const result = useWebSocket({ token: 'test-token' });
    expect(result.clientId).toBeNull();
  });

  it('should set initial sessionId from options', () => {
    const result = useWebSocket({ token: 'test-token', sessionId: 'my-session' });
    expect(result.sessionId).toBe('my-session');
  });

  it('should default sessionId to null when not provided', () => {
    const result = useWebSocket({ token: 'test-token' });
    expect(result.sessionId).toBeNull();
  });

  it('should default members to empty array', () => {
    const result = useWebSocket({ token: 'test-token' });
    expect(result.members).toEqual([]);
  });

  it('should default presenceList to empty array', () => {
    const result = useWebSocket({ token: 'test-token' });
    expect(result.presenceList).toEqual([]);
  });

  it('should call useEffect for auto-connect lifecycle', () => {
    useWebSocket({ token: 'test-token', autoConnect: true });
    expect(mockUseEffect).toHaveBeenCalled();
  });

  it('should call useCallback for connect, disconnect, send, etc.', () => {
    useWebSocket({ token: 'test-token' });
    // useCallback is called multiple times for the various callbacks
    expect(mockUseCallback.mock.calls.length).toBeGreaterThanOrEqual(5);
  });

  it('should provide send as a function', () => {
    const result = useWebSocket({ token: 'test-token' });
    expect(typeof result.send).toBe('function');
  });

  it('should provide joinSession as a function', () => {
    const result = useWebSocket({ token: 'test-token' });
    expect(typeof result.joinSession).toBe('function');
  });

  it('should provide leaveSession as a function', () => {
    const result = useWebSocket({ token: 'test-token' });
    expect(typeof result.leaveSession).toBe('function');
  });

  it('should provide updatePresence as a function', () => {
    const result = useWebSocket({ token: 'test-token' });
    expect(typeof result.updatePresence).toBe('function');
  });

  it('should provide on as a function that returns unsubscribe', () => {
    const result = useWebSocket({ token: 'test-token' });
    const handler = vi.fn();
    const unsubscribe = result.on('test', handler);
    expect(typeof unsubscribe).toBe('function');
  });

  it('should allow registering and unregistering message handlers', () => {
    const result = useWebSocket({ token: 'test-token' });
    const handler = vi.fn();
    const unsub = result.on('custom:event', handler);
    // Calling unsubscribe should not throw
    expect(() => unsub()).not.toThrow();
  });
});

// ============================================================================
// TESTS: usePresence hook
// ============================================================================

describe('usePresence hook', () => {
  it('should return an object with the expected shape', () => {
    const result = usePresence('test-token', 'session-1');
    expect(result).toHaveProperty('members');
    expect(result).toHaveProperty('presenceList');
    expect(result).toHaveProperty('updateCursor');
    expect(result).toHaveProperty('updateSelection');
    expect(result).toHaveProperty('updateStatus');
  });

  it('should default members to empty array', () => {
    const result = usePresence('test-token', 'session-1');
    expect(result.members).toEqual([]);
  });

  it('should default presenceList to empty array', () => {
    const result = usePresence('test-token', 'session-1');
    expect(result.presenceList).toEqual([]);
  });

  it('should provide updateCursor as a function', () => {
    const result = usePresence('test-token', 'session-1');
    expect(typeof result.updateCursor).toBe('function');
  });

  it('should provide updateSelection as a function', () => {
    const result = usePresence('test-token', 'session-1');
    expect(typeof result.updateSelection).toBe('function');
  });

  it('should provide updateStatus as a function', () => {
    const result = usePresence('test-token', 'session-1');
    expect(typeof result.updateStatus).toBe('function');
  });

  it('should not throw when calling updateCursor', () => {
    const result = usePresence('test-token', 'session-1');
    // isConnected is false (initial state), so this should be a no-op
    expect(() => result.updateCursor(10, 5)).not.toThrow();
  });

  it('should not throw when calling updateSelection', () => {
    const result = usePresence('test-token', 'session-1');
    expect(() => result.updateSelection(1, 10)).not.toThrow();
  });

  it('should not throw when calling updateStatus', () => {
    const result = usePresence('test-token', 'session-1');
    expect(() => result.updateStatus('idle')).not.toThrow();
  });

  it('should accept all valid status values', () => {
    const result = usePresence('test-token', 'session-1');
    expect(() => result.updateStatus('active')).not.toThrow();
    expect(() => result.updateStatus('idle')).not.toThrow();
    expect(() => result.updateStatus('away')).not.toThrow();
  });
});

// ============================================================================
// TESTS: on() handler registration
// ============================================================================

describe('useWebSocket on() handler management', () => {
  it('should return a function from on()', () => {
    const result = useWebSocket({ token: 'test-token' });
    const unsub = result.on('event', vi.fn());
    expect(typeof unsub).toBe('function');
  });

  it('should allow registering multiple handlers for the same event type', () => {
    const result = useWebSocket({ token: 'test-token' });
    const unsub1 = result.on('event', vi.fn());
    const unsub2 = result.on('event', vi.fn());
    expect(typeof unsub1).toBe('function');
    expect(typeof unsub2).toBe('function');
  });

  it('should allow registering handlers for different event types', () => {
    const result = useWebSocket({ token: 'test-token' });
    const unsub1 = result.on('event-a', vi.fn());
    const unsub2 = result.on('event-b', vi.fn());
    expect(typeof unsub1).toBe('function');
    expect(typeof unsub2).toBe('function');
  });

  it('should allow registering wildcard handler', () => {
    const result = useWebSocket({ token: 'test-token' });
    const unsub = result.on('*', vi.fn());
    expect(typeof unsub).toBe('function');
  });

  it('should safely unsubscribe even if called multiple times', () => {
    const result = useWebSocket({ token: 'test-token' });
    const unsub = result.on('event', vi.fn());
    unsub();
    // Second call should not throw
    expect(() => unsub()).not.toThrow();
  });
});
