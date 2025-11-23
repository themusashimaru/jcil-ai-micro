/**
 * SUPABASE AUTH HELPERS
 *
 * PURPOSE:
 * - Authentication utilities
 * - User session management
 * - Auth state helpers
 */

import { createBrowserClient } from './client';

/**
 * Sign in with Google OAuth
 */
export async function signInWithGoogle() {
  const supabase = createBrowserClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/api/auth/callback`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });

  if (error) throw error;
  return data;
}

/**
 * Sign up with email and password
 */
export async function signUpWithEmail(email: string, password: string, metadata?: {
  full_name?: string;
  role?: 'student' | 'professional';
  field?: string;
  purpose?: string;
}) {
  const supabase = createBrowserClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/api/auth/callback`,
      data: metadata || {},
    },
  });

  if (error) throw error;
  return data;
}

/**
 * Sign in with email and password
 */
export async function signInWithEmail(email: string, password: string) {
  const supabase = createBrowserClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
}

/**
 * Send password reset email
 */
export async function resetPassword(email: string) {
  const supabase = createBrowserClient();

  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset-password`,
  });

  if (error) throw error;
  return data;
}

/**
 * Update password (after reset)
 */
export async function updatePassword(newPassword: string) {
  const supabase = createBrowserClient();

  const { data, error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) throw error;
  return data;
}

/**
 * Update email address
 * Requires confirmation from both old and new email addresses
 */
export async function updateEmail(newEmail: string) {
  const supabase = createBrowserClient();

  const { data, error } = await supabase.auth.updateUser({
    email: newEmail,
  });

  if (error) throw error;
  return data;
}

/**
 * Sign out
 */
export async function signOut() {
  const supabase = createBrowserClient();

  const { error } = await supabase.auth.signOut();

  if (error) throw error;
}

/**
 * Get current user session
 */
export async function getSession() {
  const supabase = createBrowserClient();

  const { data, error } = await supabase.auth.getSession();

  if (error) throw error;
  return data.session;
}

/**
 * Get current user
 */
export async function getUser() {
  const supabase = createBrowserClient();

  const { data, error } = await supabase.auth.getUser();

  if (error) throw error;
  return data.user;
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  try {
    const session = await getSession();
    return !!session;
  } catch {
    return false;
  }
}

/**
 * Check if user is admin
 */
export async function isAdmin(): Promise<boolean> {
  try {
    const user = await getUser();
    if (!user || !user.email) return false;

    const supabase = createBrowserClient();
    const { data } = await supabase
      .from('admin_users')
      .select('email')
      .eq('email', user.email)
      .single();

    return !!data;
  } catch {
    return false;
  }
}
