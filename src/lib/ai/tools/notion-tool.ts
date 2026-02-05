/**
 * NOTION TOOL
 * ===========
 *
 * AI tool for managing Notion pages, databases, and workspace search.
 */

import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { decrypt as decryptToken } from '@/lib/security/crypto';
import {
  search,
  getPage,
  createPage,
  archivePage,
  getBlocks,
  appendBlocks,
  getDatabase,
  queryDatabase,
  createDatabaseItem,
  buildParagraphBlock,
  buildTodoBlock,
  buildHeadingBlock,
  buildBulletBlock,
  isNotionConfigured,
} from '@/lib/connectors/notion';
import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '@/lib/ai/providers/types';

const log = logger('NotionTool');

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const notionTool: UnifiedTool = {
  name: 'notion',
  description: `Manage Notion workspace - create pages, search content, and work with databases. Use this tool when the user wants to:
- Search their Notion workspace
- Create new pages or notes
- Add content to existing pages
- Query databases (task lists, project trackers, etc.)
- Add items to databases
- Read page content

IMPORTANT: This tool requires the user to have connected their Notion account in Settings > Connectors.
The user must also share specific pages/databases with the integration for access.`,
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: [
          'search',
          'get_page',
          'create_page',
          'add_content',
          'get_database',
          'query_database',
          'add_database_item',
          'archive_page',
        ],
        description: 'The action to perform',
      },
      query: {
        type: 'string',
        description: 'Search query (for search action)',
      },
      page_id: {
        type: 'string',
        description: 'Page ID (for get_page, add_content, archive_page)',
      },
      database_id: {
        type: 'string',
        description: 'Database ID (for database operations)',
      },
      title: {
        type: 'string',
        description: 'Page or item title (for create_page, add_database_item)',
      },
      content: {
        type: 'string',
        description: 'Content to add (for create_page, add_content)',
      },
      content_type: {
        type: 'string',
        enum: ['paragraph', 'todo', 'heading', 'bullet'],
        description: 'Type of content block (default: paragraph)',
      },
      properties: {
        type: 'object',
        description: 'Properties for database item (for add_database_item)',
      },
      filter: {
        type: 'object',
        description: 'Filter for database query',
      },
      limit: {
        type: 'number',
        description: 'Number of results (default: 10)',
      },
    },
    required: ['action'],
  },
};

// ============================================================================
// TOOL EXECUTION
// ============================================================================

interface NotionToolArgs {
  action: string;
  query?: string;
  page_id?: string;
  database_id?: string;
  title?: string;
  content?: string;
  content_type?: 'paragraph' | 'todo' | 'heading' | 'bullet';
  properties?: Record<string, unknown>;
  filter?: Record<string, unknown>;
  limit?: number;
}

/**
 * Get Notion access token for a user
 */
async function getAccessToken(userId: string): Promise<string | null> {
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: userData, error } = await adminClient
    .from('users')
    .select('notion_access_token')
    .eq('id', userId)
    .single();

  if (error || !userData?.notion_access_token) {
    return null;
  }

  try {
    return decryptToken(userData.notion_access_token);
  } catch {
    return null;
  }
}

/**
 * Extract plain text from Notion rich text array
 */
function extractPlainText(richText: Array<{ plain_text: string }> | undefined): string {
  if (!richText) return '';
  return richText.map((t) => t.plain_text).join('');
}

/**
 * Get page title from properties
 */
function getPageTitle(properties: Record<string, { title?: Array<{ plain_text: string }>; [key: string]: unknown }>): string {
  // Find the title property
  for (const [, prop] of Object.entries(properties)) {
    if (prop.title) {
      return extractPlainText(prop.title);
    }
  }
  return 'Untitled';
}

