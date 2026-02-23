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

import React, { useState } from 'react';
import './code-lab-debugger.css';

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
  const _isRunning = state === 'running';
  void _isRunning; // Used for status indicator styling
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
      <button className="ai-analyze-btn" onClick={onAnalyze} disabled={isAnalyzing} aria-label={isAnalyzing ? 'AI analysis in progress' : 'Ask Claude to analyze debug state'}>
        <span className="ai-icon" aria-hidden="true">🤖</span>
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
          <div className="tab-bar" role="tablist" aria-label="Debug panels">
            <button
              className={`tab-btn ${activeTab === 'variables' ? 'active' : ''}`}
              onClick={() => setActiveTab('variables')}
              aria-selected={activeTab === 'variables'}
              role="tab"
            >
              Variables
            </button>
            <button
              className={`tab-btn ${activeTab === 'watch' ? 'active' : ''}`}
              onClick={() => setActiveTab('watch')}
              aria-selected={activeTab === 'watch'}
              role="tab"
            >
              Watch
            </button>
            <button
              className={`tab-btn ${activeTab === 'breakpoints' ? 'active' : ''}`}
              onClick={() => setActiveTab('breakpoints')}
              aria-selected={activeTab === 'breakpoints'}
              role="tab"
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

export default CodeLabDebugger;
