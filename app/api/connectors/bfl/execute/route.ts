/**
 * BLACK FOREST LABS (FLUX) ACTION EXECUTION API
 * Execute Flux image generation actions
 * POST: Execute a specific BFL action
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server-auth';
import { getUserConnection } from '@/lib/connectors/helpers';

export const runtime = 'nodejs';

const BFL_API = 'https://api.bfl.ml/v1';

interface ExecuteRequest {
  action: string;
  params: Record<string, unknown>;
}

// Helper for BFL API requests
async function bflFetch(
  token: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(`${BFL_API}${endpoint}`, {
    ...options,
    headers: {
      'X-Key': token,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
}

// Poll for result (BFL uses async generation)
async function pollForResult(token: string, taskId: string, maxAttempts = 60): Promise<unknown> {
  for (let i = 0; i < maxAttempts; i++) {
    const response = await bflFetch(token, `/get_result?id=${taskId}`);
    const data = await response.json();

    if (data.status === 'Ready') {
      return data.result;
    } else if (data.status === 'Error') {
      throw new Error(data.error || 'Generation failed');
    }

    // Wait 1 second before polling again
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  throw new Error('Generation timed out');
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const connection = await getUserConnection(user.id, 'bfl');
    if (!connection) {
      return NextResponse.json({ error: 'Black Forest Labs not connected' }, { status: 400 });
    }

    const { action, params }: ExecuteRequest = await request.json();

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    const token = connection.token;
    let result: unknown;

    switch (action) {
      case 'generate_image':
      case 'flux_pro': {
        // Flux Pro 1.1 - highest quality
        const response = await bflFetch(token, '/flux-pro-1.1', {
          method: 'POST',
          body: JSON.stringify({
            prompt: params.prompt,
            width: params.width || 1024,
            height: params.height || 1024,
            safety_tolerance: params.safety_tolerance || 2,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to start generation' }, { status: response.status });
        }

        const task = await response.json();
        result = await pollForResult(token, task.id);
        break;
      }

      case 'flux_dev': {
        // Flux Dev - good quality, faster
        const response = await bflFetch(token, '/flux-dev', {
          method: 'POST',
          body: JSON.stringify({
            prompt: params.prompt,
            width: params.width || 1024,
            height: params.height || 1024,
            safety_tolerance: params.safety_tolerance || 2,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to start generation' }, { status: response.status });
        }

        const task = await response.json();
        result = await pollForResult(token, task.id);
        break;
      }

      case 'flux_schnell': {
        // Flux Schnell - fastest, good for iterations
        const response = await bflFetch(token, '/flux-pro-1.1', {
          method: 'POST',
          body: JSON.stringify({
            prompt: params.prompt,
            width: params.width || 1024,
            height: params.height || 1024,
            steps: 4, // Schnell uses fewer steps
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to start generation' }, { status: response.status });
        }

        const task = await response.json();
        result = await pollForResult(token, task.id);
        break;
      }

      case 'image_to_image': {
        // Image-to-image with Flux
        const response = await bflFetch(token, '/flux-pro-1.1-redux', {
          method: 'POST',
          body: JSON.stringify({
            prompt: params.prompt,
            image_url: params.image_url,
            strength: params.strength || 0.75,
            width: params.width || 1024,
            height: params.height || 1024,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to start generation' }, { status: response.status });
        }

        const task = await response.json();
        result = await pollForResult(token, task.id);
        break;
      }

      case 'inpaint': {
        // Inpainting with Flux
        const response = await bflFetch(token, '/flux-pro-1.1-fill', {
          method: 'POST',
          body: JSON.stringify({
            prompt: params.prompt,
            image_url: params.image_url,
            mask_url: params.mask_url,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to start generation' }, { status: response.status });
        }

        const task = await response.json();
        result = await pollForResult(token, task.id);
        break;
      }

      case 'get_task': {
        // Get status of a generation task
        const response = await bflFetch(token, `/get_result?id=${params.taskId}`);
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to get task' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('[BFL Execute API] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
