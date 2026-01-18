'use client';

/**
 * CODE LAB PAIR PROGRAMMING
 *
 * Revolutionary AI pair programming mode that goes BEYOND Claude Code.
 * Claude watches your typing in real-time and proactively assists.
 *
 * Features:
 * - Real-time code analysis as you type
 * - Proactive suggestions (not just on-demand)
 * - Ghost text completions (like Copilot but better)
 * - Inline annotations and hints
 * - Voice-activated commands
 * - Code quality monitoring
 * - Bug detection before you finish typing
 * - Context-aware documentation popups
 * - Learning mode (adapts to your style)
 * - Pair session recording for review
 *
 * This is what makes Code Lab unique - true AI pair programming.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export type PairMode = 'active' | 'passive' | 'off';
export type SuggestionType = 'completion' | 'refactor' | 'bug' | 'docs' | 'test' | 'security';
export type SuggestionPriority = 'low' | 'medium' | 'high' | 'critical';

export interface Suggestion {
  id: string;
  type: SuggestionType;
  priority: SuggestionPriority;
  title: string;
  description: string;
  code?: string;
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  isGhost?: boolean; // Ghost text completion
  confidence: number; // 0-1
  timestamp: Date;
}

export interface CodeContext {
  language: string;
  filename: string;
  content: string;
  cursorLine: number;
  cursorColumn: number;
  selection?: {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
    text: string;
  };
  recentEdits: Array<{
    type: 'insert' | 'delete' | 'replace';
    text: string;
    timestamp: Date;
  }>;
}

export interface PairSession {
  id: string;
  startTime: Date;
  suggestionsShown: number;
  suggestionsAccepted: number;
  suggestionsRejected: number;
  codeWritten: number;
  bugsDetected: number;
  bugsPrevented: number;
}

export interface CodeLabPairProgrammingProps {
  mode: PairMode;
  onModeChange: (mode: PairMode) => void;
  suggestions: Suggestion[];
  onSuggestionAccept: (id: string) => void;
  onSuggestionReject: (id: string) => void;
  onSuggestionDismiss: (id: string) => void;
  session?: PairSession;
  isAnalyzing?: boolean;
  className?: string;
}

// ============================================================================
// SUGGESTION CARD
// ============================================================================

interface SuggestionCardProps {
  suggestion: Suggestion;
  onAccept: () => void;
  onReject: () => void;
  onDismiss: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

const SUGGESTION_ICONS: Record<SuggestionType, string> = {
  completion: '✨',
  refactor: '🔄',
  bug: '🐛',
  docs: '📝',
  test: '🧪',
  security: '🔒',
};

const PRIORITY_COLORS: Record<SuggestionPriority, string> = {
  low: '#8b949e',
  medium: '#58a6ff',
  high: '#d29922',
  critical: '#f85149',
};

const SuggestionCard = React.memo(function SuggestionCard({
  suggestion,
  onAccept,
  onReject,
  onDismiss,
  isExpanded = false,
  onToggleExpand,
}: SuggestionCardProps) {
  const icon = SUGGESTION_ICONS[suggestion.type];
  const priorityColor = PRIORITY_COLORS[suggestion.priority];
  const confidencePercent = Math.round(suggestion.confidence * 100);

  return (
    <div
      className={`suggestion-card priority-${suggestion.priority} ${isExpanded ? 'expanded' : ''}`}
      style={{ '--priority-color': priorityColor } as React.CSSProperties}
      role="article"
      aria-label={`${suggestion.type} suggestion: ${suggestion.title}`}
    >
      <div className="suggestion-header" onClick={onToggleExpand}>
        <span className="suggestion-icon">{icon}</span>
        <div className="suggestion-info">
          <span className="suggestion-type">{suggestion.type}</span>
          <span className="suggestion-title">{suggestion.title}</span>
        </div>
        <div className="suggestion-meta">
          <span className="suggestion-confidence" title={`${confidencePercent}% confidence`}>
            <span className="confidence-bar">
              <span className="confidence-fill" style={{ width: `${confidencePercent}%` }} />
            </span>
            {confidencePercent}%
          </span>
          <button className="suggestion-dismiss" onClick={onDismiss} aria-label="Dismiss">
            ×
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="suggestion-body">
          <p className="suggestion-description">{suggestion.description}</p>

          {suggestion.code && (
            <div className="suggestion-code">
              <pre>
                <code>{suggestion.code}</code>
              </pre>
            </div>
          )}

          {suggestion.line !== undefined && (
            <span className="suggestion-location">
              Line {suggestion.line}
              {suggestion.column !== undefined ? `:${suggestion.column}` : ''}
            </span>
          )}

          <div className="suggestion-actions">
            <button className="action-accept" onClick={onAccept}>
              <span className="action-icon">✓</span>
              Accept
              <kbd>Tab</kbd>
            </button>
            <button className="action-reject" onClick={onReject}>
              <span className="action-icon">✕</span>
              Reject
              <kbd>Esc</kbd>
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

// ============================================================================
// MODE SELECTOR
// ============================================================================

interface ModeSelectorProps {
  mode: PairMode;
  onModeChange: (mode: PairMode) => void;
}

const ModeSelector = React.memo(function ModeSelector({ mode, onModeChange }: ModeSelectorProps) {
  const modes: Array<{ value: PairMode; label: string; description: string; icon: string }> = [
    {
      value: 'active',
      label: 'Active',
      description: 'Claude proactively suggests as you type',
      icon: '⚡',
    },
    { value: 'passive', label: 'Passive', description: 'Claude waits for you to ask', icon: '💤' },
    { value: 'off', label: 'Off', description: 'Pair programming disabled', icon: '⏸️' },
  ];

  return (
    <div className="mode-selector" role="radiogroup" aria-label="Pair programming mode">
      {modes.map((m) => (
        <button
          key={m.value}
          role="radio"
          aria-checked={mode === m.value}
          className={`mode-option ${mode === m.value ? 'active' : ''}`}
          onClick={() => onModeChange(m.value)}
          title={m.description}
        >
          <span className="mode-icon">{m.icon}</span>
          <span className="mode-label">{m.label}</span>
        </button>
      ))}
    </div>
  );
});

// ============================================================================
// SESSION STATS
// ============================================================================

interface SessionStatsProps {
  session: PairSession;
}

const SessionStats = React.memo(function SessionStats({ session }: SessionStatsProps) {
  const duration = useMemo(() => {
    const ms = Date.now() - session.startTime.getTime();
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
  }, [session.startTime]);

  const acceptanceRate =
    session.suggestionsShown > 0
      ? Math.round((session.suggestionsAccepted / session.suggestionsShown) * 100)
      : 0;

  return (
    <div className="session-stats" role="region" aria-label="Pair session statistics">
      <div className="stat">
        <span className="stat-value">{duration}</span>
        <span className="stat-label">Session</span>
      </div>
      <div className="stat-divider" />
      <div className="stat">
        <span className="stat-value">{session.suggestionsAccepted}</span>
        <span className="stat-label">Accepted</span>
      </div>
      <div className="stat">
        <span className="stat-value">{acceptanceRate}%</span>
        <span className="stat-label">Rate</span>
      </div>
      <div className="stat-divider" />
      <div className="stat success">
        <span className="stat-value">{session.bugsPrevented}</span>
        <span className="stat-label">Bugs Prevented</span>
      </div>
    </div>
  );
});

// ============================================================================
// ANALYZING INDICATOR
// ============================================================================

interface AnalyzingIndicatorProps {
  isAnalyzing: boolean;
}

const AnalyzingIndicator = React.memo(function AnalyzingIndicator({
  isAnalyzing,
}: AnalyzingIndicatorProps) {
  if (!isAnalyzing) return null;

  return (
    <div className="analyzing-indicator" role="status" aria-live="polite">
      <div className="analyzing-dots">
        <span />
        <span />
        <span />
      </div>
      <span className="analyzing-text">Claude is analyzing...</span>
    </div>
  );
});

// ============================================================================
// GHOST TEXT PREVIEW
// ============================================================================

export interface GhostTextProps {
  text: string;
  onAccept: () => void;
  onReject: () => void;
  visible: boolean;
}

export const GhostText = React.memo(function GhostText({
  text,
  onAccept,
  onReject,
  visible,
}: GhostTextProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!visible) return;
      if (e.key === 'Tab') {
        e.preventDefault();
        onAccept();
      } else if (e.key === 'Escape') {
        onReject();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [visible, onAccept, onReject]);

  if (!visible || !text) return null;

  return (
    <span className="ghost-text" aria-hidden="true">
      {text}
    </span>
  );
});

// ============================================================================
// INLINE ANNOTATION
// ============================================================================

export interface InlineAnnotation {
  id: string;
  line: number;
  type: 'info' | 'warning' | 'error' | 'hint';
  message: string;
}

interface InlineAnnotationsProps {
  annotations: InlineAnnotation[];
  onAnnotationClick?: (id: string) => void;
}

// Exported component for inline code annotations
export const InlineAnnotations = React.memo(function InlineAnnotations({
  annotations,
  onAnnotationClick,
}: InlineAnnotationsProps) {
  if (annotations.length === 0) return null;

  return (
    <div className="inline-annotations">
      {annotations.map((annotation) => (
        <div
          key={annotation.id}
          className={`annotation annotation-${annotation.type}`}
          onClick={() => onAnnotationClick?.(annotation.id)}
          role="note"
          aria-label={`${annotation.type}: ${annotation.message}`}
        >
          <span className="annotation-icon">
            {annotation.type === 'error'
              ? '✕'
              : annotation.type === 'warning'
                ? '⚠'
                : annotation.type === 'hint'
                  ? '💡'
                  : 'ℹ'}
          </span>
          <span className="annotation-message">{annotation.message}</span>
        </div>
      ))}
    </div>
  );
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function CodeLabPairProgramming({
  mode,
  onModeChange,
  suggestions,
  onSuggestionAccept,
  onSuggestionReject,
  onSuggestionDismiss,
  session,
  isAnalyzing = false,
  className = '',
}: CodeLabPairProgrammingProps) {
  const [expandedSuggestion, setExpandedSuggestion] = useState<string | null>(null);
  const [filter, setFilter] = useState<SuggestionType | 'all'>('all');

  // Filter suggestions
  const filteredSuggestions = useMemo(() => {
    if (filter === 'all') return suggestions;
    return suggestions.filter((s) => s.type === filter);
  }, [suggestions, filter]);

  // Group by priority
  const groupedSuggestions = useMemo(() => {
    const groups: Record<SuggestionPriority, Suggestion[]> = {
      critical: [],
      high: [],
      medium: [],
      low: [],
    };

    for (const suggestion of filteredSuggestions) {
      groups[suggestion.priority].push(suggestion);
    }

    return groups;
  }, [filteredSuggestions]);

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedSuggestion((prev) => (prev === id ? null : id));
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && expandedSuggestion) {
        setExpandedSuggestion(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [expandedSuggestion]);

  const renderSuggestionGroup = (priority: SuggestionPriority) => {
    const group = groupedSuggestions[priority];
    if (group.length === 0) return null;

    return (
      <div key={priority} className={`suggestion-group priority-${priority}`}>
        <div className="group-header">
          <span className="group-indicator" />
          <span className="group-title">
            {priority.charAt(0).toUpperCase() + priority.slice(1)}
          </span>
          <span className="group-count">{group.length}</span>
        </div>
        <div className="group-items">
          {group.map((suggestion) => (
            <SuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              onAccept={() => onSuggestionAccept(suggestion.id)}
              onReject={() => onSuggestionReject(suggestion.id)}
              onDismiss={() => onSuggestionDismiss(suggestion.id)}
              isExpanded={expandedSuggestion === suggestion.id}
              onToggleExpand={() => handleToggleExpand(suggestion.id)}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className={`pair-programming ${mode} ${className}`}>
      <style>{`
        .pair-programming {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: var(--cl-bg-primary, #0d1117);
          border-radius: 8px;
          overflow: hidden;
        }

        .pair-programming.off {
          opacity: 0.6;
          pointer-events: none;
        }

        /* Header */
        .pair-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: var(--cl-bg-secondary, #161b22);
          border-bottom: 1px solid var(--cl-border, #30363d);
        }

        .pair-title {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .pair-title-icon {
          font-size: 18px;
        }

        .pair-title-text {
          font-size: 14px;
          font-weight: 600;
          color: var(--cl-text-primary, #e6edf3);
        }

        .pair-title-badge {
          padding: 2px 8px;
          background: var(--cl-accent-bg, rgba(56, 139, 253, 0.15));
          border-radius: 12px;
          font-size: 10px;
          font-weight: 600;
          color: var(--cl-accent, #58a6ff);
          text-transform: uppercase;
        }

        .pair-title-badge.active {
          background: rgba(63, 185, 80, 0.15);
          color: #3fb950;
        }

        /* Mode Selector */
        .mode-selector {
          display: flex;
          gap: 4px;
          padding: 4px;
          background: var(--cl-bg-tertiary, #0d1117);
          border-radius: 8px;
        }

        .mode-option {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 6px 12px;
          background: transparent;
          border: none;
          border-radius: 6px;
          color: var(--cl-text-tertiary, #8b949e);
          font-size: 12px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .mode-option:hover {
          background: var(--cl-bg-hover, #21262d);
          color: var(--cl-text-primary, #e6edf3);
        }

        .mode-option.active {
          background: var(--cl-accent-bg, rgba(56, 139, 253, 0.15));
          color: var(--cl-accent, #58a6ff);
        }

        .mode-icon {
          font-size: 12px;
        }

        /* Session Stats */
        .session-stats {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 8px 16px;
          background: var(--cl-bg-tertiary, #0d1117);
          border-bottom: 1px solid var(--cl-border, #30363d);
        }

        .stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
        }

        .stat-value {
          font-size: 16px;
          font-weight: 600;
          color: var(--cl-text-primary, #e6edf3);
        }

        .stat-label {
          font-size: 10px;
          color: var(--cl-text-muted, #6e7681);
          text-transform: uppercase;
        }

        .stat.success .stat-value {
          color: var(--cl-accent-green, #3fb950);
        }

        .stat-divider {
          width: 1px;
          height: 24px;
          background: var(--cl-border, #30363d);
        }

        /* Analyzing Indicator */
        .analyzing-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: rgba(56, 139, 253, 0.1);
          border-bottom: 1px solid var(--cl-border, #30363d);
        }

        .analyzing-dots {
          display: flex;
          gap: 4px;
        }

        .analyzing-dots span {
          width: 6px;
          height: 6px;
          background: var(--cl-accent, #58a6ff);
          border-radius: 50%;
          animation: analyzingBounce 1.4s ease-in-out infinite;
        }

        .analyzing-dots span:nth-child(1) { animation-delay: 0s; }
        .analyzing-dots span:nth-child(2) { animation-delay: 0.2s; }
        .analyzing-dots span:nth-child(3) { animation-delay: 0.4s; }

        @keyframes analyzingBounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; }
          40% { transform: scale(1); opacity: 1; }
        }

        .analyzing-text {
          font-size: 12px;
          color: var(--cl-accent, #58a6ff);
        }

        /* Filter Bar */
        .filter-bar {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 8px 16px;
          border-bottom: 1px solid var(--cl-border, #30363d);
          overflow-x: auto;
        }

        .filter-chip {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          background: transparent;
          border: 1px solid var(--cl-border, #30363d);
          border-radius: 16px;
          color: var(--cl-text-tertiary, #8b949e);
          font-size: 11px;
          cursor: pointer;
          transition: all 0.15s ease;
          white-space: nowrap;
        }

        .filter-chip:hover {
          border-color: var(--cl-text-tertiary, #8b949e);
          color: var(--cl-text-primary, #e6edf3);
        }

        .filter-chip.active {
          background: var(--cl-accent-bg, rgba(56, 139, 253, 0.15));
          border-color: var(--cl-accent, #58a6ff);
          color: var(--cl-accent, #58a6ff);
        }

        .filter-count {
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 16px;
          height: 16px;
          padding: 0 4px;
          background: var(--cl-bg-tertiary, #0d1117);
          border-radius: 8px;
          font-size: 10px;
          font-weight: 600;
        }

        /* Suggestions List */
        .suggestions-list {
          flex: 1;
          overflow-y: auto;
          padding: 12px;
        }

        .suggestions-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          gap: 12px;
          color: var(--cl-text-muted, #6e7681);
          text-align: center;
        }

        .suggestions-empty-icon {
          font-size: 32px;
          opacity: 0.5;
        }

        .suggestions-empty-text {
          font-size: 13px;
        }

        /* Suggestion Group */
        .suggestion-group {
          margin-bottom: 16px;
        }

        .group-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }

        .group-indicator {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--priority-color, #8b949e);
        }

        .priority-critical .group-indicator { background: #f85149; }
        .priority-high .group-indicator { background: #d29922; }
        .priority-medium .group-indicator { background: #58a6ff; }
        .priority-low .group-indicator { background: #8b949e; }

        .group-title {
          font-size: 11px;
          font-weight: 600;
          color: var(--cl-text-secondary, #8b949e);
          text-transform: uppercase;
        }

        .group-count {
          font-size: 10px;
          color: var(--cl-text-muted, #6e7681);
        }

        .group-items {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        /* Suggestion Card */
        .suggestion-card {
          background: var(--cl-bg-secondary, #161b22);
          border: 1px solid var(--cl-border, #30363d);
          border-radius: 8px;
          overflow: hidden;
          transition: all 0.15s ease;
        }

        .suggestion-card:hover {
          border-color: var(--priority-color, var(--cl-border));
        }

        .suggestion-card.expanded {
          border-color: var(--priority-color, var(--cl-accent));
        }

        .suggestion-header {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          cursor: pointer;
        }

        .suggestion-icon {
          font-size: 14px;
        }

        .suggestion-info {
          flex: 1;
          min-width: 0;
        }

        .suggestion-type {
          display: block;
          font-size: 10px;
          color: var(--cl-text-muted, #6e7681);
          text-transform: uppercase;
          margin-bottom: 2px;
        }

        .suggestion-title {
          display: block;
          font-size: 13px;
          color: var(--cl-text-primary, #e6edf3);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .suggestion-meta {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .suggestion-confidence {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 10px;
          color: var(--cl-text-muted, #6e7681);
        }

        .confidence-bar {
          width: 32px;
          height: 4px;
          background: var(--cl-bg-tertiary, #0d1117);
          border-radius: 2px;
          overflow: hidden;
        }

        .confidence-fill {
          height: 100%;
          background: var(--cl-accent-green, #3fb950);
          border-radius: 2px;
        }

        .suggestion-dismiss {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          padding: 0;
          background: transparent;
          border: none;
          border-radius: 4px;
          color: var(--cl-text-muted, #6e7681);
          font-size: 14px;
          cursor: pointer;
          opacity: 0;
          transition: all 0.15s;
        }

        .suggestion-card:hover .suggestion-dismiss {
          opacity: 1;
        }

        .suggestion-dismiss:hover {
          background: rgba(248, 81, 73, 0.15);
          color: #f85149;
        }

        /* Suggestion Body */
        .suggestion-body {
          padding: 12px;
          border-top: 1px solid var(--cl-border, #30363d);
          background: var(--cl-bg-tertiary, #0d1117);
        }

        .suggestion-description {
          font-size: 13px;
          color: var(--cl-text-secondary, #8b949e);
          line-height: 1.5;
          margin-bottom: 12px;
        }

        .suggestion-code {
          margin-bottom: 12px;
          padding: 12px;
          background: var(--cl-bg-primary, #0d1117);
          border: 1px solid var(--cl-border, #30363d);
          border-radius: 6px;
          overflow-x: auto;
        }

        .suggestion-code pre {
          margin: 0;
        }

        .suggestion-code code {
          font-family: 'SF Mono', 'Fira Code', monospace;
          font-size: 12px;
          color: var(--cl-text-primary, #e6edf3);
        }

        .suggestion-location {
          display: block;
          font-size: 11px;
          color: var(--cl-text-muted, #6e7681);
          margin-bottom: 12px;
        }

        .suggestion-actions {
          display: flex;
          gap: 8px;
        }

        .action-accept,
        .action-reject {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border: none;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
        }

        .action-accept {
          background: var(--cl-accent-green, #3fb950);
          color: white;
        }

        .action-accept:hover {
          background: #2ea043;
        }

        .action-reject {
          background: var(--cl-bg-secondary, #161b22);
          border: 1px solid var(--cl-border, #30363d);
          color: var(--cl-text-tertiary, #8b949e);
        }

        .action-reject:hover {
          border-color: #f85149;
          color: #f85149;
        }

        .action-icon {
          font-size: 11px;
        }

        .suggestion-actions kbd {
          padding: 2px 4px;
          background: rgba(255,255,255,0.1);
          border-radius: 3px;
          font-size: 10px;
          font-family: 'SF Mono', monospace;
        }

        /* Ghost Text */
        .ghost-text {
          color: var(--cl-text-muted, #6e7681);
          opacity: 0.5;
          font-style: italic;
          pointer-events: none;
        }

        /* Inline Annotations */
        .inline-annotations {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .annotation {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          cursor: pointer;
        }

        .annotation-info {
          background: rgba(56, 139, 253, 0.1);
          color: #58a6ff;
        }

        .annotation-warning {
          background: rgba(210, 153, 34, 0.1);
          color: #d29922;
        }

        .annotation-error {
          background: rgba(248, 81, 73, 0.1);
          color: #f85149;
        }

        .annotation-hint {
          background: rgba(63, 185, 80, 0.1);
          color: #3fb950;
        }

        .annotation-icon {
          font-size: 11px;
        }

        .annotation-message {
          flex: 1;
        }

        /* Scrollbar */
        .suggestions-list::-webkit-scrollbar {
          width: 6px;
        }

        .suggestions-list::-webkit-scrollbar-track {
          background: transparent;
        }

        .suggestions-list::-webkit-scrollbar-thumb {
          background: var(--cl-border, #30363d);
          border-radius: 3px;
        }

        /* Mobile */
        @media (max-width: 768px) {
          .pair-header {
            flex-direction: column;
            gap: 12px;
            align-items: flex-start;
          }

          .session-stats {
            flex-wrap: wrap;
          }

          .filter-bar {
            padding: 8px 12px;
          }

          .suggestion-actions {
            flex-direction: column;
          }
        }
      `}</style>

      {/* Header */}
      <div className="pair-header">
        <div className="pair-title">
          <span className="pair-title-icon">🤝</span>
          <span className="pair-title-text">Pair Programming</span>
          <span className={`pair-title-badge ${mode === 'active' ? 'active' : ''}`}>
            {mode === 'active' ? 'Active' : mode === 'passive' ? 'Passive' : 'Off'}
          </span>
        </div>
        <ModeSelector mode={mode} onModeChange={onModeChange} />
      </div>

      {/* Session Stats */}
      {session && <SessionStats session={session} />}

      {/* Analyzing Indicator */}
      <AnalyzingIndicator isAnalyzing={isAnalyzing} />

      {/* Filter Bar */}
      <div className="filter-bar">
        <button
          className={`filter-chip ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All
          <span className="filter-count">{suggestions.length}</span>
        </button>
        {(['completion', 'bug', 'refactor', 'docs', 'test', 'security'] as SuggestionType[]).map(
          (type) => {
            const count = suggestions.filter((s) => s.type === type).length;
            if (count === 0) return null;
            return (
              <button
                key={type}
                className={`filter-chip ${filter === type ? 'active' : ''}`}
                onClick={() => setFilter(type)}
              >
                {SUGGESTION_ICONS[type]} {type}
                <span className="filter-count">{count}</span>
              </button>
            );
          }
        )}
      </div>

      {/* Suggestions List */}
      <div className="suggestions-list">
        {filteredSuggestions.length === 0 ? (
          <div className="suggestions-empty">
            <span className="suggestions-empty-icon">✨</span>
            <span className="suggestions-empty-text">
              {mode === 'active'
                ? 'Start coding and Claude will suggest improvements'
                : mode === 'passive'
                  ? 'Select code and ask Claude for suggestions'
                  : 'Enable pair programming to get started'}
            </span>
          </div>
        ) : (
          <>
            {renderSuggestionGroup('critical')}
            {renderSuggestionGroup('high')}
            {renderSuggestionGroup('medium')}
            {renderSuggestionGroup('low')}
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// HOOK FOR PAIR PROGRAMMING STATE - CONNECTED TO REAL BACKEND
// ============================================================================

// Types for API communication
interface PairProgrammingAPIContext {
  currentFile: string;
  fileContent: string;
  recentEdits: Array<{
    timestamp: number;
    file: string;
    startLine: number;
    endLine: number;
    oldContent: string;
    newContent: string;
    cursorPosition: { line: number; column: number };
  }>;
  cursorLine: number;
  selectedText?: string;
  diagnostics?: Array<{
    line: number;
    message: string;
    severity: 'error' | 'warning' | 'hint';
  }>;
  projectContext?: {
    language: string;
    framework?: string;
    dependencies?: string[];
    recentFiles?: string[];
  };
}

interface PairProgrammingAPIEdit {
  timestamp: number;
  file: string;
  startLine: number;
  endLine: number;
  oldContent: string;
  newContent: string;
  cursorPosition: { line: number; column: number };
}

export function usePairProgramming() {
  const [mode, setMode] = useState<PairMode>('active');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [ghostText, setGhostText] = useState<string | null>(null);
  const [session, setSession] = useState<PairSession>({
    id: `session-${Date.now()}`,
    startTime: new Date(),
    suggestionsShown: 0,
    suggestionsAccepted: 0,
    suggestionsRejected: 0,
    codeWritten: 0,
    bugsDetected: 0,
    bugsPrevented: 0,
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounce timer for edit analysis
  const debounceRef = React.useRef<NodeJS.Timeout | null>(null);

  /**
   * Call the pair programming API
   */
  const callAPI = useCallback(async (
    action: 'edit' | 'open' | 'complete' | 'analyze',
    context?: PairProgrammingAPIContext,
    edit?: PairProgrammingAPIEdit
  ) => {
    try {
      const response = await fetch('/api/code-lab/pair-programming', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, context, edit }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'API request failed');
      }

      return await response.json();
    } catch (err) {
      setError((err as Error).message);
      console.error('[PairProgramming] API error:', err);
      return null;
    }
  }, []);

  /**
   * Process a code edit and get real AI suggestions
   */
  const onCodeEdit = useCallback(async (
    file: string,
    content: string,
    oldContent: string,
    cursorLine: number,
    cursorColumn: number,
    language: string = 'typescript'
  ) => {
    if (mode !== 'active') return;

    // Clear existing debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Debounce to avoid overwhelming the API
    debounceRef.current = setTimeout(async () => {
      setIsAnalyzing(true);
      setError(null);

      const edit: PairProgrammingAPIEdit = {
        timestamp: Date.now(),
        file,
        startLine: cursorLine,
        endLine: cursorLine,
        oldContent: oldContent.split('\n')[cursorLine] || '',
        newContent: content.split('\n')[cursorLine] || '',
        cursorPosition: { line: cursorLine, column: cursorColumn },
      };

      const context: PairProgrammingAPIContext = {
        currentFile: file,
        fileContent: content,
        recentEdits: [edit],
        cursorLine,
        projectContext: {
          language,
        },
      };

      const result = await callAPI('edit', context, edit);

      if (result?.suggestions && Array.isArray(result.suggestions)) {
        const newSuggestions: Suggestion[] = result.suggestions.map((s: Suggestion, i: number) => ({
          ...s,
          id: `suggestion-${Date.now()}-${i}`,
          timestamp: new Date(),
        }));

        setSuggestions((prev) => [...prev, ...newSuggestions]);
        setSession((prev) => ({
          ...prev,
          suggestionsShown: prev.suggestionsShown + newSuggestions.length,
          bugsDetected: prev.bugsDetected + newSuggestions.filter((s) => s.type === 'bug').length,
        }));
      }

      setIsAnalyzing(false);
    }, 500); // 500ms debounce
  }, [mode, callAPI]);

  /**
   * Get suggestions when opening a file
   */
  const onFileOpen = useCallback(async (
    file: string,
    content: string,
    language: string = 'typescript'
  ) => {
    if (mode === 'off') return;

    setIsAnalyzing(true);
    setError(null);

    const context: PairProgrammingAPIContext = {
      currentFile: file,
      fileContent: content,
      recentEdits: [],
      cursorLine: 0,
      projectContext: {
        language,
      },
    };

    const result = await callAPI('open', context);

    if (result?.suggestions && Array.isArray(result.suggestions)) {
      const newSuggestions: Suggestion[] = result.suggestions.map((s: Suggestion, i: number) => ({
        ...s,
        id: `suggestion-${Date.now()}-${i}`,
        timestamp: new Date(),
      }));

      setSuggestions((prev) => [...prev, ...newSuggestions]);
      setSession((prev) => ({
        ...prev,
        suggestionsShown: prev.suggestionsShown + newSuggestions.length,
      }));
    }

    setIsAnalyzing(false);
  }, [mode, callAPI]);

  /**
   * Get inline completion (ghost text)
   */
  const getCompletion = useCallback(async (
    file: string,
    content: string,
    cursorLine: number,
    _cursorColumn: number,
    language: string = 'typescript'
  ): Promise<string | null> => {
    if (mode !== 'active') return null;

    const context: PairProgrammingAPIContext = {
      currentFile: file,
      fileContent: content,
      recentEdits: [],
      cursorLine,
      projectContext: {
        language,
      },
    };

    const result = await callAPI('complete', context);
    const completion = result?.completion || null;
    setGhostText(completion);
    return completion;
  }, [mode, callAPI]);

  /**
   * Run proactive analysis on current code
   */
  const analyzeCode = useCallback(async (
    file: string,
    content: string,
    language: string = 'typescript'
  ) => {
    setIsAnalyzing(true);
    setError(null);

    const context: PairProgrammingAPIContext = {
      currentFile: file,
      fileContent: content,
      recentEdits: [],
      cursorLine: 0,
      projectContext: {
        language,
      },
    };

    const result = await callAPI('analyze', context);

    if (result?.suggestions && Array.isArray(result.suggestions)) {
      const newSuggestions: Suggestion[] = result.suggestions.map((s: Suggestion, i: number) => ({
        ...s,
        id: `suggestion-${Date.now()}-${i}`,
        timestamp: new Date(),
      }));

      setSuggestions(newSuggestions); // Replace all suggestions
      setSession((prev) => ({
        ...prev,
        suggestionsShown: prev.suggestionsShown + newSuggestions.length,
      }));
    }

    setIsAnalyzing(false);
  }, [callAPI]);

  /**
   * Add a local suggestion (for testing or manual additions)
   */
  const addSuggestion = useCallback((suggestion: Omit<Suggestion, 'id' | 'timestamp'>) => {
    const newSuggestion: Suggestion = {
      ...suggestion,
      id: `suggestion-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };
    setSuggestions((prev) => [...prev, newSuggestion]);
    setSession((prev) => ({ ...prev, suggestionsShown: prev.suggestionsShown + 1 }));
    return newSuggestion.id;
  }, []);

  const acceptSuggestion = useCallback((id: string) => {
    const suggestion = suggestions.find((s) => s.id === id);
    setSuggestions((prev) => prev.filter((s) => s.id !== id));
    setSession((prev) => ({
      ...prev,
      suggestionsAccepted: prev.suggestionsAccepted + 1,
      bugsPrevented: prev.bugsPrevented + (suggestion?.type === 'bug' ? 1 : 0),
    }));
  }, [suggestions]);

  const rejectSuggestion = useCallback((id: string) => {
    setSuggestions((prev) => prev.filter((s) => s.id !== id));
    setSession((prev) => ({ ...prev, suggestionsRejected: prev.suggestionsRejected + 1 }));
  }, []);

  const dismissSuggestion = useCallback((id: string) => {
    setSuggestions((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
  }, []);

  const acceptGhostText = useCallback(() => {
    setGhostText(null);
    setSession((prev) => ({ ...prev, codeWritten: prev.codeWritten + 1 }));
  }, []);

  const rejectGhostText = useCallback(() => {
    setGhostText(null);
  }, []);

  const recordBugPrevented = useCallback(() => {
    setSession((prev) => ({ ...prev, bugsPrevented: prev.bugsPrevented + 1 }));
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return {
    // State
    mode,
    setMode,
    suggestions,
    session,
    isAnalyzing,
    ghostText,
    error,

    // Real API actions
    onCodeEdit,
    onFileOpen,
    getCompletion,
    analyzeCode,

    // Local state management
    addSuggestion,
    acceptSuggestion,
    rejectSuggestion,
    dismissSuggestion,
    clearSuggestions,
    acceptGhostText,
    rejectGhostText,
    recordBugPrevented,

    // Legacy compatibility
    setIsAnalyzing,
  };
}

export default CodeLabPairProgramming;
