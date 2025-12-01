/**
 * ALPACA TRADING ACTION EXECUTION API
 * Execute Alpaca stock trading API actions
 * POST: Execute a specific trading action
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server-auth';
import { getUserConnection } from '@/lib/connectors/helpers';

export const runtime = 'nodejs';

interface ExecuteRequest {
  action: string;
  params: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const connection = await getUserConnection(user.id, 'alpaca');
    if (!connection) {
      return NextResponse.json({ error: 'Alpaca not connected' }, { status: 400 });
    }

    const { action, params }: ExecuteRequest = await request.json();

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    // Token format: API_KEY|API_SECRET|PAPER (paper = paper trading, live = live trading)
    const parts = connection.token.split('|');
    const [apiKey, apiSecret] = parts;
    const isPaper = parts[2] !== 'live';

    if (!apiKey || !apiSecret) {
      return NextResponse.json({ error: 'Invalid credentials format' }, { status: 400 });
    }

    // Use paper or live API based on setting
    const baseUrl = isPaper
      ? 'https://paper-api.alpaca.markets'
      : 'https://api.alpaca.markets';
    const dataUrl = 'https://data.alpaca.markets';

    // Helper for Alpaca API requests
    async function alpacaFetch(endpoint: string, options: RequestInit = {}, useDataApi = false): Promise<Response> {
      const url = useDataApi ? dataUrl : baseUrl;
      return fetch(`${url}${endpoint}`, {
        ...options,
        headers: {
          'APCA-API-KEY-ID': apiKey,
          'APCA-API-SECRET-KEY': apiSecret,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });
    }

    let result: unknown;

    switch (action) {
      case 'get_account': {
        // Get account info
        const response = await alpacaFetch('/v2/account');
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to get account' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'list_positions': {
        // List all positions
        const response = await alpacaFetch('/v2/positions');
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to list positions' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_position': {
        // Get specific position
        const symbol = params.symbol as string;
        if (!symbol) {
          return NextResponse.json({ error: 'symbol is required' }, { status: 400 });
        }
        const response = await alpacaFetch(`/v2/positions/${symbol.toUpperCase()}`);
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to get position' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'close_position': {
        // Close a position
        const symbol = params.symbol as string;
        if (!symbol) {
          return NextResponse.json({ error: 'symbol is required' }, { status: 400 });
        }
        let endpoint = `/v2/positions/${symbol.toUpperCase()}`;
        if (params.qty) endpoint += `?qty=${params.qty}`;
        else if (params.percentage) endpoint += `?percentage=${params.percentage}`;

        const response = await alpacaFetch(endpoint, { method: 'DELETE' });
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to close position' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'close_all_positions': {
        // Close all positions
        const response = await alpacaFetch('/v2/positions', { method: 'DELETE' });
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to close positions' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'create_order': {
        // Create an order
        const symbol = params.symbol as string;
        const qty = params.qty as number;
        const side = params.side as string;
        const type = params.type as string || 'market';
        const timeInForce = params.timeInForce as string || 'day';

        if (!symbol || !side) {
          return NextResponse.json({ error: 'symbol and side (buy/sell) are required' }, { status: 400 });
        }

        if (!qty && !params.notional) {
          return NextResponse.json({ error: 'qty or notional (dollar amount) is required' }, { status: 400 });
        }

        const orderBody: Record<string, unknown> = {
          symbol: symbol.toUpperCase(),
          side: side.toLowerCase(),
          type: type.toLowerCase(),
          time_in_force: timeInForce,
        };

        if (qty) orderBody.qty = String(qty);
        if (params.notional) orderBody.notional = String(params.notional);
        if (params.limitPrice) orderBody.limit_price = String(params.limitPrice);
        if (params.stopPrice) orderBody.stop_price = String(params.stopPrice);
        if (params.trailPrice) orderBody.trail_price = String(params.trailPrice);
        if (params.trailPercent) orderBody.trail_percent = String(params.trailPercent);

        const response = await alpacaFetch('/v2/orders', {
          method: 'POST',
          body: JSON.stringify(orderBody),
        });
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to create order' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'buy': {
        // Simplified buy
        const symbol = params.symbol as string;
        if (!symbol) {
          return NextResponse.json({ error: 'symbol is required' }, { status: 400 });
        }

        const orderBody: Record<string, unknown> = {
          symbol: symbol.toUpperCase(),
          side: 'buy',
          type: 'market',
          time_in_force: 'day',
        };

        if (params.qty) orderBody.qty = String(params.qty);
        else if (params.notional) orderBody.notional = String(params.notional);
        else {
          return NextResponse.json({ error: 'qty (shares) or notional (dollars) is required' }, { status: 400 });
        }

        const response = await alpacaFetch('/v2/orders', {
          method: 'POST',
          body: JSON.stringify(orderBody),
        });
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to buy' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'sell': {
        // Simplified sell
        const symbol = params.symbol as string;
        if (!symbol) {
          return NextResponse.json({ error: 'symbol is required' }, { status: 400 });
        }

        const orderBody: Record<string, unknown> = {
          symbol: symbol.toUpperCase(),
          side: 'sell',
          type: 'market',
          time_in_force: 'day',
        };

        if (params.qty) orderBody.qty = String(params.qty);
        else if (params.notional) orderBody.notional = String(params.notional);
        else {
          return NextResponse.json({ error: 'qty (shares) or notional (dollars) is required' }, { status: 400 });
        }

        const response = await alpacaFetch('/v2/orders', {
          method: 'POST',
          body: JSON.stringify(orderBody),
        });
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to sell' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'list_orders': {
        // List orders
        let endpoint = '/v2/orders';
        const queryParams: string[] = [];
        if (params.status) queryParams.push(`status=${params.status}`);
        if (params.limit) queryParams.push(`limit=${params.limit}`);
        if (params.direction) queryParams.push(`direction=${params.direction}`);
        if (params.symbols) queryParams.push(`symbols=${params.symbols}`);
        if (queryParams.length > 0) endpoint += '?' + queryParams.join('&');

        const response = await alpacaFetch(endpoint);
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to list orders' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_order': {
        // Get specific order
        const orderId = params.orderId as string;
        if (!orderId) {
          return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
        }
        const response = await alpacaFetch(`/v2/orders/${orderId}`);
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to get order' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'cancel_order': {
        // Cancel an order
        const orderId = params.orderId as string;
        if (!orderId) {
          return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
        }
        const response = await alpacaFetch(`/v2/orders/${orderId}`, { method: 'DELETE' });
        if (!response.ok && response.status !== 204) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json({ error: error.message || 'Failed to cancel order' }, { status: response.status });
        }
        result = { success: true, message: 'Order cancelled' };
        break;
      }

      case 'cancel_all_orders': {
        // Cancel all orders
        const response = await alpacaFetch('/v2/orders', { method: 'DELETE' });
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to cancel orders' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_quote': {
        // Get latest quote for a symbol
        const symbol = params.symbol as string;
        if (!symbol) {
          return NextResponse.json({ error: 'symbol is required' }, { status: 400 });
        }
        const response = await alpacaFetch(`/v2/stocks/${symbol.toUpperCase()}/quotes/latest`, {}, true);
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to get quote' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_bars': {
        // Get historical bars
        const symbol = params.symbol as string;
        const timeframe = params.timeframe as string || '1Day';
        if (!symbol) {
          return NextResponse.json({ error: 'symbol is required' }, { status: 400 });
        }
        let endpoint = `/v2/stocks/${symbol.toUpperCase()}/bars?timeframe=${timeframe}`;
        if (params.start) endpoint += `&start=${params.start}`;
        if (params.end) endpoint += `&end=${params.end}`;
        if (params.limit) endpoint += `&limit=${params.limit}`;

        const response = await alpacaFetch(endpoint, {}, true);
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to get bars' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'list_assets': {
        // List tradable assets
        let endpoint = '/v2/assets';
        const queryParams: string[] = [];
        if (params.status) queryParams.push(`status=${params.status}`);
        if (params.assetClass) queryParams.push(`asset_class=${params.assetClass}`);
        if (queryParams.length > 0) endpoint += '?' + queryParams.join('&');

        const response = await alpacaFetch(endpoint);
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to list assets' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_asset': {
        // Get specific asset info
        const symbol = params.symbol as string;
        if (!symbol) {
          return NextResponse.json({ error: 'symbol is required' }, { status: 400 });
        }
        const response = await alpacaFetch(`/v2/assets/${symbol.toUpperCase()}`);
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to get asset' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_clock': {
        // Get market clock
        const response = await alpacaFetch('/v2/clock');
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to get clock' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_calendar': {
        // Get market calendar
        let endpoint = '/v2/calendar';
        if (params.start || params.end) {
          const queryParams: string[] = [];
          if (params.start) queryParams.push(`start=${params.start}`);
          if (params.end) queryParams.push(`end=${params.end}`);
          endpoint += '?' + queryParams.join('&');
        }
        const response = await alpacaFetch(endpoint);
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to get calendar' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_portfolio_history': {
        // Get portfolio history
        let endpoint = '/v2/account/portfolio/history';
        const queryParams: string[] = [];
        if (params.period) queryParams.push(`period=${params.period}`);
        if (params.timeframe) queryParams.push(`timeframe=${params.timeframe}`);
        if (queryParams.length > 0) endpoint += '?' + queryParams.join('&');

        const response = await alpacaFetch(endpoint);
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to get portfolio history' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('[Alpaca Execute API] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
