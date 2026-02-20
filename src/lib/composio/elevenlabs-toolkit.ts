/**
 * COMPOSIO ELEVENLABS TOOLKIT
 * ============================
 *
 * Comprehensive ElevenLabs integration via Composio's tools.
 * Provides categorized actions, priority-based selection, and
 * context-aware tool loading for both Chat and Code Lab.
 *
 * Categories:
 * - TTS (text-to-speech, streaming)
 * - Voices (list, get, create, edit, clone, settings)
 * - Audio (history, audio retrieval)
 * - Projects (user info, subscription info)
 */

import { logger } from '@/lib/logger';

const log = logger('ElevenLabsToolkit');

// ============================================================================
// ELEVENLABS ACTION CATEGORIES
// ============================================================================

export type ElevenLabsActionCategory = 'tts' | 'voices' | 'audio' | 'projects';

export interface ElevenLabsAction {
  name: string; // Composio action name (e.g., ELEVENLABS_TEXT_TO_SPEECH)
  label: string; // Human-readable label
  category: ElevenLabsActionCategory;
  priority: number; // 1 = highest (always include), 4 = lowest
  destructive?: boolean; // Requires extra confirmation
  writeOperation?: boolean; // Modifies state (vs read-only)
}

// ============================================================================
// PRIORITY 1 - ESSENTIAL (Always loaded when ElevenLabs connected)
// ============================================================================

const ESSENTIAL_ACTIONS: ElevenLabsAction[] = [
  // TTS - Core
  {
    name: 'ELEVENLABS_TEXT_TO_SPEECH',
    label: 'Text to Speech',
    category: 'tts',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'ELEVENLABS_TEXT_TO_SPEECH_STREAM',
    label: 'Text to Speech Stream',
    category: 'tts',
    priority: 1,
    writeOperation: true,
  },

  // Voices - Core
  {
    name: 'ELEVENLABS_LIST_VOICES',
    label: 'List Voices',
    category: 'voices',
    priority: 1,
  },
  {
    name: 'ELEVENLABS_GET_VOICE',
    label: 'Get Voice',
    category: 'voices',
    priority: 1,
  },
];

// ============================================================================
// PRIORITY 2 - IMPORTANT (Loaded when tool budget allows)
// ============================================================================

const IMPORTANT_ACTIONS: ElevenLabsAction[] = [
  // Voices - Management
  {
    name: 'ELEVENLABS_CREATE_VOICE',
    label: 'Create Voice',
    category: 'voices',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'ELEVENLABS_EDIT_VOICE',
    label: 'Edit Voice',
    category: 'voices',
    priority: 2,
    writeOperation: true,
  },

  // Audio
  {
    name: 'ELEVENLABS_GET_AUDIO',
    label: 'Get Audio',
    category: 'audio',
    priority: 2,
  },

  // TTS - Extended
  {
    name: 'ELEVENLABS_LIST_MODELS',
    label: 'List Models',
    category: 'tts',
    priority: 2,
  },
];

// ============================================================================
// PRIORITY 3 - USEFUL (Loaded for power users or specific contexts)
// ============================================================================

const USEFUL_ACTIONS: ElevenLabsAction[] = [
  // Voices - Extended
  {
    name: 'ELEVENLABS_CLONE_VOICE',
    label: 'Clone Voice',
    category: 'voices',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'ELEVENLABS_GET_VOICE_SETTINGS',
    label: 'Get Voice Settings',
    category: 'voices',
    priority: 3,
  },
  {
    name: 'ELEVENLABS_UPDATE_VOICE_SETTINGS',
    label: 'Update Voice Settings',
    category: 'voices',
    priority: 3,
    writeOperation: true,
  },

  // Audio - Extended
  {
    name: 'ELEVENLABS_LIST_HISTORY',
    label: 'List History',
    category: 'audio',
    priority: 3,
  },
];

// ============================================================================
// PRIORITY 4 - ADVANCED (Destructive operations)
// ============================================================================

const ADVANCED_ACTIONS: ElevenLabsAction[] = [
  {
    name: 'ELEVENLABS_DELETE_VOICE',
    label: 'Delete Voice',
    category: 'voices',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'ELEVENLABS_DELETE_HISTORY_ITEM',
    label: 'Delete History Item',
    category: 'audio',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'ELEVENLABS_GET_USER_INFO',
    label: 'Get User Info',
    category: 'projects',
    priority: 4,
  },
  {
    name: 'ELEVENLABS_GET_SUBSCRIPTION_INFO',
    label: 'Get Subscription Info',
    category: 'projects',
    priority: 4,
  },
];

