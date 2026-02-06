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
    const toolkitSlug = toolkit.toUpperCase();

    // Try to list existing auth configs for this toolkit
    // SDK API: authConfigs.list({ app: 'APP_NAME' })
    const authConfigs = await client.authConfigs.list({
      app: toolkitSlug,
    });

    let authConfigId: string;

    if (authConfigs.items && authConfigs.items.length > 0) {
      // Use existing auth config
      authConfigId = authConfigs.items[0].id;
    } else {
      // Create a new managed auth config for this toolkit
      // SDK API: authConfigs.create(appName, options) - app name is FIRST positional arg
      const newConfig = await client.authConfigs.create(toolkitSlug, {
        name: `${toolkit} Auth`,
        type: 'use_composio_managed_auth',
      });
      authConfigId = newConfig.id;
    }

    // Now initiate the connection using the auth config
    // SDK API: connectedAccounts.initiate(userId, authConfigId, options)
    const connectionRequest = await client.connectedAccounts.initiate(userId, authConfigId, {
      redirectUrl: redirectUrl,
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
 * Wait for a connection to become active (polls Composio)
 */
export async function waitForConnection(
  connectionId: string,
  timeoutMs: number = 60000
): Promise<ConnectedAccount | null> {
  const client = getClient();

  try {
    // Use the SDK's built-in wait method
    const connection = await client.connectedAccounts.waitForConnection(connectionId, timeoutMs);

    if (connection) {
      return mapComposioAccount(connection);
    }

    return null;
  } catch (error) {
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
    // SDK API: connectedAccounts.list({ userId: 'user123' })
    const accounts = await client.connectedAccounts.list({
      userId: userId,
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
 */
export async function executeTool(
  userId: string,
  toolName: string,
  params: Record<string, unknown>
): Promise<ToolExecutionResult> {
  const client = getClient();

  try {
    log.info('Executing tool', { userId, toolName });

    const result = await client.tools.execute({
      entityId: userId,
      action: toolName,
      params,
    });

    return {
      success: true,
      data: result,
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
 */
export async function getAvailableTools(
  userId: string,
  toolkits?: string[]
): Promise<ComposioTool[]> {
  const client = getClient();

  try {
    const tools = await client.tools.list({
      entityId: userId,
      apps: toolkits,
    });

    return (tools.items || []).map((tool: any) => ({
      name: tool.name,
      description: tool.description || '',
      parameters: tool.parameters || { type: 'object', properties: {} },
    }));
  } catch (error) {
    log.error('Failed to get available tools', { userId, error });
    return [];
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Map Composio account response to our type
 */
function mapComposioAccount(account: Record<string, unknown>): ConnectedAccount {
  const toolkit = (account.integrationId || account.appName || '') as string;
  const toolkitConfig = getToolkitById(toolkit.toUpperCase());

  const statusMap: Record<string, ConnectionStatus> = {
    ACTIVE: 'connected',
    INITIATED: 'pending',
    PENDING: 'pending',
    FAILED: 'failed',
    EXPIRED: 'expired',
  };

  return {
    id: account.id as string,
    toolkit: toolkit.toUpperCase(),
    status: statusMap[(account.status as string) || ''] || 'disconnected',
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
