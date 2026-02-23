/**
 * Tests for useSessionManager hook
 *
 * Covers: initial state, loadSessions + auto-create, createSession,
 * selectSession, deleteSession, renameSession, exportSession,
 * setSessionRepo, error handling, and race condition protection.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor, cleanup } from '@testing-library/react';
import { useSessionManager } from './useSessionManager';
import type { CodeLabSession, CodeLabMessage } from './types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/logger', () => ({
  logger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
};

vi.mock('@/components/ui/Toast', () => ({
  useToastActions: () => mockToast,
}));

vi.mock('./useAsyncState', () => ({
  useMountedRef: () => ({ current: true }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
global.fetch = mockFetch;

/** Factory for a minimal valid CodeLabSession */
function makeSession(overrides: Partial<CodeLabSession> = {}): CodeLabSession {
  return {
    id: 'session-1',
    title: 'Test Session',
    createdAt: new Date('2026-02-22T00:00:00Z'),
    updatedAt: new Date('2026-02-22T00:00:00Z'),
    isActive: true,
    messageCount: 0,
    hasSummary: false,
    ...overrides,
  };
}

/** Factory for a minimal valid CodeLabMessage */
function makeMessage(overrides: Partial<CodeLabMessage> = {}): CodeLabMessage {
  return {
    id: 'msg-1',
    sessionId: 'session-1',
    role: 'user',
    content: 'Hello',
    createdAt: new Date('2026-02-22T00:00:00Z'),
    ...overrides,
  };
}

/** Helper to build a successful Response-like object for fetch */
function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

// jsdom doesn't provide URL.createObjectURL / revokeObjectURL — polyfill them
// so vi.spyOn works in the exportSession tests.
if (typeof URL.createObjectURL !== 'function') {
  (URL as unknown as Record<string, unknown>).createObjectURL = vi.fn();
}
if (typeof URL.revokeObjectURL !== 'function') {
  (URL as unknown as Record<string, unknown>).revokeObjectURL = vi.fn();
}

