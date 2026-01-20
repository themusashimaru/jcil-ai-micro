'use client';

/**
 * CODE LAB TOKEN DISPLAY
 *
 * Displays token usage and cost information.
 * Features:
 * - Real-time token count
 * - Cost estimation
 * - Context window usage bar
 * - Compact/expandable view
 *
 * @version 1.0.0
 */

import { useState, useMemo } from 'react';
import { TokenTracker, type SessionStats } from '@/lib/workspace/token-tracker';

interface CodeLabTokenDisplayProps {
  stats: SessionStats;
  compact?: boolean;
  className?: string;
}

export function CodeLabTokenDisplay({
  stats,
  compact = true,
  className = '',
}: CodeLabTokenDisplayProps) {
  const [expanded, setExpanded] = useState(false);

  // Calculate display values
  const display = useMemo(() => {
    const totalTokens = stats.totalInputTokens + stats.totalOutputTokens;
    const percentUsed = stats.contextUsagePercent;
    const isNearLimit = percentUsed > 80;
    const isCritical = percentUsed > 95;

    return {
      totalTokens: TokenTracker.formatTokens(totalTokens),
      inputTokens: TokenTracker.formatTokens(stats.totalInputTokens),
      outputTokens: TokenTracker.formatTokens(stats.totalOutputTokens),
      totalCost: TokenTracker.formatCost(stats.totalCost.totalCost),
      percentUsed: Math.round(percentUsed),
      isNearLimit,
      isCritical,
      statusColor: isCritical
        ? 'var(--cl-error, #ef4444)'
        : isNearLimit
          ? 'var(--cl-warning, #f59e0b)'
          : 'var(--cl-success, #10b981)',
    };
  }, [stats]);

  if (compact && !expanded) {
    return (
      <button
        className={`token-display-compact ${className}`}
        onClick={() => setExpanded(true)}
        aria-label={`Token usage: ${display.totalTokens}, Cost: ${display.totalCost}`}
      >
        <span className="token-count">{display.totalTokens}</span>
        <span className="token-divider">•</span>
        <span className="token-cost">{display.totalCost}</span>
        <div
          className="context-indicator"
          style={{ backgroundColor: display.statusColor }}
          title={`Context: ${display.percentUsed}%`}
        />

        <style jsx>{`
          .token-display-compact {
            display: flex;
            align-items: center;
            gap: 0.375rem;
            padding: 0.25rem 0.5rem;
            background: var(--cl-bg-secondary, #f9fafb);
            border: 1px solid var(--cl-border-primary, #e5e7eb);
            border-radius: 6px;
            font-size: 0.75rem;
            color: var(--cl-text-secondary, #6b7280);
            cursor: pointer;
            transition: all 0.15s ease;
          }

          .token-display-compact:hover {
            background: var(--cl-bg-tertiary, #f3f4f6);
            color: var(--cl-text-primary, #1a1f36);
          }

          .token-count {
            font-weight: 500;
            font-family: 'SF Mono', monospace;
          }

          .token-divider {
            opacity: 0.5;
          }

          .token-cost {
            font-family: 'SF Mono', monospace;
          }

          .context-indicator {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            margin-left: 0.25rem;
          }

          /* Mobile: More compact display */
          @media (max-width: 768px) {
            .token-display-compact {
              padding: 0.1875rem 0.375rem;
              font-size: 0.6875rem;
              gap: 0.25rem;
            }

            .token-divider,
            .token-cost {
              display: none;
            }

            .context-indicator {
              margin-left: 0.125rem;
            }
          }

          /* Extra small screens: Show only context indicator */
          @media (max-width: 480px) {
            .token-count {
              display: none;
            }

            .token-display-compact {
              padding: 0.25rem;
              min-width: 24px;
              min-height: 24px;
              justify-content: center;
            }

            .context-indicator {
              width: 8px;
              height: 8px;
              margin-left: 0;
            }
          }
        `}</style>
      </button>
    );
  }

  return (
    <div className={`token-display-expanded ${className}`}>
      {/* Header with close button */}
      <div className="token-header">
        <span className="token-title">Token Usage</span>
        {compact && (
          <button className="token-close" onClick={() => setExpanded(false)} aria-label="Collapse">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Token breakdown */}
      <div className="token-breakdown">
        <div className="token-row">
          <span className="token-label">Input</span>
          <span className="token-value">{display.inputTokens}</span>
        </div>
        <div className="token-row">
          <span className="token-label">Output</span>
          <span className="token-value">{display.outputTokens}</span>
        </div>
        <div className="token-row total">
          <span className="token-label">Total</span>
          <span className="token-value">{display.totalTokens}</span>
        </div>
      </div>

      {/* Context usage bar */}
      <div className="context-section">
        <div className="context-header">
          <span className="context-label">Context</span>
          <span className="context-percent" style={{ color: display.statusColor }}>
            {display.percentUsed}%
          </span>
        </div>
        <div className="context-bar">
          <div
            className="context-fill"
            style={{
              width: `${display.percentUsed}%`,
              backgroundColor: display.statusColor,
            }}
          />
        </div>
        {display.isNearLimit && (
          <div className="context-warning">
            {display.isCritical
              ? '⚠️ Context nearly full! Use /compact'
              : '💡 Consider using /compact soon'}
          </div>
        )}
      </div>

      {/* Cost section */}
      <div className="cost-section">
        <div className="cost-row">
          <span className="cost-label">Estimated Cost</span>
          <span className="cost-value">{display.totalCost}</span>
        </div>
        <div className="cost-detail">
          Input: {TokenTracker.formatCost(stats.totalCost.inputCost)} • Output:{' '}
          {TokenTracker.formatCost(stats.totalCost.outputCost)}
        </div>
      </div>

      {/* Message count */}
      <div className="meta-section">
        <span>{stats.messageCount} messages</span>
      </div>

      <style jsx>{`
        .token-display-expanded {
          width: 220px;
          background: var(--cl-bg-primary, #ffffff);
          border: 1px solid var(--cl-border-primary, #e5e7eb);
          border-radius: 10px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          overflow: hidden;
          font-size: 0.8125rem;
        }

        .token-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.625rem 0.75rem;
          background: var(--cl-bg-secondary, #f9fafb);
          border-bottom: 1px solid var(--cl-border-primary, #e5e7eb);
        }

        .token-title {
          font-weight: 600;
          color: var(--cl-text-primary, #1a1f36);
        }

        .token-close {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          background: none;
          border: none;
          border-radius: 4px;
          color: var(--cl-text-tertiary, #6b7280);
          cursor: pointer;
        }

        .token-close:hover {
          background: var(--cl-bg-tertiary, #f3f4f6);
          color: var(--cl-text-primary, #1a1f36);
        }

        .token-breakdown {
          padding: 0.625rem 0.75rem;
          border-bottom: 1px solid var(--cl-border-primary, #e5e7eb);
        }

        .token-row {
          display: flex;
          justify-content: space-between;
          padding: 0.125rem 0;
          color: var(--cl-text-secondary, #6b7280);
        }

        .token-row.total {
          margin-top: 0.25rem;
          padding-top: 0.375rem;
          border-top: 1px dashed var(--cl-border-primary, #e5e7eb);
          font-weight: 600;
          color: var(--cl-text-primary, #1a1f36);
        }

        .token-value {
          font-family: 'SF Mono', monospace;
        }

        .context-section {
          padding: 0.625rem 0.75rem;
          border-bottom: 1px solid var(--cl-border-primary, #e5e7eb);
        }

        .context-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 0.375rem;
        }

        .context-label {
          color: var(--cl-text-secondary, #6b7280);
        }

        .context-percent {
          font-family: 'SF Mono', monospace;
          font-weight: 600;
        }

        .context-bar {
          height: 6px;
          background: var(--cl-bg-tertiary, #e5e7eb);
          border-radius: 3px;
          overflow: hidden;
        }

        .context-fill {
          height: 100%;
          border-radius: 3px;
          transition: width 0.3s ease;
        }

        .context-warning {
          margin-top: 0.375rem;
          padding: 0.25rem 0.375rem;
          background: color-mix(in srgb, var(--cl-warning, #f59e0b) 10%, transparent);
          border-radius: 4px;
          font-size: 0.6875rem;
          color: var(--cl-warning, #f59e0b);
        }

        .cost-section {
          padding: 0.625rem 0.75rem;
        }

        .cost-row {
          display: flex;
          justify-content: space-between;
        }

        .cost-label {
          color: var(--cl-text-secondary, #6b7280);
        }

        .cost-value {
          font-family: 'SF Mono', monospace;
          font-weight: 600;
          color: var(--cl-text-primary, #1a1f36);
        }

        .cost-detail {
          margin-top: 0.25rem;
          font-size: 0.6875rem;
          color: var(--cl-text-tertiary, #6b7280);
        }

        .meta-section {
          padding: 0.5rem 0.75rem;
          background: var(--cl-bg-secondary, #f9fafb);
          font-size: 0.6875rem;
          color: var(--cl-text-tertiary, #6b7280);
          text-align: center;
        }
      `}</style>
    </div>
  );
}

export default CodeLabTokenDisplay;
