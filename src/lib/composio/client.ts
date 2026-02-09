/**
 * COMPOSIO CLIENT
 * ===============
 *
 * Wrapper around Composio SDK for managing 500+ app integrations.
 * Handles authentication, tool execution, and connection management.
 *
 * Uses @composio/anthropic provider for Claude-formatted tools.
 */

import { Composio } from '@composio/core';
import { AnthropicProvider } from '@composio/anthropic';
import { logger } from '@/lib/logger';
import type {
  ConnectedAccount,
  ConnectionRequest,
  ConnectionStatus,
  ToolExecutionResult,
  ComposioTool,
} from './types';
import { getToolkitById, composioSlugToToolkitId } from './toolkits';
import {
  getCachedConnections,
  isCacheFresh,
  saveConnectionsToCache,
  saveSingleConnectionToCache,
  removeConnectionFromCache,
  withRetry,
} from './connection-cache';

// Type helper for Composio SDK (API types not fully exported)
/* eslint-disable @typescript-eslint/no-explicit-any */
type ComposioClient = any;

const log = logger('ComposioClient');

// ============================================================================
// CONFIGURATION
// ============================================================================

const COMPOSIO_API_KEY = process.env.COMPOSIO_API_KEY;

if (!COMPOSIO_API_KEY) {
  log.warn('COMPOSIO_API_KEY not set - Composio integrations will not work');
}

// ============================================================================
// CLIENT SINGLETONS
// ============================================================================

// Regular client for connection management
let composioClient: ComposioClient | null = null;

// Client with Anthropic provider for formatted tools
let anthropicComposioClient: ComposioClient | null = null;

function getClient(): ComposioClient {
  if (!composioClient) {
    if (!COMPOSIO_API_KEY) {
      throw new Error('COMPOSIO_API_KEY is not configured');
    }
    composioClient = new Composio({ apiKey: COMPOSIO_API_KEY });
  }
  return composioClient;
}

/**
 * Get Composio client configured with AnthropicProvider
 * This returns tools pre-formatted for Claude/Anthropic API
 */
function getAnthropicClient(): ComposioClient {
  if (!anthropicComposioClient) {
    if (!COMPOSIO_API_KEY) {
      throw new Error('COMPOSIO_API_KEY is not configured');
    }
    anthropicComposioClient = new Composio({
      apiKey: COMPOSIO_API_KEY,
      provider: new AnthropicProvider(),
    });
    log.info('Initialized Composio with AnthropicProvider for Claude-formatted tools');
  }
  return anthropicComposioClient;
}

// ============================================================================
// HELPERS - TOOLKIT SLUG FORMATTING
// ============================================================================

/**
 * Convert internal toolkit ID to Composio API slug format
 * Composio uses lowercase slugs WITHOUT underscores:
 * - GOOGLE_SHEETS -> googlesheets
 * - GOOGLE_CALENDAR -> googlecalendar
 * - MICROSOFT_TEAMS -> microsoftteams
 */
function toComposioSlug(toolkit: string): string {
  return toolkit.toLowerCase().replace(/_/g, '');
}

// ============================================================================
// CONNECTION MANAGEMENT
// ============================================================================

/**
 * Initiate OAuth connection for a toolkit
 * Returns a redirect URL for the user to complete auth
 *
 * Note: This uses Composio's link method which handles auth config lookup
 */
