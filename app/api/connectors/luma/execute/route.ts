/**
 * LUMA AI (DREAM MACHINE) ACTION EXECUTION API
 * Execute Luma video generation actions
 * POST: Execute a specific Luma action
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server-auth';
import { getUserConnection } from '@/lib/connectors/helpers';

export const runtime = 'nodejs';

const LUMA_API = 'https://api.lumalabs.ai/dream-machine/v1';

interface ExecuteRequest {
  action: string;
  params: Record<string, unknown>;
}

// Helper for Luma API requests
async function lumaFetch(
  token: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(`${LUMA_API}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
}

// Poll for generation completion
async function pollForResult(token: string, generationId: string, maxAttempts = 120): Promise<unknown> {
  for (let i = 0; i < maxAttempts; i++) {
    const response = await lumaFetch(token, `/generations/${generationId}`);
    const data = await response.json();

    if (data.state === 'completed') {
      return data;
    } else if (data.state === 'failed') {
      throw new Error(data.failure_reason || 'Generation failed');
    }

    // Wait 2 seconds before polling again
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  throw new Error('Generation timed out - video may still be processing');
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const connection = await getUserConnection(user.id, 'luma');
    if (!connection) {
      return NextResponse.json({ error: 'Luma AI not connected' }, { status: 400 });
    }

    const { action, params }: ExecuteRequest = await request.json();

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    const token = connection.token;
    let result: unknown;

    switch (action) {
      case 'generate_video':
      case 'text_to_video': {
        // Dream Machine text-to-video
        const response = await lumaFetch(token, '/generations', {
          method: 'POST',
          body: JSON.stringify({
            prompt: params.prompt,
            aspect_ratio: params.aspect_ratio || '16:9',
            loop: params.loop || false,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.detail || 'Failed to start generation' }, { status: response.status });
        }

        const generation = await response.json();

        if (params.wait !== false) {
          result = await pollForResult(token, generation.id);
        } else {
          result = { generationId: generation.id, state: 'pending', message: 'Video generation started. Use get_generation to check status.' };
        }
        break;
      }

      case 'image_to_video': {
        // Dream Machine image-to-video
        const keyframes: Record<string, unknown> = {};

        if (params.image_url) {
          keyframes.frame0 = { type: 'image', url: params.image_url };
        }
        if (params.end_image_url) {
          keyframes.frame1 = { type: 'image', url: params.end_image_url };
        }

        const response = await lumaFetch(token, '/generations', {
          method: 'POST',
          body: JSON.stringify({
            prompt: params.prompt || '',
            keyframes,
            aspect_ratio: params.aspect_ratio || '16:9',
            loop: params.loop || false,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.detail || 'Failed to start generation' }, { status: response.status });
        }

        const generation = await response.json();

        if (params.wait !== false) {
          result = await pollForResult(token, generation.id);
        } else {
          result = { generationId: generation.id, state: 'pending', message: 'Video generation started. Use get_generation to check status.' };
        }
        break;
      }

      case 'extend_video': {
        // Extend an existing video
        const response = await lumaFetch(token, '/generations', {
          method: 'POST',
          body: JSON.stringify({
            prompt: params.prompt || '',
            keyframes: {
              frame0: { type: 'generation', id: params.generation_id },
            },
            aspect_ratio: params.aspect_ratio || '16:9',
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.detail || 'Failed to extend video' }, { status: response.status });
        }

        const generation = await response.json();

        if (params.wait !== false) {
          result = await pollForResult(token, generation.id);
        } else {
          result = { generationId: generation.id, state: 'pending', message: 'Video extension started. Use get_generation to check status.' };
        }
        break;
      }

      case 'get_generation': {
        // Get status of a generation
        const response = await lumaFetch(token, `/generations/${params.generationId}`);
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.detail || 'Failed to get generation' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'list_generations': {
        // List user's generations
        const limit = params.limit || 10;
        const offset = params.offset || 0;
        const response = await lumaFetch(token, `/generations?limit=${limit}&offset=${offset}`);
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.detail || 'Failed to list generations' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'delete_generation': {
        // Delete a generation
        const response = await lumaFetch(token, `/generations/${params.generationId}`, {
          method: 'DELETE',
        });
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.detail || 'Failed to delete generation' }, { status: response.status });
        }
        result = { success: true, message: 'Generation deleted' };
        break;
      }

      case 'get_credits': {
        // Get credit balance
        const response = await lumaFetch(token, '/credits');
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
    console.error('[Luma Execute API] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
