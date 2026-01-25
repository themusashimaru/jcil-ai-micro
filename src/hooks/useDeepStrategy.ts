/**
 * USE DEEP STRATEGY HOOK
 *
 * React hook for managing Deep Strategy Agent sessions.
 * Handles streaming events, state management, and API communication.
 *
 * Features:
 * - Document attachments before strategy execution
 * - Mid-execution context messaging (like Claude Code)
 * - Real-time streaming progress updates
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { StrategyStreamEvent, StrategyOutput } from '@/agents/strategy';
import type { StrategyAttachment } from '@/components/chat/DeepStrategy';

export type StrategyPhase = 'idle' | 'intake' | 'executing' | 'complete' | 'error' | 'cancelled';

interface UseDeepStrategyReturn {
  // State
  phase: StrategyPhase;
  sessionId: string | null;
  events: StrategyStreamEvent[];
  intakeMessages: Array<{ role: 'assistant' | 'user'; content: string }>;
  result: StrategyOutput | null;
  error: string | null;
  isLoading: boolean;
  isAddingContext: boolean;

  // Actions
  startStrategy: (attachments?: StrategyAttachment[]) => Promise<void>;
  sendIntakeInput: (input: string) => Promise<void>;
  executeStrategy: () => Promise<void>;
  cancelStrategy: () => Promise<void>;
  addContext: (message: string) => Promise<void>;
  reset: () => void;

  // Progress
  progress: {
    phase: string;
    percent: number;
    agentsComplete: number;
    agentsTotal: number;
    cost: number;
    elapsed: number;
  };
}

export function useDeepStrategy(): UseDeepStrategyReturn {
  // State
  const [phase, setPhase] = useState<StrategyPhase>('idle');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [events, setEvents] = useState<StrategyStreamEvent[]>([]);
  const [intakeMessages, setIntakeMessages] = useState<
    Array<{ role: 'assistant' | 'user'; content: string }>
  >([]);
  const [result, setResult] = useState<StrategyOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAddingContext, setIsAddingContext] = useState(false);
  const [progress, setProgress] = useState({
    phase: 'idle',
    percent: 0,
    agentsComplete: 0,
    agentsTotal: 0,
    cost: 0,
    elapsed: 0,
  });

  // Refs
  const eventSourceRef = useRef<EventSource | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
      abortControllerRef.current?.abort();
    };
  }, []);

  /**
   * Start a new strategy session
   * @param attachments - Optional array of attachments (documents, images) to include
   */
  const startStrategy = useCallback(
    async (attachments?: StrategyAttachment[]) => {
      if (phase !== 'idle') return;

      setIsLoading(true);
      setError(null);
      setPhase('intake');
      setEvents([]);
      setIntakeMessages([]);
      setResult(null);

      try {
        const response = await fetch('/api/strategy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'start',
            attachments: attachments?.map((a) => ({
              id: a.id,
              name: a.name,
              type: a.type,
              size: a.size,
              content: a.content,
            })),
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to start strategy');
        }

        // Get session ID from header
        const newSessionId = response.headers.get('X-Session-Id');
        if (newSessionId) {
          setSessionId(newSessionId);
        }

        // Read the streaming response
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) throw new Error('No response body');

        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('event:')) {
              // Event type line, skip
              continue;
            }
            if (line.startsWith('data:')) {
              const data = line.slice(5).trim();
              if (data) {
                try {
                  const event = JSON.parse(data) as StrategyStreamEvent;
                  setEvents((prev) => [...prev, event]);

                  if (event.type === 'intake_start') {
                    setIntakeMessages([{ role: 'assistant', content: event.message }]);
                  }
                } catch (e) {
                  console.error('Failed to parse event:', e);
                }
              }
            }
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setPhase('error');
      } finally {
        setIsLoading(false);
      }
    },
    [phase]
  );

  /**
   * Send input during intake phase
   */
  const sendIntakeInput = useCallback(
    async (input: string) => {
      if (phase !== 'intake' || !sessionId) return;

      setIsLoading(true);

      // Add user message to history
      setIntakeMessages((prev) => [...prev, { role: 'user', content: input }]);

      try {
        const response = await fetch('/api/strategy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'input', sessionId, input }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to process input');
        }

        const data = await response.json();

        // Add assistant response
        setIntakeMessages((prev) => [...prev, { role: 'assistant', content: data.response }]);

        // Check if intake is complete
        if (data.isComplete) {
          // Automatically start execution
          await executeStrategy();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setPhase('error');
      } finally {
        setIsLoading(false);
      }
    },
    [phase, sessionId]
  );

  /**
   * Execute the strategy after intake
   */
  const executeStrategy = useCallback(async () => {
    if (!sessionId) return;

    setIsLoading(true);
    setPhase('executing');

    try {
      const response = await fetch('/api/strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'execute', sessionId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to execute strategy');
      }

      // Read the streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('No response body');

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data:')) {
            const data = line.slice(5).trim();
            if (data) {
              try {
                const event = JSON.parse(data) as StrategyStreamEvent & {
                  data?: { result?: StrategyOutput };
                };
                setEvents((prev) => [...prev, event]);

                // Update progress
                if (event.data?.progress !== undefined) {
                  setProgress((prev) => ({
                    ...prev,
                    percent: event.data?.progress || prev.percent,
                    agentsComplete: event.data?.completedAgents || prev.agentsComplete,
                    agentsTotal: event.data?.totalAgents || prev.agentsTotal,
                    cost: event.data?.cost || prev.cost,
                  }));
                }

                // Check for completion
                if (event.type === 'strategy_complete' && event.data?.result) {
                  setResult(event.data.result);
                  setPhase('complete');
                }

                // Check for error
                if (event.type === 'error') {
                  setError(event.message);
                  setPhase('error');
                }

                // Check for kill
                if (event.type === 'kill_switch') {
                  setError(`Strategy stopped: ${event.message}`);
                  setPhase('cancelled');
                }
              } catch (e) {
                console.error('Failed to parse event:', e);
              }
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setPhase('error');
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  /**
   * Cancel the current strategy
   */
  const cancelStrategy = useCallback(async () => {
    if (!sessionId) return;

    try {
      const response = await fetch(`/api/strategy?sessionId=${sessionId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setPhase('cancelled');
        setError('Strategy cancelled by user');
      }
    } catch (err) {
      console.error('Failed to cancel strategy:', err);
    }
  }, [sessionId]);

  /**
   * Add context during execution (like Claude Code's interrupt feature)
   * Allows user to provide additional information while strategy is running
   */
  const addContext = useCallback(
    async (message: string) => {
      if (!sessionId || phase !== 'executing') return;

      setIsAddingContext(true);

      try {
        const response = await fetch('/api/strategy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'context', sessionId, message }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to add context');
        }

        // Add a local event to show the context was added
        const contextEvent: StrategyStreamEvent = {
          type: 'user_context_added',
          message,
          timestamp: Date.now(),
        };
        setEvents((prev) => [...prev, contextEvent]);
      } catch (err) {
        console.error('Failed to add context:', err);
        throw err;
      } finally {
        setIsAddingContext(false);
      }
    },
    [sessionId, phase]
  );

  /**
   * Reset all state
   */
  const reset = useCallback(() => {
    eventSourceRef.current?.close();
    abortControllerRef.current?.abort();

    setPhase('idle');
    setSessionId(null);
    setEvents([]);
    setIntakeMessages([]);
    setResult(null);
    setError(null);
    setIsLoading(false);
    setIsAddingContext(false);
    setProgress({
      phase: 'idle',
      percent: 0,
      agentsComplete: 0,
      agentsTotal: 0,
      cost: 0,
      elapsed: 0,
    });
  }, []);

  return {
    phase,
    sessionId,
    events,
    intakeMessages,
    result,
    error,
    isLoading,
    isAddingContext,
    startStrategy,
    sendIntakeInput,
    executeStrategy,
    cancelStrategy,
    addContext,
    reset,
    progress,
  };
}

export default useDeepStrategy;
