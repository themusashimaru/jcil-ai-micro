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
import './code-lab-plan-view.css';
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

    </div>
  );
}
