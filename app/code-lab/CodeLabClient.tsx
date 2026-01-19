'use client';

/**
 * CODE LAB CLIENT
 *
 * Client-side wrapper for the Code Lab component.
 * Receives userId from server-side auth.
 * Provides toast notification context for error handling.
 * Wrapped in ErrorBoundary to prevent full app crashes.
 */

import { CodeLab } from '@/components/code-lab';
import { ToastProvider } from '@/components/ui/Toast';
import { ErrorBoundary } from '@/components/error/ErrorBoundary';

interface CodeLabClientProps {
  userId: string;
}

/**
 * Code Lab-specific error fallback with recovery options
 */
function CodeLabErrorFallback() {
  return (
    <div className="code-lab-error">
      <div className="error-content">
        <div className="error-icon">⚠️</div>
        <h2>Code Lab encountered an error</h2>
        <p>Something went wrong. Your work has been auto-saved.</p>
        <div className="error-actions">
          <button onClick={() => window.location.reload()} className="retry-btn primary">
            Reload Code Lab
          </button>
          <button onClick={() => (window.location.href = '/chat')} className="retry-btn secondary">
            Go to Chat
          </button>
        </div>
      </div>
      <style jsx>{`
        .code-lab-error {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
          padding: 2rem;
        }
        .error-content {
          background: white;
          border-radius: 16px;
          padding: 3rem;
          text-align: center;
          max-width: 480px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        }
        .error-icon {
          font-size: 4rem;
          margin-bottom: 1.5rem;
        }
        .error-content h2 {
          color: #1f2937;
          font-size: 1.5rem;
          font-weight: 700;
          margin: 0 0 0.75rem;
        }
        .error-content p {
          color: #6b7280;
          font-size: 1rem;
          margin: 0 0 2rem;
          line-height: 1.6;
        }
        .error-actions {
          display: flex;
          gap: 1rem;
          justify-content: center;
          flex-wrap: wrap;
        }
        .retry-btn {
          padding: 0.875rem 1.5rem;
          border: none;
          border-radius: 10px;
          font-size: 0.9375rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          min-width: 160px;
        }
        .retry-btn.primary {
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          color: white;
        }
        .retry-btn.primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 20px -5px rgba(99, 102, 241, 0.4);
        }
        .retry-btn.secondary {
          background: #f3f4f6;
          color: #374151;
        }
        .retry-btn.secondary:hover {
          background: #e5e7eb;
        }
      `}</style>
    </div>
  );
}

export function CodeLabClient({ userId }: CodeLabClientProps) {
  return (
    <ErrorBoundary
      fallback={<CodeLabErrorFallback />}
      onError={(error, errorInfo) => {
        // Log to monitoring (Sentry, etc.)
        console.error('[CodeLab Error]', error, errorInfo);
        // Could also send to error tracking service here
      }}
    >
      <ToastProvider>
        <CodeLab userId={userId} />
      </ToastProvider>
    </ErrorBoundary>
  );
}
