/**
 * COMPOSIO INTEGRATION
 * ====================
 *
 * 500+ app integrations for your AI agents.
 * Replace OAuth nightmares with one API call.
 *
 * Toolkit Superpowers:
 * - GitHub: 100+ prioritized actions for repos, issues, PRs, code, CI/CD, releases, teams, search
 * - Gmail: 40 prioritized actions for send, read, search, drafts, labels, contacts, settings
 * - Outlook: 64 prioritized actions for email, calendar, contacts, Teams chat, rules
 * - Slack: 100+ prioritized actions for messaging, channels, users, files, canvases, workflows
 */

// Client functions
export {
  initiateConnection,
  connectWithApiKey,
  waitForConnection,
  getConnectedAccounts,
  getConnectedAccount,
  disconnectAccount,
  executeTool,
  getAvailableTools,
  isComposioConfigured,
  getComposioClient,
} from './client';

// Types
export type {
  ToolkitConfig,
  ToolkitCategory,
  ConnectionStatus,
  ConnectedAccount,
  ConnectionRequest,
  ToolExecutionResult,
  UserConnections,
  ComposioSession,
  ComposioWebhookPayload,
  ComposioTool,
} from './types';

// Toolkits
export {
  POPULAR_TOOLKITS,
  ALL_TOOLKITS,
  TOOLKITS_BY_CATEGORY,
  getToolkitById,
  getToolkitsByCategory,
  getPopularToolkits,
  composioSlugToToolkitId,
} from './toolkits';

// Chat integration (Claude tools)
export {
  getComposioToolsForUser,
  executeComposioTool,
  isComposioTool,
  isComposioGitHubTool,
  isComposioGmailTool,
  isComposioOutlookTool,
  isComposioSlackTool,
  getConnectedAppsSummary,
  getFeaturedActions,
} from './chat-tools';

export type { ClaudeTool, ComposioToolContext } from './chat-tools';

// GitHub Toolkit (categorized actions, priority selection, system prompts)
export {
  ALL_GITHUB_ACTIONS,
  getGitHubFeaturedActionNames,
  getGitHubActionsByPriority,
  getGitHubActionNamesByPriority,
  getGitHubActionsByCategory,
  getGitHubActionPriority,
  isKnownGitHubAction,
  isDestructiveGitHubAction,
  sortByGitHubPriority,
  getGitHubActionStats,
  getGitHubSystemPrompt,
  getGitHubCapabilitySummary,
  logGitHubToolkitStats,
} from './github-toolkit';

export type { GitHubActionCategory, GitHubAction } from './github-toolkit';

// Gmail Toolkit (categorized actions, priority selection, system prompts)
export {
  ALL_GMAIL_ACTIONS,
  getGmailFeaturedActionNames,
  getGmailActionsByPriority,
  getGmailActionNamesByPriority,
  getGmailActionsByCategory,
  getGmailActionPriority,
  isKnownGmailAction,
  isDestructiveGmailAction,
  sortByGmailPriority,
  getGmailActionStats,
  getGmailSystemPrompt,
  getGmailCapabilitySummary,
  logGmailToolkitStats,
} from './gmail-toolkit';

export type { GmailActionCategory, GmailAction } from './gmail-toolkit';

// Outlook Toolkit (categorized actions, priority selection, system prompts)
export {
  ALL_OUTLOOK_ACTIONS,
  getOutlookFeaturedActionNames,
  getOutlookActionsByPriority,
  getOutlookActionNamesByPriority,
  getOutlookActionsByCategory,
  getOutlookActionPriority,
  isKnownOutlookAction,
  isDestructiveOutlookAction,
  sortByOutlookPriority,
  getOutlookActionStats,
  getOutlookSystemPrompt,
  getOutlookCapabilitySummary,
  logOutlookToolkitStats,
} from './outlook-toolkit';

export type { OutlookActionCategory, OutlookAction } from './outlook-toolkit';

// Slack Toolkit (categorized actions, priority selection, system prompts)
export {
  ALL_SLACK_ACTIONS,
  getSlackFeaturedActionNames,
  getSlackActionsByPriority,
  getSlackActionNamesByPriority,
  getSlackActionsByCategory,
  getSlackActionPriority,
  isKnownSlackAction,
  isDestructiveSlackAction,
  sortBySlackPriority,
  getSlackActionStats,
  getSlackSystemPrompt,
  getSlackCapabilitySummary,
  logSlackToolkitStats,
} from './slack-toolkit';

export type { SlackActionCategory, SlackAction } from './slack-toolkit';
