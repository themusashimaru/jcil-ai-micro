/**
 * Tests for usePairProgramming hook
 *
 * Covers: initial state, setMode, addSuggestion, acceptSuggestion,
 * rejectSuggestion, dismissSuggestion, clearSuggestions,
 * acceptGhostText, rejectGhostText, recordBugPrevented,
 * onCodeEdit (mode gating + debounce), onFileOpen (mode gating),
 * getCompletion (mode gating + API call).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePairProgramming } from './usePairProgramming';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
global.fetch = mockFetch;

vi.mock('./CodeLabPairProgramming', () => ({
  // Types are just used for type annotations, no runtime mock needed
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSuggestion(overrides: Record<string, unknown> = {}) {
  return {
    type: 'refactor' as const,
    title: 'Extract function',
    description: 'This block should be extracted into a helper',
    priority: 'medium' as const,
    confidence: 0.85,
    ...overrides,
  };
}

function makeBugSuggestion(overrides: Record<string, unknown> = {}) {
  return makeSuggestion({ type: 'bug' as const, title: 'Null pointer risk', ...overrides });
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.useFakeTimers();
  mockFetch.mockReset();
  // Default successful fetch response with no suggestions
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ suggestions: [], completion: null }),
  });
});

afterEach(() => {
  vi.useRealTimers();
});

// ===========================================================================
// Tests
// ===========================================================================

describe('usePairProgramming', () => {
  // -----------------------------------------------------------------------
  // 1. Initial state
  // -----------------------------------------------------------------------
  describe('initial state', () => {
    it('has mode set to active', () => {
      const { result } = renderHook(() => usePairProgramming());
      expect(result.current.mode).toBe('active');
    });

    it('has empty suggestions array', () => {
      const { result } = renderHook(() => usePairProgramming());
      expect(result.current.suggestions).toEqual([]);
    });

    it('has ghostText as null', () => {
      const { result } = renderHook(() => usePairProgramming());
      expect(result.current.ghostText).toBeNull();
    });

    it('has isAnalyzing as false', () => {
      const { result } = renderHook(() => usePairProgramming());
      expect(result.current.isAnalyzing).toBe(false);
    });

    it('has error as null', () => {
      const { result } = renderHook(() => usePairProgramming());
      expect(result.current.error).toBeNull();
    });

    it('has a session with id and startTime', () => {
      const { result } = renderHook(() => usePairProgramming());
      expect(result.current.session.id).toMatch(/^session-/);
      expect(result.current.session.startTime).toBeInstanceOf(Date);
    });

    it('has all session counters at 0', () => {
      const { result } = renderHook(() => usePairProgramming());
      const { session } = result.current;
      expect(session.suggestionsShown).toBe(0);
      expect(session.suggestionsAccepted).toBe(0);
      expect(session.suggestionsRejected).toBe(0);
      expect(session.codeWritten).toBe(0);
      expect(session.bugsDetected).toBe(0);
      expect(session.bugsPrevented).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // 2. setMode
  // -----------------------------------------------------------------------
  describe('setMode', () => {
    it('changes mode to passive', () => {
      const { result } = renderHook(() => usePairProgramming());
      act(() => {
        result.current.setMode('passive');
      });
      expect(result.current.mode).toBe('passive');
    });

    it('changes mode to off', () => {
      const { result } = renderHook(() => usePairProgramming());
      act(() => {
        result.current.setMode('off');
      });
      expect(result.current.mode).toBe('off');
    });

    it('changes mode back to active', () => {
      const { result } = renderHook(() => usePairProgramming());
      act(() => {
        result.current.setMode('off');
      });
      act(() => {
        result.current.setMode('active');
      });
      expect(result.current.mode).toBe('active');
    });
  });

  // -----------------------------------------------------------------------
  // 3. addSuggestion
  // -----------------------------------------------------------------------
  describe('addSuggestion', () => {
    it('adds a suggestion to the list', () => {
      const { result } = renderHook(() => usePairProgramming());
      act(() => {
        result.current.addSuggestion(makeSuggestion());
      });
      expect(result.current.suggestions).toHaveLength(1);
      expect(result.current.suggestions[0].title).toBe('Extract function');
    });

    it('assigns an id and timestamp to the suggestion', () => {
      const { result } = renderHook(() => usePairProgramming());
      act(() => {
        result.current.addSuggestion(makeSuggestion());
      });
      expect(result.current.suggestions[0].id).toMatch(/^suggestion-/);
      expect(result.current.suggestions[0].timestamp).toBeInstanceOf(Date);
    });

    it('increments suggestionsShown', () => {
      const { result } = renderHook(() => usePairProgramming());
      act(() => {
        result.current.addSuggestion(makeSuggestion());
      });
      expect(result.current.session.suggestionsShown).toBe(1);
    });

    it('increments suggestionsShown for each addition', () => {
      const { result } = renderHook(() => usePairProgramming());
      act(() => {
        result.current.addSuggestion(makeSuggestion());
      });
      act(() => {
        result.current.addSuggestion(makeSuggestion({ title: 'Second' }));
      });
      expect(result.current.suggestions).toHaveLength(2);
      expect(result.current.session.suggestionsShown).toBe(2);
    });

    it('returns the generated suggestion id', () => {
      const { result } = renderHook(() => usePairProgramming());
      let id: string | undefined;
      act(() => {
        id = result.current.addSuggestion(makeSuggestion());
      });
      expect(id).toMatch(/^suggestion-/);
    });
  });

  // -----------------------------------------------------------------------
  // 4. acceptSuggestion
  // -----------------------------------------------------------------------
  describe('acceptSuggestion', () => {
    it('removes the suggestion from the list', () => {
      const { result } = renderHook(() => usePairProgramming());
      let id: string | undefined;
      act(() => {
        id = result.current.addSuggestion(makeSuggestion());
      });
      act(() => {
        result.current.acceptSuggestion(id!);
      });
      expect(result.current.suggestions).toHaveLength(0);
    });

    it('increments suggestionsAccepted', () => {
      const { result } = renderHook(() => usePairProgramming());
      let id: string | undefined;
      act(() => {
        id = result.current.addSuggestion(makeSuggestion());
      });
      act(() => {
        result.current.acceptSuggestion(id!);
      });
      expect(result.current.session.suggestionsAccepted).toBe(1);
    });

    it('increments bugsPrevented when suggestion type is bug', () => {
      const { result } = renderHook(() => usePairProgramming());
      let id: string | undefined;
      act(() => {
        id = result.current.addSuggestion(makeBugSuggestion());
      });
      act(() => {
        result.current.acceptSuggestion(id!);
      });
      expect(result.current.session.bugsPrevented).toBe(1);
    });

    it('does NOT increment bugsPrevented for non-bug suggestions', () => {
      const { result } = renderHook(() => usePairProgramming());
      let id: string | undefined;
      act(() => {
        id = result.current.addSuggestion(makeSuggestion({ type: 'refactor' }));
      });
      act(() => {
        result.current.acceptSuggestion(id!);
      });
      expect(result.current.session.bugsPrevented).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // 5. rejectSuggestion
  // -----------------------------------------------------------------------
  describe('rejectSuggestion', () => {
    it('removes the suggestion from the list', () => {
      const { result } = renderHook(() => usePairProgramming());
      let id: string | undefined;
      act(() => {
        id = result.current.addSuggestion(makeSuggestion());
      });
      act(() => {
        result.current.rejectSuggestion(id!);
      });
      expect(result.current.suggestions).toHaveLength(0);
    });

    it('increments suggestionsRejected', () => {
      const { result } = renderHook(() => usePairProgramming());
      let id: string | undefined;
      act(() => {
        id = result.current.addSuggestion(makeSuggestion());
      });
      act(() => {
        result.current.rejectSuggestion(id!);
      });
      expect(result.current.session.suggestionsRejected).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // 6. dismissSuggestion
  // -----------------------------------------------------------------------
  describe('dismissSuggestion', () => {
    it('removes the suggestion from the list', () => {
      const { result } = renderHook(() => usePairProgramming());
      let id: string | undefined;
      act(() => {
        id = result.current.addSuggestion(makeSuggestion());
      });
      act(() => {
        result.current.dismissSuggestion(id!);
      });
      expect(result.current.suggestions).toHaveLength(0);
    });

    it('does NOT change any session counters', () => {
      const { result } = renderHook(() => usePairProgramming());
      let id: string | undefined;
      act(() => {
        id = result.current.addSuggestion(makeSuggestion());
      });
      const shownBefore = result.current.session.suggestionsShown;
      const acceptedBefore = result.current.session.suggestionsAccepted;
      const rejectedBefore = result.current.session.suggestionsRejected;
      act(() => {
        result.current.dismissSuggestion(id!);
      });
      expect(result.current.session.suggestionsShown).toBe(shownBefore);
      expect(result.current.session.suggestionsAccepted).toBe(acceptedBefore);
      expect(result.current.session.suggestionsRejected).toBe(rejectedBefore);
    });
  });

  // -----------------------------------------------------------------------
  // 7. clearSuggestions
  // -----------------------------------------------------------------------
  describe('clearSuggestions', () => {
    it('empties the suggestions array', () => {
      const { result } = renderHook(() => usePairProgramming());
      act(() => {
        result.current.addSuggestion(makeSuggestion());
        result.current.addSuggestion(makeSuggestion({ title: 'Second' }));
      });
      expect(result.current.suggestions).toHaveLength(2);
      act(() => {
        result.current.clearSuggestions();
      });
      expect(result.current.suggestions).toHaveLength(0);
    });

    it('works when suggestions are already empty', () => {
      const { result } = renderHook(() => usePairProgramming());
      act(() => {
        result.current.clearSuggestions();
      });
      expect(result.current.suggestions).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // 8. acceptGhostText
  // -----------------------------------------------------------------------
  describe('acceptGhostText', () => {
    it('sets ghostText to null', () => {
      const { result } = renderHook(() => usePairProgramming());

      // Manually set ghost text via getCompletion mock
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ completion: 'const x = 42;' }),
      });

      // We use acceptGhostText even if ghostText is already null; it should still work
      act(() => {
        result.current.acceptGhostText();
      });
      expect(result.current.ghostText).toBeNull();
    });

    it('increments codeWritten', () => {
      const { result } = renderHook(() => usePairProgramming());
      act(() => {
        result.current.acceptGhostText();
      });
      expect(result.current.session.codeWritten).toBe(1);
    });

    it('increments codeWritten cumulatively', () => {
      const { result } = renderHook(() => usePairProgramming());
      act(() => {
        result.current.acceptGhostText();
      });
      act(() => {
        result.current.acceptGhostText();
      });
      expect(result.current.session.codeWritten).toBe(2);
    });
  });

  // -----------------------------------------------------------------------
  // 9. rejectGhostText
  // -----------------------------------------------------------------------
  describe('rejectGhostText', () => {
    it('sets ghostText to null', () => {
      const { result } = renderHook(() => usePairProgramming());
      act(() => {
        result.current.rejectGhostText();
      });
      expect(result.current.ghostText).toBeNull();
    });

    it('does NOT increment codeWritten', () => {
      const { result } = renderHook(() => usePairProgramming());
      act(() => {
        result.current.rejectGhostText();
      });
      expect(result.current.session.codeWritten).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // 10. recordBugPrevented
  // -----------------------------------------------------------------------
  describe('recordBugPrevented', () => {
    it('increments bugsPrevented', () => {
      const { result } = renderHook(() => usePairProgramming());
      act(() => {
        result.current.recordBugPrevented();
      });
      expect(result.current.session.bugsPrevented).toBe(1);
    });

    it('increments bugsPrevented cumulatively', () => {
      const { result } = renderHook(() => usePairProgramming());
      act(() => {
        result.current.recordBugPrevented();
      });
      act(() => {
        result.current.recordBugPrevented();
      });
      act(() => {
        result.current.recordBugPrevented();
      });
      expect(result.current.session.bugsPrevented).toBe(3);
    });
  });

  // -----------------------------------------------------------------------
  // 11. onCodeEdit — mode gating
  // -----------------------------------------------------------------------
  describe('onCodeEdit', () => {
    it('skips when mode is passive', async () => {
      const { result } = renderHook(() => usePairProgramming());
      act(() => {
        result.current.setMode('passive');
      });
      await act(async () => {
        result.current.onCodeEdit('file.ts', 'const x = 1;', 'const x = ', 0, 10);
      });
      // Advance past the debounce
      await act(async () => {
        vi.advanceTimersByTime(600);
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('skips when mode is off', async () => {
      const { result } = renderHook(() => usePairProgramming());
      act(() => {
        result.current.setMode('off');
      });
      await act(async () => {
        result.current.onCodeEdit('file.ts', 'const x = 1;', 'const x = ', 0, 10);
      });
      await act(async () => {
        vi.advanceTimersByTime(600);
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('calls the API after debounce when mode is active', async () => {
      const { result } = renderHook(() => usePairProgramming());
      await act(async () => {
        result.current.onCodeEdit('file.ts', 'const x = 1;', 'const x = ', 0, 10);
      });
      // Before debounce fires, no fetch
      expect(mockFetch).not.toHaveBeenCalled();
      // Advance past the 500ms debounce
      await act(async () => {
        vi.advanceTimersByTime(500);
      });
      // Allow promise microtask to resolve
      await act(async () => {
        await vi.runAllTimersAsync();
      });
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/code-lab/pair-programming',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });

  // -----------------------------------------------------------------------
  // 12. onFileOpen — mode gating
  // -----------------------------------------------------------------------
  describe('onFileOpen', () => {
    it('skips when mode is off', async () => {
      const { result } = renderHook(() => usePairProgramming());
      act(() => {
        result.current.setMode('off');
      });
      await act(async () => {
        await result.current.onFileOpen('file.ts', 'const x = 1;');
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('calls API when mode is active', async () => {
      const { result } = renderHook(() => usePairProgramming());
      await act(async () => {
        await result.current.onFileOpen('file.ts', 'const x = 1;');
      });
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/code-lab/pair-programming',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"action":"open"'),
        })
      );
    });

    it('calls API when mode is passive', async () => {
      const { result } = renderHook(() => usePairProgramming());
      act(() => {
        result.current.setMode('passive');
      });
      await act(async () => {
        await result.current.onFileOpen('file.ts', 'const x = 1;');
      });
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/code-lab/pair-programming',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });
  });

  // -----------------------------------------------------------------------
  // 13. getCompletion — mode gating
  // -----------------------------------------------------------------------
  describe('getCompletion', () => {
    it('returns null when mode is passive', async () => {
      const { result } = renderHook(() => usePairProgramming());
      act(() => {
        result.current.setMode('passive');
      });
      let completion: string | null = 'not-null';
      await act(async () => {
        completion = await result.current.getCompletion('file.ts', 'const x = ', 0, 10);
      });
      expect(completion).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('returns null when mode is off', async () => {
      const { result } = renderHook(() => usePairProgramming());
      act(() => {
        result.current.setMode('off');
      });
      let completion: string | null = 'not-null';
      await act(async () => {
        completion = await result.current.getCompletion('file.ts', 'const x = ', 0, 10);
      });
      expect(completion).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('calls API and returns completion when mode is active', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ completion: '42;' }),
      });
      const { result } = renderHook(() => usePairProgramming());
      let completion: string | null = null;
      await act(async () => {
        completion = await result.current.getCompletion('file.ts', 'const x = ', 0, 10);
      });
      expect(completion).toBe('42;');
      expect(result.current.ghostText).toBe('42;');
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/code-lab/pair-programming',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"action":"complete"'),
        })
      );
    });

    it('sets ghostText to null when API returns no completion', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ completion: null }),
      });
      const { result } = renderHook(() => usePairProgramming());
      await act(async () => {
        await result.current.getCompletion('file.ts', 'const x = ', 0, 10);
      });
      expect(result.current.ghostText).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // 14. API error handling
  // -----------------------------------------------------------------------
  describe('error handling', () => {
    it('sets error when fetch fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      const { result } = renderHook(() => usePairProgramming());
      await act(async () => {
        await result.current.onFileOpen('file.ts', 'content');
      });
      expect(result.current.error).toBe('Network error');
    });

    it('sets error when response is not ok', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Server error' }),
      });
      const { result } = renderHook(() => usePairProgramming());
      await act(async () => {
        await result.current.onFileOpen('file.ts', 'content');
      });
      expect(result.current.error).toBe('Server error');
    });
  });
});
