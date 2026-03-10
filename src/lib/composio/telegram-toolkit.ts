/**
 * COMPOSIO TELEGRAM TOOLKIT
 * =========================
 *
 * Comprehensive Telegram integration via Composio's tools.
 * Provides categorized actions, priority-based selection, and
 * context-aware tool loading for both Chat and Code Lab.
 *
 * Categories:
 * - Messages (send, edit, delete, forward, pin)
 * - Media (send photo, document, video, audio)
 * - Chats (get info, members)
 * - Updates (get updates, webhook)
 */

import { logger } from '@/lib/logger';

const log = logger('TelegramToolkit');

// ============================================================================
// TELEGRAM ACTION CATEGORIES
// ============================================================================

export type TelegramActionCategory = 'messages' | 'media' | 'chats' | 'updates';

export interface TelegramAction {
  name: string;
  label: string;
  category: TelegramActionCategory;
  priority: number;
  destructive?: boolean;
  writeOperation?: boolean;
}

// ============================================================================
// PRIORITY 1 - ESSENTIAL
// ============================================================================

const ESSENTIAL_ACTIONS: TelegramAction[] = [
  {
    name: 'TELEGRAM_SEND_MESSAGE',
    label: 'Send Message',
    category: 'messages',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'TELEGRAM_GET_UPDATES',
    label: 'Get Updates',
    category: 'updates',
    priority: 1,
  },
  {
    name: 'TELEGRAM_GET_CHAT',
    label: 'Get Chat',
    category: 'chats',
    priority: 1,
  },
  {
    name: 'TELEGRAM_SEND_PHOTO',
    label: 'Send Photo',
    category: 'media',
    priority: 1,
    writeOperation: true,
  },
];

// ============================================================================
// PRIORITY 2 - IMPORTANT
// ============================================================================

const IMPORTANT_ACTIONS: TelegramAction[] = [
  {
    name: 'TELEGRAM_SEND_DOCUMENT',
    label: 'Send Document',
    category: 'media',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'TELEGRAM_EDIT_MESSAGE',
    label: 'Edit Message',
    category: 'messages',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'TELEGRAM_FORWARD_MESSAGE',
    label: 'Forward Message',
    category: 'messages',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'TELEGRAM_SEND_VIDEO',
    label: 'Send Video',
    category: 'media',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'TELEGRAM_GET_CHAT_MEMBERS_COUNT',
    label: 'Get Chat Members Count',
    category: 'chats',
    priority: 2,
  },
];

// ============================================================================
// PRIORITY 3 - USEFUL
// ============================================================================

const USEFUL_ACTIONS: TelegramAction[] = [
  {
    name: 'TELEGRAM_PIN_MESSAGE',
    label: 'Pin Message',
    category: 'messages',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'TELEGRAM_UNPIN_MESSAGE',
    label: 'Unpin Message',
    category: 'messages',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'TELEGRAM_SEND_AUDIO',
    label: 'Send Audio',
    category: 'media',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'TELEGRAM_SEND_LOCATION',
    label: 'Send Location',
    category: 'messages',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'TELEGRAM_GET_ME',
    label: 'Get Me',
    category: 'updates',
    priority: 3,
  },
];

// ============================================================================
// PRIORITY 4 - ADVANCED
// ============================================================================

const ADVANCED_ACTIONS: TelegramAction[] = [
  {
    name: 'TELEGRAM_DELETE_MESSAGE',
    label: 'Delete Message',
    category: 'messages',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'TELEGRAM_SET_WEBHOOK',
    label: 'Set Webhook',
    category: 'updates',
    priority: 4,
    writeOperation: true,
  },
  {
    name: 'TELEGRAM_DELETE_WEBHOOK',
    label: 'Delete Webhook',
    category: 'updates',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'TELEGRAM_GET_CHAT_MEMBER',
    label: 'Get Chat Member',
    category: 'chats',
    priority: 4,
  },
];

// ============================================================================
// COMBINED ACTION REGISTRY
// ============================================================================

export const ALL_TELEGRAM_ACTIONS: TelegramAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

// ============================================================================
// QUERY HELPERS
// ============================================================================

export function getTelegramFeaturedActionNames(): string[] {
  return ALL_TELEGRAM_ACTIONS.map((a) => a.name);
}

export function getTelegramActionsByPriority(maxPriority: number = 3): TelegramAction[] {
  return ALL_TELEGRAM_ACTIONS.filter((a) => a.priority <= maxPriority);
}

export function getTelegramActionNamesByPriority(maxPriority: number = 3): string[] {
  return getTelegramActionsByPriority(maxPriority).map((a) => a.name);
}

export function getTelegramActionsByCategory(category: TelegramActionCategory): TelegramAction[] {
  return ALL_TELEGRAM_ACTIONS.filter((a) => a.category === category);
}

export function getTelegramActionPriority(toolName: string): number {
  const normalized = toolName.replace(/^composio_/, '');
  const action = ALL_TELEGRAM_ACTIONS.find((a) => a.name === normalized);
  return action?.priority ?? 99;
}

export function isKnownTelegramAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_TELEGRAM_ACTIONS.some((a) => a.name === normalized);
}

export function isDestructiveTelegramAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_TELEGRAM_ACTIONS.find((a) => a.name === normalized)?.destructive === true;
}

export function sortByTelegramPriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort((a, b) => {
    return getTelegramActionPriority(a.name) - getTelegramActionPriority(b.name);
  });
}

export function getTelegramActionStats(): {
  total: number;
  byPriority: Record<number, number>;
  byCategory: Record<string, number>;
} {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_TELEGRAM_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_TELEGRAM_ACTIONS.length, byPriority, byCategory };
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

export function getTelegramSystemPrompt(): string {
  return `
## Telegram Integration (Full Capabilities)

You have **full Telegram Bot access** through the user's connected account. Use the \`composio_TELEGRAM_*\` tools.

### Messages
- Send text messages to chats, groups, or channels
- Edit previously sent messages
- Forward messages between chats
- Pin and unpin important messages
- Send locations and contacts
- Delete messages (with confirmation)

### Media
- Send photos with optional captions
- Send documents and files
- Send videos and audio files

### Chats
- Get chat information and details
- View chat member counts
- Get specific member info

### Safety Rules
1. **ALWAYS confirm before sending messages** - show the chat, message content, and any media:
\`\`\`action-preview
{
  "platform": "Telegram",
  "action": "Send Message",
  "chat": "Chat name/ID",
  "message": "Message preview...",
  "toolName": "composio_TELEGRAM_SEND_MESSAGE",
  "toolParams": { "chat_id": "...", "text": "..." }
}
\`\`\`
2. **Confirm before deleting messages** - deletion may be irreversible
3. **Confirm before forwarding** - show source and destination
4. **For media sends**, confirm file details and destination
5. **Handle bot permissions carefully** - some actions require admin rights in groups
`;
}

export function getTelegramCapabilitySummary(): string {
  const stats = getTelegramActionStats();
  return `Telegram (${stats.total} actions: messages, media, chats, updates)`;
}

export function logTelegramToolkitStats(): void {
  const stats = getTelegramActionStats();
  log.info('Telegram Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
