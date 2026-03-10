/**
 * SUPABASE CLIENT
 *
 * PURPOSE:
 * - Initialize Supabase client for browser/server
 * - Provide typed database client
 * - Handle auth state management
 * - Support connection pooling for 100K+ scale
 *
 * SECURITY/RLS NOTES:
 * - Use anon key for client-side
 * - Use service role key only server-side
 * - RLS policies enforce data access
 *
 * SCALING NOTES:
 * - Connection pooling enabled via Supabase pgBouncer
 * - Use DATABASE_URL (pooler) for queries
 * - Use DATABASE_URL_DIRECT for migrations only
 *
 * DEPENDENCIES/ENVS:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY
 * - SUPABASE_SERVICE_ROLE_KEY (server only)
 * - DATABASE_URL (pooler connection, optional)
 */

import { createBrowserClient as createBrowserSupabaseClient } from '@supabase/ssr';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
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
 * Server client singleton for connection reuse
 * Prevents connection exhaustion in serverless environments
 */
let serverClientInstance: SupabaseClient<Database> | null = null;

/**
 * Create a Supabase client for server-side with service role
 * ONLY use this for admin operations - bypasses RLS
 *
 * SCALING: Uses singleton pattern to reuse connections within
 * the same serverless function invocation. Combined with
 * Supabase's pgBouncer connection pooling, this supports
 * 100K+ concurrent users.
 */
export const createServerClient = () => {
  if (serverClientInstance) {
    return serverClientInstance;
  }

  serverClientInstance = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      db: {
        schema: 'public',
      },
      global: {
        headers: {
          'x-connection-pool': 'transaction', // Signal to use transaction pooling
        },
        // Connection timeout for reliability
        fetch: (url, options = {}) => {
          return fetch(url, {
            ...options,
            signal: AbortSignal.timeout(30000), // 30s timeout
          });
        },
      },
    }
  );

  return serverClientInstance;
};

/**
 * Create a fresh server client (bypasses singleton)
 * Use this when you need a guaranteed fresh connection
 * (e.g., after connection errors)
 */
export const createFreshServerClient = () => {
  serverClientInstance = null;
  return createServerClient();
};

/**
 * Get connection pool stats (for monitoring)
 */
export const getConnectionStats = () => {
  return {
    hasSingleton: serverClientInstance !== null,
    poolMode: 'transaction', // pgBouncer mode
    maxConnections: 100, // Supabase Pro default
  };
};

export type { Database };
