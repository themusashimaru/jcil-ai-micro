// @ts-nocheck - Test file with extensive mocking
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Comprehensive tests for useDeepStrategy hook
 *
 * Tests cover:
 * - Initial state
 * - Session persistence (save/load/clear)
 * - startStrategy (streaming, attachments, errors)
 * - sendIntakeInput (phase gating, responses, auto-execute)
 * - executeStrategy (streaming, progress, completion, errors, kill switch)
 * - cancelStrategy
 * - addContext (phase gating, error propagation)
 * - reconnect (all server states)
 * - reset
 * - Edge cases: empty inputs, missing fields, network failures
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('@/agents/strategy', () => ({
  StrategyStreamEvent: {},
  StrategyOutput: {},
}));

vi.mock('@/components/chat/DeepStrategy', () => ({
  StrategyAttachment: {},
}));

import { useDeepStrategy } from './useDeepStrategy';
import type { StrategyPhase } from './useDeepStrategy';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a ReadableStream that yields encoded SSE lines then closes. */
function makeStream(lines: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const payload = encoder.encode(lines.join('\n') + '\n');
  let consumed = false;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (!consumed) {
        controller.enqueue(payload);
        consumed = true;
      } else {
        controller.close();
      }
    },
  });
}

/** Create a fetch Response with a streaming body and optional headers. */
function streamResponse(
  lines: string[],
  headers: Record<string, string> = {},
  ok = true
): Response {
  const stream = makeStream(lines);
  return {
    ok,
    status: ok ? 200 : 500,
    headers: {
      get: (key: string) => headers[key] ?? null,
    },
    body: {
      getReader: () => stream.getReader(),
    },
    json: () => Promise.resolve({}),
  } as unknown as Response;
}

/** Create a plain JSON Response. */
function jsonResponse(data: any, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 400,
    json: () => Promise.resolve(data),
    headers: { get: () => null },
  } as unknown as Response;
}

/** localStorage spy helpers */
let storageStore: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => storageStore[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    storageStore[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete storageStore[key];
  }),
  clear: vi.fn(() => {
    storageStore = {};
  }),
};

beforeEach(() => {
  vi.clearAllMocks();
  storageStore = {};
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true,
  });
});

// ===========================================================================
// 1) INITIAL STATE
// ===========================================================================

