/**
 * CONNECTORS SYSTEM
 * =================
 *
 * Central hub for all external service connectors.
 * Currently supports: GitHub
 * Coming soon: Vercel, Supabase
 */

export * from './types';
export * from './github';

import type { Connector, ConnectorType } from './types';
import { CONNECTOR_CONFIGS } from './types';
import { getGitHubConnectionStatus } from './github';

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

  // Vercel (coming soon)
  connectors.push({
    ...CONNECTOR_CONFIGS.vercel,
    status: 'disconnected',
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
  // Currently only GitHub is fully implemented
  return type === 'github';
}

/**
 * Feature flag for connectors system
 */
export function isConnectorsEnabled(): boolean {
  return process.env.ENABLE_CONNECTORS === 'true';
}
