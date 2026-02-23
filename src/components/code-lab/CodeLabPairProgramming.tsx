'use client';

/**
 * CODE LAB AI CODE ASSISTANT
 *
 * Smart AI-powered code assistance that analyzes your code and provides
 * helpful suggestions as you work.
 *
 * Features:
 * - Debounced code analysis (500ms after typing stops)
 * - Proactive suggestions for improvements
 * - Ghost text completions
 * - Inline annotations and hints
 * - Bug detection and prevention
 * - Code quality suggestions
 * - Session statistics tracking
 *
 * Note: Analysis is debounced to avoid overwhelming the API and to provide
 * more accurate suggestions based on complete code changes.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import './code-lab-pair-programming.css';

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
      description: 'AI analyzes code after you stop typing (500ms delay)',
      icon: '⚡',
    },
    {
      value: 'passive',
      label: 'Passive',
      description: 'AI provides suggestions only when you ask',
      icon: '💤',
    },
    { value: 'off', label: 'Off', description: 'AI code assistance disabled', icon: '⏸️' },
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
      <span className="analyzing-text">Analyzing your code...</span>
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
      {/* Header */}
      <div className="pair-header">
        <div className="pair-title">
          <span className="pair-title-icon">🤖</span>
          <span className="pair-title-text">AI Code Assistant</span>
          <span className={`pair-title-badge ${mode === 'active' ? 'active' : ''}`}>
            {mode === 'active' ? 'Active' : mode === 'passive' ? 'On Demand' : 'Off'}
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
                ? 'Start coding - AI will analyze your code after a brief pause'
                : mode === 'passive'
                  ? 'Select code and ask for suggestions'
                  : 'Enable AI assistance to get started'}
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

export default CodeLabPairProgramming;
