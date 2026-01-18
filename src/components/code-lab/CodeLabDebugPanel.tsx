'use client';

/**
 * CODE LAB DEBUG PANEL
 *
 * Wrapper component that connects useDebugSession hook to CodeLabDebugger UI.
 * This bridges the backend debugging infrastructure with the visual UI.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { CodeLabDebugger, DebugSession, Breakpoint as UIBreakpoint } from './CodeLabDebugger';
import {
  useDebugSession,
  DebugConfiguration,
  UseDebugSessionOptions,
} from '@/lib/debugger/useDebugSession';

interface CodeLabDebugPanelProps {
  sessionId: string;
  token: string;
  workspaceId?: string;
  onAIAnalysis?: (debugState: DebugSession) => void;
}

/**
 * Maps hook state to UI component state
 */
function mapDebugState(hookState: string): DebugSession['state'] {
  switch (hookState) {
    case 'running':
      return 'running';
    case 'paused':
      return 'paused';
    case 'stopped':
    case 'error':
      return 'stopped';
    case 'starting':
      return 'running';
    default:
      return 'idle';
  }
}

export function CodeLabDebugPanel({
  sessionId,
  token,
  workspaceId,
  onAIAnalysis,
}: CodeLabDebugPanelProps) {
  // Local state for watches and selected frame
  const [watches, setWatches] = useState<
    Array<{ id: string; expression: string; value?: string; error?: string }>
  >([]);
  const [selectedFrameId, setSelectedFrameId] = useState<string | null>(null);

  // Debug configuration state
  const [showConfig, setShowConfig] = useState(false);
  const [debugType, setDebugType] = useState<'node' | 'python'>('node');
  const [program, setProgram] = useState('');

  // Debug session hook
  const options: UseDebugSessionOptions = useMemo(
    () => ({
      token,
      workspaceId: workspaceId || sessionId,
      onStateChange: (state) => {
        // Auto-load stack trace when paused
        if (state === 'paused') {
          debugSession.loadStackTrace();
        }
      },
    }),
    [token, workspaceId, sessionId]
  );

  const debugSession = useDebugSession(options);

  // Convert hook breakpoints to UI format
  const uiBreakpoints: UIBreakpoint[] = useMemo(() => {
    const result: UIBreakpoint[] = [];
    debugSession.breakpoints.forEach((bps, filePath) => {
      bps.forEach((bp) => {
        result.push({
          id: `${filePath}:${bp.line}`,
          file: filePath,
          line: bp.line,
          column: bp.column,
          type: 'line',
          enabled: bp.verified,
          hitCount: 0,
        });
      });
    });
    return result;
  }, [debugSession.breakpoints]);

  // Convert hook stack frames to UI format
  const uiStackFrames = useMemo(() => {
    return debugSession.stackFrames.map((frame) => ({
      id: String(frame.id),
      name: frame.name,
      file: frame.source?.path || frame.source?.name || 'unknown',
      line: frame.line,
      column: frame.column,
    }));
  }, [debugSession.stackFrames]);

  // Convert hook variables to UI format
  const uiVariables = useMemo(() => {
    return debugSession.variables.map((v) => ({
      name: v.name,
      value: v.value,
      type: (v.type?.toLowerCase() || 'object') as
        | 'string'
        | 'number'
        | 'boolean'
        | 'object'
        | 'array'
        | 'function'
        | 'null'
        | 'undefined',
      expandable: v.variablesReference > 0,
      scope: 'local' as const,
    }));
  }, [debugSession.variables]);

  // Build the debug session object for the UI
  const session: DebugSession = useMemo(
    () => ({
      state: mapDebugState(debugSession.state),
      currentFrame: uiStackFrames[0],
      callStack: uiStackFrames,
      breakpoints: uiBreakpoints,
      variables: uiVariables,
      watches: watches.map((w) => ({
        id: w.id,
        expression: w.expression,
        value: w.value,
        error: w.error,
      })),
    }),
    [debugSession.state, uiStackFrames, uiBreakpoints, uiVariables, watches]
  );

  // Handlers
  const handleAddBreakpoint = useCallback(
    async (file: string, line: number) => {
      const currentLines = (debugSession.breakpoints.get(file) || []).map((bp) => bp.line);
      await debugSession.setBreakpoints(file, [...currentLines, line]);
    },
    [debugSession]
  );

  const handleRemoveBreakpoint = useCallback(
    async (id: string) => {
      const [file, lineStr] = id.split(':');
      const line = parseInt(lineStr, 10);
      await debugSession.removeBreakpoint(file, line);
    },
    [debugSession]
  );

  const handleToggleBreakpoint = useCallback(
    async (id: string) => {
      // Toggle by removing (simplified - could add enable/disable support later)
      await handleRemoveBreakpoint(id);
    },
    [handleRemoveBreakpoint]
  );

  const handleStepOver = useCallback(async () => {
    await debugSession.stepOver();
  }, [debugSession]);

  const handleStepInto = useCallback(async () => {
    await debugSession.stepInto();
  }, [debugSession]);

  const handleStepOut = useCallback(async () => {
    await debugSession.stepOut();
  }, [debugSession]);

  const handleContinue = useCallback(async () => {
    await debugSession.continue();
  }, [debugSession]);

  const handlePause = useCallback(async () => {
    await debugSession.pause();
  }, [debugSession]);

  const handleStop = useCallback(async () => {
    await debugSession.stop();
  }, [debugSession]);

  const handleRestart = useCallback(async () => {
    // Stop and restart with same config
    await debugSession.stop();
    // Would need to store last config to restart
  }, [debugSession]);

  const handleAddWatch = useCallback(
    async (expression: string) => {
      const id = `watch-${Date.now()}`;
      setWatches((prev) => [...prev, { id, expression }]);

      // Evaluate the expression
      try {
        const frameId = selectedFrameId ? parseInt(selectedFrameId, 10) : undefined;
        const value = await debugSession.evaluate(expression, frameId);
        setWatches((prev) => prev.map((w) => (w.id === id ? { ...w, value } : w)));
      } catch (err) {
        setWatches((prev) =>
          prev.map((w) => (w.id === id ? { ...w, error: (err as Error).message } : w))
        );
      }
    },
    [debugSession, selectedFrameId]
  );

  const handleRemoveWatch = useCallback((id: string) => {
    setWatches((prev) => prev.filter((w) => w.id !== id));
  }, []);

  const handleSelectFrame = useCallback(
    async (id: string) => {
      setSelectedFrameId(id);
      const frameId = parseInt(id, 10);
      await debugSession.loadScopes(frameId);
    },
    [debugSession]
  );

  const handleAIAnalysis = useCallback(() => {
    onAIAnalysis?.(session);
  }, [onAIAnalysis, session]);

  const handleStartDebug = useCallback(async () => {
    if (!program) return;

    const config: DebugConfiguration = {
      type: debugType,
      name: `Debug ${program}`,
      request: 'launch',
      program,
      cwd: '/workspace',
    };

    await debugSession.start(config);
    setShowConfig(false);
  }, [debugType, program, debugSession]);

  // Show configuration dialog when idle
  if (debugSession.state === 'idle' || showConfig) {
    return (
      <div className="debug-config-panel">
        <h3>Start Debug Session</h3>

        <div className="config-field">
          <label>Debug Type</label>
          <select
            value={debugType}
            onChange={(e) => setDebugType(e.target.value as 'node' | 'python')}
          >
            <option value="node">Node.js</option>
            <option value="python">Python</option>
          </select>
        </div>

        <div className="config-field">
          <label>Program</label>
          <input
            type="text"
            value={program}
            onChange={(e) => setProgram(e.target.value)}
            placeholder={debugType === 'node' ? 'index.js' : 'main.py'}
          />
        </div>

        <div className="config-actions">
          <button className="start-btn" onClick={handleStartDebug} disabled={!program}>
            Start Debugging
          </button>
        </div>

        {debugSession.error && <div className="debug-error">{debugSession.error}</div>}

        <style jsx>{`
          .debug-config-panel {
            padding: 1.5rem;
          }

          .debug-config-panel h3 {
            margin: 0 0 1.5rem;
            font-size: 1rem;
            font-weight: 600;
            color: #1a1f36;
          }

          .config-field {
            margin-bottom: 1rem;
          }

          .config-field label {
            display: block;
            margin-bottom: 0.5rem;
            font-size: 0.8125rem;
            font-weight: 500;
            color: #4b5563;
          }

          .config-field select,
          .config-field input {
            width: 100%;
            padding: 0.5rem 0.75rem;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            font-size: 0.875rem;
            color: #1a1f36;
          }

          .config-field select:focus,
          .config-field input:focus {
            outline: none;
            border-color: #1e3a5f;
            box-shadow: 0 0 0 2px rgba(30, 58, 95, 0.1);
          }

          .config-actions {
            margin-top: 1.5rem;
          }

          .start-btn {
            width: 100%;
            padding: 0.75rem 1rem;
            background: #1e3a5f;
            color: white;
            border: none;
            border-radius: 6px;
            font-size: 0.875rem;
            font-weight: 500;
            cursor: pointer;
            transition: background 0.2s;
          }

          .start-btn:hover:not(:disabled) {
            background: #2d4a6f;
          }

          .start-btn:disabled {
            background: #9ca3af;
            cursor: not-allowed;
          }

          .debug-error {
            margin-top: 1rem;
            padding: 0.75rem;
            background: #fef2f2;
            border: 1px solid #fecaca;
            border-radius: 6px;
            color: #dc2626;
            font-size: 0.8125rem;
          }
        `}</style>
      </div>
    );
  }

  // Show debugger UI when active
  return (
    <div className="debug-panel-wrapper">
      <CodeLabDebugger
        session={session}
        onAddBreakpoint={handleAddBreakpoint}
        onRemoveBreakpoint={handleRemoveBreakpoint}
        onToggleBreakpoint={handleToggleBreakpoint}
        onStepOver={handleStepOver}
        onStepInto={handleStepInto}
        onStepOut={handleStepOut}
        onContinue={handleContinue}
        onPause={handlePause}
        onStop={handleStop}
        onRestart={handleRestart}
        onAddWatch={handleAddWatch}
        onRemoveWatch={handleRemoveWatch}
        onSelectFrame={handleSelectFrame}
        onAIAnalysis={handleAIAnalysis}
      />

      {/* Debug Console Output */}
      {debugSession.outputs.length > 0 && (
        <div className="debug-console">
          <div className="console-header">Console Output</div>
          <div className="console-content">
            {debugSession.outputs.map((output, i) => (
              <div key={i} className={`console-line ${output.category}`}>
                <span className="console-time">{output.timestamp.toLocaleTimeString()}</span>
                <span className="console-text">{output.output}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <style jsx>{`
        .debug-panel-wrapper {
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .debug-console {
          border-top: 1px solid #e5e7eb;
          max-height: 200px;
          display: flex;
          flex-direction: column;
        }

        .console-header {
          padding: 0.5rem 1rem;
          font-size: 0.75rem;
          font-weight: 600;
          color: #4b5563;
          background: #f9fafb;
          border-bottom: 1px solid #e5e7eb;
        }

        .console-content {
          flex: 1;
          overflow-y: auto;
          padding: 0.5rem;
          font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
          font-size: 0.75rem;
          background: #1a1f36;
          color: #e5e7eb;
        }

        .console-line {
          display: flex;
          gap: 0.5rem;
          padding: 0.125rem 0;
        }

        .console-line.stderr {
          color: #f87171;
        }

        .console-line.stdout {
          color: #a3e635;
        }

        .console-time {
          color: #6b7280;
          flex-shrink: 0;
        }

        .console-text {
          white-space: pre-wrap;
          word-break: break-all;
        }
      `}</style>
    </div>
  );
}
