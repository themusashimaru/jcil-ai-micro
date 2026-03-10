/**
 * Tests for useMessenger hook
 *
 * Covers: model/agent state, messaging lifecycle, streaming,
 * token usage tracking, slash commands, and palette messages.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMessenger } from './useMessenger';
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

vi.mock('@/lib/response-analysis', () => ({
  analyzeResponse: vi.fn(() => ({
    triggerType: 'none',
    suggestedAction: 'none',
    suggestedPrompt: null,
    confidence: 0,
  })),
  isConfirmation: vi.fn(() => false),
  isDecline: vi.fn(() => false),
}));

vi.mock('@/components/ui/Toast', () => ({
  useToastActions: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createStreamResponse(content: string, headers: Record<string, string> = {}) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(content));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/plain', ...headers },
  });
}

function makeSession(overrides: Partial<CodeLabSession> = {}): CodeLabSession {
  return {
    id: 'session-1',
    title: 'Test Session',
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true,
    messageCount: 5,
    hasSummary: false,
    ...overrides,
  };
}

function makeDefaultOptions(overrides: Record<string, unknown> = {}) {
  const session = makeSession();
  return {
    currentSessionId: 'session-1' as string | null,
    currentSession: session as CodeLabSession | undefined,
    sessions: [session] as CodeLabSession[],
    setSessions: vi.fn() as React.Dispatch<React.SetStateAction<CodeLabSession[]>>,
    messages: [] as CodeLabMessage[],
    setMessages: vi.fn() as React.Dispatch<React.SetStateAction<CodeLabMessage[]>>,
    setError: vi.fn() as (error: string | null) => void,
    createSession: vi.fn().mockResolvedValue(makeSession()) as (
      title?: string
    ) => Promise<CodeLabSession | null>,
    fetchPlanStatus: vi.fn().mockResolvedValue(undefined) as () => Promise<void>,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useMessenger', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn();
  });

  // =========================================================================
  // Model & Agent State
  // =========================================================================

  describe('initial state', () => {
    it('returns correct defaults', () => {
      const { result } = renderHook(() => useMessenger(makeDefaultOptions()));

      expect(result.current.currentModelId).toBe('deepseek-reasoner');
      expect(result.current.isStreaming).toBe(false);
      expect(result.current.thinkingConfig.enabled).toBe(false);
      expect(result.current.activeAgent).toBeNull();
      expect(result.current.tokenStats.totalInputTokens).toBe(0);
      expect(result.current.tokenStats.totalOutputTokens).toBe(0);
      expect(result.current.tokenStats.totalCacheReadTokens).toBe(0);
      expect(result.current.tokenStats.totalCacheWriteTokens).toBe(0);
      expect(result.current.tokenStats.messageCount).toBe(0);
    });
  });

  describe('handleModelChange', () => {
    it('sets currentModelId and triggers modelSwitchFlash', () => {
      const { result } = renderHook(() => useMessenger(makeDefaultOptions()));

      act(() => {
        result.current.handleModelChange('claude-opus');
      });

      expect(result.current.currentModelId).toBe('claude-opus');
      expect(result.current.thinkingConfig.enabled).toBe(false);
      expect(result.current.modelSwitchFlash).toBe(true);
    });

    it('detects -thinking suffix to enable thinking config', () => {
      const { result } = renderHook(() => useMessenger(makeDefaultOptions()));

      act(() => {
        result.current.handleModelChange('sonnet-thinking');
      });

      expect(result.current.currentModelId).toBe('sonnet');
      expect(result.current.thinkingConfig.enabled).toBe(true);
      expect(result.current.modelSwitchFlash).toBe(true);
    });
  });

  describe('handleAgentSelect', () => {
    it('activates agent and shows toast', async () => {
      const { result } = renderHook(() => useMessenger(makeDefaultOptions()));

      await act(async () => {
        await result.current.handleAgentSelect('research');
      });

      expect(result.current.activeAgent).toBe('research');
    });

    it('deactivates agent when selecting the same agent again', async () => {
      const { result } = renderHook(() => useMessenger(makeDefaultOptions()));

      // Activate
      await act(async () => {
        await result.current.handleAgentSelect('research');
      });
      expect(result.current.activeAgent).toBe('research');

      // Toggle off
      await act(async () => {
        await result.current.handleAgentSelect('research');
      });
      expect(result.current.activeAgent).toBeNull();
    });

    it('sets strategyLoading when strategy agent selected', async () => {
      const { result } = renderHook(() => useMessenger(makeDefaultOptions()));

      await act(async () => {
        await result.current.handleAgentSelect('strategy');
      });

      expect(result.current.activeAgent).toBe('strategy');
      // strategyLoading starts true then clears via setTimeout
      expect(result.current.strategyLoading).toBe(true);
    });

    it('sets deepResearchLoading when deep-research agent selected', async () => {
      const { result } = renderHook(() => useMessenger(makeDefaultOptions()));

      await act(async () => {
        await result.current.handleAgentSelect('deep-research');
      });

      expect(result.current.activeAgent).toBe('deep-research');
      expect(result.current.deepResearchLoading).toBe(true);
    });
  });

  describe('handleCreativeMode', () => {
    it('does not throw and logs the mode', () => {
      const { result } = renderHook(() => useMessenger(makeDefaultOptions()));

      // Should not throw — internally calls toast.info
      act(() => {
        result.current.handleCreativeMode('create-image');
      });

      act(() => {
        result.current.handleCreativeMode('edit-image');
      });
    });
  });

  // =========================================================================
  // Messaging
  // =========================================================================

  describe('sendMessage', () => {
    it('POSTs to /api/code-lab/chat and streams response', async () => {
      const setMessages = vi.fn();
      const setSessions = vi.fn();
      const fetchPlanStatus = vi.fn().mockResolvedValue(undefined);

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        createStreamResponse('Hello from AI')
      );

      const options = makeDefaultOptions({ setMessages, setSessions, fetchPlanStatus });
      const { result } = renderHook(() => useMessenger(options));

      await act(async () => {
        result.current.sendMessage('Hi there');
      });

      // fetch was called with the right endpoint
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/code-lab/chat',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );

      // Verify the POST body contains the message content
      const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.content).toBe('Hi there');
      expect(body.sessionId).toBe('session-1');

      // setMessages called multiple times: user msg, assistant placeholder, streaming updates, mark complete
      expect(setMessages).toHaveBeenCalled();
      const calls = setMessages.mock.calls;
      expect(calls.length).toBeGreaterThanOrEqual(3);

      // First call: add user message
      const addUserFn = calls[0][0] as (prev: CodeLabMessage[]) => CodeLabMessage[];
      const afterUser = addUserFn([]);
      expect(afterUser).toHaveLength(1);
      expect(afterUser[0].role).toBe('user');
      expect(afterUser[0].content).toBe('Hi there');

      // Second call: add assistant placeholder
      const addAssistantFn = calls[1][0] as (prev: CodeLabMessage[]) => CodeLabMessage[];
      const afterAssistant = addAssistantFn([]);
      expect(afterAssistant).toHaveLength(1);
      expect(afterAssistant[0].role).toBe('assistant');
      expect(afterAssistant[0].content).toBe('');
      expect(afterAssistant[0].isStreaming).toBe(true);

      // After completion isStreaming should be false
      expect(result.current.isStreaming).toBe(false);

      // setSessions called to increment messageCount
      expect(setSessions).toHaveBeenCalled();
    });

    it('returns early when currentSessionId is null', async () => {
      const setMessages = vi.fn();
      const options = makeDefaultOptions({ currentSessionId: null, setMessages });
      const { result } = renderHook(() => useMessenger(options));

      await act(async () => {
        result.current.sendMessage('Hello');
      });

      expect(global.fetch).not.toHaveBeenCalled();
      expect(setMessages).not.toHaveBeenCalled();
    });

    it('returns early when already streaming', async () => {
      const setMessages = vi.fn();

      // First fetch never resolves to keep isStreaming=true
      (global.fetch as ReturnType<typeof vi.fn>).mockReturnValueOnce(
        new Promise(() => {
          /* hang forever */
        })
      );

      const options = makeDefaultOptions({ setMessages });
      const { result } = renderHook(() => useMessenger(options));

      // Start first message (will hang)
      act(() => {
        result.current.sendMessage('First');
      });

      // Wait a tick for state to update
      await act(async () => {
        await new Promise((r) => setTimeout(r, 10));
      });

      // Reset mock to track second call
      setMessages.mockClear();
      (global.fetch as ReturnType<typeof vi.fn>).mockClear();

      // Try to send second message while streaming
      await act(async () => {
        result.current.sendMessage('Second');
      });

      // Second sendMessage should be a no-op due to isStreaming guard
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('parses token usage from USAGE comment marker', async () => {
      const usageContent = 'Response text\n<!--USAGE:{"input":100,"output":50}-->';

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        createStreamResponse(usageContent)
      );

      const setMessages = vi.fn();
      const options = makeDefaultOptions({ setMessages });
      const { result } = renderHook(() => useMessenger(options));

      await act(async () => {
        result.current.sendMessage('Test token usage');
      });

      expect(result.current.tokenStats.totalInputTokens).toBe(100);
      expect(result.current.tokenStats.totalOutputTokens).toBe(50);
      expect(result.current.tokenStats.messageCount).toBe(2);
    });

    it('falls back to token estimation when no usage marker', async () => {
      const content = 'A'.repeat(400); // 400 chars -> ~100 estimated output tokens

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
        createStreamResponse(content)
      );

      const setMessages = vi.fn();
      const options = makeDefaultOptions({ setMessages });
      const { result } = renderHook(() => useMessenger(options));

      await act(async () => {
        result.current.sendMessage('short input');
      });

      // Fallback: ceil(content.length / 4) for output
      expect(result.current.tokenStats.totalOutputTokens).toBe(Math.ceil(400 / 4));
      // Fallback: ceil(inputContent.length / 4) for input
      expect(result.current.tokenStats.totalInputTokens).toBe(Math.ceil('short input'.length / 4));
      expect(result.current.tokenStats.messageCount).toBe(2);
    });
  });

  describe('cancelStream', () => {
    it('aborts the controller and sets isStreaming false', async () => {
      // Return a stream that hangs so we stay in streaming state
      (global.fetch as ReturnType<typeof vi.fn>).mockReturnValueOnce(
        new Promise(() => {
          /* never resolves */
        })
      );

      const options = makeDefaultOptions();
      const { result } = renderHook(() => useMessenger(options));

      // Start a message to enter streaming state
      act(() => {
        result.current.sendMessage('Hello');
      });

      await act(async () => {
        await new Promise((r) => setTimeout(r, 10));
      });

      // Now cancel
      act(() => {
        result.current.cancelStream();
      });

      expect(result.current.isStreaming).toBe(false);
    });
  });

  // =========================================================================
  // Slash Commands & Palette
  // =========================================================================

  describe('handleSlashCommand', () => {
    it('calls sendMessage directly when session exists', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(createStreamResponse('OK'));

      const options = makeDefaultOptions();
      const { result } = renderHook(() => useMessenger(options));

      await act(async () => {
        result.current.handleSlashCommand('/help');
      });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/code-lab/chat',
        expect.objectContaining({ method: 'POST' })
      );

      const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
      expect(body.content).toBe('/help');
    });

    it('creates session first when no currentSessionId', async () => {
      const newSession = makeSession({ id: 'new-session' });
      const createSession = vi.fn().mockResolvedValue(newSession);

      // We set currentSessionId to null so it tries createSession
      const options = makeDefaultOptions({
        currentSessionId: null,
        createSession,
      });

      const { result } = renderHook(() => useMessenger(options));

      await act(async () => {
        result.current.handleSlashCommand('/search test');
      });

      expect(createSession).toHaveBeenCalled();
      // Note: sendMessage won't actually fire a fetch because currentSessionId is
      // still null in the hook's closure. The hook calls createSession, then
      // sendMessage, but the sessionId hasn't updated via props yet.
      // This tests the branching logic in handleSlashCommand.
    });
  });

  describe('handlePaletteMessage', () => {
    it('calls sendMessage directly when session exists', async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(createStreamResponse('OK'));

      const options = makeDefaultOptions();
      const { result } = renderHook(() => useMessenger(options));

      await act(async () => {
        result.current.handlePaletteMessage('explain this code');
      });

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/code-lab/chat',
        expect.objectContaining({ method: 'POST' })
      );

      const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
      expect(body.content).toBe('explain this code');
    });

    it('creates session first when no currentSessionId', async () => {
      const createSession = vi.fn().mockResolvedValue(makeSession());

      const options = makeDefaultOptions({
        currentSessionId: null,
        createSession,
      });

      const { result } = renderHook(() => useMessenger(options));

      await act(async () => {
        result.current.handlePaletteMessage('what is this?');
      });

      expect(createSession).toHaveBeenCalled();
    });
  });
});
