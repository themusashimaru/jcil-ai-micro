/**
 * Model Configuration System
 *
 * Provides model selection and configuration for the workspace agent.
 * Supports Sonnet, Opus, and Haiku with per-session overrides.
 *
 * This brings Code Lab closer to Claude Code's model selection capability.
 */

import { logger } from '@/lib/logger';

const log = logger('model-config');

// Available model types
export type ModelType = 'sonnet' | 'opus' | 'haiku';

// Model configuration
export interface ModelConfig {
  id: string;
  name: string;
  type: ModelType;
  description: string;
  contextWindow: number;
  maxOutput: number;
  costPer1kInput: number; // in cents
  costPer1kOutput: number; // in cents
  supportsExtendedThinking: boolean;
  supportsVision: boolean;
  recommended?: boolean;
}

// Available models - Claude 4.5 family (latest generation)
export const AVAILABLE_MODELS: ModelConfig[] = [
  {
    id: 'claude-sonnet-4-5-20250514',
    name: 'Claude Sonnet 4.5',
    type: 'sonnet',
    description: 'Best balance of speed and intelligence. Recommended for most coding tasks.',
    contextWindow: 200000,
    maxOutput: 16384,
    costPer1kInput: 0.3,
    costPer1kOutput: 1.5,
    supportsExtendedThinking: true,
    supportsVision: true,
    recommended: true,
  },
  {
    id: 'claude-opus-4-5-20250514',
    name: 'Claude Opus 4.5',
    type: 'opus',
    description: 'Most capable model. Best for complex reasoning and difficult problems.',
    contextWindow: 200000,
    maxOutput: 16384,
    costPer1kInput: 0.5,
    costPer1kOutput: 2.5,
    supportsExtendedThinking: true,
    supportsVision: true,
  },
  {
    id: 'claude-haiku-4-5-20250514',
    name: 'Claude Haiku 4.5',
    type: 'haiku',
    description: 'Fastest model. Best for simple tasks and quick iterations.',
    contextWindow: 200000,
    maxOutput: 16384,
    costPer1kInput: 0.1,
    costPer1kOutput: 0.5,
    supportsExtendedThinking: true,
    supportsVision: true,
  },
];

// Session model preferences
export interface ModelPreferences {
  defaultModel: string;
  extendedThinking: boolean;
  thinkingBudget: number; // tokens for thinking
  temperature: number;
  maxTokens: number;
}

// Default preferences
export const DEFAULT_PREFERENCES: ModelPreferences = {
  defaultModel: 'claude-sonnet-4-5-20250514',
  extendedThinking: false,
  thinkingBudget: 10000,
  temperature: 0.7,
  maxTokens: 16384,
};

/**
 * Model Configuration Manager
 *
 * Manages model selection and preferences for sessions.
 */
export class ModelConfigManager {
  private sessionPreferences: Map<string, ModelPreferences> = new Map();
  private globalPreferences: ModelPreferences = { ...DEFAULT_PREFERENCES };

  constructor() {
    log.info('ModelConfigManager initialized');
  }

  /**
   * Get available models
   */
  getAvailableModels(): ModelConfig[] {
    return AVAILABLE_MODELS;
  }

  /**
   * Get model by ID
   */
  getModel(modelId: string): ModelConfig | undefined {
    return AVAILABLE_MODELS.find((m) => m.id === modelId);
  }

  /**
   * Get model by type
   */
  getModelByType(type: ModelType): ModelConfig {
    const model = AVAILABLE_MODELS.find((m) => m.type === type);
    return model || AVAILABLE_MODELS[0]; // Default to Sonnet
  }

  /**
   * Get current model for a session
   */
  getCurrentModel(sessionId?: string): ModelConfig {
    const prefs = sessionId
      ? this.sessionPreferences.get(sessionId) || this.globalPreferences
      : this.globalPreferences;

    return this.getModel(prefs.defaultModel) || AVAILABLE_MODELS[0];
  }

  /**
   * Set model for a session
   */
  setSessionModel(sessionId: string, modelId: string): boolean {
    const model = this.getModel(modelId);
    if (!model) {
      log.warn('Invalid model ID', { modelId });
      return false;
    }

    const prefs = this.getSessionPreferences(sessionId);
    prefs.defaultModel = modelId;
    this.sessionPreferences.set(sessionId, prefs);

    log.info('Session model updated', { sessionId, modelId });
    return true;
  }

  /**
   * Get preferences for a session
   */
  getSessionPreferences(sessionId: string): ModelPreferences {
    return this.sessionPreferences.get(sessionId) || { ...this.globalPreferences };
  }

  /**
   * Update session preferences
   */
  updateSessionPreferences(sessionId: string, updates: Partial<ModelPreferences>): void {
    const current = this.getSessionPreferences(sessionId);
    const updated = { ...current, ...updates };
    this.sessionPreferences.set(sessionId, updated);

    log.info('Session preferences updated', { sessionId, updates });
  }

