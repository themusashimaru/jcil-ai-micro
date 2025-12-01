/**
 * RUNWAY ACTION EXECUTION API
 * Execute Runway video generation actions
 * POST: Execute a specific Runway action
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server-auth';
import { getUserConnection } from '@/lib/connectors/helpers';

export const runtime = 'nodejs';

const RUNWAY_API = 'https://api.runwayml.com/v1';

interface ExecuteRequest {
  action: string;
  params: Record<string, unknown>;
}

// Helper for Runway API requests
async function runwayFetch(
  token: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(`${RUNWAY_API}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Runway-Version': '2024-11-06',
      ...options.headers,
    },
  });
}

// Poll for task completion
async function pollForResult(token: string, taskId: string, maxAttempts = 120): Promise<unknown> {
  for (let i = 0; i < maxAttempts; i++) {
    const response = await runwayFetch(token, `/tasks/${taskId}`);
    const data = await response.json();

    if (data.status === 'SUCCEEDED') {
      return data;
    } else if (data.status === 'FAILED') {
      throw new Error(data.failure || 'Generation failed');
    }

    // Wait 2 seconds before polling again (video takes longer)
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

    const connection = await getUserConnection(user.id, 'runway');
    if (!connection) {
      return NextResponse.json({ error: 'Runway not connected' }, { status: 400 });
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
        // Gen-3 Alpha text-to-video
        const response = await runwayFetch(token, '/image_to_video', {
          method: 'POST',
          body: JSON.stringify({
            model: 'gen3a_turbo',
            promptText: params.prompt,
            duration: params.duration || 5,
            ratio: params.ratio || '16:9',
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.error || 'Failed to start generation' }, { status: response.status });
        }

        const task = await response.json();

        // If user wants to wait for result
        if (params.wait !== false) {
          result = await pollForResult(token, task.id);
        } else {
          result = { taskId: task.id, status: 'PENDING', message: 'Video generation started. Use get_task to check status.' };
        }
        break;
      }

      case 'image_to_video': {
        // Gen-3 Alpha image-to-video
        const response = await runwayFetch(token, '/image_to_video', {
          method: 'POST',
          body: JSON.stringify({
            model: 'gen3a_turbo',
            promptImage: params.image_url,
            promptText: params.prompt || '',
            duration: params.duration || 5,
            ratio: params.ratio || '16:9',
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.error || 'Failed to start generation' }, { status: response.status });
        }

        const task = await response.json();

        if (params.wait !== false) {
          result = await pollForResult(token, task.id);
        } else {
          result = { taskId: task.id, status: 'PENDING', message: 'Video generation started. Use get_task to check status.' };
        }
        break;
      }

      case 'get_task': {
        // Get status of a video generation task
        const response = await runwayFetch(token, `/tasks/${params.taskId}`);
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.error || 'Failed to get task' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'cancel_task': {
        // Cancel a running task
        const response = await runwayFetch(token, `/tasks/${params.taskId}/cancel`, {
          method: 'POST',
        });
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.error || 'Failed to cancel task' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('[Runway Execute API] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
