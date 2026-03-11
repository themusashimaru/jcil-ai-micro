'use client';

/**
 * ERROR BOUNDARY COMPONENT
 *
 * Provides graceful error handling for React component trees.
 * Uses dark theme colors for consistency.
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
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

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
              background: rgba(239, 68, 68, 0.05);
              border: 1px solid rgba(239, 68, 68, 0.2);
              border-radius: 8px;
              margin: 1rem;
            }
            .error-content {
              text-align: center;
            }
            .error-content h2 {
              color: #fca5a5;
              font-size: 1.25rem;
              font-weight: 600;
              margin: 0 0 0.5rem;
            }
            .error-content p {
              color: #a1a1aa;
              font-size: 0.875rem;
              margin: 0 0 1rem;
            }
            .retry-button {
              padding: 0.5rem 1rem;
              background: #f97316;
              color: white;
              border: none;
              border-radius: 6px;
              font-size: 0.875rem;
              font-weight: 500;
              cursor: pointer;
              transition: opacity 0.2s;
            }
            .retry-button:hover {
              opacity: 0.9;
            }
            .retry-button:focus-visible {
              outline: 2px solid #f97316;
              outline-offset: 2px;
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
          background: rgba(239, 68, 68, 0.05);
          border: 1px solid rgba(239, 68, 68, 0.2);
          border-radius: 8px;
          text-align: center;
        }
        h2 {
          color: #fca5a5;
          font-size: 1.25rem;
        }
        pre {
          background: rgba(239, 68, 68, 0.1);
          padding: 1rem;
          border-radius: 4px;
          color: #fca5a5;
          font-size: 0.75rem;
          overflow-x: auto;
        }
        button {
          margin-top: 1rem;
          padding: 0.5rem 1rem;
          background: #f97316;
          color: white;
          border: none;
          border-radius: 6px;
          cursor: pointer;
        }
        button:hover {
          opacity: 0.9;
        }
        button:focus-visible {
          outline: 2px solid #f97316;
          outline-offset: 2px;
        }
      `}</style>
    </div>
  );
}
