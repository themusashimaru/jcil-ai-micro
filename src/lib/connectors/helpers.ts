/**
 * CONNECTOR HELPERS
 * Utilities for working with user connections
 */

import { createClient } from '@supabase/supabase-js';
import { decryptToken } from './encryption';
import { getConnectorById } from './config';

/**
 * Get list of services a user has connected (no tokens, just service names)
 * Used for system prompt enhancement
 */
export async function getUserConnectedServices(userId: string): Promise<string[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return [];
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabase
      .from('user_connections')
      .select('service, is_active')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (error || !data) {
      return [];
    }

    return data.map(conn => conn.service);
  } catch {
    return [];
  }
}

/**
 * Get a user's connection with decrypted token
 * Only use server-side for API calls
 */
export async function getUserConnection(
  userId: string,
  service: string
): Promise<{ token: string; metadata: Record<string, unknown> } | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabase
      .from('user_connections')
      .select('encrypted_token, metadata')
      .eq('user_id', userId)
      .eq('service', service)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      return null;
    }

    const token = decryptToken(data.encrypted_token);
    return { token, metadata: data.metadata || {} };
  } catch {
    return null;
  }
}

/**
 * Generate system prompt additions for connected services
 */
export function getConnectorSystemPrompt(connectedServices: string[]): string {
  if (connectedServices.length === 0) {
    return '';
  }

  const serviceDescriptions = connectedServices
    .map(service => {
      const config = getConnectorById(service);
      if (!config) return null;

      const capabilities = config.capabilities.map(c => `  - ${c}`).join('\n');
      return `**${config.name}**: Connected\n${capabilities}`;
    })
    .filter(Boolean)
    .join('\n\n');

  return `
## Connected External Services

The user has connected the following services. You can help them with tasks related to these services.

${serviceDescriptions}

**IMPORTANT**: For any action that modifies data (creating files, commits, PRs, etc.), you MUST:
1. Clearly explain what you're about to do
2. Wait for explicit user confirmation before proceeding
3. Use the format: [CONNECTOR_ACTION: service_name | action_type | parameters_json]

Example: [CONNECTOR_ACTION: github | create_file | {"repo": "owner/repo", "path": "src/file.ts", "content": "..."}]

The user will see a confirmation dialog before any action is executed.
`;
}
