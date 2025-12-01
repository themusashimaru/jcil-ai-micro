/**
 * COINBASE ACTION EXECUTION API
 * Execute Coinbase API actions for crypto trading/portfolio
 * POST: Execute a specific Coinbase action
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server-auth';
import { getUserConnection } from '@/lib/connectors/helpers';

export const runtime = 'nodejs';

const COINBASE_API = 'https://api.coinbase.com/v2';

interface ExecuteRequest {
  action: string;
  params: Record<string, unknown>;
}

// Helper for Coinbase API requests
async function coinbaseFetch(
  token: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(`${COINBASE_API}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'CB-VERSION': '2024-01-01',
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

    const connection = await getUserConnection(user.id, 'coinbase');
    if (!connection) {
      return NextResponse.json({ error: 'Coinbase not connected' }, { status: 400 });
    }

    const { action, params }: ExecuteRequest = await request.json();

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    const token = connection.token;
    let result: unknown;

    switch (action) {
      case 'get_user': {
        // Get current user info
        const response = await coinbaseFetch(token, '/user');
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.errors?.[0]?.message || 'Failed to get user' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'list_accounts':
      case 'get_wallets': {
        // List all accounts/wallets
        const response = await coinbaseFetch(token, '/accounts?limit=100');
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.errors?.[0]?.message || 'Failed to list accounts' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_account': {
        // Get specific account
        const accountId = params.accountId as string;
        if (!accountId) {
          return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
        }
        const response = await coinbaseFetch(token, `/accounts/${accountId}`);
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.errors?.[0]?.message || 'Failed to get account' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_prices':
      case 'get_spot_price': {
        // Get current price for a currency pair
        const currencyPair = (params.currencyPair as string) || 'BTC-USD';
        const response = await coinbaseFetch(token, `/prices/${currencyPair}/spot`);
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.errors?.[0]?.message || 'Failed to get price' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_buy_price': {
        // Get buy price for a currency pair
        const currencyPair = (params.currencyPair as string) || 'BTC-USD';
        const response = await coinbaseFetch(token, `/prices/${currencyPair}/buy`);
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.errors?.[0]?.message || 'Failed to get buy price' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_sell_price': {
        // Get sell price for a currency pair
        const currencyPair = (params.currencyPair as string) || 'BTC-USD';
        const response = await coinbaseFetch(token, `/prices/${currencyPair}/sell`);
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.errors?.[0]?.message || 'Failed to get sell price' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'list_transactions': {
        // List transactions for an account
        const accountId = params.accountId as string;
        if (!accountId) {
          return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
        }
        const limit = params.limit || 25;
        const response = await coinbaseFetch(token, `/accounts/${accountId}/transactions?limit=${limit}`);
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.errors?.[0]?.message || 'Failed to list transactions' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'list_currencies': {
        // List supported currencies
        const response = await coinbaseFetch(token, '/currencies');
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.errors?.[0]?.message || 'Failed to list currencies' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_exchange_rates': {
        // Get exchange rates
        const currency = (params.currency as string) || 'USD';
        const response = await coinbaseFetch(token, `/exchange-rates?currency=${currency}`);
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.errors?.[0]?.message || 'Failed to get exchange rates' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'send_money': {
        // Send crypto (requires proper scopes)
        const accountId = params.accountId as string;
        if (!accountId) {
          return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
        }
        const response = await coinbaseFetch(token, `/accounts/${accountId}/transactions`, {
          method: 'POST',
          body: JSON.stringify({
            type: 'send',
            to: params.to,
            amount: params.amount,
            currency: params.currency,
            description: params.description || '',
          }),
        });
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.errors?.[0]?.message || 'Failed to send' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('[Coinbase Execute API] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
