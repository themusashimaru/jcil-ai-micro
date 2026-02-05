/**
 * NOTION CONNECTOR
 * ================
 *
 * OAuth-based Notion integration for workspace management.
 * Supports pages, databases, and search.
 */

import { logger } from '@/lib/logger';

const log = logger('NotionConnector');

// ============================================================================
// CONFIGURATION
// ============================================================================

const NOTION_CLIENT_ID = process.env.NOTION_CLIENT_ID;
const NOTION_CLIENT_SECRET = process.env.NOTION_CLIENT_SECRET;
const NOTION_REDIRECT_URI =
  process.env.NOTION_REDIRECT_URI ||
  `${process.env.NEXT_PUBLIC_APP_URL}/api/connectors/notion/callback`;

const NOTION_AUTH_URL = 'https://api.notion.com/v1/oauth/authorize';
const NOTION_TOKEN_URL = 'https://api.notion.com/v1/oauth/token';
const NOTION_API_BASE = 'https://api.notion.com/v1';
const NOTION_API_VERSION = '2022-06-28';

// ============================================================================
// CONFIGURATION CHECK
// ============================================================================

export function isNotionConfigured(): boolean {
  return !!(NOTION_CLIENT_ID && NOTION_CLIENT_SECRET);
}

// ============================================================================
// OAUTH HELPERS
// ============================================================================

/**
 * Generate the Notion authorization URL
 */
export function getNotionAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: NOTION_CLIENT_ID!,
    response_type: 'code',
    redirect_uri: NOTION_REDIRECT_URI!,
    owner: 'user',
    state,
  });

  return `${NOTION_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForTokens(code: string): Promise<NotionTokenResponse> {
  const credentials = Buffer.from(`${NOTION_CLIENT_ID}:${NOTION_CLIENT_SECRET}`).toString('base64');

  const response = await fetch(NOTION_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${credentials}`,
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri: NOTION_REDIRECT_URI,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    log.error('Token exchange failed', { status: response.status, error });
    throw new Error(`Token exchange failed: ${error}`);
  }

  return response.json();
}

// ============================================================================
// API HELPERS
// ============================================================================

