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
 * Called once at application startup.
 */
export function validateEnvironment(): void {
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
    console.error(
      `[ENV] MISSING REQUIRED environment variables:\n${missing.join('\n')}\n` +
        `The application may not function correctly.`
    );
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