export async function executeNotion(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = (typeof toolCall.arguments === 'string'
    ? JSON.parse(toolCall.arguments)
    : toolCall.arguments) as NotionToolArgs;

  // Check if Notion is configured
  if (!isNotionConfigured()) {
    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({
        error: 'Notion integration is not configured on this server.',
        suggestion: 'Please contact the administrator to set up Notion integration.',
      }),
      isError: true,
    };
  }

  // Get user ID
  const userId = toolCall.sessionId;
  if (!userId) {
    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({
        error: 'Could not identify user session.',
        suggestion: 'Please try again or refresh the page.',
      }),
      isError: true,
    };
  }

  // Get access token
  const accessToken = await getAccessToken(userId);
  if (!accessToken) {
    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({
        error: 'Notion is not connected.',
        suggestion: 'Please connect your Notion account in Settings > Connectors.',
        action_required: 'connect_notion',
      }),
      isError: true,
    };
  }

  const limit = args.limit || 10;

  try {
    switch (args.action) {
      case 'search': {
        if (!args.query) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: 'Search query is required' }),
            isError: true,
          };
        }

        const results = await search(accessToken, args.query, { page_size: limit });

        const formatted = results.results.map((item) => {
          if (item.object === 'page') {
            return {
              type: 'page',
              id: item.id,
              title: getPageTitle(item.properties as Record<string, { title?: Array<{ plain_text: string }> }>),
              url: item.url,
              last_edited: item.last_edited_time,
            };
          } else {
            return {
              type: 'database',
              id: item.id,
              title: extractPlainText(item.title),
              url: item.url,
            };
          }
        });

        return {
          toolCallId: toolCall.id,
          content: JSON.stringify({
            results: formatted,
            count: formatted.length,
            has_more: results.has_more,
          }),
        };
      }

      case 'get_page': {
        if (!args.page_id) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: 'Page ID is required' }),
            isError: true,
          };
        }

        const page = await getPage(accessToken, args.page_id);
        const blocks = await getBlocks(accessToken, args.page_id, 50);

        // Extract content from blocks
        const content = blocks.results.map((block) => {
          const type = block.type;
          let text = '';

          if (block.paragraph) {
            text = extractPlainText(block.paragraph.rich_text);
          } else if (block.heading_1) {
            text = `# ${extractPlainText(block.heading_1.rich_text)}`;
          } else if (block.heading_2) {
            text = `## ${extractPlainText(block.heading_2.rich_text)}`;
          } else if (block.heading_3) {
            text = `### ${extractPlainText(block.heading_3.rich_text)}`;
          } else if (block.bulleted_list_item) {
            text = `• ${extractPlainText(block.bulleted_list_item.rich_text)}`;
          } else if (block.numbered_list_item) {
            text = extractPlainText(block.numbered_list_item.rich_text);
          } else if (block.to_do) {
            const checked = block.to_do.checked ? '☑' : '☐';
            text = `${checked} ${extractPlainText(block.to_do.rich_text)}`;
          } else if (block.code) {
            text = `\`\`\`${block.code.language}\n${extractPlainText(block.code.rich_text)}\n\`\`\``;
          }

          return { type, text };
        }).filter((b) => b.text);

        return {
          toolCallId: toolCall.id,
          content: JSON.stringify({
            page: {
              id: page.id,
              title: getPageTitle(page.properties as Record<string, { title?: Array<{ plain_text: string }> }>),
              url: page.url,
              last_edited: page.last_edited_time,
            },
            content: content.map((c) => c.text).join('\n'),
          }),
        };
      }

      case 'create_page': {
        if (!args.title) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: 'Page title is required' }),
            isError: true,
          };
        }

        // Create as a workspace-level page
        const children = [];
        if (args.content) {
          const contentType = args.content_type || 'paragraph';
          switch (contentType) {
            case 'heading':
              children.push(buildHeadingBlock(args.content, 1));
              break;
            case 'todo':
              children.push(buildTodoBlock(args.content));
              break;
            case 'bullet':
              children.push(buildBulletBlock(args.content));
              break;
            default:
              children.push(buildParagraphBlock(args.content));
          }
        }

        // If we have a page_id, create as a child of that page
        const parent = args.page_id
          ? { page_id: args.page_id }
          : { page_id: args.page_id }; // Notion requires a parent

        const page = await createPage(
          accessToken,
          parent,
          {
            title: {
              title: [{ text: { content: args.title } }],
            },
          },
          children.length > 0 ? children : undefined
        );

        return {
          toolCallId: toolCall.id,
          content: JSON.stringify({
            success: true,
            page: {
              id: page.id,
              title: args.title,
              url: page.url,
            },
            message: 'Page created successfully.',
          }),
        };
      }

      case 'add_content': {
        if (!args.page_id) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: 'Page ID is required' }),
            isError: true,
          };
        }
        if (!args.content) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: 'Content is required' }),
            isError: true,
          };
        }

        const contentType = args.content_type || 'paragraph';
        let block;
        switch (contentType) {
          case 'heading':
            block = buildHeadingBlock(args.content, 1);
            break;
          case 'todo':
            block = buildTodoBlock(args.content);
            break;
          case 'bullet':
            block = buildBulletBlock(args.content);
            break;
          default:
            block = buildParagraphBlock(args.content);
        }

        await appendBlocks(accessToken, args.page_id, [block]);

        return {
          toolCallId: toolCall.id,
          content: JSON.stringify({
            success: true,
            message: `Added ${contentType} to page.`,
          }),
        };
      }

      case 'get_database': {
        if (!args.database_id) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: 'Database ID is required' }),
            isError: true,
          };
        }

        const database = await getDatabase(accessToken, args.database_id);

        return {
          toolCallId: toolCall.id,
          content: JSON.stringify({
            database: {
              id: database.id,
              title: extractPlainText(database.title),
              url: database.url,
              properties: Object.entries(database.properties).map(([name, prop]) => ({
                name,
                type: prop.type,
              })),
            },
          }),
        };
      }

      case 'query_database': {
        if (!args.database_id) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: 'Database ID is required' }),
            isError: true,
          };
        }

        const results = await queryDatabase(accessToken, args.database_id, {
          filter: args.filter,
          page_size: limit,
        });

        const items = results.results.map((page) => {
          const props: Record<string, unknown> = {};
          for (const [name, prop] of Object.entries(page.properties)) {
            if (prop.title) {
              props[name] = extractPlainText(prop.title);
            } else if (prop.rich_text) {
              props[name] = extractPlainText(prop.rich_text);
            } else if (prop.number !== undefined) {
              props[name] = prop.number;
            } else if (prop.select) {
              props[name] = prop.select.name;
            } else if (prop.multi_select) {
              props[name] = prop.multi_select.map((s) => s.name);
            } else if (prop.date) {
              props[name] = prop.date.start;
            } else if (prop.checkbox !== undefined) {
              props[name] = prop.checkbox;
            } else if (prop.status) {
              props[name] = prop.status.name;
            } else if (prop.url) {
              props[name] = prop.url;
            } else if (prop.email) {
              props[name] = prop.email;
            }
          }
          return {
            id: page.id,
            url: page.url,
            properties: props,
          };
        });

        return {
          toolCallId: toolCall.id,
          content: JSON.stringify({
            items,
            count: items.length,
            has_more: results.has_more,
          }),
        };
      }

      case 'add_database_item': {
        if (!args.database_id) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: 'Database ID is required' }),
            isError: true,
          };
        }
        if (!args.title && !args.properties) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: 'Title or properties are required' }),
            isError: true,
          };
        }

        // Build properties
        const properties: Record<string, unknown> = args.properties || {};

        // If title is provided, try to add it as the title property
        if (args.title) {
          // Get database to find the title property name
          const database = await getDatabase(accessToken, args.database_id);
          for (const [name, prop] of Object.entries(database.properties)) {
            if (prop.type === 'title') {
              properties[name] = {
                title: [{ text: { content: args.title } }],
              };
              break;
            }
          }
        }

        const item = await createDatabaseItem(accessToken, args.database_id, properties);

        return {
          toolCallId: toolCall.id,
          content: JSON.stringify({
            success: true,
            item: {
              id: item.id,
              url: item.url,
            },
            message: 'Item added to database.',
          }),
        };
      }

      case 'archive_page': {
        if (!args.page_id) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({ error: 'Page ID is required' }),
            isError: true,
          };
        }

        await archivePage(accessToken, args.page_id);

        return {
          toolCallId: toolCall.id,
          content: JSON.stringify({
            success: true,
            message: 'Page archived successfully.',
          }),
        };
      }

      default:
        return {
          toolCallId: toolCall.id,
          content: JSON.stringify({ error: `Unknown action: ${args.action}` }),
          isError: true,
        };
    }
  } catch (error) {
    log.error('Notion tool error', { action: args.action, error });

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes('401') || errorMessage.includes('unauthorized')) {
      return {
        toolCallId: toolCall.id,
        content: JSON.stringify({
          error: 'Notion authorization expired or revoked.',
          suggestion: 'Please reconnect your Notion account in Settings > Connectors.',
          action_required: 'reconnect_notion',
        }),
        isError: true,
      };
    }

    if (errorMessage.includes('object_not_found') || errorMessage.includes('404')) {
      return {
        toolCallId: toolCall.id,
        content: JSON.stringify({
          error: 'Page or database not found.',
          suggestion: 'Make sure the page/database is shared with your JCIL integration in Notion.',
        }),
        isError: true,
      };
    }

    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({ error: errorMessage }),
      isError: true,
    };
  }
}

/**
 * Check if Notion tool is available
 */
export function isNotionToolAvailable(): boolean {
  return isNotionConfigured();
}