export async function initiateConnection(
  userId: string,
  toolkit: string,
  redirectUrl?: string
): Promise<ConnectionRequest> {
  const client = getClient();

  try {
    log.info('Initiating connection', { userId, toolkit });

    // Convert to Composio's slug format (lowercase, no underscores)
    // e.g., GOOGLE_SHEETS -> googlesheets
    const toolkitSlug = toComposioSlug(toolkit);

    log.info('Looking up auth configs', { toolkitSlug });

    // Try to list existing auth configs for this toolkit
    // SDK API: authConfigs.list({ toolkit_slug: 'app_name' })
    const authConfigs = await client.authConfigs.list({
      toolkit_slug: toolkitSlug,
    });

    log.info('Auth configs lookup result', {
      toolkitSlug,
      itemCount: authConfigs.items?.length || 0,
      items: authConfigs.items?.slice(0, 3).map((item: any) => ({
        id: item.id,
        toolkit: item.toolkit?.slug || item.toolkit,
        name: item.name,
      })),
    });

    let authConfigId: string;

    // Find an auth config that actually matches the requested toolkit
    const matchedConfig = authConfigs.items?.find((item: any) => {
      const configSlug = (item.toolkit?.slug || item.toolkit || '').toLowerCase();
      return configSlug === toolkitSlug;
    });

    if (matchedConfig) {
      // Use the verified matching auth config
      authConfigId = matchedConfig.id;
      log.info('Using existing auth config (verified match)', {
        authConfigId,
        configToolkit: matchedConfig.toolkit?.slug || matchedConfig.toolkit,
        requestedToolkit: toolkitSlug,
      });
    } else {
      // Create a new managed auth config for this toolkit
      // SDK API: authConfigs.create(toolkitSlug, { name, type })
      // NOTE: Toolkit slug is FIRST positional arg, then options object
      log.info('No existing auth config found, creating new one', { toolkitSlug });
      const newConfig = await client.authConfigs.create(toolkitSlug, {
        name: `${toolkit} Auth`,
        type: 'use_composio_managed_auth',
      });
      // Response structure may vary - try multiple paths
      authConfigId = newConfig.id || newConfig.auth_config?.id;
      log.info('Created new auth config', {
        authConfigId,
        responseToolkit: newConfig.toolkit?.slug,
        requestedToolkit: toolkitSlug,
      });
    }

    // Now initiate the connection using the auth config
    // SDK API: connectedAccounts.initiate(userId, authConfigId, options)
    // SDK expects 'callbackUrl' not 'redirectUrl'!
    // allowMultiple: true allows users to reconnect or have multiple accounts
    log.info('Initiating connection with auth config', { authConfigId, toolkitSlug });
    const connectionRequest = await client.connectedAccounts.initiate(userId, authConfigId, {
      callbackUrl: redirectUrl,
      allowMultiple: true,
    });

    log.info('Connection initiated successfully', {
      connectionId: connectionRequest.id,
      redirectUrl: connectionRequest.redirectUrl?.substring(0, 100), // Log partial URL for debugging
      toolkit: toolkitSlug,
    });

    return {
      id: connectionRequest.id,
      redirectUrl: connectionRequest.redirectUrl,
      status: 'initiated',
    };
  } catch (error) {
    log.error('Failed to initiate connection', { userId, toolkit, error });
    throw error;
  }
}

/**
 * Connect using API key authentication
 * For apps like ElevenLabs, Stripe, Sentry that require API keys
 */
