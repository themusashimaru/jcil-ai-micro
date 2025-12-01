/**
 * WEBFLOW CONNECTOR
 * Manage Webflow CMS content and sites
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

    const connection = await getUserConnection(user.id, 'webflow');
    if (!connection) {
      return NextResponse.json({ error: 'Webflow not connected' }, { status: 400 });
    }

    const token = connection.token;
    const baseUrl = 'https://api.webflow.com/v2';

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    let result: unknown;

    switch (action) {
      case 'get_user': {
        // Get current user info
        const response = await fetch(`${baseUrl}/user`, { headers });
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json({ error: error.message || 'Failed to get user' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'list_sites': {
        // List all sites
        const response = await fetch(`${baseUrl}/sites`, { headers });
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json({ error: error.message || 'Failed to list sites' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_site': {
        // Get a specific site
        const siteId = params.siteId;
        if (!siteId) {
          return NextResponse.json({ error: 'siteId is required' }, { status: 400 });
        }

        const response = await fetch(`${baseUrl}/sites/${siteId}`, { headers });
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json({ error: error.message || 'Failed to get site' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'list_collections': {
        // List CMS collections for a site
        const siteId = params.siteId;
        if (!siteId) {
          return NextResponse.json({ error: 'siteId is required' }, { status: 400 });
        }

        const response = await fetch(`${baseUrl}/sites/${siteId}/collections`, { headers });
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json({ error: error.message || 'Failed to list collections' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_collection': {
        // Get a specific collection
        const collectionId = params.collectionId;
        if (!collectionId) {
          return NextResponse.json({ error: 'collectionId is required' }, { status: 400 });
        }

        const response = await fetch(`${baseUrl}/collections/${collectionId}`, { headers });
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json({ error: error.message || 'Failed to get collection' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'list_items': {
        // List items in a collection
        const collectionId = params.collectionId;
        if (!collectionId) {
          return NextResponse.json({ error: 'collectionId is required' }, { status: 400 });
        }

        const queryParams = new URLSearchParams({
          ...(params.limit && { limit: String(params.limit) }),
          ...(params.offset && { offset: String(params.offset) }),
        });

        const response = await fetch(`${baseUrl}/collections/${collectionId}/items?${queryParams}`, { headers });
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json({ error: error.message || 'Failed to list items' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_item': {
        // Get a specific item
        const collectionId = params.collectionId;
        const itemId = params.itemId;
        if (!collectionId || !itemId) {
          return NextResponse.json({ error: 'collectionId and itemId are required' }, { status: 400 });
        }

        const response = await fetch(`${baseUrl}/collections/${collectionId}/items/${itemId}`, { headers });
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json({ error: error.message || 'Failed to get item' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'create_item': {
        // Create a new item in a collection
        const collectionId = params.collectionId;
        const fieldData = params.fieldData;
        if (!collectionId || !fieldData) {
          return NextResponse.json({ error: 'collectionId and fieldData are required' }, { status: 400 });
        }

        const response = await fetch(`${baseUrl}/collections/${collectionId}/items`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            fieldData,
            isArchived: params.isArchived || false,
            isDraft: params.isDraft !== false,
          }),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json({ error: error.message || 'Failed to create item' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'update_item': {
        // Update an item
        const collectionId = params.collectionId;
        const itemId = params.itemId;
        const fieldData = params.fieldData;
        if (!collectionId || !itemId || !fieldData) {
          return NextResponse.json({ error: 'collectionId, itemId, and fieldData are required' }, { status: 400 });
        }

        const response = await fetch(`${baseUrl}/collections/${collectionId}/items/${itemId}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            fieldData,
            ...(params.isArchived !== undefined && { isArchived: params.isArchived }),
            ...(params.isDraft !== undefined && { isDraft: params.isDraft }),
          }),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json({ error: error.message || 'Failed to update item' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'delete_item': {
        // Delete an item
        const collectionId = params.collectionId;
        const itemId = params.itemId;
        if (!collectionId || !itemId) {
          return NextResponse.json({ error: 'collectionId and itemId are required' }, { status: 400 });
        }

        const response = await fetch(`${baseUrl}/collections/${collectionId}/items/${itemId}`, {
          method: 'DELETE',
          headers,
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json({ error: error.message || 'Failed to delete item' }, { status: response.status });
        }
        result = { success: true, message: 'Item deleted' };
        break;
      }

      case 'publish_item': {
        // Publish an item (set isDraft to false)
        const collectionId = params.collectionId;
        const itemId = params.itemId;
        if (!collectionId || !itemId) {
          return NextResponse.json({ error: 'collectionId and itemId are required' }, { status: 400 });
        }

        const response = await fetch(`${baseUrl}/collections/${collectionId}/items/${itemId}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ isDraft: false }),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json({ error: error.message || 'Failed to publish item' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'publish_site': {
        // Publish the site
        const siteId = params.siteId;
        if (!siteId) {
          return NextResponse.json({ error: 'siteId is required' }, { status: 400 });
        }

        const response = await fetch(`${baseUrl}/sites/${siteId}/publish`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            publishToWebflowSubdomain: params.publishToSubdomain !== false,
            ...(params.customDomains && { customDomains: params.customDomains }),
          }),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json({ error: error.message || 'Failed to publish site' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'list_domains': {
        // List domains for a site
        const siteId = params.siteId;
        if (!siteId) {
          return NextResponse.json({ error: 'siteId is required' }, { status: 400 });
        }

        const response = await fetch(`${baseUrl}/sites/${siteId}/domains`, { headers });
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json({ error: error.message || 'Failed to list domains' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('[Webflow Connector] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
