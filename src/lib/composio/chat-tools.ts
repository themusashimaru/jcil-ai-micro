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
 * Sanitize and validate a JSON Schema property definition
 * Ensures properties conform to Anthropic's expected format
 */
function sanitizeSchemaProperty(key: string, prop: unknown): Record<string, unknown> | null {
  if (!prop || typeof prop !== 'object') {
    return null;
  }

  const p = prop as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};

  // Type is required - default to 'string' if missing
  const validTypes = ['string', 'number', 'integer', 'boolean', 'array', 'object', 'null'];
  let propType = String(p.type || 'string').toLowerCase();

  // Handle invalid or missing types
  if (!validTypes.includes(propType)) {
    log.warn('Invalid property type, defaulting to string', { key, type: p.type });
    propType = 'string';
  }
  sanitized.type = propType;

  // Description is optional but helpful
  if (p.description && typeof p.description === 'string') {
    sanitized.description = p.description;
  }

  // Enum values for constrained strings
  if (Array.isArray(p.enum) && p.enum.length > 0) {
    sanitized.enum = p.enum.filter((v) => typeof v === 'string' || typeof v === 'number');
  }

  // Default value
  if (p.default !== undefined) {
    sanitized.default = p.default;
  }

  // For array types, include items schema
  if (propType === 'array' && p.items) {
    sanitized.items = typeof p.items === 'object' ? p.items : { type: 'string' };
  }

  return sanitized;
}

/**
 * Convert Composio tool to Claude tool format
 * Safely handles missing or malformed tool data
 * Validates and sanitizes schema to prevent API errors
 */
function toClaudeTool(tool: ComposioTool): ClaudeTool | null {
  try {
    if (!tool || !tool.name) {
      log.warn('Invalid tool missing name', { tool });
      return null;
    }

    // Validate tool name - must be alphanumeric with underscores
    const toolName = `composio_${tool.name}`;
    if (!/^[a-zA-Z0-9_]+$/.test(toolName)) {
      log.warn('Invalid tool name characters, skipping', { name: tool.name });
      return null;
    }

    // Sanitize properties to ensure valid JSON Schema
    const rawProperties = tool.parameters?.properties || {};
    const sanitizedProperties: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(rawProperties)) {
      // Validate property key - must be alphanumeric with underscores
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
        log.warn('Skipping property with invalid key', { toolName, key });
        continue;
      }

      const sanitized = sanitizeSchemaProperty(key, value);
      if (sanitized) {
        sanitizedProperties[key] = sanitized;
      }
    }

    // Filter required array to only include properties that exist
    const rawRequired = tool.parameters?.required || [];
    const sanitizedRequired = rawRequired.filter(
      (r) => typeof r === 'string' && r in sanitizedProperties
    );

    return {
      name: toolName,
      description: tool.description || `Action: ${tool.name.replace(/_/g, ' ')}`,
      input_schema: {
        type: 'object',
        properties: sanitizedProperties,
        required: sanitizedRequired,
      },
    };
  } catch (error) {
    log.error('Failed to convert tool to Claude format', { toolName: tool?.name, error });
    return null;
  }
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
    let composioTools: ComposioTool[] = [];
    try {
      composioTools = await getAvailableTools(userId, connectedApps);
      log.info('Retrieved Composio tools', {
        userId,
        rawToolCount: composioTools.length,
        toolNames: composioTools.slice(0, 5).map((t) => t.name),
      });
    } catch (toolsError) {
      log.error('Failed to get available tools', { userId, connectedApps, error: toolsError });
      // Continue without tools - at least show connected apps
    }

    // Convert to Claude format, filtering out any null/invalid tools
    let tools = composioTools.map(toClaudeTool).filter((t): t is ClaudeTool => t !== null);

    // Limit the number of tools to prevent context overflow
    // Each tool adds roughly 200-500 tokens to context
    // Claude can handle many tools, but we cap at 50 per session for performance
    const MAX_COMPOSIO_TOOLS = 50;
    if (tools.length > MAX_COMPOSIO_TOOLS) {
      log.warn('Truncating Composio tools list', {
        userId,
        originalCount: tools.length,
        truncatedTo: MAX_COMPOSIO_TOOLS,
      });
      tools = tools.slice(0, MAX_COMPOSIO_TOOLS);
    }

    log.info('Prepared Composio tools for Claude', {
      userId,
      validToolCount: tools.length,
      invalidToolCount: composioTools.length - tools.length,
    });

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
- Post to social media (Twitter, Instagram, LinkedIn, Facebook, TikTok)
- Send messages (Slack, Discord, WhatsApp, Telegram)
- Manage documents (Notion, Google Docs, Airtable)
- Handle email (Gmail, Outlook)
- And more based on what they've connected

### IMPORTANT: Preview Before Sending

**ALWAYS show a preview before posting, sending, or publishing anything.**

Use this exact JSON format to show an interactive preview card:

\`\`\`action-preview
{
  "platform": "Twitter",
  "action": "Post Tweet",
  "content": "Your tweet content here...",
  "toolName": "composio_TWITTER_CREATE_TWEET",
  "toolParams": { "text": "Your tweet content here..." }
}
\`\`\`

For emails, include recipient and subject:
\`\`\`action-preview
{
  "platform": "Gmail",
  "action": "Send Email",
  "recipient": "user@example.com",
  "subject": "Subject line",
  "content": "Email body here...",
  "toolName": "composio_GMAIL_SEND_EMAIL",
  "toolParams": { "to": "user@example.com", "subject": "...", "body": "..." }
}
\`\`\`

The user will see a card with Send/Edit/Cancel buttons. Only execute the tool when they click Send.
If they click Edit and provide instructions, regenerate the preview with their changes.

### Tool Usage

Tool names are prefixed with "composio_" followed by the action:
- Tweet: composio_TWITTER_CREATE_TWEET
- Slack message: composio_SLACK_SEND_MESSAGE
- Notion page: composio_NOTION_CREATE_PAGE
- Email: composio_GMAIL_SEND_EMAIL
- LinkedIn post: composio_LINKEDIN_CREATE_POST

### Safety Rules

1. **Never post without preview + confirmation**
2. **Never send emails without showing recipient, subject, and body first**
3. **For bulk actions, show a summary and get explicit approval**
4. **If unsure about tone or content, ask clarifying questions first**
`;

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
