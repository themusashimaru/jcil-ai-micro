/**
 * COMPOSIO CLIENT
 * ===============
 *
 * Wrapper around Composio SDK for managing 500+ app integrations.
 * Handles authentication, tool execution, and connection management.
 */

import { Composio } from '@composio/core';
import { logger } from '@/lib/logger';
import type {
  ConnectedAccount,
  ConnectionRequest,
  ConnectionStatus,
  ToolExecutionResult,
  ComposioTool,
} from './types';
import { getToolkitById } from './toolkits';

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
// CLIENT SINGLETON
// ============================================================================

let composioClient: ComposioClient | null = null;

function getClient(): ComposioClient {
  if (!composioClient) {
    if (!COMPOSIO_API_KEY) {
      throw new Error('COMPOSIO_API_KEY is not configured');
    }
    composioClient = new Composio({ apiKey: COMPOSIO_API_KEY });
  }
  return composioClient;
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

    // For managed auth (Composio handles OAuth), we can use the default config
    // IMPORTANT: Composio SDK expects lowercase toolkit slugs for API calls
    // Convert underscores to avoid any format issues (e.g., MICROSOFT_TEAMS -> microsoft_teams)
    const toolkitSlug = toolkit.toLowerCase();

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
      // SDK API: authConfigs.create({ toolkit: { slug }, auth_config: { type, name } })
      log.info('No existing auth config found, creating new one', { toolkitSlug });
      const newConfig = await client.authConfigs.create({
        toolkit: { slug: toolkitSlug },
        auth_config: {
          type: 'use_composio_managed_auth',
          name: `${toolkit} Auth`,
        },
      });
      // Response structure: { auth_config: { id: '...' }, toolkit: { slug: '...' } }
      authConfigId = newConfig.auth_config.id;
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
 * Wait for a connection to become active
 * Uses SDK's built-in waitForConnection method
 */
export async function waitForConnection(
  connectionId: string,
  timeoutMs: number = 60000
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
      return mapComposioAccount(account);
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
 */
export async function getConnectedAccounts(userId: string): Promise<ConnectedAccount[]> {
  const client = getClient();

  try {
    // SDK API: connectedAccounts.list({ userIds: ['user123'] }) - plural, array!
    const accounts = await client.connectedAccounts.list({
      userIds: [userId],
    });

    log.info('Got connected accounts from Composio', {
      userId,
      count: accounts.items?.length || 0,
      accounts: accounts.items?.map((a: any) => ({
        id: a.id,
        status: a.status,
        toolkit: a.toolkit?.slug || a.integrationId || a.appName,
      })),
    });

    return (accounts.items || []).map(mapComposioAccount);
  } catch (error) {
    log.error('Failed to get connected accounts', { userId, error });
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
 */
export async function disconnectAccount(connectionId: string): Promise<boolean> {
  const client = getClient();

  try {
    await client.connectedAccounts.delete(connectionId);
    log.info('Account disconnected', { connectionId });
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
 * SDK API: tools.getRawComposioTools({ toolkits: ['GITHUB', 'GMAIL'] })
 */
export async function getAvailableTools(
  userId: string,
  toolkits?: string[]
): Promise<ComposioTool[]> {
  const client = getClient();

  try {
    if (!toolkits || toolkits.length === 0) {
      log.info('No toolkits provided, returning empty tools list');
      return [];
    }

    // SDK expects lowercase toolkit slugs
    const lowercaseToolkits = toolkits.map((t) => t.toLowerCase());

    log.info('Getting tools for toolkits', { userId, toolkits: lowercaseToolkits });

    // Use getRawComposioTools with toolkit slugs
    const tools = await client.tools.getRawComposioTools({
      toolkits: lowercaseToolkits,
    });

    log.info('Got tools from Composio', {
      userId,
      toolCount: tools?.length || 0,
      tools: tools?.slice(0, 5).map((t: any) => t.name || t.slug),
    });

    return (tools || []).map((tool: any) => ({
      name: tool.name || tool.slug,
      description: tool.description || '',
      parameters: tool.parameters || tool.inputSchema || { type: 'object', properties: {} },
    }));
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
 */
function mapComposioAccount(account: Record<string, unknown>): ConnectedAccount {
  // SDK returns toolkit as nested object with slug
  const toolkitObj = account.toolkit as Record<string, unknown> | undefined;
  const toolkit = (toolkitObj?.slug || account.integrationId || account.appName || '') as string;
  const toolkitConfig = getToolkitById(toolkit.toUpperCase());

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
    toolkit: toolkit.toUpperCase(),
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
