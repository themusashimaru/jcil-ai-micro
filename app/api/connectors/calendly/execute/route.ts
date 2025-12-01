/**
 * CALENDLY ACTION EXECUTION API
 * Execute Calendly scheduling API actions
 * POST: Execute a specific Calendly action
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server-auth';
import { getUserConnection } from '@/lib/connectors/helpers';

export const runtime = 'nodejs';

const CALENDLY_API = 'https://api.calendly.com';

interface ExecuteRequest {
  action: string;
  params: Record<string, unknown>;
}

// Helper for Calendly API requests
async function calendlyFetch(
  token: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(`${CALENDLY_API}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
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

    const connection = await getUserConnection(user.id, 'calendly');
    if (!connection) {
      return NextResponse.json({ error: 'Calendly not connected' }, { status: 400 });
    }

    const { action, params }: ExecuteRequest = await request.json();

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    const token = connection.token;
    let result: unknown;

    switch (action) {
      case 'get_current_user': {
        // Get current user info
        const response = await calendlyFetch(token, '/users/me');
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to get user' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_user': {
        // Get a specific user
        const userUri = params.userUri as string;
        if (!userUri) {
          return NextResponse.json({ error: 'userUri is required' }, { status: 400 });
        }
        // Extract UUID from URI
        const uuid = userUri.split('/').pop();
        const response = await calendlyFetch(token, `/users/${uuid}`);
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to get user' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'list_event_types': {
        // List event types
        const userUri = params.userUri as string;
        const organizationUri = params.organizationUri as string;
        if (!userUri && !organizationUri) {
          return NextResponse.json({ error: 'userUri or organizationUri is required' }, { status: 400 });
        }
        let endpoint = '/event_types?';
        if (userUri) endpoint += `user=${encodeURIComponent(userUri)}`;
        if (organizationUri) endpoint += `organization=${encodeURIComponent(organizationUri)}`;
        if (params.active !== undefined) endpoint += `&active=${params.active}`;
        if (params.count) endpoint += `&count=${params.count}`;

        const response = await calendlyFetch(token, endpoint);
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to list event types' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_event_type': {
        // Get a specific event type
        const eventTypeUri = params.eventTypeUri as string;
        if (!eventTypeUri) {
          return NextResponse.json({ error: 'eventTypeUri is required' }, { status: 400 });
        }
        const uuid = eventTypeUri.split('/').pop();
        const response = await calendlyFetch(token, `/event_types/${uuid}`);
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to get event type' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'list_scheduled_events': {
        // List scheduled events
        const userUri = params.userUri as string;
        const organizationUri = params.organizationUri as string;
        if (!userUri && !organizationUri) {
          return NextResponse.json({ error: 'userUri or organizationUri is required' }, { status: 400 });
        }
        let endpoint = '/scheduled_events?';
        if (userUri) endpoint += `user=${encodeURIComponent(userUri)}`;
        if (organizationUri) endpoint += `organization=${encodeURIComponent(organizationUri)}`;
        if (params.minStartTime) endpoint += `&min_start_time=${params.minStartTime}`;
        if (params.maxStartTime) endpoint += `&max_start_time=${params.maxStartTime}`;
        if (params.status) endpoint += `&status=${params.status}`;
        if (params.count) endpoint += `&count=${params.count}`;

        const response = await calendlyFetch(token, endpoint);
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to list events' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_scheduled_event': {
        // Get a specific scheduled event
        const eventUri = params.eventUri as string;
        if (!eventUri) {
          return NextResponse.json({ error: 'eventUri is required' }, { status: 400 });
        }
        const uuid = eventUri.split('/').pop();
        const response = await calendlyFetch(token, `/scheduled_events/${uuid}`);
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to get event' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'list_event_invitees': {
        // List invitees for an event
        const eventUri = params.eventUri as string;
        if (!eventUri) {
          return NextResponse.json({ error: 'eventUri is required' }, { status: 400 });
        }
        const uuid = eventUri.split('/').pop();
        let endpoint = `/scheduled_events/${uuid}/invitees`;
        if (params.count) endpoint += `?count=${params.count}`;
        if (params.status) endpoint += `${params.count ? '&' : '?'}status=${params.status}`;

        const response = await calendlyFetch(token, endpoint);
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to list invitees' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_invitee': {
        // Get a specific invitee
        const inviteeUri = params.inviteeUri as string;
        if (!inviteeUri) {
          return NextResponse.json({ error: 'inviteeUri is required' }, { status: 400 });
        }
        // URI format: https://api.calendly.com/scheduled_events/{event_uuid}/invitees/{invitee_uuid}
        const parts = inviteeUri.split('/');
        const inviteeUuid = parts.pop();
        const eventUuid = parts[parts.length - 2];

        const response = await calendlyFetch(token, `/scheduled_events/${eventUuid}/invitees/${inviteeUuid}`);
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to get invitee' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'cancel_event': {
        // Cancel a scheduled event
        const eventUri = params.eventUri as string;
        const reason = params.reason as string;
        if (!eventUri) {
          return NextResponse.json({ error: 'eventUri is required' }, { status: 400 });
        }
        const uuid = eventUri.split('/').pop();
        const response = await calendlyFetch(token, `/scheduled_events/${uuid}/cancellation`, {
          method: 'POST',
          body: JSON.stringify({
            reason: reason || 'Cancelled via API',
          }),
        });
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to cancel event' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'list_organization_memberships': {
        // List organization memberships
        const userUri = params.userUri as string;
        const organizationUri = params.organizationUri as string;
        let endpoint = '/organization_memberships?';
        if (userUri) endpoint += `user=${encodeURIComponent(userUri)}`;
        if (organizationUri) endpoint += `${userUri ? '&' : ''}organization=${encodeURIComponent(organizationUri)}`;

        const response = await calendlyFetch(token, endpoint);
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to list memberships' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_organization': {
        // Get organization details
        const organizationUri = params.organizationUri as string;
        if (!organizationUri) {
          return NextResponse.json({ error: 'organizationUri is required' }, { status: 400 });
        }
        const uuid = organizationUri.split('/').pop();
        const response = await calendlyFetch(token, `/organizations/${uuid}`);
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to get organization' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'list_webhooks': {
        // List webhook subscriptions
        const organizationUri = params.organizationUri as string;
        const userUri = params.userUri as string;
        let endpoint = '/webhook_subscriptions?';
        if (organizationUri) endpoint += `organization=${encodeURIComponent(organizationUri)}`;
        if (userUri) endpoint += `${organizationUri ? '&' : ''}user=${encodeURIComponent(userUri)}`;
        if (params.scope) endpoint += `&scope=${params.scope}`;

        const response = await calendlyFetch(token, endpoint);
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to list webhooks' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'create_webhook': {
        // Create a webhook subscription
        const url = params.url as string;
        const events = params.events as string[];
        const organizationUri = params.organizationUri as string;
        const userUri = params.userUri as string;
        const scope = params.scope as string;

        if (!url || !events || !scope) {
          return NextResponse.json({ error: 'url, events, and scope are required' }, { status: 400 });
        }
        if (scope === 'organization' && !organizationUri) {
          return NextResponse.json({ error: 'organizationUri is required for organization scope' }, { status: 400 });
        }
        if (scope === 'user' && !userUri) {
          return NextResponse.json({ error: 'userUri is required for user scope' }, { status: 400 });
        }

        const response = await calendlyFetch(token, '/webhook_subscriptions', {
          method: 'POST',
          body: JSON.stringify({
            url,
            events,
            organization: organizationUri,
            user: userUri,
            scope,
          }),
        });
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to create webhook' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'delete_webhook': {
        // Delete a webhook subscription
        const webhookUri = params.webhookUri as string;
        if (!webhookUri) {
          return NextResponse.json({ error: 'webhookUri is required' }, { status: 400 });
        }
        const uuid = webhookUri.split('/').pop();
        const response = await calendlyFetch(token, `/webhook_subscriptions/${uuid}`, {
          method: 'DELETE',
        });
        if (!response.ok && response.status !== 204) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json({ error: error.message || 'Failed to delete webhook' }, { status: response.status });
        }
        result = { success: true, message: 'Webhook deleted' };
        break;
      }

      case 'get_availability': {
        // Get user availability
        const userUri = params.userUri as string;
        if (!userUri) {
          return NextResponse.json({ error: 'userUri is required' }, { status: 400 });
        }
        const response = await calendlyFetch(token, `/user_availability_schedules?user=${encodeURIComponent(userUri)}`);
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to get availability' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('[Calendly Execute API] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
