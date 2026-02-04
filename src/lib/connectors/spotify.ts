/**
 * SPOTIFY CONNECTOR
 * =================
 *
 * OAuth-based Spotify integration for music control, playlists,
 * and recommendations. Handles token refresh automatically.
 */

import { logger } from '@/lib/logger';
import type { SpotifyConnector } from './types';
import { CONNECTOR_CONFIGS } from './types';

const log = logger('SpotifyConnector');

// ============================================================================
// CONFIGURATION
// ============================================================================

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const SPOTIFY_REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/connectors/spotify/callback`;

const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';

// Scopes for Spotify access
const SPOTIFY_SCOPES = [
  'user-read-private',
  'user-read-email',
  'playlist-read-private',
  'playlist-modify-public',
  'playlist-modify-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-recently-played',
  'user-top-read',
].join(' ');

// ============================================================================
// CONFIGURATION CHECK
// ============================================================================

export function isSpotifyConfigured(): boolean {
  return !!(SPOTIFY_CLIENT_ID && SPOTIFY_CLIENT_SECRET);
}

// ============================================================================
// OAUTH HELPERS
// ============================================================================

/**
 * Generate the Spotify authorization URL
 */
export function getSpotifyAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID!,
    response_type: 'code',
    redirect_uri: SPOTIFY_REDIRECT_URI,
    scope: SPOTIFY_SCOPES,
    state,
    show_dialog: 'true', // Always show the auth dialog
  });

  return `${SPOTIFY_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}> {
  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: SPOTIFY_REDIRECT_URI,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    log.error('Token exchange failed', { status: response.status, error });
    throw new Error(`Failed to exchange code for tokens: ${error}`);
  }

  return response.json();
}

/**
 * Refresh an access token using a refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  refresh_token?: string; // Sometimes Spotify returns a new refresh token
}> {
  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    log.error('Token refresh failed', { status: response.status, error });
    throw new Error(`Failed to refresh token: ${error}`);
  }

  return response.json();
}

// ============================================================================
// API HELPERS
// ============================================================================

/**
 * Make an authenticated request to Spotify API
 */
