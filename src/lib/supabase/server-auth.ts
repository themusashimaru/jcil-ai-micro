/**
 * SUPABASE SERVER-SIDE AUTH HELPERS
 *
 * PURPOSE:
 * - Authentication utilities for Server Components
 * - User session management on the server
 * - Auth checks for protected routes
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from './types';

/**
 * Create a Supabase client for server components
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Cookie operations may fail in Server Components
            // This is expected behavior
          }
        },
      },
    }
  );
}

/**
 * Get the current user session on the server
 */
export async function getServerSession() {
  const supabase = await createServerSupabaseClient();
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error) {
    return null;
  }

  return session;
}

/**
 * Get the current user on the server
 */
export async function getServerUser() {
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error) {
    return null;
  }

  return user;
}

/**
 * Check if user is authenticated (server-side)
 */
export async function isServerAuthenticated(): Promise<boolean> {
  const session = await getServerSession();
  return !!session;
}

/**
 * Check if user is admin (server-side)
 */
export async function isServerAdmin(): Promise<boolean> {
  try {
    const user = await getServerUser();
    if (!user || !user.id) {
      console.log('[Admin Check] No user or user ID found');
      return false;
    }

    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from('admin_users')
      .select('id, user_id, email')
      .eq('user_id', user.id)  // Check by user_id, not email (more secure)
      .single();

    // Explicitly handle error case
    if (error) {
      // PGRST116 means no rows returned, which is expected for non-admins
      if (error.code !== 'PGRST116') {
        console.error('[Admin Check] Database error:', error);
      }
      return false;
    }

    // Verify data exists and user_id matches
    if (!data || data.user_id !== user.id) {
      console.log('[Admin Check] No admin record found for user:', user.id);
      return false;
    }

    console.log('[Admin Check] Admin access granted for user:', user.id);
    return true;
  } catch (error) {
    console.error('[Admin Check] Unexpected error:', error);
    return false;
  }
}
