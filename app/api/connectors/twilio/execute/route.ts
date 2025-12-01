/**
 * TWILIO ACTION EXECUTION API
 * Execute Twilio API actions for SMS
 * POST: Execute a specific Twilio action
 *
 * Token format: account_sid|auth_token
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server-auth';
import { getUserConnection } from '@/lib/connectors/helpers';

export const runtime = 'nodejs';

interface ExecuteRequest {
  action: string;
  params: Record<string, unknown>;
}

// Parse token to get account SID and auth token
function parseToken(token: string): { accountSid: string; authToken: string } | null {
  // Try colon separator first (legacy), then pipe
  const separator = token.includes(':') ? ':' : '|';
  const parts = token.split(separator);
  if (parts.length !== 2) return null;

  return {
    accountSid: parts[0].trim(),
    authToken: parts[1].trim(),
  };
}

// Helper for Twilio API requests
async function twilioFetch(
  accountSid: string,
  authToken: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}${endpoint}`;

  return fetch(url, {
    ...options,
    headers: {
      Authorization: `Basic ${auth}`,
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

    const connection = await getUserConnection(user.id, 'twilio');
    if (!connection) {
      return NextResponse.json({ error: 'Twilio not connected' }, { status: 400 });
    }

    const parsed = parseToken(connection.token);
    if (!parsed) {
      return NextResponse.json(
        { error: 'Invalid Twilio credentials. Expected format: account_sid|auth_token' },
        { status: 400 }
      );
    }

    const { accountSid, authToken } = parsed;
    const body: ExecuteRequest = await request.json();
    const { action, params } = body;

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    let result: unknown;

    switch (action) {
      case 'get_account': {
        const response = await twilioFetch(accountSid, authToken, '.json');

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json(
            { error: error.message || 'Failed to get account' },
            { status: response.status }
          );
        }

        const account = await response.json();
        result = {
          sid: account.sid,
          friendlyName: account.friendly_name,
          status: account.status,
          type: account.type,
          dateCreated: account.date_created,
        };
        break;
      }

      case 'send_sms': {
        const { to, from, body: messageBody } = params as {
          to: string;
          from: string;
          body: string;
        };

        if (!to || !from || !messageBody) {
          return NextResponse.json(
            { error: 'to, from, and body are required' },
            { status: 400 }
          );
        }

        const formData = new URLSearchParams();
        formData.append('To', to);
        formData.append('From', from);
        formData.append('Body', messageBody);

        const response = await twilioFetch(accountSid, authToken, '/Messages.json', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formData.toString(),
        });

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json(
            { error: error.message || 'Failed to send SMS' },
            { status: response.status }
          );
        }

        const message = await response.json();
        result = {
          sid: message.sid,
          to: message.to,
          from: message.from,
          body: message.body,
          status: message.status,
          dateCreated: message.date_created,
          message: 'SMS sent successfully!',
        };
        break;
      }

      case 'list_messages': {
        const { limit = 20, to, from } = params as {
          limit?: number;
          to?: string;
          from?: string;
        };

        let endpoint = `/Messages.json?PageSize=${limit}`;
        if (to) endpoint += `&To=${encodeURIComponent(to)}`;
        if (from) endpoint += `&From=${encodeURIComponent(from)}`;

        const response = await twilioFetch(accountSid, authToken, endpoint);

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json(
            { error: error.message || 'Failed to list messages' },
            { status: response.status }
          );
        }

        const data = await response.json();
        result = {
          messages: data.messages?.map((m: {
            sid: string;
            to: string;
            from: string;
            body: string;
            status: string;
            direction: string;
            date_sent: string;
            price: string;
            price_unit: string;
          }) => ({
            sid: m.sid,
            to: m.to,
            from: m.from,
            body: m.body,
            status: m.status,
            direction: m.direction,
            dateSent: m.date_sent,
            price: m.price,
            priceUnit: m.price_unit,
          })) || [],
          count: data.messages?.length || 0,
        };
        break;
      }

      case 'get_message': {
        const { messageSid } = params as { messageSid: string };
        if (!messageSid) {
          return NextResponse.json({ error: 'messageSid is required' }, { status: 400 });
        }

        const response = await twilioFetch(accountSid, authToken, `/Messages/${messageSid}.json`);

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json(
            { error: error.message || 'Failed to get message' },
            { status: response.status }
          );
        }

        const m = await response.json();
        result = {
          sid: m.sid,
          to: m.to,
          from: m.from,
          body: m.body,
          status: m.status,
          direction: m.direction,
          dateSent: m.date_sent,
          dateCreated: m.date_created,
          price: m.price,
          priceUnit: m.price_unit,
          errorCode: m.error_code,
          errorMessage: m.error_message,
        };
        break;
      }

      case 'list_phone_numbers': {
        const response = await twilioFetch(accountSid, authToken, '/IncomingPhoneNumbers.json');

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json(
            { error: error.message || 'Failed to list phone numbers' },
            { status: response.status }
          );
        }

        const data = await response.json();
        result = {
          phoneNumbers: data.incoming_phone_numbers?.map((p: {
            sid: string;
            phone_number: string;
            friendly_name: string;
            capabilities: { sms: boolean; voice: boolean; mms: boolean };
            date_created: string;
          }) => ({
            sid: p.sid,
            phoneNumber: p.phone_number,
            friendlyName: p.friendly_name,
            capabilities: p.capabilities,
            dateCreated: p.date_created,
          })) || [],
          count: data.incoming_phone_numbers?.length || 0,
        };
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('[Twilio Execute API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
