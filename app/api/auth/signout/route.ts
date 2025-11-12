/**
 * AUTH SIGNOUT ROUTE
 *
 * PURPOSE:
 * - Sign out user from Supabase
 * - Clear session and cookies
 * - Redirect to home page
 */

import { createBrowserClient } from '@/lib/supabase/client';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = createBrowserClient();

    // Sign out from Supabase (clears session)
    const { error } = await supabase.auth.signOut();

    if (error) throw error;

    // Redirect to home
    const requestUrl = new URL(request.url);
    return NextResponse.redirect(new URL('/', requestUrl.origin), {
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
