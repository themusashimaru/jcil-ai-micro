import { describe, it, expect, vi, beforeEach } from 'vitest';

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

const mockUntypedRpc = vi.fn();
vi.mock('@/lib/supabase/workspace-client', () => ({
  untypedRpc: (...args: unknown[]) => mockUntypedRpc(...args),
}));

const mockCreateServiceRoleClient = vi.fn(() => ({ from: vi.fn() }));
vi.mock('@/lib/supabase/service-role', () => ({
  createServiceRoleClient: () => mockCreateServiceRoleClient(),
}));

const mockWsOn = vi.fn();
const mockBroadcastToSession = vi.fn();
vi.mock('./websocket-server', () => ({
  getWebSocketServer: () => ({
    on: mockWsOn,
    broadcastToSession: mockBroadcastToSession,
  }),
}));

const mockCollabOn = vi.fn();
const mockCollabGetSession = vi.fn();
vi.mock('@/lib/collaboration/collaboration-manager', () => ({
  getCollaborationManager: () => ({
    on: mockCollabOn,
    getSession: mockCollabGetSession,
  }),
}));

// ============================================================================
// IMPORTS
// ============================================================================

import {
  getPresenceService,
  initializePresenceService,
  type PresenceData,
  type SessionPresence,
} from './presence-service';

// ============================================================================
// SETUP
// ============================================================================

beforeEach(() => {
  vi.clearAllMocks();
  mockUntypedRpc.mockReset();
  mockCreateServiceRoleClient.mockReset();
  mockCreateServiceRoleClient.mockReturnValue({ from: vi.fn() });
  mockWsOn.mockReset();
  mockBroadcastToSession.mockReset();
  mockCollabOn.mockReset();
  mockCollabGetSession.mockReset();
});

// ============================================================================
// TESTS: TYPE EXPORTS
// ============================================================================

describe('presence-service type exports', () => {
  it('should export PresenceData interface with required fields', () => {
    const data: PresenceData = {
      userId: 'user-1',
      userName: 'Test User',
      clientId: 'client-1',
      status: 'active',
    };
    expect(data.userId).toBe('user-1');
    expect(data.userName).toBe('Test User');
    expect(data.clientId).toBe('client-1');
    expect(data.status).toBe('active');
  });

  it('should export PresenceData interface with optional fields', () => {
    const data: PresenceData = {
      userId: 'user-1',
      userName: 'Test User',
      clientId: 'client-1',
      status: 'active',
      userEmail: 'test@example.com',
      color: '#ff0000',
      cursorLine: 10,
      cursorColumn: 5,
      cursorPosition: 150,
      selectionStartLine: 8,
      selectionEndLine: 12,
      selectionStart: 100,
      selectionEnd: 200,
      isTyping: true,
      lastActivity: new Date(),
    };
    expect(data.userEmail).toBe('test@example.com');
    expect(data.color).toBe('#ff0000');
    expect(data.cursorLine).toBe(10);
    expect(data.cursorColumn).toBe(5);
    expect(data.cursorPosition).toBe(150);
    expect(data.selectionStartLine).toBe(8);
    expect(data.selectionEndLine).toBe(12);
    expect(data.selectionStart).toBe(100);
    expect(data.selectionEnd).toBe(200);
    expect(data.isTyping).toBe(true);
    expect(data.lastActivity).toBeInstanceOf(Date);
  });

  it('should export PresenceData with idle status', () => {
    const data: PresenceData = {
      userId: 'user-1',
      userName: 'Test',
      clientId: 'client-1',
      status: 'idle',
    };
    expect(data.status).toBe('idle');
  });

  it('should export PresenceData with away status', () => {
    const data: PresenceData = {
      userId: 'user-1',
      userName: 'Test',
      clientId: 'client-1',
      status: 'away',
    };
    expect(data.status).toBe('away');
  });

  it('should export SessionPresence interface', () => {
    const sp: SessionPresence = {
      sessionId: 'session-1',
      users: [
        {
          userId: 'user-1',
          userName: 'Test User',
          clientId: 'client-1',
          status: 'active',
        },
      ],
    };
    expect(sp.sessionId).toBe('session-1');
    expect(sp.users).toHaveLength(1);
    expect(sp.users[0].userId).toBe('user-1');
  });

  it('should export SessionPresence with empty users', () => {
    const sp: SessionPresence = {
      sessionId: 'session-empty',
      users: [],
    };
    expect(sp.users).toHaveLength(0);
  });
});

