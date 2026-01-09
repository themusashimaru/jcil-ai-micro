/**
 * Sentry Edge Configuration
 * This file configures Sentry for edge runtime (middleware)
 */

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance Monitoring - lower for edge due to volume
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.05 : 0.5,

  // Environment
  environment: process.env.NODE_ENV,

  // Only enable when DSN is set
  enabled: !!(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN),
});
