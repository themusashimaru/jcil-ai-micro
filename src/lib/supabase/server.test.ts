/**
 * SUPABASE SERVER CLIENT TESTS
 *
 * Tests for server.ts which re-exports createServerSupabaseClient
 * from server-auth.ts as `createClient`.
 */

import { describe, it, expect, vi } from 'vitest';

// Mock server-auth to verify the re-export
vi.mock('./server-auth', () => {
  return {
    createServerSupabaseClient: vi.fn().mockResolvedValue({
      auth: { getSession: vi.fn() },
      from: vi.fn(),
    }),
  };
});

describe('server.ts — re-export module', () => {
  it('exports createClient which is createServerSupabaseClient from server-auth', async () => {
    const serverModule = await import('./server');
    const serverAuthModule = await import('./server-auth');

    expect(serverModule.createClient).toBe(serverAuthModule.createServerSupabaseClient);
  });

  it('createClient returns a Supabase client', async () => {
    const { createClient } = await import('./server');
    const client = await createClient();

    expect(client).toBeDefined();
    expect(client).toHaveProperty('auth');
    expect(client).toHaveProperty('from');
  });
});
