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
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Silently handle cookie errors
            }
          },
        },
      }
    );

    // Sign out from Supabase (clears session and cookies)
    const { error } = await supabase.auth.signOut();

    if (error) throw error;

    // Redirect to login page
    const requestUrl = new URL(request.url);
    return NextResponse.redirect(new URL('/login', requestUrl.origin), {
      status: 302,
    });
  } catch (error) {
    console.error('Signout error:', error);
    return NextResponse.json(
      { error: 'Failed to sign out' },
      { status: 500 }
    );
  }
}
