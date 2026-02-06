/**
 * COMPOSIO INTEGRATION
 * ====================
 *
 * 500+ app integrations for your AI agents.
 * Replace OAuth nightmares with one API call.
 */

// Client functions
export {
  initiateConnection,
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
} from './toolkits';
