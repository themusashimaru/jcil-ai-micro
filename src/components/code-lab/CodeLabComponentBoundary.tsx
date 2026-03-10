'use client';

/**
 * CODE LAB COMPONENT BOUNDARY
 *
 * HIGH-005: Lightweight error boundary for CodeLab sub-components
 *
 * Features:
 * - Isolates errors to individual panels
 * - Provides minimal recovery UI
 * - Prevents cascade failures
 * - Auto-retry capability
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';

// ============================================================================
// TYPES
// ============================================================================

interface Props {
  /** Component children to render */
  children: ReactNode;
  /** Name of the component for error messages */
  componentName: string;
  /** Custom fallback UI (optional) */
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
  /** Called when an error occurs */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Show retry button (default: true) */
  showRetry?: boolean;
  /** Compact mode for smaller components */
  compact?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_RETRY_COUNT = 3;

// ============================================================================
// COMPONENT
// ============================================================================

export class CodeLabComponentBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(`[CodeLab:${this.props.componentName}] Error:`, error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState((prev) => ({
      hasError: false,
      error: null,
      retryCount: prev.retryCount + 1,
    }));
  };

  render(): ReactNode {
    const { hasError, error, retryCount } = this.state;
    const { children, componentName, fallback, showRetry = true, compact = false } = this.props;

    if (hasError && error) {
      // Custom fallback
      if (fallback) {
        if (typeof fallback === 'function') {
          return fallback(error, this.handleRetry);
        }
        return fallback;
      }

      // Default fallback UI
      const canRetry = showRetry && retryCount < MAX_RETRY_COUNT;

      if (compact) {
        return (
          <div className="component-error-compact">
            <span className="error-icon">⚠️</span>
            <span className="error-text">{componentName} error</span>
            {canRetry && (
              <button onClick={this.handleRetry} className="retry-btn-compact">
                Retry
              </button>
            )}
            <style jsx>{`
              .component-error-compact {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                padding: 0.5rem 0.75rem;
                background: rgba(239, 68, 68, 0.1);
                border: 1px solid rgba(239, 68, 68, 0.3);
                border-radius: 6px;
                font-size: 0.75rem;
                color: #ef4444;
              }
              .error-icon {
                font-size: 0.875rem;
              }
              .error-text {
                flex: 1;
              }
              .retry-btn-compact {
                padding: 0.25rem 0.5rem;
                background: rgba(239, 68, 68, 0.2);
                border: none;
                border-radius: 4px;
                font-size: 0.75rem;
                color: #ef4444;
                cursor: pointer;
                transition: background 0.2s;
              }
              .retry-btn-compact:hover {
                background: rgba(239, 68, 68, 0.3);
              }
            `}</style>
          </div>
        );
      }

      return (
        <div className="component-error">
          <div className="error-content">
            <div className="error-icon">⚠️</div>
            <h3>{componentName} encountered an error</h3>
            {process.env.NODE_ENV === 'development' && (
              <p className="error-message">{error.message}</p>
            )}
            {canRetry && (
              <button onClick={this.handleRetry} className="retry-btn">
                Try Again {retryCount > 0 && `(${retryCount}/${MAX_RETRY_COUNT})`}
              </button>
            )}
            {!canRetry && retryCount >= MAX_RETRY_COUNT && (
              <p className="retry-exhausted">Max retries reached. Please reload the page.</p>
            )}
          </div>
          <style jsx>{`
            .component-error {
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 200px;
              padding: 1.5rem;
              background: rgba(239, 68, 68, 0.05);
              border: 1px solid rgba(239, 68, 68, 0.2);
              border-radius: 8px;
            }
            .error-content {
              text-align: center;
              max-width: 300px;
            }
            .error-icon {
              font-size: 2rem;
              margin-bottom: 0.75rem;
            }
            h3 {
              margin: 0 0 0.5rem;
              font-size: 0.9375rem;
              font-weight: 600;
              color: #ef4444;
            }
            .error-message {
              margin: 0 0 1rem;
              font-size: 0.8125rem;
              color: #888;
              word-break: break-word;
            }
            .retry-btn {
              padding: 0.5rem 1rem;
              background: #ef4444;
              border: none;
              border-radius: 6px;
              font-size: 0.8125rem;
              font-weight: 500;
              color: white;
              cursor: pointer;
              transition: all 0.2s;
            }
            .retry-btn:hover {
              background: #dc2626;
              transform: translateY(-1px);
            }
            .retry-exhausted {
              margin: 0;
              font-size: 0.8125rem;
              color: #888;
            }
          `}</style>
        </div>
      );
    }

    return children;
  }
}

// ============================================================================
// HIGHER-ORDER COMPONENT
// ============================================================================

/**
 * HOC to wrap a component with error boundary
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  componentName: string,
  options: Omit<Props, 'children' | 'componentName'> = {}
): React.ComponentType<P> {
  const WrappedComponent = (props: P) => (
    <CodeLabComponentBoundary componentName={componentName} {...options}>
      <Component {...props} />
    </CodeLabComponentBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${componentName})`;
  return WrappedComponent;
}

export default CodeLabComponentBoundary;
