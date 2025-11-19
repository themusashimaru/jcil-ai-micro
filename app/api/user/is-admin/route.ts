/**
 * ADMIN CHECK API
 * PURPOSE: Check if current user is an admin
 */

import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Get authenticated Supabase client
async function getSupabaseClient() {
  const cookieStore = await cookies();
  return createServerClient(
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
}

export async function GET() {
  try {
    const supabase = await getSupabaseClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({
        isAdmin: false,
        error: 'Not authenticated'
      }, { status: 401 });
    }

    // Check if user is in admin_users table
    const { data: adminUser, error: adminError } = await supabase
      .from('admin_users')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (adminError && adminError.code !== 'PGRST116') {
      // PGRST116 is "not found" error, which is expected for non-admins
      console.error('[API] Error checking admin status:', adminError);
    }

    return NextResponse.json({
      isAdmin: !!adminUser,
      userId: user.id,
      email: user.email
    });
  } catch (error) {
    console.error('[API] Admin check error:', error);
    return NextResponse.json({
      isAdmin: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
}

// Mark this route as dynamic
export const dynamic = 'force-dynamic';