afterEach(async () => {
  // Flush pending React state updates before cleanup to avoid
  // dangling promises (e.g. loadSessions -> createSession on mount)
  await act(async () => {
    await new Promise((r) => setTimeout(r, 150));
  });
  cleanup();
});

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockReset();

  // Default: loadSessions returns empty list (GET), then auto-create returns a new session (POST)
  mockFetch
    .mockResolvedValueOnce(jsonResponse({ sessions: [] })) // GET /api/code-lab/sessions
    .mockResolvedValueOnce(
      jsonResponse({
        session: makeSession({ id: 'auto-created', title: 'New Session' }),
      })
    ); // POST auto-create
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useSessionManager', () => {
  // -----------------------------------------------------------------------
  // 1. Initial state
  // -----------------------------------------------------------------------
  describe('initial state', () => {
    it('should have empty sessions, null currentSessionId, empty messages, isLoading false, error null', () => {
      // We need to observe initial state *before* the useEffect fires.
      // renderHook renders synchronously first, so we can inspect initial values
      // before the effect-based fetch resolves.
      const { result } = renderHook(() => useSessionManager());

      // Before the auto-create effect settles, sessions start empty
      expect(result.current.sessions).toEqual([]);
      expect(result.current.currentSessionId).toBeNull();
      expect(result.current.messages).toEqual([]);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // 2. loadSessions + auto-create
  // -----------------------------------------------------------------------
  describe('loadSessions + auto-create', () => {
    it('fetches sessions on mount and auto-creates a new session when list is empty', async () => {
      const autoSession = makeSession({ id: 'new-1', title: 'New Session' });

      mockFetch.mockReset();
      mockFetch
        .mockResolvedValueOnce(jsonResponse({ sessions: [] })) // GET sessions
        .mockResolvedValueOnce(jsonResponse({ session: autoSession })); // POST auto-create

      const { result } = renderHook(() => useSessionManager());

      await waitFor(() => {
        expect(result.current.sessions).toHaveLength(1);
      });

      expect(result.current.sessions[0].id).toBe('new-1');
      expect(result.current.currentSessionId).toBe('new-1');

      // Verify fetch was called twice: GET then POST
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenNthCalledWith(1, '/api/code-lab/sessions');
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        '/api/code-lab/sessions',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'New Session' }),
        })
      );
    });

    it('loads existing sessions and still auto-creates', async () => {
      const existing = makeSession({ id: 'existing-1', title: 'Existing' });
      const autoSession = makeSession({ id: 'auto-1', title: 'New Session' });

      mockFetch.mockReset();
      mockFetch
        .mockResolvedValueOnce(jsonResponse({ sessions: [existing] })) // GET sessions
        .mockResolvedValueOnce(jsonResponse({ session: autoSession })); // POST auto-create

      const { result } = renderHook(() => useSessionManager());

      await waitFor(() => {
        // auto-created session is prepended, so we should have 2 sessions
        expect(result.current.sessions).toHaveLength(2);
      });

      // The auto-created session should be first (prepended via setSessions)
      expect(result.current.sessions[0].id).toBe('auto-1');
      expect(result.current.currentSessionId).toBe('auto-1');
    });
  });

  // -----------------------------------------------------------------------
  // 3. createSession
  // -----------------------------------------------------------------------
  describe('createSession', () => {
    it('POSTs to /api/code-lab/sessions with the given title', async () => {
      const { result } = renderHook(() => useSessionManager());

      // Wait for mount effects to settle
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });

      const newSession = makeSession({ id: 'created-1', title: 'Test' });
      mockFetch.mockResolvedValueOnce(jsonResponse({ session: newSession }));

      let returned: CodeLabSession | null = null;
      await act(async () => {
        returned = await result.current.createSession('Test');
      });

      expect(returned).toEqual(newSession);
      expect(result.current.currentSessionId).toBe('created-1');
      expect(result.current.messages).toEqual([]);

      // The third call should be our createSession call
      expect(mockFetch).toHaveBeenNthCalledWith(
        3,
        '/api/code-lab/sessions',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ title: 'Test' }),
        })
      );
    });

    it('uses "New Session" as default title when none provided', async () => {
      const { result } = renderHook(() => useSessionManager());

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });

      const newSession = makeSession({ id: 'default-title', title: 'New Session' });
      mockFetch.mockResolvedValueOnce(jsonResponse({ session: newSession }));

      await act(async () => {
        await result.current.createSession();
      });

      expect(mockFetch).toHaveBeenLastCalledWith(
        '/api/code-lab/sessions',
        expect.objectContaining({
          body: JSON.stringify({ title: 'New Session' }),
        })
      );
    });

    it('clears messages when creating a new session', async () => {
      const { result } = renderHook(() => useSessionManager());

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });

      // Manually set messages to simulate existing conversation
      act(() => {
        result.current.setMessages([makeMessage()]);
      });

      expect(result.current.messages).toHaveLength(1);

      const newSession = makeSession({ id: 'clear-msgs' });
      mockFetch.mockResolvedValueOnce(jsonResponse({ session: newSession }));

      await act(async () => {
        await result.current.createSession('Fresh');
      });

      expect(result.current.messages).toEqual([]);
    });

    it('returns null and sets error when fetch throws', async () => {
      const { result } = renderHook(() => useSessionManager());

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      let returned: CodeLabSession | null = null;
      await act(async () => {
        returned = await result.current.createSession('Fail');
      });

      expect(returned).toBeNull();
      // Error is set then auto-cleared by useEffect timer (100ms)
      // Wait for the auto-clear to fire
      await act(async () => {
        await new Promise((r) => setTimeout(r, 150));
      });
      expect(result.current.error).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // 4. selectSession
  // -----------------------------------------------------------------------
  describe('selectSession', () => {
    it('sets currentSessionId and fetches messages', async () => {
      const { result } = renderHook(() => useSessionManager());

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });

      const msgs = [
        makeMessage({ id: 'msg-1', content: 'First' }),
        makeMessage({ id: 'msg-2', role: 'assistant', content: 'Reply' }),
      ];
      mockFetch.mockResolvedValueOnce(jsonResponse({ messages: msgs }));

      await act(async () => {
        await result.current.selectSession('session-abc');
      });

      expect(result.current.currentSessionId).toBe('session-abc');
      expect(result.current.messages).toEqual(msgs);
      expect(result.current.isLoading).toBe(false);

      expect(mockFetch).toHaveBeenLastCalledWith('/api/code-lab/sessions/session-abc/messages');
    });

    it('sets isLoading true while fetching and false after', async () => {
      const { result } = renderHook(() => useSessionManager());

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });

      let resolveMessages!: (value: Response) => void;
      mockFetch.mockReturnValueOnce(
        new Promise<Response>((res) => {
          resolveMessages = res;
        })
      );

      // Start selecting — do not await
      let selectPromise: Promise<void>;
      act(() => {
        selectPromise = result.current.selectSession('session-loading');
      });

      // isLoading should be true while pending
      expect(result.current.isLoading).toBe(true);

      // Resolve the fetch
      await act(async () => {
        resolveMessages(jsonResponse({ messages: [] }));
        await selectPromise;
      });

      expect(result.current.isLoading).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // 5. deleteSession
  // -----------------------------------------------------------------------
  describe('deleteSession', () => {
    it('DELETEs the session and removes it from state', async () => {
      const s1 = makeSession({ id: 's1', title: 'One' });
      const s2 = makeSession({ id: 's2', title: 'Two' });
      const autoSession = makeSession({ id: 'auto', title: 'New Session' });

      mockFetch.mockReset();
      mockFetch
        .mockResolvedValueOnce(jsonResponse({ sessions: [s1, s2] })) // GET
        .mockResolvedValueOnce(jsonResponse({ session: autoSession })); // auto-create

      const { result } = renderHook(() => useSessionManager());

      await waitFor(() => {
        expect(result.current.sessions.length).toBeGreaterThanOrEqual(2);
      });

      // Delete s1 (not the current session) — should just remove it
      mockFetch.mockResolvedValueOnce(jsonResponse({}, true, 200)); // DELETE

      await act(async () => {
        await result.current.deleteSession('s1');
      });

      expect(result.current.sessions.find((s) => s.id === 's1')).toBeUndefined();
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/code-lab/sessions/s1',
        expect.objectContaining({ method: 'DELETE' })
      );
    });

    it('switches to another session when the current one is deleted', async () => {
      const s1 = makeSession({ id: 's1', title: 'One' });
      const s2 = makeSession({ id: 's2', title: 'Two' });

      mockFetch.mockReset();
      mockFetch
        .mockResolvedValueOnce(jsonResponse({ sessions: [s1, s2] })) // GET
        .mockResolvedValueOnce(jsonResponse({ session: s1 })); // auto-create sets currentSessionId to s1.id

      const { result } = renderHook(() => useSessionManager());

      await waitFor(() => {
        expect(result.current.currentSessionId).toBe('s1');
      });

      // DELETE for s1, then selectSession for the remaining session fetches messages
      mockFetch
        .mockResolvedValueOnce(jsonResponse({}, true, 200)) // DELETE s1
        .mockResolvedValueOnce(jsonResponse({ messages: [] })); // GET messages for fallback session

      await act(async () => {
        await result.current.deleteSession('s1');
      });

      // After deleting s1, selectSession should have been called with the first remaining session
      // The remaining sessions from the original array (before auto-create prepend) filtered by s1 removal
      // would be s2
      expect(result.current.currentSessionId).not.toBe('s1');
    });

    it('clears currentSessionId and messages if no sessions remain after delete', async () => {
      mockFetch.mockReset();
      mockFetch
        .mockResolvedValueOnce(jsonResponse({ sessions: [] })) // GET
        .mockResolvedValueOnce(
          jsonResponse({ session: makeSession({ id: 'only-one', title: 'Only' }) })
        ); // auto-create

      const { result } = renderHook(() => useSessionManager());

      await waitFor(() => {
        expect(result.current.sessions).toHaveLength(1);
        expect(result.current.currentSessionId).toBe('only-one');
      });

      mockFetch.mockResolvedValueOnce(jsonResponse({}, true, 200)); // DELETE

      await act(async () => {
        await result.current.deleteSession('only-one');
      });

      expect(result.current.currentSessionId).toBeNull();
      expect(result.current.messages).toEqual([]);
    });

    it('shows toast error when DELETE fails', async () => {
      const { result } = renderHook(() => useSessionManager());

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });

      mockFetch.mockResolvedValueOnce(jsonResponse({}, false, 500)); // DELETE fails

      await act(async () => {
        await result.current.deleteSession('nonexistent');
      });

      expect(mockToast.error).toHaveBeenCalledWith('Delete Failed', 'Failed to delete session');
    });
  });

  // -----------------------------------------------------------------------
  // 6. renameSession
  // -----------------------------------------------------------------------
  describe('renameSession', () => {
    it('PATCHes the session with the new title and updates state', async () => {
      const s1 = makeSession({ id: 's1', title: 'Old Title' });

      mockFetch.mockReset();
      mockFetch
        .mockResolvedValueOnce(jsonResponse({ sessions: [s1] })) // GET
        .mockResolvedValueOnce(jsonResponse({ session: s1 })); // auto-create

      const { result } = renderHook(() => useSessionManager());

      await waitFor(() => {
        expect(result.current.sessions.some((s) => s.id === 's1')).toBe(true);
      });

      mockFetch.mockResolvedValueOnce(jsonResponse({})); // PATCH

      await act(async () => {
        await result.current.renameSession('s1', 'New Title');
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/code-lab/sessions/s1',
        expect.objectContaining({
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'New Title' }),
        })
      );

      const updated = result.current.sessions.find((s) => s.id === 's1');
      expect(updated?.title).toBe('New Title');
    });
  });

  // -----------------------------------------------------------------------
  // 7. exportSession
  // -----------------------------------------------------------------------
  describe('exportSession', () => {
    it('creates a blob download link for the current session', async () => {
      const session = makeSession({
        id: 'export-1',
        title: 'Export Test',
        messageCount: 1,
      });

      mockFetch.mockReset();
      mockFetch
        .mockResolvedValueOnce(jsonResponse({ sessions: [session] })) // GET
        .mockResolvedValueOnce(jsonResponse({ session })); // auto-create

      const { result } = renderHook(() => useSessionManager());

      await waitFor(() => {
        expect(result.current.currentSessionId).toBe('export-1');
      });

      // Set messages for current session
      act(() => {
        result.current.setMessages([
          makeMessage({ id: 'm1', role: 'user', content: 'Hello', sessionId: 'export-1' }),
          makeMessage({ id: 'm2', role: 'assistant', content: 'Hi there', sessionId: 'export-1' }),
        ]);
      });

      // Mock only URL methods and HTMLAnchorElement.click — leave document.createElement
      // and document.body.appendChild real to avoid corrupting React's DOM operations.
      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
      const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
      const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockReturnValue(undefined);

      await act(async () => {
        await result.current.exportSession('export-1');
      });

      expect(createObjectURLSpy).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
      expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url');

      clickSpy.mockRestore();
      createObjectURLSpy.mockRestore();
      revokeObjectURLSpy.mockRestore();
    });

    it('fetches messages from API when exporting a non-current session', async () => {
      const s1 = makeSession({ id: 's1', title: 'Current' });
      const s2 = makeSession({ id: 's2', title: 'Other Session', messageCount: 1 });

      mockFetch.mockReset();
      mockFetch
        .mockResolvedValueOnce(jsonResponse({ sessions: [s1, s2] })) // GET
        .mockResolvedValueOnce(jsonResponse({ session: s1 })); // auto-create -> sets current to s1

      const { result } = renderHook(() => useSessionManager());

      await waitFor(() => {
        expect(result.current.currentSessionId).toBe('s1');
      });

      // Mock the messages fetch for the non-current session
      const exportMsgs = [makeMessage({ id: 'em1', content: 'Exported msg', sessionId: 's2' })];
      mockFetch.mockResolvedValueOnce(jsonResponse({ messages: exportMsgs }));

      // Mock only URL methods and click — leave DOM APIs real
      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
      const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
      const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockReturnValue(undefined);

      await act(async () => {
        await result.current.exportSession('s2');
      });

      // Should have fetched messages for s2
      expect(mockFetch).toHaveBeenCalledWith('/api/code-lab/sessions/s2/messages');
      expect(clickSpy).toHaveBeenCalled();

      clickSpy.mockRestore();
      createObjectURLSpy.mockRestore();
      revokeObjectURLSpy.mockRestore();
    });

    it('does nothing if session is not found', async () => {
      const { result } = renderHook(() => useSessionManager());

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });

      const createElementSpy = vi.spyOn(document, 'createElement');

      await act(async () => {
        await result.current.exportSession('nonexistent');
      });

      // Should not have tried to create download link
      expect(createElementSpy).not.toHaveBeenCalledWith('a');

      createElementSpy.mockRestore();
    });
  });

  // -----------------------------------------------------------------------
  // 8. setSessionRepo
  // -----------------------------------------------------------------------
  describe('setSessionRepo', () => {
    it('PATCHes the session with repo info and updates state', async () => {
      const s1 = makeSession({ id: 's1', title: 'Repo Test' });

      mockFetch.mockReset();
      mockFetch
        .mockResolvedValueOnce(jsonResponse({ sessions: [s1] })) // GET
        .mockResolvedValueOnce(jsonResponse({ session: s1 })); // auto-create

      const { result } = renderHook(() => useSessionManager());

      await waitFor(() => {
        expect(result.current.sessions.some((s) => s.id === 's1')).toBe(true);
      });

      const repo = { owner: 'user', name: 'repo', fullName: 'user/repo', branch: 'main' };
      mockFetch.mockResolvedValueOnce(jsonResponse({}, true, 200)); // PATCH

      await act(async () => {
        await result.current.setSessionRepo('s1', repo);
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/code-lab/sessions/s1',
        expect.objectContaining({
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ repo }),
        })
      );

      const updated = result.current.sessions.find((s) => s.id === 's1');
      expect(updated?.repo).toEqual(repo);
      expect(mockToast.success).toHaveBeenCalledWith(
        'Repository Connected',
        'Connected to user/repo'
      );
    });

    it('shows info toast when repo is cleared (set to undefined)', async () => {
      const s1 = makeSession({
        id: 's1',
        title: 'Clear Repo',
        repo: { owner: 'user', name: 'repo', fullName: 'user/repo', branch: 'main' },
      });

      mockFetch.mockReset();
      mockFetch
        .mockResolvedValueOnce(jsonResponse({ sessions: [s1] })) // GET
        .mockResolvedValueOnce(jsonResponse({ session: s1 })); // auto-create

      const { result } = renderHook(() => useSessionManager());

      await waitFor(() => {
        expect(result.current.sessions.some((s) => s.id === 's1')).toBe(true);
      });

      mockFetch.mockResolvedValueOnce(jsonResponse({}, true, 200)); // PATCH

      await act(async () => {
        await result.current.setSessionRepo('s1', undefined);
      });

      expect(mockToast.info).toHaveBeenCalledWith(
        'Repository Cleared',
        'Repository disconnected from session'
      );
    });

    it('shows error toast when PATCH returns a non-ok response', async () => {
      const s1 = makeSession({ id: 's1', title: 'Fail Repo' });

      mockFetch.mockReset();
      mockFetch
        .mockResolvedValueOnce(jsonResponse({ sessions: [s1] })) // GET
        .mockResolvedValueOnce(jsonResponse({ session: s1 })); // auto-create

      const { result } = renderHook(() => useSessionManager());

      await waitFor(() => {
        expect(result.current.sessions.some((s) => s.id === 's1')).toBe(true);
      });

      const repo = { owner: 'user', name: 'repo', fullName: 'user/repo', branch: 'main' };
      mockFetch.mockResolvedValueOnce(jsonResponse({ error: 'Repo not found' }, false, 404));

      await act(async () => {
        await result.current.setSessionRepo('s1', repo);
      });

      expect(mockToast.error).toHaveBeenCalledWith('Repository Error', 'Repo not found');

      // State should NOT be updated
      const session = result.current.sessions.find((s) => s.id === 's1');
      expect(session?.repo).toBeUndefined();
    });

    it('shows generic error toast when fetch throws', async () => {
      const s1 = makeSession({ id: 's1', title: 'Network Fail' });

      mockFetch.mockReset();
      mockFetch
        .mockResolvedValueOnce(jsonResponse({ sessions: [s1] })) // GET
        .mockResolvedValueOnce(jsonResponse({ session: s1 })); // auto-create

      const { result } = renderHook(() => useSessionManager());

      await waitFor(() => {
        expect(result.current.sessions.some((s) => s.id === 's1')).toBe(true);
      });

      const repo = { owner: 'user', name: 'repo', fullName: 'user/repo', branch: 'main' };
      mockFetch.mockRejectedValueOnce(new Error('Network down'));

      await act(async () => {
        await result.current.setSessionRepo('s1', repo);
      });

      expect(mockToast.error).toHaveBeenCalledWith(
        'Connection Error',
        'Failed to connect repository. Please try again.'
      );
    });
  });

  // -----------------------------------------------------------------------
  // 9. Error handling
  // -----------------------------------------------------------------------
  describe('error handling', () => {
    it('sets error state and calls toast.error when createSession fetch fails', async () => {
      const { result } = renderHook(() => useSessionManager());

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });

      mockFetch.mockRejectedValueOnce(new Error('Server down'));

      await act(async () => {
        await result.current.createSession('Will Fail');
      });

      // The error effect fires toast.error and then auto-clears after 100ms
      expect(mockToast.error).toHaveBeenCalledWith('Error', 'Failed to create session');
    });

    it('auto-clears error after delay', async () => {
      const { result } = renderHook(() => useSessionManager());

      // Wait for mount effects to settle (requires real timers)
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });

      // Switch to fake timers AFTER mount effects have settled
      vi.useFakeTimers();

      // Manually set error to test auto-clear
      act(() => {
        result.current.setError('test error');
      });

      expect(result.current.error).toBe('test error');
      expect(mockToast.error).toHaveBeenCalledWith('Error', 'test error');

      // Fast-forward past the auto-clear delay (100ms)
      act(() => {
        vi.advanceTimersByTime(150);
      });

      expect(result.current.error).toBeNull();

      vi.useRealTimers();
    });

    it('calls toast.error when deleteSession throws (non-ok response)', async () => {
      const { result } = renderHook(() => useSessionManager());

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });

      mockFetch.mockResolvedValueOnce(jsonResponse({}, false, 500));

      await act(async () => {
        await result.current.deleteSession('bad-id');
      });

      expect(mockToast.error).toHaveBeenCalledWith('Delete Failed', 'Failed to delete session');
    });
  });

  // -----------------------------------------------------------------------
  // 10. Race condition protection
  // -----------------------------------------------------------------------
  describe('race condition protection', () => {
    it('ignores stale selectSession responses when called rapidly', async () => {
      const { result } = renderHook(() => useSessionManager());

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });

      // Create controlled promises so we can resolve them in specific order
      let resolveFirst!: (value: Response) => void;
      let resolveSecond!: (value: Response) => void;

      const firstPromise = new Promise<Response>((res) => {
        resolveFirst = res;
      });
      const secondPromise = new Promise<Response>((res) => {
        resolveSecond = res;
      });

      mockFetch.mockReturnValueOnce(firstPromise).mockReturnValueOnce(secondPromise);

      // Call selectSession twice rapidly — the second call should supersede the first
      let firstSelectPromise: Promise<void>;
      let secondSelectPromise: Promise<void>;

      act(() => {
        firstSelectPromise = result.current.selectSession('session-A');
      });

      act(() => {
        secondSelectPromise = result.current.selectSession('session-B');
      });

      // The currentSessionId should be 'session-B' (the last call wins)
      expect(result.current.currentSessionId).toBe('session-B');

      // Resolve the SECOND request first
      const msgB = [makeMessage({ id: 'b1', content: 'From B', sessionId: 'session-B' })];
      await act(async () => {
        resolveSecond(jsonResponse({ messages: msgB }));
        await secondSelectPromise;
      });

      expect(result.current.messages).toEqual(msgB);
      expect(result.current.isLoading).toBe(false);

      // Now resolve the FIRST request (stale) — it should be ignored
      const msgA = [makeMessage({ id: 'a1', content: 'From A (stale)', sessionId: 'session-A' })];
      await act(async () => {
        resolveFirst(jsonResponse({ messages: msgA }));
        await firstSelectPromise;
      });

      // Messages should still be from session B, not overwritten by stale session A response
      expect(result.current.messages).toEqual(msgB);
      expect(result.current.currentSessionId).toBe('session-B');
    });

    it('does not set isLoading to false when a stale response arrives', async () => {
      const { result } = renderHook(() => useSessionManager());

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });

      let resolveFirst!: (value: Response) => void;
      let resolveSecond!: (value: Response) => void;

      const firstPromise = new Promise<Response>((res) => {
        resolveFirst = res;
      });
      const secondPromise = new Promise<Response>((res) => {
        resolveSecond = res;
      });

      mockFetch.mockReturnValueOnce(firstPromise).mockReturnValueOnce(secondPromise);

      let firstSelectPromise: Promise<void>;

      act(() => {
        firstSelectPromise = result.current.selectSession('stale-session');
      });
      act(() => {
        result.current.selectSession('current-session');
      });

      // isLoading should be true (second request is pending)
      expect(result.current.isLoading).toBe(true);

      // Resolve the stale first request
      await act(async () => {
        resolveFirst(jsonResponse({ messages: [] }));
        await firstSelectPromise;
      });

      // isLoading should STILL be true because the stale response's finally block
      // should not flip isLoading off
      expect(result.current.isLoading).toBe(true);

      // Resolve the current second request
      await act(async () => {
        resolveSecond(jsonResponse({ messages: [] }));
      });

      expect(result.current.isLoading).toBe(false);
    });
  });
});