async function notionRequest<T>(
  accessToken: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = endpoint.startsWith('http') ? endpoint : `${NOTION_API_BASE}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Notion-Version': NOTION_API_VERSION,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    log.error('Notion API error', { endpoint, status: response.status, error });
    throw new Error(`Notion API error: ${response.status} - ${error}`);
  }

  return response.json();
}

// ============================================================================
// TYPES
// ============================================================================

export interface NotionTokenResponse {
  access_token: string;
  token_type: string;
  bot_id: string;
  workspace_id: string;
  workspace_name?: string;
  workspace_icon?: string;
  owner: {
    type: string;
    user?: {
      id: string;
      name?: string;
      avatar_url?: string;
      type: string;
      person?: {
        email?: string;
      };
    };
  };
  duplicated_template_id?: string;
}

export interface NotionUser {
  object: 'user';
  id: string;
  name?: string;
  avatar_url?: string;
  type: string;
  person?: {
    email?: string;
  };
}

export interface NotionPage {
  object: 'page';
  id: string;
  created_time: string;
  last_edited_time: string;
  archived: boolean;
  icon?: {
    type: string;
    emoji?: string;
    external?: { url: string };
  };
  cover?: {
    type: string;
    external?: { url: string };
  };
  properties: Record<string, NotionProperty>;
  parent: {
    type: string;
    page_id?: string;
    database_id?: string;
    workspace?: boolean;
  };
  url: string;
}

export interface NotionProperty {
  id: string;
  type: string;
  title?: Array<{ plain_text: string }>;
  rich_text?: Array<{ plain_text: string }>;
  number?: number;
  select?: { name: string };
  multi_select?: Array<{ name: string }>;
  date?: { start: string; end?: string };
  checkbox?: boolean;
  url?: string;
  email?: string;
  phone_number?: string;
  status?: { name: string };
}

export interface NotionDatabase {
  object: 'database';
  id: string;
  title: Array<{ plain_text: string }>;
  description: Array<{ plain_text: string }>;
  properties: Record<string, NotionDatabaseProperty>;
  parent: {
    type: string;
    page_id?: string;
    workspace?: boolean;
  };
  url: string;
}

export interface NotionDatabaseProperty {
  id: string;
  name: string;
  type: string;
  title?: Record<string, never>;
  rich_text?: Record<string, never>;
  number?: { format: string };
  select?: { options: Array<{ name: string; color: string }> };
  multi_select?: { options: Array<{ name: string; color: string }> };
  date?: Record<string, never>;
  checkbox?: Record<string, never>;
  status?: { options: Array<{ name: string; color: string }> };
}

export interface NotionSearchResult {
  object: 'list';
  results: Array<NotionPage | NotionDatabase>;
  next_cursor: string | null;
  has_more: boolean;
}

export interface NotionBlock {
  object: 'block';
  id: string;
  type: string;
  created_time: string;
  last_edited_time: string;
  has_children: boolean;
  archived: boolean;
  paragraph?: {
    rich_text: Array<{ plain_text: string }>;
  };
  heading_1?: {
    rich_text: Array<{ plain_text: string }>;
  };
  heading_2?: {
    rich_text: Array<{ plain_text: string }>;
  };
  heading_3?: {
    rich_text: Array<{ plain_text: string }>;
  };
  bulleted_list_item?: {
    rich_text: Array<{ plain_text: string }>;
  };
  numbered_list_item?: {
    rich_text: Array<{ plain_text: string }>;
  };
  to_do?: {
    rich_text: Array<{ plain_text: string }>;
    checked: boolean;
  };
  toggle?: {
    rich_text: Array<{ plain_text: string }>;
  };
  code?: {
    rich_text: Array<{ plain_text: string }>;
    language: string;
  };
}

// ============================================================================
// USER / WORKSPACE
// ============================================================================

/**
 * Get the current user (bot info)
 */
export async function getCurrentUser(accessToken: string): Promise<NotionUser> {
  return notionRequest<NotionUser>(accessToken, '/users/me');
}

// ============================================================================
// SEARCH
// ============================================================================

/**
 * Search the workspace
 */
export async function search(
  accessToken: string,
  query: string,
  options: {
    filter?: { property: string; value: string };
    sort?: { direction: 'ascending' | 'descending'; timestamp: 'last_edited_time' };
    page_size?: number;
  } = {}
): Promise<NotionSearchResult> {
  return notionRequest<NotionSearchResult>(accessToken, '/search', {
    method: 'POST',
    body: JSON.stringify({
      query,
      filter: options.filter,
      sort: options.sort,
      page_size: options.page_size || 10,
    }),
  });
}

// ============================================================================
// PAGES
// ============================================================================

/**
 * Get a page by ID
 */
export async function getPage(accessToken: string, pageId: string): Promise<NotionPage> {
  return notionRequest<NotionPage>(accessToken, `/pages/${pageId}`);
}

/**
 * Create a new page
 */
export async function createPage(
  accessToken: string,
  parent: { page_id?: string; database_id?: string },
  properties: Record<string, unknown>,
  children?: Array<{
    object: 'block';
    type: string;
    [key: string]: unknown;
  }>
): Promise<NotionPage> {
  const body: Record<string, unknown> = {
    parent,
    properties,
  };

  if (children) {
    body.children = children;
  }

  return notionRequest<NotionPage>(accessToken, '/pages', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * Update page properties
 */
export async function updatePage(
  accessToken: string,
  pageId: string,
  properties: Record<string, unknown>
): Promise<NotionPage> {
  return notionRequest<NotionPage>(accessToken, `/pages/${pageId}`, {
    method: 'PATCH',
    body: JSON.stringify({ properties }),
  });
}

/**
 * Archive (delete) a page
 */
export async function archivePage(accessToken: string, pageId: string): Promise<NotionPage> {
  return notionRequest<NotionPage>(accessToken, `/pages/${pageId}`, {
    method: 'PATCH',
    body: JSON.stringify({ archived: true }),
  });
}

// ============================================================================
// BLOCKS (PAGE CONTENT)
// ============================================================================

/**
 * Get blocks (content) of a page
 */
export async function getBlocks(
  accessToken: string,
  blockId: string,
  pageSize: number = 50
): Promise<{ results: NotionBlock[]; has_more: boolean; next_cursor: string | null }> {
  return notionRequest(accessToken, `/blocks/${blockId}/children?page_size=${pageSize}`);
}

/**
 * Append blocks to a page
 */
export async function appendBlocks(
  accessToken: string,
  blockId: string,
  children: Array<{
    object: 'block';
    type: string;
    [key: string]: unknown;
  }>
): Promise<{ results: NotionBlock[] }> {
  return notionRequest(accessToken, `/blocks/${blockId}/children`, {
    method: 'PATCH',
    body: JSON.stringify({ children }),
  });
}

// ============================================================================
// DATABASES
// ============================================================================

/**
 * Get a database by ID
 */
export async function getDatabase(accessToken: string, databaseId: string): Promise<NotionDatabase> {
  return notionRequest<NotionDatabase>(accessToken, `/databases/${databaseId}`);
}

/**
 * Query a database
 */
export async function queryDatabase(
  accessToken: string,
  databaseId: string,
  options: {
    filter?: Record<string, unknown>;
    sorts?: Array<{ property: string; direction: 'ascending' | 'descending' }>;
    page_size?: number;
  } = {}
): Promise<{ results: NotionPage[]; has_more: boolean; next_cursor: string | null }> {
  return notionRequest(accessToken, `/databases/${databaseId}/query`, {
    method: 'POST',
    body: JSON.stringify({
      filter: options.filter,
      sorts: options.sorts,
      page_size: options.page_size || 50,
    }),
  });
}

/**
 * Create a database item (row)
 */
export async function createDatabaseItem(
  accessToken: string,
  databaseId: string,
  properties: Record<string, unknown>
): Promise<NotionPage> {
  return createPage(accessToken, { database_id: databaseId }, properties);
}

// ============================================================================
// HELPER: BUILD BLOCK CONTENT
// ============================================================================

/**
 * Create a paragraph block
 */
export function buildParagraphBlock(text: string): { object: 'block'; type: 'paragraph'; paragraph: { rich_text: Array<{ type: 'text'; text: { content: string } }> } } {
  return {
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [{ type: 'text', text: { content: text } }],
    },
  };
}

/**
 * Create a to-do block
 */
export function buildTodoBlock(text: string, checked: boolean = false): { object: 'block'; type: 'to_do'; to_do: { rich_text: Array<{ type: 'text'; text: { content: string } }>; checked: boolean } } {
  return {
    object: 'block',
    type: 'to_do',
    to_do: {
      rich_text: [{ type: 'text', text: { content: text } }],
      checked,
    },
  };
}

/**
 * Create a heading block
 */
export function buildHeadingBlock(text: string, level: 1 | 2 | 3 = 1): { object: 'block'; type: string; [key: string]: unknown } {
  const type = `heading_${level}` as const;
  return {
    object: 'block',
    type,
    [type]: {
      rich_text: [{ type: 'text', text: { content: text } }],
    },
  };
}

/**
 * Create a bulleted list item
 */
export function buildBulletBlock(text: string): { object: 'block'; type: 'bulleted_list_item'; bulleted_list_item: { rich_text: Array<{ type: 'text'; text: { content: string } }> } } {
  return {
    object: 'block',
    type: 'bulleted_list_item',
    bulleted_list_item: {
      rich_text: [{ type: 'text', text: { content: text } }],
    },
  };
}

// ============================================================================
// CONNECTION STATUS
// ============================================================================

export interface NotionConnectionStatus {
  configured: boolean;
  connected: boolean;
  workspaceId?: string;
  workspaceName?: string;
  userName?: string;
  userEmail?: string;
  connectedAt?: string;
  error?: string;
}

export async function getNotionConnectionStatus(accessToken: string): Promise<NotionConnectionStatus> {
  try {
    const user = await getCurrentUser(accessToken);
    return {
      configured: true,
      connected: true,
      userName: user.name,
      userEmail: user.person?.email,
    };
  } catch (error) {
    log.error('Failed to get Notion connection status', { error });
    return {
      configured: true,
      connected: false,
      error: 'Failed to verify connection',
    };
  }
}
