'use client';

/**
 * TOAST NOTIFICATION SYSTEM
 *
 * Professional toast notifications for:
 * - Error messages
 * - Success confirmations
 * - Warning alerts
 * - Information notices
 *
 * Features:
 * - Auto-dismiss with configurable duration
 * - Manual dismiss with close button
 * - Stacking support for multiple toasts
 * - Accessible (ARIA live regions)
 * - Animations for enter/exit
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  dismissible?: boolean;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  clearAll: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

// Convenience methods
export function useToastActions() {
  const { addToast, removeToast, clearAll } = useToast();

  return {
    success: (title: string, message?: string) =>
      addToast({ type: 'success', title, message, duration: 4000 }),
    error: (title: string, message?: string) =>
      addToast({ type: 'error', title, message, duration: 6000, dismissible: true }),
    warning: (title: string, message?: string) =>
      addToast({ type: 'warning', title, message, duration: 5000 }),
    info: (title: string, message?: string) =>
      addToast({ type: 'info', title, message, duration: 4000 }),
    dismiss: removeToast,
    clearAll,
  };
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newToast: Toast = {
      ...toast,
      id,
      duration: toast.duration ?? 4000,
      dismissible: toast.dismissible ?? true,
    };

    setToasts((prev) => [...prev, newToast]);
    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setToasts([]);
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, clearAll }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  );
}

function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-container" role="region" aria-label="Notifications" aria-live="polite">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}

      <style jsx>{`
        .toast-container {
          position: fixed;
          bottom: 1.5rem;
          right: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          z-index: 9999;
          max-width: 420px;
          width: calc(100vw - 3rem);
          pointer-events: none;
        }

        @media (max-width: 640px) {
          .toast-container {
            bottom: 1rem;
            right: 1rem;
            left: 1rem;
            width: auto;
            max-width: none;
          }
        }
      `}</style>
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const [isExiting, setIsExiting] = useState(false);

  // Define handleDismiss before useEffect to satisfy dependency rules
  const handleDismiss = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      onDismiss(toast.id);
    }, 200); // Match animation duration
  }, [onDismiss, toast.id]);

  // Auto-dismiss
  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const timer = setTimeout(() => {
        handleDismiss();
      }, toast.duration);

      return () => clearTimeout(timer);
    }
  }, [toast.duration, toast.id, handleDismiss]);

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'error':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path strokeLinecap="round" d="M12 8v4m0 4h.01" />
          </svg>
        );
      case 'warning':
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        );
      case 'info':
      default:
        return (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path strokeLinecap="round" d="M12 16v-4m0-4h.01" />
          </svg>
        );
    }
  };

  return (
    <div
      className={`toast toast-${toast.type} ${isExiting ? 'exiting' : ''}`}
      role="alert"
      aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
    >
      <div className="toast-icon" aria-hidden="true">
        {getIcon()}
      </div>
      <div className="toast-content">
        <div className="toast-title">{toast.title}</div>
        {toast.message && <div className="toast-message">{toast.message}</div>}
      </div>
      {toast.dismissible && (
        <button className="toast-close" onClick={handleDismiss} aria-label="Dismiss notification">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      <style jsx>{`
        .toast {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          padding: 1rem;
          background: white;
          border-radius: 12px;
          box-shadow:
            0 4px 12px rgba(0, 0, 0, 0.1),
            0 1px 3px rgba(0, 0, 0, 0.08);
          border-left: 4px solid;
          pointer-events: auto;
          animation: toast-enter 0.2s ease-out;
        }

        .toast.exiting {
          animation: toast-exit 0.2s ease-in forwards;
        }

        @keyframes toast-enter {
          from {
            opacity: 0;
            transform: translateX(100%);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes toast-exit {
          from {
            opacity: 1;
            transform: translateX(0);
          }
          to {
            opacity: 0;
            transform: translateX(100%);
          }
        }

        .toast-success {
          border-left-color: #16a34a;
        }

        .toast-error {
          border-left-color: #dc2626;
        }

        .toast-warning {
          border-left-color: #f59e0b;
        }

        .toast-info {
          border-left-color: #3b82f6;
        }

        .toast-icon {
          flex-shrink: 0;
          width: 24px;
          height: 24px;
        }

        .toast-success .toast-icon {
          color: #16a34a;
        }

        .toast-error .toast-icon {
          color: #dc2626;
        }

        .toast-warning .toast-icon {
          color: #f59e0b;
        }

        .toast-info .toast-icon {
          color: #3b82f6;
        }

        .toast-icon svg {
          width: 100%;
          height: 100%;
        }

        .toast-content {
          flex: 1;
          min-width: 0;
        }

        .toast-title {
          font-size: 0.9375rem;
          font-weight: 600;
          color: #1a1f36;
          line-height: 1.4;
        }

        .toast-message {
          margin-top: 0.25rem;
          font-size: 0.875rem;
          color: #4b5563;
          line-height: 1.5;
        }

        .toast-close {
          flex-shrink: 0;
          width: 20px;
          height: 20px;
          background: none;
          border: none;
          padding: 0;
          cursor: pointer;
          color: #9ca3af;
          border-radius: 4px;
          transition: all 0.15s;
        }

        .toast-close:hover {
          color: #4b5563;
          background: #f3f4f6;
        }

        .toast-close svg {
          width: 100%;
          height: 100%;
        }

        /* Dark mode */
        @media (prefers-color-scheme: dark) {
          .toast {
            background: #1f2937;
            box-shadow:
              0 4px 12px rgba(0, 0, 0, 0.3),
              0 1px 3px rgba(0, 0, 0, 0.2);
          }

          .toast-title {
            color: #f9fafb;
          }

          .toast-message {
            color: #9ca3af;
          }

          .toast-close {
            color: #6b7280;
          }

          .toast-close:hover {
            color: #9ca3af;
            background: #374151;
          }
        }
      `}</style>
    </div>
  );
}

export default ToastProvider;