export async function connectWithApiKey(
  userId: string,
  toolkit: string,
  apiKey: string
): Promise<{ success: boolean; connectionId?: string; error?: string }> {
  const client = getClient();

  try {
    log.info('Connecting with API key', { userId, toolkit });

    // Convert to Composio's slug format (lowercase, no underscores)
    const toolkitSlug = toComposioSlug(toolkit);

    // For API key auth, we need to create a custom auth config with the key
    // and then create a connected account using that config
    log.info('Creating API key auth config', { toolkitSlug });

    // Create auth config with API key type
    // The exact field name varies by app - common patterns are:
    // - api_key, apiKey, API_KEY
    // - x-api-key
    // - Authorization header
    const authConfig = await client.authConfigs.create(toolkitSlug, {
      name: `${toolkit} API Key`,
      type: 'custom_auth', // Use custom auth for API keys
      credentials: {
        api_key: apiKey,
        apiKey: apiKey,
        API_KEY: apiKey,
      },
    });

    const authConfigId = authConfig.id || authConfig.auth_config?.id;
    log.info('Created API key auth config', { authConfigId, toolkitSlug });

    // Create the connected account directly (no OAuth redirect needed)
    const connectedAccount = await client.connectedAccounts.create({
      authConfigId,
      userId,
    });

    log.info('API key connection created', {
      connectionId: connectedAccount.id,
      toolkit: toolkitSlug,
      status: connectedAccount.status,
    });

    return {
      success: true,
      connectionId: connectedAccount.id,
    };
  } catch (error) {
    log.error('Failed to connect with API key', { userId, toolkit, error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to connect with API key',
    };
  }
}

/**
 * Wait for a connection to become active
 * Uses SDK's built-in waitForConnection method
 *
 * Also saves the connection to local cache on success
 */
export async function waitForConnection(
  connectionId: string,
  timeoutMs: number = 60000,
  userId?: string
): Promise<ConnectedAccount | null> {
  const client = getClient();

  try {
    log.info('Waiting for connection to become active', { connectionId, timeoutMs });

    // SDK has built-in waitForConnection(connectedAccountId, timeout)
    const account = await client.connectedAccounts.waitForConnection(connectionId, timeoutMs);

    if (account) {
      log.info('Connection became active', {
        connectionId,
        status: account.status,
        toolkit: account.toolkit?.slug,
      });
      const mappedAccount = mapComposioAccount(account);

      // Save to local cache if we have the userId
      if (userId && mappedAccount.status === 'connected') {
        await saveSingleConnectionToCache(userId, mappedAccount);
      }

      return mappedAccount;
    }

    log.warn('Connection did not become active', { connectionId });
    return null;
  } catch (error) {
    // SDK throws specific errors for timeout, failed, etc.
    log.error('Error waiting for connection', { connectionId, error });
    return null;
  }
}

/**
 * Get all connected accounts for a user
 *
 * Uses a local cache to prevent connections from appearing "dropped"
 * when the Composio API is slow or returns stale data.
 *
 * Strategy:
 * 1. Check if cache is fresh (within TTL)
 * 2. If fresh, return cached connections
 * 3. If stale, try to refresh from Composio API (with retries)
 * 4. If API fails, return cached connections (stale but better than empty)
 * 5. Save successful API responses to cache
 */
export async function getConnectedAccounts(userId: string): Promise<ConnectedAccount[]> {
  // Check if we have fresh cached connections
  const cacheFresh = await isCacheFresh(userId);
  if (cacheFresh) {
    const cached = await getCachedConnections(userId);
    if (cached && cached.length > 0) {
      log.info('Using fresh cached connections', {
        userId,
        count: cached.length,
        toolkits: cached.map((c) => c.toolkit),
      });
      return cached;
    }
  }

  // Cache is stale or empty - try to refresh from Composio API
  const client = getClient();

  try {
    // Use retry logic to handle transient API failures
    const accounts = await withRetry(
      async () => {
        return await client.connectedAccounts.list({
          userIds: [userId],
        });
      },
      {
        maxRetries: 3,
        baseDelay: 1000,
        operationName: 'getConnectedAccounts',
      }
    );

    log.info('Got connected accounts from Composio', {
      userId,
      count: accounts.items?.length || 0,
      accounts: accounts.items?.map((a: any) => ({
        id: a.id,
        status: a.status,
        toolkit: a.toolkit?.slug || a.integrationId || a.appName,
      })),
    });

    const mappedAccounts = (accounts.items || []).map(mapComposioAccount);

    // Save to local cache for future requests
    await saveConnectionsToCache(userId, mappedAccounts);

    return mappedAccounts;
  } catch (error) {
    log.error('Failed to get connected accounts from Composio API', { userId, error });

    // Fallback to cached connections (even if stale)
    const cached = await getCachedConnections(userId);
    if (cached && cached.length > 0) {
      log.warn('Using stale cached connections as fallback', {
        userId,
        count: cached.length,
        toolkits: cached.map((c) => c.toolkit),
      });
      return cached;
    }

    // No cache available - return empty
    return [];
  }
}

/**
 * Get a specific connected account
 */
export async function getConnectedAccount(connectionId: string): Promise<ConnectedAccount | null> {
  const client = getClient();

  try {
    const account = await client.connectedAccounts.get(connectionId);
    return mapComposioAccount(account);
  } catch (error) {
    log.error('Failed to get connected account', { connectionId, error });
    return null;
  }
}

/**
 * Disconnect an account
 *
 * Also updates the local cache to mark the connection as disconnected
 */
export async function disconnectAccount(
  connectionId: string,
  userId?: string,
  toolkit?: string
): Promise<boolean> {
  const client = getClient();

  try {
    await client.connectedAccounts.delete(connectionId);
    log.info('Account disconnected', { connectionId });

    // Update local cache if we have userId and toolkit
    if (userId && toolkit) {
      await removeConnectionFromCache(userId, toolkit);
    }

    return true;
  } catch (error) {
    log.error('Failed to disconnect account', { connectionId, error });
    return false;
  }
}

// ============================================================================
// TOOL EXECUTION
// ============================================================================

/**
 * Execute a tool action for a user
 * SDK API: tools.execute('TOOL_SLUG', { userId, arguments, dangerouslySkipVersionCheck })
 */
export async function executeTool(
  userId: string,
  toolName: string,
  params: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const client = getClient();

  try {
    log.info('Executing tool', { userId, toolName, params });

    // SDK execute: tools.execute(toolSlug, { userId, arguments, ... })
    const result = await client.tools.execute(toolName, {
      userId: userId,
      arguments: params,
      dangerouslySkipVersionCheck: true, // Allow latest version for now
    });

    log.info('Tool executed successfully', { userId, toolName, result: result?.data });

    return {
      success: true,
      data: result?.data || result,
    };
  } catch (error) {
    log.error('Tool execution failed', { userId, toolName, error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get available tools for a user (based on their connected accounts)
 *
 * Uses AnthropicProvider to get tools pre-formatted for Claude/Anthropic API.
 * SDK API: tools.get(userId, { toolkits: ['GITHUB', 'GMAIL'] })
 *
 * The AnthropicProvider returns tools with proper input_schema format:
 * { name, description, input_schema: { type: 'object', properties, required } }
 */
export async function getAvailableTools(
  userId: string,
  toolkits?: string[]
): Promise<ComposioTool[]> {
  try {
    if (!toolkits || toolkits.length === 0) {
      log.info('No toolkits provided, returning empty tools list');
      return [];
    }

    // Convert to Composio's slug format (lowercase, no underscores)
    const composioToolkits = toolkits.map((t) => toComposioSlug(t));

    log.info('Getting tools for toolkits with AnthropicProvider', {
      userId,
      toolkits: composioToolkits,
    });

    // Use AnthropicProvider client to get pre-formatted tools for Claude
    const client = getAnthropicClient();

    // tools.get() with AnthropicProvider returns Claude-formatted tools
    const tools = await client.tools.get(userId, {
      toolkits: composioToolkits,
    });

    log.info('Got pre-formatted tools from Composio AnthropicProvider', {
      userId,
      toolCount: tools?.length || 0,
      sampleTools: tools?.slice(0, 3).map((t: any) => t.name),
    });

    // Tools from AnthropicProvider should already have correct format:
    // { name, description, input_schema: { type: 'object', properties, required } }
    // We map to our ComposioTool format which uses 'parameters' internally
    return (tools || []).map((tool: any) => {
      // AnthropicProvider uses input_schema (Claude format)
      const inputSchema = tool.input_schema || {};

      log.debug('Mapping AnthropicProvider tool', {
        name: tool.name,
        hasInputSchema: !!tool.input_schema,
        schemaType: inputSchema.type,
        propertyCount: Object.keys(inputSchema.properties || {}).length,
      });

      return {
        name: tool.name,
        description: tool.description || '',
        parameters: {
          type: 'object' as const,
          properties: inputSchema.properties || {},
          required: inputSchema.required || [],
        },
      };
    });
  } catch (error) {
    log.error('Failed to get available tools', { userId, toolkits, error });
    return [];
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Map Composio account response to our type
 * SDK returns: { id, status, toolkit: { slug, ... }, ... }
 *
 * Important: Composio returns toolkit slugs in various formats:
 * - Without underscores: "googlesheets"
 * - With underscores: "google_sheets"
 * - Mixed case: "GoogleSheets"
 * We normalize to our internal format (e.g., "GOOGLE_SHEETS").
 */
function mapComposioAccount(account: Record<string, unknown>): ConnectedAccount {
  // SDK returns toolkit as nested object with slug, or as various other fields
  const toolkitObj = account.toolkit as Record<string, unknown> | undefined;

  // Try multiple possible fields where Composio might put the toolkit identifier
  const composioSlug = (toolkitObj?.slug ||
    toolkitObj?.name ||
    account.integrationId ||
    account.appName ||
    account.appUniqueId ||
    '') as string;

  // Log for debugging what Composio actually returns
  log.debug('Mapping Composio account', {
    accountId: account.id,
    rawStatus: account.status,
    toolkitObj: toolkitObj
      ? {
          slug: toolkitObj.slug,
          name: toolkitObj.name,
          id: toolkitObj.id,
        }
      : 'undefined',
    integrationId: account.integrationId,
    appName: account.appName,
    appUniqueId: account.appUniqueId,
    resolvedSlug: composioSlug,
  });

  // Convert Composio's slug format to our internal ID (e.g., googlesheets -> GOOGLE_SHEETS)
  const toolkitId = composioSlugToToolkitId(composioSlug);
  const toolkitConfig = getToolkitById(toolkitId);

  // Log the mapping result
  log.debug('Toolkit mapping result', {
    composioSlug,
    mappedToolkitId: toolkitId,
    foundConfig: !!toolkitConfig,
    configId: toolkitConfig?.id,
  });

  const statusMap: Record<string, ConnectionStatus> = {
    ACTIVE: 'connected',
    INITIATED: 'pending',
    PENDING: 'pending',
    FAILED: 'failed',
    EXPIRED: 'expired',
  };

  const status = (account.status as string) || '';

  return {
    id: account.id as string,
    toolkit: toolkitId, // Use our internal ID format (GOOGLE_SHEETS)
    status: statusMap[status] || 'disconnected',
    connectedAt: account.createdAt as string | undefined,
    metadata: {
      email: account.email as string | undefined,
      name: account.displayName as string | undefined,
      ...(toolkitConfig ? { toolkitName: toolkitConfig.displayName } : {}),
    },
  };
}

/**
 * Check if Composio is configured
 */
export function isComposioConfigured(): boolean {
  return !!COMPOSIO_API_KEY;
}

/**
 * Get Composio client instance (for advanced usage)
 */
export function getComposioClient(): ComposioClient {
  return getClient();
}
