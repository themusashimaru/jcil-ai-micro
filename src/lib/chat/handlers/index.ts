/**
 * CHAT HANDLERS
 *
 * Modular handlers for different chat providers and scenarios.
 */

export {
  handleClaudeChat,
  type ClaudeHandlerOptions,
  type ClaudeHandlerResult,
} from './claude-handler';

export {
  handleProviderChat,
  toUnifiedMessages,
  type ProviderHandlerOptions,
  type ProviderHandlerResult,
} from './provider-handler';
