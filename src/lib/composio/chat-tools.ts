/**
 * COMPOSIO CHAT TOOLS
 * ===================
 *
 * Integrates Composio app connections with Claude's tool system.
 * Allows AI to use connected apps (Twitter, Slack, GitHub, Gmail, etc.) as tools.
 *
 * Toolkit-Specific Integrations:
 * - GitHub: 100+ prioritized actions (repos, issues, PRs, code, CI/CD, releases, teams, search)
 * - Gmail: 40 prioritized actions (send, read, search, drafts, labels, contacts, settings)
 * - Outlook: 64 prioritized actions (email, calendar, contacts, Teams chat, rules)
 * - Slack: 100+ prioritized actions (messaging, channels, users, files, canvases, workflows)
 *
 * Each toolkit has separate tool budgets, priority sorting, and system prompts.
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
import {
  sortByGitHubPriority,
  getGitHubSystemPrompt,
  logGitHubToolkitStats,
  getGitHubCapabilitySummary,
} from './github-toolkit';
import {
  sortByGmailPriority,
  getGmailSystemPrompt,
  logGmailToolkitStats,
  getGmailCapabilitySummary,
} from './gmail-toolkit';
import {
  sortByOutlookPriority,
  getOutlookSystemPrompt,
  logOutlookToolkitStats,
  getOutlookCapabilitySummary,
} from './outlook-toolkit';
import {
  sortBySlackPriority,
  getSlackSystemPrompt,
  logSlackToolkitStats,
  getSlackCapabilitySummary,
} from './slack-toolkit';

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
  hasGitHub: boolean; // Whether GitHub is connected via Composio
  hasGmail: boolean; // Whether Gmail is connected via Composio
  hasOutlook: boolean; // Whether Outlook is connected via Composio
  hasSlack: boolean; // Whether Slack is connected via Composio
}

// ============================================================================
// TOOL LIMITS
// ============================================================================

// Default cap for non-toolkit-specific Composio tools per session
const MAX_COMPOSIO_TOOLS_DEFAULT = 50;

// GitHub gets a higher cap because it's a primary development toolkit
// with many essential actions across repos, issues, PRs, CI/CD, etc.
const MAX_GITHUB_TOOLS = 100;

// Gmail gets all 40 tools - it's a compact but complete email toolkit
const MAX_GMAIL_TOOLS = 40;

// Outlook gets all 64 tools - email, calendar, contacts, Teams chat
const MAX_OUTLOOK_TOOLS = 64;

// Slack gets 80 tools - messaging, channels, users, files, workflows
const MAX_SLACK_TOOLS = 80;

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

// ============================================================================
// MAIN TOOL LOADER
// ============================================================================

/**
 * Get Composio tools for a user, formatted for Claude.
 *
 * When GitHub is connected:
 * - Loads up to 100 GitHub tools, sorted by priority (essential first)
 * - Sets hasGitHub=true so callers can skip the custom github tool
 * - Adds GitHub-specific system prompt with full capability docs
 *
 * For other apps: standard loading with 50-tool cap per app category.
 */
