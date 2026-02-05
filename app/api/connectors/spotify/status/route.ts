/**
 * SPOTIFY STATUS - Check Connection Status
 * ========================================
 *
 * Returns the current Spotify connection status for the user.
 * Handles token refresh if needed.
 */

import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';
import { successResponse, errors } from '@/lib/api/utils';
import { decrypt as decryptToken, encrypt as encryptToken } from '@/lib/security/crypto';
import { getCurrentUser, refreshAccessToken, isSpotifyConfigured } from '@/lib/connectors/spotify';

const log = logger('SpotifyStatus');

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

export async function GET() {
  try {
    // Check if Spotify is configured
    if (!isSpotifyConfigured()) {
      return successResponse({
        configured: false,
        connected: false,
        message: 'Spotify integration is not configured',
      });
    }

    const { user, error } = await getUser();
    if (error || !user) {
      return errors.unauthorized();
    }

    // Use service role to read from users table
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: userData, error: fetchError } = await adminClient
      .from('users')
      .select(`
        spotify_access_token,
        spotify_refresh_token,
        spotify_token_expires_at,
        spotify_user_id,
        spotify_display_name,
        spotify_email,
        spotify_image_url,
        spotify_product,
        spotify_connected_at
      `)
      .eq('id', user.id)
      .single();

    if (fetchError) {
      log.error('Failed to fetch user data', { error: fetchError });
      return errors.serverError();
    }

    // Check if user has Spotify connected
    if (!userData?.spotify_access_token || !userData?.spotify_refresh_token) {
      return successResponse({
        configured: true,
        connected: false,
      });
    }

    // Try to decrypt tokens
    let accessToken: string;
    let refreshToken: string;
    try {
      accessToken = decryptToken(userData.spotify_access_token);
      refreshToken = decryptToken(userData.spotify_refresh_token);
    } catch (decryptError) {
      log.warn('Token decryption failed, clearing invalid tokens', { error: decryptError });
      await adminClient
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

      return successResponse({
        configured: true,
        connected: false,
        error: 'Token encryption changed, please reconnect',
      });
    }

    // Check if token is expired
    const expiresAt = new Date(userData.spotify_token_expires_at);
    const now = new Date();
    const isExpired = now >= expiresAt;

    // If token is expired or about to expire (within 5 minutes), refresh it
    if (isExpired || (expiresAt.getTime() - now.getTime()) < 5 * 60 * 1000) {
      try {
        log.info('Refreshing expired Spotify token', { userId: user.id });
        const newTokens = await refreshAccessToken(refreshToken);

        // Update stored tokens
        const newExpiresAt = new Date(Date.now() + newTokens.expires_in * 1000).toISOString();
        await adminClient
          .from('users')
          .update({
            spotify_access_token: encryptToken(newTokens.access_token),
            spotify_refresh_token: newTokens.refresh_token
              ? encryptToken(newTokens.refresh_token)
              : userData.spotify_refresh_token,
            spotify_token_expires_at: newExpiresAt,
          })
          .eq('id', user.id);

        accessToken = newTokens.access_token;
      } catch (refreshError) {
        log.error('Token refresh failed', { error: refreshError });
        // Clear invalid tokens
        await adminClient
          .from('users')
          .update({
            spotify_access_token: null,
            spotify_refresh_token: null,
            spotify_token_expires_at: null,
            spotify_connected_at: null,
          })
          .eq('id', user.id);

        return successResponse({
          configured: true,
          connected: false,
          error: 'Session expired, please reconnect',
        });
      }
    }

    // Verify the token is still valid by making a test request
    try {
      const spotifyUser = await getCurrentUser(accessToken);

      return successResponse({
        configured: true,
        connected: true,
        userId: spotifyUser.id,
        displayName: spotifyUser.display_name || spotifyUser.email,
        email: spotifyUser.email,
        imageUrl: spotifyUser.images?.[0]?.url,
        product: spotifyUser.product,
        connectedAt: userData.spotify_connected_at,
      });
    } catch (apiError) {
      log.error('Spotify API validation failed', { error: apiError });

      // Token might be invalid, try to refresh one more time
      try {
        const newTokens = await refreshAccessToken(refreshToken);
        const spotifyUser = await getCurrentUser(newTokens.access_token);

        // Update stored tokens
        const newExpiresAt = new Date(Date.now() + newTokens.expires_in * 1000).toISOString();
        await adminClient
          .from('users')
          .update({
            spotify_access_token: encryptToken(newTokens.access_token),
            spotify_refresh_token: newTokens.refresh_token
              ? encryptToken(newTokens.refresh_token)
              : userData.spotify_refresh_token,
            spotify_token_expires_at: newExpiresAt,
          })
          .eq('id', user.id);

        return successResponse({
          configured: true,
          connected: true,
          userId: spotifyUser.id,
          displayName: spotifyUser.display_name || spotifyUser.email,
          email: spotifyUser.email,
          imageUrl: spotifyUser.images?.[0]?.url,
          product: spotifyUser.product,
          connectedAt: userData.spotify_connected_at,
        });
      } catch {
        // Clear invalid tokens
        await adminClient
          .from('users')
          .update({
            spotify_access_token: null,
            spotify_refresh_token: null,
            spotify_token_expires_at: null,
            spotify_connected_at: null,
          })
          .eq('id', user.id);

        return successResponse({
          configured: true,
          connected: false,
          error: 'Session expired, please reconnect',
        });
      }
    }
  } catch (err) {
    log.error('Status check failed', { error: err });
    return errors.serverError();
  }
}
