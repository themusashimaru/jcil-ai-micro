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
import { CodeLabThemeProvider } from '@/components/code-lab/CodeLabThemeProvider';

interface CodeLabClientProps {
  userId: string;
}

/**
 * Code Lab-specific error fallback with recovery options
 */
function CodeLabErrorFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-8">
      <div className="border border-border/40 bg-card/50 p-8 max-w-md text-center">
        <div className="text-4xl mb-6">&#x26A0;&#xFE0F;</div>
        <h2 className="font-bebas text-2xl tracking-tight text-foreground mb-2">CODE LAB ERROR</h2>
        <p className="font-mono text-xs text-muted-foreground mb-6 leading-relaxed">
          Something went wrong. Your work has been auto-saved.
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <button
            onClick={() => window.location.reload()}
            className="border border-accent bg-accent/10 px-6 py-3 font-mono text-xs uppercase tracking-widest text-accent hover:bg-accent/20 transition-all"
          >
            Reload Code Lab
          </button>
          <button
            onClick={() => (window.location.href = '/chat')}
            className="border border-border/40 px-6 py-3 font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-all"
          >
            Go to Chat
          </button>
        </div>
      </div>
    </div>
  );
}

export function CodeLabClient({ userId }: CodeLabClientProps) {
  return (
    <CodeLabThemeProvider>
      <ErrorBoundary
        fallback={<CodeLabErrorFallback />}
        onError={(error, errorInfo) => {
          console.error('[CodeLab Error]', error, errorInfo);
        }}
      >
        <ToastProvider>
          <CodeLab userId={userId} />
        </ToastProvider>
      </ErrorBoundary>
    </CodeLabThemeProvider>
  );
}
