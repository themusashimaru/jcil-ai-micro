/**
 * MIXPANEL CONNECTOR
 * Query analytics data from Mixpanel
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

    const connection = await getUserConnection(user.id, 'mixpanel');
    if (!connection) {
      return NextResponse.json({ error: 'Mixpanel not connected' }, { status: 400 });
    }

    // Token format: PROJECT_TOKEN|API_SECRET (or just API_SECRET for some endpoints)
    const parts = connection.token.split('|');
    const projectToken = parts[0]?.trim();
    const apiSecret = parts[1]?.trim() || parts[0]?.trim();

    const baseUrl = 'https://mixpanel.com/api/2.0';
    const auth = Buffer.from(`${apiSecret}:`).toString('base64');

    const headers: Record<string, string> = {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
    };

    let result: unknown;

    switch (action) {
      case 'get_events': {
        // Query events
        const fromDate = params.fromDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const toDate = params.toDate || new Date().toISOString().split('T')[0];
        const event = params.event || '';

        const queryParams = new URLSearchParams({
          from_date: fromDate,
          to_date: toDate,
          ...(event && { event }),
        });

        const response = await fetch(`${baseUrl}/events?${queryParams}`, { headers });
        if (!response.ok) {
          const error = await response.text();
          return NextResponse.json({ error: error || 'Failed to get events' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_event_names': {
        // List all event names
        const response = await fetch(`${baseUrl}/events/names`, { headers });
        if (!response.ok) {
          const error = await response.text();
          return NextResponse.json({ error: error || 'Failed to get event names' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_top_events': {
        // Get top events by volume
        const type = params.type || 'general';
        const limit = params.limit || 10;

        const response = await fetch(`${baseUrl}/events/top?type=${type}&limit=${limit}`, { headers });
        if (!response.ok) {
          const error = await response.text();
          return NextResponse.json({ error: error || 'Failed to get top events' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_funnels': {
        // List funnels
        const response = await fetch(`${baseUrl}/funnels/list`, { headers });
        if (!response.ok) {
          const error = await response.text();
          return NextResponse.json({ error: error || 'Failed to get funnels' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_funnel': {
        // Get specific funnel data
        const funnelId = params.funnelId;
        if (!funnelId) {
          return NextResponse.json({ error: 'funnelId is required' }, { status: 400 });
        }

        const fromDate = params.fromDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const toDate = params.toDate || new Date().toISOString().split('T')[0];

        const response = await fetch(
          `${baseUrl}/funnels?funnel_id=${funnelId}&from_date=${fromDate}&to_date=${toDate}`,
          { headers }
        );
        if (!response.ok) {
          const error = await response.text();
          return NextResponse.json({ error: error || 'Failed to get funnel' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_retention': {
        // Get retention data
        const fromDate = params.fromDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const toDate = params.toDate || new Date().toISOString().split('T')[0];
        const bornEvent = params.bornEvent || '';
        const event = params.event || '';

        const queryParams = new URLSearchParams({
          from_date: fromDate,
          to_date: toDate,
          ...(bornEvent && { born_event: bornEvent }),
          ...(event && { event }),
        });

        const response = await fetch(`${baseUrl}/retention?${queryParams}`, { headers });
        if (!response.ok) {
          const error = await response.text();
          return NextResponse.json({ error: error || 'Failed to get retention' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_segmentation': {
        // Segmentation query
        const event = params.event;
        if (!event) {
          return NextResponse.json({ error: 'event is required' }, { status: 400 });
        }

        const fromDate = params.fromDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const toDate = params.toDate || new Date().toISOString().split('T')[0];

        const queryParams = new URLSearchParams({
          event,
          from_date: fromDate,
          to_date: toDate,
          ...(params.on && { on: params.on }),
        });

        const response = await fetch(`${baseUrl}/segmentation?${queryParams}`, { headers });
        if (!response.ok) {
          const error = await response.text();
          return NextResponse.json({ error: error || 'Failed to get segmentation' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_insights': {
        // Get saved insights/reports
        const response = await fetch(`${baseUrl}/insights`, { headers });
        if (!response.ok) {
          const error = await response.text();
          return NextResponse.json({ error: error || 'Failed to get insights' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'track_event': {
        // Track an event (uses different endpoint)
        const eventName = params.event;
        const distinctId = params.distinctId;

        if (!eventName || !distinctId) {
          return NextResponse.json({ error: 'event and distinctId are required' }, { status: 400 });
        }

        const eventData = {
          event: eventName,
          properties: {
            token: projectToken,
            distinct_id: distinctId,
            time: Math.floor(Date.now() / 1000),
            ...(params.properties as Record<string, unknown> || {}),
          },
        };

        const response = await fetch('https://api.mixpanel.com/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify([eventData]),
        });

        if (!response.ok) {
          return NextResponse.json({ error: 'Failed to track event' }, { status: response.status });
        }
        result = { success: true, message: 'Event tracked' };
        break;
      }

      case 'get_user_profiles': {
        // Query user profiles (Engage)
        const response = await fetch(`${baseUrl}/engage`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            ...(params.where && { where: params.where }),
            page: params.page || 0,
            session_id: params.sessionId,
          }),
        });

        if (!response.ok) {
          const error = await response.text();
          return NextResponse.json({ error: error || 'Failed to get profiles' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('[Mixpanel Connector] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
