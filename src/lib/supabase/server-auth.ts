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
  const user = await getServerUser();
  if (!user || !user.email) return false;

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from('admin_users')
    .select('email')
    .eq('email', user.email)
    .single();

  return !!data;
}
