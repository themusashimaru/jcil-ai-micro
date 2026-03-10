import { describe, it, expect, vi, beforeEach } from 'vitest';

let callCount = 0;

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn((..._args: unknown[]) => {
    callCount++;
    return {
      auth: { autoRefreshToken: false, persistSession: false },
      from: vi.fn(),
      _instanceId: callCount,
    };
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
  auditLog: {
    log: vi.fn(),
  },
}));

import { createClient } from '@supabase/supabase-js';
import { createServiceRoleClient, resetServiceRoleClient } from './service-role';

describe('createServiceRoleClient', () => {
  beforeEach(() => {
    resetServiceRoleClient();
    callCount = 0;
    vi.mocked(createClient).mockClear();
    vi.stubGlobal('process', {
      ...process,
      env: {
        ...process.env,
        NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
        NODE_ENV: 'test',
      },
    });
  });

  it('should create a client with service role key', () => {
    createServiceRoleClient();
    expect(createClient).toHaveBeenCalledWith(
      'https://test.supabase.co',
      'test-service-role-key',
      expect.objectContaining({
        auth: expect.objectContaining({
          autoRefreshToken: false,
          persistSession: false,
        }),
      })
    );
  });

  it('should return a cached client on subsequent calls', () => {
    const client1 = createServiceRoleClient();
    const client2 = createServiceRoleClient();
    expect(client1).toBe(client2);
    expect(createClient).toHaveBeenCalledTimes(1);
  });

  it('should throw if NEXT_PUBLIC_SUPABASE_URL is not set', () => {
    vi.stubGlobal('process', {
      ...process,
      env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: '' },
    });
    expect(() => createServiceRoleClient()).toThrow('NEXT_PUBLIC_SUPABASE_URL is not set');
  });

  it('should use anon key if service role key is missing', () => {
    vi.stubGlobal('process', {
      ...process,
      env: {
        ...process.env,
        NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: '',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
        NODE_ENV: 'test',
      },
    });
    createServiceRoleClient();
    expect(createClient).toHaveBeenCalledWith(
      'https://test.supabase.co',
      'test-anon-key',
      expect.any(Object)
    );
  });
});

describe('resetServiceRoleClient', () => {
  beforeEach(() => {
    resetServiceRoleClient();
    callCount = 0;
    vi.mocked(createClient).mockClear();
    vi.stubGlobal('process', {
      ...process,
      env: {
        ...process.env,
        NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
        NODE_ENV: 'test',
      },
    });
  });

  it('should clear the cached client so next call creates new one', () => {
    createServiceRoleClient();
    expect(createClient).toHaveBeenCalledTimes(1);
    resetServiceRoleClient();
    createServiceRoleClient();
    expect(createClient).toHaveBeenCalledTimes(2);
  });

  it('should not throw if called without existing client', () => {
    expect(() => resetServiceRoleClient()).not.toThrow();
  });
});
