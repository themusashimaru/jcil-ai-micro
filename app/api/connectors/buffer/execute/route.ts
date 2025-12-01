/**
 * BUFFER ACTION EXECUTION API
 * Execute Buffer social media management API actions
 * POST: Execute a specific Buffer action
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server-auth';
import { getUserConnection } from '@/lib/connectors/helpers';

export const runtime = 'nodejs';

const BUFFER_API = 'https://api.bufferapp.com/1';

interface ExecuteRequest {
  action: string;
  params: Record<string, unknown>;
}

// Helper for Buffer API requests
async function bufferFetch(
  token: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = new URL(`${BUFFER_API}${endpoint}`);
  url.searchParams.append('access_token', token);

  return fetch(url.toString(), {
    ...options,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      ...options.headers,
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const connection = await getUserConnection(user.id, 'buffer');
    if (!connection) {
      return NextResponse.json({ error: 'Buffer not connected' }, { status: 400 });
    }

    const { action, params }: ExecuteRequest = await request.json();

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    const token = connection.token;
    let result: unknown;

    switch (action) {
      case 'get_user': {
        // Get user info
        const response = await bufferFetch(token, '/user.json');
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to get user' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'list_profiles': {
        // List connected social media profiles
        const response = await bufferFetch(token, '/profiles.json');
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to list profiles' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_profile': {
        // Get a specific profile
        const profileId = params.profileId as string;
        if (!profileId) {
          return NextResponse.json({ error: 'profileId is required' }, { status: 400 });
        }
        const response = await bufferFetch(token, `/profiles/${profileId}.json`);
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to get profile' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_schedules': {
        // Get posting schedules for a profile
        const profileId = params.profileId as string;
        if (!profileId) {
          return NextResponse.json({ error: 'profileId is required' }, { status: 400 });
        }
        const response = await bufferFetch(token, `/profiles/${profileId}/schedules.json`);
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to get schedules' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'list_pending_updates': {
        // Get pending updates in queue
        const profileId = params.profileId as string;
        if (!profileId) {
          return NextResponse.json({ error: 'profileId is required' }, { status: 400 });
        }
        const page = params.page || 1;
        const count = params.count || 20;
        const response = await bufferFetch(token, `/profiles/${profileId}/updates/pending.json?page=${page}&count=${count}`);
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to list pending updates' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'list_sent_updates': {
        // Get sent updates
        const profileId = params.profileId as string;
        if (!profileId) {
          return NextResponse.json({ error: 'profileId is required' }, { status: 400 });
        }
        const page = params.page || 1;
        const count = params.count || 20;
        const response = await bufferFetch(token, `/profiles/${profileId}/updates/sent.json?page=${page}&count=${count}`);
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to list sent updates' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'create_update': {
        // Create a new post/update
        const profileIds = params.profileIds as string[];
        const text = params.text as string;
        if (!profileIds || profileIds.length === 0 || !text) {
          return NextResponse.json({ error: 'profileIds and text are required' }, { status: 400 });
        }

        // Build form data
        const formData = new URLSearchParams();
        formData.append('text', text);
        profileIds.forEach(id => formData.append('profile_ids[]', id));

        if (params.media) {
          const media = params.media as { link?: string; photo?: string; thumbnail?: string };
          if (media.link) formData.append('media[link]', media.link);
          if (media.photo) formData.append('media[photo]', media.photo);
          if (media.thumbnail) formData.append('media[thumbnail]', media.thumbnail);
        }

        if (params.scheduledAt) {
          formData.append('scheduled_at', String(params.scheduledAt));
        }

        if (params.now) {
          formData.append('now', 'true');
        }

        const url = new URL(`${BUFFER_API}/updates/create.json`);
        url.searchParams.append('access_token', token);

        const response = await fetch(url.toString(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formData.toString(),
        });

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to create update' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_update': {
        // Get a specific update
        const updateId = params.updateId as string;
        if (!updateId) {
          return NextResponse.json({ error: 'updateId is required' }, { status: 400 });
        }
        const response = await bufferFetch(token, `/updates/${updateId}.json`);
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to get update' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'update_update': {
        // Update an existing post
        const updateId = params.updateId as string;
        const text = params.text as string;
        if (!updateId || !text) {
          return NextResponse.json({ error: 'updateId and text are required' }, { status: 400 });
        }

        const formData = new URLSearchParams();
        formData.append('text', text);

        if (params.media) {
          const media = params.media as { link?: string; photo?: string; thumbnail?: string };
          if (media.link) formData.append('media[link]', media.link);
          if (media.photo) formData.append('media[photo]', media.photo);
          if (media.thumbnail) formData.append('media[thumbnail]', media.thumbnail);
        }

        if (params.scheduledAt) {
          formData.append('scheduled_at', String(params.scheduledAt));
        }

        const url = new URL(`${BUFFER_API}/updates/${updateId}/update.json`);
        url.searchParams.append('access_token', token);

        const response = await fetch(url.toString(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formData.toString(),
        });

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to update' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'delete_update': {
        // Delete an update
        const updateId = params.updateId as string;
        if (!updateId) {
          return NextResponse.json({ error: 'updateId is required' }, { status: 400 });
        }

        const url = new URL(`${BUFFER_API}/updates/${updateId}/destroy.json`);
        url.searchParams.append('access_token', token);

        const response = await fetch(url.toString(), {
          method: 'POST',
        });

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to delete update' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'share_now': {
        // Share an update immediately
        const updateId = params.updateId as string;
        if (!updateId) {
          return NextResponse.json({ error: 'updateId is required' }, { status: 400 });
        }

        const url = new URL(`${BUFFER_API}/updates/${updateId}/share.json`);
        url.searchParams.append('access_token', token);

        const response = await fetch(url.toString(), {
          method: 'POST',
        });

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to share' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'reorder_updates': {
        // Reorder updates in queue
        const profileId = params.profileId as string;
        const order = params.order as string[];
        if (!profileId || !order) {
          return NextResponse.json({ error: 'profileId and order are required' }, { status: 400 });
        }

        const formData = new URLSearchParams();
        order.forEach(id => formData.append('order[]', id));

        const url = new URL(`${BUFFER_API}/profiles/${profileId}/updates/reorder.json`);
        url.searchParams.append('access_token', token);

        const response = await fetch(url.toString(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formData.toString(),
        });

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to reorder' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'shuffle_updates': {
        // Shuffle updates in queue
        const profileId = params.profileId as string;
        if (!profileId) {
          return NextResponse.json({ error: 'profileId is required' }, { status: 400 });
        }

        const url = new URL(`${BUFFER_API}/profiles/${profileId}/updates/shuffle.json`);
        url.searchParams.append('access_token', token);

        const response = await fetch(url.toString(), {
          method: 'POST',
        });

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to shuffle' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('[Buffer Execute API] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