// ============================================================================
// TESTS: getPresenceService singleton
// ============================================================================

describe('getPresenceService', () => {
  it('should return a service instance', () => {
    const service = getPresenceService();
    expect(service).toBeDefined();
  });

  it('should return the same instance on multiple calls', () => {
    const service1 = getPresenceService();
    const service2 = getPresenceService();
    expect(service1).toBe(service2);
  });

  it('should have an initialize method', () => {
    const service = getPresenceService();
    expect(typeof service.initialize).toBe('function');
  });

  it('should have a shutdown method', () => {
    const service = getPresenceService();
    expect(typeof service.shutdown).toBe('function');
  });

  it('should have an upsertPresence method', () => {
    const service = getPresenceService();
    expect(typeof service.upsertPresence).toBe('function');
  });

  it('should have a removePresence method', () => {
    const service = getPresenceService();
    expect(typeof service.removePresence).toBe('function');
  });

  it('should have a getSessionPresence method', () => {
    const service = getPresenceService();
    expect(typeof service.getSessionPresence).toBe('function');
  });

  it('should have a cleanupStalePresence method', () => {
    const service = getPresenceService();
    expect(typeof service.cleanupStalePresence).toBe('function');
  });

  it('should have a broadcastPresenceUpdate method', () => {
    const service = getPresenceService();
    expect(typeof service.broadcastPresenceUpdate).toBe('function');
  });

  it('should have a getActiveUserCount method', () => {
    const service = getPresenceService();
    expect(typeof service.getActiveUserCount).toBe('function');
  });
});

// ============================================================================
// TESTS: initializePresenceService
// ============================================================================

describe('initializePresenceService', () => {
  it('should return a service instance', async () => {
    const service = await initializePresenceService();
    expect(service).toBeDefined();
  });

  it('should set up WebSocket bridge event handlers', async () => {
    // Reset to track fresh calls
    mockWsOn.mockReset();
    mockCollabOn.mockReset();

    // Get a fresh service that hasn't been initialized
    // (The singleton may already be initialized from previous tests,
    // but initialize() guards with `if (this.initialized) return`)
    const service = getPresenceService();
    // Shutdown first to reset initialized flag
    service.shutdown();

    await service.initialize();

    // Should register ws event handlers: 'join:session', 'presence:update', 'user:left'
    expect(mockWsOn).toHaveBeenCalled();
    const wsEventTypes = mockWsOn.mock.calls.map((call: unknown[]) => call[0]);
    expect(wsEventTypes).toContain('join:session');
    expect(wsEventTypes).toContain('presence:update');
    expect(wsEventTypes).toContain('user:left');
  });

  it('should set up collaboration bridge event handlers', async () => {
    mockCollabOn.mockReset();
    mockWsOn.mockReset();
    const service = getPresenceService();
    service.shutdown();

    await service.initialize();

    expect(mockCollabOn).toHaveBeenCalled();
    const collabEventTypes = mockCollabOn.mock.calls.map((call: unknown[]) => call[0]);
    expect(collabEventTypes).toContain('cursor');
  });

  it('should not reinitialize if already initialized', async () => {
    mockWsOn.mockReset();
    mockCollabOn.mockReset();
    const service = getPresenceService();
    service.shutdown();

    await service.initialize();
    const firstCallCount = mockWsOn.mock.calls.length;

    await service.initialize();
    // Should not register additional handlers
    expect(mockWsOn.mock.calls.length).toBe(firstCallCount);
  });
});

// ============================================================================
// TESTS: upsertPresence
// ============================================================================

