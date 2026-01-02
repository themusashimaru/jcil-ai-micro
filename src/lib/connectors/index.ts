/**
 * CONNECTORS SYSTEM
 * =================
 *
 * Central hub for all external service connectors.
 * Currently supports: GitHub, Vercel Sandbox
 * Coming soon: Supabase
 */

export * from './types';
export * from './github';
export * from './vercel-sandbox';

import type { Connector, ConnectorType } from './types';
import { CONNECTOR_CONFIGS } from './types';
import { getGitHubConnectionStatus } from './github';
import { isSandboxConfigured } from './vercel-sandbox';

/**
 * Get status of all connectors for a user
 */
export async function getAllConnectorStatuses(
  githubToken?: string | null
): Promise<Connector[]> {
  const connectors: Connector[] = [];

  // GitHub
  if (githubToken) {
    const github = await getGitHubConnectionStatus(githubToken);
    connectors.push(github);
  } else {
    connectors.push({
      ...CONNECTOR_CONFIGS.github,
      status: 'disconnected',
    });
  }

  // Vercel Sandbox (server-side, uses JCIL's credentials)
  connectors.push({
    ...CONNECTOR_CONFIGS.vercel,
    status: isSandboxConfigured() ? 'connected' : 'disconnected',
  });

  // Supabase (coming soon)
  connectors.push({
    ...CONNECTOR_CONFIGS.supabase,
    status: 'disconnected',
  });

  return connectors;
}

/**
 * Check if a specific connector is available
 */
export function isConnectorAvailable(type: ConnectorType): boolean {
  switch (type) {
    case 'github':
      return true;
    case 'vercel':
      return isSandboxConfigured();
    default:
      return false;
  }
}

/**
 * Feature flag for connectors system
 */
export function isConnectorsEnabled(): boolean {
  return process.env.ENABLE_CONNECTORS === 'true';
}
