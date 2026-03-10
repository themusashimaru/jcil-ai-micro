'use client';

/**
 * CODE LAB PERMISSION DIALOG
 *
 * Confirms dangerous operations before execution.
 * Features:
 * - File overwrite confirmation
 * - Git push/force push warnings
 * - Destructive command detection
 * - Risk level indicators
 * - Always allow / Once options
 * - Smooth animations
 *
 * Matches Claude Code's permission model while looking sick.
 *
 * @version 1.0.0
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useFocusTrap } from '@/hooks/useFocusTrap';

type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
type OperationType =
  | 'file_overwrite'
  | 'file_delete'
  | 'git_push'
  | 'git_force_push'
  | 'shell_command'
  | 'deploy'
  | 'env_change';

interface PermissionRequest {
  id: string;
  type: OperationType;
  title: string;
  description: string;
  details?: string[];
  riskLevel: RiskLevel;
  allowAlways?: boolean;
  command?: string;
  affectedFiles?: string[];
}

interface CodeLabPermissionDialogProps {
  request: PermissionRequest | null;
  onAllow: (alwaysAllow?: boolean) => void;
  onDeny: () => void;
  isOpen: boolean;
}

// Risk level configurations - uses CSS variables with fallback backgrounds
const riskConfig: Record<
  RiskLevel,
  { color: string; bgColor: string; icon: string; label: string }
> = {
  low: {
    color: 'var(--cl-success)',
    bgColor: 'color-mix(in srgb, var(--cl-success) 10%, transparent)',
    icon: '✓',
    label: 'Low Risk',
  },
  medium: {
    color: 'var(--cl-warning)',
    bgColor: 'color-mix(in srgb, var(--cl-warning) 10%, transparent)',
    icon: '⚠',
    label: 'Medium Risk',
  },
  high: {
    color: 'var(--cl-error)',
    bgColor: 'color-mix(in srgb, var(--cl-error) 10%, transparent)',
    icon: '⚠',
    label: 'High Risk',
  },
  critical: {
    color: 'var(--cl-critical)',
    bgColor: 'color-mix(in srgb, var(--cl-critical) 15%, transparent)',
    icon: '🛑',
    label: 'Critical',
  },
};

// Operation type configurations
const operationConfig: Record<OperationType, { icon: string; label: string }> = {
  file_overwrite: { icon: '📝', label: 'File Overwrite' },
  file_delete: { icon: '🗑️', label: 'File Deletion' },
  git_push: { icon: '🚀', label: 'Git Push' },
  git_force_push: { icon: '⚠️', label: 'Force Push' },
  shell_command: { icon: '💻', label: 'Shell Command' },
  deploy: { icon: '🌐', label: 'Deployment' },
  env_change: { icon: '⚙️', label: 'Environment Change' },
};

export function CodeLabPermissionDialog({
  request,
  onAllow,
  onDeny,
  isOpen,
}: CodeLabPermissionDialogProps) {
  const [alwaysAllow, setAlwaysAllow] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  void dialogRef; // Reserved for direct DOM manipulation

  // Handle deny with animation
  const handleDeny = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      onDeny();
      setIsClosing(false);
    }, 200);
  }, [onDeny]);

  // Handle allow with animation
  const handleAllow = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      onAllow(alwaysAllow);
      setIsClosing(false);
    }, 200);
  }, [onAllow, alwaysAllow]);

  // Focus trap
  const { containerRef } = useFocusTrap({
    enabled: isOpen,
    onEscape: handleDeny,
    restoreFocus: true,
  });

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setAlwaysAllow(false);
      setIsClosing(false);
    }
  }, [isOpen]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleAllow();
      }
    },
    [isOpen, handleAllow]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!isOpen || !request) return null;

  const risk = riskConfig[request.riskLevel];
  const operation = operationConfig[request.type];

  return (
    <div className={`permission-overlay ${isClosing ? 'closing' : ''}`}>
      <div
        ref={containerRef as React.RefObject<HTMLDivElement>}
        className={`permission-dialog ${isClosing ? 'closing' : ''}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="permission-title"
        aria-describedby="permission-description"
      >
        {/* Risk indicator bar */}
        <div className="risk-bar" style={{ backgroundColor: risk.color }} />

        {/* Header */}
        <div className="dialog-header">
          <div className="operation-badge" style={{ backgroundColor: risk.bgColor }}>
            <span className="operation-icon">{operation.icon}</span>
            <span className="operation-label" style={{ color: risk.color }}>
              {operation.label}
            </span>
          </div>
          <div className="risk-badge" style={{ backgroundColor: risk.bgColor, color: risk.color }}>
            <span>{risk.icon}</span>
            <span>{risk.label}</span>
          </div>
        </div>

        {/* Content */}
        <div className="dialog-content">
          <h2 id="permission-title" className="dialog-title">
            {request.title}
          </h2>
          <p id="permission-description" className="dialog-description">
            {request.description}
          </p>

          {/* Command preview */}
          {request.command && (
            <div className="command-preview">
              <div className="command-label">Command to execute:</div>
              <pre className="command-code">{request.command}</pre>
            </div>
          )}

          {/* Affected files */}
          {request.affectedFiles && request.affectedFiles.length > 0 && (
            <div className="affected-files">
              <div className="files-label">Affected files ({request.affectedFiles.length}):</div>
              <ul className="files-list">
                {request.affectedFiles.slice(0, 5).map((file) => (
                  <li key={file}>{file}</li>
                ))}
                {request.affectedFiles.length > 5 && (
                  <li className="more-files">+{request.affectedFiles.length - 5} more files</li>
                )}
              </ul>
            </div>
          )}

          {/* Additional details */}
          {request.details && request.details.length > 0 && (
            <ul className="details-list">
              {request.details.map((detail, index) => (
                <li key={index}>{detail}</li>
              ))}
            </ul>
          )}
        </div>

        {/* Always allow checkbox */}
        {request.allowAlways && (
          <label className="always-allow">
            <input
              type="checkbox"
              checked={alwaysAllow}
              onChange={(e) => setAlwaysAllow(e.target.checked)}
            />
            <span className="checkbox-custom" />
            <span className="checkbox-label">Always allow this operation for this session</span>
          </label>
        )}

        {/* Actions */}
        <div className="dialog-actions">
          <button className="action-btn deny" onClick={handleDeny}>
            <svg viewBox="0 0 16 16" fill="currentColor">
              <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
            </svg>
            Deny
            <kbd>Esc</kbd>
          </button>
          <button
            className="action-btn allow"
            onClick={handleAllow}
            style={{ backgroundColor: risk.color }}
          >
            <svg viewBox="0 0 16 16" fill="currentColor">
              <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
            </svg>
            Allow
            <kbd>⌘↵</kbd>
          </button>
        </div>
      </div>

      <style jsx>{`
        .permission-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.4);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1100;
          animation: fadeIn 0.2s ease;
        }

        .permission-overlay.closing {
          animation: fadeOut 0.2s ease forwards;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes fadeOut {
          from {
            opacity: 1;
          }
          to {
            opacity: 0;
          }
        }

        .permission-dialog {
          width: 100%;
          max-width: 480px;
          background: var(--cl-bg-primary, #ffffff);
          border-radius: 16px;
          box-shadow:
            0 25px 50px -12px rgba(0, 0, 0, 0.25),
            0 0 0 1px rgba(0, 0, 0, 0.05);
          overflow: hidden;
          animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .permission-dialog.closing {
          animation: slideDown 0.2s ease forwards;
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes slideDown {
          from {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          to {
            opacity: 0;
            transform: translateY(10px) scale(0.98);
          }
        }

        /* Risk bar */
        .risk-bar {
          height: 4px;
          width: 100%;
        }

        /* Header */
        .dialog-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem 1.5rem;
          border-bottom: 1px solid var(--cl-border-primary, #e5e7eb);
        }

        .operation-badge {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.375rem 0.75rem;
          border-radius: 9999px;
        }

        .operation-icon {
          font-size: 1rem;
        }

        .operation-label {
          font-size: 0.8125rem;
          font-weight: 600;
        }

        .risk-badge {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.25rem 0.625rem;
          border-radius: 6px;
          font-size: 0.75rem;
          font-weight: 600;
        }

        /* Content */
        .dialog-content {
          padding: 1.5rem;
        }

        .dialog-title {
          font-size: 1.125rem;
          font-weight: 600;
          color: var(--cl-text-primary, #1a1f36);
          margin: 0 0 0.5rem;
        }

        .dialog-description {
          font-size: 0.9375rem;
          color: var(--cl-text-secondary, #374151);
          margin: 0 0 1rem;
          line-height: 1.6;
        }

        /* Command preview */
        .command-preview {
          margin: 1rem 0;
        }

        .command-label {
          font-size: 0.75rem;
          font-weight: 500;
          color: var(--cl-text-tertiary, #4b5563);
          margin-bottom: 0.375rem;
        }

        .command-code {
          padding: 0.75rem 1rem;
          background: var(--cl-bg-code, #1e1e1e);
          color: #e5e7eb;
          border-radius: 8px;
          font-family: 'SF Mono', 'Fira Code', monospace;
          font-size: 0.8125rem;
          overflow-x: auto;
          margin: 0;
        }

        /* Affected files */
        .affected-files {
          margin: 1rem 0;
        }

        .files-label {
          font-size: 0.75rem;
          font-weight: 500;
          color: var(--cl-text-tertiary, #4b5563);
          margin-bottom: 0.375rem;
        }

        .files-list {
          margin: 0;
          padding-left: 1.25rem;
          font-size: 0.8125rem;
          color: var(--cl-text-secondary, #374151);
        }

        .files-list li {
          padding: 0.125rem 0;
          font-family: 'SF Mono', 'Fira Code', monospace;
        }

        .more-files {
          color: var(--cl-text-tertiary, #4b5563);
          font-style: italic;
        }

        /* Details list */
        .details-list {
          margin: 1rem 0 0;
          padding-left: 1.25rem;
          font-size: 0.875rem;
          color: var(--cl-text-secondary, #374151);
        }

        .details-list li {
          padding: 0.25rem 0;
        }

        /* Always allow checkbox */
        .always-allow {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1.5rem;
          background: var(--cl-bg-secondary, #f9fafb);
          border-top: 1px solid var(--cl-border-primary, #e5e7eb);
          cursor: pointer;
        }

        .always-allow input {
          position: absolute;
          opacity: 0;
          width: 0;
          height: 0;
        }

        .checkbox-custom {
          width: 18px;
          height: 18px;
          border: 2px solid var(--cl-border-secondary, #d1d5db);
          border-radius: 4px;
          transition: all 0.15s;
        }

        .always-allow input:checked + .checkbox-custom {
          background: var(--cl-accent-primary, #1e3a5f);
          border-color: var(--cl-accent-primary, #1e3a5f);
        }

        .always-allow input:checked + .checkbox-custom::after {
          content: '✓';
          display: block;
          text-align: center;
          color: white;
          font-size: 12px;
          line-height: 14px;
        }

        .checkbox-label {
          font-size: 0.8125rem;
          color: var(--cl-text-secondary, #374151);
        }

        /* Actions */
        .dialog-actions {
          display: flex;
          gap: 0.75rem;
          padding: 1rem 1.5rem;
          border-top: 1px solid var(--cl-border-primary, #e5e7eb);
        }

        .action-btn {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          font-size: 0.9375rem;
          font-weight: 600;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .action-btn svg {
          width: 16px;
          height: 16px;
        }

        .action-btn kbd {
          padding: 0.125rem 0.375rem;
          font-size: 0.6875rem;
          font-family: inherit;
          background: rgba(0, 0, 0, 0.1);
          border-radius: 4px;
          margin-left: 0.25rem;
        }

        .action-btn.deny {
          background: var(--cl-bg-secondary, #f9fafb);
          color: var(--cl-text-secondary, #374151);
          border: 1px solid var(--cl-border-secondary, #d1d5db);
        }

        .action-btn.deny:hover {
          background: var(--cl-bg-tertiary, #f3f4f6);
          border-color: var(--cl-text-tertiary, #4b5563);
        }

        .action-btn.deny kbd {
          background: rgba(0, 0, 0, 0.05);
        }

        .action-btn.allow {
          color: white;
          border: none;
        }

        .action-btn.allow:hover {
          filter: brightness(1.1);
        }

        .action-btn.allow kbd {
          background: rgba(255, 255, 255, 0.2);
        }

        /* Mobile */
        @media (max-width: 540px) {
          .permission-dialog {
            margin: 1rem;
            max-width: calc(100% - 2rem);
          }
        }
      `}</style>
    </div>
  );
}

