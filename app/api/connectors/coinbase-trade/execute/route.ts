/**
 * COINBASE ADVANCED TRADE ACTION EXECUTION API
 * Execute Coinbase Advanced Trade API actions for buying/selling crypto
 * POST: Execute a specific trading action
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server-auth';
import { getUserConnection } from '@/lib/connectors/helpers';
import crypto from 'crypto';

export const runtime = 'nodejs';

const COINBASE_API = 'https://api.coinbase.com/api/v3/brokerage';

interface ExecuteRequest {
  action: string;
  params: Record<string, unknown>;
}

// Generate signature for Coinbase Advanced Trade API
function generateSignature(
  timestamp: string,
  method: string,
  requestPath: string,
  body: string,
  secret: string
): string {
  const message = timestamp + method + requestPath + body;
  return crypto.createHmac('sha256', secret).update(message).digest('hex');
}

// Helper for Coinbase Advanced Trade API requests
async function coinbaseFetch(
  apiKey: string,
  apiSecret: string,
  endpoint: string,
  method: string = 'GET',
  body?: Record<string, unknown>
): Promise<Response> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const requestPath = `/api/v3/brokerage${endpoint}`;
  const bodyStr = body ? JSON.stringify(body) : '';
  const signature = generateSignature(timestamp, method, requestPath, bodyStr, apiSecret);

  return fetch(`${COINBASE_API}${endpoint}`, {
    method,
    headers: {
      'CB-ACCESS-KEY': apiKey,
      'CB-ACCESS-SIGN': signature,
      'CB-ACCESS-TIMESTAMP': timestamp,
      'Content-Type': 'application/json',
    },
    body: body ? bodyStr : undefined,
  });
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const connection = await getUserConnection(user.id, 'coinbase-trade');
    if (!connection) {
      return NextResponse.json({ error: 'Coinbase Advanced Trade not connected' }, { status: 400 });
    }

    const { action, params }: ExecuteRequest = await request.json();

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    // Token format: API_KEY|API_SECRET
    const [apiKey, apiSecret] = connection.token.split('|');
    if (!apiKey || !apiSecret) {
      return NextResponse.json({ error: 'Invalid credentials format' }, { status: 400 });
    }

    let result: unknown;

    switch (action) {
      case 'list_accounts': {
        // List all trading accounts
        const response = await coinbaseFetch(apiKey, apiSecret, '/accounts');
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to list accounts' }, { status: response.status });
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
        const response = await coinbaseFetch(apiKey, apiSecret, `/accounts/${accountId}`);
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to get account' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'list_products': {
        // List all available trading pairs
        const response = await coinbaseFetch(apiKey, apiSecret, '/products');
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to list products' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_product': {
        // Get specific product
        const productId = params.productId as string;
        if (!productId) {
          return NextResponse.json({ error: 'productId is required (e.g., BTC-USD)' }, { status: 400 });
        }
        const response = await coinbaseFetch(apiKey, apiSecret, `/products/${productId}`);
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to get product' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_ticker': {
        // Get current price ticker
        const productId = params.productId as string;
        if (!productId) {
          return NextResponse.json({ error: 'productId is required (e.g., BTC-USD)' }, { status: 400 });
        }
        const response = await coinbaseFetch(apiKey, apiSecret, `/products/${productId}/ticker`);
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to get ticker' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'create_order': {
        // Create a new order (buy or sell)
        const productId = params.productId as string;
        const side = params.side as string; // 'BUY' or 'SELL'
        const orderType = params.orderType as string || 'MARKET';

        if (!productId || !side) {
          return NextResponse.json({ error: 'productId and side (BUY/SELL) are required' }, { status: 400 });
        }

        const orderConfig: Record<string, unknown> = {};

        if (orderType === 'MARKET') {
          // Market order - specify quote_size (USD amount) or base_size (crypto amount)
          if (params.quoteSize) {
            orderConfig.market_market_ioc = { quote_size: String(params.quoteSize) };
          } else if (params.baseSize) {
            orderConfig.market_market_ioc = { base_size: String(params.baseSize) };
          } else {
            return NextResponse.json({ error: 'quoteSize (USD) or baseSize (crypto) required for market orders' }, { status: 400 });
          }
        } else if (orderType === 'LIMIT') {
          // Limit order
          const limitPrice = params.limitPrice as string;
          const baseSize = params.baseSize as string;
          if (!limitPrice || !baseSize) {
            return NextResponse.json({ error: 'limitPrice and baseSize required for limit orders' }, { status: 400 });
          }
          orderConfig.limit_limit_gtc = {
            base_size: baseSize,
            limit_price: limitPrice,
            post_only: params.postOnly || false,
          };
        }

        const orderBody = {
          client_order_id: crypto.randomUUID(),
          product_id: productId,
          side: side.toUpperCase(),
          order_configuration: orderConfig,
        };

        const response = await coinbaseFetch(apiKey, apiSecret, '/orders', 'POST', orderBody);
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || error.error || 'Failed to create order' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'buy': {
        // Simplified buy - market order
        const productId = params.productId as string || 'BTC-USD';
        const amount = params.amount as number;
        const amountType = params.amountType as string || 'USD'; // 'USD' or 'crypto'

        if (!amount) {
          return NextResponse.json({ error: 'amount is required' }, { status: 400 });
        }

        const orderConfig = amountType === 'USD'
          ? { market_market_ioc: { quote_size: String(amount) } }
          : { market_market_ioc: { base_size: String(amount) } };

        const orderBody = {
          client_order_id: crypto.randomUUID(),
          product_id: productId,
          side: 'BUY',
          order_configuration: orderConfig,
        };

        const response = await coinbaseFetch(apiKey, apiSecret, '/orders', 'POST', orderBody);
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || error.error || 'Failed to buy' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'sell': {
        // Simplified sell - market order
        const productId = params.productId as string || 'BTC-USD';
        const amount = params.amount as number;
        const amountType = params.amountType as string || 'crypto'; // 'USD' or 'crypto'

        if (!amount) {
          return NextResponse.json({ error: 'amount is required' }, { status: 400 });
        }

        const orderConfig = amountType === 'USD'
          ? { market_market_ioc: { quote_size: String(amount) } }
          : { market_market_ioc: { base_size: String(amount) } };

        const orderBody = {
          client_order_id: crypto.randomUUID(),
          product_id: productId,
          side: 'SELL',
          order_configuration: orderConfig,
        };

        const response = await coinbaseFetch(apiKey, apiSecret, '/orders', 'POST', orderBody);
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || error.error || 'Failed to sell' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'list_orders': {
        // List orders
        let endpoint = '/orders/historical/batch';
        const queryParams: string[] = [];
        if (params.productId) queryParams.push(`product_id=${params.productId}`);
        if (params.orderStatus) queryParams.push(`order_status=${params.orderStatus}`);
        if (params.limit) queryParams.push(`limit=${params.limit}`);
        if (queryParams.length > 0) endpoint += '?' + queryParams.join('&');

        const response = await coinbaseFetch(apiKey, apiSecret, endpoint);
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
        const response = await coinbaseFetch(apiKey, apiSecret, `/orders/historical/${orderId}`);
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to get order' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'cancel_orders': {
        // Cancel orders
        const orderIds = params.orderIds as string[];
        if (!orderIds || orderIds.length === 0) {
          return NextResponse.json({ error: 'orderIds array is required' }, { status: 400 });
        }
        const response = await coinbaseFetch(apiKey, apiSecret, '/orders/batch_cancel', 'POST', { order_ids: orderIds });
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to cancel orders' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_candles': {
        // Get historical candles/OHLC data
        const productId = params.productId as string;
        const granularity = params.granularity as string || 'ONE_HOUR';
        if (!productId) {
          return NextResponse.json({ error: 'productId is required' }, { status: 400 });
        }
        let endpoint = `/products/${productId}/candles?granularity=${granularity}`;
        if (params.start) endpoint += `&start=${params.start}`;
        if (params.end) endpoint += `&end=${params.end}`;

        const response = await coinbaseFetch(apiKey, apiSecret, endpoint);
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to get candles' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_portfolio': {
        // Get portfolio breakdown
        const response = await coinbaseFetch(apiKey, apiSecret, '/portfolios');
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to get portfolios' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('[Coinbase Trade Execute API] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
