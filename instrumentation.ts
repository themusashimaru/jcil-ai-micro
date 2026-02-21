/**
 * Next.js Instrumentation
 * Initializes monitoring tools and validates environment at startup.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Validate environment variables at startup (AUTH-003)
    const { validateEnvironment } = await import('./src/lib/env-validation');
    validateEnvironment();

    await import('./sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}
