'use client';

/**
 * CODE LAB PERMISSION DIALOG
 *
 * Confirms dangerous operations before execution.
 * Matches Claude Code's permission model.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import './code-lab-permission-dialog.css';

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

const riskConfig: Record<
  RiskLevel,
  { color: string; bgColor: string; icon: string; label: string }
> = {
  low: {
    color: 'var(--cl-success)',
    bgColor: 'color-mix(in srgb, var(--cl-success) 10%, transparent)',
    icon: '\u2713',
    label: 'Low Risk',
  },
  medium: {
    color: 'var(--cl-warning)',
    bgColor: 'color-mix(in srgb, var(--cl-warning) 10%, transparent)',
    icon: '\u26A0',
    label: 'Medium Risk',
  },
  high: {
    color: 'var(--cl-error)',
    bgColor: 'color-mix(in srgb, var(--cl-error) 10%, transparent)',
    icon: '\u26A0',
    label: 'High Risk',
  },
  critical: {
    color: 'var(--cl-critical)',
    bgColor: 'color-mix(in srgb, var(--cl-critical) 15%, transparent)',
    icon: '\uD83D\uDED1',
    label: 'Critical',
  },
};

const operationConfig: Record<OperationType, { icon: string; label: string }> = {
  file_overwrite: { icon: '\uD83D\uDCDD', label: 'File Overwrite' },
  file_delete: { icon: '\uD83D\uDDD1\uFE0F', label: 'File Deletion' },
  git_push: { icon: '\uD83D\uDE80', label: 'Git Push' },
  git_force_push: { icon: '\u26A0\uFE0F', label: 'Force Push' },
  shell_command: { icon: '\uD83D\uDCBB', label: 'Shell Command' },
  deploy: { icon: '\uD83C\uDF10', label: 'Deployment' },
  env_change: { icon: '\u2699\uFE0F', label: 'Environment Change' },
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
  void dialogRef;

  const handleDeny = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      onDeny();
      setIsClosing(false);
    }, 200);
  }, [onDeny]);

  const handleAllow = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      onAllow(alwaysAllow);
      setIsClosing(false);
    }, 200);
  }, [onAllow, alwaysAllow]);

  const { containerRef } = useFocusTrap({
    enabled: isOpen,
    onEscape: handleDeny,
    restoreFocus: true,
  });

  useEffect(() => {
    if (isOpen) {
      setAlwaysAllow(false);
      setIsClosing(false);
    }
  }, [isOpen]);

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
        <div className="risk-bar" style={{ backgroundColor: risk.color }} />

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

        <div className="dialog-content">
          <h2 id="permission-title" className="dialog-title">
            {request.title}
          </h2>
          <p id="permission-description" className="dialog-description">
            {request.description}
          </p>

          {request.command && (
            <div className="command-preview">
              <div className="command-label">Command to execute:</div>
              <pre className="command-code">{request.command}</pre>
            </div>
          )}

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

          {request.details && request.details.length > 0 && (
            <ul className="details-list">
              {request.details.map((detail, index) => (
                <li key={index}>{detail}</li>
              ))}
            </ul>
          )}
        </div>

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
            <kbd>{'\u2318\u21B5'}</kbd>
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// PERMISSION MANAGER HOOK
// ============================================

export interface PermissionPreferences {
  [key: string]: 'allow' | 'deny';
}

export function usePermissionManager() {
  const [pendingRequest, setPendingRequest] = useState<PermissionRequest | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [preferences, setPreferences] = useState<PermissionPreferences>({});
  const resolverRef = useRef<((approved: boolean) => void) | null>(null);

  const isAutoAllowed = useCallback(
    (type: OperationType): boolean => {
      const key = `perm_${type}`;
      return preferences[key] === 'allow';
    },
    [preferences]
  );

  const requestPermission = useCallback(
    async (request: Omit<PermissionRequest, 'id'>): Promise<boolean> => {
      const fullRequest: PermissionRequest = {
        ...request,
        id: `perm_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      };

      if (isAutoAllowed(request.type)) {
        return true;
      }

      return new Promise((resolve) => {
        resolverRef.current = resolve;
        setPendingRequest(fullRequest);
        setIsDialogOpen(true);
      });
    },
    [isAutoAllowed]
  );

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

  const handleDeny = useCallback(() => {
    if (resolverRef.current) {
      resolverRef.current(false);
      resolverRef.current = null;
    }
    setIsDialogOpen(false);
    setPendingRequest(null);
  }, []);

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

export type { PermissionRequest, RiskLevel, OperationType };
export default CodeLabPermissionDialog;
