'use client';

/**
 * CODE LAB AI SUGGESTIONS
 *
 * Context-aware suggestions that appear proactively
 * based on the current conversation and workspace state.
 * Features:
 * - Smart suggestion generation
 * - Dismissable chips
 * - Category-based organization
 * - Follow-up suggestions
 */

import { useState, useEffect, useMemo } from 'react';

export interface AISuggestion {
  id: string;
  text: string;
  type: 'action' | 'question' | 'follow-up' | 'quick';
  priority: number; // 1-10, higher = more relevant
  icon?: string;
}

interface CodeLabAISuggestionsProps {
  context: {
    lastMessage?: string;
    messageCount?: number;
    hasError?: boolean;
    isCodeContext?: boolean;
    recentTopics?: string[];
  };
  onSelect: (suggestion: AISuggestion) => void;
  onDismiss?: () => void;
  maxSuggestions?: number;
  className?: string;
}

// Smart suggestion generator based on context
function generateSuggestions(context: CodeLabAISuggestionsProps['context']): AISuggestion[] {
  const suggestions: AISuggestion[] = [];
  let id = 1;

  const { lastMessage = '', messageCount = 0, hasError, isCodeContext, recentTopics = [] } = context;
  const lowerMessage = lastMessage.toLowerCase();

  // Welcome suggestions for new sessions
  if (messageCount === 0) {
    suggestions.push(
      { id: String(id++), text: 'What can you help me build?', type: 'question', priority: 9, icon: '🚀' },
      { id: String(id++), text: 'Show me what you can do', type: 'question', priority: 8, icon: '✨' },
      { id: String(id++), text: '/help', type: 'quick', priority: 7, icon: '❓' },
    );
    return suggestions;
  }

  // Error context suggestions
  if (hasError) {
    suggestions.push(
      { id: String(id++), text: 'Fix this error', type: 'action', priority: 10, icon: '🔧' },
      { id: String(id++), text: 'Explain what went wrong', type: 'question', priority: 9, icon: '📖' },
      { id: String(id++), text: 'Show alternative approaches', type: 'follow-up', priority: 8, icon: '🔄' },
    );
  }

  // Code context suggestions
  if (isCodeContext) {
    suggestions.push(
      { id: String(id++), text: 'Add tests for this code', type: 'action', priority: 8, icon: '🧪' },
      { id: String(id++), text: 'Optimize this code', type: 'action', priority: 7, icon: '⚡' },
      { id: String(id++), text: 'Add error handling', type: 'action', priority: 7, icon: '🛡️' },
      { id: String(id++), text: 'Document this code', type: 'action', priority: 6, icon: '📝' },
    );
  }

  // Message-based suggestions
  if (lowerMessage.includes('error') || lowerMessage.includes('bug') || lowerMessage.includes('fix')) {
    suggestions.push(
      { id: String(id++), text: 'Run /fix to auto-fix', type: 'quick', priority: 9, icon: '🔧' },
      { id: String(id++), text: 'Show me the stack trace', type: 'follow-up', priority: 8, icon: '📋' },
    );
  }

  if (lowerMessage.includes('test') || lowerMessage.includes('testing')) {
    suggestions.push(
      { id: String(id++), text: 'Run all tests', type: 'action', priority: 8, icon: '🧪' },
      { id: String(id++), text: 'Add more test coverage', type: 'follow-up', priority: 7, icon: '📊' },
    );
  }

  if (lowerMessage.includes('commit') || lowerMessage.includes('git')) {
    suggestions.push(
      { id: String(id++), text: '/commit', type: 'quick', priority: 9, icon: '✅' },
      { id: String(id++), text: 'Show git status', type: 'action', priority: 8, icon: '📊' },
      { id: String(id++), text: 'Review changes before commit', type: 'follow-up', priority: 7, icon: '👀' },
    );
  }

  if (lowerMessage.includes('deploy') || lowerMessage.includes('production')) {
    suggestions.push(
      { id: String(id++), text: 'Run build first', type: 'action', priority: 9, icon: '🔨' },
      { id: String(id++), text: 'Check environment variables', type: 'follow-up', priority: 8, icon: '🔐' },
    );
  }

  if (lowerMessage.includes('api') || lowerMessage.includes('endpoint')) {
    suggestions.push(
      { id: String(id++), text: 'Add request validation', type: 'follow-up', priority: 7, icon: '✓' },
      { id: String(id++), text: 'Add API documentation', type: 'follow-up', priority: 6, icon: '📚' },
    );
  }

  if (lowerMessage.includes('component') || lowerMessage.includes('react')) {
    suggestions.push(
      { id: String(id++), text: 'Add prop types', type: 'follow-up', priority: 7, icon: '📘' },
      { id: String(id++), text: 'Make it responsive', type: 'follow-up', priority: 6, icon: '📱' },
    );
  }

  if (lowerMessage.includes('refactor')) {
    suggestions.push(
      { id: String(id++), text: 'Run /refactor', type: 'quick', priority: 9, icon: '♻️' },
      { id: String(id++), text: 'Extract reusable functions', type: 'follow-up', priority: 7, icon: '📦' },
    );
  }

  // Recent topics suggestions
  recentTopics.forEach(topic => {
    if (topic === 'authentication') {
      suggestions.push(
        { id: String(id++), text: 'Add session management', type: 'follow-up', priority: 6, icon: '🔑' },
      );
    }
    if (topic === 'database') {
      suggestions.push(
        { id: String(id++), text: 'Add database indexes', type: 'follow-up', priority: 6, icon: '📊' },
      );
    }
  });

  // General follow-ups
  if (messageCount > 2) {
    suggestions.push(
      { id: String(id++), text: 'Continue where we left off', type: 'follow-up', priority: 5, icon: '▶️' },
      { id: String(id++), text: 'Summarize what we built', type: 'question', priority: 4, icon: '📋' },
    );
  }

  // Default suggestions
  if (suggestions.length < 3) {
    suggestions.push(
      { id: String(id++), text: 'What else can you improve?', type: 'question', priority: 3, icon: '💡' },
      { id: String(id++), text: '/review', type: 'quick', priority: 3, icon: '👀' },
    );
  }

  return suggestions;
}

