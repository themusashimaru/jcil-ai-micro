'use client';

/**
 * CODE LAB THINKING VISUALIZATION
 *
 * Makes Claude's reasoning process visible to users.
 * Features:
 * - Real-time thinking stream display
 * - Collapsible thinking blocks
 * - Confidence indicators
 * - Reasoning chain visualization
 * - Decision tree view
 * - Token usage tracking
 *
 * This goes BEYOND Claude Code by visualizing the AI's thought process.
 *
 * @version 1.0.0
 */

import { useState, useEffect, useRef, useMemo } from 'react';

interface ThinkingStep {
  id: string;
  type: 'analysis' | 'reasoning' | 'decision' | 'planning' | 'verification';
  content: string;
  confidence: number; // 0-100
  timestamp: number;
  duration?: number;
  tokens?: number;
  children?: ThinkingStep[];
}

interface ThinkingSession {
  id: string;
  startTime: number;
  endTime?: number;
  totalTokens: number;
  steps: ThinkingStep[];
  summary?: string;
  confidence: number;
}

interface CodeLabThinkingProps {
  session: ThinkingSession | null;
  isStreaming: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  showTokens?: boolean;
  showConfidence?: boolean;
  showTimeline?: boolean;
}

// Step type icons and colors
const stepTypeConfig: Record<ThinkingStep['type'], { icon: string; color: string; label: string }> =
  {
    analysis: { icon: '🔍', color: 'var(--cl-info)', label: 'Analysis' },
    reasoning: { icon: '🧠', color: 'var(--cl-purple)', label: 'Reasoning' },
    decision: { icon: '⚡', color: 'var(--cl-warning)', label: 'Decision' },
    planning: { icon: '📋', color: 'var(--cl-success)', label: 'Planning' },
    verification: { icon: '✓', color: 'var(--cl-cyan)', label: 'Verification' },
  };

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

  // Render confidence indicator
  const renderConfidence = (confidence: number) => {
    const color = confidence >= 80 ? '#22c55e' : confidence >= 50 ? '#f59e0b' : '#ef4444';

    return (
      <div className="confidence-indicator" title={`${confidence}% confidence`}>
        <div className="confidence-bar">
          <div
            className="confidence-fill"
            style={{ width: `${confidence}%`, backgroundColor: color }}
          />
        </div>
        <span className="confidence-value">{confidence}%</span>
      </div>
    );
  };

  // Render a single thinking step
  const renderStep = (step: ThinkingStep, depth: number = 0) => {
    const config = stepTypeConfig[step.type];
    const isExpanded = expandedSteps.has(step.id);
    const hasChildren = step.children && step.children.length > 0;

    return (
      <div
        key={step.id}
        className={`thinking-step depth-${depth}`}
        style={{ marginLeft: depth * 16 }}
      >
        <div className="step-header" onClick={() => toggleStep(step.id)}>
          <span className="step-icon">{config.icon}</span>
          <span className="step-type" style={{ color: config.color }}>
            {config.label}
          </span>
          {showConfidence && renderConfidence(step.confidence)}
          {step.tokens && showTokens && <span className="step-tokens">{step.tokens} tokens</span>}
          {hasChildren && (
            <span className={`step-expand ${isExpanded ? 'expanded' : ''}`}>
              <svg viewBox="0 0 16 16" fill="currentColor">
                <path d="M6.22 3.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 010-1.06z" />
              </svg>
            </span>
          )}
        </div>
        <div className="step-content">{step.content}</div>
        {hasChildren && isExpanded && (
          <div className="step-children">
            {step.children!.map((child) => renderStep(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // Render stream view
  const renderStreamView = () => (
    <div className="thinking-stream">
      {session?.steps.map((step) => renderStep(step))}
      {isStreaming && (
        <div className="streaming-indicator">
          <div className="pulse" />
          <span>Thinking...</span>
        </div>
      )}
      <div ref={streamEndRef} />
    </div>
  );

  // Render tree view
  const renderTreeView = () => (
    <div className="thinking-tree">
      <div className="tree-visualization">
        {session?.steps.map((step, index) => (
          <div key={step.id} className="tree-node">
            <div className="tree-connector">
              {index > 0 && <div className="connector-line" />}
              <div
                className="node-dot"
                style={{ backgroundColor: stepTypeConfig[step.type].color }}
              />
            </div>
            <div className="tree-content">
              <div className="node-header">
                <span className="node-icon">{stepTypeConfig[step.type].icon}</span>
                <span className="node-type">{stepTypeConfig[step.type].label}</span>
              </div>
              <div className="node-text">{step.content}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // Render timeline view
  const renderTimelineView = () => {
    if (!session || !stats) return null;

    return (
      <div className="thinking-timeline">
        <div className="timeline-bar">
          {session.steps.map((step, _index) => {
            const startPercent = ((step.timestamp - session.startTime) / stats.duration) * 100;
            const width = ((step.duration || 100) / stats.duration) * 100;

            return (
              <div
                key={step.id}
                className="timeline-segment"
                style={{
                  left: `${startPercent}%`,
                  width: `${Math.max(width, 2)}%`,
                  backgroundColor: stepTypeConfig[step.type].color,
                }}
                title={`${stepTypeConfig[step.type].label}: ${step.content.substring(0, 50)}...`}
              />
            );
          })}
        </div>
        <div className="timeline-labels">
          <span>0s</span>
          <span>{(stats.duration / 1000).toFixed(1)}s</span>
        </div>
      </div>
    );
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
              style={{ transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
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
          {viewMode === 'stream' && renderStreamView()}
          {viewMode === 'tree' && renderTreeView()}
          {viewMode === 'timeline' && renderTimelineView()}
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

        /* Stream View */
        .thinking-stream {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .thinking-step {
          background: var(--cl-bg-secondary, #f9fafb);
          border-radius: 8px;
          overflow: hidden;
        }

        .step-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.625rem 0.75rem;
          cursor: pointer;
          transition: background 0.15s;
        }

        .step-header:hover {
          background: var(--cl-bg-hover, #f3f4f6);
        }

        .step-icon {
          font-size: 1rem;
        }

        .step-type {
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .confidence-indicator {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          margin-left: auto;
        }

        .confidence-bar {
          width: 40px;
          height: 4px;
          background: var(--cl-bg-hover, #f3f4f6);
          border-radius: 2px;
          overflow: hidden;
        }

        .confidence-fill {
          height: 100%;
          border-radius: 2px;
          transition: width 0.3s;
        }

        .confidence-value {
          font-size: 0.6875rem;
          color: var(--cl-text-tertiary, #4b5563);
        }

        .step-tokens {
          font-size: 0.6875rem;
          color: var(--cl-text-muted, #6b7280);
          margin-left: 0.5rem;
        }

        .step-expand {
          display: flex;
          align-items: center;
          color: var(--cl-text-tertiary, #4b5563);
          transition: transform 0.2s;
        }

        .step-expand.expanded {
          transform: rotate(90deg);
        }

        .step-expand svg {
          width: 14px;
          height: 14px;
        }

        .step-content {
          padding: 0 0.75rem 0.75rem;
          font-size: 0.875rem;
          color: var(--cl-text-secondary, #374151);
          line-height: 1.6;
        }

        .step-children {
          border-top: 1px solid var(--cl-border-primary, #e5e7eb);
          padding: 0.5rem;
        }

        .streaming-indicator {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem;
          color: var(--cl-text-tertiary, #4b5563);
          font-size: 0.875rem;
        }

        .pulse {
          width: 8px;
          height: 8px;
          background: #8b5cf6;
          border-radius: 50%;
          animation: pulseDot 1.5s infinite;
        }

        @keyframes pulseDot {
          0%,
          100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.5);
            opacity: 0.5;
          }
        }

        /* Tree View */
        .thinking-tree {
          padding: 0.5rem 0;
        }

        .tree-node {
          display: flex;
          gap: 0.75rem;
          padding: 0.5rem 0;
        }

        .tree-connector {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 24px;
        }

        .connector-line {
          flex: 1;
          width: 2px;
          background: var(--cl-border-secondary, #d1d5db);
          margin-bottom: -8px;
        }

        .node-dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          border: 2px solid white;
          box-shadow: 0 0 0 2px var(--cl-border-secondary, #d1d5db);
        }

        .tree-content {
          flex: 1;
        }

        .node-header {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          margin-bottom: 0.25rem;
        }

        .node-icon {
          font-size: 0.875rem;
        }

        .node-type {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--cl-text-secondary, #374151);
        }

        .node-text {
          font-size: 0.875rem;
          color: var(--cl-text-secondary, #374151);
          line-height: 1.5;
        }

        /* Timeline View */
        .thinking-timeline {
          padding: 1rem 0;
        }

        .timeline-bar {
          position: relative;
          height: 24px;
          background: var(--cl-bg-tertiary, #f3f4f6);
          border-radius: 4px;
          overflow: hidden;
        }

        .timeline-segment {
          position: absolute;
          top: 4px;
          height: 16px;
          border-radius: 2px;
          opacity: 0.8;
          transition: opacity 0.15s;
        }

        .timeline-segment:hover {
          opacity: 1;
        }

        .timeline-labels {
          display: flex;
          justify-content: space-between;
          margin-top: 0.25rem;
          font-size: 0.6875rem;
          color: var(--cl-text-muted, #6b7280);
        }

        /* Summary */
        .thinking-summary {
          padding: 0.75rem 1rem;
          background: var(--cl-bg-tertiary, #f3f4f6);
          border-top: 1px solid var(--cl-border-primary, #e5e7eb);
          font-size: 0.875rem;
          color: var(--cl-text-secondary, #374151);
        }

        .thinking-summary strong {
          color: var(--cl-text-primary, #1a1f36);
        }
      `}</style>
    </div>
  );
}

export default CodeLabThinking;