  /**
   * Set extended thinking mode
   */
  setExtendedThinking(sessionId: string, enabled: boolean, budget?: number): void {
    const prefs = this.getSessionPreferences(sessionId);

    // Check if model supports extended thinking
    const model = this.getModel(prefs.defaultModel);
    if (enabled && model && !model.supportsExtendedThinking) {
      log.warn('Model does not support extended thinking', { model: model.name });
      // Auto-switch to Sonnet which supports it
      prefs.defaultModel = 'claude-sonnet-4-5-20250514';
    }

    prefs.extendedThinking = enabled;
    if (budget !== undefined) {
      prefs.thinkingBudget = budget;
    }

    this.sessionPreferences.set(sessionId, prefs);
    log.info('Extended thinking updated', { sessionId, enabled, budget: prefs.thinkingBudget });
  }

  /**
   * Clear session preferences
   */
  clearSessionPreferences(sessionId: string): void {
    this.sessionPreferences.delete(sessionId);
    log.info('Session preferences cleared', { sessionId });
  }

  /**
   * Calculate estimated cost for tokens
   */
  calculateCost(
    modelId: string,
    inputTokens: number,
    outputTokens: number
  ): { inputCost: number; outputCost: number; totalCost: number } {
    const model = this.getModel(modelId);
    if (!model) {
      return { inputCost: 0, outputCost: 0, totalCost: 0 };
    }

    const inputCost = (inputTokens / 1000) * model.costPer1kInput;
    const outputCost = (outputTokens / 1000) * model.costPer1kOutput;

    return {
      inputCost: Math.round(inputCost * 100) / 100,
      outputCost: Math.round(outputCost * 100) / 100,
      totalCost: Math.round((inputCost + outputCost) * 100) / 100,
    };
  }

  /**
   * Get model options for UI dropdown
   */
  getModelOptions(): Array<{
    id: string;
    name: string;
    type: ModelType;
    description: string;
    recommended: boolean;
    badge?: string;
  }> {
    return AVAILABLE_MODELS.map((m) => ({
      id: m.id,
      name: m.name,
      type: m.type,
      description: m.description,
      recommended: m.recommended || false,
      badge: m.type === 'opus' ? 'Most Capable' : m.type === 'haiku' ? 'Fastest' : undefined,
    }));
  }
}

// Singleton instance
let modelConfigManager: ModelConfigManager | null = null;

export function getModelConfigManager(): ModelConfigManager {
  if (!modelConfigManager) {
    modelConfigManager = new ModelConfigManager();
  }
  return modelConfigManager;
}

/**
 * Model configuration tools for the workspace agent
 */
export function getModelConfigTools() {
  return [
    {
      name: 'model_list',
      description: 'List available AI models with their capabilities and costs',
      input_schema: {
        type: 'object' as const,
        properties: {},
        required: [],
      },
    },
    {
      name: 'model_select',
      description:
        'Select an AI model for this session. Options: sonnet (recommended), opus (most capable), haiku (fastest)',
      input_schema: {
        type: 'object' as const,
        properties: {
          model: {
            type: 'string',
            enum: ['sonnet', 'opus', 'haiku'],
            description: 'Model type to use',
          },
        },
        required: ['model'],
      },
    },
    {
      name: 'model_current',
      description: 'Get the currently selected model and its configuration',
      input_schema: {
        type: 'object' as const,
        properties: {},
        required: [],
      },
    },
  ];
}

/**
 * Execute a model configuration tool
 */
export function executeModelConfigTool(
  toolName: string,
  input: Record<string, unknown>,
  sessionId: string
): string {
  const manager = getModelConfigManager();

  switch (toolName) {
    case 'model_list': {
      const models = manager.getAvailableModels();
      const lines = ['**Available Models:**\n'];

      for (const model of models) {
        const badge = model.recommended ? ' (Recommended)' : '';
        lines.push(`**${model.name}**${badge}`);
        lines.push(`  Type: ${model.type}`);
        lines.push(`  ${model.description}`);
        lines.push(`  Context: ${(model.contextWindow / 1000).toFixed(0)}K tokens`);
        lines.push(`  Cost: $${model.costPer1kInput}/1K in, $${model.costPer1kOutput}/1K out`);
        lines.push(`  Extended Thinking: ${model.supportsExtendedThinking ? 'Yes' : 'No'}`);
        lines.push(`  Vision: ${model.supportsVision ? 'Yes' : 'No'}`);
        lines.push('');
      }

      return lines.join('\n');
    }

    case 'model_select': {
      const modelType = input.model as ModelType;
      const model = manager.getModelByType(modelType);

      if (manager.setSessionModel(sessionId, model.id)) {
        return `Model switched to **${model.name}**\n\n${model.description}`;
      }

      return 'Failed to switch model.';
    }

    case 'model_current': {
      const model = manager.getCurrentModel(sessionId);
      const prefs = manager.getSessionPreferences(sessionId);

      return `**Current Model:** ${model.name}
Type: ${model.type}
Extended Thinking: ${prefs.extendedThinking ? 'Enabled' : 'Disabled'}
Thinking Budget: ${prefs.thinkingBudget} tokens
Temperature: ${prefs.temperature}
Max Tokens: ${prefs.maxTokens}`;
    }

    default:
      return `Unknown model tool: ${toolName}`;
  }
}

/**
 * Check if a tool name is a model config tool
 */
export function isModelConfigTool(toolName: string): boolean {
  return ['model_list', 'model_select', 'model_current'].includes(toolName);
}
