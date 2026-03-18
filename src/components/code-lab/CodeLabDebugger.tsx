'use client';

/**
 * CODE LAB VISUAL DEBUGGER
 *
 * Visual debugging interface with breakpoints, variables, call stack,
 * watch expressions, and AI-powered analysis.
 *
 * Sub-components extracted to CodeLabDebuggerPanels.tsx.
 */

import { useState } from 'react';
import './code-lab-debugger.css';

// Re-export types for consumers
export type {
  DebugState, BreakpointType, VariableType,
  Breakpoint, StackFrame, Variable, WatchExpression, DebugSession,
} from './CodeLabDebuggerPanels';

import type { DebugSession, BreakpointType } from './CodeLabDebuggerPanels';
import {
  DebugToolbar,
  CallStackPanel,
  VariablesPanel,
  WatchPanel,
  BreakpointsPanel,
  AIAnalysis,
} from './CodeLabDebuggerPanels';

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
            <button className={`tab-btn ${activeTab === 'variables' ? 'active' : ''}`} onClick={() => setActiveTab('variables')} aria-selected={activeTab === 'variables'} role="tab">Variables</button>
            <button className={`tab-btn ${activeTab === 'watch' ? 'active' : ''}`} onClick={() => setActiveTab('watch')} aria-selected={activeTab === 'watch'} role="tab">Watch</button>
            <button className={`tab-btn ${activeTab === 'breakpoints' ? 'active' : ''}`} onClick={() => setActiveTab('breakpoints')} aria-selected={activeTab === 'breakpoints'} role="tab">Breakpoints</button>
          </div>

          {activeTab === 'variables' && <VariablesPanel variables={session.variables} />}
          {activeTab === 'watch' && <WatchPanel watches={session.watches} onAdd={onAddWatch} onRemove={onRemoveWatch} />}
          {activeTab === 'breakpoints' && <BreakpointsPanel breakpoints={session.breakpoints} onToggle={onToggleBreakpoint} onRemove={onRemoveBreakpoint} />}

          {onAIAnalysis && <AIAnalysis onAnalyze={onAIAnalysis} />}
        </div>
      </div>
    </div>
  );
}

export default CodeLabDebugger;
