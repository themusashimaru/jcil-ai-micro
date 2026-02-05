/**
 * PROMPT SYSTEM - Mode Selector
 *
 * One engine, many modes. This module provides prompt sets
 * that plug into the shared agent engine based on the selected mode.
 *
 * To add a new agent mode:
 * 1. Create a new prompt file (e.g., prompts/mymode.ts)
 * 2. Define a PromptSet with all required prompts
 * 3. Register it in the PROMPT_REGISTRY below
 * 4. Add the mode string to AgentMode type in types.ts
 */

export type { PromptSet } from './types';
export { STRATEGY_PROMPTS } from './strategy';
export { RESEARCH_PROMPTS } from './research';
export { QUICK_RESEARCH_PROMPTS } from './quick-research';
export { QUICK_STRATEGY_PROMPTS } from './quick-strategy';
export { DEEP_WRITER_PROMPTS } from './deep-writer';

import type { PromptSet } from './types';
import { STRATEGY_PROMPTS } from './strategy';
import { RESEARCH_PROMPTS } from './research';
import { QUICK_RESEARCH_PROMPTS } from './quick-research';
import { QUICK_STRATEGY_PROMPTS } from './quick-strategy';
import { DEEP_WRITER_PROMPTS } from './deep-writer';

/**
 * Registry of all available prompt sets.
 * Add new modes here as they're created.
 */
const PROMPT_REGISTRY: Record<string, PromptSet> = {
  strategy: STRATEGY_PROMPTS,
  research: RESEARCH_PROMPTS,
  'quick-research': QUICK_RESEARCH_PROMPTS,
  'quick-strategy': QUICK_STRATEGY_PROMPTS,
  'deep-writer': DEEP_WRITER_PROMPTS,
};

/**
 * Get the prompt set for a given agent mode.
 * Defaults to 'strategy' if mode is not found.
 */
export function getPrompts(mode: string): PromptSet {
  return PROMPT_REGISTRY[mode] || STRATEGY_PROMPTS;
}

/**
 * Get all available mode names.
 */
export function getAvailableModes(): string[] {
  return Object.keys(PROMPT_REGISTRY);
}
