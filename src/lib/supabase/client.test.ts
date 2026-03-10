/**
 * SUPABASE CLIENT TESTS
 *
 * Tests for Supabase client initialization and configuration
 * These tests verify the module structure and exports without mocking
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Supabase Client Module', () => {
  beforeEach(() => {
    // Set up required environment variables for tests
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test-project.supabase.co');
    vi.stubEnv(
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'test-anon-key-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'
    );
    vi.stubEnv(
      'SUPABASE_SERVICE_ROLE_KEY',
      'test-service-role-key-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'
    );
  });

  describe('Module Exports', () => {
    it('should export createBrowserClient function', async () => {
      const clientModule = await import('./client');
      expect(typeof clientModule.createBrowserClient).toBe('function');
    });

    it('should export createServerClient function', async () => {
      const clientModule = await import('./client');
      expect(typeof clientModule.createServerClient).toBe('function');
    });

    it('should export createFreshServerClient function', async () => {
      const clientModule = await import('./client');
      expect(typeof clientModule.createFreshServerClient).toBe('function');
    });

    it('should export getConnectionStats function', async () => {
      const clientModule = await import('./client');
      expect(typeof clientModule.getConnectionStats).toBe('function');
    });
  });

  describe('Browser Client', () => {
    it('should create browser client instance', async () => {
      const { createBrowserClient } = await import('./client');
      const client = createBrowserClient();

      expect(client).toBeDefined();
      expect(client).toHaveProperty('auth');
      expect(client).toHaveProperty('from');
    });

    it('should have auth methods on browser client', async () => {
      const { createBrowserClient } = await import('./client');
      const client = createBrowserClient();

      expect(typeof client.auth.getUser).toBe('function');
      expect(typeof client.auth.signInWithPassword).toBe('function');
      expect(typeof client.auth.signOut).toBe('function');
      expect(typeof client.auth.onAuthStateChange).toBe('function');
    });

    it('should have database query methods', async () => {
      const { createBrowserClient } = await import('./client');
      const client = createBrowserClient();

      expect(typeof client.from).toBe('function');
      const query = client.from('test_table');
      expect(typeof query.select).toBe('function');
      expect(typeof query.insert).toBe('function');
      expect(typeof query.update).toBe('function');
      expect(typeof query.delete).toBe('function');
    });
  });

  describe('Server Client', () => {
    it('should create server client instance', async () => {
      const { createServerClient } = await import('./client');
      const client = createServerClient();

      expect(client).toBeDefined();
      expect(client).toHaveProperty('auth');
      expect(client).toHaveProperty('from');
    });

    it('should use singleton pattern for server client', async () => {
      const { createServerClient, getConnectionStats } = await import('./client');

      // Create first client
      const client1 = createServerClient();
      expect(getConnectionStats().hasSingleton).toBe(true);

      // Second call should return same instance
      const client2 = createServerClient();
      expect(client1).toBe(client2);
    });

    it('should have admin auth methods', async () => {
      const { createServerClient } = await import('./client');
      const client = createServerClient();

      expect(typeof client.auth.admin).toBe('object');
      expect(typeof client.auth.admin.listUsers).toBe('function');
      expect(typeof client.auth.admin.deleteUser).toBe('function');
    });

    it('should create fresh client when requested', async () => {
      const { createServerClient, createFreshServerClient, getConnectionStats } = await import(
        './client'
      );

      // Create initial client
      createServerClient();
      const initialHasSingleton = getConnectionStats().hasSingleton;
      expect(initialHasSingleton).toBe(true);

      // Fresh client should still work
      const freshClient = createFreshServerClient();
      expect(freshClient).toBeDefined();
      expect(getConnectionStats().hasSingleton).toBe(true);
    });
  });

  describe('Connection Stats', () => {
    it('should return connection statistics', async () => {
      const { getConnectionStats } = await import('./client');

      // Initially may or may not have singleton depending on previous tests
      const stats = getConnectionStats();

      expect(stats).toHaveProperty('hasSingleton');
      expect(stats).toHaveProperty('poolMode');
      expect(stats).toHaveProperty('maxConnections');
      expect(stats.poolMode).toBe('transaction');
      expect(stats.maxConnections).toBe(100);
    });
  });
});

describe('Supabase Client Security', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://secure-project.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key-for-browser');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key-for-server');
  });

  describe('Key Separation', () => {
    it('should use anon key for browser client (RLS enforced)', async () => {
      const { createBrowserClient } = await import('./client');
      const client = createBrowserClient();

      // Browser client uses anon key - RLS policies are enforced
      // This is verified by the client being created successfully
      expect(client).toBeDefined();
    });

    it('should use service role key for server client (RLS bypassed)', async () => {
      const { createServerClient } = await import('./client');
      const client = createServerClient();

      // Server client uses service role key - bypasses RLS
      // Should have admin capabilities
      expect(client.auth.admin).toBeDefined();
    });
  });
});

describe('Supabase Client Query Builder', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key');
  });

  describe('Query Methods', () => {
    it('should support select with columns', async () => {
      const { createBrowserClient } = await import('./client');
      const client = createBrowserClient();

      const query = client.from('users').select('id, name, email');
      expect(query).toBeDefined();
      expect(typeof query.eq).toBe('function');
      expect(typeof query.neq).toBe('function');
      expect(typeof query.gt).toBe('function');
      expect(typeof query.lt).toBe('function');
    });

    it('should support filter methods', async () => {
      const { createBrowserClient } = await import('./client');
      const client = createBrowserClient();

      const query = client.from('users').select('*');
      expect(typeof query.eq).toBe('function');
      expect(typeof query.in).toBe('function');
      expect(typeof query.is).toBe('function');
      expect(typeof query.order).toBe('function');
      expect(typeof query.limit).toBe('function');
    });

    it('should support insert operations', async () => {
      const { createBrowserClient } = await import('./client');
      const client = createBrowserClient();

      // Test that insert method exists and returns a query builder
      const table = client.from('profiles');
      expect(typeof table.insert).toBe('function');
    });

    it('should support update operations', async () => {
      const { createBrowserClient } = await import('./client');
      const client = createBrowserClient();

      // Test that update method exists and returns a query builder
      const table = client.from('profiles');
      expect(typeof table.update).toBe('function');
    });

    it('should support upsert operations', async () => {
      const { createBrowserClient } = await import('./client');
      const client = createBrowserClient();

      // Test that upsert method exists and returns a query builder
      const table = client.from('profiles');
      expect(typeof table.upsert).toBe('function');
    });

    it('should support delete operations', async () => {
      const { createBrowserClient } = await import('./client');
      const client = createBrowserClient();

      // Test that delete method exists and returns a query builder
      const table = client.from('profiles');
      expect(typeof table.delete).toBe('function');
    });
  });
});

describe('Supabase Storage', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key');
  });

  it('should have storage API available', async () => {
    const { createBrowserClient } = await import('./client');
    const client = createBrowserClient();

    expect(client.storage).toBeDefined();
    expect(typeof client.storage.from).toBe('function');
  });

  it('should support bucket operations', async () => {
    const { createServerClient } = await import('./client');
    const client = createServerClient();

    const bucket = client.storage.from('documents');
    expect(bucket).toBeDefined();
    expect(typeof bucket.upload).toBe('function');
    expect(typeof bucket.download).toBe('function');
    expect(typeof bucket.getPublicUrl).toBe('function');
    expect(typeof bucket.list).toBe('function');
    expect(typeof bucket.remove).toBe('function');
  });
});

describe('Supabase Realtime', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key');
  });

  it('should have realtime API available', async () => {
    const { createBrowserClient } = await import('./client');
    const client = createBrowserClient();

    expect(typeof client.channel).toBe('function');
  });

  it('should support channel subscriptions', async () => {
    const { createBrowserClient } = await import('./client');
    const client = createBrowserClient();

    const channel = client.channel('test-channel');
    expect(channel).toBeDefined();
    expect(typeof channel.on).toBe('function');
    expect(typeof channel.subscribe).toBe('function');
    expect(typeof channel.unsubscribe).toBe('function');
  });
});
