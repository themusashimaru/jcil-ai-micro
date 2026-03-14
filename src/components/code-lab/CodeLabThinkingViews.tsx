'use client';

import {
  type ThinkingStep,
  type ThinkingSession,
  type ThinkingStats,
  stepTypeConfig,
} from './CodeLabThinkingTypes';

interface StreamViewProps {
  session: ThinkingSession;
  isStreaming: boolean;
  expandedSteps: Set<string>;
  toggleStep: (stepId: string) => void;
  showConfidence: boolean;
  showTokens: boolean;
  streamEndRef: React.RefObject<HTMLDivElement>;
}

function renderConfidence(confidence: number) {
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
}

function renderStep(
  step: ThinkingStep,
  expandedSteps: Set<string>,
  toggleStep: (stepId: string) => void,
  showConfidence: boolean,
  showTokens: boolean,
  depth: number = 0
) {
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
          {step.children!.map((child) =>
            renderStep(child, expandedSteps, toggleStep, showConfidence, showTokens, depth + 1)
          )}
        </div>
      )}
    </div>
  );
}

export function ThinkingStreamView({
  session,
  isStreaming,
  expandedSteps,
  toggleStep,
  showConfidence,
  showTokens,
  streamEndRef,
}: StreamViewProps) {
  return (
    <div className="thinking-stream">
      {session.steps.map((step) =>
        renderStep(step, expandedSteps, toggleStep, showConfidence, showTokens)
      )}
      {isStreaming && (
        <div className="streaming-indicator">
          <div className="pulse" />
          <span>Thinking...</span>
        </div>
      )}
      <div ref={streamEndRef} />

      <style jsx>{`
        .thinking-stream {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
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
      `}</style>
    </div>
  );
}

interface TreeViewProps {
  session: ThinkingSession;
}

export function ThinkingTreeView({ session }: TreeViewProps) {
  return (
    <div className="thinking-tree">
      <div className="tree-visualization">
        {session.steps.map((step, index) => (
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

      <style jsx>{`
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
          color: var(--cl-text-secondary, var(--text-secondary, #9ca3af));
        }

        .node-text {
          font-size: 0.875rem;
          color: var(--cl-text-secondary, var(--text-secondary, #9ca3af));
          line-height: 1.5;
        }
      `}</style>
    </div>
  );
}

interface TimelineViewProps {
  session: ThinkingSession;
  stats: ThinkingStats;
}

export function ThinkingTimelineView({ session, stats }: TimelineViewProps) {
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

      <style jsx>{`
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
          color: var(--cl-text-muted, var(--text-muted, #9ca3af));
        }
      `}</style>
    </div>
  );
}
