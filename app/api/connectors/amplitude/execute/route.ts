/**
 * AMPLITUDE CONNECTOR
 * Query product analytics from Amplitude
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server-auth';
import { getUserConnection } from '@/lib/connectors/helpers';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { action, params = {} } = body;

    const connection = await getUserConnection(user.id, 'amplitude');
    if (!connection) {
      return NextResponse.json({ error: 'Amplitude not connected' }, { status: 400 });
    }

    // Token format: API_KEY|SECRET_KEY
    const parts = connection.token.split('|');
    if (parts.length !== 2) {
      return NextResponse.json({ error: 'Invalid token format. Expected API_KEY|SECRET_KEY' }, { status: 400 });
    }

    const [apiKey, secretKey] = parts.map(p => p.trim());
    const auth = Buffer.from(`${apiKey}:${secretKey}`).toString('base64');

    const baseUrl = 'https://amplitude.com/api/2';
    const headers: Record<string, string> = {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
    };

    let result: unknown;

    switch (action) {
      case 'get_events': {
        // Query event data
        const start = params.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const end = params.end || new Date().toISOString().split('T')[0];

        const queryParams = new URLSearchParams({
          start,
          end,
          ...(params.m && { m: params.m }),
          ...(params.e && { e: JSON.stringify(params.e) }),
        });

        const response = await fetch(`${baseUrl}/events/segmentation?${queryParams}`, { headers });
        if (!response.ok) {
          const error = await response.text();
          return NextResponse.json({ error: error || 'Failed to get events' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_active_users': {
        // Get active/new user counts
        const start = params.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const end = params.end || new Date().toISOString().split('T')[0];
        const m = params.m || 'active'; // active, new, or percentActive

        const response = await fetch(`${baseUrl}/users?start=${start}&end=${end}&m=${m}`, { headers });
        if (!response.ok) {
          const error = await response.text();
          return NextResponse.json({ error: error || 'Failed to get users' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_sessions': {
        // Get session data
        const start = params.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const end = params.end || new Date().toISOString().split('T')[0];

        const response = await fetch(`${baseUrl}/sessions/average?start=${start}&end=${end}`, { headers });
        if (!response.ok) {
          const error = await response.text();
          return NextResponse.json({ error: error || 'Failed to get sessions' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_retention': {
        // Get retention data
        const start = params.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const end = params.end || new Date().toISOString().split('T')[0];
        const se = params.startEvent;
        const re = params.returnEvent;

        const queryParams = new URLSearchParams({
          start,
          end,
          ...(se && { se: JSON.stringify(se) }),
          ...(re && { re: JSON.stringify(re) }),
        });

        const response = await fetch(`${baseUrl}/retention?${queryParams}`, { headers });
        if (!response.ok) {
          const error = await response.text();
          return NextResponse.json({ error: error || 'Failed to get retention' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_funnel': {
        // Get funnel analysis
        const start = params.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const end = params.end || new Date().toISOString().split('T')[0];
        const events = params.events; // Array of event objects

        if (!events || !Array.isArray(events)) {
          return NextResponse.json({ error: 'events array is required' }, { status: 400 });
        }

        const queryParams = new URLSearchParams({
          start,
          end,
          e: JSON.stringify(events),
        });

        const response = await fetch(`${baseUrl}/funnels?${queryParams}`, { headers });
        if (!response.ok) {
          const error = await response.text();
          return NextResponse.json({ error: error || 'Failed to get funnel' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_revenue': {
        // Get revenue data (requires Revenue LTV add-on)
        const start = params.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const end = params.end || new Date().toISOString().split('T')[0];
        const m = params.m || 'revenue'; // revenue, paying, or arpu

        const response = await fetch(`${baseUrl}/revenue/ltv?start=${start}&end=${end}&m=${m}`, { headers });
        if (!response.ok) {
          const error = await response.text();
          return NextResponse.json({ error: error || 'Failed to get revenue' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_user_activity': {
        // Get activity for a specific user
        const userId = params.userId;
        if (!userId) {
          return NextResponse.json({ error: 'userId is required' }, { status: 400 });
        }

        const response = await fetch(`${baseUrl}/useractivity?user=${encodeURIComponent(userId)}`, { headers });
        if (!response.ok) {
          const error = await response.text();
          return NextResponse.json({ error: error || 'Failed to get user activity' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'search_users': {
        // Search for users
        const query = params.query;
        if (!query) {
          return NextResponse.json({ error: 'query is required' }, { status: 400 });
        }

        const response = await fetch(`${baseUrl}/usersearch?user=${encodeURIComponent(query)}`, { headers });
        if (!response.ok) {
          const error = await response.text();
          return NextResponse.json({ error: error || 'Failed to search users' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_realtime': {
        // Get real-time active users (last 5 min)
        const response = await fetch(`${baseUrl}/realtime`, { headers });
        if (!response.ok) {
          const error = await response.text();
          return NextResponse.json({ error: error || 'Failed to get realtime data' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'track_event': {
        // Track an event using HTTP API
        const events = Array.isArray(params.events) ? params.events : [params];

        const response = await fetch('https://api2.amplitude.com/2/httpapi', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: apiKey,
            events: events.map((e: Record<string, unknown>) => ({
              user_id: e.userId,
              event_type: e.eventType || e.event,
              event_properties: e.properties || {},
              time: e.time || Date.now(),
            })),
          }),
        });

        if (!response.ok) {
          const error = await response.text();
          return NextResponse.json({ error: error || 'Failed to track event' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('[Amplitude Connector] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
