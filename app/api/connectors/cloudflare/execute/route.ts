/**
 * CLOUDFLARE ACTION EXECUTION API
 * Execute Cloudflare API actions for DNS, Workers, etc.
 * POST: Execute a specific Cloudflare action
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server-auth';
import { getUserConnection } from '@/lib/connectors/helpers';

export const runtime = 'nodejs';

const CLOUDFLARE_API = 'https://api.cloudflare.com/client/v4';

interface ExecuteRequest {
  action: string;
  params: Record<string, unknown>;
}

// Helper for Cloudflare API requests
async function cloudflareFetch(
  token: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(`${CLOUDFLARE_API}${endpoint}`, {
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

    const connection = await getUserConnection(user.id, 'cloudflare');
    if (!connection) {
      return NextResponse.json({ error: 'Cloudflare not connected' }, { status: 400 });
    }

    const { action, params }: ExecuteRequest = await request.json();

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    const token = connection.token;
    let result: unknown;

    switch (action) {
      case 'verify_token':
      case 'get_user': {
        // Verify token and get user info
        const response = await cloudflareFetch(token, '/user/tokens/verify');
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.errors?.[0]?.message || 'Failed to verify token' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'list_zones': {
        // List all zones (domains)
        const response = await cloudflareFetch(token, '/zones?per_page=50');
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.errors?.[0]?.message || 'Failed to list zones' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_zone': {
        // Get zone details
        const zoneId = params.zoneId as string;
        if (!zoneId) {
          return NextResponse.json({ error: 'zoneId is required' }, { status: 400 });
        }
        const response = await cloudflareFetch(token, `/zones/${zoneId}`);
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.errors?.[0]?.message || 'Failed to get zone' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'list_dns_records': {
        // List DNS records for a zone
        const zoneId = params.zoneId as string;
        if (!zoneId) {
          return NextResponse.json({ error: 'zoneId is required' }, { status: 400 });
        }
        const response = await cloudflareFetch(token, `/zones/${zoneId}/dns_records?per_page=100`);
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.errors?.[0]?.message || 'Failed to list DNS records' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'create_dns_record': {
        // Create a DNS record
        const zoneId = params.zoneId as string;
        if (!zoneId || !params.type || !params.name || !params.content) {
          return NextResponse.json({ error: 'zoneId, type, name, and content are required' }, { status: 400 });
        }
        const response = await cloudflareFetch(token, `/zones/${zoneId}/dns_records`, {
          method: 'POST',
          body: JSON.stringify({
            type: params.type,
            name: params.name,
            content: params.content,
            ttl: params.ttl || 1, // 1 = auto
            proxied: params.proxied ?? true,
            priority: params.priority,
          }),
        });
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.errors?.[0]?.message || 'Failed to create DNS record' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'update_dns_record': {
        // Update a DNS record
        const zoneId = params.zoneId as string;
        const recordId = params.recordId as string;
        if (!zoneId || !recordId) {
          return NextResponse.json({ error: 'zoneId and recordId are required' }, { status: 400 });
        }
        const response = await cloudflareFetch(token, `/zones/${zoneId}/dns_records/${recordId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            type: params.type,
            name: params.name,
            content: params.content,
            ttl: params.ttl,
            proxied: params.proxied,
          }),
        });
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.errors?.[0]?.message || 'Failed to update DNS record' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'delete_dns_record': {
        // Delete a DNS record
        const zoneId = params.zoneId as string;
        const recordId = params.recordId as string;
        if (!zoneId || !recordId) {
          return NextResponse.json({ error: 'zoneId and recordId are required' }, { status: 400 });
        }
        const response = await cloudflareFetch(token, `/zones/${zoneId}/dns_records/${recordId}`, {
          method: 'DELETE',
        });
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.errors?.[0]?.message || 'Failed to delete DNS record' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'purge_cache': {
        // Purge cache for a zone
        const zoneId = params.zoneId as string;
        if (!zoneId) {
          return NextResponse.json({ error: 'zoneId is required' }, { status: 400 });
        }
        const body = params.files
          ? { files: params.files }
          : { purge_everything: true };
        const response = await cloudflareFetch(token, `/zones/${zoneId}/purge_cache`, {
          method: 'POST',
          body: JSON.stringify(body),
        });
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.errors?.[0]?.message || 'Failed to purge cache' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'list_workers': {
        // List Workers scripts
        const accountId = params.accountId as string;
        if (!accountId) {
          return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
        }
        const response = await cloudflareFetch(token, `/accounts/${accountId}/workers/scripts`);
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.errors?.[0]?.message || 'Failed to list workers' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_analytics': {
        // Get zone analytics
        const zoneId = params.zoneId as string;
        if (!zoneId) {
          return NextResponse.json({ error: 'zoneId is required' }, { status: 400 });
        }
        const since = params.since || '-1440'; // Last 24 hours
        const response = await cloudflareFetch(token, `/zones/${zoneId}/analytics/dashboard?since=${since}&continuous=true`);
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.errors?.[0]?.message || 'Failed to get analytics' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('[Cloudflare Execute API] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
