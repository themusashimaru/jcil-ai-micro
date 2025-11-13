/**
 * AUTH SIGNOUT ROUTE
 *
 * PURPOSE:
 * - Sign out user from Supabase
 * - Clear session and cookies
 * - Redirect to home page
 */

import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();

    console.log('[API] Starting logout process...');
    console.log('[API] Current cookies:', cookieStore.getAll().map(c => c.name));

    // Create Supabase client with SSR cookie handling
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              console.log('[API] Setting cookie:', name, 'value:', value ? 'present' : 'empty');
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    // Sign out from Supabase (clears session and cookies)
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error('[API] Supabase signout error:', error);
      throw error;
    }

    console.log('[API] Supabase signOut() completed');

    // MANUALLY delete ALL Supabase auth cookies to ensure they're cleared
    const allCookies = cookieStore.getAll();
    console.log('[API] Manually deleting cookies...');

    allCookies.forEach((cookie) => {
      // Delete any cookie that starts with 'sb-' (Supabase cookies)
      if (cookie.name.startsWith('sb-')) {
        console.log('[API] Deleting cookie:', cookie.name);
        cookieStore.delete(cookie.name);
      }
    });

    console.log('[API] User signed out successfully');
    console.log('[API] Remaining cookies:', cookieStore.getAll().map(c => c.name));

    // Return success - let client handle redirect
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('[API] Signout error:', error);
    return NextResponse.json(
      { error: 'Failed to sign out' },
      { status: 500 }
    );
  }
}