// ============================================
// PERMISSION MANAGER HOOK
// ============================================

export interface PermissionPreferences {
  [key: string]: 'allow' | 'deny';
}

/**
 * Hook to manage permission requests and user preferences
 */
export function usePermissionManager() {
  const [pendingRequest, setPendingRequest] = useState<PermissionRequest | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [preferences, setPreferences] = useState<PermissionPreferences>({});
  const resolverRef = useRef<((approved: boolean) => void) | null>(null);

  // Check if operation type is auto-allowed
  const isAutoAllowed = useCallback(
    (type: OperationType): boolean => {
      const key = `perm_${type}`;
      return preferences[key] === 'allow';
    },
    [preferences]
  );

  // Request permission for an operation
  const requestPermission = useCallback(
    async (request: Omit<PermissionRequest, 'id'>): Promise<boolean> => {
      const fullRequest: PermissionRequest = {
        ...request,
        id: `perm_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      };

      // Check if already allowed
      if (isAutoAllowed(request.type)) {
        return true;
      }

      // Show dialog and wait for response
      return new Promise((resolve) => {
        resolverRef.current = resolve;
        setPendingRequest(fullRequest);
        setIsDialogOpen(true);
      });
    },
    [isAutoAllowed]
  );

  // Handle allow
  const handleAllow = useCallback(
    (alwaysAllow?: boolean) => {
      if (resolverRef.current) {
        resolverRef.current(true);
        resolverRef.current = null;
      }

      if (alwaysAllow && pendingRequest) {
        setPreferences((prev) => ({
          ...prev,
          [`perm_${pendingRequest.type}`]: 'allow',
        }));
      }

      setIsDialogOpen(false);
      setPendingRequest(null);
    },
    [pendingRequest]
  );

  // Handle deny
  const handleDeny = useCallback(() => {
    if (resolverRef.current) {
      resolverRef.current(false);
      resolverRef.current = null;
    }
    setIsDialogOpen(false);
    setPendingRequest(null);
  }, []);

  // Reset all preferences
  const resetPreferences = useCallback(() => {
    setPreferences({});
  }, []);

  return {
    pendingRequest,
    isDialogOpen,
    requestPermission,
    handleAllow,
    handleDeny,
    preferences,
    resetPreferences,
  };
}

// Export types for external use
export type { PermissionRequest, RiskLevel, OperationType };

export default CodeLabPermissionDialog;
