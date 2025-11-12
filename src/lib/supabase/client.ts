/**
 * SUPABASE CLIENT
 *
 * PURPOSE:
 * - Initialize Supabase client for browser/server
 * - Provide typed database client
 * - Handle auth state management
 *
 * SECURITY/RLS NOTES:
 * - Use anon key for client-side
 * - Use service role key only server-side
 * - RLS policies enforce data access
 *
 * DEPENDENCIES/ENVS:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY
 * - SUPABASE_SERVICE_ROLE_KEY (server only)
 */

import { createBrowserClient as createBrowserSupabaseClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

/**
 * Create a Supabase client for browser (client-side)
 * Handles auth session automatically with cookies
 */
export const createBrowserClient = () => {
  return createBrowserSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
};

/**
 * Create a Supabase client for server-side with service role
 * ONLY use this for admin operations - bypasses RLS
 */
export const createServerClient = () => {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
};

export type { Database };
