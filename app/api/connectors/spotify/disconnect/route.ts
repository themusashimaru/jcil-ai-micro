/**
 * SPOTIFY DISCONNECT - Remove Connection
 * ======================================
 *
 * Removes the Spotify connection for the user by clearing stored tokens.
 */

import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';
import { successResponse, errors, checkRequestRateLimit, rateLimits } from '@/lib/api/utils';

const log = logger('SpotifyDisconnect');

export const runtime = 'nodejs';

async function getUser() {
  const cookieStore = await cookies();
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
            // Ignore
          }
        },
      },
    }
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  return { user, error };
}

export async function DELETE() {
  try {
    const { user, error } = await getUser();
    if (error || !user) {
      return errors.unauthorized();
    }

    // Rate limit
    const rateLimitResult = await checkRequestRateLimit(
      `spotify:disconnect:${user.id}`,
      rateLimits.strict
    );
    if (!rateLimitResult.allowed) return rateLimitResult.response;

    // Use service role to update users table
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Clear all Spotify-related fields
    const { error: updateError } = await adminClient
      .from('users')
      .update({
        spotify_access_token: null,
        spotify_refresh_token: null,
        spotify_token_expires_at: null,
        spotify_user_id: null,
        spotify_display_name: null,
        spotify_email: null,
        spotify_image_url: null,
        spotify_product: null,
        spotify_connected_at: null,
      })
      .eq('id', user.id);

    if (updateError) {
      log.error('Failed to disconnect Spotify', { error: updateError });
      return errors.serverError();
    }

    log.info('Spotify disconnected', { userId: user.id });

    return successResponse({ success: true });
  } catch (err) {
    log.error('Disconnect failed', { error: err });
    return errors.serverError();
  }
}

// Also support POST for compatibility
export { DELETE as POST };
