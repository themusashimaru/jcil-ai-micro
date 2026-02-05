/**
 * SPOTIFY TOOL
 * ============
 *
 * AI tool for controlling Spotify playback, creating playlists,
 * and getting music recommendations.
 */

import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { decrypt as decryptToken, encrypt as encryptToken } from '@/lib/security/crypto';
import {
  search,
  play,
  pause,
  skipToNext,
  skipToPrevious,
  getPlaybackState,
  getUserPlaylists,
  createPlaylist,
  addTracksToPlaylist,
  getRecommendations,
  getTopTracks,
  getTopArtists,
  getRecentlyPlayed,
  getCurrentUser,
  refreshAccessToken,
  isSpotifyConfigured,
} from '@/lib/connectors/spotify';
import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '@/lib/ai/providers/types';

const log = logger('SpotifyTool');

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const spotifyTool: UnifiedTool = {
  name: 'spotify',
  description: `Control Spotify music playback and manage playlists. Use this tool when the user wants to:
- Play music, pause, skip tracks
- Search for songs, artists, or albums
- Create playlists
- Get music recommendations
- See what's currently playing
- View their top tracks or artists

IMPORTANT: This tool requires the user to have connected their Spotify account in Settings > Connectors.`,
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: [
          'search',
          'play',
          'pause',
          'next',
          'previous',
          'now_playing',
          'create_playlist',
          'get_playlists',
          'recommend',
          'top_tracks',
          'top_artists',
          'recently_played',
        ],
        description: 'The action to perform',
      },
      query: {
        type: 'string',
        description: 'Search query (for search action) or playlist name (for create_playlist)',
      },
      type: {
        type: 'string',
        enum: ['track', 'artist', 'album', 'playlist'],
        description: 'Type of search (default: track)',
      },
      track_uris: {
        type: 'array',
        items: { type: 'string' },
        description: 'Spotify track URIs to play or add to playlist',
      },
      playlist_id: {
        type: 'string',
        description: 'Playlist ID for adding tracks',
      },
      playlist_description: {
        type: 'string',
        description: 'Description for new playlist',
      },
      mood: {
        type: 'string',
        enum: ['happy', 'sad', 'energetic', 'chill', 'focus', 'party'],
        description: 'Mood for recommendations',
      },
      limit: {
        type: 'number',
        description: 'Number of results to return (default: 10)',
      },
    },
    required: ['action'],
  },
};

// ============================================================================
// TOOL EXECUTION
// ============================================================================

interface SpotifyToolArgs {
  action: string;
  query?: string;
  type?: 'track' | 'artist' | 'album' | 'playlist';
  track_uris?: string[];
  playlist_id?: string;
  playlist_description?: string;
  mood?: 'happy' | 'sad' | 'energetic' | 'chill' | 'focus' | 'party';
  limit?: number;
}

/**
 * Get a valid Spotify access token for a user, refreshing if needed
 */
async function getValidAccessToken(userId: string): Promise<string | null> {
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: userData, error } = await adminClient
    .from('users')
    .select('spotify_access_token, spotify_refresh_token, spotify_token_expires_at')
    .eq('id', userId)
    .single();

  if (error || !userData?.spotify_access_token || !userData?.spotify_refresh_token) {
    return null;
  }

  let accessToken: string;
  let refreshToken: string;

  try {
    accessToken = decryptToken(userData.spotify_access_token);
    refreshToken = decryptToken(userData.spotify_refresh_token);
  } catch {
    return null;
  }

  // Check if token needs refresh
  const expiresAt = new Date(userData.spotify_token_expires_at);
  const now = new Date();

  if (now >= expiresAt || (expiresAt.getTime() - now.getTime()) < 5 * 60 * 1000) {
    try {
      const newTokens = await refreshAccessToken(refreshToken);
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
        .eq('id', userId);

      return newTokens.access_token;
    } catch (err) {
      log.error('Token refresh failed', { error: err });
      return null;
    }
  }

  return accessToken;
}

/**
 * Map mood to Spotify audio features
 */
