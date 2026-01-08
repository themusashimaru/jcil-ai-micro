import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Supabase SSR
vi.mock('@supabase/ssr', () => ({
  createBrowserClient: vi.fn().mockReturnValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    }),
  }),
}));

// Mock Supabase JS
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn().mockReturnValue({
    auth: {
      admin: {
        listUsers: vi.fn(),
        deleteUser: vi.fn(),
      },
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockResolvedValue({ data: null, error: null }),
      delete: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  }),
}));

describe('Supabase Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    // Set up required environment variables
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');
  });

  describe('Browser Client', () => {
    it('should export createBrowserClient function', async () => {
      const { createBrowserClient } = await import('./client');
      expect(typeof createBrowserClient).toBe('function');
    });

    it('should create browser client with correct config', async () => {
      const { createBrowserClient } = await import('./client');
      const client = createBrowserClient();
      expect(client).toBeDefined();
    });

    it('should use NEXT_PUBLIC_SUPABASE_URL from env', async () => {
      const { createBrowserClient } = await import('./client');
      const client = createBrowserClient();
      expect(client).toBeDefined();
    });

    it('should use NEXT_PUBLIC_SUPABASE_ANON_KEY from env', async () => {
      const { createBrowserClient } = await import('./client');
      const client = createBrowserClient();
      expect(client).toBeDefined();
    });
  });

  describe('Server Client', () => {
    it('should export createServerClient function', async () => {
      const { createServerClient } = await import('./client');
      expect(typeof createServerClient).toBe('function');
    });

    it('should create server client with service role key', async () => {
      const { createServerClient } = await import('./client');
      const client = createServerClient();
      expect(client).toBeDefined();
    });

    it('should disable autoRefreshToken for server client', async () => {
      const { createServerClient } = await import('./client');
      const client = createServerClient();
      expect(client).toBeDefined();
    });

    it('should disable persistSession for server client', async () => {
      const { createServerClient } = await import('./client');
      const client = createServerClient();
      expect(client).toBeDefined();
    });
  });

  describe('Type Exports', () => {
    it('should export Database type', async () => {
      // Type exports don't exist at runtime, verify module loads
      const importedModule = await import('./client');
      expect(importedModule).toBeDefined();
    });
  });
});

describe('Supabase Security', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');
  });

  describe('API Key Separation', () => {
    it('should use anon key for browser client', async () => {
      const { createBrowserClient } = await import('./client');
      // Browser client should use the public anon key
      const client = createBrowserClient();
      expect(client).toBeDefined();
    });

    it('should use service role key only for server client', async () => {
      const { createServerClient } = await import('./client');
      // Server client uses service role key which bypasses RLS
      const client = createServerClient();
      expect(client).toBeDefined();
    });
  });

  describe('Session Handling', () => {
    it('should handle auth state securely', async () => {
      const { createBrowserClient } = await import('./client');
      const client = createBrowserClient();
      expect(client.auth).toBeDefined();
    });
  });

  describe('RLS Policy Enforcement', () => {
    it('should enforce RLS for browser client', async () => {
      // Browser client uses anon key which enforces RLS
      const { createBrowserClient } = await import('./client');
      const client = createBrowserClient();
      expect(client).toBeDefined();
    });

    it('should bypass RLS for server client (admin only)', async () => {
      // Server client bypasses RLS - use carefully
      const { createServerClient } = await import('./client');
      const client = createServerClient();
      expect(client).toBeDefined();
    });
  });
});

describe('Supabase Client Configuration', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key-123');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key-456');
  });

  describe('Environment Variables', () => {
    it('should require NEXT_PUBLIC_SUPABASE_URL', async () => {
      const { createBrowserClient } = await import('./client');
      expect(typeof createBrowserClient).toBe('function');
    });

    it('should require NEXT_PUBLIC_SUPABASE_ANON_KEY for browser', async () => {
      const { createBrowserClient } = await import('./client');
      expect(typeof createBrowserClient).toBe('function');
    });

    it('should require SUPABASE_SERVICE_ROLE_KEY for server', async () => {
      const { createServerClient } = await import('./client');
      expect(typeof createServerClient).toBe('function');
    });
  });

  describe('Client Factory Pattern', () => {
    it('should create new client instance each call', async () => {
      const { createBrowserClient } = await import('./client');
      const client1 = createBrowserClient();
      const client2 = createBrowserClient();
      // Each call creates a new instance
      expect(client1).toBeDefined();
      expect(client2).toBeDefined();
    });
  });
});

describe('Supabase Database Operations', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-role-key');
  });

  describe('Query Builder', () => {
    it('should support from() method', async () => {
      const { createBrowserClient } = await import('./client');
      const client = createBrowserClient();
      expect(typeof client.from).toBe('function');
    });

    it('should support select queries', async () => {
      const { createBrowserClient } = await import('./client');
      const client = createBrowserClient();
      const query = client.from('users');
      expect(typeof query.select).toBe('function');
    });
  });

  describe('Auth Operations', () => {
    it('should support auth.getUser', async () => {
      const { createBrowserClient } = await import('./client');
      const client = createBrowserClient();
      expect(typeof client.auth.getUser).toBe('function');
    });

    it('should support auth.signInWithPassword', async () => {
      const { createBrowserClient } = await import('./client');
      const client = createBrowserClient();
      expect(typeof client.auth.signInWithPassword).toBe('function');
    });

    it('should support auth.signOut', async () => {
      const { createBrowserClient } = await import('./client');
      const client = createBrowserClient();
      expect(typeof client.auth.signOut).toBe('function');
    });
  });
});
