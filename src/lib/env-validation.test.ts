import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateEnvironment } from './env-validation';

describe('validateEnvironment', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset process.env to a clean copy
    process.env = { ...originalEnv };
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it('should skip validation when SKIP_ENV_VALIDATION=true', () => {
    process.env.SKIP_ENV_VALIDATION = 'true';
    validateEnvironment();
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Validation skipped'));
  });

  it('should not skip when SKIP_ENV_VALIDATION is not set', () => {
    delete process.env.SKIP_ENV_VALIDATION;
    // Missing required vars, should warn/error
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY_1;
    (process.env as Record<string, string>).NODE_ENV = 'development';

    validateEnvironment();
    // Should NOT see "Validation skipped"
    expect(console.log).not.toHaveBeenCalledWith(expect.stringContaining('Validation skipped'));
  });

  it('should log error for missing required vars in development', () => {
    delete process.env.SKIP_ENV_VALIDATION;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY_1;
    (process.env as Record<string, string>).NODE_ENV = 'development';

    validateEnvironment();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('MISSING REQUIRED'));
  });

  it('should throw in production for missing required vars', () => {
    delete process.env.SKIP_ENV_VALIDATION;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY_1;
    (process.env as Record<string, string>).NODE_ENV = 'production';

    expect(() => validateEnvironment()).toThrow('MISSING REQUIRED');
  });

  it('should accept alternative env var names', () => {
    delete process.env.SKIP_ENV_VALIDATION;
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
    // Use alternative instead of primary
    delete process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY_1 = 'sk-ant-test';
    (process.env as Record<string, string>).NODE_ENV = 'development';

    validateEnvironment();
    // Should not error about missing required vars
    expect(console.error).not.toHaveBeenCalled();
  });

  it('should warn about missing recommended vars', () => {
    delete process.env.SKIP_ENV_VALIDATION;
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    // Missing recommended vars
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.E2B_API_KEY;
    delete process.env.STRIPE_SECRET_KEY;
    (process.env as Record<string, string>).NODE_ENV = 'development';

    validateEnvironment();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Missing recommended'));
  });

  it('should log success when all vars are set', () => {
    delete process.env.SKIP_ENV_VALIDATION;
    // Set all required
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
    // Set all recommended
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.test.com';
    process.env.ENCRYPTION_KEY = 'enc-key';
    process.env.CRON_SECRET = 'cron-secret';
    process.env.UPSTASH_REDIS_REST_URL = 'https://redis.test.com';
    process.env.E2B_API_KEY = 'e2b-key';
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_123';
    process.env.COMPOSIO_API_KEY = 'composio-key';
    process.env.PERPLEXITY_API_KEY = 'pplx-key';
    (process.env as Record<string, string>).NODE_ENV = 'development';

    validateEnvironment();
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('All required and recommended')
    );
  });

  it('should treat "your_" prefix as unset', () => {
    delete process.env.SKIP_ENV_VALIDATION;
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'your_supabase_url';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'your_anon_key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'your_service_key';
    process.env.ANTHROPIC_API_KEY = 'your_api_key';
    (process.env as Record<string, string>).NODE_ENV = 'development';

    validateEnvironment();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('MISSING REQUIRED'));
  });

  it('should treat empty string as unset', () => {
    delete process.env.SKIP_ENV_VALIDATION;
    process.env.NEXT_PUBLIC_SUPABASE_URL = '';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = '';
    process.env.SUPABASE_SERVICE_ROLE_KEY = '';
    process.env.ANTHROPIC_API_KEY = '';
    (process.env as Record<string, string>).NODE_ENV = 'development';

    validateEnvironment();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('MISSING REQUIRED'));
  });
});
