'use client';

/**
 * ERROR BOUNDARY COMPONENTS - LOW-006 FIX
 *
 * Enhanced error boundaries with:
 * - Retry functionality
 * - Integration with user-friendly error messages
 * - Async-compatible reset mechanisms
 * - Accessibility improvements
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { OPERATION_MESSAGES } from '@/lib/errors/user-messages';

// ============================================================================
// TYPES
// ============================================================================

interface Props {
  children: ReactNode;
  /** Custom fallback UI */
  fallback?: ReactNode | ((props: { error: Error; reset: () => void }) => ReactNode);
  /** Called when an error occurs */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Optional component name for debugging */
  componentName?: string;
  /** Show retry button (default: true) */
  showRetry?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
}

// ============================================================================
// ERROR BOUNDARY COMPONENT
// ============================================================================

/**
 * Error Boundary Component
 *
 * Catches JavaScript errors in child component tree and displays a fallback UI.
 * Prevents the entire app from crashing due to a single component error.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const componentName = this.props.componentName || 'Component';
    console.error(`[ErrorBoundary:${componentName}] Caught error:`, error);
    console.error(`[ErrorBoundary:${componentName}] Component stack:`, errorInfo.componentStack);

    // Call optional error handler
    this.props.onError?.(error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null, retryCount: this.state.retryCount + 1 });
  };

  render(): ReactNode {
    const { hasError, error, retryCount } = this.state;
    const { showRetry = true } = this.props;
    const maxRetries = 3;

    if (hasError && error) {
      // Return custom fallback (function or element)
      if (this.props.fallback) {
        if (typeof this.props.fallback === 'function') {
          return this.props.fallback({ error, reset: this.handleReset });
        }
        return this.props.fallback;
      }

      const canRetry = showRetry && retryCount < maxRetries;

      return (
        <div
          className="p-4 rounded-lg bg-red-500/10 border border-red-500/20"
          role="alert"
          aria-live="assertive"
        >
          <p className="text-sm text-red-400 mb-2">{OPERATION_MESSAGES.loadFailed.message}</p>
          <p className="text-xs text-red-400/70 mb-3">{OPERATION_MESSAGES.loadFailed.suggestion}</p>
          {canRetry && (
            <button
              onClick={this.handleReset}
              className="px-3 py-1.5 text-xs bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded transition-colors"
              aria-label="Retry loading content"
            >
              {OPERATION_MESSAGES.loadFailed.action}
              {retryCount > 0 && ` (${retryCount}/${maxRetries})`}
            </button>
          )}
          {!canRetry && retryCount >= maxRetries && (
            <p className="text-xs text-red-400/50">
              Maximum retries reached. Please refresh the page.
            </p>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

// ============================================================================
// MESSAGE ERROR BOUNDARY
// ============================================================================

/**
 * Message-specific error boundary with inline fallback
 * Designed for individual chat messages
 */
export class MessageErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[MessageErrorBoundary] Error rendering message:', error.message);
    this.props.onError?.(error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null, retryCount: this.state.retryCount + 1 });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        if (typeof this.props.fallback === 'function') {
          return this.props.fallback({ error: this.state.error!, reset: this.handleReset });
        }
        return this.props.fallback;
      }

      return (
        <div
          className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm flex items-center justify-between gap-2"
          role="alert"
        >
          <span className="opacity-70">Unable to display this message</span>
          {this.state.retryCount < 2 && (
            <button
              onClick={this.handleReset}
              className="text-xs px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 rounded transition-colors"
              aria-label="Retry displaying message"
            >
              Retry
            </button>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

// ============================================================================
// ASYNC ERROR BOUNDARY WRAPPER
// ============================================================================

interface AsyncBoundaryProps extends Props {
  /** Loading fallback for suspense */
  loadingFallback?: ReactNode;
}

/**
 * Async-compatible error boundary for use with Suspense
 */
export class AsyncErrorBoundary extends Component<AsyncBoundaryProps, State> {
  constructor(props: AsyncBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[AsyncErrorBoundary] Caught async error:', error);
    this.props.onError?.(error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null, retryCount: this.state.retryCount + 1 });
  };

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        if (typeof this.props.fallback === 'function') {
          return this.props.fallback({ error: this.state.error, reset: this.handleReset });
        }
        return this.props.fallback;
      }

      return (
        <div
          className="p-4 rounded-lg bg-red-500/10 border border-red-500/20"
          role="alert"
          aria-live="polite"
        >
          <p className="text-sm text-red-400 mb-2">Failed to load content</p>
          <button
            onClick={this.handleReset}
            className="px-3 py-1.5 text-xs bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded transition-colors"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
