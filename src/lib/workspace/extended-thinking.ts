/**
 * Extended Thinking Mode
 *
 * Provides Claude's extended thinking capability for complex reasoning.
 * Features:
 * - Toggle extended thinking on/off
 * - Configurable thinking budget
 * - Streaming thinking output
 * - Collapsible thinking blocks in UI
 *
 * @version 1.0.0
 */

import { logger } from '@/lib/logger';

const log = logger('extended-thinking');

// Extended thinking configuration
export interface ExtendedThinkingConfig {
  enabled: boolean;
  budgetTokens: number; // Max tokens for thinking
  showThinking: boolean; // Show thinking in UI
  streamThinking: boolean; // Stream thinking as it happens
}

// Default configuration
export const DEFAULT_THINKING_CONFIG: ExtendedThinkingConfig = {
  enabled: false,
  budgetTokens: 10000,
  showThinking: true,
  streamThinking: true,
};

// Thinking output from the model
export interface ThinkingOutput {
  id: string;
  content: string;
  timestamp: number;
  durationMs?: number;
  tokensUsed?: number;
}

/**
 * Extended Thinking Manager
 *
 * Manages extended thinking settings and output for sessions.
 */
export class ExtendedThinkingManager {
  private sessionConfigs: Map<string, ExtendedThinkingConfig> = new Map();
  private thinkingOutputs: Map<string, ThinkingOutput[]> = new Map();

  constructor() {
    log.info('ExtendedThinkingManager initialized');
  }

  /**
   * Get configuration for a session
   */
  getConfig(sessionId: string): ExtendedThinkingConfig {
    return this.sessionConfigs.get(sessionId) || { ...DEFAULT_THINKING_CONFIG };
  }

  /**
   * Update configuration for a session
   */
  setConfig(sessionId: string, config: Partial<ExtendedThinkingConfig>): void {
    const current = this.getConfig(sessionId);
    const updated = { ...current, ...config };
    this.sessionConfigs.set(sessionId, updated);
    log.info('Extended thinking config updated', { sessionId, config: updated });
  }

  /**
   * Enable extended thinking for a session
   */
  enable(sessionId: string, budgetTokens?: number): void {
    const config = this.getConfig(sessionId);
    config.enabled = true;
    if (budgetTokens !== undefined) {
      config.budgetTokens = budgetTokens;
    }
    this.sessionConfigs.set(sessionId, config);
    log.info('Extended thinking enabled', { sessionId, budgetTokens: config.budgetTokens });
  }

  /**
   * Disable extended thinking for a session
   */
  disable(sessionId: string): void {
    const config = this.getConfig(sessionId);
    config.enabled = false;
    this.sessionConfigs.set(sessionId, config);
    log.info('Extended thinking disabled', { sessionId });
  }

  /**
   * Toggle extended thinking for a session
   */
  toggle(sessionId: string): boolean {
    const config = this.getConfig(sessionId);
    config.enabled = !config.enabled;
    this.sessionConfigs.set(sessionId, config);
    log.info('Extended thinking toggled', { sessionId, enabled: config.enabled });
    return config.enabled;
  }

  /**
   * Set thinking budget for a session
   */
  setBudget(sessionId: string, budgetTokens: number): void {
    const config = this.getConfig(sessionId);
    config.budgetTokens = Math.max(1000, Math.min(50000, budgetTokens)); // Clamp between 1K and 50K
    this.sessionConfigs.set(sessionId, config);
    log.info('Thinking budget updated', { sessionId, budgetTokens: config.budgetTokens });
  }