function getMoodFeatures(mood: string): { target_energy?: number; target_valence?: number } {
  const moodMap: Record<string, { target_energy: number; target_valence: number }> = {
    happy: { target_energy: 0.7, target_valence: 0.8 },
    sad: { target_energy: 0.3, target_valence: 0.2 },
    energetic: { target_energy: 0.9, target_valence: 0.7 },
    chill: { target_energy: 0.3, target_valence: 0.5 },
    focus: { target_energy: 0.5, target_valence: 0.4 },
    party: { target_energy: 0.9, target_valence: 0.9 },
  };
  return moodMap[mood] || {};
}

export async function executeSpotify(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = (typeof toolCall.arguments === 'string'
    ? JSON.parse(toolCall.arguments)
    : toolCall.arguments) as SpotifyToolArgs;

  // Check if Spotify is configured
  if (!isSpotifyConfigured()) {
    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({
        error: 'Spotify integration is not configured on this server.',
        suggestion: 'Please contact the administrator to set up Spotify integration.',
      }),
      isError: true,
    };
  }

  // Get user ID from session (passed via toolCall.sessionId or similar)
  const userId = toolCall.sessionId;
  if (!userId) {
    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({
        error: 'Could not identify user session.',
        suggestion: 'Please try again or refresh the page.',
      }),
      isError: true,
    };
  }

  // Get valid access token
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) {
    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({
        error: 'Spotify is not connected.',
        suggestion: 'Please connect your Spotify account in Settings > Connectors.',
        action_required: 'connect_spotify',
      }),
      isError: true,
    };
  }

  const limit = args.limit || 10;

  try {
    switch (args.action) {
      case 'search': {
        if (!args.query) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: 'Search query is required' }),
            isError: true,
          };
        }
        const searchType = args.type || 'track';
        const results = await search(accessToken, args.query, [searchType], limit);

        // Format results based on type
        let formatted;
        if (searchType === 'track' && results.tracks) {
          formatted = results.tracks.items.map((t) => ({
            name: t.name,
            artist: t.artists.map((a) => a.name).join(', '),
            album: t.album.name,
            uri: t.uri,
            duration: `${Math.floor(t.duration_ms / 60000)}:${String(Math.floor((t.duration_ms % 60000) / 1000)).padStart(2, '0')}`,
          }));
        } else if (searchType === 'artist' && results.artists) {
          formatted = results.artists.items.map((a) => ({
            name: a.name,
            genres: a.genres.slice(0, 3).join(', '),
            followers: a.followers.total,
            uri: a.uri,
          }));
        } else {
          formatted = results;
        }

        return {
          toolCallId: toolCall.id,
          content: JSON.stringify({ results: formatted, type: searchType }),
        };
      }

      case 'play': {
        if (args.track_uris?.length) {
          await play(accessToken, { uris: args.track_uris });
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ success: true, message: 'Now playing the requested tracks.' }),
          };
        }
        await play(accessToken);
        return {
          toolCallId: toolCall.id,
          content: JSON.stringify({ success: true, message: 'Playback resumed.' }),
        };
      }

      case 'pause': {
        await pause(accessToken);
        return {
          toolCallId: toolCall.id,
          content: JSON.stringify({ success: true, message: 'Playback paused.' }),
        };
      }

      case 'next': {
        await skipToNext(accessToken);
        return {
          toolCallId: toolCall.id,
          content: JSON.stringify({ success: true, message: 'Skipped to next track.' }),
        };
      }

      case 'previous': {
        await skipToPrevious(accessToken);
        return {
          toolCallId: toolCall.id,
          content: JSON.stringify({ success: true, message: 'Went to previous track.' }),
        };
      }

      case 'now_playing': {
        const state = await getPlaybackState(accessToken);
        if (!state || !state.item) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ playing: false, message: 'Nothing is currently playing.' }),
          };
        }
        return {
          toolCallId: toolCall.id,
          content: JSON.stringify({
            playing: state.is_playing,
            track: state.item.name,
            artist: state.item.artists.map((a) => a.name).join(', '),
            album: state.item.album.name,
            progress: `${Math.floor(state.progress_ms / 60000)}:${String(Math.floor((state.progress_ms % 60000) / 1000)).padStart(2, '0')}`,
            duration: `${Math.floor(state.item.duration_ms / 60000)}:${String(Math.floor((state.item.duration_ms % 60000) / 1000)).padStart(2, '0')}`,
            device: state.device.name,
          }),
        };
      }

      case 'get_playlists': {
        const playlists = await getUserPlaylists(accessToken, limit);
        return {
          toolCallId: toolCall.id,
          content: JSON.stringify({
            playlists: playlists.items.map((p) => ({
              name: p.name,
              id: p.id,
              tracks: p.tracks.total,
              public: p.public,
            })),
          }),
        };
      }

      case 'create_playlist': {
        if (!args.query) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: 'Playlist name is required' }),
            isError: true,
          };
        }
        const user = await getCurrentUser(accessToken);
        const playlist = await createPlaylist(accessToken, user.id, args.query, {
          description: args.playlist_description,
          public: false,
        });

        // If track URIs provided, add them
        if (args.track_uris?.length) {
          await addTracksToPlaylist(accessToken, playlist.id, args.track_uris);
        }

        return {
          toolCallId: toolCall.id,
          content: JSON.stringify({
            success: true,
            playlist: {
              name: playlist.name,
              id: playlist.id,
              url: `https://open.spotify.com/playlist/${playlist.id}`,
              tracks_added: args.track_uris?.length || 0,
            },
          }),
        };
      }

      case 'recommend': {
        const moodFeatures = args.mood ? getMoodFeatures(args.mood) : {};

        // Get user's top artists for seeds
        const topArtists = await getTopArtists(accessToken, 'medium_term', 3);
        const seedArtists = topArtists.items.slice(0, 2).map((a) => a.id);

        const recommendations = await getRecommendations(accessToken, {
          seed_artists: seedArtists,
          limit,
          ...moodFeatures,
        });

        return {
          toolCallId: toolCall.id,
          content: JSON.stringify({
            mood: args.mood,
            recommendations: recommendations.tracks.map((t) => ({
              name: t.name,
              artist: t.artists.map((a) => a.name).join(', '),
              uri: t.uri,
            })),
          }),
        };
      }

      case 'top_tracks': {
        const tracks = await getTopTracks(accessToken, 'medium_term', limit);
        return {
          toolCallId: toolCall.id,
          content: JSON.stringify({
            top_tracks: tracks.items.map((t, i) => ({
              rank: i + 1,
              name: t.name,
              artist: t.artists.map((a) => a.name).join(', '),
              uri: t.uri,
            })),
          }),
        };
      }

      case 'top_artists': {
        const artists = await getTopArtists(accessToken, 'medium_term', limit);
        return {
          toolCallId: toolCall.id,
          content: JSON.stringify({
            top_artists: artists.items.map((a, i) => ({
              rank: i + 1,
              name: a.name,
              genres: a.genres.slice(0, 3).join(', '),
              uri: a.uri,
            })),
          }),
        };
      }

      case 'recently_played': {
        const recent = await getRecentlyPlayed(accessToken, limit);
        return {
          toolCallId: toolCall.id,
          content: JSON.stringify({
            recently_played: recent.items.map((item) => ({
              name: item.track.name,
              artist: item.track.artists.map((a) => a.name).join(', '),
              played_at: item.played_at,
              uri: item.track.uri,
            })),
          }),
        };
      }

      default:
        return {
          toolCallId: toolCall.id,
          content: JSON.stringify({ error: `Unknown action: ${args.action}` }),
          isError: true,
        };
    }
  } catch (error) {
    log.error('Spotify tool error', { action: args.action, error });

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Check for common errors
    if (errorMessage.includes('NO_ACTIVE_DEVICE') || errorMessage.includes('404')) {
      return {
        toolCallId: toolCall.id,
        content: JSON.stringify({
          error: 'No active Spotify device found.',
          suggestion: 'Please open Spotify on your phone, computer, or speaker and try again.',
        }),
        isError: true,
      };
    }

    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({ error: errorMessage }),
      isError: true,
    };
  }
}

/**
 * Check if Spotify tool is available
 */
export function isSpotifyToolAvailable(): boolean {
  return isSpotifyConfigured();
}
