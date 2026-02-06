/**
 * COMPOSIO CHAT TOOLS
 * ===================
 *
 * Integrates Composio app connections with Claude's tool system.
 * Allows AI to use connected apps (Twitter, Slack, etc.) as tools.
 */

import { logger } from '@/lib/logger';
import {
  getConnectedAccounts,
  getAvailableTools,
  executeTool,
  isComposioConfigured,
} from './client';
import { getToolkitById } from './toolkits';
import type { ComposioTool } from './types';

const log = logger('ComposioTools');

// ============================================================================
// TYPES
// ============================================================================

export interface ClaudeTool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface ComposioToolContext {
  connectedApps: string[];
  tools: ClaudeTool[];
  systemPromptAddition: string;
}

// ============================================================================
// TOOL CONVERSION
// ============================================================================

/**
 * Convert Composio tool to Claude tool format
 */
function toClaudeTool(tool: ComposioTool): ClaudeTool {
  return {
    name: `composio_${tool.name}`,
    description: tool.description,
    input_schema: {
      type: 'object',
      properties: tool.parameters.properties || {},
      required: tool.parameters.required || [],
    },
  };
}

/**
 * Get Composio tools for a user, formatted for Claude
 */
export async function getComposioToolsForUser(userId: string): Promise<ComposioToolContext> {
  if (!isComposioConfigured()) {
    return {
      connectedApps: [],
      tools: [],
      systemPromptAddition: '',
    };
  }

  try {
    // Get user's connected accounts
    const accounts = await getConnectedAccounts(userId);
    const connectedApps = accounts.filter((a) => a.status === 'connected').map((a) => a.toolkit);

    if (connectedApps.length === 0) {
      return {
        connectedApps: [],
        tools: [],
        systemPromptAddition: '',
      };
    }

    log.info('User has connected apps', { userId, apps: connectedApps });

    // Get available tools for connected apps
    const composioTools = await getAvailableTools(userId, connectedApps);

    // Convert to Claude format
    const tools = composioTools.map(toClaudeTool);

    // Build system prompt addition
    const appList = connectedApps
      .map((app) => {
        const config = getToolkitById(app);
        return config ? config.displayName : app;
      })
      .join(', ');

    const systemPromptAddition = `

## Connected App Integrations

The user has connected the following apps: ${appList}

You can use these apps to help the user with tasks like:
- Post to social media (Twitter, Instagram, LinkedIn, Facebook)
- Send messages (Slack, Discord, WhatsApp)
- Manage documents (Notion, Google Docs, Airtable)
- Handle email (Gmail, Outlook)
- And more based on what they've connected

To use a connected app, call the appropriate composio_* tool. The tool names are prefixed with "composio_" followed by the action name.

Examples:
- To post a tweet: use composio_TWITTER_CREATE_TWEET
- To send a Slack message: use composio_SLACK_SEND_MESSAGE
- To create a Notion page: use composio_NOTION_CREATE_PAGE

Always ask the user for confirmation before posting publicly or taking irreversible actions.
`;

    log.info('Prepared Composio tools for chat', {
      userId,
      toolCount: tools.length,
      apps: connectedApps,
    });

    return {
      connectedApps,
      tools,
      systemPromptAddition,
    };
  } catch (error) {
    log.error('Failed to get Composio tools', { userId, error });
    return {
      connectedApps: [],
      tools: [],
      systemPromptAddition: '',
    };
  }
}

// ============================================================================
// TOOL EXECUTION
// ============================================================================

/**
 * Execute a Composio tool call from Claude
 */
export async function executeComposioTool(
  userId: string,
  toolName: string,
  params: Record<string, unknown>
): Promise<{
  success: boolean;
  result?: unknown;
  error?: string;
}> {
  // Remove the composio_ prefix to get the actual tool name
  const actualToolName = toolName.replace(/^composio_/, '');

  log.info('Executing Composio tool', { userId, toolName: actualToolName });

  try {
    const result = await executeTool(userId, actualToolName, params);

    if (result.success) {
      return {
        success: true,
        result: result.data,
      };
    } else {
      return {
        success: false,
        error: result.error || 'Tool execution failed',
      };
    }
  } catch (error) {
    log.error('Composio tool execution error', { userId, toolName, error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check if a tool name is a Composio tool
 */
export function isComposioTool(toolName: string): boolean {
  return toolName.startsWith('composio_');
}

// ============================================================================
// QUICK CONTEXT HELPERS
// ============================================================================

/**
 * Get a quick summary of connected apps for system prompt
 * (lightweight version without full tool definitions)
 */
export async function getConnectedAppsSummary(userId: string): Promise<string> {
  if (!isComposioConfigured()) {
    return '';
  }

  try {
    const accounts = await getConnectedAccounts(userId);
    const connected = accounts.filter((a) => a.status === 'connected');

    if (connected.length === 0) {
      return '';
    }

    const appNames = connected
      .map((a) => {
        const config = getToolkitById(a.toolkit);
        return config ? config.displayName : a.toolkit;
      })
      .join(', ');

    return `User has connected these apps for AI automation: ${appNames}. `;
  } catch {
    return '';
  }
}

/**
 * Get featured actions for common tasks
 */
export function getFeaturedActions(): Record<string, string> {
  return {
    'Post a tweet': 'composio_TWITTER_CREATE_TWEET',
    'Send a Slack message': 'composio_SLACK_SEND_MESSAGE',
    'Create a Notion page': 'composio_NOTION_CREATE_PAGE',
    'Send an email': 'composio_GMAIL_SEND_EMAIL',
    'Post to LinkedIn': 'composio_LINKEDIN_CREATE_POST',
    'Upload to Instagram': 'composio_INSTAGRAM_CREATE_POST',
    'Add calendar event': 'composio_GOOGLE_CALENDAR_CREATE_EVENT',
    'Create GitHub issue': 'composio_GITHUB_CREATE_ISSUE',
  };
}