describe('PresenceService.upsertPresence', () => {
  it('should call untypedRpc with upsert_code_lab_presence', async () => {
    mockUntypedRpc.mockResolvedValue({ error: null });
    const service = getPresenceService();

    await service.upsertPresence('session-1', {
      userId: 'user-1',
      userName: 'Test User',
      clientId: 'client-1',
      status: 'active',
    });

    expect(mockUntypedRpc).toHaveBeenCalledWith(
      expect.anything(),
      'upsert_code_lab_presence',
      expect.objectContaining({
        p_session_id: 'session-1',
        p_user_id: 'user-1',
        p_user_name: 'Test User',
        p_client_id: 'client-1',
        p_status: 'active',
        p_is_typing: false,
      })
    );
  });

  it('should pass optional fields as null when not provided', async () => {
    mockUntypedRpc.mockResolvedValue({ error: null });
    const service = getPresenceService();

    await service.upsertPresence('session-1', {
      userId: 'user-1',
      userName: 'Test User',
      clientId: 'client-1',
      status: 'active',
    });

    expect(mockUntypedRpc).toHaveBeenCalledWith(
      expect.anything(),
      'upsert_code_lab_presence',
      expect.objectContaining({
        p_user_email: null,
        p_color: null,
        p_cursor_line: null,
        p_cursor_column: null,
        p_cursor_position: null,
        p_selection_start_line: null,
        p_selection_end_line: null,
        p_selection_start: null,
        p_selection_end: null,
      })
    );
  });

  it('should pass optional fields when provided', async () => {
    mockUntypedRpc.mockResolvedValue({ error: null });
    const service = getPresenceService();

    await service.upsertPresence('session-1', {
      userId: 'user-1',
      userName: 'Test User',
      userEmail: 'test@example.com',
      clientId: 'client-1',
      color: '#00ff00',
      cursorLine: 5,
      cursorColumn: 10,
      cursorPosition: 42,
      selectionStartLine: 3,
      selectionEndLine: 7,
      selectionStart: 30,
      selectionEnd: 70,
      status: 'active',
      isTyping: true,
    });

    expect(mockUntypedRpc).toHaveBeenCalledWith(
      expect.anything(),
      'upsert_code_lab_presence',
      expect.objectContaining({
        p_user_email: 'test@example.com',
        p_color: '#00ff00',
        p_cursor_line: 5,
        p_cursor_column: 10,
        p_cursor_position: 42,
        p_selection_start_line: 3,
        p_selection_end_line: 7,
        p_selection_start: 30,
        p_selection_end: 70,
        p_is_typing: true,
      })
    );
  });

  it('should handle RPC errors gracefully', async () => {
    mockUntypedRpc.mockResolvedValue({ error: { message: 'DB error' } });
    const service = getPresenceService();

    // Should not throw
    await expect(
      service.upsertPresence('session-1', {
        userId: 'user-1',
        userName: 'Test',
        clientId: 'client-1',
        status: 'active',
      })
    ).resolves.toBeUndefined();
  });

  it('should handle exceptions gracefully', async () => {
    mockUntypedRpc.mockRejectedValue(new Error('Connection failed'));
    const service = getPresenceService();

    // Should not throw
    await expect(
      service.upsertPresence('session-1', {
        userId: 'user-1',
        userName: 'Test',
        clientId: 'client-1',
        status: 'active',
      })
    ).resolves.toBeUndefined();
  });
});

// ============================================================================
// TESTS: removePresence
// ============================================================================

describe('PresenceService.removePresence', () => {
  it('should call untypedRpc with remove_code_lab_presence', async () => {
    mockUntypedRpc.mockResolvedValue({ error: null });
    const service = getPresenceService();

    await service.removePresence('session-1', 'user-1');

    expect(mockUntypedRpc).toHaveBeenCalledWith(expect.anything(), 'remove_code_lab_presence', {
      p_session_id: 'session-1',
      p_user_id: 'user-1',
    });
  });

  it('should handle RPC errors gracefully', async () => {
    mockUntypedRpc.mockResolvedValue({ error: { message: 'Not found' } });
    const service = getPresenceService();

    await expect(service.removePresence('session-1', 'user-1')).resolves.toBeUndefined();
  });

  it('should handle exceptions gracefully', async () => {
    mockUntypedRpc.mockRejectedValue(new Error('Network error'));
    const service = getPresenceService();

    await expect(service.removePresence('session-1', 'user-1')).resolves.toBeUndefined();
  });
});

// ============================================================================
// TESTS: getSessionPresence
// ============================================================================

