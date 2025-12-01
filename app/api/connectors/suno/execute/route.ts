/**
 * SUNO ACTION EXECUTION API
 * Execute Suno music generation actions
 * POST: Execute a specific Suno action
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server-auth';
import { getUserConnection } from '@/lib/connectors/helpers';

export const runtime = 'nodejs';

const SUNO_API = 'https://studio-api.suno.ai/api';

interface ExecuteRequest {
  action: string;
  params: Record<string, unknown>;
}

// Helper for Suno API requests
async function sunoFetch(
  token: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(`${SUNO_API}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
}

// Poll for song completion
async function pollForResult(token: string, clipIds: string[], maxAttempts = 120): Promise<unknown> {
  for (let i = 0; i < maxAttempts; i++) {
    const response = await sunoFetch(token, `/feed/?ids=${clipIds.join(',')}`);
    const data = await response.json();

    const allComplete = data.every((clip: { status: string }) =>
      clip.status === 'complete' || clip.status === 'error'
    );

    if (allComplete) {
      return data;
    }

    // Wait 3 seconds before polling again (music takes a while)
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  throw new Error('Generation timed out - song may still be processing');
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const connection = await getUserConnection(user.id, 'suno');
    if (!connection) {
      return NextResponse.json({ error: 'Suno not connected' }, { status: 400 });
    }

    const { action, params }: ExecuteRequest = await request.json();

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    const token = connection.token;
    let result: unknown;

    switch (action) {
      case 'generate_song':
      case 'create_song': {
        // Generate a song with custom lyrics
        const response = await sunoFetch(token, '/generate/v2/', {
          method: 'POST',
          body: JSON.stringify({
            prompt: params.lyrics || params.prompt,
            tags: params.style || params.tags || 'pop, upbeat',
            title: params.title || '',
            make_instrumental: params.instrumental || false,
            mv: 'chirp-v3-5', // Latest model
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.detail || 'Failed to start generation' }, { status: response.status });
        }

        const data = await response.json();
        const clipIds = data.clips?.map((c: { id: string }) => c.id) || [];

        if (params.wait !== false && clipIds.length > 0) {
          result = await pollForResult(token, clipIds);
        } else {
          result = { clips: data.clips, message: 'Song generation started. Use get_song to check status.' };
        }
        break;
      }

      case 'generate_from_description': {
        // Generate a song from a text description (AI writes lyrics)
        const response = await sunoFetch(token, '/generate/description-mode', {
          method: 'POST',
          body: JSON.stringify({
            gpt_description_prompt: params.description || params.prompt,
            make_instrumental: params.instrumental || false,
            mv: 'chirp-v3-5',
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.detail || 'Failed to start generation' }, { status: response.status });
        }

        const data = await response.json();
        const clipIds = data.clips?.map((c: { id: string }) => c.id) || [];

        if (params.wait !== false && clipIds.length > 0) {
          result = await pollForResult(token, clipIds);
        } else {
          result = { clips: data.clips, message: 'Song generation started. Use get_song to check status.' };
        }
        break;
      }

      case 'extend_song': {
        // Continue/extend an existing song
        const response = await sunoFetch(token, '/generate/v2/', {
          method: 'POST',
          body: JSON.stringify({
            prompt: params.lyrics || params.prompt || '',
            tags: params.style || params.tags || '',
            continue_clip_id: params.clip_id,
            continue_at: params.continue_at || null,
            mv: 'chirp-v3-5',
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.detail || 'Failed to extend song' }, { status: response.status });
        }

        const data = await response.json();
        const clipIds = data.clips?.map((c: { id: string }) => c.id) || [];

        if (params.wait !== false && clipIds.length > 0) {
          result = await pollForResult(token, clipIds);
        } else {
          result = { clips: data.clips, message: 'Song extension started. Use get_song to check status.' };
        }
        break;
      }

      case 'get_song':
      case 'get_clip': {
        // Get song/clip details
        const ids = Array.isArray(params.clipIds) ? params.clipIds : [params.clipId || params.id];
        const response = await sunoFetch(token, `/feed/?ids=${ids.join(',')}`);
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.detail || 'Failed to get song' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'list_songs': {
        // List user's songs
        const response = await sunoFetch(token, '/feed/');
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.detail || 'Failed to list songs' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_credits': {
        // Get credit balance
        const response = await sunoFetch(token, '/billing/info/');
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.detail || 'Failed to get credits' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('[Suno Execute API] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
