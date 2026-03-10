import { describe, it, expect, vi, beforeEach } from 'vitest';

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

const { mockSend, mockOn, mockUseWebSocket } = vi.hoisted(() => {
  const mockSend = vi.fn();
  const mockOn = vi.fn().mockReturnValue(vi.fn());
  const mockUseWebSocket = vi.fn().mockReturnValue({
    send: mockSend,
    on: mockOn,
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
  });
  return { mockSend, mockOn, mockUseWebSocket };
});

vi.mock('@/lib/realtime', () => ({
  useWebSocket: mockUseWebSocket,
}));

import { renderHook, act } from '@testing-library/react';
import { useCollaboration } from './useCollaboration';
import type { UseCollaborationOptions } from './useCollaboration';

// ============================================================================
// Tests
// ============================================================================

describe('useCollaboration', () => {
  const defaultOptions: UseCollaborationOptions = {
    token: 'test-token',
    documentId: 'doc-1',
    userId: 'user-1',
    userName: 'Alice',
    initialContent: '',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseWebSocket.mockReturnValue({
      send: mockSend,
      on: mockOn,
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
    });
    vi.stubGlobal('fetch', vi.fn());
  });

  // ============================================================================
  // Initial state
  // ============================================================================

  describe('initial state', () => {
    it('should return null sessionId initially', () => {
      const { result } = renderHook(() => useCollaboration(defaultOptions));
      expect(result.current.sessionId).toBeNull();
    });

    it('should return initial content', () => {
      const { result } = renderHook(() =>
        useCollaboration({ ...defaultOptions, initialContent: 'Hello' })
      );
      expect(result.current.content).toBe('Hello');
    });

    it('should return empty users array initially', () => {
      const { result } = renderHook(() => useCollaboration(defaultOptions));
      expect(result.current.users).toEqual([]);
    });

    it('should return empty cursors array initially', () => {
      const { result } = renderHook(() => useCollaboration(defaultOptions));
      expect(result.current.cursors).toEqual([]);
    });

    it('should return null error initially', () => {
      const { result } = renderHook(() => useCollaboration(defaultOptions));
      expect(result.current.error).toBeNull();
    });

    it('should return isConnected as false initially', () => {
      const { result } = renderHook(() => useCollaboration(defaultOptions));
      expect(result.current.isConnected).toBe(false);
    });
  });

  // ============================================================================
  // Return shape
  // ============================================================================

  describe('return shape', () => {
    it('should return insert function', () => {
      const { result } = renderHook(() => useCollaboration(defaultOptions));
      expect(typeof result.current.insert).toBe('function');
    });

    it('should return delete function', () => {
      const { result } = renderHook(() => useCollaboration(defaultOptions));
      expect(typeof result.current.delete).toBe('function');
    });

    it('should return setContent function', () => {
      const { result } = renderHook(() => useCollaboration(defaultOptions));
      expect(typeof result.current.setContent).toBe('function');
    });

    it('should return updateCursor function', () => {
      const { result } = renderHook(() => useCollaboration(defaultOptions));
      expect(typeof result.current.updateCursor).toBe('function');
    });

    it('should return createSession function', () => {
      const { result } = renderHook(() => useCollaboration(defaultOptions));
      expect(typeof result.current.createSession).toBe('function');
    });

    it('should return joinSession function', () => {
      const { result } = renderHook(() => useCollaboration(defaultOptions));
      expect(typeof result.current.joinSession).toBe('function');
    });

    it('should return leaveSession function', () => {
      const { result } = renderHook(() => useCollaboration(defaultOptions));
      expect(typeof result.current.leaveSession).toBe('function');
    });

    it('should return sync function', () => {
      const { result } = renderHook(() => useCollaboration(defaultOptions));
      expect(typeof result.current.sync).toBe('function');
    });
  });

  // ============================================================================
  // useWebSocket integration
  // ============================================================================

  describe('useWebSocket integration', () => {
    it('should pass token to useWebSocket', () => {
      renderHook(() => useCollaboration(defaultOptions));
      expect(mockUseWebSocket).toHaveBeenCalledWith(
        expect.objectContaining({
          token: 'test-token',
          autoConnect: true,
        })
      );
    });

    it('should reflect isConnected from useWebSocket', () => {
      mockUseWebSocket.mockReturnValue({
        send: mockSend,
        on: mockOn,
        isConnected: true,
        connectionState: 'connected',
        clientId: 'client-1',
        sessionId: null,
        members: [],
        connect: vi.fn(),
        disconnect: vi.fn(),
        joinSession: vi.fn(),
        leaveSession: vi.fn(),
        updatePresence: vi.fn(),
        presenceList: [],
      });

      const { result } = renderHook(() => useCollaboration(defaultOptions));
      expect(result.current.isConnected).toBe(true);
    });
  });

  // ============================================================================
  // Document operations
  // ============================================================================

  describe('document operations', () => {
    it('should insert text via the document', () => {
      const { result } = renderHook(() =>
        useCollaboration({ ...defaultOptions, initialContent: '' })
      );

      act(() => {
        result.current.insert(0, 'Hello');
      });

      expect(result.current.content).toBe('Hello');
    });

    it('should delete text via the document', () => {
      const { result } = renderHook(() =>
        useCollaboration({ ...defaultOptions, initialContent: 'Hello World' })
      );

      act(() => {
        result.current.delete(5, 6);
      });

      expect(result.current.content).toBe('Hello');
    });

    it('should set content by replacing entire document', () => {
      const { result } = renderHook(() =>
        useCollaboration({ ...defaultOptions, initialContent: 'Old content' })
      );

      act(() => {
        result.current.setContent('New content');
      });

      expect(result.current.content).toBe('New content');
    });

    it('should handle setContent with empty string', () => {
      const { result } = renderHook(() =>
        useCollaboration({ ...defaultOptions, initialContent: 'Something' })
      );

      act(() => {
        result.current.setContent('');
      });

      expect(result.current.content).toBe('');
    });

    it('should call onContentChange callback when content changes', () => {
      const onContentChange = vi.fn();
      const { result } = renderHook(() => useCollaboration({ ...defaultOptions, onContentChange }));

      act(() => {
        result.current.insert(0, 'Hello');
      });

      expect(onContentChange).toHaveBeenCalledWith('Hello');
    });
  });

  // ============================================================================
  // createSession
  // ============================================================================

  describe('createSession', () => {
    it('should call API with create action', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          session: { id: 'session-new', users: [] },
        }),
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

      const { result } = renderHook(() => useCollaboration(defaultOptions));

      let sessionId: string | undefined;
      await act(async () => {
        sessionId = await result.current.createSession();
      });

      expect(sessionId).toBe('session-new');
      expect(fetch).toHaveBeenCalledWith(
        '/api/code-lab/collaboration',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('should set error on API failure', async () => {
      const mockResponse = {
        ok: false,
        json: vi.fn().mockResolvedValue({ error: 'Server error' }),
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

      const { result } = renderHook(() => useCollaboration(defaultOptions));

      await act(async () => {
        try {
          await result.current.createSession();
        } catch {
          // Expected
        }
      });

      expect(result.current.error).toBe('Server error');
    });
  });

  // ============================================================================
  // joinSession
  // ============================================================================

  describe('joinSession', () => {
    it('should call API with join action', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          users: [{ id: 'user-1', name: 'Alice', color: '#FF0000', isTyping: false }],
          content: 'Hello',
        }),
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

      const { result } = renderHook(() => useCollaboration(defaultOptions));

      let joinResult: boolean | undefined;
      await act(async () => {
        joinResult = await result.current.joinSession('session-1');
      });

      expect(joinResult).toBe(true);
    });

    it('should return false on join failure', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ success: false }),
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

      const { result } = renderHook(() => useCollaboration(defaultOptions));

      let joinResult: boolean | undefined;
      await act(async () => {
        joinResult = await result.current.joinSession('session-1');
      });

      expect(joinResult).toBe(false);
    });

    it('should return false and set error on API error', async () => {
      const mockResponse = {
        ok: false,
        json: vi.fn().mockResolvedValue({ error: 'Not found' }),
      };
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

      const { result } = renderHook(() => useCollaboration(defaultOptions));

      let joinResult: boolean | undefined;
      await act(async () => {
        joinResult = await result.current.joinSession('session-1');
      });

      expect(joinResult).toBe(false);
      expect(result.current.error).toBe('Not found');
    });
  });

  // ============================================================================
  // leaveSession
  // ============================================================================

  describe('leaveSession', () => {
    it('should do nothing when no session is active', async () => {
      vi.stubGlobal('fetch', vi.fn());

      const { result } = renderHook(() => useCollaboration(defaultOptions));

      await act(async () => {
        await result.current.leaveSession();
      });

      // fetch should not be called since sessionId is null
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should call API with leave action when session is active', async () => {
      // First create a session
      const createResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          session: { id: 'session-1', users: [] },
        }),
      };
      const leaveResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ success: true }),
      };
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce(createResponse)
        .mockResolvedValueOnce(leaveResponse);
      vi.stubGlobal('fetch', mockFetch);

      const { result } = renderHook(() => useCollaboration(defaultOptions));

      await act(async () => {
        await result.current.createSession();
      });

      await act(async () => {
        await result.current.leaveSession();
      });

      expect(result.current.sessionId).toBeNull();
      expect(result.current.users).toEqual([]);
      expect(result.current.cursors).toEqual([]);
    });
  });

  // ============================================================================
  // sync
  // ============================================================================

  describe('sync', () => {
    it('should do nothing when no session is active', async () => {
      vi.stubGlobal('fetch', vi.fn());

      const { result } = renderHook(() => useCollaboration(defaultOptions));

      await act(async () => {
        await result.current.sync();
      });

      expect(fetch).not.toHaveBeenCalled();
    });

    it('should call API with sync action when session exists', async () => {
      const createResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          session: { id: 'session-1', users: [] },
        }),
      };
      const syncResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ success: true }),
      };
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce(createResponse)
        .mockResolvedValueOnce(syncResponse);
      vi.stubGlobal('fetch', mockFetch);

      const { result } = renderHook(() => useCollaboration(defaultOptions));

      await act(async () => {
        await result.current.createSession();
      });

      await act(async () => {
        await result.current.sync();
      });

      // Second call should be the sync
      const syncCall = mockFetch.mock.calls[1];
      const body = JSON.parse(syncCall[1].body);
      expect(body.action).toBe('sync');
      expect(body.sessionId).toBe('session-1');
    });
  });

  // ============================================================================
  // Cursor operations
  // ============================================================================

  describe('cursor operations', () => {
    it('should call updateCursor without error', () => {
      const { result } = renderHook(() => useCollaboration(defaultOptions));

      act(() => {
        result.current.updateCursor(10);
      });

      // Should not throw
    });

    it('should call updateCursor with selection', () => {
      const { result } = renderHook(() => useCollaboration(defaultOptions));

      act(() => {
        result.current.updateCursor(0, { start: 0, end: 5 });
      });

      // Should not throw
    });
  });
});