describe('PresenceService.getSessionPresence', () => {
  it('should return mapped presence data from RPC', async () => {
    mockUntypedRpc.mockResolvedValue({
      data: [
        {
          user_id: 'user-1',
          user_name: 'Test User',
          user_email: 'test@example.com',
          client_id: 'client-1',
          color: '#ff0000',
          cursor_line: 10,
          cursor_column: 5,
          cursor_position: 150,
          selection_start_line: 8,
          selection_end_line: 12,
          status: 'active',
          is_typing: true,
          last_activity: '2026-02-25T00:00:00Z',
        },
      ],
      error: null,
    });

    const service = getPresenceService();
    const result = await service.getSessionPresence('session-1');

    expect(result).toHaveLength(1);
    expect(result[0].userId).toBe('user-1');
    expect(result[0].userName).toBe('Test User');
    expect(result[0].userEmail).toBe('test@example.com');
    expect(result[0].clientId).toBe('client-1');
    expect(result[0].color).toBe('#ff0000');
    expect(result[0].cursorLine).toBe(10);
    expect(result[0].cursorColumn).toBe(5);
    expect(result[0].cursorPosition).toBe(150);
    expect(result[0].selectionStartLine).toBe(8);
    expect(result[0].selectionEndLine).toBe(12);
    expect(result[0].status).toBe('active');
    expect(result[0].isTyping).toBe(true);
    expect(result[0].lastActivity).toBeInstanceOf(Date);
  });

  it('should return empty array on RPC error', async () => {
    mockUntypedRpc.mockResolvedValue({ data: null, error: { message: 'Error' } });
    const service = getPresenceService();

    const result = await service.getSessionPresence('session-1');
    expect(result).toEqual([]);
  });

  it('should return empty array on null data', async () => {
    mockUntypedRpc.mockResolvedValue({ data: null, error: null });
    const service = getPresenceService();

    const result = await service.getSessionPresence('session-1');
    expect(result).toEqual([]);
  });

  it('should return empty array on exception', async () => {
    mockUntypedRpc.mockRejectedValue(new Error('Connection lost'));
    const service = getPresenceService();

    const result = await service.getSessionPresence('session-1');
    expect(result).toEqual([]);
  });

  it('should handle multiple users in session', async () => {
    mockUntypedRpc.mockResolvedValue({
      data: [
        {
          user_id: 'user-1',
          user_name: 'User 1',
          client_id: 'client-1',
          status: 'active',
        },
        {
          user_id: 'user-2',
          user_name: 'User 2',
          client_id: 'client-2',
          status: 'idle',
        },
      ],
      error: null,
    });

    const service = getPresenceService();
    const result = await service.getSessionPresence('session-1');

    expect(result).toHaveLength(2);
    expect(result[0].userId).toBe('user-1');
    expect(result[1].userId).toBe('user-2');
    expect(result[1].status).toBe('idle');
  });

  it('should handle rows with no last_activity', async () => {
    mockUntypedRpc.mockResolvedValue({
      data: [
        {
          user_id: 'user-1',
          user_name: 'User 1',
          client_id: 'client-1',
          status: 'active',
        },
      ],
      error: null,
    });

    const service = getPresenceService();
    const result = await service.getSessionPresence('session-1');

    expect(result[0].lastActivity).toBeUndefined();
  });
});

// ============================================================================
// TESTS: cleanupStalePresence
// ============================================================================

describe('PresenceService.cleanupStalePresence', () => {
  it('should call cleanup_stale_code_lab_presence RPC', async () => {
    mockUntypedRpc.mockResolvedValue({ data: 0, error: null });
    const service = getPresenceService();

    await service.cleanupStalePresence();

    expect(mockUntypedRpc).toHaveBeenCalledWith(
      expect.anything(),
      'cleanup_stale_code_lab_presence'
    );
  });

  it('should return deleted count on success', async () => {
    mockUntypedRpc.mockResolvedValue({ data: 5, error: null });
    const service = getPresenceService();

    const result = await service.cleanupStalePresence();
    expect(result).toBe(5);
  });

  it('should return 0 when nothing was cleaned', async () => {
    mockUntypedRpc.mockResolvedValue({ data: 0, error: null });
    const service = getPresenceService();

    const result = await service.cleanupStalePresence();
    expect(result).toBe(0);
  });

  it('should return 0 on RPC error', async () => {
    mockUntypedRpc.mockResolvedValue({ data: null, error: { message: 'Failed' } });
    const service = getPresenceService();

    const result = await service.cleanupStalePresence();
    expect(result).toBe(0);
  });

  it('should return 0 on exception', async () => {
    mockUntypedRpc.mockRejectedValue(new Error('Timeout'));
    const service = getPresenceService();

    const result = await service.cleanupStalePresence();
    expect(result).toBe(0);
  });
});

