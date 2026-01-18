'use client';

/**
 * CODE LAB PLAN VIEW
 *
 * Visual display for the plan mode system.
 * Features:
 * - Step-by-step progress display
 * - Approval controls
 * - Auto-accept toggle
 * - Progress tracking
 */

import { useState, useCallback } from 'react';
import type { Plan, PlanStep, PlanStepStatus } from '@/lib/workspace/plan-mode';

interface CodeLabPlanViewProps {
  plan: Plan;
  onApprove?: () => void;
  onSkipStep?: (reason?: string) => void;
  onCancelPlan?: () => void;
  onToggleAutoAccept?: (enabled: boolean) => void;
  className?: string;
}

// Status icons and colors
const STATUS_CONFIG: Record<PlanStepStatus, { icon: string; color: string; label: string }> = {
  pending: { icon: '○', color: 'var(--cl-text-muted)', label: 'Pending' },
  in_progress: { icon: '◐', color: 'var(--cl-info)', label: 'In Progress' },
  completed: { icon: '✓', color: 'var(--cl-success)', label: 'Completed' },
  skipped: { icon: '○', color: 'var(--cl-warning)', label: 'Skipped' },
  failed: { icon: '✕', color: 'var(--cl-error)', label: 'Failed' },
};

const COMPLEXITY_CONFIG: Record<string, { color: string; label: string }> = {
  low: { color: 'var(--cl-success)', label: 'Low' },
  medium: { color: 'var(--cl-warning)', label: 'Medium' },
  high: { color: 'var(--cl-error)', label: 'High' },
};

