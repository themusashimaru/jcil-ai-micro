/**
 * COMPOSIO WHATSAPP BUSINESS TOOLKIT
 * ====================================
 *
 * Comprehensive WhatsApp Business integration via Composio's tools.
 *
 * Categories:
 * - Messages (send text, media, template, reply, react)
 * - Media (send image, video, document, audio, sticker)
 * - Contacts (get profile, list)
 * - Business (profile, catalog, labels)
 */

import { logger } from '@/lib/logger';

const log = logger('WhatsAppToolkit');

export type WhatsAppActionCategory = 'messages' | 'media' | 'contacts' | 'business';

export interface WhatsAppAction {
  name: string;
  label: string;
  category: WhatsAppActionCategory;
  priority: number;
  destructive?: boolean;
  writeOperation?: boolean;
}

const ESSENTIAL_ACTIONS: WhatsAppAction[] = [
  {
    name: 'WHATSAPP_SEND_MESSAGE',
    label: 'Send Message',
    category: 'messages',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'WHATSAPP_SEND_TEMPLATE',
    label: 'Send Template Message',
    category: 'messages',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'WHATSAPP_SEND_IMAGE',
    label: 'Send Image',
    category: 'media',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'WHATSAPP_GET_PROFILE',
    label: 'Get Business Profile',
    category: 'business',
    priority: 1,
  },
  {
    name: 'WHATSAPP_REPLY_MESSAGE',
    label: 'Reply to Message',
    category: 'messages',
    priority: 1,
    writeOperation: true,
  },
];

const IMPORTANT_ACTIONS: WhatsAppAction[] = [
  {
    name: 'WHATSAPP_SEND_DOCUMENT',
    label: 'Send Document',
    category: 'media',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'WHATSAPP_SEND_VIDEO',
    label: 'Send Video',
    category: 'media',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'WHATSAPP_SEND_AUDIO',
    label: 'Send Audio',
    category: 'media',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'WHATSAPP_SEND_LOCATION',
    label: 'Send Location',
    category: 'messages',
    priority: 2,
    writeOperation: true,
  },
  { name: 'WHATSAPP_GET_CONTACT', label: 'Get Contact', category: 'contacts', priority: 2 },
  {
    name: 'WHATSAPP_REACT_MESSAGE',
    label: 'React to Message',
    category: 'messages',
    priority: 2,
    writeOperation: true,
  },
];

const USEFUL_ACTIONS: WhatsAppAction[] = [
  {
    name: 'WHATSAPP_SEND_STICKER',
    label: 'Send Sticker',
    category: 'media',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'WHATSAPP_MARK_READ',
    label: 'Mark as Read',
    category: 'messages',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'WHATSAPP_UPDATE_PROFILE',
    label: 'Update Business Profile',
    category: 'business',
    priority: 3,
    writeOperation: true,
  },
  { name: 'WHATSAPP_LIST_TEMPLATES', label: 'List Templates', category: 'business', priority: 3 },
  {
    name: 'WHATSAPP_SEND_CONTACTS',
    label: 'Send Contacts',
    category: 'contacts',
    priority: 3,
    writeOperation: true,
  },
];

const ADVANCED_ACTIONS: WhatsAppAction[] = [
  {
    name: 'WHATSAPP_DELETE_MESSAGE',
    label: 'Delete Message',
    category: 'messages',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  { name: 'WHATSAPP_GET_MEDIA', label: 'Get Media', category: 'media', priority: 4 },
  {
    name: 'WHATSAPP_UPLOAD_MEDIA',
    label: 'Upload Media',
    category: 'media',
    priority: 4,
    writeOperation: true,
  },
  {
    name: 'WHATSAPP_GET_PHONE_NUMBERS',
    label: 'Get Phone Numbers',
    category: 'business',
    priority: 4,
  },
];

export const ALL_WHATSAPP_ACTIONS: WhatsAppAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

export function getWhatsAppFeaturedActionNames(): string[] {
  return ALL_WHATSAPP_ACTIONS.map((a) => a.name);
}
export function getWhatsAppActionsByPriority(maxPriority: number = 3): WhatsAppAction[] {
  return ALL_WHATSAPP_ACTIONS.filter((a) => a.priority <= maxPriority);
}
export function getWhatsAppActionNamesByPriority(maxPriority: number = 3): string[] {
  return getWhatsAppActionsByPriority(maxPriority).map((a) => a.name);
}
export function getWhatsAppActionsByCategory(category: WhatsAppActionCategory): WhatsAppAction[] {
  return ALL_WHATSAPP_ACTIONS.filter((a) => a.category === category);
}
export function getWhatsAppActionPriority(toolName: string): number {
  const n = toolName.replace(/^composio_/, '');
  return ALL_WHATSAPP_ACTIONS.find((a) => a.name === n)?.priority ?? 99;
}
export function isKnownWhatsAppAction(toolName: string): boolean {
  return ALL_WHATSAPP_ACTIONS.some((a) => a.name === toolName.replace(/^composio_/, ''));
}
export function isDestructiveWhatsAppAction(toolName: string): boolean {
  return (
    ALL_WHATSAPP_ACTIONS.find((a) => a.name === toolName.replace(/^composio_/, ''))?.destructive ===
    true
  );
}
export function sortByWhatsAppPriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort(
    (a, b) => getWhatsAppActionPriority(a.name) - getWhatsAppActionPriority(b.name)
  );
}

export function getWhatsAppActionStats() {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_WHATSAPP_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_WHATSAPP_ACTIONS.length, byPriority, byCategory };
}

export function getWhatsAppSystemPrompt(): string {
  return `
## WhatsApp Business Integration (Full Capabilities)

You have **full WhatsApp Business access** through the user's connected account. Use the \`composio_WHATSAPP_*\` tools.

### Messages
- Send text messages to any WhatsApp number
- Send template messages for business notifications
- Reply to specific messages in conversations
- React to messages with emojis
- Mark messages as read

### Media
- Send images, videos, documents, audio, and stickers
- Upload and manage media files
- Retrieve media from received messages

### Business Profile & Contacts
- View and update business profile information
- Get contact details and profiles
- List available message templates
- View registered phone numbers

### Safety Rules
1. **ALWAYS confirm before sending messages** - show the recipient, message content, and any media
2. **Confirm before deleting messages** - deletion is permanent
3. **For template messages**, show the template name and parameters before sending
4. **Handle phone numbers carefully** - verify the format includes country code
5. **For media sends**, confirm file type and destination
`;
}

export function getWhatsAppCapabilitySummary(): string {
  const stats = getWhatsAppActionStats();
  return `WhatsApp (${stats.total} actions: messages, media, contacts, business)`;
}

export function logWhatsAppToolkitStats(): void {
  const stats = getWhatsAppActionStats();
  log.info('WhatsApp Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