export function CodeLabAISuggestions({
  context,
  onSelect,
  onDismiss,
  maxSuggestions = 4,
  className = '',
}: CodeLabAISuggestionsProps) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [visible, setVisible] = useState(true);

  // Generate suggestions based on context
  const allSuggestions = useMemo(() => generateSuggestions(context), [context]);

  // Filter and sort suggestions
  const suggestions = useMemo(() => {
    return allSuggestions
      .filter(s => !dismissed.has(s.id))
      .sort((a, b) => b.priority - a.priority)
      .slice(0, maxSuggestions);
  }, [allSuggestions, dismissed, maxSuggestions]);

  // Reset dismissed when context changes significantly
  useEffect(() => {
    setDismissed(new Set());
    setVisible(true);
  }, [context.messageCount]);

  const handleDismissSuggestion = (id: string) => {
    setDismissed(prev => new Set(prev).add(id));
  };

  const handleDismissAll = () => {
    setVisible(false);
    onDismiss?.();
  };

  if (!visible || suggestions.length === 0) {
    return null;
  }

  return (
    <div className={`ai-suggestions ${className}`}>
      <div className="suggestions-header">
        <span className="suggestions-label">
          <span className="sparkle">✨</span>
          Suggestions
        </span>
        <button className="dismiss-all" onClick={handleDismissAll}>
          Dismiss
        </button>
      </div>

      <div className="suggestions-list">
        {suggestions.map(suggestion => (
          <button
            key={suggestion.id}
            className={`suggestion-chip ${suggestion.type}`}
            onClick={() => onSelect(suggestion)}
          >
            {suggestion.icon && <span className="chip-icon">{suggestion.icon}</span>}
            <span className="chip-text">{suggestion.text}</span>
            <button
              className="chip-dismiss"
              onClick={(e) => {
                e.stopPropagation();
                handleDismissSuggestion(suggestion.id);
              }}
            >
              ×
            </button>
          </button>
        ))}
      </div>

      <style jsx>{`
        .ai-suggestions {
          padding: 0.75rem 1rem;
          background: linear-gradient(135deg, #f9fafb 0%, #eef2ff 100%);
          border-top: 1px solid var(--cl-border-primary, #e5e7eb);
        }

        .suggestions-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 0.5rem;
        }

        .suggestions-label {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          font-size: 0.6875rem;
          font-weight: 600;
          color: var(--cl-text-tertiary, #6b7280);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .sparkle {
          font-size: 0.875rem;
        }

        .dismiss-all {
          background: none;
          border: none;
          font-size: 0.6875rem;
          color: var(--cl-text-muted, #9ca3af);
          cursor: pointer;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
        }

        .dismiss-all:hover {
          background: rgba(0, 0, 0, 0.05);
          color: var(--cl-text-secondary, #4b5563);
        }

        .suggestions-list {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .suggestion-chip {
          display: inline-flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.5rem 0.75rem;
          background: white;
          border: 1px solid var(--cl-border-primary, #e5e7eb);
          border-radius: 999px;
          font-size: 0.8125rem;
          color: var(--cl-text-primary, #1a1f36);
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
        }

        .suggestion-chip:hover {
          border-color: var(--cl-accent-primary, #6366f1);
          background: #f8f9ff;
        }

        .suggestion-chip.quick {
          background: #eef2ff;
          border-color: #c7d2fe;
          color: var(--cl-accent-primary, #6366f1);
        }

        .suggestion-chip.quick:hover {
          background: #e0e7ff;
        }

        .suggestion-chip.action {
          background: #f0fdf4;
          border-color: #bbf7d0;
        }

        .suggestion-chip.action:hover {
          background: #dcfce7;
        }

        .chip-icon {
          font-size: 0.875rem;
        }

        .chip-text {
          font-family: 'SF Mono', 'Menlo', monospace;
          font-size: 0.8125rem;
        }

        .chip-dismiss {
          background: none;
          border: none;
          font-size: 1rem;
          color: var(--cl-text-muted, #9ca3af);
          cursor: pointer;
          padding: 0;
          margin-left: 0.25rem;
          line-height: 1;
          border-radius: 50%;
          width: 16px;
          height: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .chip-dismiss:hover {
          background: rgba(0, 0, 0, 0.1);
          color: var(--cl-text-primary, #1a1f36);
        }

        @media (max-width: 640px) {
          .ai-suggestions {
            padding: 0.5rem 0.75rem;
          }

          .suggestions-list {
            gap: 0.375rem;
          }

          .suggestion-chip {
            padding: 0.375rem 0.625rem;
            font-size: 0.75rem;
          }

          .chip-icon {
            font-size: 0.75rem;
          }
        }
      `}</style>
    </div>
  );
}