function PlanStepItem({ step, isActive }: { step: PlanStep; isActive: boolean }) {
  const [expanded, setExpanded] = useState(isActive);
  const status = STATUS_CONFIG[step.status];
  const complexity = step.complexity ? COMPLEXITY_CONFIG[step.complexity] : null;

  return (
    <div className={`plan-step ${step.status} ${isActive ? 'active' : ''}`}>
      <div className="step-header" onClick={() => setExpanded(!expanded)}>
        <span className="step-status" style={{ color: status.color }}>
          {status.icon}
        </span>
        <span className="step-number">{step.number}</span>
        <span className="step-title">{step.title}</span>
        {complexity && (
          <span className="step-complexity" style={{ color: complexity.color }}>
            {complexity.label}
          </span>
        )}
        <span className={`step-expand ${expanded ? 'expanded' : ''}`}>▼</span>
      </div>

      {expanded && (
        <div className="step-content">
          <p className="step-description">{step.description}</p>

          {step.files && step.files.length > 0 && (
            <div className="step-files">
              <span className="files-label">Files:</span>
              <div className="files-list">
                {step.files.map((file, i) => (
                  <span key={i} className="file-path">
                    {file}
                  </span>
                ))}
              </div>
            </div>
          )}

          {step.output && (
            <div className="step-output">
              <span className="output-label">Output:</span>
              <pre className="output-content">{step.output}</pre>
            </div>
          )}

          {step.reason && (
            <div className="step-reason">
              <span className="reason-label">
                {step.status === 'failed' ? 'Error:' : 'Reason:'}
              </span>
              <span className="reason-content">{step.reason}</span>
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        .plan-step {
          background: var(--cl-bg-secondary);
          border: 1px solid var(--cl-border-primary);
          border-radius: 8px;
          overflow: hidden;
          transition: all 0.2s;
        }

        .plan-step.active {
          border-color: var(--cl-accent-primary);
          box-shadow: 0 0 0 1px var(--cl-accent-primary);
        }

        .plan-step.completed {
          opacity: 0.8;
        }

        .plan-step.skipped,
        .plan-step.failed {
          opacity: 0.7;
        }

        .step-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.875rem 1rem;
          cursor: pointer;
          min-height: 44px;
        }

        .step-header:hover {
          background: var(--cl-bg-hover);
        }

        .step-status {
          font-size: 1rem;
          flex-shrink: 0;
        }

        .step-number {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--cl-text-muted);
          background: var(--cl-bg-tertiary);
          padding: 0.125rem 0.5rem;
          border-radius: 4px;
          flex-shrink: 0;
        }

        .step-title {
          flex: 1;
          font-weight: 500;
          color: var(--cl-text-primary);
        }

        .step-complexity {
          font-size: 0.6875rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 0.125rem 0.375rem;
          background: var(--cl-bg-tertiary);
          border-radius: 4px;
        }

        .step-expand {
          font-size: 0.625rem;
          color: var(--cl-text-muted);
          transition: transform 0.2s;
        }

        .step-expand.expanded {
          transform: rotate(180deg);
        }

        .step-content {
          padding: 0 1rem 1rem;
          border-top: 1px solid var(--cl-border-primary);
        }

        .step-description {
          font-size: 0.875rem;
          color: var(--cl-text-secondary);
          margin: 0.75rem 0;
          line-height: 1.5;
        }

        .step-files {
          margin-top: 0.75rem;
        }

        .files-label,
        .output-label,
        .reason-label {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--cl-text-muted);
          display: block;
          margin-bottom: 0.375rem;
        }

        .files-list {
          display: flex;
          flex-wrap: wrap;
          gap: 0.375rem;
        }

        .file-path {
          font-size: 0.75rem;
          font-family: 'SF Mono', 'Menlo', monospace;
          background: var(--cl-bg-tertiary);
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          color: var(--cl-accent-primary);
        }

        .step-output {
          margin-top: 0.75rem;
        }

        .output-content {
          font-size: 0.75rem;
          font-family: 'SF Mono', 'Menlo', monospace;
          background: var(--cl-bg-code);
          color: var(--cl-text-primary);
          padding: 0.5rem;
          border-radius: 4px;
          margin: 0;
          white-space: pre-wrap;
          overflow-x: auto;
        }

        .step-reason {
          margin-top: 0.75rem;
        }

        .reason-content {
          font-size: 0.8125rem;
          color: var(--cl-text-secondary);
        }
      `}</style>
    </div>
  );
}

export function CodeLabPlanView({
  plan,
  onApprove,
  onSkipStep,
  onCancelPlan,
  onToggleAutoAccept,
  className = '',
}: CodeLabPlanViewProps) {
  const [skipReason, setSkipReason] = useState('');

  const handleSkip = useCallback(() => {
    onSkipStep?.(skipReason || undefined);
    setSkipReason('');
  }, [onSkipStep, skipReason]);

  const progress =
    plan.steps.length > 0
      ? Math.round(
          (plan.steps.filter((s) => s.status === 'completed' || s.status === 'skipped').length /
            plan.steps.length) *
            100
        )
      : 0;

  const currentStep = plan.steps[plan.currentStepIndex];

  return (
    <div className={`plan-view ${className}`}>
      {/* Header */}
      <div className="plan-header">
        <div className="plan-info">
          <h3 className="plan-title">{plan.title}</h3>
          <span className={`plan-status ${plan.status}`}>{plan.status.replace('_', ' ')}</span>
        </div>
        <div className="plan-progress">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="progress-text">{progress}%</span>
        </div>
      </div>

      {/* Description */}
      {plan.description && <p className="plan-description">{plan.description}</p>}

      {/* Steps */}
      <div className="plan-steps">
        {plan.steps.map((step) => (
          <PlanStepItem key={step.id} step={step} isActive={step.status === 'in_progress'} />
        ))}
      </div>

      {/* Actions */}
      <div className="plan-actions">
        {plan.status === 'draft' && (
          <>
            <button className="action-btn approve" onClick={onApprove}>
              <span className="btn-icon">▶</span>
              Approve & Start
            </button>
            <button className="action-btn cancel" onClick={onCancelPlan}>
              Cancel
            </button>
          </>
        )}

        {plan.status === 'in_progress' && currentStep && (
          <>
            <div className="skip-controls">
              <input
                type="text"
                className="skip-reason"
                placeholder="Reason to skip (optional)"
                value={skipReason}
                onChange={(e) => setSkipReason(e.target.value)}
              />
              <button className="action-btn skip" onClick={handleSkip}>
                Skip Step
              </button>
            </div>
            <button className="action-btn cancel" onClick={onCancelPlan}>
              Cancel Plan
            </button>
          </>
        )}

        {(plan.status === 'completed' || plan.status === 'cancelled') && (
          <div className="plan-complete">
            {plan.status === 'completed' ? '✓ Plan completed' : '○ Plan cancelled'}
          </div>
        )}
      </div>

      {/* Auto-accept toggle */}
      {(plan.status === 'draft' || plan.status === 'in_progress') && onToggleAutoAccept && (
        <label className="auto-accept-toggle">
          <input
            type="checkbox"
            checked={plan.autoAccept}
            onChange={(e) => onToggleAutoAccept(e.target.checked)}
          />
          <span className="toggle-label">Auto-accept edits (Shift+Tab)</span>
        </label>
      )}

      <style jsx>{`
        .plan-view {
          background: var(--cl-bg-primary);
          border: 1px solid var(--cl-border-primary);
          border-radius: 12px;
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .plan-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 1rem;
        }

        .plan-info {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex: 1;
          min-width: 0;
        }

        .plan-title {
          margin: 0;
          font-size: 1rem;
          font-weight: 600;
          color: var(--cl-text-primary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .plan-status {
          font-size: 0.6875rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          flex-shrink: 0;
        }

        .plan-status.draft {
          background: var(--cl-bg-tertiary);
          color: var(--cl-text-muted);
        }

        .plan-status.approved,
        .plan-status.in_progress {
          background: color-mix(in srgb, var(--cl-info) 15%, transparent);
          color: var(--cl-info);
        }

        .plan-status.completed {
          background: color-mix(in srgb, var(--cl-success) 15%, transparent);
          color: var(--cl-success);
        }

        .plan-status.cancelled {
          background: color-mix(in srgb, var(--cl-warning) 15%, transparent);
          color: var(--cl-warning);
        }

        .plan-progress {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-shrink: 0;
        }

        .progress-bar {
          width: 80px;
          height: 6px;
          background: var(--cl-bg-tertiary);
          border-radius: 3px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: var(--cl-success);
          transition: width 0.3s ease;
        }

        .progress-text {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--cl-text-muted);
          min-width: 2.5rem;
        }

        .plan-description {
          font-size: 0.875rem;
          color: var(--cl-text-secondary);
          margin: 0;
          line-height: 1.5;
        }

        .plan-steps {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .plan-actions {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.75rem;
          padding-top: 0.5rem;
          border-top: 1px solid var(--cl-border-primary);
        }

        .action-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.625rem 1rem;
          min-height: 44px;
          border: 1px solid var(--cl-border-primary);
          border-radius: 8px;
          background: var(--cl-bg-primary);
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s;
        }

        .action-btn:hover {
          background: var(--cl-bg-hover);
        }

        .action-btn.approve {
          background: var(--cl-success);
          border-color: var(--cl-success);
          color: white;
        }

        .action-btn.approve:hover {
          filter: brightness(1.1);
        }

        .action-btn.skip {
          color: var(--cl-warning);
          border-color: var(--cl-warning);
        }

        .action-btn.cancel {
          color: var(--cl-text-muted);
        }

        .btn-icon {
          font-size: 0.75rem;
        }

        .skip-controls {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex: 1;
        }

        .skip-reason {
          flex: 1;
          padding: 0.5rem 0.75rem;
          min-height: 44px;
          border: 1px solid var(--cl-border-primary);
          border-radius: 8px;
          background: var(--cl-bg-input);
          color: var(--cl-text-primary);
          font-size: 0.875rem;
        }

        .skip-reason:focus {
          outline: none;
          border-color: var(--cl-accent-primary);
        }

        .plan-complete {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--cl-text-secondary);
        }

        .auto-accept-toggle {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
        }

        .auto-accept-toggle input {
          width: 18px;
          height: 18px;
          accent-color: var(--cl-accent-primary);
        }

        .toggle-label {
          font-size: 0.8125rem;
          color: var(--cl-text-muted);
        }

        @media (max-width: 640px) {
          .plan-header {
            flex-direction: column;
            gap: 0.75rem;
          }

          .plan-progress {
            align-self: stretch;
          }

          .progress-bar {
            flex: 1;
          }

          .skip-controls {
            flex-direction: column;
            align-items: stretch;
          }

          .skip-reason {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
