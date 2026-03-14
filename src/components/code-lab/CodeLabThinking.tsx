'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { type ThinkingSession } from './CodeLabThinkingTypes';
import { ThinkingStreamView, ThinkingTreeView, ThinkingTimelineView } from './CodeLabThinkingViews';

export type { ThinkingStep, ThinkingSession } from './CodeLabThinkingTypes';

interface CodeLabThinkingProps {
  session: ThinkingSession | null;
  isStreaming: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  showTokens?: boolean;
  showConfidence?: boolean;
  showTimeline?: boolean;
}

export function CodeLabThinking({
  session,
  isStreaming,
  collapsed = false,
  onToggleCollapse,
  showTokens = true,
  showConfidence = true,
  showTimeline = true,
}: CodeLabThinkingProps) {
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'stream' | 'tree' | 'timeline'>('stream');
  const streamEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest content when streaming
  useEffect(() => {
    if (isStreaming && streamEndRef.current) {
      streamEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isStreaming, session?.steps.length]);

  // Calculate session stats
  const stats = useMemo(() => {
    if (!session) return null;

    const duration = (session.endTime || Date.now()) - session.startTime;
    const stepCounts = session.steps.reduce(
      (acc, step) => {
        acc[step.type] = (acc[step.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      duration,
      stepCounts,
      avgConfidence:
        session.steps.reduce((sum, s) => sum + s.confidence, 0) / session.steps.length || 0,
    };
  }, [session]);

  // Toggle step expansion
  const toggleStep = (stepId: string) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  };

  // No session yet
  if (!session) {
    return (
      <div className="code-lab-thinking empty">
        <div className="thinking-empty-state">
          <span className="empty-icon">🧠</span>
          <p>Thinking process will appear here</p>
        </div>

        <style jsx>{`
          .code-lab-thinking.empty {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 2rem;
            background: var(--cl-bg-secondary, #f9fafb);
            border-radius: 8px;
            min-height: 100px;
          }

          .thinking-empty-state {
            text-align: center;
            color: var(--cl-text-tertiary, #4b5563);
          }

          .empty-icon {
            font-size: 2rem;
            display: block;
            margin-bottom: 0.5rem;
          }

          .thinking-empty-state p {
            margin: 0;
            font-size: 0.875rem;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className={`code-lab-thinking ${collapsed ? 'collapsed' : ''}`}>
      {/* Header */}
      <div className="thinking-header">
        <div className="header-left">
          <button
            className="collapse-btn"
            onClick={onToggleCollapse}
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expand thinking panel' : 'Collapse thinking panel'}
          >
            <svg
              viewBox="0 0 16 16"
              fill="currentColor"
              className={collapsed ? '-rotate-90' : 'rotate-0'}
              aria-hidden="true"
            >
              <path d="M12.78 6.22a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06 0L3.22 7.28a.75.75 0 011.06-1.06L8 9.94l3.72-3.72a.75.75 0 011.06 0z" />
            </svg>
          </button>
          <span className="header-icon">🧠</span>
          <span className="header-title">Claude&apos;s Thinking</span>
          {isStreaming && <span className="streaming-badge">Live</span>}
        </div>
        <div className="header-right">
          {/* View mode toggle */}
          <div className="view-toggle">
            <button
              className={viewMode === 'stream' ? 'active' : ''}
              onClick={() => setViewMode('stream')}
              aria-label="Stream view"
            >
              Stream
            </button>
            <button
              className={viewMode === 'tree' ? 'active' : ''}
              onClick={() => setViewMode('tree')}
              aria-label="Tree view"
            >
              Tree
            </button>
            {showTimeline && (
              <button
                className={viewMode === 'timeline' ? 'active' : ''}
                onClick={() => setViewMode('timeline')}
                aria-label="Timeline view"
              >
                Timeline
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stats bar */}
      {!collapsed && stats && (
        <div className="thinking-stats">
          <div className="stat">
            <span className="stat-label">Duration</span>
            <span className="stat-value">{(stats.duration / 1000).toFixed(1)}s</span>
          </div>
          <div className="stat">
            <span className="stat-label">Steps</span>
            <span className="stat-value">{session.steps.length}</span>
          </div>
          {showTokens && (
            <div className="stat">
              <span className="stat-label">Tokens</span>
              <span className="stat-value">{session.totalTokens.toLocaleString()}</span>
            </div>
          )}
          {showConfidence && (
            <div className="stat">
              <span className="stat-label">Confidence</span>
              <span className="stat-value">{Math.round(stats.avgConfidence)}%</span>
            </div>
          )}
        </div>
      )}

      {/* Content */}
      {!collapsed && (
        <div className="thinking-content">
          {viewMode === 'stream' && (
            <ThinkingStreamView
              session={session}
              isStreaming={isStreaming}
              expandedSteps={expandedSteps}
              toggleStep={toggleStep}
              showConfidence={showConfidence}
              showTokens={showTokens}
              streamEndRef={streamEndRef}
            />
          )}
          {viewMode === 'tree' && <ThinkingTreeView session={session} />}
          {viewMode === 'timeline' && stats && (
            <ThinkingTimelineView session={session} stats={stats} />
          )}
        </div>
      )}

      {/* Summary */}
      {!collapsed && session.summary && (
        <div className="thinking-summary">
          <strong>Summary:</strong> {session.summary}
        </div>
      )}

      <style jsx>{`
        .code-lab-thinking {
          background: var(--cl-bg-primary, #ffffff);
          border: 1px solid var(--cl-border-primary, #e5e7eb);
          border-radius: 12px;
          overflow: hidden;
        }

        .code-lab-thinking.collapsed .thinking-content,
        .code-lab-thinking.collapsed .thinking-stats,
        .code-lab-thinking.collapsed .thinking-summary {
          display: none;
        }

        /* Header */
        .thinking-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem 1rem;
          background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
          color: white;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .collapse-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          padding: 0;
          background: rgba(255, 255, 255, 0.2);
          border: none;
          border-radius: 4px;
          color: white;
          cursor: pointer;
          transition:
            background 0.15s,
            transform 0.2s;
        }

        .collapse-btn:hover {
          background: rgba(255, 255, 255, 0.3);
        }

        .collapse-btn svg {
          width: 14px;
          height: 14px;
          transition: transform 0.2s;
        }

        .header-icon {
          font-size: 1.25rem;
        }

        .header-title {
          font-weight: 600;
          font-size: 0.9375rem;
        }

        .streaming-badge {
          padding: 0.125rem 0.5rem;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 500;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.6;
          }
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .view-toggle {
          display: flex;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          padding: 2px;
        }

        .view-toggle button {
          padding: 0.25rem 0.5rem;
          font-size: 0.75rem;
          background: none;
          border: none;
          color: rgba(255, 255, 255, 0.7);
          cursor: pointer;
          border-radius: 4px;
          transition: all 0.15s;
        }

        .view-toggle button:hover {
          color: white;
        }

        .view-toggle button.active {
          background: rgba(255, 255, 255, 0.2);
          color: white;
        }

        /* Stats */
        .thinking-stats {
          display: flex;
          gap: 1.5rem;
          padding: 0.75rem 1rem;
          background: var(--cl-bg-secondary, #f9fafb);
          border-bottom: 1px solid var(--cl-border-primary, #e5e7eb);
        }

        .stat {
          display: flex;
          flex-direction: column;
          gap: 0.125rem;
        }

        .stat-label {
          font-size: 0.6875rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--cl-text-tertiary, #4b5563);
        }

        .stat-value {
          font-size: 0.9375rem;
          font-weight: 600;
          color: var(--cl-text-primary, #1a1f36);
        }

        /* Content */
        .thinking-content {
          max-height: 400px;
          overflow-y: auto;
          padding: 1rem;
        }

        /* Summary */
        .thinking-summary {
          padding: 0.75rem 1rem;
          background: var(--cl-bg-tertiary, #f3f4f6);
          border-top: 1px solid var(--cl-border-primary, #e5e7eb);
          font-size: 0.875rem;
          color: var(--cl-text-secondary, var(--text-secondary, #9ca3af));
        }

        .thinking-summary strong {
          color: var(--cl-text-primary, #1a1f36);
        }
      `}</style>
    </div>
  );
}

export default CodeLabThinking;
