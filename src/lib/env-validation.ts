/**
 * ENVIRONMENT VARIABLE VALIDATION
 *
 * Validates required and recommended environment variables at startup.
 * Logs warnings for missing optional variables and errors for required ones.
 * Called from instrumentation.ts register() function.
 */

interface EnvVar {
  name: string;
  /** Alternative names (e.g. ANTHROPIC_API_KEY_1 as alternative to ANTHROPIC_API_KEY) */
  alternatives?: string[];
  /** Description shown in warning messages */
  description: string;
}

/** Required: App will not function correctly without these */
const REQUIRED_VARS: EnvVar[] = [
  { name: 'NEXT_PUBLIC_SUPABASE_URL', description: 'Supabase project URL' },
  { name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', description: 'Supabase anonymous key' },
  { name: 'SUPABASE_SERVICE_ROLE_KEY', description: 'Supabase service role key' },
  {
    name: 'ANTHROPIC_API_KEY',
    alternatives: ['ANTHROPIC_API_KEY_1'],
    description: 'Anthropic API key for Claude',
  },
];

/** Recommended: App works but with degraded functionality */
const RECOMMENDED_VARS: EnvVar[] = [
  { name: 'NEXT_PUBLIC_APP_URL', description: 'App URL for CSRF validation' },
  { name: 'ENCRYPTION_KEY', description: 'Token encryption (GitHub, BYOK)' },
  { name: 'CRON_SECRET', description: 'Cron job authentication' },
  {
    name: 'UPSTASH_REDIS_REST_URL',
    description: 'Redis for rate limiting (falls back to in-memory)',
  },
  { name: 'E2B_API_KEY', description: 'E2B sandbox for code execution and browser tools' },
  { name: 'STRIPE_SECRET_KEY', description: 'Stripe payments (subscriptions, billing)' },
  { name: 'STRIPE_WEBHOOK_SECRET', description: 'Stripe webhook signature verification' },
  { name: 'COMPOSIO_API_KEY', description: 'Composio connector integrations (150+ apps)' },
  {
    name: 'PERPLEXITY_API_KEY',
    alternatives: ['PERPLEXITY_API_KEY_1'],
    description: 'Perplexity for web search provider',
  },
];

function isSet(name: string): boolean {
  const val = process.env[name];
  return !!val && val !== '' && !val.startsWith('your_');
}

function anySet(names: string[]): boolean {
  return names.some(isSet);
}

/**
 * Validate environment variables and log results.
 * Called once at application startup via instrumentation.ts.
 *
 * In production: throws an error if required vars are missing (fail fast).
 * In development/CI: logs warnings but does not block startup.
 * Set SKIP_ENV_VALIDATION=true to bypass validation entirely (CI builds).
 */
export function validateEnvironment(): void {
  // Allow CI and build environments to skip validation
  if (process.env.SKIP_ENV_VALIDATION === 'true') {
    console.log('[ENV] Validation skipped (SKIP_ENV_VALIDATION=true)');
    return;
  }

  const missing: string[] = [];
  const warnings: string[] = [];

  // Check required variables
  for (const v of REQUIRED_VARS) {
    const allNames = [v.name, ...(v.alternatives || [])];
    if (!anySet(allNames)) {
      missing.push(`  - ${v.name}: ${v.description}`);
    }
  }

  // Check recommended variables
  for (const v of RECOMMENDED_VARS) {
    const allNames = [v.name, ...(v.alternatives || [])];
    if (!anySet(allNames)) {
      warnings.push(`  - ${v.name}: ${v.description}`);
    }
  }

  // Log results
  if (missing.length > 0) {
    const message =
      `[ENV] MISSING REQUIRED environment variables:\n${missing.join('\n')}\n` +
      `The application cannot function correctly without these.`;

    if (process.env.NODE_ENV === 'production') {
      // In production: fail fast — don't serve a broken app
      throw new Error(message);
    } else {
      // In development: warn but continue
      console.error(message);
    }
  }

  if (warnings.length > 0) {
    console.warn(
      `[ENV] Missing recommended environment variables:\n${warnings.join('\n')}\n` +
        `Some features will be degraded.`
    );
  }

  if (missing.length === 0 && warnings.length === 0) {
    console.log('[ENV] All required and recommended environment variables are configured.');
  }
}
