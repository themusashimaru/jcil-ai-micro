/**
 * WORDPRESS CONNECTOR
 * Manage WordPress posts, pages, and media
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

    const connection = await getUserConnection(user.id, 'wordpress');
    if (!connection) {
      return NextResponse.json({ error: 'WordPress not connected' }, { status: 400 });
    }

    // Token format: SITE_URL|USERNAME|APPLICATION_PASSWORD or USERNAME:APP_PASSWORD (for single site)
    const parts = connection.token.split('|');
    let siteUrl: string;
    let auth: string;

    if (parts.length === 3) {
      siteUrl = parts[0].trim();
      const username = parts[1].trim();
      const appPassword = parts[2].trim();
      auth = Buffer.from(`${username}:${appPassword}`).toString('base64');
    } else if (parts.length === 2) {
      // Format: SITE_URL|USERNAME:APP_PASSWORD
      siteUrl = parts[0].trim();
      auth = Buffer.from(parts[1].trim()).toString('base64');
    } else if (connection.token.includes(':')) {
      // Legacy format: just username:password (requires site URL in params)
      siteUrl = params.siteUrl;
      if (!siteUrl) {
        return NextResponse.json({ error: 'siteUrl is required' }, { status: 400 });
      }
      auth = Buffer.from(connection.token).toString('base64');
    } else {
      return NextResponse.json({ error: 'Invalid token format' }, { status: 400 });
    }

    // Ensure site URL doesn't have trailing slash
    siteUrl = siteUrl.replace(/\/$/, '');
    const baseUrl = `${siteUrl}/wp-json/wp/v2`;

    const headers: Record<string, string> = {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
    };

    let result: unknown;

    switch (action) {
      case 'get_me': {
        // Get current user info
        const response = await fetch(`${baseUrl}/users/me`, { headers });
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json({ error: error.message || 'Failed to get user' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'list_posts': {
        // List posts
        const queryParams = new URLSearchParams({
          per_page: String(params.perPage || 10),
          page: String(params.page || 1),
          ...(params.status && { status: params.status }),
          ...(params.search && { search: params.search }),
          ...(params.categories && { categories: params.categories }),
          ...(params.orderby && { orderby: params.orderby }),
          ...(params.order && { order: params.order }),
        });

        const response = await fetch(`${baseUrl}/posts?${queryParams}`, { headers });
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json({ error: error.message || 'Failed to list posts' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_post': {
        // Get a specific post
        const postId = params.postId;
        if (!postId) {
          return NextResponse.json({ error: 'postId is required' }, { status: 400 });
        }

        const response = await fetch(`${baseUrl}/posts/${postId}`, { headers });
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json({ error: error.message || 'Failed to get post' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'create_post': {
        // Create a new post
        const title = params.title;
        if (!title) {
          return NextResponse.json({ error: 'title is required' }, { status: 400 });
        }

        const postData: Record<string, unknown> = {
          title,
          content: params.content || '',
          status: params.status || 'draft',
          ...(params.excerpt && { excerpt: params.excerpt }),
          ...(params.categories && { categories: params.categories }),
          ...(params.tags && { tags: params.tags }),
          ...(params.featuredMedia && { featured_media: params.featuredMedia }),
        };

        const response = await fetch(`${baseUrl}/posts`, {
          method: 'POST',
          headers,
          body: JSON.stringify(postData),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json({ error: error.message || 'Failed to create post' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'update_post': {
        // Update a post
        const postId = params.postId;
        if (!postId) {
          return NextResponse.json({ error: 'postId is required' }, { status: 400 });
        }

        const updateData: Record<string, unknown> = {
          ...(params.title && { title: params.title }),
          ...(params.content !== undefined && { content: params.content }),
          ...(params.status && { status: params.status }),
          ...(params.excerpt && { excerpt: params.excerpt }),
          ...(params.categories && { categories: params.categories }),
          ...(params.tags && { tags: params.tags }),
        };

        const response = await fetch(`${baseUrl}/posts/${postId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(updateData),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json({ error: error.message || 'Failed to update post' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'delete_post': {
        // Delete a post
        const postId = params.postId;
        if (!postId) {
          return NextResponse.json({ error: 'postId is required' }, { status: 400 });
        }

        const force = params.force ? '?force=true' : '';
        const response = await fetch(`${baseUrl}/posts/${postId}${force}`, {
          method: 'DELETE',
          headers,
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json({ error: error.message || 'Failed to delete post' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'list_pages': {
        // List pages
        const queryParams = new URLSearchParams({
          per_page: String(params.perPage || 10),
          page: String(params.page || 1),
          ...(params.status && { status: params.status }),
          ...(params.search && { search: params.search }),
        });

        const response = await fetch(`${baseUrl}/pages?${queryParams}`, { headers });
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json({ error: error.message || 'Failed to list pages' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'create_page': {
        // Create a new page
        const title = params.title;
        if (!title) {
          return NextResponse.json({ error: 'title is required' }, { status: 400 });
        }

        const pageData: Record<string, unknown> = {
          title,
          content: params.content || '',
          status: params.status || 'draft',
          ...(params.parent && { parent: params.parent }),
        };

        const response = await fetch(`${baseUrl}/pages`, {
          method: 'POST',
          headers,
          body: JSON.stringify(pageData),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json({ error: error.message || 'Failed to create page' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'list_categories': {
        // List categories
        const response = await fetch(`${baseUrl}/categories?per_page=100`, { headers });
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json({ error: error.message || 'Failed to list categories' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'list_tags': {
        // List tags
        const response = await fetch(`${baseUrl}/tags?per_page=100`, { headers });
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json({ error: error.message || 'Failed to list tags' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'list_media': {
        // List media
        const queryParams = new URLSearchParams({
          per_page: String(params.perPage || 10),
          page: String(params.page || 1),
          ...(params.mediaType && { media_type: params.mediaType }),
        });

        const response = await fetch(`${baseUrl}/media?${queryParams}`, { headers });
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json({ error: error.message || 'Failed to list media' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'list_comments': {
        // List comments
        const queryParams = new URLSearchParams({
          per_page: String(params.perPage || 10),
          ...(params.post && { post: params.post }),
          ...(params.status && { status: params.status }),
        });

        const response = await fetch(`${baseUrl}/comments?${queryParams}`, { headers });
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json({ error: error.message || 'Failed to list comments' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_site_info': {
        // Get site info
        const response = await fetch(`${siteUrl}/wp-json`, { headers });
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json({ error: error.message || 'Failed to get site info' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('[WordPress Connector] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