// ============================================================================
// TESTS: broadcastPresenceUpdate
// ============================================================================

describe('PresenceService.broadcastPresenceUpdate', () => {
  it('should broadcast presence data to session via WebSocket', () => {
    const service = getPresenceService();
    const data: PresenceData = {
      userId: 'user-1',
      userName: 'Test User',
      clientId: 'client-1',
      status: 'active',
    };

    service.broadcastPresenceUpdate('session-1', data);

    expect(mockBroadcastToSession).toHaveBeenCalledWith(
      'session-1',
      expect.objectContaining({
        type: 'presence:updated',
        payload: data,
      }),
      undefined
    );
  });

  it('should pass excludeClientId when provided', () => {
    const service = getPresenceService();
    const data: PresenceData = {
      userId: 'user-1',
      userName: 'Test',
      clientId: 'client-1',
      status: 'active',
    };

    service.broadcastPresenceUpdate('session-1', data, 'exclude-client');

    expect(mockBroadcastToSession).toHaveBeenCalledWith(
      'session-1',
      expect.objectContaining({
        type: 'presence:updated',
        payload: data,
      }),
      'exclude-client'
    );
  });

  it('should include a timestamp in the broadcast message', () => {
    const service = getPresenceService();
    const data: PresenceData = {
      userId: 'user-1',
      userName: 'Test',
      clientId: 'client-1',
      status: 'active',
    };

    service.broadcastPresenceUpdate('session-1', data);

    const call = mockBroadcastToSession.mock.calls[0];
    expect(call[1].timestamp).toBeGreaterThan(0);
    expect(typeof call[1].timestamp).toBe('number');
  });
});

// ============================================================================
// TESTS: getActiveUserCount
// ============================================================================

describe('PresenceService.getActiveUserCount', () => {
  it('should return count of active users only', async () => {
    mockUntypedRpc.mockResolvedValue({
      data: [
        { user_id: 'u1', user_name: 'A', client_id: 'c1', status: 'active' },
        { user_id: 'u2', user_name: 'B', client_id: 'c2', status: 'idle' },
        { user_id: 'u3', user_name: 'C', client_id: 'c3', status: 'active' },
        { user_id: 'u4', user_name: 'D', client_id: 'c4', status: 'away' },
      ],
      error: null,
    });

    const service = getPresenceService();
    const count = await service.getActiveUserCount('session-1');

    expect(count).toBe(2);
  });

  it('should return 0 when no users are active', async () => {
    mockUntypedRpc.mockResolvedValue({
      data: [
        { user_id: 'u1', user_name: 'A', client_id: 'c1', status: 'idle' },
        { user_id: 'u2', user_name: 'B', client_id: 'c2', status: 'away' },
      ],
      error: null,
    });

    const service = getPresenceService();
    const count = await service.getActiveUserCount('session-1');

    expect(count).toBe(0);
  });

  it('should return 0 when session has no users', async () => {
    mockUntypedRpc.mockResolvedValue({ data: [], error: null });
    const service = getPresenceService();
    const count = await service.getActiveUserCount('session-empty');

    expect(count).toBe(0);
  });

  it('should return 0 on error', async () => {
    mockUntypedRpc.mockRejectedValue(new Error('fail'));
    const service = getPresenceService();
    const count = await service.getActiveUserCount('session-1');

    expect(count).toBe(0);
  });
});

// ============================================================================
// TESTS: shutdown
// ============================================================================

describe('PresenceService.shutdown', () => {
  it('should not throw when called', () => {
    const service = getPresenceService();
    expect(() => service.shutdown()).not.toThrow();
  });

  it('should be safe to call multiple times', () => {
    const service = getPresenceService();
    service.shutdown();
    service.shutdown();
    // No error thrown
    expect(true).toBe(true);
  });

  it('should allow re-initialization after shutdown', async () => {
    const service = getPresenceService();
    service.shutdown();
    await service.initialize();
    // Should not throw
    expect(true).toBe(true);
  });
});
