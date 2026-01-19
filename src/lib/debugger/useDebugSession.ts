/**
 * USE DEBUG SESSION HOOK - CLIENT-SIDE DEBUGGING
 *
 * Provides React hook for debugging operations:
 * - Start/stop debug sessions
 * - Set breakpoints
 * - Step controls
 * - Variable inspection
 * - Real-time debug events via WebSocket
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useWebSocket } from '@/lib/realtime';

// ============================================================================
// TYPES
// ============================================================================

export interface DebugConfiguration {
  type: 'node' | 'python';
  name: string;
  request: 'launch' | 'attach';
  program?: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  port?: number;
  host?: string;
}

export interface Breakpoint {
  id: number;
  verified: boolean;
  line: number;
  column?: number;
  source: { path?: string; name?: string };
  message?: string;
}

export interface StackFrame {
  id: number;
  name: string;
  source?: { path?: string; name?: string };
  line: number;
  column: number;
}

export interface Scope {
  name: string;
  variablesReference: number;
  expensive: boolean;
}

export interface Variable {
  name: string;
  value: string;
  type?: string;
  variablesReference: number;
}

export interface Thread {
  id: number;
  name: string;
}

export type DebugState = 'idle' | 'starting' | 'running' | 'paused' | 'stopped' | 'error';

export interface DebugOutput {
  category: 'stdout' | 'stderr' | 'console';
  output: string;
  timestamp: Date;
}

export interface UseDebugSessionOptions {
  token: string;
  workspaceId?: string;
  onOutput?: (output: DebugOutput) => void;
  onStateChange?: (state: DebugState) => void;
}

export interface UseDebugSessionReturn {
  // State
  state: DebugState;
  sessionId: string | null;
  error: string | null;

  // Debug info
  threads: Thread[];
  stackFrames: StackFrame[];
  scopes: Scope[];
  variables: Variable[];
  breakpoints: Map<string, Breakpoint[]>;
  outputs: DebugOutput[];

  // Actions
  start: (config: DebugConfiguration) => Promise<void>;
  stop: () => Promise<void>;
  setBreakpoints: (filePath: string, lines: number[]) => Promise<Breakpoint[]>;
  removeBreakpoint: (filePath: string, line: number) => Promise<void>;
  continue: () => Promise<void>;
  stepOver: () => Promise<void>;
  stepInto: () => Promise<void>;
  stepOut: () => Promise<void>;
  pause: () => Promise<void>;
  evaluate: (expression: string, frameId?: number) => Promise<string>;

  // Data fetching
  loadStackTrace: (threadId?: number) => Promise<void>;
  loadScopes: (frameId: number) => Promise<void>;
  loadVariables: (variablesReference: number) => Promise<void>;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useDebugSession(options: UseDebugSessionOptions): UseDebugSessionReturn {
  const { token, workspaceId, onOutput, onStateChange } = options;

  // State
  const [state, setState] = useState<DebugState>('idle');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [threads] = useState<Thread[]>([]);
  const [stackFrames, setStackFrames] = useState<StackFrame[]>([]);
  const [scopes, setScopes] = useState<Scope[]>([]);
  const [variables, setVariables] = useState<Variable[]>([]);
  const [breakpoints, setBreakpoints] = useState<Map<string, Breakpoint[]>>(new Map());
  const [outputs, setOutputs] = useState<DebugOutput[]>([]);

  // Refs
  const currentThreadRef = useRef<number>(1);

  // WebSocket for real-time events
  const { on, isConnected } = useWebSocket({
    token,
    autoConnect: true,
  });

  // ============================================================================
  // HELPERS (defined early to be available in event handlers)
  // ============================================================================

  const addOutput = useCallback(
    (category: 'stdout' | 'stderr' | 'console', output: string) => {
      const debugOutput: DebugOutput = {
        category,
        output,
        timestamp: new Date(),
      };
      setOutputs((prev) => [...prev, debugOutput]);
      onOutput?.(debugOutput);
    },
    [onOutput]
  );

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  useEffect(() => {
    if (!isConnected) return;

    // Listen for debug events
    const unsubInitialized = on('debug:initialized', () => {
      setState('running');
    });

    const unsubStopped = on('debug:stopped', (msg) => {
      const payload = msg.payload as { reason: string; threadId?: number };
      setState('paused');
      currentThreadRef.current = payload.threadId || 1;
    });

    const unsubContinued = on('debug:continued', () => {
      setState('running');
    });

    const unsubExited = on('debug:exited', (msg) => {
      const payload = msg.payload as { exitCode: number };
      setState('stopped');
      addOutput('console', `Process exited with code ${payload.exitCode}`);
    });

    const unsubTerminated = on('debug:terminated', () => {
      setState('stopped');
      setSessionId(null);
    });

    const unsubOutput = on('debug:output', (msg) => {
      const payload = msg.payload as { category: string; output: string };
      addOutput(payload.category as 'stdout' | 'stderr', payload.output);
    });

    return () => {
      unsubInitialized();
      unsubStopped();
      unsubContinued();
      unsubExited();
      unsubTerminated();
      unsubOutput();
    };
  }, [isConnected, on, addOutput]);

  // Notify on state change
  useEffect(() => {
    onStateChange?.(state);
  }, [state, onStateChange]);

  const callAPI = useCallback(
    async (action: string, params: Record<string, unknown> = {}) => {
      const response = await fetch('/api/code-lab/debug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          sessionId,
          ...params,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'API request failed');
      }

      return response.json();
    },
    [sessionId]
  );

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const start = useCallback(
    async (config: DebugConfiguration) => {
      try {
        setError(null);
        setState('starting');
        setOutputs([]);

        addOutput('console', `Starting ${config.type} debugger for ${config.program}...`);

        const result = await callAPI('start', {
          config,
          workspaceId,
        });

        setSessionId(result.session.id);
        addOutput('console', `Debug session started: ${result.session.id}`);
      } catch (err) {
        setError((err as Error).message);
        setState('error');
        addOutput('console', `Error: ${(err as Error).message}`);
      }
    },
    [callAPI, workspaceId, addOutput]
  );

  const stop = useCallback(async () => {
    if (!sessionId) return;

    try {
      await callAPI('stop');
      setState('stopped');
      setSessionId(null);
      addOutput('console', 'Debug session stopped');
    } catch (err) {
      setError((err as Error).message);
    }
  }, [sessionId, callAPI, addOutput]);

  const setBreakpointsForFile = useCallback(
    async (filePath: string, lines: number[]): Promise<Breakpoint[]> => {
      if (!sessionId) return [];

      try {
        const result = await callAPI('setBreakpoints', {
          source: { path: filePath },
          breakpoints: lines.map((line) => ({ line })),
        });

        const verified = result.breakpoints as Breakpoint[];
        setBreakpoints((prev) => {
          const next = new Map(prev);
          next.set(filePath, verified);
          return next;
        });

        return verified;
      } catch (err) {
        setError((err as Error).message);
        return [];
      }
    },
    [sessionId, callAPI]
  );

  const removeBreakpoint = useCallback(
    async (filePath: string, line: number) => {
      const current = breakpoints.get(filePath) || [];
      const remaining = current.filter((bp) => bp.line !== line);
      await setBreakpointsForFile(
        filePath,
        remaining.map((bp) => bp.line)
      );
    },
    [breakpoints, setBreakpointsForFile]
  );

  const continueExecution = useCallback(async () => {
    if (!sessionId) return;
    await callAPI('continue', { threadId: currentThreadRef.current });
  }, [sessionId, callAPI]);

  const stepOver = useCallback(async () => {
    if (!sessionId) return;
    await callAPI('stepOver', { threadId: currentThreadRef.current });
  }, [sessionId, callAPI]);

  const stepInto = useCallback(async () => {
    if (!sessionId) return;
    await callAPI('stepInto', { threadId: currentThreadRef.current });
  }, [sessionId, callAPI]);

  const stepOut = useCallback(async () => {
    if (!sessionId) return;
    await callAPI('stepOut', { threadId: currentThreadRef.current });
  }, [sessionId, callAPI]);

  const pause = useCallback(async () => {
    if (!sessionId) return;
    await callAPI('pause', { threadId: currentThreadRef.current });
  }, [sessionId, callAPI]);

  const evaluate = useCallback(
    async (expression: string, frameId?: number): Promise<string> => {
      if (!sessionId) return '';

      try {
        const result = await callAPI('evaluate', { expression, frameId });
        return result.result;
      } catch (err) {
        return `Error: ${(err as Error).message}`;
      }
    },
    [sessionId, callAPI]
  );

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  const loadStackTrace = useCallback(
    async (threadId?: number) => {
      if (!sessionId) return;

      try {
        const result = await callAPI('getStackTrace', {
          threadId: threadId || currentThreadRef.current,
        });
        setStackFrames(result.stackFrames);
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [sessionId, callAPI]
  );

  const loadScopes = useCallback(
    async (frameId: number) => {
      if (!sessionId) return;

      try {
        const result = await callAPI('getScopes', { frameId });
        setScopes(result.scopes);
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [sessionId, callAPI]
  );

  const loadVariables = useCallback(
    async (variablesReference: number) => {
      if (!sessionId) return;

      try {
        const result = await callAPI('getVariables', { variablesReference });
        setVariables(result.variables);
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [sessionId, callAPI]
  );

  // ============================================================================
  // RETURN
  // ============================================================================

  return {
    // State
    state,
    sessionId,
    error,

    // Debug info
    threads,
    stackFrames,
    scopes,
    variables,
    breakpoints,
    outputs,

    // Actions
    start,
    stop,
    setBreakpoints: setBreakpointsForFile,
    removeBreakpoint,
    continue: continueExecution,
    stepOver,
    stepInto,
    stepOut,
    pause,
    evaluate,

    // Data fetching
    loadStackTrace,
    loadScopes,
    loadVariables,
  };
}
