/**
 * COMPOSIO TWILIO TOOLKIT
 * ========================
 *
 * Comprehensive Twilio integration via Composio's tools.
 *
 * Categories:
 * - SMS (send, receive, list messages)
 * - Voice (make calls, manage recordings)
 * - Phone Numbers (list, buy, manage)
 * - Account (usage, balance, subaccounts)
 */

import { logger } from '@/lib/logger';

const log = logger('TwilioToolkit');

export type TwilioActionCategory = 'sms' | 'voice' | 'phone_numbers' | 'account';

export interface TwilioAction {
  name: string;
  label: string;
  category: TwilioActionCategory;
  priority: number;
  destructive?: boolean;
  writeOperation?: boolean;
}

const ESSENTIAL_ACTIONS: TwilioAction[] = [
  {
    name: 'TWILIO_SEND_SMS',
    label: 'Send SMS',
    category: 'sms',
    priority: 1,
    writeOperation: true,
  },
  { name: 'TWILIO_LIST_MESSAGES', label: 'List Messages', category: 'sms', priority: 1 },
  {
    name: 'TWILIO_MAKE_CALL',
    label: 'Make Call',
    category: 'voice',
    priority: 1,
    writeOperation: true,
  },
  { name: 'TWILIO_GET_MESSAGE', label: 'Get Message', category: 'sms', priority: 1 },
  {
    name: 'TWILIO_LIST_PHONE_NUMBERS',
    label: 'List Phone Numbers',
    category: 'phone_numbers',
    priority: 1,
  },
];

const IMPORTANT_ACTIONS: TwilioAction[] = [
  {
    name: 'TWILIO_SEND_MMS',
    label: 'Send MMS',
    category: 'sms',
    priority: 2,
    writeOperation: true,
  },
  { name: 'TWILIO_GET_CALL', label: 'Get Call Details', category: 'voice', priority: 2 },
  { name: 'TWILIO_LIST_CALLS', label: 'List Calls', category: 'voice', priority: 2 },
  { name: 'TWILIO_LIST_RECORDINGS', label: 'List Recordings', category: 'voice', priority: 2 },
  { name: 'TWILIO_GET_ACCOUNT', label: 'Get Account Info', category: 'account', priority: 2 },
  { name: 'TWILIO_GET_BALANCE', label: 'Get Balance', category: 'account', priority: 2 },
];

const USEFUL_ACTIONS: TwilioAction[] = [
  {
    name: 'TWILIO_UPDATE_CALL',
    label: 'Update Call',
    category: 'voice',
    priority: 3,
    writeOperation: true,
  },
  { name: 'TWILIO_GET_RECORDING', label: 'Get Recording', category: 'voice', priority: 3 },
  {
    name: 'TWILIO_CREATE_QUEUE',
    label: 'Create Queue',
    category: 'voice',
    priority: 3,
    writeOperation: true,
  },
  { name: 'TWILIO_GET_USAGE', label: 'Get Usage Records', category: 'account', priority: 3 },
  {
    name: 'TWILIO_SEARCH_AVAILABLE_NUMBERS',
    label: 'Search Available Numbers',
    category: 'phone_numbers',
    priority: 3,
  },
];

const ADVANCED_ACTIONS: TwilioAction[] = [
  {
    name: 'TWILIO_BUY_PHONE_NUMBER',
    label: 'Buy Phone Number',
    category: 'phone_numbers',
    priority: 4,
    writeOperation: true,
  },
  {
    name: 'TWILIO_RELEASE_PHONE_NUMBER',
    label: 'Release Phone Number',
    category: 'phone_numbers',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'TWILIO_DELETE_RECORDING',
    label: 'Delete Recording',
    category: 'voice',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'TWILIO_CREATE_SUBACCOUNT',
    label: 'Create Subaccount',
    category: 'account',
    priority: 4,
    writeOperation: true,
  },
];

export const ALL_TWILIO_ACTIONS: TwilioAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

export function getTwilioFeaturedActionNames(): string[] {
  return ALL_TWILIO_ACTIONS.map((a) => a.name);
}
export function getTwilioActionsByPriority(maxPriority: number = 3): TwilioAction[] {
  return ALL_TWILIO_ACTIONS.filter((a) => a.priority <= maxPriority);
}
export function getTwilioActionNamesByPriority(maxPriority: number = 3): string[] {
  return getTwilioActionsByPriority(maxPriority).map((a) => a.name);
}
export function getTwilioActionsByCategory(category: TwilioActionCategory): TwilioAction[] {
  return ALL_TWILIO_ACTIONS.filter((a) => a.category === category);
}
export function getTwilioActionPriority(toolName: string): number {
  const n = toolName.replace(/^composio_/, '');
  return ALL_TWILIO_ACTIONS.find((a) => a.name === n)?.priority ?? 99;
}
export function isKnownTwilioAction(toolName: string): boolean {
  return ALL_TWILIO_ACTIONS.some((a) => a.name === toolName.replace(/^composio_/, ''));
}
export function isDestructiveTwilioAction(toolName: string): boolean {
  return (
    ALL_TWILIO_ACTIONS.find((a) => a.name === toolName.replace(/^composio_/, ''))?.destructive ===
    true
  );
}
export function sortByTwilioPriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort(
    (a, b) => getTwilioActionPriority(a.name) - getTwilioActionPriority(b.name)
  );
}

export function getTwilioActionStats() {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_TWILIO_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_TWILIO_ACTIONS.length, byPriority, byCategory };
}

export function getTwilioSystemPrompt(): string {
  return `
## Twilio Integration (Full Capabilities)

You have **full Twilio access** through the user's connected account. Use the \`composio_TWILIO_*\` tools.

### SMS & MMS
- Send text messages and multimedia messages
- List and retrieve message history
- Track message delivery status

### Voice Calls
- Make outbound calls with TwiML
- List call history and details
- Manage recordings and queues

### Phone Numbers
- List owned phone numbers
- Search and purchase available numbers
- Release numbers no longer needed

### Account
- Check balance and usage records
- Manage subaccounts

### Safety Rules
1. **ALWAYS confirm before sending SMS/MMS** - show recipient and message content
2. **Confirm before making calls** - show the destination number
3. **NEVER buy or release phone numbers without explicit confirmation**
4. **Show costs when relevant** - SMS, calls, and numbers have associated charges
5. **Handle phone numbers in E.164 format** (+1XXXXXXXXXX)
`;
}

export function getTwilioCapabilitySummary(): string {
  const stats = getTwilioActionStats();
  return `Twilio (${stats.total} actions: sms, voice, phone numbers, account)`;
}

export function logTwilioToolkitStats(): void {
  const stats = getTwilioActionStats();
  log.info('Twilio Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
