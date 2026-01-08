/**
 * ADMIN CHECK API
 * PURPOSE: Check if current user is an admin
 */

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';
import { successResponse, errors, checkRequestRateLimit, rateLimits } from '@/lib/api/utils';

const log = logger('IsAdmin');

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
      return errors.unauthorized();
    }

    // Rate limit by user
    const rateLimitResult = checkRequestRateLimit(`admin:check:${user.id}`, rateLimits.standard);
    if (!rateLimitResult.allowed) return rateLimitResult.response;

    // Check if user is in admin_users table
    const { data: adminUser, error: adminError } = await supabase
      .from('admin_users')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (adminError && adminError.code !== 'PGRST116') {
      // PGRST116 is "not found" error, which is expected for non-admins
      log.error('[API] Error checking admin status:', adminError instanceof Error ? adminError : { adminError });
    }

    return successResponse({
      isAdmin: !!adminUser,
      userId: user.id,
      email: user.email
    });
  } catch (error) {
    log.error('[API] Admin check error:', error instanceof Error ? error : { error });
    return errors.serverError();
  }
}

// Mark this route as dynamic
export const dynamic = 'force-dynamic';
