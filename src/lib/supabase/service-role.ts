/**
 * SUPABASE SERVICE ROLE CLIENT
 *
 * Creates a Supabase client with service role privileges.
 * This does NOT depend on next/headers and can be used anywhere.
 *
 * SECURITY: Only use for server-side operations that need elevated privileges.
 * The service role key bypasses RLS policies.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { logger } from '@/lib/logger';

const log = logger('ServiceRole');

let serviceRoleClient: SupabaseClient<Database> | null = null;

/**
 * Get or create a Supabase client with service role privileges.
 * This client bypasses RLS and should only be used on the server.
 */
export function createServiceRoleClient(): SupabaseClient<Database> {
  // Return cached client if available
  if (serviceRoleClient) {
    return serviceRoleClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
  }

  if (!serviceRoleKey) {
    log.warn('SUPABASE_SERVICE_ROLE_KEY not set, using anon key (limited access)');
  }

  serviceRoleClient = createClient<Database>(
    supabaseUrl,
    serviceRoleKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  return serviceRoleClient;
}

/**
 * Reset the cached service role client.
 * Useful for testing or when credentials change.
 */
export function resetServiceRoleClient(): void {
  serviceRoleClient = null;
}
