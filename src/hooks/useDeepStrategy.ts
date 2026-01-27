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
 * - Session persistence and automatic reconnection
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { StrategyStreamEvent, StrategyOutput } from '@/agents/strategy';
import type { StrategyAttachment } from '@/components/chat/DeepStrategy';

export type StrategyPhase = 'idle' | 'intake' | 'executing' | 'complete' | 'error' | 'cancelled';

// Session persistence key
const SESSION_STORAGE_KEY = 'deep-strategy-session';

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
  isReconnecting: boolean;

  // Actions
  startStrategy: (attachments?: StrategyAttachment[]) => Promise<void>;
  sendIntakeInput: (input: string) => Promise<void>;
  executeStrategy: () => Promise<void>;
  cancelStrategy: () => Promise<void>;
  addContext: (message: string) => Promise<void>;
  reconnect: () => Promise<void>;
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

interface PersistedSession {
  sessionId: string;
  phase: StrategyPhase;
  events: StrategyStreamEvent[];
  intakeMessages: Array<{ role: 'assistant' | 'user'; content: string }>;
  lastUpdated: number;
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
  const [isReconnecting, setIsReconnecting] = useState(false);
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
  const hasRestoredRef = useRef(false);

  // ==========================================================================
  // SESSION PERSISTENCE
  // ==========================================================================

  /**
   * Save session state to localStorage
   */
  const saveSession = useCallback(
    (overridePhase?: StrategyPhase) => {
      if (!sessionId) return;

      const session: PersistedSession = {
        sessionId,
        phase: overridePhase || phase,
        events,
        intakeMessages,
        lastUpdated: Date.now(),
      };

      try {
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
      } catch (e) {
        console.error('Failed to save session:', e);
      }
    },
    [sessionId, phase, events, intakeMessages]
  );

  /**
   * Load session from localStorage
   */
  const loadSession = useCallback((): PersistedSession | null => {
    try {
      const stored = localStorage.getItem(SESSION_STORAGE_KEY);
      if (!stored) return null;

      const session = JSON.parse(stored) as PersistedSession;

      // Expire sessions older than 30 minutes
      if (Date.now() - session.lastUpdated > 30 * 60 * 1000) {
        localStorage.removeItem(SESSION_STORAGE_KEY);
        return null;
      }

      return session;
    } catch (e) {
      console.error('Failed to load session:', e);
      return null;
    }
  }, []);

