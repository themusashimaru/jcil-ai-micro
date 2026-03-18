'use client';

/**
 * CODE LAB AI CODE ASSISTANT
 *
 * Smart AI-powered code assistance with debounced analysis,
 * suggestions, ghost text, and inline annotations.
 *
 * Sub-components extracted to CodeLabPairProgrammingPanels.tsx.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import './code-lab-pair-programming.css';

// Re-export types and components for consumers
export type {
  PairMode, SuggestionType, SuggestionPriority,
  Suggestion, CodeContext, PairSession, InlineAnnotation,
  GhostTextProps,
} from './CodeLabPairProgrammingPanels';

export { GhostText, InlineAnnotations } from './CodeLabPairProgrammingPanels';

import type { PairMode, Suggestion, SuggestionPriority, SuggestionType, PairSession } from './CodeLabPairProgrammingPanels';
import {
  SUGGESTION_ICONS,
  SuggestionCard,
  ModeSelector,
  SessionStats,
  AnalyzingIndicator,
} from './CodeLabPairProgrammingPanels';

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

export function CodeLabPairProgramming({
  mode, onModeChange, suggestions, onSuggestionAccept, onSuggestionReject, onSuggestionDismiss,
  session, isAnalyzing = false, className = '',
}: CodeLabPairProgrammingProps) {
  const [expandedSuggestion, setExpandedSuggestion] = useState<string | null>(null);
  const [filter, setFilter] = useState<SuggestionType | 'all'>('all');

  const filteredSuggestions = useMemo(() => {
    if (filter === 'all') return suggestions;
    return suggestions.filter((s) => s.type === filter);
  }, [suggestions, filter]);

  const groupedSuggestions = useMemo(() => {
    const groups: Record<SuggestionPriority, Suggestion[]> = { critical: [], high: [], medium: [], low: [] };
    for (const suggestion of filteredSuggestions) groups[suggestion.priority].push(suggestion);
    return groups;
  }, [filteredSuggestions]);

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedSuggestion((prev) => (prev === id ? null : id));
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && expandedSuggestion) setExpandedSuggestion(null);
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
          <span className="group-title">{priority.charAt(0).toUpperCase() + priority.slice(1)}</span>
          <span className="group-count">{group.length}</span>
        </div>
        <div className="group-items">
          {group.map((suggestion) => (
            <SuggestionCard key={suggestion.id} suggestion={suggestion}
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

      {session && <SessionStats session={session} />}
      <AnalyzingIndicator isAnalyzing={isAnalyzing} />

      <div className="filter-bar">
        <button className={`filter-chip ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
          All<span className="filter-count">{suggestions.length}</span>
        </button>
        {(['completion', 'bug', 'refactor', 'docs', 'test', 'security'] as SuggestionType[]).map((type) => {
          const count = suggestions.filter((s) => s.type === type).length;
          if (count === 0) return null;
          return (
            <button key={type} className={`filter-chip ${filter === type ? 'active' : ''}`} onClick={() => setFilter(type)}>
              {SUGGESTION_ICONS[type]} {type}<span className="filter-count">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="suggestions-list">
        {filteredSuggestions.length === 0 ? (
          <div className="suggestions-empty">
            <span className="suggestions-empty-icon">✨</span>
            <span className="suggestions-empty-text">
              {mode === 'active' ? 'Start coding - AI will analyze your code after a brief pause'
                : mode === 'passive' ? 'Select code and ask for suggestions' : 'Enable AI assistance to get started'}
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
