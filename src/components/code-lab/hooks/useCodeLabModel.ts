/**
 * USE CODE LAB MODEL HOOK
 *
 * Manages AI model selection and extended thinking configuration.
 * Provides Claude Code parity for model selection and thinking modes.
 */

import { useState, useCallback } from 'react';
import { logger } from '@/lib/logger';
import type { ExtendedThinkingConfig } from '@/lib/workspace/extended-thinking';
import type { SessionStats } from '@/lib/workspace/token-tracker';

const log = logger('CodeLabModel');

export interface UseCodeLabModelOptions {
  defaultModelId?: string;
  defaultThinkingConfig?: ExtendedThinkingConfig;
  onToast?: (type: 'success' | 'error', title: string, message: string) => void;
}

export interface UseCodeLabModelReturn {
  // State
  currentModelId: string;
  thinkingConfig: ExtendedThinkingConfig;
  tokenStats: SessionStats;

  // Actions
  handleModelChange: (modelId: string) => void;
  handleThinkingToggle: () => void;
  handleThinkingBudgetChange: (budget: number) => void;
  setTokenStats: React.Dispatch<React.SetStateAction<SessionStats>>;
  resetTokenStats: () => void;
}

const DEFAULT_TOKEN_STATS: SessionStats = {
  totalInputTokens: 0,
  totalOutputTokens: 0,
  totalCacheReadTokens: 0,
  totalCacheWriteTokens: 0,
  totalCost: { inputCost: 0, outputCost: 0, cacheCost: 0, totalCost: 0, currency: 'USD' },
  messageCount: 0,
  startedAt: Date.now(),
  contextUsagePercent: 0,
};

const DEFAULT_THINKING_CONFIG: ExtendedThinkingConfig = {
  enabled: false,
  budgetTokens: 10000,
  showThinking: true,
  streamThinking: true,
};

export function useCodeLabModel(options: UseCodeLabModelOptions = {}): UseCodeLabModelReturn {
  const {
    defaultModelId = 'claude-sonnet-4-6',
    defaultThinkingConfig = DEFAULT_THINKING_CONFIG,
    onToast,
  } = options;

  const [currentModelId, setCurrentModelId] = useState(defaultModelId);
  const [thinkingConfig, setThinkingConfig] =
    useState<ExtendedThinkingConfig>(defaultThinkingConfig);
  const [tokenStats, setTokenStats] = useState<SessionStats>({
    ...DEFAULT_TOKEN_STATS,
    startedAt: Date.now(),
  });

  const handleModelChange = useCallback(
    (modelId: string) => {
      setCurrentModelId(modelId);
      log.info('Model changed', { modelId });

      const modelName = modelId.includes('opus')
        ? 'Opus'
        : modelId.includes('haiku')
          ? 'Haiku'
          : 'Sonnet';

      onToast?.('success', 'Model Changed', `Switched to ${modelName}`);
    },
    [onToast]
  );

  const handleThinkingToggle = useCallback(() => {
    setThinkingConfig((prev) => {
      const newEnabled = !prev.enabled;

      if (newEnabled) {
        onToast?.(
          'success',
          'Thinking Enabled',
          `Extended thinking with ${prev.budgetTokens / 1000}K token budget`
        );
      } else {
        onToast?.('success', 'Thinking Disabled', 'Normal response mode');
      }

      return { ...prev, enabled: newEnabled };
    });
  }, [onToast]);

  const handleThinkingBudgetChange = useCallback(
    (budget: number) => {
      setThinkingConfig((prev) => ({ ...prev, budgetTokens: budget }));
      onToast?.('success', 'Budget Updated', `Thinking budget set to ${budget / 1000}K tokens`);
    },
    [onToast]
  );

  const resetTokenStats = useCallback(() => {
    setTokenStats({
      ...DEFAULT_TOKEN_STATS,
      startedAt: Date.now(),
    });
  }, []);

  return {
    currentModelId,
    thinkingConfig,
    tokenStats,
    handleModelChange,
    handleThinkingToggle,
    handleThinkingBudgetChange,
    setTokenStats,
    resetTokenStats,
  };
}
