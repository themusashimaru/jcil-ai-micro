/**
 * RESEND ACTION EXECUTION API
 * Execute Resend email API actions
 * POST: Execute a specific Resend action
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server-auth';
import { getUserConnection } from '@/lib/connectors/helpers';

export const runtime = 'nodejs';

const RESEND_API = 'https://api.resend.com';

interface ExecuteRequest {
  action: string;
  params: Record<string, unknown>;
}

// Helper for Resend API requests
async function resendFetch(
  token: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(`${RESEND_API}${endpoint}`, {
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

    const connection = await getUserConnection(user.id, 'resend');
    if (!connection) {
      return NextResponse.json({ error: 'Resend not connected' }, { status: 400 });
    }

    const { action, params }: ExecuteRequest = await request.json();

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    const token = connection.token;
    let result: unknown;

    switch (action) {
      case 'send_email':
      case 'send': {
        // Send an email
        if (!params.to || !params.subject) {
          return NextResponse.json({ error: 'to and subject are required' }, { status: 400 });
        }
        const response = await resendFetch(token, '/emails', {
          method: 'POST',
          body: JSON.stringify({
            from: params.from || 'onboarding@resend.dev',
            to: Array.isArray(params.to) ? params.to : [params.to],
            subject: params.subject,
            html: params.html || params.body,
            text: params.text,
            cc: params.cc,
            bcc: params.bcc,
            reply_to: params.replyTo,
            tags: params.tags,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to send email' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_email': {
        // Get email by ID
        const emailId = params.emailId as string;
        if (!emailId) {
          return NextResponse.json({ error: 'emailId is required' }, { status: 400 });
        }
        const response = await resendFetch(token, `/emails/${emailId}`);
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to get email' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'list_domains': {
        // List verified domains
        const response = await resendFetch(token, '/domains');
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to list domains' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_domain': {
        // Get domain details
        const domainId = params.domainId as string;
        if (!domainId) {
          return NextResponse.json({ error: 'domainId is required' }, { status: 400 });
        }
        const response = await resendFetch(token, `/domains/${domainId}`);
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to get domain' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'add_domain': {
        // Add a new domain
        const name = params.name as string;
        if (!name) {
          return NextResponse.json({ error: 'name (domain) is required' }, { status: 400 });
        }
        const response = await resendFetch(token, '/domains', {
          method: 'POST',
          body: JSON.stringify({
            name,
            region: params.region || 'us-east-1',
          }),
        });
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to add domain' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'verify_domain': {
        // Verify a domain
        const domainId = params.domainId as string;
        if (!domainId) {
          return NextResponse.json({ error: 'domainId is required' }, { status: 400 });
        }
        const response = await resendFetch(token, `/domains/${domainId}/verify`, {
          method: 'POST',
        });
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to verify domain' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'list_api_keys': {
        // List API keys
        const response = await resendFetch(token, '/api-keys');
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to list API keys' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('[Resend Execute API] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
