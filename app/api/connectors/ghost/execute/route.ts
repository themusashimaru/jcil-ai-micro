/**
 * GHOST CONNECTOR
 * Manage Ghost blog content
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server-auth';
import { getUserConnection } from '@/lib/connectors/helpers';
import * as crypto from 'crypto';

export const runtime = 'nodejs';

// Ghost Admin API requires JWT tokens
function createGhostToken(key: string): string {
  const [id, secret] = key.split(':');

  // Create the token header and payload
  const header = { alg: 'HS256', typ: 'JWT', kid: id };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iat: now,
    exp: now + 5 * 60, // 5 minutes
    aud: '/admin/',
  };

  // Base64URL encode
  const base64url = (data: object) =>
    Buffer.from(JSON.stringify(data))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');

  const headerEncoded = base64url(header);
  const payloadEncoded = base64url(payload);

  // Create signature
  const secretBuffer = Buffer.from(secret, 'hex');
  const signature = crypto
    .createHmac('sha256', secretBuffer)
    .update(`${headerEncoded}.${payloadEncoded}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return `${headerEncoded}.${payloadEncoded}.${signature}`;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { action, params = {} } = body;

    const connection = await getUserConnection(user.id, 'ghost');
    if (!connection) {
      return NextResponse.json({ error: 'Ghost not connected' }, { status: 400 });
    }

    // Token format: SITE_URL|ADMIN_API_KEY or ADMIN_API_KEY (with siteUrl in params)
    const parts = connection.token.split('|');
    let siteUrl: string;
    let apiKey: string;

    if (parts.length === 2) {
      siteUrl = parts[0].trim();
      apiKey = parts[1].trim();
    } else {
      siteUrl = params.siteUrl;
      apiKey = connection.token;
      if (!siteUrl) {
        return NextResponse.json({ error: 'siteUrl is required' }, { status: 400 });
      }
    }

    // Ensure site URL doesn't have trailing slash
    siteUrl = siteUrl.replace(/\/$/, '');
    const baseUrl = `${siteUrl}/ghost/api/admin`;

    // Create JWT token for Admin API
    const token = createGhostToken(apiKey);

    const headers: Record<string, string> = {
      'Authorization': `Ghost ${token}`,
      'Content-Type': 'application/json',
    };

    let result: unknown;

    switch (action) {
      case 'get_site': {
        // Get site info
        const response = await fetch(`${baseUrl}/site/`, { headers });
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json({ error: error.errors?.[0]?.message || 'Failed to get site' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'list_posts': {
        // List posts
        const queryParams = new URLSearchParams({
          limit: String(params.limit || 15),
          ...(params.page && { page: String(params.page) }),
          ...(params.status && { filter: `status:${params.status}` }),
          ...(params.include && { include: params.include }),
        });

        const response = await fetch(`${baseUrl}/posts/?${queryParams}`, { headers });
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json({ error: error.errors?.[0]?.message || 'Failed to list posts' }, { status: response.status });
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

        const response = await fetch(`${baseUrl}/posts/${postId}/`, { headers });
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json({ error: error.errors?.[0]?.message || 'Failed to get post' }, { status: response.status });
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

        const postData = {
          posts: [{
            title,
            html: params.html || params.content || '',
            status: params.status || 'draft',
            ...(params.slug && { slug: params.slug }),
            ...(params.excerpt && { custom_excerpt: params.excerpt }),
            ...(params.featureImage && { feature_image: params.featureImage }),
            ...(params.tags && { tags: params.tags }),
            ...(params.authors && { authors: params.authors }),
          }],
        };

        const response = await fetch(`${baseUrl}/posts/`, {
          method: 'POST',
          headers,
          body: JSON.stringify(postData),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json({ error: error.errors?.[0]?.message || 'Failed to create post' }, { status: response.status });
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

        // First get the current post to get updated_at
        const getResponse = await fetch(`${baseUrl}/posts/${postId}/`, { headers });
        if (!getResponse.ok) {
          return NextResponse.json({ error: 'Failed to get post for update' }, { status: getResponse.status });
        }
        const currentPost = await getResponse.json();
        const updatedAt = currentPost.posts[0].updated_at;

        const updateData = {
          posts: [{
            updated_at: updatedAt,
            ...(params.title && { title: params.title }),
            ...(params.html !== undefined && { html: params.html }),
            ...(params.content !== undefined && { html: params.content }),
            ...(params.status && { status: params.status }),
            ...(params.slug && { slug: params.slug }),
            ...(params.excerpt && { custom_excerpt: params.excerpt }),
            ...(params.featureImage !== undefined && { feature_image: params.featureImage }),
            ...(params.tags && { tags: params.tags }),
          }],
        };

        const response = await fetch(`${baseUrl}/posts/${postId}/`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(updateData),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json({ error: error.errors?.[0]?.message || 'Failed to update post' }, { status: response.status });
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

        const response = await fetch(`${baseUrl}/posts/${postId}/`, {
          method: 'DELETE',
          headers,
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json({ error: error.errors?.[0]?.message || 'Failed to delete post' }, { status: response.status });
        }
        result = { success: true, message: 'Post deleted' };
        break;
      }

      case 'list_pages': {
        // List pages
        const queryParams = new URLSearchParams({
          limit: String(params.limit || 15),
          ...(params.page && { page: String(params.page) }),
          ...(params.status && { filter: `status:${params.status}` }),
        });

        const response = await fetch(`${baseUrl}/pages/?${queryParams}`, { headers });
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json({ error: error.errors?.[0]?.message || 'Failed to list pages' }, { status: response.status });
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

        const pageData = {
          pages: [{
            title,
            html: params.html || params.content || '',
            status: params.status || 'draft',
            ...(params.slug && { slug: params.slug }),
          }],
        };

        const response = await fetch(`${baseUrl}/pages/`, {
          method: 'POST',
          headers,
          body: JSON.stringify(pageData),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json({ error: error.errors?.[0]?.message || 'Failed to create page' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'list_tags': {
        // List tags
        const response = await fetch(`${baseUrl}/tags/?limit=all`, { headers });
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json({ error: error.errors?.[0]?.message || 'Failed to list tags' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'create_tag': {
        // Create a new tag
        const name = params.name;
        if (!name) {
          return NextResponse.json({ error: 'name is required' }, { status: 400 });
        }

        const tagData = {
          tags: [{
            name,
            ...(params.slug && { slug: params.slug }),
            ...(params.description && { description: params.description }),
          }],
        };

        const response = await fetch(`${baseUrl}/tags/`, {
          method: 'POST',
          headers,
          body: JSON.stringify(tagData),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json({ error: error.errors?.[0]?.message || 'Failed to create tag' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'list_members': {
        // List members (requires Members feature)
        const queryParams = new URLSearchParams({
          limit: String(params.limit || 15),
          ...(params.page && { page: String(params.page) }),
        });

        const response = await fetch(`${baseUrl}/members/?${queryParams}`, { headers });
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json({ error: error.errors?.[0]?.message || 'Failed to list members' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'list_users': {
        // List staff users
        const response = await fetch(`${baseUrl}/users/`, { headers });
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json({ error: error.errors?.[0]?.message || 'Failed to list users' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('[Ghost Connector] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
