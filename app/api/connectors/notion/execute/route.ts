/**
 * NOTION ACTION EXECUTION API
 * Execute Notion actions after user confirmation
 * POST: Execute a specific Notion action
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server-auth';
import { getUserConnection } from '@/lib/connectors/helpers';

export const runtime = 'nodejs';

const NOTION_API = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

interface ExecuteRequest {
  action: string;
  params: Record<string, unknown>;
}

// Helper for Notion API requests
async function notionFetch(
  token: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  return fetch(`${NOTION_API}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': NOTION_VERSION,
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

    // Get user's Notion connection
    const connection = await getUserConnection(user.id, 'notion');
    if (!connection) {
      return NextResponse.json({ error: 'Notion not connected' }, { status: 400 });
    }

    const body: ExecuteRequest = await request.json();
    const { action, params } = body;

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    const token = connection.token;
    let result: unknown;

    switch (action) {
      case 'search': {
        const { query, filter } = params as { query?: string; filter?: { property: string; value: string } };
        const searchParams: Record<string, unknown> = {};
        if (query) searchParams.query = query;
        if (filter) searchParams.filter = filter;

        const response = await notionFetch(token, '/search', {
          method: 'POST',
          body: JSON.stringify(searchParams),
        });

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json(
            { error: error.message || 'Failed to search Notion' },
            { status: response.status }
          );
        }

        const data = await response.json();
        result = {
          results: data.results?.map((item: {
            id: string;
            object: string;
            url?: string;
            properties?: Record<string, { title?: Array<{ plain_text: string }>; name?: string }>;
            title?: Array<{ plain_text: string }>;
          }) => ({
            id: item.id,
            type: item.object,
            url: item.url,
            title: item.object === 'page'
              ? extractPageTitle(item.properties)
              : item.object === 'database'
                ? item.title?.[0]?.plain_text
                : 'Untitled',
          })) || [],
          count: data.results?.length || 0,
        };
        break;
      }

      case 'list_databases': {
        const response = await notionFetch(token, '/search', {
          method: 'POST',
          body: JSON.stringify({
            filter: { property: 'object', value: 'database' },
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json(
            { error: error.message || 'Failed to list databases' },
            { status: response.status }
          );
        }

        const data = await response.json();
        result = {
          databases: data.results?.map((db: {
            id: string;
            title: Array<{ plain_text: string }>;
            url: string;
            created_time: string;
          }) => ({
            id: db.id,
            title: db.title?.[0]?.plain_text || 'Untitled',
            url: db.url,
            createdAt: db.created_time,
          })) || [],
          count: data.results?.length || 0,
        };
        break;
      }

      case 'query_database': {
        const { databaseId, filter: dbFilter, sorts, pageSize = 10 } = params as {
          databaseId: string;
          filter?: Record<string, unknown>;
          sorts?: Array<{ property: string; direction: 'ascending' | 'descending' }>;
          pageSize?: number;
        };

        if (!databaseId) {
          return NextResponse.json({ error: 'databaseId is required' }, { status: 400 });
        }

        const queryParams: Record<string, unknown> = { page_size: pageSize };
        if (dbFilter) queryParams.filter = dbFilter;
        if (sorts) queryParams.sorts = sorts;

        const response = await notionFetch(token, `/databases/${databaseId}/query`, {
          method: 'POST',
          body: JSON.stringify(queryParams),
        });

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json(
            { error: error.message || 'Failed to query database' },
            { status: response.status }
          );
        }

        const data = await response.json();
        result = {
          results: data.results?.map((page: {
            id: string;
            url: string;
            properties: Record<string, unknown>;
            created_time: string;
          }) => ({
            id: page.id,
            url: page.url,
            properties: simplifyProperties(page.properties),
            createdAt: page.created_time,
          })) || [],
          count: data.results?.length || 0,
          hasMore: data.has_more,
        };
        break;
      }

      case 'get_page': {
        const { pageId } = params as { pageId: string };
        if (!pageId) {
          return NextResponse.json({ error: 'pageId is required' }, { status: 400 });
        }

        const response = await notionFetch(token, `/pages/${pageId}`);

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json(
            { error: error.message || 'Failed to get page' },
            { status: response.status }
          );
        }

        const page = await response.json();
        result = {
          id: page.id,
          url: page.url,
          properties: simplifyProperties(page.properties),
          createdAt: page.created_time,
          lastEditedAt: page.last_edited_time,
        };
        break;
      }

      case 'get_page_content': {
        const { pageId } = params as { pageId: string };
        if (!pageId) {
          return NextResponse.json({ error: 'pageId is required' }, { status: 400 });
        }

        const response = await notionFetch(token, `/blocks/${pageId}/children`);

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json(
            { error: error.message || 'Failed to get page content' },
            { status: response.status }
          );
        }

        const data = await response.json();
        result = {
          blocks: data.results?.map((block: {
            id: string;
            type: string;
            [key: string]: unknown;
          }) => ({
            id: block.id,
            type: block.type,
            content: extractBlockContent(block),
          })) || [],
          hasMore: data.has_more,
        };
        break;
      }

      case 'create_page': {
        const { parentId, parentType, properties, content } = params as {
          parentId: string;
          parentType: 'database' | 'page';
          properties?: Record<string, unknown>;
          content?: string;
        };

        if (!parentId || !parentType) {
          return NextResponse.json(
            { error: 'parentId and parentType are required' },
            { status: 400 }
          );
        }

        const pageData: Record<string, unknown> = {
          parent: parentType === 'database'
            ? { database_id: parentId }
            : { page_id: parentId },
        };

        if (properties) {
          pageData.properties = properties;
        } else if (parentType === 'page') {
          // For page children, we need at least a title
          pageData.properties = {
            title: {
              title: [{ text: { content: 'New Page' } }],
            },
          };
        }

        // Add content as children blocks if provided
        if (content) {
          pageData.children = [
            {
              object: 'block',
              type: 'paragraph',
              paragraph: {
                rich_text: [{ type: 'text', text: { content } }],
              },
            },
          ];
        }

        const response = await notionFetch(token, '/pages', {
          method: 'POST',
          body: JSON.stringify(pageData),
        });

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json(
            { error: error.message || 'Failed to create page' },
            { status: response.status }
          );
        }

        const page = await response.json();
        result = {
          id: page.id,
          url: page.url,
          message: 'Page created successfully!',
        };
        break;
      }

      case 'update_page': {
        const { pageId, properties } = params as {
          pageId: string;
          properties: Record<string, unknown>;
        };

        if (!pageId || !properties) {
          return NextResponse.json(
            { error: 'pageId and properties are required' },
            { status: 400 }
          );
        }

        const response = await notionFetch(token, `/pages/${pageId}`, {
          method: 'PATCH',
          body: JSON.stringify({ properties }),
        });

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json(
            { error: error.message || 'Failed to update page' },
            { status: response.status }
          );
        }

        const page = await response.json();
        result = {
          id: page.id,
          url: page.url,
          message: 'Page updated successfully!',
        };
        break;
      }

      case 'append_content': {
        const { pageId, content } = params as {
          pageId: string;
          content: string;
        };

        if (!pageId || !content) {
          return NextResponse.json(
            { error: 'pageId and content are required' },
            { status: 400 }
          );
        }

        const response = await notionFetch(token, `/blocks/${pageId}/children`, {
          method: 'PATCH',
          body: JSON.stringify({
            children: [
              {
                object: 'block',
                type: 'paragraph',
                paragraph: {
                  rich_text: [{ type: 'text', text: { content } }],
                },
              },
            ],
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json(
            { error: error.message || 'Failed to append content' },
            { status: response.status }
          );
        }

        result = {
          message: 'Content appended successfully!',
        };
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('[Notion Execute API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Helper to extract page title from properties
function extractPageTitle(properties: Record<string, { title?: Array<{ plain_text: string }> }> | undefined): string {
  if (!properties) return 'Untitled';

  // Look for title property
  for (const [, value] of Object.entries(properties)) {
    if (value.title && Array.isArray(value.title)) {
      return value.title.map(t => t.plain_text).join('') || 'Untitled';
    }
  }

  return 'Untitled';
}

// Helper to simplify Notion properties for easier reading
function simplifyProperties(properties: Record<string, unknown>): Record<string, unknown> {
  const simplified: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(properties)) {
    const prop = value as Record<string, unknown>;
    const type = prop.type as string;

    switch (type) {
      case 'title':
        simplified[key] = (prop.title as Array<{ plain_text: string }>)?.map(t => t.plain_text).join('');
        break;
      case 'rich_text':
        simplified[key] = (prop.rich_text as Array<{ plain_text: string }>)?.map(t => t.plain_text).join('');
        break;
      case 'number':
        simplified[key] = prop.number;
        break;
      case 'select':
        simplified[key] = (prop.select as { name: string } | null)?.name;
        break;
      case 'multi_select':
        simplified[key] = (prop.multi_select as Array<{ name: string }>)?.map(s => s.name);
        break;
      case 'date':
        simplified[key] = (prop.date as { start: string; end?: string } | null)?.start;
        break;
      case 'checkbox':
        simplified[key] = prop.checkbox;
        break;
      case 'url':
        simplified[key] = prop.url;
        break;
      case 'email':
        simplified[key] = prop.email;
        break;
      case 'phone_number':
        simplified[key] = prop.phone_number;
        break;
      case 'status':
        simplified[key] = (prop.status as { name: string } | null)?.name;
        break;
      default:
        simplified[key] = `[${type}]`;
    }
  }

  return simplified;
}

// Helper to extract readable content from a block
function extractBlockContent(block: Record<string, unknown>): string {
  const type = block.type as string;
  const blockData = block[type] as Record<string, unknown> | undefined;

  if (!blockData) return '';

  // Handle rich_text blocks (paragraph, heading, etc.)
  if (blockData.rich_text && Array.isArray(blockData.rich_text)) {
    return blockData.rich_text.map((t: { plain_text: string }) => t.plain_text).join('');
  }

  // Handle other block types
  switch (type) {
    case 'to_do':
      const checked = blockData.checked ? '[x]' : '[ ]';
      const text = (blockData.rich_text as Array<{ plain_text: string }>)?.map(t => t.plain_text).join('') || '';
      return `${checked} ${text}`;
    case 'code':
      return `\`\`\`${blockData.language || ''}\n${(blockData.rich_text as Array<{ plain_text: string }>)?.map(t => t.plain_text).join('')}\n\`\`\``;
    case 'image':
      const imageUrl = (blockData as { external?: { url: string }; file?: { url: string } }).external?.url ||
                       (blockData as { external?: { url: string }; file?: { url: string } }).file?.url;
      return `[Image: ${imageUrl}]`;
    default:
      return '';
  }
}
