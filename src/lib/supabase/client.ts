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
 *
 * TODO:
 * - [ ] Implement client factory functions
 * - [ ] Add TypeScript database types
 * - [ ] Create auth helpers
 * - [ ] Add storage helpers
 *
 * TEST PLAN:
 * - Verify client initializes correctly
 * - Test RLS policies enforce properly
 * - Validate auth state persists
 */

import { createClient } from '@supabase/supabase-js';

export const createBrowserClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  );
};

export const createServerClient = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
};

export type Database = Record<string, never>; // TODO: Generate from Supabase