  /**
   * Record thinking output from a response
   */
  recordThinking(sessionId: string, content: string, tokensUsed?: number): ThinkingOutput {
    const output: ThinkingOutput = {
      id: `think_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      content,
      timestamp: Date.now(),
      tokensUsed,
    };

    const outputs = this.thinkingOutputs.get(sessionId) || [];
    outputs.push(output);
    this.thinkingOutputs.set(sessionId, outputs);

    log.debug('Thinking output recorded', { sessionId, outputId: output.id, tokensUsed });
    return output;
  }

  /**
   * Get thinking outputs for a session
   */
  getThinkingOutputs(sessionId: string): ThinkingOutput[] {
    return this.thinkingOutputs.get(sessionId) || [];
  }

  /**
   * Get the latest thinking output
   */
  getLatestThinking(sessionId: string): ThinkingOutput | undefined {
    const outputs = this.thinkingOutputs.get(sessionId);
    return outputs?.[outputs.length - 1];
  }

  /**
   * Clear thinking outputs for a session
   */
  clearThinking(sessionId: string): void {
    this.thinkingOutputs.delete(sessionId);
    log.info('Thinking outputs cleared', { sessionId });
  }

  /**
   * Clear all session data
   */
  clearSession(sessionId: string): void {
    this.sessionConfigs.delete(sessionId);
    this.thinkingOutputs.delete(sessionId);
    log.info('Session cleared', { sessionId });
  }

  /**
   * Build API parameters for extended thinking
   */
  buildAPIParams(sessionId: string): { thinking?: { type: 'enabled'; budget_tokens: number } } {
    const config = this.getConfig(sessionId);
    if (!config.enabled) {
      return {};
    }

    return {
      thinking: {
        type: 'enabled',
        budget_tokens: config.budgetTokens,
      },
    };
  }
}

// Singleton instance
let thinkingManager: ExtendedThinkingManager | null = null;

export function getExtendedThinkingManager(): ExtendedThinkingManager {
  if (!thinkingManager) {
    thinkingManager = new ExtendedThinkingManager();
  }
  return thinkingManager;
}

/**
 * Extended thinking tools for the workspace agent
 */
export function getExtendedThinkingTools() {
  return [
    {
      name: 'thinking_enable',
      description: 'Enable extended thinking mode for deeper reasoning on complex problems',
      input_schema: {
        type: 'object' as const,
        properties: {
          budget: {
            type: 'number',
            description: 'Thinking budget in tokens (1000-50000, default 10000)',
          },
        },
        required: [],
      },
    },
    {
      name: 'thinking_disable',
      description: 'Disable extended thinking mode',
      input_schema: {
        type: 'object' as const,
        properties: {},
        required: [],
      },
    },
    {
      name: 'thinking_status',
      description: 'Get current extended thinking configuration',
      input_schema: {
        type: 'object' as const,
        properties: {},
        required: [],
      },
    },
  ];
}

/**
 * Execute an extended thinking tool
 */
export function executeExtendedThinkingTool(
  toolName: string,
  input: Record<string, unknown>,
  sessionId: string
): string {
  const manager = getExtendedThinkingManager();

  switch (toolName) {
    case 'thinking_enable': {
      const budget = input.budget as number | undefined;
      manager.enable(sessionId, budget);
      const config = manager.getConfig(sessionId);
      return `Extended thinking **enabled**\n\nBudget: ${config.budgetTokens.toLocaleString()} tokens\n\nI will now show my reasoning process for complex problems.`;
    }

    case 'thinking_disable': {
      manager.disable(sessionId);
      return 'Extended thinking **disabled**\n\nI will provide more concise responses.';
    }

    case 'thinking_status': {
      const config = manager.getConfig(sessionId);
      const outputs = manager.getThinkingOutputs(sessionId);
      const totalTokens = outputs.reduce((sum, o) => sum + (o.tokensUsed || 0), 0);

      const lines = [
        '**Extended Thinking Status**',
        '',
        `Enabled: ${config.enabled ? 'Yes' : 'No'}`,
        `Budget: ${config.budgetTokens.toLocaleString()} tokens`,
        `Show Thinking: ${config.showThinking ? 'Yes' : 'No'}`,
        `Stream Thinking: ${config.streamThinking ? 'Yes' : 'No'}`,
        '',
        `Thinking Blocks: ${outputs.length}`,
        `Total Tokens Used: ${totalTokens.toLocaleString()}`,
      ];

      return lines.join('\n');
    }

    default:
      return `Unknown thinking tool: ${toolName}`;
  }
}

/**
 * Check if a tool name is an extended thinking tool
 */
export function isExtendedThinkingTool(toolName: string): boolean {
  return ['thinking_enable', 'thinking_disable', 'thinking_status'].includes(toolName);
}

/**
 * Format thinking output for display
 */
export function formatThinkingForDisplay(output: ThinkingOutput): string {
  const header = output.tokensUsed
    ? `💭 Thinking (${output.tokensUsed.toLocaleString()} tokens)`
    : '💭 Thinking';

  return `<details>
<summary>${header}</summary>

${output.content}

</details>`;
}
