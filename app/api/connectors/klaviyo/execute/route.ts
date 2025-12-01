/**
 * KLAVIYO ACTION EXECUTION API
 * Execute Klaviyo email marketing API actions
 * POST: Execute a specific Klaviyo action
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server-auth';
import { getUserConnection } from '@/lib/connectors/helpers';

export const runtime = 'nodejs';

const KLAVIYO_API = 'https://a.klaviyo.com/api';

interface ExecuteRequest {
  action: string;
  params: Record<string, unknown>;
}

// Helper for Klaviyo API requests
async function klaviyoFetch(
  token: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(`${KLAVIYO_API}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Klaviyo-API-Key ${token}`,
      'Content-Type': 'application/json',
      revision: '2024-02-15',
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

    const connection = await getUserConnection(user.id, 'klaviyo');
    if (!connection) {
      return NextResponse.json({ error: 'Klaviyo not connected' }, { status: 400 });
    }

    const { action, params }: ExecuteRequest = await request.json();

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    const token = connection.token;
    let result: unknown;

    switch (action) {
      case 'list_profiles':
      case 'get_profiles': {
        // List all profiles (subscribers)
        const pageSize = params.pageSize || 20;
        const response = await klaviyoFetch(token, `/profiles/?page[size]=${pageSize}`);
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.errors?.[0]?.detail || 'Failed to list profiles' }, { status: response.status });
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
        const response = await klaviyoFetch(token, `/profiles/${profileId}/`);
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.errors?.[0]?.detail || 'Failed to get profile' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'create_profile': {
        // Create a new profile
        const response = await klaviyoFetch(token, '/profiles/', {
          method: 'POST',
          body: JSON.stringify({
            data: {
              type: 'profile',
              attributes: {
                email: params.email,
                phone_number: params.phone,
                first_name: params.firstName,
                last_name: params.lastName,
                properties: params.properties || {},
              },
            },
          }),
        });
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.errors?.[0]?.detail || 'Failed to create profile' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'update_profile': {
        // Update a profile
        const profileId = params.profileId as string;
        if (!profileId) {
          return NextResponse.json({ error: 'profileId is required' }, { status: 400 });
        }
        const response = await klaviyoFetch(token, `/profiles/${profileId}/`, {
          method: 'PATCH',
          body: JSON.stringify({
            data: {
              type: 'profile',
              id: profileId,
              attributes: {
                email: params.email,
                phone_number: params.phone,
                first_name: params.firstName,
                last_name: params.lastName,
                properties: params.properties,
              },
            },
          }),
        });
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.errors?.[0]?.detail || 'Failed to update profile' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'list_lists': {
        // List all lists
        const response = await klaviyoFetch(token, '/lists/');
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.errors?.[0]?.detail || 'Failed to list lists' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_list': {
        // Get a specific list
        const listId = params.listId as string;
        if (!listId) {
          return NextResponse.json({ error: 'listId is required' }, { status: 400 });
        }
        const response = await klaviyoFetch(token, `/lists/${listId}/`);
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.errors?.[0]?.detail || 'Failed to get list' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'add_to_list': {
        // Add profiles to a list
        const listId = params.listId as string;
        const profiles = params.profiles as Array<{ email?: string; phone?: string }>;
        if (!listId || !profiles) {
          return NextResponse.json({ error: 'listId and profiles are required' }, { status: 400 });
        }
        const response = await klaviyoFetch(token, `/lists/${listId}/relationships/profiles/`, {
          method: 'POST',
          body: JSON.stringify({
            data: profiles.map(p => ({
              type: 'profile',
              attributes: {
                email: p.email,
                phone_number: p.phone,
              },
            })),
          }),
        });
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.errors?.[0]?.detail || 'Failed to add to list' }, { status: response.status });
        }
        result = { success: true, message: 'Profiles added to list' };
        break;
      }

      case 'list_campaigns': {
        // List all campaigns
        const response = await klaviyoFetch(token, '/campaigns/');
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.errors?.[0]?.detail || 'Failed to list campaigns' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_campaign': {
        // Get a specific campaign
        const campaignId = params.campaignId as string;
        if (!campaignId) {
          return NextResponse.json({ error: 'campaignId is required' }, { status: 400 });
        }
        const response = await klaviyoFetch(token, `/campaigns/${campaignId}/`);
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.errors?.[0]?.detail || 'Failed to get campaign' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'list_flows': {
        // List all flows (automations)
        const response = await klaviyoFetch(token, '/flows/');
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.errors?.[0]?.detail || 'Failed to list flows' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_metrics': {
        // List metrics (events)
        const response = await klaviyoFetch(token, '/metrics/');
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.errors?.[0]?.detail || 'Failed to list metrics' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'track_event': {
        // Track a custom event
        const response = await klaviyoFetch(token, '/events/', {
          method: 'POST',
          body: JSON.stringify({
            data: {
              type: 'event',
              attributes: {
                metric: {
                  data: {
                    type: 'metric',
                    attributes: { name: params.eventName },
                  },
                },
                profile: {
                  data: {
                    type: 'profile',
                    attributes: { email: params.email },
                  },
                },
                properties: params.properties || {},
                time: params.time || new Date().toISOString(),
              },
            },
          }),
        });
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.errors?.[0]?.detail || 'Failed to track event' }, { status: response.status });
        }
        result = { success: true, message: 'Event tracked' };
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('[Klaviyo Execute API] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
