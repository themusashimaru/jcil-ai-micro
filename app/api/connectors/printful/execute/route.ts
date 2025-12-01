/**
 * PRINTFUL ACTION EXECUTION API
 * Execute Printful print-on-demand API actions
 * POST: Execute a specific Printful action
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server-auth';
import { getUserConnection } from '@/lib/connectors/helpers';

export const runtime = 'nodejs';

const PRINTFUL_API = 'https://api.printful.com';

interface ExecuteRequest {
  action: string;
  params: Record<string, unknown>;
}

// Helper for Printful API requests
async function printfulFetch(
  token: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(`${PRINTFUL_API}${endpoint}`, {
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

    const connection = await getUserConnection(user.id, 'printful');
    if (!connection) {
      return NextResponse.json({ error: 'Printful not connected' }, { status: 400 });
    }

    const { action, params }: ExecuteRequest = await request.json();

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    const token = connection.token;
    let result: unknown;

    switch (action) {
      case 'get_store':
      case 'get_store_info': {
        // Get store information
        const response = await printfulFetch(token, '/stores');
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.error?.message || 'Failed to get store' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'list_products':
      case 'get_sync_products': {
        // List synced products
        const limit = params.limit || 20;
        const offset = params.offset || 0;
        const response = await printfulFetch(token, `/sync/products?limit=${limit}&offset=${offset}`);
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.error?.message || 'Failed to list products' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_product':
      case 'get_sync_product': {
        // Get a specific synced product
        const productId = params.productId as string;
        if (!productId) {
          return NextResponse.json({ error: 'productId is required' }, { status: 400 });
        }
        const response = await printfulFetch(token, `/sync/products/${productId}`);
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.error?.message || 'Failed to get product' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'list_orders': {
        // List orders
        const limit = params.limit || 20;
        const offset = params.offset || 0;
        const status = params.status ? `&status=${params.status}` : '';
        const response = await printfulFetch(token, `/orders?limit=${limit}&offset=${offset}${status}`);
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.error?.message || 'Failed to list orders' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_order': {
        // Get a specific order
        const orderId = params.orderId as string;
        if (!orderId) {
          return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
        }
        const response = await printfulFetch(token, `/orders/${orderId}`);
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.error?.message || 'Failed to get order' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'estimate_costs': {
        // Estimate order costs
        const response = await printfulFetch(token, '/orders/estimate-costs', {
          method: 'POST',
          body: JSON.stringify({
            recipient: params.recipient,
            items: params.items,
          }),
        });
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.error?.message || 'Failed to estimate costs' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'create_order': {
        // Create a new order
        const response = await printfulFetch(token, '/orders', {
          method: 'POST',
          body: JSON.stringify({
            recipient: params.recipient,
            items: params.items,
            retail_costs: params.retailCosts,
            gift: params.gift,
            packing_slip: params.packingSlip,
          }),
        });
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.error?.message || 'Failed to create order' }, { status: response.status });
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
        const response = await printfulFetch(token, `/orders/${orderId}`, {
          method: 'DELETE',
        });
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.error?.message || 'Failed to cancel order' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'list_catalog_products': {
        // List available catalog products
        const categoryId = params.categoryId ? `?category_id=${params.categoryId}` : '';
        const response = await printfulFetch(token, `/products${categoryId}`);
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.error?.message || 'Failed to list catalog' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_catalog_product': {
        // Get catalog product details
        const productId = params.productId as string;
        if (!productId) {
          return NextResponse.json({ error: 'productId is required' }, { status: 400 });
        }
        const response = await printfulFetch(token, `/products/${productId}`);
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.error?.message || 'Failed to get catalog product' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'list_categories': {
        // List product categories
        const response = await printfulFetch(token, '/categories');
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.error?.message || 'Failed to list categories' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_shipping_rates': {
        // Get shipping rates
        const response = await printfulFetch(token, '/shipping/rates', {
          method: 'POST',
          body: JSON.stringify({
            recipient: params.recipient,
            items: params.items,
          }),
        });
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.error?.message || 'Failed to get shipping rates' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'list_countries': {
        // List countries for shipping
        const response = await printfulFetch(token, '/countries');
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.error?.message || 'Failed to list countries' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('[Printful Execute API] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
