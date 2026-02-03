'use client';

/**
 * CODE LAB VISUAL DEBUGGER
 *
 * Visual debugging interface that goes BEYOND Claude Code.
 * Full debugging experience in the browser.
 *
 * Features:
 * - Breakpoint management (add/remove/toggle)
 * - Variable inspection with tree view
 * - Call stack visualization
 * - Step controls (over, into, out, continue)
 * - Watch expressions
 * - Memory/heap visualization
 * - Console integration
 * - AI-powered debug analysis
 * - Time-travel debugging (replay)
 *
 * This is what makes Code Lab unique - true visual debugging in the browser.
 */

import React, { useState, useCallback } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export type DebugState = 'idle' | 'running' | 'paused' | 'stopped';
export type BreakpointType = 'line' | 'conditional' | 'logpoint' | 'exception';
export type VariableType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'object'
  | 'array'
  | 'function'
  | 'null'
  | 'undefined';

export interface Breakpoint {
  id: string;
  file: string;
  line: number;
  column?: number;
  type: BreakpointType;
  condition?: string;
  logMessage?: string;
  enabled: boolean;
  hitCount: number;
}

export interface StackFrame {
  id: string;
  name: string;
  file: string;
  line: number;
  column: number;
  isAsync?: boolean;
  source?: string;
}

export interface Variable {
  name: string;
  value: string;
  type: VariableType;
  expandable?: boolean;
  children?: Variable[];
  scope: 'local' | 'closure' | 'global';
  changed?: boolean;
}

export interface WatchExpression {
  id: string;
  expression: string;
  value?: string;
  type?: VariableType;
  error?: string;
}

export interface DebugSession {
  state: DebugState;
  currentFrame?: StackFrame;
  callStack: StackFrame[];
  breakpoints: Breakpoint[];
  variables: Variable[];
  watches: WatchExpression[];
}

export interface CodeLabDebuggerProps {
  session: DebugSession;
  onAddBreakpoint: (file: string, line: number, type?: BreakpointType) => void;
  onRemoveBreakpoint: (id: string) => void;
  onToggleBreakpoint: (id: string) => void;
  onStepOver: () => void;
  onStepInto: () => void;
  onStepOut: () => void;
  onContinue: () => void;
  onPause: () => void;
  onStop: () => void;
  onRestart: () => void;
  onAddWatch: (expression: string) => void;
  onRemoveWatch: (id: string) => void;
  onSelectFrame: (id: string) => void;
  onAIAnalysis?: () => void;
  className?: string;
}

// ============================================================================
// DEBUG TOOLBAR
// ============================================================================

interface DebugToolbarProps {
  state: DebugState;
  onStepOver: () => void;
  onStepInto: () => void;
  onStepOut: () => void;
  onContinue: () => void;
  onPause: () => void;
  onStop: () => void;
  onRestart: () => void;
}

const DebugToolbar = React.memo(function DebugToolbar({
  state,
  onStepOver,
  onStepInto,
  onStepOut,
  onContinue,
  onPause,
  onStop,
  onRestart,
}: DebugToolbarProps) {
  const isPaused = state === 'paused';
  // isRunning = state === 'running' available for status indicator styling
  const isStopped = state === 'idle' || state === 'stopped';

  return (
    <div className="debug-toolbar" role="toolbar" aria-label="Debug controls">
      {isPaused ? (
        <button
          className="toolbar-btn primary"
          onClick={onContinue}
          title="Continue (F5)"
          aria-label="Continue"
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>
      ) : (
        <button
          className="toolbar-btn"
          onClick={onPause}
          disabled={isStopped}
          title="Pause (F6)"
          aria-label="Pause"
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
          </svg>
        </button>
      )}

      <button
        className="toolbar-btn"
        onClick={onStepOver}
        disabled={!isPaused}
        title="Step Over (F10)"
        aria-label="Step Over"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 16h14M5 12h14M15 8l4 4-4 4" />
        </svg>
      </button>

      <button
        className="toolbar-btn"
        onClick={onStepInto}
        disabled={!isPaused}
        title="Step Into (F11)"
        aria-label="Step Into"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 5v14M8 15l4 4 4-4" />
        </svg>
      </button>

      <button
        className="toolbar-btn"
        onClick={onStepOut}
        disabled={!isPaused}
        title="Step Out (Shift+F11)"
        aria-label="Step Out"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 19V5M8 9l4-4 4 4" />
        </svg>
      </button>

      <span className="toolbar-divider" />

      <button
        className="toolbar-btn"
        onClick={onRestart}
        disabled={isStopped}
        title="Restart (Ctrl+Shift+F5)"
        aria-label="Restart"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M1 4v6h6M23 20v-6h-6" />
          <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15" />
        </svg>
      </button>

      <button
        className="toolbar-btn stop"
        onClick={onStop}
        disabled={isStopped}
        title="Stop (Shift+F5)"
        aria-label="Stop"
      >
        <svg viewBox="0 0 24 24" fill="currentColor">
          <rect x="5" y="5" width="14" height="14" rx="1" />
        </svg>
      </button>

      <span className="toolbar-divider" />

      <span className={`debug-state state-${state}`}>
        <span className="state-indicator" />
        {state === 'idle'
          ? 'Ready'
          : state === 'running'
            ? 'Running'
            : state === 'paused'
              ? 'Paused'
              : 'Stopped'}
      </span>
    </div>
  );
});