export async function getComposioToolsForUser(userId: string): Promise<ComposioToolContext> {
  if (!isComposioConfigured()) {
    return {
      connectedApps: [],
      tools: [],
      systemPromptAddition: '',
      hasGitHub: false,
      hasGmail: false,
      hasOutlook: false,
      hasSlack: false,
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
        hasGitHub: false,
        hasGmail: false,
        hasOutlook: false,
        hasSlack: false,
      };
    }

    const hasGitHub = connectedApps.some(
      (app) => app === 'GITHUB' || app.toLowerCase() === 'github'
    );
    const hasGmail = connectedApps.some((app) => app === 'GMAIL' || app.toLowerCase() === 'gmail');
    const hasOutlook = connectedApps.some(
      (app) =>
        app === 'MICROSOFT_OUTLOOK' ||
        app.toLowerCase() === 'microsoft_outlook' ||
        app.toLowerCase() === 'microsoftoutlook' ||
        app.toLowerCase() === 'outlook'
    );
    const hasSlack = connectedApps.some((app) => app === 'SLACK' || app.toLowerCase() === 'slack');

    log.info('User has connected apps', {
      userId,
      apps: connectedApps,
      hasGitHub,
      hasGmail,
      hasOutlook,
      hasSlack,
    });

    if (hasGitHub) {
      logGitHubToolkitStats();
    }
    if (hasGmail) {
      logGmailToolkitStats();
    }
    if (hasOutlook) {
      logOutlookToolkitStats();
    }
    if (hasSlack) {
      logSlackToolkitStats();
    }

    // Get available tools for connected apps
    let composioTools: ComposioTool[] = [];
    try {
      composioTools = await getAvailableTools(userId, connectedApps);
      log.info('Retrieved Composio tools', {
        userId,
        rawToolCount: composioTools.length,
        toolNames: composioTools.slice(0, 10).map((t) => t.name),
      });
    } catch (toolsError) {
      log.error('Failed to get available tools', { userId, connectedApps, error: toolsError });
    }

    // Convert to Claude format, filtering out any null/invalid tools
    let tools = composioTools.map(toClaudeTool).filter((t): t is ClaudeTool => t !== null);

    // Split toolkit-specific tools for separate budget management
    const githubTools: ClaudeTool[] = [];
    const gmailTools: ClaudeTool[] = [];
    const outlookTools: ClaudeTool[] = [];
    const slackTools: ClaudeTool[] = [];
    const otherTools: ClaudeTool[] = [];

    for (const tool of tools) {
      if (tool.name.startsWith('composio_GITHUB_')) {
        githubTools.push(tool);
      } else if (tool.name.startsWith('composio_GMAIL_')) {
        gmailTools.push(tool);
      } else if (tool.name.startsWith('composio_OUTLOOK_')) {
        outlookTools.push(tool);
      } else if (tool.name.startsWith('composio_SLACK_')) {
        slackTools.push(tool);
      } else {
        otherTools.push(tool);
      }
    }

    // Sort toolkit tools by priority (essential actions first)
    const sortedGitHubTools = sortByGitHubPriority(githubTools);
    const sortedGmailTools = sortByGmailPriority(gmailTools);
    const sortedOutlookTools = sortByOutlookPriority(outlookTools);
    const sortedSlackTools = sortBySlackPriority(slackTools);

    // Apply separate caps per toolkit
    const cappedGitHubTools = sortedGitHubTools.slice(0, MAX_GITHUB_TOOLS);
    const cappedGmailTools = sortedGmailTools.slice(0, MAX_GMAIL_TOOLS);
    const cappedOutlookTools = sortedOutlookTools.slice(0, MAX_OUTLOOK_TOOLS);
    const cappedSlackTools = sortedSlackTools.slice(0, MAX_SLACK_TOOLS);
    const cappedOtherTools = otherTools.slice(0, MAX_COMPOSIO_TOOLS_DEFAULT);

    // Combine: toolkit tools first (superpowers), then others
    tools = [
      ...cappedGitHubTools,
      ...cappedGmailTools,
      ...cappedOutlookTools,
      ...cappedSlackTools,
      ...cappedOtherTools,
    ];

    log.info('Prepared Composio tools for Claude', {
      userId,
      totalTools: tools.length,
      githubTools: cappedGitHubTools.length,
      githubToolsDropped: githubTools.length - cappedGitHubTools.length,
      gmailTools: cappedGmailTools.length,
      gmailToolsDropped: gmailTools.length - cappedGmailTools.length,
      outlookTools: cappedOutlookTools.length,
      outlookToolsDropped: outlookTools.length - cappedOutlookTools.length,
      slackTools: cappedSlackTools.length,
      slackToolsDropped: slackTools.length - cappedSlackTools.length,
      otherTools: cappedOtherTools.length,
      otherToolsDropped: otherTools.length - cappedOtherTools.length,
    });

    // Build system prompt addition
    const appList = connectedApps
      .map((app) => {
        const config = getToolkitById(app);
        return config ? config.displayName : app;
      })
      .join(', ');

    let systemPromptAddition = `

## Connected App Integrations

The user has connected the following apps: ${appList}
`;

    // Add toolkit-specific system prompts
    if (hasGitHub && cappedGitHubTools.length > 0) {
      systemPromptAddition += getGitHubSystemPrompt();
    }
    if (hasGmail && cappedGmailTools.length > 0) {
      systemPromptAddition += getGmailSystemPrompt();
    }
    if (hasOutlook && cappedOutlookTools.length > 0) {
      systemPromptAddition += getOutlookSystemPrompt();
    }
    if (hasSlack && cappedSlackTools.length > 0) {
      systemPromptAddition += getSlackSystemPrompt();
    }

    // Add general app guidance
    systemPromptAddition += `
### Connected App Usage

You can use these apps to help the user with tasks like:
- Post to social media (Twitter, Instagram, LinkedIn)
${hasSlack ? `- **Full Slack operations** (${getSlackCapabilitySummary()})\n` : '- Send messages (Slack, Discord, Teams)\n'}- Manage documents (Notion, Google Docs, Airtable)
${hasGmail ? `- **Full Gmail operations** (${getGmailCapabilitySummary()})\n` : hasOutlook ? '' : '- Handle email (Gmail, Outlook)\n'}${hasOutlook ? `- **Full Outlook operations** (${getOutlookCapabilitySummary()})\n` : ''}${hasGitHub ? `- **Full GitHub operations** (${getGitHubCapabilitySummary()})\n` : ''}- And more based on what they've connected

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
  "toolParams": { "recipient_email": "user@example.com", "subject": "...", "body": "..." }
}
\`\`\`

The user will see a card with Send/Edit/Cancel buttons. Only execute the tool when they click Send.
If they click Edit and provide instructions, regenerate the preview with their changes.

### Tool Usage

Tool names are prefixed with "composio_" followed by the action:
- Tweet: composio_TWITTER_CREATE_TWEET
- Slack message: composio_SLACK_SEND_MESSAGE
- LinkedIn post: composio_LINKEDIN_CREATE_POST
${hasGmail ? '- Send email: composio_GMAIL_SEND_EMAIL\n- Fetch emails: composio_GMAIL_FETCH_EMAILS\n- Create draft: composio_GMAIL_CREATE_EMAIL_DRAFT\n- Reply to thread: composio_GMAIL_REPLY_TO_THREAD\n' : '- Email: composio_GMAIL_SEND_EMAIL\n'}${hasOutlook ? '- Outlook email: composio_OUTLOOK_SEND_EMAIL\n- Outlook calendar: composio_OUTLOOK_CALENDAR_CREATE_EVENT\n- Outlook contacts: composio_OUTLOOK_LIST_CONTACTS\n' : ''}${hasSlack ? '- Slack message: composio_SLACK_SENDS_A_MESSAGE_TO_A_SLACK_CHANNEL\n- Slack DM: composio_SLACK_SEND_ME_A_DIRECT_MESSAGE_ON_SLACK\n- Slack channels: composio_SLACK_LIST_ALL_CHANNELS\n' : '- Slack message: composio_SLACK_SEND_MESSAGE\n'}${hasGitHub ? '- GitHub issue: composio_GITHUB_CREATE_ISSUE\n- GitHub PR: composio_GITHUB_CREATE_PULL_REQUEST\n- GitHub search: composio_GITHUB_SEARCH_CODE\n' : ''}
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
      hasGitHub,
      hasGmail,
      hasOutlook,
      hasSlack,
    };
  } catch (error) {
    log.error('Failed to get Composio tools', { userId, error });
    return {
      connectedApps: [],
      tools: [],
      systemPromptAddition: '',
      hasGitHub: false,
      hasGmail: false,
      hasOutlook: false,
      hasSlack: false,
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

/**
 * Check if a tool name is a Composio GitHub tool
 */
export function isComposioGitHubTool(toolName: string): boolean {
  return toolName.startsWith('composio_GITHUB_');
}

/**
 * Check if a tool name is a Composio Gmail tool
 */
export function isComposioGmailTool(toolName: string): boolean {
  return toolName.startsWith('composio_GMAIL_');
}

/**
 * Check if a tool name is a Composio Outlook tool
 */
export function isComposioOutlookTool(toolName: string): boolean {
  return toolName.startsWith('composio_OUTLOOK_');
}

/**
 * Check if a tool name is a Composio Slack tool
 */
export function isComposioSlackTool(toolName: string): boolean {
  return toolName.startsWith('composio_SLACK_');
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
    // Social & Communication
    'Post a tweet': 'composio_TWITTER_CREATE_TWEET',
    'Send a Slack message': 'composio_SLACK_SEND_MESSAGE',
    'Create a Notion page': 'composio_NOTION_CREATE_PAGE',
    'Send an email': 'composio_GMAIL_SEND_EMAIL',
    'Post to LinkedIn': 'composio_LINKEDIN_CREATE_POST',
    'Upload to Instagram': 'composio_INSTAGRAM_CREATE_POST',
    'Add calendar event': 'composio_GOOGLE_CALENDAR_CREATE_EVENT',
    // GitHub - Core Actions
    'Create GitHub issue': 'composio_GITHUB_CREATE_ISSUE',
    'Create pull request': 'composio_GITHUB_CREATE_PULL_REQUEST',
    'Search GitHub code': 'composio_GITHUB_SEARCH_CODE',
    'List my repos': 'composio_GITHUB_LIST_REPOS_FOR_AUTHENTICATED_USER',
    'Create GitHub release': 'composio_GITHUB_CREATE_RELEASE',
    'Trigger GitHub workflow': 'composio_GITHUB_CREATE_WORKFLOW_DISPATCH',
    'Merge pull request': 'composio_GITHUB_MERGE_PULL_REQUEST',
    'Create repository': 'composio_GITHUB_CREATE_REPOSITORY',
    // Outlook - Core Actions
    'Send Outlook email': 'composio_OUTLOOK_SEND_EMAIL',
    'Create calendar event': 'composio_OUTLOOK_CALENDAR_CREATE_EVENT',
    'List Outlook contacts': 'composio_OUTLOOK_LIST_CONTACTS',
    // Slack - Core Actions
    'Send Slack message': 'composio_SLACK_SENDS_A_MESSAGE_TO_A_SLACK_CHANNEL',
    'Send Slack DM': 'composio_SLACK_SEND_ME_A_DIRECT_MESSAGE_ON_SLACK',
    'List Slack channels': 'composio_SLACK_LIST_ALL_CHANNELS',
  };
}
