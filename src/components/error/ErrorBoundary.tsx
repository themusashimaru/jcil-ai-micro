'use client';

/**
 * ERROR BOUNDARY COMPONENT
 *
 * Provides graceful error handling for React component trees.
 * Prevents entire app crashes and shows user-friendly error messages.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error to monitoring service
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);

    // Call optional error handler
    this.props.onError?.(error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="error-boundary">
          <div className="error-content">
            <h2>Something went wrong</h2>
            <p>We encountered an unexpected error. Please try refreshing the page.</p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="retry-button"
            >
              Try Again
            </button>
          </div>
          <style jsx>{`
            .error-boundary {
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 200px;
              padding: 2rem;
              background: #fef2f2;
              border-radius: 8px;
              margin: 1rem;
            }
            .error-content {
              text-align: center;
            }
            .error-content h2 {
              color: #991b1b;
              font-size: 1.25rem;
              font-weight: 600;
              margin: 0 0 0.5rem;
            }
            .error-content p {
              color: #7f1d1d;
              font-size: 0.875rem;
              margin: 0 0 1rem;
            }
            .retry-button {
              padding: 0.5rem 1rem;
              background: #dc2626;
              color: white;
              border: none;
              border-radius: 6px;
              font-size: 0.875rem;
              font-weight: 500;
              cursor: pointer;
              transition: background 0.2s;
            }
            .retry-button:hover {
              background: #b91c1c;
            }
          `}</style>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Async error boundary for Suspense-compatible error handling
 */
export function ErrorFallback({
  error,
  resetErrorBoundary,
}: {
  error: Error;
  resetErrorBoundary: () => void;
}) {
  return (
    <div className="error-fallback">
      <h2>Something went wrong</h2>
      <pre>{error.message}</pre>
      <button onClick={resetErrorBoundary}>Try Again</button>
      <style jsx>{`
        .error-fallback {
          padding: 2rem;
          background: #fef2f2;
          border-radius: 8px;
          text-align: center;
        }
        h2 {
          color: #991b1b;
          font-size: 1.25rem;
        }
        pre {
          background: #fee2e2;
          padding: 1rem;
          border-radius: 4px;
          color: #7f1d1d;
          font-size: 0.75rem;
          overflow-x: auto;
        }
        button {
          margin-top: 1rem;
          padding: 0.5rem 1rem;
          background: #dc2626;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
