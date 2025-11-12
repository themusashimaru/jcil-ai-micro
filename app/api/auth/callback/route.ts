/**
 * AUTH CALLBACK ROUTE
 *
 * PURPOSE:
 * - Handle OAuth callback from Google
 * - Exchange code for session
 * - Create user record if first login
 * - Redirect to /chat on success
 *
 * SECURITY/RLS NOTES:
 * - PKCE flow for OAuth
 * - Secure session handling
 */

import { createBrowserClient } from '@/lib/supabase/client';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') || '/chat';

  if (code) {
    try {
      const supabase = createBrowserClient();

      // Exchange code for session
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) throw error;

      if (data.user) {
        // Check if user record exists in database
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('id', data.user.id)
          .single();

        // Create user record if it doesn't exist (first-time login)
        if (!existingUser) {
          const { error: insertError } = await supabase
            .from('users')
            .insert({
              id: data.user.id,
              email: data.user.email!,
              full_name: data.user.user_metadata?.full_name || data.user.user_metadata?.name || null,
              subscription_tier: 'free',
            });

          if (insertError) {
            console.error('Error creating user record:', insertError);
          }
        }
      }

      // Redirect to chat
      return NextResponse.redirect(new URL(next, requestUrl.origin));
    } catch (error) {
      console.error('Auth callback error:', error);
      return NextResponse.redirect(new URL('/login?error=Authentication failed', requestUrl.origin));
    }
  }

  // No code present, redirect to login
  return NextResponse.redirect(new URL('/login', requestUrl.origin));
}
