/**
 * STRIPE ACTION EXECUTION API
 * Execute Stripe actions after user confirmation
 * POST: Execute a specific Stripe action
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server-auth';
import { getUserConnection } from '@/lib/connectors/helpers';

export const runtime = 'nodejs';

const STRIPE_API = 'https://api.stripe.com/v1';

interface ExecuteRequest {
  action: string;
  params: Record<string, unknown>;
}

// Helper for Stripe API requests
async function stripeFetch(
  secretKey: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(`${STRIPE_API}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      ...options.headers,
    },
  });
}

// Convert cents to dollars for display
function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Get user's Stripe connection
    const connection = await getUserConnection(user.id, 'stripe');
    if (!connection) {
      return NextResponse.json({ error: 'Stripe not connected' }, { status: 400 });
    }

    const body: ExecuteRequest = await request.json();
    const { action, params } = body;

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    const secretKey = connection.token;
    let result: unknown;

    switch (action) {
      case 'get_balance': {
        const response = await stripeFetch(secretKey, '/balance');

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json(
            { error: error.error?.message || 'Failed to get balance' },
            { status: response.status }
          );
        }

        const data = await response.json();
        result = {
          available: data.available?.map((b: { amount: number; currency: string }) => ({
            amount: formatCurrency(b.amount, b.currency),
            currency: b.currency.toUpperCase(),
          })) || [],
          pending: data.pending?.map((b: { amount: number; currency: string }) => ({
            amount: formatCurrency(b.amount, b.currency),
            currency: b.currency.toUpperCase(),
          })) || [],
        };
        break;
      }

      case 'list_customers': {
        const { limit = 10, email } = params as { limit?: number; email?: string };
        let query = `?limit=${limit}`;
        if (email) query += `&email=${encodeURIComponent(email)}`;

        const response = await stripeFetch(secretKey, `/customers${query}`);

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json(
            { error: error.error?.message || 'Failed to list customers' },
            { status: response.status }
          );
        }

        const data = await response.json();
        result = {
          customers: data.data?.map((c: {
            id: string;
            name: string | null;
            email: string | null;
            created: number;
            currency: string | null;
          }) => ({
            id: c.id,
            name: c.name || 'No name',
            email: c.email,
            created: new Date(c.created * 1000).toISOString(),
            currency: c.currency?.toUpperCase(),
          })) || [],
          count: data.data?.length || 0,
          hasMore: data.has_more,
        };
        break;
      }

      case 'get_customer': {
        const { customerId } = params as { customerId: string };
        if (!customerId) {
          return NextResponse.json({ error: 'customerId is required' }, { status: 400 });
        }

        const response = await stripeFetch(secretKey, `/customers/${customerId}`);

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json(
            { error: error.error?.message || 'Failed to get customer' },
            { status: response.status }
          );
        }

        const c = await response.json();
        result = {
          id: c.id,
          name: c.name,
          email: c.email,
          phone: c.phone,
          created: new Date(c.created * 1000).toISOString(),
          currency: c.currency?.toUpperCase(),
          balance: c.balance ? formatCurrency(c.balance, c.currency || 'usd') : '$0.00',
          defaultSource: c.default_source,
          metadata: c.metadata,
        };
        break;
      }

      case 'list_charges':
      case 'list_payments': {
        const { limit = 10, customerId } = params as { limit?: number; customerId?: string };
        let query = `?limit=${limit}`;
        if (customerId) query += `&customer=${customerId}`;

        const response = await stripeFetch(secretKey, `/charges${query}`);

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json(
            { error: error.error?.message || 'Failed to list charges' },
            { status: response.status }
          );
        }

        const data = await response.json();
        result = {
          charges: data.data?.map((c: {
            id: string;
            amount: number;
            currency: string;
            status: string;
            created: number;
            customer: string | null;
            description: string | null;
            receipt_url: string | null;
          }) => ({
            id: c.id,
            amount: formatCurrency(c.amount, c.currency),
            currency: c.currency.toUpperCase(),
            status: c.status,
            created: new Date(c.created * 1000).toISOString(),
            customer: c.customer,
            description: c.description,
            receiptUrl: c.receipt_url,
          })) || [],
          count: data.data?.length || 0,
          hasMore: data.has_more,
        };
        break;
      }

      case 'list_subscriptions': {
        const { limit = 10, customerId, status } = params as {
          limit?: number;
          customerId?: string;
          status?: 'active' | 'canceled' | 'past_due' | 'all';
        };
        let query = `?limit=${limit}`;
        if (customerId) query += `&customer=${customerId}`;
        if (status && status !== 'all') query += `&status=${status}`;

        const response = await stripeFetch(secretKey, `/subscriptions${query}`);

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json(
            { error: error.error?.message || 'Failed to list subscriptions' },
            { status: response.status }
          );
        }

        const data = await response.json();
        result = {
          subscriptions: data.data?.map((s: {
            id: string;
            status: string;
            current_period_start: number;
            current_period_end: number;
            created: number;
            customer: string;
            items: { data: Array<{ price: { unit_amount: number; currency: string; recurring: { interval: string } } }> };
          }) => ({
            id: s.id,
            status: s.status,
            currentPeriodStart: new Date(s.current_period_start * 1000).toISOString(),
            currentPeriodEnd: new Date(s.current_period_end * 1000).toISOString(),
            created: new Date(s.created * 1000).toISOString(),
            customer: s.customer,
            amount: s.items?.data?.[0]?.price
              ? formatCurrency(s.items.data[0].price.unit_amount, s.items.data[0].price.currency)
              : 'N/A',
            interval: s.items?.data?.[0]?.price?.recurring?.interval || 'N/A',
          })) || [],
          count: data.data?.length || 0,
          hasMore: data.has_more,
        };
        break;
      }

      case 'get_subscription': {
        const { subscriptionId } = params as { subscriptionId: string };
        if (!subscriptionId) {
          return NextResponse.json({ error: 'subscriptionId is required' }, { status: 400 });
        }

        const response = await stripeFetch(secretKey, `/subscriptions/${subscriptionId}`);

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json(
            { error: error.error?.message || 'Failed to get subscription' },
            { status: response.status }
          );
        }

        const s = await response.json();
        result = {
          id: s.id,
          status: s.status,
          customer: s.customer,
          currentPeriodStart: new Date(s.current_period_start * 1000).toISOString(),
          currentPeriodEnd: new Date(s.current_period_end * 1000).toISOString(),
          cancelAtPeriodEnd: s.cancel_at_period_end,
          canceledAt: s.canceled_at ? new Date(s.canceled_at * 1000).toISOString() : null,
          created: new Date(s.created * 1000).toISOString(),
          items: s.items?.data?.map((item: {
            id: string;
            price: { id: string; unit_amount: number; currency: string; recurring: { interval: string } };
          }) => ({
            id: item.id,
            priceId: item.price?.id,
            amount: item.price ? formatCurrency(item.price.unit_amount, item.price.currency) : 'N/A',
            interval: item.price?.recurring?.interval,
          })) || [],
        };
        break;
      }

      case 'list_products': {
        const { limit = 10, active } = params as { limit?: number; active?: boolean };
        let query = `?limit=${limit}`;
        if (active !== undefined) query += `&active=${active}`;

        const response = await stripeFetch(secretKey, `/products${query}`);

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json(
            { error: error.error?.message || 'Failed to list products' },
            { status: response.status }
          );
        }

        const data = await response.json();
        result = {
          products: data.data?.map((p: {
            id: string;
            name: string;
            description: string | null;
            active: boolean;
            created: number;
            default_price: string | null;
            images: string[];
          }) => ({
            id: p.id,
            name: p.name,
            description: p.description,
            active: p.active,
            created: new Date(p.created * 1000).toISOString(),
            defaultPrice: p.default_price,
            images: p.images,
          })) || [],
          count: data.data?.length || 0,
          hasMore: data.has_more,
        };
        break;
      }

      case 'list_prices': {
        const { limit = 10, productId, active } = params as {
          limit?: number;
          productId?: string;
          active?: boolean;
        };
        let query = `?limit=${limit}`;
        if (productId) query += `&product=${productId}`;
        if (active !== undefined) query += `&active=${active}`;

        const response = await stripeFetch(secretKey, `/prices${query}`);

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json(
            { error: error.error?.message || 'Failed to list prices' },
            { status: response.status }
          );
        }

        const data = await response.json();
        result = {
          prices: data.data?.map((p: {
            id: string;
            unit_amount: number | null;
            currency: string;
            active: boolean;
            product: string;
            type: string;
            recurring: { interval: string } | null;
          }) => ({
            id: p.id,
            amount: p.unit_amount ? formatCurrency(p.unit_amount, p.currency) : 'Custom',
            currency: p.currency.toUpperCase(),
            active: p.active,
            product: p.product,
            type: p.type,
            interval: p.recurring?.interval || 'one-time',
          })) || [],
          count: data.data?.length || 0,
          hasMore: data.has_more,
        };
        break;
      }

      case 'list_invoices': {
        const { limit = 10, customerId, status } = params as {
          limit?: number;
          customerId?: string;
          status?: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
        };
        let query = `?limit=${limit}`;
        if (customerId) query += `&customer=${customerId}`;
        if (status) query += `&status=${status}`;

        const response = await stripeFetch(secretKey, `/invoices${query}`);

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json(
            { error: error.error?.message || 'Failed to list invoices' },
            { status: response.status }
          );
        }

        const data = await response.json();
        result = {
          invoices: data.data?.map((i: {
            id: string;
            number: string | null;
            status: string;
            total: number;
            currency: string;
            customer: string;
            created: number;
            due_date: number | null;
            hosted_invoice_url: string | null;
          }) => ({
            id: i.id,
            number: i.number,
            status: i.status,
            total: formatCurrency(i.total, i.currency),
            customer: i.customer,
            created: new Date(i.created * 1000).toISOString(),
            dueDate: i.due_date ? new Date(i.due_date * 1000).toISOString() : null,
            invoiceUrl: i.hosted_invoice_url,
          })) || [],
          count: data.data?.length || 0,
          hasMore: data.has_more,
        };
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('[Stripe Execute API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
