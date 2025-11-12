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

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') || '/chat';

  if (code) {
    try {
      // Use service role client for database operations
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        }
      );

      // Exchange code for session using anon key
      const anonClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const { data, error } = await anonClient.auth.exchangeCodeForSession(code);

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
          const userInsert = {
            id: data.user.id,
            email: data.user.email || '',
            full_name: data.user.user_metadata?.full_name || data.user.user_metadata?.name || null,
            role: data.user.user_metadata?.role || null,
            field: data.user.user_metadata?.field || null,
            purpose: data.user.user_metadata?.purpose || null,
            subscription_tier: 'free' as const,
          };

          const { error: insertError } = await supabase
            .from('users')
            .insert(userInsert);

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
