/**
 * SPOTIFY CALLBACK - Handle OAuth Callback
 * =========================================
 *
 * Handles the OAuth callback from Spotify, exchanges the code for tokens,
 * and stores them encrypted in the database.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';
import { exchangeCodeForTokens, getCurrentUser } from '@/lib/connectors/spotify';
import { encrypt as encryptToken } from '@/lib/security/crypto';

const log = logger('SpotifyCallback');

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  const cookieStore = await cookies();
  const storedState = cookieStore.get('spotify_oauth_state')?.value;
  const userId = cookieStore.get('spotify_oauth_user')?.value;

  // Clear OAuth cookies
  cookieStore.delete('spotify_oauth_state');
  cookieStore.delete('spotify_oauth_user');

  // Check for errors from Spotify
  if (error) {
    log.error('Spotify auth error', { error });
    return NextResponse.redirect(
      new URL(`/settings?tab=connectors&error=${error}`, request.url)
    );
  }

  // Verify state for CSRF protection
  if (!state || state !== storedState) {
    log.error('State mismatch', { received: state, stored: storedState });
    return NextResponse.redirect(
      new URL('/settings?tab=connectors&error=invalid_state', request.url)
    );
  }

  // Verify we have a user ID
  if (!userId) {
    log.error('No user ID in callback');
    return NextResponse.redirect(
      new URL('/settings?tab=connectors&error=session_expired', request.url)
    );
  }

  // Verify we have a code
  if (!code) {
    log.error('No code received');
    return NextResponse.redirect(
      new URL('/settings?tab=connectors&error=no_code', request.url)
    );
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);
    log.info('Tokens received', { userId, scope: tokens.scope });

    // Get Spotify user profile
    const spotifyUser = await getCurrentUser(tokens.access_token);
    log.info('Spotify user profile', { spotifyId: spotifyUser.id, displayName: spotifyUser.display_name });

    // Calculate token expiration
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Use service role to update users table
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Encrypt tokens before storing
    const encryptedAccessToken = encryptToken(tokens.access_token);
    const encryptedRefreshToken = encryptToken(tokens.refresh_token);

    // Store tokens in database
    const { error: updateError } = await adminClient
      .from('users')
      .update({
        spotify_access_token: encryptedAccessToken,
        spotify_refresh_token: encryptedRefreshToken,
        spotify_token_expires_at: expiresAt,
        spotify_user_id: spotifyUser.id,
        spotify_display_name: spotifyUser.display_name,
        spotify_email: spotifyUser.email,
        spotify_image_url: spotifyUser.images?.[0]?.url || null,
        spotify_product: spotifyUser.product,
        spotify_connected_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (updateError) {
      log.error('Failed to store tokens', { error: updateError });
      return NextResponse.redirect(
        new URL('/settings?tab=connectors&error=storage_failed', request.url)
      );
    }

    log.info('Spotify connected successfully', { userId, spotifyId: spotifyUser.id });

    // Redirect to settings with success
    return NextResponse.redirect(
      new URL('/settings?tab=connectors&spotify=connected', request.url)
    );
  } catch (err) {
    log.error('Callback processing failed', { error: err });
    return NextResponse.redirect(
      new URL('/settings?tab=connectors&error=callback_failed', request.url)
    );
  }
}
