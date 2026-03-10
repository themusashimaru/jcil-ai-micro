'use client';

/**
 * CODE LAB ERROR BOUNDARY
 *
 * Provides graceful error handling specifically for the CodeLab component.
 * Shows a recovery UI with options to reload or start a new session.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Plus } from 'lucide-react';

interface Props {
  children: ReactNode;
  onReset?: () => void;
  onNewSession?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class CodeLabErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[CodeLab] Error caught by boundary:', error, errorInfo);
    this.setState({ errorInfo });

    // TODO: Send to error tracking service (Sentry, etc.)
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    this.props.onReset?.();
  };

  handleNewSession = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    this.props.onNewSession?.();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-[400px] bg-gray-900 rounded-lg m-4">
          <div className="text-center p-8 max-w-md">
            <div className="flex justify-center mb-4">
              <AlertTriangle className="w-12 h-12 text-red-500" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">
              Code Lab encountered an error
            </h2>
            <p className="text-gray-400 mb-6">
              Something went wrong while running Code Lab. This could be due to a network issue,
              an invalid operation, or an unexpected state.
            </p>

            {/* Show error details in development */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mb-6 text-left">
                <summary className="text-gray-500 cursor-pointer hover:text-gray-400 text-sm">
                  Error details (dev only)
                </summary>
                <pre className="mt-2 p-3 bg-gray-800 rounded text-red-400 text-xs overflow-auto max-h-32">
                  {this.state.error.message}
                  {this.state.errorInfo?.componentStack && (
                    <>
                      {'\n\nComponent Stack:'}
                      {this.state.errorInfo.componentStack}
                    </>
                  )}
                </pre>
              </details>
            )}

            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleRetry}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </button>
              <button
                onClick={this.handleNewSession}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                New Session
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default CodeLabErrorBoundary;
