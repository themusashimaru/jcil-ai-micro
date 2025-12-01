/**
 * SHOPIFY ACTION EXECUTION API
 * Execute Shopify Admin API actions after user confirmation
 * POST: Execute a specific Shopify action
 *
 * Token format: store_domain|access_token (e.g., mystore.myshopify.com|shpat_xxx)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server-auth';
import { getUserConnection } from '@/lib/connectors/helpers';

export const runtime = 'nodejs';

const SHOPIFY_API_VERSION = '2024-01';

interface ExecuteRequest {
  action: string;
  params: Record<string, unknown>;
}

// Parse token to get store domain and access token
function parseToken(token: string): { storeDomain: string; accessToken: string } | null {
  const parts = token.split('|');
  if (parts.length !== 2) return null;

  let [storeDomain, accessToken] = parts;
  storeDomain = storeDomain.trim();
  accessToken = accessToken.trim();

  // Ensure store domain has correct format
  if (!storeDomain.includes('.myshopify.com')) {
    storeDomain = `${storeDomain}.myshopify.com`;
  }

  return { storeDomain, accessToken };
}

// Helper for Shopify API requests
async function shopifyFetch(
  storeDomain: string,
  accessToken: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = `https://${storeDomain}/admin/api/${SHOPIFY_API_VERSION}${endpoint}`;
  return fetch(url, {
    ...options,
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
}

// Format price for display
function formatPrice(amount: string, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(parseFloat(amount));
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Get user's Shopify connection
    const connection = await getUserConnection(user.id, 'shopify');
    if (!connection) {
      return NextResponse.json({ error: 'Shopify not connected' }, { status: 400 });
    }

    const parsed = parseToken(connection.token);
    if (!parsed) {
      return NextResponse.json(
        { error: 'Invalid Shopify credentials. Please reconnect with store domain and access token.' },
        { status: 400 }
      );
    }

    const { storeDomain, accessToken } = parsed;
    const body: ExecuteRequest = await request.json();
    const { action, params } = body;

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    let result: unknown;

    switch (action) {
      case 'get_shop': {
        const response = await shopifyFetch(storeDomain, accessToken, '/shop.json');

        if (!response.ok) {
          const error = await response.json().catch(() => ({ errors: 'Unknown error' }));
          return NextResponse.json(
            { error: error.errors || 'Failed to get shop info' },
            { status: response.status }
          );
        }

        const data = await response.json();
        const shop = data.shop;
        result = {
          id: shop.id,
          name: shop.name,
          email: shop.email,
          domain: shop.domain,
          myshopifyDomain: shop.myshopify_domain,
          currency: shop.currency,
          timezone: shop.iana_timezone,
          planName: shop.plan_name,
          createdAt: shop.created_at,
        };
        break;
      }

      case 'list_products': {
        const { limit = 10, status, collectionId } = params as {
          limit?: number;
          status?: 'active' | 'archived' | 'draft';
          collectionId?: string;
        };

        let endpoint = `/products.json?limit=${limit}`;
        if (status) endpoint += `&status=${status}`;
        if (collectionId) endpoint += `&collection_id=${collectionId}`;

        const response = await shopifyFetch(storeDomain, accessToken, endpoint);

        if (!response.ok) {
          const error = await response.json().catch(() => ({ errors: 'Unknown error' }));
          return NextResponse.json(
            { error: error.errors || 'Failed to list products' },
            { status: response.status }
          );
        }

        const data = await response.json();
        result = {
          products: data.products?.map((p: {
            id: number;
            title: string;
            status: string;
            vendor: string;
            product_type: string;
            created_at: string;
            updated_at: string;
            variants: Array<{ price: string; inventory_quantity: number }>;
            images: Array<{ src: string }>;
          }) => ({
            id: p.id,
            title: p.title,
            status: p.status,
            vendor: p.vendor,
            productType: p.product_type,
            createdAt: p.created_at,
            updatedAt: p.updated_at,
            price: p.variants?.[0]?.price ? formatPrice(p.variants[0].price) : 'N/A',
            totalInventory: p.variants?.reduce((sum, v) => sum + (v.inventory_quantity || 0), 0) || 0,
            imageUrl: p.images?.[0]?.src || null,
          })) || [],
          count: data.products?.length || 0,
        };
        break;
      }

      case 'get_product': {
        const { productId } = params as { productId: string | number };
        if (!productId) {
          return NextResponse.json({ error: 'productId is required' }, { status: 400 });
        }

        const response = await shopifyFetch(storeDomain, accessToken, `/products/${productId}.json`);

        if (!response.ok) {
          const error = await response.json().catch(() => ({ errors: 'Unknown error' }));
          return NextResponse.json(
            { error: error.errors || 'Failed to get product' },
            { status: response.status }
          );
        }

        const data = await response.json();
        const p = data.product;
        result = {
          id: p.id,
          title: p.title,
          bodyHtml: p.body_html,
          vendor: p.vendor,
          productType: p.product_type,
          status: p.status,
          tags: p.tags,
          createdAt: p.created_at,
          updatedAt: p.updated_at,
          variants: p.variants?.map((v: {
            id: number;
            title: string;
            price: string;
            sku: string;
            inventory_quantity: number;
          }) => ({
            id: v.id,
            title: v.title,
            price: formatPrice(v.price),
            sku: v.sku,
            inventoryQuantity: v.inventory_quantity,
          })) || [],
          images: p.images?.map((img: { id: number; src: string; alt: string | null }) => ({
            id: img.id,
            src: img.src,
            alt: img.alt,
          })) || [],
        };
        break;
      }

      case 'list_orders': {
        const { limit = 10, status, financialStatus } = params as {
          limit?: number;
          status?: 'open' | 'closed' | 'cancelled' | 'any';
          financialStatus?: 'pending' | 'paid' | 'refunded' | 'any';
        };

        let endpoint = `/orders.json?limit=${limit}`;
        if (status && status !== 'any') endpoint += `&status=${status}`;
        if (financialStatus && financialStatus !== 'any') endpoint += `&financial_status=${financialStatus}`;

        const response = await shopifyFetch(storeDomain, accessToken, endpoint);

        if (!response.ok) {
          const error = await response.json().catch(() => ({ errors: 'Unknown error' }));
          return NextResponse.json(
            { error: error.errors || 'Failed to list orders' },
            { status: response.status }
          );
        }

        const data = await response.json();
        result = {
          orders: data.orders?.map((o: {
            id: number;
            order_number: number;
            name: string;
            email: string | null;
            total_price: string;
            currency: string;
            financial_status: string;
            fulfillment_status: string | null;
            created_at: string;
            line_items: Array<{ title: string; quantity: number }>;
          }) => ({
            id: o.id,
            orderNumber: o.order_number,
            name: o.name,
            email: o.email,
            totalPrice: formatPrice(o.total_price, o.currency),
            currency: o.currency,
            financialStatus: o.financial_status,
            fulfillmentStatus: o.fulfillment_status || 'unfulfilled',
            createdAt: o.created_at,
            itemCount: o.line_items?.reduce((sum, item) => sum + item.quantity, 0) || 0,
          })) || [],
          count: data.orders?.length || 0,
        };
        break;
      }

      case 'get_order': {
        const { orderId } = params as { orderId: string | number };
        if (!orderId) {
          return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
        }

        const response = await shopifyFetch(storeDomain, accessToken, `/orders/${orderId}.json`);

        if (!response.ok) {
          const error = await response.json().catch(() => ({ errors: 'Unknown error' }));
          return NextResponse.json(
            { error: error.errors || 'Failed to get order' },
            { status: response.status }
          );
        }

        const data = await response.json();
        const o = data.order;
        result = {
          id: o.id,
          orderNumber: o.order_number,
          name: o.name,
          email: o.email,
          phone: o.phone,
          totalPrice: formatPrice(o.total_price, o.currency),
          subtotalPrice: formatPrice(o.subtotal_price, o.currency),
          totalTax: formatPrice(o.total_tax, o.currency),
          totalDiscounts: formatPrice(o.total_discounts, o.currency),
          currency: o.currency,
          financialStatus: o.financial_status,
          fulfillmentStatus: o.fulfillment_status || 'unfulfilled',
          createdAt: o.created_at,
          processedAt: o.processed_at,
          lineItems: o.line_items?.map((item: {
            id: number;
            title: string;
            quantity: number;
            price: string;
            sku: string;
          }) => ({
            id: item.id,
            title: item.title,
            quantity: item.quantity,
            price: formatPrice(item.price, o.currency),
            sku: item.sku,
          })) || [],
          shippingAddress: o.shipping_address ? {
            name: o.shipping_address.name,
            address1: o.shipping_address.address1,
            address2: o.shipping_address.address2,
            city: o.shipping_address.city,
            province: o.shipping_address.province,
            country: o.shipping_address.country,
            zip: o.shipping_address.zip,
          } : null,
          note: o.note,
        };
        break;
      }

      case 'list_customers': {
        const { limit = 10 } = params as { limit?: number };

        const response = await shopifyFetch(storeDomain, accessToken, `/customers.json?limit=${limit}`);

        if (!response.ok) {
          const error = await response.json().catch(() => ({ errors: 'Unknown error' }));
          return NextResponse.json(
            { error: error.errors || 'Failed to list customers' },
            { status: response.status }
          );
        }

        const data = await response.json();
        result = {
          customers: data.customers?.map((c: {
            id: number;
            email: string | null;
            first_name: string | null;
            last_name: string | null;
            orders_count: number;
            total_spent: string;
            currency: string;
            created_at: string;
            verified_email: boolean;
          }) => ({
            id: c.id,
            email: c.email,
            name: [c.first_name, c.last_name].filter(Boolean).join(' ') || 'No name',
            ordersCount: c.orders_count,
            totalSpent: formatPrice(c.total_spent, c.currency),
            createdAt: c.created_at,
            verifiedEmail: c.verified_email,
          })) || [],
          count: data.customers?.length || 0,
        };
        break;
      }

      case 'get_customer': {
        const { customerId } = params as { customerId: string | number };
        if (!customerId) {
          return NextResponse.json({ error: 'customerId is required' }, { status: 400 });
        }

        const response = await shopifyFetch(storeDomain, accessToken, `/customers/${customerId}.json`);

        if (!response.ok) {
          const error = await response.json().catch(() => ({ errors: 'Unknown error' }));
          return NextResponse.json(
            { error: error.errors || 'Failed to get customer' },
            { status: response.status }
          );
        }

        const data = await response.json();
        const c = data.customer;
        result = {
          id: c.id,
          email: c.email,
          phone: c.phone,
          firstName: c.first_name,
          lastName: c.last_name,
          ordersCount: c.orders_count,
          totalSpent: formatPrice(c.total_spent, c.currency),
          createdAt: c.created_at,
          updatedAt: c.updated_at,
          verifiedEmail: c.verified_email,
          acceptsMarketing: c.accepts_marketing,
          tags: c.tags,
          defaultAddress: c.default_address ? {
            address1: c.default_address.address1,
            address2: c.default_address.address2,
            city: c.default_address.city,
            province: c.default_address.province,
            country: c.default_address.country,
            zip: c.default_address.zip,
          } : null,
        };
        break;
      }

      case 'list_collections': {
        const { limit = 10, type } = params as { limit?: number; type?: 'smart' | 'custom' };

        const endpoint = type === 'smart'
          ? `/smart_collections.json?limit=${limit}`
          : type === 'custom'
            ? `/custom_collections.json?limit=${limit}`
            : `/custom_collections.json?limit=${limit}`;

        const response = await shopifyFetch(storeDomain, accessToken, endpoint);

        if (!response.ok) {
          const error = await response.json().catch(() => ({ errors: 'Unknown error' }));
          return NextResponse.json(
            { error: error.errors || 'Failed to list collections' },
            { status: response.status }
          );
        }

        const data = await response.json();
        const collections = data.smart_collections || data.custom_collections || [];
        result = {
          collections: collections.map((c: {
            id: number;
            title: string;
            handle: string;
            body_html: string | null;
            updated_at: string;
            published_at: string | null;
          }) => ({
            id: c.id,
            title: c.title,
            handle: c.handle,
            description: c.body_html,
            updatedAt: c.updated_at,
            publishedAt: c.published_at,
          })),
          count: collections.length,
        };
        break;
      }

      case 'get_inventory_levels': {
        const { inventoryItemIds } = params as { inventoryItemIds: string };
        if (!inventoryItemIds) {
          return NextResponse.json({ error: 'inventoryItemIds is required' }, { status: 400 });
        }

        const response = await shopifyFetch(
          storeDomain,
          accessToken,
          `/inventory_levels.json?inventory_item_ids=${inventoryItemIds}`
        );

        if (!response.ok) {
          const error = await response.json().catch(() => ({ errors: 'Unknown error' }));
          return NextResponse.json(
            { error: error.errors || 'Failed to get inventory levels' },
            { status: response.status }
          );
        }

        const data = await response.json();
        result = {
          inventoryLevels: data.inventory_levels?.map((level: {
            inventory_item_id: number;
            location_id: number;
            available: number | null;
            updated_at: string;
          }) => ({
            inventoryItemId: level.inventory_item_id,
            locationId: level.location_id,
            available: level.available,
            updatedAt: level.updated_at,
          })) || [],
          count: data.inventory_levels?.length || 0,
        };
        break;
      }

      case 'update_inventory': {
        const { inventoryItemId, locationId, available } = params as {
          inventoryItemId: number;
          locationId: number;
          available: number;
        };

        if (!inventoryItemId || !locationId || available === undefined) {
          return NextResponse.json(
            { error: 'inventoryItemId, locationId, and available are required' },
            { status: 400 }
          );
        }

        const response = await shopifyFetch(
          storeDomain,
          accessToken,
          '/inventory_levels/set.json',
          {
            method: 'POST',
            body: JSON.stringify({
              location_id: locationId,
              inventory_item_id: inventoryItemId,
              available: available,
            }),
          }
        );

        if (!response.ok) {
          const error = await response.json().catch(() => ({ errors: 'Unknown error' }));
          return NextResponse.json(
            { error: error.errors || 'Failed to update inventory' },
            { status: response.status }
          );
        }

        const data = await response.json();
        result = {
          inventoryLevel: {
            inventoryItemId: data.inventory_level?.inventory_item_id,
            locationId: data.inventory_level?.location_id,
            available: data.inventory_level?.available,
          },
          message: 'Inventory updated successfully!',
        };
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('[Shopify Execute API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
