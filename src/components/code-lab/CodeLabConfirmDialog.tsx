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
import './code-lab-confirm-dialog.css';

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
