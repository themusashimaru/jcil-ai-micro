'use client';

/**
 * GLOBAL ERROR HANDLER
 *
 * Catches unhandled promise rejections and uncaught errors that
 * slip through React error boundaries. Reports to Sentry if
 * configured, and logs structured errors for debugging.
 */

import { useEffect } from 'react';

export function GlobalErrorHandler() {
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('[GlobalErrorHandler] Unhandled promise rejection:', event.reason);

      // Report to Sentry if available
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sentry = (window as any).Sentry;
        if (sentry && typeof sentry.captureException === 'function') {
          sentry.captureException(event.reason);
        }
      } catch {
        // Sentry not available — already logged above
      }
    };

    const handleError = (event: ErrorEvent) => {
      // Only catch errors that didn't originate from React (those are handled by error boundaries)
      if (event.error && !event.error._reactHandled) {
        console.error('[GlobalErrorHandler] Uncaught error:', event.error);
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError);
    };
  }, []);

  return null;
}
