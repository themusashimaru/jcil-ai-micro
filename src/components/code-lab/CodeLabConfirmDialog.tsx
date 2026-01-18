'use client';

/**
 * CODE LAB CONFIRMATION DIALOG
 *
 * A beautiful modal for confirming dangerous operations.
 * Features:
 * - Clear warning indicators
 * - Action details display
 * - Keyboard support (Enter to confirm, Escape to cancel)
 * - Different severity levels (warning, danger, info)
 */

import { useEffect, useRef, useCallback } from 'react';

export type ConfirmSeverity = 'info' | 'warning' | 'danger';

export interface ConfirmAction {
  id: string;
  title: string;
  description: string;
  severity: ConfirmSeverity;
  details?: string[];
  confirmLabel?: string;
  cancelLabel?: string;
}

interface CodeLabConfirmDialogProps {
  isOpen: boolean;
  action: ConfirmAction | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function CodeLabConfirmDialog({
  isOpen,
  action,
  onConfirm,
  onCancel,
}: CodeLabConfirmDialogProps) {
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus confirm button when opened
  useEffect(() => {
    if (isOpen && confirmButtonRef.current) {
      setTimeout(() => confirmButtonRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Handle keyboard events
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      } else if (e.key === 'Enter' && e.target === confirmButtonRef.current) {
        e.preventDefault();
        onConfirm();
      }
    },
    [isOpen, onCancel, onConfirm]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!isOpen || !action) return null;

  const severityConfig = {
    info: {
      icon: '💡',
      color: 'var(--cl-info)',
      bgColor: 'color-mix(in srgb, var(--cl-info) 10%, var(--cl-bg-primary))',
      borderColor: 'color-mix(in srgb, var(--cl-info) 40%, var(--cl-bg-primary))',
    },
    warning: {
      icon: '⚠️',
      color: 'var(--cl-warning)',
      bgColor: 'color-mix(in srgb, var(--cl-warning) 10%, var(--cl-bg-primary))',
      borderColor: 'color-mix(in srgb, var(--cl-warning) 40%, var(--cl-bg-primary))',
    },
    danger: {
      icon: '🚨',
      color: 'var(--cl-error)',
      bgColor: 'color-mix(in srgb, var(--cl-error) 10%, var(--cl-bg-primary))',
      borderColor: 'color-mix(in srgb, var(--cl-error) 40%, var(--cl-bg-primary))',
    },
  };

  const config = severityConfig[action.severity];

  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div
        ref={dialogRef}
        className="confirm-dialog"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-description"
      >
        {/* Header with icon */}
        <div className="confirm-header" style={{ backgroundColor: config.bgColor }}>
          <span className="confirm-icon">{config.icon}</span>
          <div className="confirm-header-text">
            <h2 id="confirm-title">{action.title}</h2>
            <p id="confirm-description">{action.description}</p>
          </div>
        </div>

        {/* Details list */}
        {action.details && action.details.length > 0 && (
          <div className="confirm-details">
            <div className="details-label">This will:</div>
            <ul>
              {action.details.map((detail, idx) => (
                <li key={idx}>
                  <span className="detail-bullet" style={{ color: config.color }}>
                    •
                  </span>
                  {detail}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Action buttons */}
        <div className="confirm-actions">
          <button className="cancel-btn" onClick={onCancel}>
            {action.cancelLabel || 'Cancel'}
          </button>
          <button
            ref={confirmButtonRef}
            className={`confirm-btn ${action.severity}`}
            onClick={onConfirm}
          >
            {action.confirmLabel || 'Confirm'}
          </button>
        </div>

        {/* Keyboard hint */}
        <div className="confirm-hint">
          <kbd>Enter</kbd> to confirm · <kbd>Esc</kbd> to cancel
        </div>
      </div>

      <style jsx>{`
        .confirm-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1100;
          animation: fadeIn 0.15s ease;
          padding: 1rem;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .confirm-dialog {
          width: 100%;
          max-width: 440px;
          background: white;
          border-radius: 16px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          overflow: hidden;
          animation: scaleIn 0.2s ease;
        }

        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }

        .confirm-header {
          display: flex;
          align-items: flex-start;
          gap: 1rem;
          padding: 1.5rem;
          border-bottom: 1px solid #e5e7eb;
        }

        .confirm-icon {
          font-size: 2rem;
          flex-shrink: 0;
        }

        .confirm-header-text {
          flex: 1;
        }

        .confirm-header h2 {
          margin: 0 0 0.375rem;
          font-size: 1.125rem;
          font-weight: 600;
          color: #1a1f36;
        }

        .confirm-header p {
          margin: 0;
          font-size: 0.875rem;
          color: #4b5563;
          line-height: 1.5;
        }

        .confirm-details {
          padding: 1rem 1.5rem;
          background: #f9fafb;
        }

        .details-label {
          font-size: 0.75rem;
          font-weight: 600;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 0.5rem;
        }

        .confirm-details ul {
          margin: 0;
          padding: 0;
          list-style: none;
        }

        .confirm-details li {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
          font-size: 0.875rem;
          color: #374151;
          padding: 0.375rem 0;
        }

        .detail-bullet {
          font-weight: bold;
          flex-shrink: 0;
        }

        .confirm-actions {
          display: flex;
          gap: 0.75rem;
          padding: 1.25rem 1.5rem;
          justify-content: flex-end;
        }

        .cancel-btn {
          padding: 0.625rem 1.25rem;
          background: #f3f4f6;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          font-size: 0.875rem;
          font-weight: 500;
          color: #374151;
          cursor: pointer;
          transition: all 0.15s;
        }

        .cancel-btn:hover {
          background: #e5e7eb;
        }

        .confirm-btn {
          padding: 0.625rem 1.25rem;
          border: none;
          border-radius: 8px;
          font-size: 0.875rem;
          font-weight: 500;
          color: white;
          cursor: pointer;
          transition: all 0.15s;
        }

        .confirm-btn.info {
          background: #3b82f6;
        }

        .confirm-btn.info:hover {
          background: #2563eb;
        }

        .confirm-btn.warning {
          background: #f59e0b;
        }

        .confirm-btn.warning:hover {
          background: #d97706;
        }

        .confirm-btn.danger {
          background: #ef4444;
        }

        .confirm-btn.danger:hover {
          background: #dc2626;
        }

        .confirm-btn:focus {
          outline: none;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.3);
        }

        .confirm-hint {
          padding: 0.75rem 1.5rem;
          background: #f9fafb;
          border-top: 1px solid #e5e7eb;
          text-align: center;
          font-size: 0.75rem;
          color: #9ca3af;
        }

        .confirm-hint kbd {
          display: inline-flex;
          align-items: center;
          padding: 0.125rem 0.375rem;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 4px;
          font-size: 0.6875rem;
          font-family: inherit;
          color: #6b7280;
          margin: 0 0.125rem;
        }

        @media (max-width: 480px) {
          .confirm-dialog {
            margin: 0.5rem;
          }

          .confirm-actions {
            flex-direction: column-reverse;
          }

          .cancel-btn,
          .confirm-btn {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
}

/**
 * Pre-defined confirmation actions for common operations
 */
export const CONFIRM_ACTIONS = {
  gitPush: {
    id: 'git-push',
    title: 'Push to Remote',
    description: 'You are about to push your commits to the remote repository.',
    severity: 'warning' as ConfirmSeverity,
    details: [
      'Push all committed changes to the remote',
      'Others will see these changes',
      'This cannot be easily undone',
    ],
    confirmLabel: 'Push Changes',
  },
  gitForceOverwrite: {
    id: 'git-force',
    title: 'Force Push',
    description: 'Force pushing will overwrite remote history. This is a destructive operation.',
    severity: 'danger' as ConfirmSeverity,
    details: [
      'Overwrite remote branch history',
      'May cause conflicts for other collaborators',
      'Lost commits cannot be recovered',
    ],
    confirmLabel: 'Force Push',
  },
  deleteFile: {
    id: 'delete-file',
    title: 'Delete File',
    description: 'Are you sure you want to delete this file?',
    severity: 'danger' as ConfirmSeverity,
    details: ['Remove the file from the workspace', 'File contents will be lost'],
    confirmLabel: 'Delete',
  },
  installPackage: {
    id: 'install-package',
    title: 'Install Package',
    description: 'Install a new npm package to your project.',
    severity: 'info' as ConfirmSeverity,
    details: [
      'Add package to node_modules',
      'Update package.json dependencies',
      'May download additional dependencies',
    ],
    confirmLabel: 'Install',
  },
  runCommand: {
    id: 'run-command',
    title: 'Execute Command',
    description: 'Run a shell command in the workspace sandbox.',
    severity: 'warning' as ConfirmSeverity,
    details: [
      'Execute command in isolated environment',
      'May modify workspace files',
      'Review output for any issues',
    ],
    confirmLabel: 'Run',
  },
  discardChanges: {
    id: 'discard-changes',
    title: 'Discard Changes',
    description: 'Discard all uncommitted changes to the current file.',
    severity: 'danger' as ConfirmSeverity,
    details: [
      'Revert file to last committed state',
      'All unsaved changes will be lost',
      'This cannot be undone',
    ],
    confirmLabel: 'Discard',
  },
};