  /**
   * Clear persisted session
   */
  const clearSession = useCallback(() => {
    try {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (e) {
      console.error('Failed to clear session:', e);
    }
  }, []);

  // Save session when important state changes
  useEffect(() => {
    if (sessionId && (phase === 'intake' || phase === 'executing')) {
      saveSession();
    }
  }, [sessionId, phase, events, intakeMessages, saveSession]);

  // ==========================================================================
  // RESTORE SESSION ON MOUNT
  // ==========================================================================

  useEffect(() => {
    // Only restore once
    if (hasRestoredRef.current) return;
    hasRestoredRef.current = true;

    const storedSession = loadSession();
    if (!storedSession) return;

    // If there was an executing session, try to reconnect
    if (storedSession.phase === 'executing') {
      console.log('Found executing session, attempting to reconnect...', storedSession.sessionId);

      // Restore state from storage first
      setSessionId(storedSession.sessionId);
      setEvents(storedSession.events);
      setIntakeMessages(storedSession.intakeMessages);
      setPhase('executing');

      // Check session status on server and get stored events
      fetch(`/api/strategy?sessionId=${storedSession.sessionId}&includeEvents=true`)
        .then((res) => res.json())
        .then((data) => {
          // Restore events from server if available
          if (data.events && Array.isArray(data.events) && data.events.length > 0) {
            setEvents(data.events);
          }

          if (data.phase === 'complete' && data.result) {
            // Session completed while we were away
            setResult(data.result);
            setPhase('complete');
            clearSession();
          } else if (data.phase === 'error' || data.phase === 'cancelled') {
            // Session failed or was cancelled
            setPhase(data.phase);
            setError(data.phase === 'error' ? 'Session failed' : 'Session was cancelled');
            clearSession();
          } else if (data.isActive) {
            // Session is still running - show current progress
            setProgress((prev) => ({
              ...prev,
              agentsComplete: data.completedAgents || prev.agentsComplete,
              agentsTotal: data.totalAgents || prev.agentsTotal,
              cost: data.totalCost || prev.cost,
            }));
            setPhase('executing');
            // Clear the error since we successfully reconnected
            setError(null);
          }
        })
        .catch((err) => {
          console.error('Failed to check session status:', err);
          setError('Could not reconnect to session');
          setPhase('error');
        });
    } else if (storedSession.phase === 'intake') {
      // Restore intake session
      setSessionId(storedSession.sessionId);
      setEvents(storedSession.events);
      setIntakeMessages(storedSession.intakeMessages);
      setPhase('intake');
    }
  }, [loadSession, clearSession]);

  // Cleanup on unmount
  useEffect(() => {
    // Capture current ref values to avoid the cleanup warning
    const eventSource = eventSourceRef.current;
    const abortController = abortControllerRef.current;
    return () => {
      eventSource?.close();
      abortController?.abort();
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

          if (value) {
            buffer += decoder.decode(value, { stream: !done });
          }

          // Process all complete lines
          const lines = buffer.split('\n');
          // Keep incomplete line in buffer only if stream is not done
          buffer = done ? '' : lines.pop() || '';

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

          if (done) break;
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

        if (value) {
          buffer += decoder.decode(value, { stream: !done });
        }

        // Process all complete lines
        const lines = buffer.split('\n');
        // Keep incomplete line in buffer only if stream is not done
        buffer = done ? '' : lines.pop() || '';

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
                  clearSession();
                }

                // Check for error
                if (event.type === 'error') {
                  setError(event.message);
                  setPhase('error');
                  clearSession();
                }

                // Check for kill
                if (event.type === 'kill_switch') {
                  setError(`Strategy stopped: ${event.message}`);
                  setPhase('cancelled');
                  clearSession();
                }
              } catch (e) {
                console.error('Failed to parse event:', e);
              }
            }
          }
        }

        if (done) break;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setPhase('error');
      clearSession();
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, clearSession]);

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
    [phase, sessionId, executeStrategy]
  );

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
        clearSession();
      }
    } catch (err) {
      console.error('Failed to cancel strategy:', err);
    }
  }, [sessionId, clearSession]);

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
   * Reconnect to an executing session by polling for updates
   * This is used when the user returns to a page with an in-progress session
   */
  const reconnect = useCallback(async () => {
    if (!sessionId) return;

    setIsReconnecting(true);
    setError(null);

    try {
      const response = await fetch(`/api/strategy?sessionId=${sessionId}&includeEvents=true`);
      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      // Restore events from server if available
      if (data.events && Array.isArray(data.events) && data.events.length > 0) {
        setEvents(data.events);
      }

      if (data.phase === 'complete' && data.result) {
        setResult(data.result);
        setPhase('complete');
        clearSession();
      } else if (data.phase === 'error' || data.phase === 'cancelled') {
        setPhase(data.phase);
        setError(data.phase === 'error' ? 'Session failed on server' : 'Session was cancelled');
        clearSession();
      } else if (data.isActive) {
        // Session still running - update progress
        setProgress((prev) => ({
          ...prev,
          agentsComplete: data.completedAgents || prev.agentsComplete,
          agentsTotal: data.totalAgents || prev.agentsTotal,
          cost: data.totalCost || prev.cost,
        }));
        setPhase('executing');
      } else {
        // Session exists but isn't active - likely completed or timed out
        if (data.result) {
          setResult(data.result);
          setPhase('complete');
        } else {
          setPhase('error');
          setError('Session ended unexpectedly');
        }
        clearSession();
      }
    } catch (err) {
      console.error('Failed to reconnect:', err);
      setError(err instanceof Error ? err.message : 'Failed to reconnect');
    } finally {
      setIsReconnecting(false);
    }
  }, [sessionId, clearSession]);

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
    setIsReconnecting(false);
    setProgress({
      phase: 'idle',
      percent: 0,
      agentsComplete: 0,
      agentsTotal: 0,
      cost: 0,
      elapsed: 0,
    });
    clearSession();
  }, [clearSession]);

  return {
    phase,
    sessionId,
    events,
    intakeMessages,
    result,
    error,
    isLoading,
    isAddingContext,
    isReconnecting,
    startStrategy,
    sendIntakeInput,
    executeStrategy,
    cancelStrategy,
    addContext,
    reconnect,
    reset,
    progress,
  };
}

export default useDeepStrategy;