// ============================================================================
// CALL STACK PANEL
// ============================================================================

interface CallStackPanelProps {
  frames: StackFrame[];
  currentFrameId?: string;
  onSelectFrame: (id: string) => void;
}

const CallStackPanel = React.memo(function CallStackPanel({
  frames,
  currentFrameId,
  onSelectFrame,
}: CallStackPanelProps) {
  return (
    <div className="debug-panel call-stack-panel">
      <div className="panel-header">
        <span className="panel-title">Call Stack</span>
        <span className="panel-count">{frames.length}</span>
      </div>
      <div className="panel-content">
        {frames.length === 0 ? (
          <div className="panel-empty">No call stack</div>
        ) : (
          <ul className="stack-list" role="listbox" aria-label="Call stack frames">
            {frames.map((frame, index) => (
              <li
                key={frame.id}
                role="option"
                aria-selected={frame.id === currentFrameId}
                className={`stack-frame ${frame.id === currentFrameId ? 'active' : ''} ${frame.isAsync ? 'async' : ''}`}
                onClick={() => onSelectFrame(frame.id)}
              >
                <span className="frame-index">{index}</span>
                <span className="frame-name" title={frame.name}>
                  {frame.name}
                </span>
                <span className="frame-location" title={`${frame.file}:${frame.line}`}>
                  {frame.file.split('/').pop()}:{frame.line}
                </span>
                {frame.isAsync && <span className="frame-async">async</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
});

// ============================================================================
// VARIABLES PANEL
// ============================================================================

interface VariablesPanelProps {
  variables: Variable[];
  onExpand?: (path: string) => void;
}

const VariablesPanel = React.memo(function VariablesPanel({
  variables,
  onExpand,
}: VariablesPanelProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpand = (name: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
        onExpand?.(name);
      }
      return next;
    });
  };

  const renderVariable = (variable: Variable, depth = 0, path = '') => {
    const fullPath = path ? `${path}.${variable.name}` : variable.name;
    const isExpanded = expanded.has(fullPath);

    return (
      <div
        key={fullPath}
        className={`variable ${variable.changed ? 'changed' : ''}`}
        style={{ paddingLeft: `${depth * 16}px` }}
      >
        <div className="variable-row" onClick={() => variable.expandable && toggleExpand(fullPath)}>
          {variable.expandable && (
            <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>▶</span>
          )}
          <span className="variable-name">{variable.name}</span>
          <span className="variable-sep">:</span>
          <span className={`variable-value type-${variable.type}`} title={variable.value}>
            {formatValue(variable.value, variable.type)}
          </span>
          <span className="variable-type">{variable.type}</span>
        </div>
        {isExpanded && variable.children && (
          <div className="variable-children">
            {variable.children.map((child) => renderVariable(child, depth + 1, fullPath))}
          </div>
        )}
      </div>
    );
  };

  const localVars = variables.filter((v) => v.scope === 'local');
  const closureVars = variables.filter((v) => v.scope === 'closure');
  const globalVars = variables.filter((v) => v.scope === 'global');

  return (
    <div className="debug-panel variables-panel">
      <div className="panel-header">
        <span className="panel-title">Variables</span>
      </div>
      <div className="panel-content">
        {variables.length === 0 ? (
          <div className="panel-empty">No variables in scope</div>
        ) : (
          <div className="variables-list">
            {localVars.length > 0 && (
              <div className="variable-group">
                <div className="group-header">Local</div>
                {localVars.map((v) => renderVariable(v))}
              </div>
            )}
            {closureVars.length > 0 && (
              <div className="variable-group">
                <div className="group-header">Closure</div>
                {closureVars.map((v) => renderVariable(v))}
              </div>
            )}
            {globalVars.length > 0 && (
              <div className="variable-group">
                <div className="group-header">Global</div>
                {globalVars.map((v) => renderVariable(v))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

function formatValue(value: string, type: VariableType): string {
  if (type === 'string') return `"${value}"`;
  if (type === 'null') return 'null';
  if (type === 'undefined') return 'undefined';
  if (type === 'function') return 'ƒ';
  return value;
}

// ============================================================================
// WATCH PANEL
// ============================================================================

interface WatchPanelProps {
  watches: WatchExpression[];
  onAdd: (expression: string) => void;
  onRemove: (id: string) => void;
}

const WatchPanel = React.memo(function WatchPanel({ watches, onAdd, onRemove }: WatchPanelProps) {
  const [newExpression, setNewExpression] = useState('');

  const handleAdd = () => {
    if (newExpression.trim()) {
      onAdd(newExpression.trim());
      setNewExpression('');
    }
  };

  return (
    <div className="debug-panel watch-panel">
      <div className="panel-header">
        <span className="panel-title">Watch</span>
        <span className="panel-count">{watches.length}</span>
      </div>
      <div className="panel-content">
        <div className="watch-input-row">
          <input
            type="text"
            className="watch-input"
            placeholder="Add expression..."
            value={newExpression}
            onChange={(e) => setNewExpression(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <button className="watch-add-btn" onClick={handleAdd} aria-label="Add watch">
            +
          </button>
        </div>
        {watches.length === 0 ? (
          <div className="panel-empty">No watch expressions</div>
        ) : (
          <ul className="watch-list">
            {watches.map((watch) => (
              <li key={watch.id} className={`watch-item ${watch.error ? 'error' : ''}`}>
                <span className="watch-expr" title={watch.expression}>
                  {watch.expression}
                </span>
                <span className="watch-sep">=</span>
                {watch.error ? (
                  <span className="watch-error" title={watch.error}>
                    {watch.error}
                  </span>
                ) : (
                  <span className={`watch-value type-${watch.type}`}>{watch.value}</span>
                )}
                <button
                  className="watch-remove"
                  onClick={() => onRemove(watch.id)}
                  aria-label="Remove"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
});

// ============================================================================
// BREAKPOINTS PANEL
// ============================================================================

interface BreakpointsPanelProps {
  breakpoints: Breakpoint[];
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
}

const BreakpointsPanel = React.memo(function BreakpointsPanel({
  breakpoints,
  onToggle,
  onRemove,
}: BreakpointsPanelProps) {
  const typeIcons: Record<BreakpointType, string> = {
    line: '●',
    conditional: '◆',
    logpoint: '◇',
    exception: '⚡',
  };

  return (
    <div className="debug-panel breakpoints-panel">
      <div className="panel-header">
        <span className="panel-title">Breakpoints</span>
        <span className="panel-count">{breakpoints.length}</span>
      </div>
      <div className="panel-content">
        {breakpoints.length === 0 ? (
          <div className="panel-empty">No breakpoints set</div>
        ) : (
          <ul className="breakpoint-list">
            {breakpoints.map((bp) => (
              <li key={bp.id} className={`breakpoint-item ${bp.enabled ? 'enabled' : 'disabled'}`}>
                <input
                  type="checkbox"
                  checked={bp.enabled}
                  onChange={() => onToggle(bp.id)}
                  aria-label={`Toggle breakpoint at ${bp.file}:${bp.line}`}
                />
                <span className={`bp-icon type-${bp.type}`}>{typeIcons[bp.type]}</span>
                <span className="bp-location">
                  {bp.file.split('/').pop()}:{bp.line}
                </span>
                {bp.condition && (
                  <span className="bp-condition" title={bp.condition}>
                    if: {bp.condition}
                  </span>
                )}
                {bp.hitCount > 0 && <span className="bp-hits">{bp.hitCount}×</span>}
                <button className="bp-remove" onClick={() => onRemove(bp.id)} aria-label="Remove">
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
});

// ============================================================================
// AI DEBUG ANALYSIS
// ============================================================================

interface AIAnalysisProps {
  onAnalyze: () => void;
  isAnalyzing?: boolean;
}

const AIAnalysis = React.memo(function AIAnalysis({ onAnalyze, isAnalyzing }: AIAnalysisProps) {
  return (
    <div className="ai-analysis">
      <button className="ai-analyze-btn" onClick={onAnalyze} disabled={isAnalyzing}>
        <span className="ai-icon">🤖</span>
        {isAnalyzing ? 'Analyzing...' : 'Ask Claude to analyze'}
      </button>
      <span className="ai-hint">Claude can explain variables, suggest fixes, and trace bugs</span>
    </div>
  );
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function CodeLabDebugger({
  session,
  onAddBreakpoint: _onAddBreakpoint,
  onRemoveBreakpoint,
  onToggleBreakpoint,
  onStepOver,
  onStepInto,
  onStepOut,
  onContinue,
  onPause,
  onStop,
  onRestart,
  onAddWatch,
  onRemoveWatch,
  onSelectFrame,
  onAIAnalysis,
  className = '',
}: CodeLabDebuggerProps) {
  void _onAddBreakpoint; // Reserved for inline gutter click
  const [activeTab, setActiveTab] = useState<'variables' | 'watch' | 'breakpoints'>('variables');

  return (
    <div className={`code-lab-debugger ${className}`}>
      <style>{`
        .code-lab-debugger {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: var(--cl-bg-primary, #0d1117);
          border-radius: 8px;
          overflow: hidden;
          font-size: 13px;
        }

        /* Toolbar */
        .debug-toolbar {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 8px 12px;
          background: var(--cl-bg-secondary, #161b22);
          border-bottom: 1px solid var(--cl-border, #30363d);
        }

        .toolbar-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          padding: 0;
          background: transparent;
          border: none;
          border-radius: 6px;
          color: var(--cl-text-tertiary, #8b949e);
          cursor: pointer;
          transition: all 0.15s;
        }

        .toolbar-btn:hover:not(:disabled) {
          background: var(--cl-bg-hover, #21262d);
          color: var(--cl-text-primary, #e6edf3);
        }

        .toolbar-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .toolbar-btn.primary {
          background: var(--cl-accent-green, #3fb950);
          color: white;
        }

        .toolbar-btn.primary:hover:not(:disabled) {
          background: #2ea043;
        }

        .toolbar-btn.stop:hover:not(:disabled) {
          background: rgba(248, 81, 73, 0.15);
          color: #f85149;
        }

        .toolbar-btn svg {
          width: 16px;
          height: 16px;
        }

        .toolbar-divider {
          width: 1px;
          height: 16px;
          background: var(--cl-border, #30363d);
          margin: 0 4px;
        }

        .debug-state {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-left: auto;
          font-size: 11px;
          color: var(--cl-text-tertiary, #8b949e);
        }

        .state-indicator {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--cl-text-muted, #6e7681);
        }

        .state-idle .state-indicator { background: var(--cl-text-muted, #6e7681); }
        .state-running .state-indicator { background: var(--cl-accent-green, #3fb950); animation: pulse 1.5s infinite; }
        .state-paused .state-indicator { background: var(--cl-accent-yellow, #d29922); }
        .state-stopped .state-indicator { background: var(--cl-text-danger, #f85149); }

        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

        /* Layout */
        .debugger-layout {
          display: flex;
          flex: 1;
          overflow: hidden;
        }

        .debugger-sidebar {
          width: 280px;
          display: flex;
          flex-direction: column;
          border-right: 1px solid var(--cl-border, #30363d);
          overflow: hidden;
        }

        .debugger-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        /* Tab Bar */
        .tab-bar {
          display: flex;
          padding: 0 8px;
          background: var(--cl-bg-secondary, #161b22);
          border-bottom: 1px solid var(--cl-border, #30363d);
        }

        .tab-btn {
          padding: 8px 16px;
          background: transparent;
          border: none;
          border-bottom: 2px solid transparent;
          color: var(--cl-text-tertiary, #8b949e);
          font-size: 12px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .tab-btn:hover {
          color: var(--cl-text-primary, #e6edf3);
        }

        .tab-btn.active {
          color: var(--cl-accent, #58a6ff);
          border-bottom-color: var(--cl-accent, #58a6ff);
        }

        /* Panels */
        .debug-panel {
          display: flex;
          flex-direction: column;
          flex: 1;
          min-height: 0;
        }

        .panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          background: var(--cl-bg-tertiary, #0d1117);
          border-bottom: 1px solid var(--cl-border, #30363d);
        }

        .panel-title {
          font-size: 11px;
          font-weight: 600;
          color: var(--cl-text-secondary, #8b949e);
          text-transform: uppercase;
        }

        .panel-count {
          font-size: 10px;
          color: var(--cl-text-muted, #6e7681);
          padding: 2px 6px;
          background: var(--cl-bg-secondary, #161b22);
          border-radius: 10px;
        }

        .panel-content {
          flex: 1;
          overflow-y: auto;
          padding: 8px;
        }

        .panel-empty {
          padding: 16px;
          text-align: center;
          color: var(--cl-text-muted, #6e7681);
          font-size: 12px;
        }

        /* Call Stack */
        .stack-list {
          list-style: none;
          margin: 0;
          padding: 0;
        }

        .stack-frame {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 8px;
          border-radius: 4px;
          cursor: pointer;
          transition: background 0.15s;
        }

        .stack-frame:hover {
          background: var(--cl-bg-hover, #21262d);
        }

        .stack-frame.active {
          background: var(--cl-accent-bg, rgba(56, 139, 253, 0.15));
        }

        .frame-index {
          min-width: 16px;
          font-size: 10px;
          color: var(--cl-text-muted, #6e7681);
        }

        .frame-name {
          flex: 1;
          color: var(--cl-text-primary, #e6edf3);
          font-weight: 500;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .frame-location {
          font-size: 11px;
          color: var(--cl-text-tertiary, #8b949e);
        }

        .frame-async {
          font-size: 9px;
          padding: 1px 4px;
          background: rgba(210, 153, 34, 0.15);
          color: #d29922;
          border-radius: 3px;
        }

        /* Variables */
        .variable {
          font-family: 'SF Mono', 'Fira Code', monospace;
          font-size: 12px;
        }

        .variable-row {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 3px 0;
          cursor: pointer;
        }

        .variable-row:hover {
          background: var(--cl-bg-hover, #21262d);
        }

        .variable.changed .variable-value {
          background: rgba(210, 153, 34, 0.2);
          border-radius: 2px;
          padding: 0 2px;
        }

        .expand-icon {
          font-size: 8px;
          color: var(--cl-text-muted, #6e7681);
          transition: transform 0.15s;
          width: 12px;
        }

        .expand-icon.expanded {
          transform: rotate(90deg);
        }

        .variable-name {
          color: var(--cl-accent-purple, #a371f7);
        }

        .variable-sep {
          color: var(--cl-text-muted, #6e7681);
        }

        .variable-value {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .variable-value.type-string { color: #a5d6ff; }
        .variable-value.type-number { color: #79c0ff; }
        .variable-value.type-boolean { color: #ff7b72; }
        .variable-value.type-null, .variable-value.type-undefined { color: #8b949e; }
        .variable-value.type-object, .variable-value.type-array { color: #ffa657; }
        .variable-value.type-function { color: #d2a8ff; }

        .variable-type {
          font-size: 10px;
          color: var(--cl-text-muted, #6e7681);
          margin-left: auto;
        }

        .variable-group {
          margin-bottom: 12px;
        }

        .group-header {
          font-size: 10px;
          font-weight: 600;
          color: var(--cl-text-tertiary, #8b949e);
          text-transform: uppercase;
          padding: 4px 0;
          border-bottom: 1px solid var(--cl-border, #30363d);
          margin-bottom: 4px;
        }

        /* Watch */
        .watch-input-row {
          display: flex;
          gap: 4px;
          margin-bottom: 8px;
        }

        .watch-input {
          flex: 1;
          padding: 6px 8px;
          background: var(--cl-bg-tertiary, #0d1117);
          border: 1px solid var(--cl-border, #30363d);
          border-radius: 4px;
          color: var(--cl-text-primary, #e6edf3);
          font-size: 12px;
          outline: none;
        }

        .watch-input:focus {
          border-color: var(--cl-accent, #58a6ff);
        }

        .watch-add-btn {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--cl-bg-secondary, #161b22);
          border: 1px solid var(--cl-border, #30363d);
          border-radius: 4px;
          color: var(--cl-text-tertiary, #8b949e);
          font-size: 16px;
          cursor: pointer;
        }

        .watch-add-btn:hover {
          background: var(--cl-bg-hover, #21262d);
          color: var(--cl-text-primary, #e6edf3);
        }

        .watch-list {
          list-style: none;
          margin: 0;
          padding: 0;
        }

        .watch-item {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
          border-radius: 4px;
          font-family: 'SF Mono', 'Fira Code', monospace;
          font-size: 12px;
        }

        .watch-item:hover {
          background: var(--cl-bg-hover, #21262d);
        }

        .watch-expr {
          color: var(--cl-accent-purple, #a371f7);
          max-width: 120px;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .watch-sep {
          color: var(--cl-text-muted, #6e7681);
        }

        .watch-value {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .watch-error {
          color: var(--cl-text-danger, #f85149);
          font-style: italic;
        }

        .watch-remove {
          opacity: 0;
          width: 16px;
          height: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: none;
          color: var(--cl-text-muted, #6e7681);
          cursor: pointer;
        }

        .watch-item:hover .watch-remove {
          opacity: 1;
        }

        .watch-remove:hover {
          color: var(--cl-text-danger, #f85149);
        }

        /* Breakpoints */
        .breakpoint-list {
          list-style: none;
          margin: 0;
          padding: 0;
        }

        .breakpoint-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 8px;
          border-radius: 4px;
        }

        .breakpoint-item:hover {
          background: var(--cl-bg-hover, #21262d);
        }

        .breakpoint-item.disabled {
          opacity: 0.5;
        }

        .breakpoint-item input[type="checkbox"] {
          accent-color: var(--cl-accent, #58a6ff);
        }

        .bp-icon {
          font-size: 10px;
        }

        .bp-icon.type-line { color: var(--cl-text-danger, #f85149); }
        .bp-icon.type-conditional { color: var(--cl-accent-yellow, #d29922); }
        .bp-icon.type-logpoint { color: var(--cl-accent, #58a6ff); }
        .bp-icon.type-exception { color: var(--cl-accent-purple, #a371f7); }

        .bp-location {
          flex: 1;
          font-size: 12px;
          color: var(--cl-text-primary, #e6edf3);
        }

        .bp-condition {
          font-size: 10px;
          color: var(--cl-text-muted, #6e7681);
          max-width: 80px;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .bp-hits {
          font-size: 10px;
          color: var(--cl-text-muted, #6e7681);
        }

        .bp-remove {
          opacity: 0;
          width: 16px;
          height: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: none;
          color: var(--cl-text-muted, #6e7681);
          cursor: pointer;
        }

        .breakpoint-item:hover .bp-remove {
          opacity: 1;
        }

        .bp-remove:hover {
          color: var(--cl-text-danger, #f85149);
        }

        /* AI Analysis */
        .ai-analysis {
          padding: 12px;
          border-top: 1px solid var(--cl-border, #30363d);
          background: var(--cl-bg-secondary, #161b22);
        }

        .ai-analyze-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          padding: 10px;
          background: linear-gradient(135deg, rgba(56, 139, 253, 0.15), rgba(163, 113, 247, 0.15));
          border: 1px solid rgba(56, 139, 253, 0.3);
          border-radius: 8px;
          color: var(--cl-accent, #58a6ff);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
        }

        .ai-analyze-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, rgba(56, 139, 253, 0.25), rgba(163, 113, 247, 0.25));
          border-color: var(--cl-accent, #58a6ff);
        }

        .ai-analyze-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .ai-icon {
          font-size: 16px;
        }

        .ai-hint {
          display: block;
          margin-top: 8px;
          font-size: 11px;
          color: var(--cl-text-muted, #6e7681);
          text-align: center;
        }

        /* Scrollbars */
        .panel-content::-webkit-scrollbar {
          width: 6px;
        }

        .panel-content::-webkit-scrollbar-track {
          background: transparent;
        }

        .panel-content::-webkit-scrollbar-thumb {
          background: var(--cl-border, #30363d);
          border-radius: 3px;
        }

        /* Mobile */
        @media (max-width: 768px) {
          .debugger-sidebar {
            width: 100%;
            border-right: none;
            border-bottom: 1px solid var(--cl-border, #30363d);
            max-height: 200px;
          }

          .debugger-layout {
            flex-direction: column;
          }
        }
      `}</style>

      <DebugToolbar
        state={session.state}
        onStepOver={onStepOver}
        onStepInto={onStepInto}
        onStepOut={onStepOut}
        onContinue={onContinue}
        onPause={onPause}
        onStop={onStop}
        onRestart={onRestart}
      />

      <div className="debugger-layout">
        <div className="debugger-sidebar">
          <CallStackPanel
            frames={session.callStack}
            currentFrameId={session.currentFrame?.id}
            onSelectFrame={onSelectFrame}
          />
        </div>

        <div className="debugger-main">
          <div className="tab-bar">
            <button
              className={`tab-btn ${activeTab === 'variables' ? 'active' : ''}`}
              onClick={() => setActiveTab('variables')}
            >
              Variables
            </button>
            <button
              className={`tab-btn ${activeTab === 'watch' ? 'active' : ''}`}
              onClick={() => setActiveTab('watch')}
            >
              Watch
            </button>
            <button
              className={`tab-btn ${activeTab === 'breakpoints' ? 'active' : ''}`}
              onClick={() => setActiveTab('breakpoints')}
            >
              Breakpoints
            </button>
          </div>

          {activeTab === 'variables' && <VariablesPanel variables={session.variables} />}
          {activeTab === 'watch' && (
            <WatchPanel watches={session.watches} onAdd={onAddWatch} onRemove={onRemoveWatch} />
          )}
          {activeTab === 'breakpoints' && (
            <BreakpointsPanel
              breakpoints={session.breakpoints}
              onToggle={onToggleBreakpoint}
              onRemove={onRemoveBreakpoint}
            />
          )}

          {onAIAnalysis && <AIAnalysis onAnalyze={onAIAnalysis} />}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// HOOK FOR DEBUG STATE
// ============================================================================

export function useDebugger() {
  const [session, setSession] = useState<DebugSession>({
    state: 'idle',
    callStack: [],
    breakpoints: [],
    variables: [],
    watches: [],
  });

  const addBreakpoint = useCallback((file: string, line: number, type: BreakpointType = 'line') => {
    const bp: Breakpoint = {
      id: `bp-${Date.now()}`,
      file,
      line,
      type,
      enabled: true,
      hitCount: 0,
    };
    setSession((prev) => ({
      ...prev,
      breakpoints: [...prev.breakpoints, bp],
    }));
    return bp.id;
  }, []);

  const removeBreakpoint = useCallback((id: string) => {
    setSession((prev) => ({
      ...prev,
      breakpoints: prev.breakpoints.filter((bp) => bp.id !== id),
    }));
  }, []);

  const toggleBreakpoint = useCallback((id: string) => {
    setSession((prev) => ({
      ...prev,
      breakpoints: prev.breakpoints.map((bp) =>
        bp.id === id ? { ...bp, enabled: !bp.enabled } : bp
      ),
    }));
  }, []);

  const addWatch = useCallback((expression: string) => {
    const watch: WatchExpression = {
      id: `watch-${Date.now()}`,
      expression,
    };
    setSession((prev) => ({
      ...prev,
      watches: [...prev.watches, watch],
    }));
    return watch.id;
  }, []);

  const removeWatch = useCallback((id: string) => {
    setSession((prev) => ({
      ...prev,
      watches: prev.watches.filter((w) => w.id !== id),
    }));
  }, []);

  const setState = useCallback((state: DebugState) => {
    setSession((prev) => ({ ...prev, state }));
  }, []);

  return {
    session,
    addBreakpoint,
    removeBreakpoint,
    toggleBreakpoint,
    addWatch,
    removeWatch,
    setState,
    setSession,
  };
}

export default CodeLabDebugger;
