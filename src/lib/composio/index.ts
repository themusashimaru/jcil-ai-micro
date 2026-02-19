/**
 * COMPOSIO INTEGRATION
 * ====================
 *
 * 500+ app integrations for your AI agents.
 * Replace OAuth nightmares with one API call.
 *
 * GitHub Toolkit: 100+ prioritized actions for repos, issues, PRs,
 * code, CI/CD, releases, teams, search, and more.
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