// ============================================================================
// COMBINED ACTION REGISTRY
// ============================================================================

export const ALL_ELEVENLABS_ACTIONS: ElevenLabsAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

// ============================================================================
// QUERY HELPERS
// ============================================================================

export function getElevenLabsFeaturedActionNames(): string[] {
  return ALL_ELEVENLABS_ACTIONS.map((a) => a.name);
}

export function getElevenLabsActionsByPriority(maxPriority: number = 3): ElevenLabsAction[] {
  return ALL_ELEVENLABS_ACTIONS.filter((a) => a.priority <= maxPriority);
}

export function getElevenLabsActionNamesByPriority(maxPriority: number = 3): string[] {
  return getElevenLabsActionsByPriority(maxPriority).map((a) => a.name);
}

export function getElevenLabsActionsByCategory(
  category: ElevenLabsActionCategory
): ElevenLabsAction[] {
  return ALL_ELEVENLABS_ACTIONS.filter((a) => a.category === category);
}

export function getElevenLabsActionPriority(toolName: string): number {
  const normalized = toolName.replace(/^composio_/, '');
  const action = ALL_ELEVENLABS_ACTIONS.find((a) => a.name === normalized);
  return action?.priority ?? 99;
}

export function isKnownElevenLabsAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_ELEVENLABS_ACTIONS.some((a) => a.name === normalized);
}

export function isDestructiveElevenLabsAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_ELEVENLABS_ACTIONS.find((a) => a.name === normalized)?.destructive === true;
}

/**
 * Sort Composio tools by ElevenLabs action priority.
 * Known ElevenLabs actions sorted by priority (1-4), unknown actions last.
 */
export function sortByElevenLabsPriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort((a, b) => {
    return getElevenLabsActionPriority(a.name) - getElevenLabsActionPriority(b.name);
  });
}

export function getElevenLabsActionStats(): {
  total: number;
  byPriority: Record<number, number>;
  byCategory: Record<string, number>;
} {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_ELEVENLABS_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_ELEVENLABS_ACTIONS.length, byPriority, byCategory };
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

/**
 * Generate ElevenLabs-specific system prompt when user has ElevenLabs connected.
 * Tells Claude exactly what it can do via the Composio ElevenLabs toolkit.
 */
export function getElevenLabsSystemPrompt(): string {
  return `
## ElevenLabs Integration (Full Capabilities)

You have **full ElevenLabs access** through the user's connected account. Use the \`composio_ELEVENLABS_*\` tools.

### Text-to-Speech
- Generate speech from text using any available voice
- Stream text-to-speech for real-time audio output
- List available models to choose the best one for quality, latency, or language support
- Control voice settings like stability, similarity boost, and style

### Voice Management
- List all available voices (premade and custom)
- Get detailed information about a specific voice
- Create new custom voices with sample audio
- Edit existing voice properties (name, description, labels)
- Clone voices from audio samples for personalized speech
- View and update voice settings (stability, similarity, style, speaker boost)

### Audio & History
- Retrieve generated audio files
- Browse generation history to find previous outputs
- Review past text-to-speech generations

### Account & Projects
- View user account information
- Check subscription details and usage limits

### Safety Rules
1. **ALWAYS confirm before generating speech** - show the text, selected voice, and model details:
\`\`\`action-preview
{
  "platform": "ElevenLabs",
  "action": "Text to Speech",
  "text": "Preview of text...",
  "voice": "Voice name/ID",
  "model": "Model name",
  "toolName": "composio_ELEVENLABS_TEXT_TO_SPEECH",
  "toolParams": { "text": "...", "voice_id": "...", "model_id": "..." }
}
\`\`\`
2. **Confirm before deleting voices** - voice deletion is permanent and cannot be undone; always show the voice name and ID before proceeding
3. **Confirm before deleting history items** - deleted audio history cannot be recovered
4. **Be mindful of character quotas** - large text-to-speech requests consume characters from the user's subscription; warn if the text is unusually long
5. **For voice cloning**, clearly explain what audio samples are needed and get explicit approval before creating the clone
6. **Handle voice settings carefully** - show current settings before making changes and confirm the new values
7. **For batch operations**, summarize what will happen and get explicit approval
`;
}

/**
 * Get concise summary for limited-space contexts
 */
export function getElevenLabsCapabilitySummary(): string {
  const stats = getElevenLabsActionStats();
  return `ElevenLabs (${stats.total} actions: text-to-speech, voices, audio, projects)`;
}

export function logElevenLabsToolkitStats(): void {
  const stats = getElevenLabsActionStats();
  log.info('ElevenLabs Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