async function spotifyRequest<T>(
  accessToken: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${SPOTIFY_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    log.error('Spotify API request failed', { endpoint, status: response.status, error });
    throw new Error(`Spotify API error: ${response.status} ${error}`);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

// ============================================================================
// USER PROFILE
// ============================================================================

export interface SpotifyUser {
  id: string;
  display_name: string | null;
  email: string;
  images: { url: string; height: number; width: number }[];
  product: 'premium' | 'free' | 'open';
  country: string;
  followers: { total: number };
}

export async function getCurrentUser(accessToken: string): Promise<SpotifyUser> {
  return spotifyRequest<SpotifyUser>(accessToken, '/me');
}

/**
 * Get connection status for display
 */
export async function getSpotifyConnectionStatus(accessToken: string): Promise<SpotifyConnector> {
  try {
    const user = await getCurrentUser(accessToken);

    return {
      type: 'spotify',
      displayName: CONNECTOR_CONFIGS.spotify.displayName,
      icon: CONNECTOR_CONFIGS.spotify.icon,
      description: CONNECTOR_CONFIGS.spotify.description,
      status: 'connected',
      connectedAt: new Date().toISOString(),
      metadata: {
        userId: user.id,
        displayName: user.display_name || user.email,
        email: user.email,
        imageUrl: user.images?.[0]?.url,
        product: user.product,
      },
    };
  } catch (error) {
    log.error('Failed to get Spotify connection status', { error });
    return {
      type: 'spotify',
      displayName: CONNECTOR_CONFIGS.spotify.displayName,
      icon: CONNECTOR_CONFIGS.spotify.icon,
      description: CONNECTOR_CONFIGS.spotify.description,
      status: 'error',
    };
  }
}

// ============================================================================
// PLAYBACK CONTROL
// ============================================================================

export interface SpotifyPlaybackState {
  is_playing: boolean;
  progress_ms: number;
  item: {
    name: string;
    artists: { name: string }[];
    album: { name: string; images: { url: string }[] };
    duration_ms: number;
    uri: string;
  } | null;
  device: {
    id: string;
    name: string;
    type: string;
    is_active: boolean;
  };
}

export async function getPlaybackState(accessToken: string): Promise<SpotifyPlaybackState | null> {
  try {
    return await spotifyRequest<SpotifyPlaybackState>(accessToken, '/me/player');
  } catch {
    return null; // No active playback
  }
}

export async function play(accessToken: string, options?: { uris?: string[]; context_uri?: string }): Promise<void> {
  await spotifyRequest(accessToken, '/me/player/play', {
    method: 'PUT',
    body: options ? JSON.stringify(options) : undefined,
  });
}

export async function pause(accessToken: string): Promise<void> {
  await spotifyRequest(accessToken, '/me/player/pause', { method: 'PUT' });
}

export async function skipToNext(accessToken: string): Promise<void> {
  await spotifyRequest(accessToken, '/me/player/next', { method: 'POST' });
}

export async function skipToPrevious(accessToken: string): Promise<void> {
  await spotifyRequest(accessToken, '/me/player/previous', { method: 'POST' });
}

// ============================================================================
// SEARCH
// ============================================================================

export interface SpotifySearchResults {
  tracks?: {
    items: SpotifyTrack[];
    total: number;
  };
  artists?: {
    items: SpotifyArtist[];
    total: number;
  };
  albums?: {
    items: SpotifyAlbum[];
    total: number;
  };
  playlists?: {
    items: SpotifyPlaylist[];
    total: number;
  };
}

export interface SpotifyTrack {
  id: string;
  name: string;
  uri: string;
  artists: { id: string; name: string }[];
  album: { id: string; name: string; images: { url: string }[] };
  duration_ms: number;
  popularity: number;
}

export interface SpotifyArtist {
  id: string;
  name: string;
  uri: string;
  images: { url: string }[];
  genres: string[];
  popularity: number;
  followers: { total: number };
}

export interface SpotifyAlbum {
  id: string;
  name: string;
  uri: string;
  artists: { id: string; name: string }[];
  images: { url: string }[];
  release_date: string;
  total_tracks: number;
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  uri: string;
  description: string | null;
  images: { url: string }[];
  owner: { id: string; display_name: string };
  tracks: { total: number };
  public: boolean;
}

export async function search(
  accessToken: string,
  query: string,
  types: ('track' | 'artist' | 'album' | 'playlist')[] = ['track'],
  limit: number = 10
): Promise<SpotifySearchResults> {
  const params = new URLSearchParams({
    q: query,
    type: types.join(','),
    limit: limit.toString(),
  });

  return spotifyRequest<SpotifySearchResults>(accessToken, `/search?${params}`);
}

// ============================================================================
// PLAYLISTS
// ============================================================================

export async function getUserPlaylists(accessToken: string, limit: number = 20): Promise<{ items: SpotifyPlaylist[] }> {
  return spotifyRequest(accessToken, `/me/playlists?limit=${limit}`);
}

export async function createPlaylist(
  accessToken: string,
  userId: string,
  name: string,
  options?: { description?: string; public?: boolean }
): Promise<SpotifyPlaylist> {
  return spotifyRequest<SpotifyPlaylist>(accessToken, `/users/${userId}/playlists`, {
    method: 'POST',
    body: JSON.stringify({
      name,
      description: options?.description || '',
      public: options?.public ?? false,
    }),
  });
}

export async function addTracksToPlaylist(
  accessToken: string,
  playlistId: string,
  trackUris: string[]
): Promise<{ snapshot_id: string }> {
  return spotifyRequest(accessToken, `/playlists/${playlistId}/tracks`, {
    method: 'POST',
    body: JSON.stringify({ uris: trackUris }),
  });
}

// ============================================================================
// RECOMMENDATIONS
// ============================================================================

export interface SpotifyRecommendations {
  tracks: SpotifyTrack[];
  seeds: {
    id: string;
    type: string;
    href: string;
  }[];
}

export async function getRecommendations(
  accessToken: string,
  options: {
    seed_artists?: string[];
    seed_tracks?: string[];
    seed_genres?: string[];
    limit?: number;
    target_energy?: number;
    target_valence?: number;
  }
): Promise<SpotifyRecommendations> {
  const params = new URLSearchParams();

  if (options.seed_artists?.length) params.set('seed_artists', options.seed_artists.join(','));
  if (options.seed_tracks?.length) params.set('seed_tracks', options.seed_tracks.join(','));
  if (options.seed_genres?.length) params.set('seed_genres', options.seed_genres.join(','));
  if (options.limit) params.set('limit', options.limit.toString());
  if (options.target_energy !== undefined) params.set('target_energy', options.target_energy.toString());
  if (options.target_valence !== undefined) params.set('target_valence', options.target_valence.toString());

  return spotifyRequest<SpotifyRecommendations>(accessToken, `/recommendations?${params}`);
}

// ============================================================================
// USER'S TOP ITEMS
// ============================================================================

export async function getTopTracks(
  accessToken: string,
  timeRange: 'short_term' | 'medium_term' | 'long_term' = 'medium_term',
  limit: number = 20
): Promise<{ items: SpotifyTrack[] }> {
  return spotifyRequest(accessToken, `/me/top/tracks?time_range=${timeRange}&limit=${limit}`);
}

export async function getTopArtists(
  accessToken: string,
  timeRange: 'short_term' | 'medium_term' | 'long_term' = 'medium_term',
  limit: number = 20
): Promise<{ items: SpotifyArtist[] }> {
  return spotifyRequest(accessToken, `/me/top/artists?time_range=${timeRange}&limit=${limit}`);
}

export async function getRecentlyPlayed(accessToken: string, limit: number = 20): Promise<{
  items: {
    track: SpotifyTrack;
    played_at: string;
  }[];
}> {
  return spotifyRequest(accessToken, `/me/player/recently-played?limit=${limit}`);
}

// ============================================================================
// AVAILABLE GENRES
// ============================================================================

export async function getAvailableGenres(accessToken: string): Promise<{ genres: string[] }> {
  return spotifyRequest(accessToken, '/recommendations/available-genre-seeds');
}
