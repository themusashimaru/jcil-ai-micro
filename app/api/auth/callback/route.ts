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
 * - Secure session handling with SSR
 */

import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') || '/chat';

  console.log('Auth callback received, code:', code ? 'present' : 'missing');

  if (code) {
    try {
      const cookieStore = await cookies();

      // Create Supabase client with SSR cookie handling
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            get(name: string) {
              return cookieStore.get(name)?.value;
            },
            set(name: string, value: string, options: any) {
              try {
                cookieStore.set({ name, value, ...options });
              } catch (e) {
                console.error('Error setting cookie:', name, e);
              }
            },
            remove(name: string, options: any) {
              try {
                cookieStore.set({ name, value: '', ...options });
              } catch (e) {
                console.error('Error removing cookie:', name, e);
              }
            },
          },
        }
      );

      // Exchange code for session - this will automatically set cookies
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        console.error('Error exchanging code for session:', error);
        throw error;
      }

      console.log('Session exchange successful, user:', data.user?.email);

      if (data.user) {
        // Use service role client for database operations
        const adminClient = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          {
            auth: {
              autoRefreshToken: false,
              persistSession: false
            }
          }
        );

        // Check if user record exists in database
        const { data: existingUser } = await adminClient
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

          const { error: insertError } = await adminClient
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