describe('useDeepStrategy', () => {
  describe('initial state', () => {
    it('should have phase idle', () => {
      const { result } = renderHook(() => useDeepStrategy());
      expect(result.current.phase).toBe('idle');
    });

    it('should have null sessionId', () => {
      const { result } = renderHook(() => useDeepStrategy());
      expect(result.current.sessionId).toBeNull();
    });

    it('should have empty events array', () => {
      const { result } = renderHook(() => useDeepStrategy());
      expect(result.current.events).toEqual([]);
    });

    it('should have empty intakeMessages array', () => {
      const { result } = renderHook(() => useDeepStrategy());
      expect(result.current.intakeMessages).toEqual([]);
    });

    it('should have null result', () => {
      const { result } = renderHook(() => useDeepStrategy());
      expect(result.current.result).toBeNull();
    });

    it('should have null error', () => {
      const { result } = renderHook(() => useDeepStrategy());
      expect(result.current.error).toBeNull();
    });

    it('should not be loading', () => {
      const { result } = renderHook(() => useDeepStrategy());
      expect(result.current.isLoading).toBe(false);
    });

    it('should not be adding context', () => {
      const { result } = renderHook(() => useDeepStrategy());
      expect(result.current.isAddingContext).toBe(false);
    });

    it('should not be reconnecting', () => {
      const { result } = renderHook(() => useDeepStrategy());
      expect(result.current.isReconnecting).toBe(false);
    });

    it('should have default progress', () => {
      const { result } = renderHook(() => useDeepStrategy());
      expect(result.current.progress).toEqual({
        phase: 'idle',
        percent: 0,
        agentsComplete: 0,
        agentsTotal: 0,
        cost: 0,
        elapsed: 0,
      });
    });

    it('should expose all expected action functions', () => {
      const { result } = renderHook(() => useDeepStrategy());
      expect(typeof result.current.startStrategy).toBe('function');
      expect(typeof result.current.sendIntakeInput).toBe('function');
      expect(typeof result.current.executeStrategy).toBe('function');
      expect(typeof result.current.cancelStrategy).toBe('function');
      expect(typeof result.current.addContext).toBe('function');
      expect(typeof result.current.reconnect).toBe('function');
      expect(typeof result.current.reset).toBe('function');
    });
  });

  // =========================================================================
  // 2) RESET
  // =========================================================================

  describe('reset', () => {
    it('should reset all state to defaults', () => {
      const { result } = renderHook(() => useDeepStrategy());

      act(() => {
        result.current.reset();
      });

      expect(result.current.phase).toBe('idle');
      expect(result.current.sessionId).toBeNull();
      expect(result.current.events).toEqual([]);
      expect(result.current.intakeMessages).toEqual([]);
      expect(result.current.result).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isAddingContext).toBe(false);
      expect(result.current.isReconnecting).toBe(false);
    });

    it('should reset progress to defaults', () => {
      const { result } = renderHook(() => useDeepStrategy());

      act(() => {
        result.current.reset();
      });

      expect(result.current.progress).toEqual({
        phase: 'idle',
        percent: 0,
        agentsComplete: 0,
        agentsTotal: 0,
        cost: 0,
        elapsed: 0,
      });
    });

    it('should clear persisted session from localStorage', () => {
      const { result } = renderHook(() => useDeepStrategy());

      act(() => {
        result.current.reset();
      });

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('deep-strategy-session');
    });
  });

  // =========================================================================
  // 3) START STRATEGY
  // =========================================================================

  describe('startStrategy', () => {
    it('should transition phase to intake on success', async () => {
      const resp = streamResponse(
        ['data: {"type":"intake_start","message":"Hello","timestamp":1}'],
        { 'X-Session-Id': 'sess-1' }
      );
      (global.fetch as any).mockResolvedValueOnce(resp);

      const { result } = renderHook(() => useDeepStrategy());

      await act(async () => {
        await result.current.startStrategy();
      });

      expect(result.current.phase).toBe('intake');
    });

    it('should capture session ID from header', async () => {
      const resp = streamResponse(['data: {"type":"intake_start","message":"Hi","timestamp":1}'], {
        'X-Session-Id': 'sess-abc',
      });
      (global.fetch as any).mockResolvedValueOnce(resp);

      const { result } = renderHook(() => useDeepStrategy());

      await act(async () => {
        await result.current.startStrategy();
      });

      expect(result.current.sessionId).toBe('sess-abc');
    });

    it('should populate intakeMessages from intake_start event', async () => {
      const resp = streamResponse(
        ['data: {"type":"intake_start","message":"Describe your problem","timestamp":1}'],
        { 'X-Session-Id': 'sess-2' }
      );
      (global.fetch as any).mockResolvedValueOnce(resp);

      const { result } = renderHook(() => useDeepStrategy());

      await act(async () => {
        await result.current.startStrategy();
      });

      expect(result.current.intakeMessages).toEqual([
        { role: 'assistant', content: 'Describe your problem' },
      ]);
    });

    it('should add parsed events to events array', async () => {
      const resp = streamResponse(
        [
          'data: {"type":"intake_start","message":"Q1","timestamp":1}',
          'data: {"type":"intake_question","message":"Q2","timestamp":2}',
        ],
        { 'X-Session-Id': 'sess-3' }
      );
      (global.fetch as any).mockResolvedValueOnce(resp);

      const { result } = renderHook(() => useDeepStrategy());

      await act(async () => {
        await result.current.startStrategy();
      });

      expect(result.current.events).toHaveLength(2);
      expect(result.current.events[0].type).toBe('intake_start');
      expect(result.current.events[1].type).toBe('intake_question');
    });

    it('should skip event: lines in SSE stream', async () => {
      const resp = streamResponse(
        ['event: intake', 'data: {"type":"intake_start","message":"Msg","timestamp":1}'],
        { 'X-Session-Id': 'sess-4' }
      );
      (global.fetch as any).mockResolvedValueOnce(resp);

      const { result } = renderHook(() => useDeepStrategy());

      await act(async () => {
        await result.current.startStrategy();
      });

      expect(result.current.events).toHaveLength(1);
    });

    it('should send attachments when provided', async () => {
      const resp = streamResponse(
        ['data: {"type":"intake_start","message":"Start","timestamp":1}'],
        { 'X-Session-Id': 'sess-5' }
      );
      (global.fetch as any).mockResolvedValueOnce(resp);

      const attachments = [
        { id: 'a1', name: 'doc.pdf', type: 'application/pdf', size: 100, content: 'base64data' },
      ];

      const { result } = renderHook(() => useDeepStrategy());

      await act(async () => {
        await result.current.startStrategy(attachments);
      });

      const [, requestInit] = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(requestInit.body);
      expect(body.action).toBe('start');
      expect(body.attachments).toHaveLength(1);
      expect(body.attachments[0].name).toBe('doc.pdf');
    });

    it('should handle empty attachments array', async () => {
      const resp = streamResponse(
        ['data: {"type":"intake_start","message":"Start","timestamp":1}'],
        { 'X-Session-Id': 'sess-6' }
      );
      (global.fetch as any).mockResolvedValueOnce(resp);

      const { result } = renderHook(() => useDeepStrategy());

      await act(async () => {
        await result.current.startStrategy([]);
      });

      const [, requestInit] = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(requestInit.body);
      expect(body.attachments).toEqual([]);
    });

    it('should set error phase on HTTP failure', async () => {
      const errorResp = {
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Server error' }),
        headers: { get: () => null },
      } as unknown as Response;
      (global.fetch as any).mockResolvedValueOnce(errorResp);

      const { result } = renderHook(() => useDeepStrategy());

      await act(async () => {
        await result.current.startStrategy();
      });

      expect(result.current.phase).toBe('error');
      expect(result.current.error).toBe('Server error');
    });

    it('should set error when response has no body', async () => {
      const noBodyResp = {
        ok: true,
        status: 200,
        headers: { get: () => 'sess-7' },
        body: null,
        json: () => Promise.resolve({}),
      } as unknown as Response;
      (global.fetch as any).mockResolvedValueOnce(noBodyResp);

      const { result } = renderHook(() => useDeepStrategy());

      await act(async () => {
        await result.current.startStrategy();
      });

      expect(result.current.phase).toBe('error');
      expect(result.current.error).toBe('No response body');
    });

    it('should set error on fetch rejection', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network down'));

      const { result } = renderHook(() => useDeepStrategy());

      await act(async () => {
        await result.current.startStrategy();
      });

      expect(result.current.phase).toBe('error');
      expect(result.current.error).toBe('Network down');
    });

    it('should handle non-Error throw in catch', async () => {
      (global.fetch as any).mockRejectedValueOnce('string error');

      const { result } = renderHook(() => useDeepStrategy());

      await act(async () => {
        await result.current.startStrategy();
      });

      expect(result.current.phase).toBe('error');
      expect(result.current.error).toBe('Unknown error');
    });

    it('should not start if phase is not idle', async () => {
      // First start to get into intake phase
      const resp = streamResponse(['data: {"type":"intake_start","message":"Hi","timestamp":1}'], {
        'X-Session-Id': 'sess-8',
      });
      (global.fetch as any).mockResolvedValueOnce(resp);

      const { result } = renderHook(() => useDeepStrategy());

      await act(async () => {
        await result.current.startStrategy();
      });

      // Try to start again - should be a no-op
      (global.fetch as any).mockClear();
      await act(async () => {
        await result.current.startStrategy();
      });

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should set isLoading to false after completion', async () => {
      const resp = streamResponse(['data: {"type":"intake_start","message":"Hi","timestamp":1}'], {
        'X-Session-Id': 'sess-9',
      });
      (global.fetch as any).mockResolvedValueOnce(resp);

      const { result } = renderHook(() => useDeepStrategy());

      await act(async () => {
        await result.current.startStrategy();
      });

      expect(result.current.isLoading).toBe(false);
    });

    it('should handle malformed JSON in stream gracefully', async () => {
      const resp = streamResponse(
        [
          'data: {"type":"intake_start","message":"Hi","timestamp":1}',
          'data: {INVALID-JSON}',
          'data: {"type":"intake_question","message":"Q","timestamp":2}',
        ],
        { 'X-Session-Id': 'sess-10' }
      );
      (global.fetch as any).mockResolvedValueOnce(resp);

      const { result } = renderHook(() => useDeepStrategy());

      await act(async () => {
        await result.current.startStrategy();
      });

      // Should still capture the valid events
      expect(result.current.events).toHaveLength(2);
    });

    it('should skip empty data lines', async () => {
      const resp = streamResponse(
        ['data: {"type":"intake_start","message":"Hi","timestamp":1}', 'data: ', 'data:'],
        { 'X-Session-Id': 'sess-11' }
      );
      (global.fetch as any).mockResolvedValueOnce(resp);

      const { result } = renderHook(() => useDeepStrategy());

      await act(async () => {
        await result.current.startStrategy();
      });

      expect(result.current.events).toHaveLength(1);
    });

    it('should clear previous state before starting', async () => {
      // We rely on reset being called internally by startStrategy
      const resp = streamResponse(
        ['data: {"type":"intake_start","message":"Fresh","timestamp":1}'],
        { 'X-Session-Id': 'sess-12' }
      );
      (global.fetch as any).mockResolvedValueOnce(resp);

      const { result } = renderHook(() => useDeepStrategy());

      await act(async () => {
        await result.current.startStrategy();
      });

      expect(result.current.result).toBeNull();
      expect(result.current.events).toHaveLength(1);
    });

    it('should use undefined attachments when none provided', async () => {
      const resp = streamResponse(
        ['data: {"type":"intake_start","message":"Start","timestamp":1}'],
        { 'X-Session-Id': 'sess-13' }
      );
      (global.fetch as any).mockResolvedValueOnce(resp);

      const { result } = renderHook(() => useDeepStrategy());

      await act(async () => {
        await result.current.startStrategy();
      });

      const [, requestInit] = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(requestInit.body);
      expect(body.attachments).toBeUndefined();
    });
  });

  // =========================================================================
  // 4) SEND INTAKE INPUT
  // =========================================================================

  describe('sendIntakeInput', () => {
    async function setupIntake(): Promise<
      ReturnType<typeof renderHook<ReturnType<typeof useDeepStrategy>>>
    > {
      const resp = streamResponse(
        ['data: {"type":"intake_start","message":"Ask me","timestamp":1}'],
        { 'X-Session-Id': 'sess-intake' }
      );
      (global.fetch as any).mockResolvedValueOnce(resp);

      const hook = renderHook(() => useDeepStrategy());
      await act(async () => {
        await hook.result.current.startStrategy();
      });
      return hook;
    }

    it('should add user message to intakeMessages', async () => {
      const { result } = await setupIntake();

      (global.fetch as any).mockResolvedValueOnce(
        jsonResponse({ response: 'Got it', isComplete: false })
      );

      await act(async () => {
        await result.current.sendIntakeInput('My problem is X');
      });

      const userMsgs = result.current.intakeMessages.filter((m: any) => m.role === 'user');
      expect(userMsgs).toHaveLength(1);
      expect(userMsgs[0].content).toBe('My problem is X');
    });

    it('should add assistant response to intakeMessages', async () => {
      const { result } = await setupIntake();

      (global.fetch as any).mockResolvedValueOnce(
        jsonResponse({ response: 'Thanks for the details', isComplete: false })
      );

      await act(async () => {
        await result.current.sendIntakeInput('Info');
      });

      const assistantMsgs = result.current.intakeMessages.filter(
        (m: any) => m.role === 'assistant'
      );
      // First is from intake_start, second from this response
      expect(assistantMsgs).toHaveLength(2);
      expect(assistantMsgs[1].content).toBe('Thanks for the details');
    });

    it('should do nothing if phase is not intake', async () => {
      const { result } = renderHook(() => useDeepStrategy());

      (global.fetch as any).mockClear();

      await act(async () => {
        await result.current.sendIntakeInput('test');
      });

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should do nothing if sessionId is null', async () => {
      // Hook at idle has null sessionId
      const { result } = renderHook(() => useDeepStrategy());

      (global.fetch as any).mockClear();

      await act(async () => {
        await result.current.sendIntakeInput('test');
      });

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should set error on HTTP failure', async () => {
      const { result } = await setupIntake();

      (global.fetch as any).mockResolvedValueOnce(jsonResponse({ error: 'Bad input' }, false));

      await act(async () => {
        await result.current.sendIntakeInput('bad');
      });

      expect(result.current.phase).toBe('error');
      expect(result.current.error).toBe('Bad input');
    });

    it('should set error on fetch rejection', async () => {
      const { result } = await setupIntake();

      (global.fetch as any).mockRejectedValueOnce(new Error('Timeout'));

      await act(async () => {
        await result.current.sendIntakeInput('test');
      });

      expect(result.current.phase).toBe('error');
      expect(result.current.error).toBe('Timeout');
    });

    it('should set isLoading false after completion', async () => {
      const { result } = await setupIntake();

      (global.fetch as any).mockResolvedValueOnce(
        jsonResponse({ response: 'Ok', isComplete: false })
      );

      await act(async () => {
        await result.current.sendIntakeInput('data');
      });

      expect(result.current.isLoading).toBe(false);
    });

    it('should auto-execute when isComplete is true', async () => {
      const { result } = await setupIntake();

      // Mock sendIntakeInput response
      (global.fetch as any).mockResolvedValueOnce(
        jsonResponse({ response: 'Ready to execute', isComplete: true })
      );

      // Mock executeStrategy response
      const execResp = streamResponse(
        [
          'data: {"type":"strategy_complete","message":"Done","timestamp":3,"data":{"result":{"id":"r1"}}}',
        ],
        {}
      );
      (global.fetch as any).mockResolvedValueOnce(execResp);

      await act(async () => {
        await result.current.sendIntakeInput('go');
      });

      // Should have triggered execute
      expect(global.fetch).toHaveBeenCalledTimes(3); // start + input + execute
    });

    it('should handle non-Error throw in catch', async () => {
      const { result } = await setupIntake();

      (global.fetch as any).mockRejectedValueOnce('raw string');

      await act(async () => {
        await result.current.sendIntakeInput('x');
      });

      expect(result.current.error).toBe('Unknown error');
    });
  });

  // =========================================================================
  // 5) EXECUTE STRATEGY
  // =========================================================================

  describe('executeStrategy', () => {
    async function setupForExecution(): Promise<
      ReturnType<typeof renderHook<ReturnType<typeof useDeepStrategy>>>
    > {
      const resp = streamResponse(['data: {"type":"intake_start","message":"Hi","timestamp":1}'], {
        'X-Session-Id': 'sess-exec',
      });
      (global.fetch as any).mockResolvedValueOnce(resp);

      const hook = renderHook(() => useDeepStrategy());
      await act(async () => {
        await hook.result.current.startStrategy();
      });
      return hook;
    }

    it('should do nothing if sessionId is null', async () => {
      const { result } = renderHook(() => useDeepStrategy());

      (global.fetch as any).mockClear();

      await act(async () => {
        await result.current.executeStrategy();
      });

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should set phase to executing', async () => {
      const { result } = await setupForExecution();

      const execResp = streamResponse(
        ['data: {"type":"agent_spawned","message":"Spawned","timestamp":2}'],
        {}
      );
      (global.fetch as any).mockResolvedValueOnce(execResp);

      await act(async () => {
        await result.current.executeStrategy();
      });

      // Phase should be executing (or complete if strategy_complete came)
      expect(['executing', 'complete']).toContain(result.current.phase);
    });

    it('should update progress from stream events', async () => {
      const { result } = await setupForExecution();

      const execResp = streamResponse(
        [
          'data: {"type":"agent_progress","message":"Working","timestamp":2,"data":{"progress":50,"completedAgents":2,"totalAgents":5,"cost":0.5}}',
        ],
        {}
      );
      (global.fetch as any).mockResolvedValueOnce(execResp);

      await act(async () => {
        await result.current.executeStrategy();
      });

      expect(result.current.progress.percent).toBe(50);
      expect(result.current.progress.agentsComplete).toBe(2);
      expect(result.current.progress.agentsTotal).toBe(5);
      expect(result.current.progress.cost).toBe(0.5);
    });

    it('should set result and phase to complete on strategy_complete', async () => {
      const { result } = await setupForExecution();

      const mockResult = { id: 'result-1', recommendation: { title: 'Go' } };
      const execResp = streamResponse(
        [
          `data: {"type":"strategy_complete","message":"Done","timestamp":3,"data":{"result":${JSON.stringify(mockResult)}}}`,
        ],
        {}
      );
      (global.fetch as any).mockResolvedValueOnce(execResp);

      await act(async () => {
        await result.current.executeStrategy();
      });

      expect(result.current.phase).toBe('complete');
      expect(result.current.result).toEqual(mockResult);
    });

    it('should clear session on strategy_complete', async () => {
      const { result } = await setupForExecution();

      const execResp = streamResponse(
        [
          'data: {"type":"strategy_complete","message":"Done","timestamp":3,"data":{"result":{"id":"r2"}}}',
        ],
        {}
      );
      (global.fetch as any).mockResolvedValueOnce(execResp);

      await act(async () => {
        await result.current.executeStrategy();
      });

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('deep-strategy-session');
    });

    it('should set error on error event', async () => {
      const { result } = await setupForExecution();

      const execResp = streamResponse(
        ['data: {"type":"error","message":"Agent failure","timestamp":3}'],
        {}
      );
      (global.fetch as any).mockResolvedValueOnce(execResp);

      await act(async () => {
        await result.current.executeStrategy();
      });

      expect(result.current.phase).toBe('error');
      expect(result.current.error).toBe('Agent failure');
    });

    it('should set cancelled on kill_switch event', async () => {
      const { result } = await setupForExecution();

      const execResp = streamResponse(
        ['data: {"type":"kill_switch","message":"Budget exceeded","timestamp":3}'],
        {}
      );
      (global.fetch as any).mockResolvedValueOnce(execResp);

      await act(async () => {
        await result.current.executeStrategy();
      });

      expect(result.current.phase).toBe('cancelled');
      expect(result.current.error).toBe('Strategy stopped: Budget exceeded');
    });

    it('should handle HTTP failure', async () => {
      const { result } = await setupForExecution();

      (global.fetch as any).mockResolvedValueOnce(
        jsonResponse({ error: 'Execution failed' }, false)
      );

      await act(async () => {
        await result.current.executeStrategy();
      });

      expect(result.current.phase).toBe('error');
      expect(result.current.error).toBe('Execution failed');
    });

    it('should handle no response body', async () => {
      const { result } = await setupForExecution();

      const noBodyResp = {
        ok: true,
        status: 200,
        headers: { get: () => null },
        body: null,
        json: () => Promise.resolve({}),
      } as unknown as Response;
      (global.fetch as any).mockResolvedValueOnce(noBodyResp);

      await act(async () => {
        await result.current.executeStrategy();
      });

      expect(result.current.phase).toBe('error');
      expect(result.current.error).toBe('No response body');
    });

    it('should handle fetch rejection', async () => {
      const { result } = await setupForExecution();

      (global.fetch as any).mockRejectedValueOnce(new Error('Connection lost'));

      await act(async () => {
        await result.current.executeStrategy();
      });

      expect(result.current.phase).toBe('error');
      expect(result.current.error).toBe('Connection lost');
    });

    it('should handle malformed JSON in execution stream', async () => {
      const { result } = await setupForExecution();

      const execResp = streamResponse(
        ['data: {"type":"agent_spawned","message":"OK","timestamp":2}', 'data: NOT-JSON'],
        {}
      );
      (global.fetch as any).mockResolvedValueOnce(execResp);

      await act(async () => {
        await result.current.executeStrategy();
      });

      // Should capture valid events and skip invalid
      expect(result.current.events.length).toBeGreaterThanOrEqual(1);
    });

    it('should set isLoading false after execution completes', async () => {
      const { result } = await setupForExecution();

      const execResp = streamResponse(
        ['data: {"type":"agent_spawned","message":"OK","timestamp":2}'],
        {}
      );
      (global.fetch as any).mockResolvedValueOnce(execResp);

      await act(async () => {
        await result.current.executeStrategy();
      });

      expect(result.current.isLoading).toBe(false);
    });

    it('should handle non-Error throw', async () => {
      const { result } = await setupForExecution();

      (global.fetch as any).mockRejectedValueOnce(42);

      await act(async () => {
        await result.current.executeStrategy();
      });

      expect(result.current.error).toBe('Unknown error');
    });
  });

  // =========================================================================
  // 6) CANCEL STRATEGY
  // =========================================================================

  describe('cancelStrategy', () => {
    it('should do nothing if sessionId is null', async () => {
      const { result } = renderHook(() => useDeepStrategy());

      (global.fetch as any).mockClear();

      await act(async () => {
        await result.current.cancelStrategy();
      });

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should send DELETE request and set cancelled phase', async () => {
      // Setup a session
      const startResp = streamResponse(
        ['data: {"type":"intake_start","message":"Hi","timestamp":1}'],
        { 'X-Session-Id': 'sess-cancel' }
      );
      (global.fetch as any).mockResolvedValueOnce(startResp);

      const { result } = renderHook(() => useDeepStrategy());
      await act(async () => {
        await result.current.startStrategy();
      });

      // Cancel
      (global.fetch as any).mockResolvedValueOnce({ ok: true, status: 200 });

      await act(async () => {
        await result.current.cancelStrategy();
      });

      expect(result.current.phase).toBe('cancelled');
      expect(result.current.error).toBe('Strategy cancelled by user');
    });

    it('should clear session on cancel', async () => {
      const startResp = streamResponse(
        ['data: {"type":"intake_start","message":"Hi","timestamp":1}'],
        { 'X-Session-Id': 'sess-cancel2' }
      );
      (global.fetch as any).mockResolvedValueOnce(startResp);

      const { result } = renderHook(() => useDeepStrategy());
      await act(async () => {
        await result.current.startStrategy();
      });

      (global.fetch as any).mockResolvedValueOnce({ ok: true, status: 200 });

      await act(async () => {
        await result.current.cancelStrategy();
      });

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('deep-strategy-session');
    });

    it('should not change phase if server returns not ok', async () => {
      const startResp = streamResponse(
        ['data: {"type":"intake_start","message":"Hi","timestamp":1}'],
        { 'X-Session-Id': 'sess-cancel3' }
      );
      (global.fetch as any).mockResolvedValueOnce(startResp);

      const { result } = renderHook(() => useDeepStrategy());
      await act(async () => {
        await result.current.startStrategy();
      });

      (global.fetch as any).mockResolvedValueOnce({ ok: false, status: 500 });

      await act(async () => {
        await result.current.cancelStrategy();
      });

      // Phase should still be intake, not cancelled
      expect(result.current.phase).toBe('intake');
    });

    it('should handle fetch error silently', async () => {
      const startResp = streamResponse(
        ['data: {"type":"intake_start","message":"Hi","timestamp":1}'],
        { 'X-Session-Id': 'sess-cancel4' }
      );
      (global.fetch as any).mockResolvedValueOnce(startResp);

      const { result } = renderHook(() => useDeepStrategy());
      await act(async () => {
        await result.current.startStrategy();
      });

      (global.fetch as any).mockRejectedValueOnce(new Error('Network'));

      await act(async () => {
        await result.current.cancelStrategy();
      });

      // Should not throw, phase unchanged
      expect(result.current.phase).toBe('intake');
    });
  });

  // =========================================================================
  // 7) ADD CONTEXT
  // =========================================================================

  describe('addContext', () => {
    async function setupExecuting(): Promise<
      ReturnType<typeof renderHook<ReturnType<typeof useDeepStrategy>>>
    > {
      const startResp = streamResponse(
        ['data: {"type":"intake_start","message":"Hi","timestamp":1}'],
        { 'X-Session-Id': 'sess-ctx' }
      );
      (global.fetch as any).mockResolvedValueOnce(startResp);

      const hook = renderHook(() => useDeepStrategy());
      await act(async () => {
        await hook.result.current.startStrategy();
      });

      // Move to executing phase
      const execResp = streamResponse(
        ['data: {"type":"agent_spawned","message":"GO","timestamp":2}'],
        {}
      );
      (global.fetch as any).mockResolvedValueOnce(execResp);
      await act(async () => {
        await hook.result.current.executeStrategy();
      });

      return hook;
    }

    it('should do nothing if phase is not executing', async () => {
      const { result } = renderHook(() => useDeepStrategy());

      (global.fetch as any).mockClear();

      await act(async () => {
        await result.current.addContext('extra info');
      });

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should do nothing if sessionId is null', async () => {
      const { result } = renderHook(() => useDeepStrategy());

      (global.fetch as any).mockClear();

      await act(async () => {
        await result.current.addContext('extra');
      });

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should send context message to API', async () => {
      const { result } = await setupExecuting();

      (global.fetch as any).mockResolvedValueOnce(jsonResponse({ ok: true }));

      await act(async () => {
        await result.current.addContext('Additional detail');
      });

      const lastCall = (global.fetch as any).mock.calls[
        (global.fetch as any).mock.calls.length - 1
      ];
      const body = JSON.parse(lastCall[1].body);
      expect(body.action).toBe('context');
      expect(body.message).toBe('Additional detail');
    });

    it('should add a user_context_added event locally', async () => {
      const { result } = await setupExecuting();

      (global.fetch as any).mockResolvedValueOnce(jsonResponse({ ok: true }));

      await act(async () => {
        await result.current.addContext('New info');
      });

      const ctxEvents = result.current.events.filter((e: any) => e.type === 'user_context_added');
      expect(ctxEvents).toHaveLength(1);
      expect(ctxEvents[0].message).toBe('New info');
    });

    it('should set isAddingContext to false after completion', async () => {
      const { result } = await setupExecuting();

      (global.fetch as any).mockResolvedValueOnce(jsonResponse({ ok: true }));

      await act(async () => {
        await result.current.addContext('Info');
      });

      expect(result.current.isAddingContext).toBe(false);
    });

    it('should throw and propagate error on API failure', async () => {
      const { result } = await setupExecuting();

      (global.fetch as any).mockResolvedValueOnce(
        jsonResponse({ error: 'Context rejected' }, false)
      );

      await expect(
        act(async () => {
          await result.current.addContext('bad context');
        })
      ).rejects.toThrow('Context rejected');
    });

    it('should set isAddingContext to false even on error', async () => {
      const { result } = await setupExecuting();

      (global.fetch as any).mockRejectedValueOnce(new Error('Network'));

      try {
        await act(async () => {
          await result.current.addContext('fail');
        });
      } catch {
        // expected
      }

      expect(result.current.isAddingContext).toBe(false);
    });
  });

  // =========================================================================
  // 8) RECONNECT
  // =========================================================================

  describe('reconnect', () => {
    async function setupWithSession(): Promise<
      ReturnType<typeof renderHook<ReturnType<typeof useDeepStrategy>>>
    > {
      const startResp = streamResponse(
        ['data: {"type":"intake_start","message":"Hi","timestamp":1}'],
        { 'X-Session-Id': 'sess-recon' }
      );
      (global.fetch as any).mockResolvedValueOnce(startResp);

      const hook = renderHook(() => useDeepStrategy());
      await act(async () => {
        await hook.result.current.startStrategy();
      });
      return hook;
    }

    it('should do nothing if sessionId is null', async () => {
      const { result } = renderHook(() => useDeepStrategy());

      (global.fetch as any).mockClear();

      await act(async () => {
        await result.current.reconnect();
      });

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should handle complete phase from server', async () => {
      const { result } = await setupWithSession();

      const mockResult = { id: 'result-recon' };
      (global.fetch as any).mockResolvedValueOnce(
        jsonResponse({
          phase: 'complete',
          result: mockResult,
          events: [],
        })
      );

      await act(async () => {
        await result.current.reconnect();
      });

      expect(result.current.phase).toBe('complete');
      expect(result.current.result).toEqual(mockResult);
    });

    it('should handle error phase from server', async () => {
      const { result } = await setupWithSession();

      (global.fetch as any).mockResolvedValueOnce(jsonResponse({ phase: 'error', events: [] }));

      await act(async () => {
        await result.current.reconnect();
      });

      expect(result.current.phase).toBe('error');
      expect(result.current.error).toBe('Session failed on server');
    });

    it('should handle cancelled phase from server', async () => {
      const { result } = await setupWithSession();

      (global.fetch as any).mockResolvedValueOnce(jsonResponse({ phase: 'cancelled', events: [] }));

      await act(async () => {
        await result.current.reconnect();
      });

      expect(result.current.phase).toBe('cancelled');
      expect(result.current.error).toBe('Session was cancelled');
    });

    it('should handle active session from server', async () => {
      const { result } = await setupWithSession();

      (global.fetch as any).mockResolvedValueOnce(
        jsonResponse({
          isActive: true,
          completedAgents: 3,
          totalAgents: 10,
          totalCost: 1.5,
          events: [],
        })
      );

      await act(async () => {
        await result.current.reconnect();
      });

      expect(result.current.phase).toBe('executing');
      expect(result.current.progress.agentsComplete).toBe(3);
      expect(result.current.progress.agentsTotal).toBe(10);
    });

    it('should handle inactive session with result', async () => {
      const { result } = await setupWithSession();

      (global.fetch as any).mockResolvedValueOnce(
        jsonResponse({
          isActive: false,
          result: { id: 'done' },
          events: [],
        })
      );

      await act(async () => {
        await result.current.reconnect();
      });

      expect(result.current.phase).toBe('complete');
      expect(result.current.result).toEqual({ id: 'done' });
    });

    it('should handle inactive session without result', async () => {
      const { result } = await setupWithSession();

      (global.fetch as any).mockResolvedValueOnce(jsonResponse({ isActive: false, events: [] }));

      await act(async () => {
        await result.current.reconnect();
      });

      expect(result.current.phase).toBe('error');
      expect(result.current.error).toBe('Session ended unexpectedly');
    });

    it('should restore events from server when available', async () => {
      const { result } = await setupWithSession();

      const serverEvents = [
        { type: 'agent_spawned', message: 'Scout 1', timestamp: 10 },
        { type: 'agent_complete', message: 'Scout 1 done', timestamp: 20 },
      ];
      (global.fetch as any).mockResolvedValueOnce(
        jsonResponse({ isActive: true, events: serverEvents })
      );

      await act(async () => {
        await result.current.reconnect();
      });

      expect(result.current.events).toEqual(serverEvents);
    });

    it('should not replace events when server returns empty array', async () => {
      const { result } = await setupWithSession();

      (global.fetch as any).mockResolvedValueOnce(jsonResponse({ isActive: true, events: [] }));

      await act(async () => {
        await result.current.reconnect();
      });

      // Events should still be the original ones from startStrategy
      expect(result.current.events.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle server returning error field', async () => {
      const { result } = await setupWithSession();

      (global.fetch as any).mockResolvedValueOnce(jsonResponse({ error: 'Session not found' }));

      await act(async () => {
        await result.current.reconnect();
      });

      expect(result.current.error).toBe('Session not found');
    });

    it('should handle fetch rejection', async () => {
      const { result } = await setupWithSession();

      (global.fetch as any).mockRejectedValueOnce(new Error('Offline'));

      await act(async () => {
        await result.current.reconnect();
      });

      expect(result.current.error).toBe('Offline');
    });

    it('should handle non-Error throw in catch', async () => {
      const { result } = await setupWithSession();

      (global.fetch as any).mockRejectedValueOnce('raw');

      await act(async () => {
        await result.current.reconnect();
      });

      expect(result.current.error).toBe('Failed to reconnect');
    });

    it('should set isReconnecting to false after completion', async () => {
      const { result } = await setupWithSession();

      (global.fetch as any).mockResolvedValueOnce(jsonResponse({ isActive: true, events: [] }));

      await act(async () => {
        await result.current.reconnect();
      });

      expect(result.current.isReconnecting).toBe(false);
    });

    it('should clear error before reconnecting', async () => {
      const { result } = await setupWithSession();

      (global.fetch as any).mockResolvedValueOnce(jsonResponse({ isActive: true, events: [] }));

      await act(async () => {
        await result.current.reconnect();
      });

      // Error should be null (cleared at start of reconnect)
      expect(result.current.error).toBeNull();
    });
  });

  // =========================================================================
  // 9) SESSION PERSISTENCE
  // =========================================================================

  describe('session persistence', () => {
    it('should save session to localStorage when in intake phase', async () => {
      const resp = streamResponse(['data: {"type":"intake_start","message":"Hi","timestamp":1}'], {
        'X-Session-Id': 'sess-persist',
      });
      (global.fetch as any).mockResolvedValueOnce(resp);

      const { result } = renderHook(() => useDeepStrategy());

      await act(async () => {
        await result.current.startStrategy();
      });

      expect(localStorageMock.setItem).toHaveBeenCalled();
      const lastCall = localStorageMock.setItem.mock.calls.find(
        (c: any) => c[0] === 'deep-strategy-session'
      );
      expect(lastCall).toBeDefined();
    });

    it('should load session from localStorage on mount', async () => {
      const storedSession = {
        sessionId: 'sess-restore',
        phase: 'intake',
        events: [{ type: 'intake_start', message: 'Saved', timestamp: 1 }],
        intakeMessages: [{ role: 'assistant', content: 'Saved' }],
        lastUpdated: Date.now(),
      };
      storageStore['deep-strategy-session'] = JSON.stringify(storedSession);

      const { result } = renderHook(() => useDeepStrategy());

      // Allow useEffect to run
      await act(async () => {});

      expect(result.current.sessionId).toBe('sess-restore');
      expect(result.current.phase).toBe('intake');
    });

    it('should expire sessions older than 30 minutes', async () => {
      const storedSession = {
        sessionId: 'sess-old',
        phase: 'intake',
        events: [],
        intakeMessages: [],
        lastUpdated: Date.now() - 31 * 60 * 1000,
      };
      storageStore['deep-strategy-session'] = JSON.stringify(storedSession);

      const { result } = renderHook(() => useDeepStrategy());

      await act(async () => {});

      expect(result.current.sessionId).toBeNull();
      expect(result.current.phase).toBe('idle');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('deep-strategy-session');
    });

    it('should attempt to reconnect executing sessions on mount', async () => {
      const storedSession = {
        sessionId: 'sess-exec-restore',
        phase: 'executing',
        events: [],
        intakeMessages: [],
        lastUpdated: Date.now(),
      };
      storageStore['deep-strategy-session'] = JSON.stringify(storedSession);

      // Mock the status check
      (global.fetch as any).mockResolvedValueOnce(
        jsonResponse({ isActive: true, completedAgents: 1, totalAgents: 5 })
      );

      renderHook(() => useDeepStrategy());

      await act(async () => {});

      // Should have tried to fetch session status
      expect(global.fetch).toHaveBeenCalled();
    });

    it('should handle localStorage getItem failure gracefully', async () => {
      localStorageMock.getItem.mockImplementationOnce(() => {
        throw new Error('Storage error');
      });

      const { result } = renderHook(() => useDeepStrategy());

      await act(async () => {});

      // Should still initialize cleanly
      expect(result.current.phase).toBe('idle');
    });

    it('should handle localStorage setItem failure gracefully', async () => {
      const resp = streamResponse(['data: {"type":"intake_start","message":"Hi","timestamp":1}'], {
        'X-Session-Id': 'sess-save-fail',
      });
      (global.fetch as any).mockResolvedValueOnce(resp);

      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('Storage full');
      });

      const { result } = renderHook(() => useDeepStrategy());

      await act(async () => {
        await result.current.startStrategy();
      });

      // Should not crash
      expect(result.current.phase).toBe('intake');

      // Restore normal setItem for other tests
      localStorageMock.setItem.mockImplementation((key: string, value: string) => {
        storageStore[key] = value;
      });
    });

    it('should handle malformed JSON in localStorage', async () => {
      storageStore['deep-strategy-session'] = 'NOT-JSON';

      const { result } = renderHook(() => useDeepStrategy());

      await act(async () => {});

      expect(result.current.phase).toBe('idle');
    });

    it('should clear session when executing session completes on server', async () => {
      const storedSession = {
        sessionId: 'sess-done-server',
        phase: 'executing',
        events: [],
        intakeMessages: [],
        lastUpdated: Date.now(),
      };
      storageStore['deep-strategy-session'] = JSON.stringify(storedSession);

      (global.fetch as any).mockResolvedValueOnce(
        jsonResponse({ phase: 'complete', result: { id: 'r3' }, events: [] })
      );

      const { result } = renderHook(() => useDeepStrategy());

      await act(async () => {});

      expect(result.current.phase).toBe('complete');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('deep-strategy-session');
    });

    it('should handle fetch failure during session restore', async () => {
      const storedSession = {
        sessionId: 'sess-fail-restore',
        phase: 'executing',
        events: [],
        intakeMessages: [],
        lastUpdated: Date.now(),
      };
      storageStore['deep-strategy-session'] = JSON.stringify(storedSession);

      (global.fetch as any).mockRejectedValueOnce(new Error('Server down'));

      const { result } = renderHook(() => useDeepStrategy());

      await act(async () => {});

      expect(result.current.phase).toBe('error');
      expect(result.current.error).toBe('Could not reconnect to session');
    });

    it('should restore events from server during mount reconnect', async () => {
      const storedSession = {
        sessionId: 'sess-events-restore',
        phase: 'executing',
        events: [{ type: 'intake_start', message: 'Old', timestamp: 1 }],
        intakeMessages: [],
        lastUpdated: Date.now(),
      };
      storageStore['deep-strategy-session'] = JSON.stringify(storedSession);

      const serverEvents = [
        { type: 'intake_start', message: 'Old', timestamp: 1 },
        { type: 'agent_spawned', message: 'New', timestamp: 2 },
      ];

      (global.fetch as any).mockResolvedValueOnce(
        jsonResponse({ isActive: true, events: serverEvents })
      );

      const { result } = renderHook(() => useDeepStrategy());

      await act(async () => {});

      expect(result.current.events).toEqual(serverEvents);
    });

    it('should set error phase when stored executing session is in error state on server', async () => {
      const storedSession = {
        sessionId: 'sess-err-srv',
        phase: 'executing',
        events: [],
        intakeMessages: [],
        lastUpdated: Date.now(),
      };
      storageStore['deep-strategy-session'] = JSON.stringify(storedSession);

      (global.fetch as any).mockResolvedValueOnce(jsonResponse({ phase: 'error', events: [] }));

      const { result } = renderHook(() => useDeepStrategy());

      await act(async () => {});

      expect(result.current.phase).toBe('error');
      expect(result.current.error).toBe('Session failed');
    });

    it('should set cancelled phase when stored executing session was cancelled on server', async () => {
      const storedSession = {
        sessionId: 'sess-cancelled-srv',
        phase: 'executing',
        events: [],
        intakeMessages: [],
        lastUpdated: Date.now(),
      };
      storageStore['deep-strategy-session'] = JSON.stringify(storedSession);

      (global.fetch as any).mockResolvedValueOnce(jsonResponse({ phase: 'cancelled', events: [] }));

      const { result } = renderHook(() => useDeepStrategy());

      await act(async () => {});

      expect(result.current.phase).toBe('cancelled');
      expect(result.current.error).toBe('Session was cancelled');
    });
  });

  // =========================================================================
  // 10) EDGE CASES
  // =========================================================================

  describe('edge cases', () => {
    it('should handle StrategyPhase type correctly', () => {
      const phases: StrategyPhase[] = [
        'idle',
        'intake',
        'executing',
        'complete',
        'error',
        'cancelled',
      ];
      expect(phases).toHaveLength(6);
    });

    it('should handle rapid reset calls', () => {
      const { result } = renderHook(() => useDeepStrategy());

      act(() => {
        result.current.reset();
        result.current.reset();
        result.current.reset();
      });

      expect(result.current.phase).toBe('idle');
    });

    it('should handle calling startStrategy with undefined attachments', async () => {
      const resp = streamResponse(['data: {"type":"intake_start","message":"Hi","timestamp":1}'], {
        'X-Session-Id': 'sess-undef',
      });
      (global.fetch as any).mockResolvedValueOnce(resp);

      const { result } = renderHook(() => useDeepStrategy());

      await act(async () => {
        await result.current.startStrategy(undefined);
      });

      expect(result.current.phase).toBe('intake');
    });

    it('should handle executeStrategy with default error message', async () => {
      const startResp = streamResponse(
        ['data: {"type":"intake_start","message":"Hi","timestamp":1}'],
        { 'X-Session-Id': 'sess-def-err' }
      );
      (global.fetch as any).mockResolvedValueOnce(startResp);

      const { result } = renderHook(() => useDeepStrategy());

      await act(async () => {
        await result.current.startStrategy();
      });

      // HTTP failure with no error field
      (global.fetch as any).mockResolvedValueOnce(jsonResponse({}, false));

      await act(async () => {
        await result.current.executeStrategy();
      });

      expect(result.current.error).toBe('Failed to execute strategy');
    });

    it('should handle sendIntakeInput with default error message', async () => {
      const startResp = streamResponse(
        ['data: {"type":"intake_start","message":"Hi","timestamp":1}'],
        { 'X-Session-Id': 'sess-def-err2' }
      );
      (global.fetch as any).mockResolvedValueOnce(startResp);

      const { result } = renderHook(() => useDeepStrategy());

      await act(async () => {
        await result.current.startStrategy();
      });

      (global.fetch as any).mockResolvedValueOnce(jsonResponse({}, false));

      await act(async () => {
        await result.current.sendIntakeInput('test');
      });

      expect(result.current.error).toBe('Failed to process input');
    });

    it('should handle startStrategy default error message on HTTP failure', async () => {
      (global.fetch as any).mockResolvedValueOnce(jsonResponse({}, false));

      const { result } = renderHook(() => useDeepStrategy());

      await act(async () => {
        await result.current.startStrategy();
      });

      expect(result.current.error).toBe('Failed to start strategy');
    });

    it('should handle addContext default error message', async () => {
      // Setup executing state
      const startResp = streamResponse(
        ['data: {"type":"intake_start","message":"Hi","timestamp":1}'],
        { 'X-Session-Id': 'sess-ctx-err' }
      );
      (global.fetch as any).mockResolvedValueOnce(startResp);

      const { result } = renderHook(() => useDeepStrategy());

      await act(async () => {
        await result.current.startStrategy();
      });

      const execResp = streamResponse(
        ['data: {"type":"agent_spawned","message":"GO","timestamp":2}'],
        {}
      );
      (global.fetch as any).mockResolvedValueOnce(execResp);

      await act(async () => {
        await result.current.executeStrategy();
      });

      (global.fetch as any).mockResolvedValueOnce(jsonResponse({}, false));

      await expect(
        act(async () => {
          await result.current.addContext('test');
        })
      ).rejects.toThrow('Failed to add context');
    });

    it('should handle progress update with partial data', async () => {
      const startResp = streamResponse(
        ['data: {"type":"intake_start","message":"Hi","timestamp":1}'],
        { 'X-Session-Id': 'sess-partial' }
      );
      (global.fetch as any).mockResolvedValueOnce(startResp);

      const { result } = renderHook(() => useDeepStrategy());

      await act(async () => {
        await result.current.startStrategy();
      });

      // Only progress field, no completedAgents/totalAgents
      const execResp = streamResponse(
        ['data: {"type":"agent_progress","message":"W","timestamp":2,"data":{"progress":25}}'],
        {}
      );
      (global.fetch as any).mockResolvedValueOnce(execResp);

      await act(async () => {
        await result.current.executeStrategy();
      });

      expect(result.current.progress.percent).toBe(25);
      // Others stay at defaults since they were falsy
      expect(result.current.progress.agentsComplete).toBe(0);
      expect(result.current.progress.agentsTotal).toBe(0);
    });

    it('should handle clearSession when localStorage.removeItem throws', async () => {
      localStorageMock.removeItem.mockImplementationOnce(() => {
        throw new Error('removeItem failed');
      });

      const { result } = renderHook(() => useDeepStrategy());

      // Should not throw
      act(() => {
        result.current.reset();
      });

      expect(result.current.phase).toBe('idle');
    });

    it('should handle multiple events in single data chunk during execution', async () => {
      const startResp = streamResponse(
        ['data: {"type":"intake_start","message":"Hi","timestamp":1}'],
        { 'X-Session-Id': 'sess-multi' }
      );
      (global.fetch as any).mockResolvedValueOnce(startResp);

      const { result } = renderHook(() => useDeepStrategy());

      await act(async () => {
        await result.current.startStrategy();
      });

      const execResp = streamResponse(
        [
          'data: {"type":"agent_spawned","message":"A1","timestamp":2}',
          'data: {"type":"agent_spawned","message":"A2","timestamp":3}',
          'data: {"type":"agent_complete","message":"A1 done","timestamp":4}',
        ],
        {}
      );
      (global.fetch as any).mockResolvedValueOnce(execResp);

      await act(async () => {
        await result.current.executeStrategy();
      });

      // Events from both start and execute calls
      const execEvents = result.current.events.filter(
        (e: any) => e.type === 'agent_spawned' || e.type === 'agent_complete'
      );
      expect(execEvents).toHaveLength(3);
    });

    it('should export useDeepStrategy as default', async () => {
      const mod = await import('./useDeepStrategy');
      expect(mod.default).toBe(mod.useDeepStrategy);
    });
  });
});
