/**
 * COMPOSIO DOCUSIGN TOOLKIT
 * =========================
 *
 * Comprehensive DocuSign integration via Composio's tools.
 *
 * Categories:
 * - Envelopes (create, send, get, list, void)
 * - Documents (add, get, list)
 * - Recipients (add, get, list, update)
 * - Templates (list, get, create from)
 * - Signing (get URL, status)
 * - Account (get info)
 */

import { logger } from '@/lib/logger';

const log = logger('DocuSignToolkit');

export type DocuSignActionCategory =
  | 'envelopes'
  | 'documents'
  | 'recipients'
  | 'templates'
  | 'signing'
  | 'account';

export interface DocuSignAction {
  name: string;
  label: string;
  category: DocuSignActionCategory;
  priority: number;
  destructive?: boolean;
  writeOperation?: boolean;
}

const ESSENTIAL_ACTIONS: DocuSignAction[] = [
  {
    name: 'DOCUSIGN_CREATE_ENVELOPE',
    label: 'Create Envelope',
    category: 'envelopes',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'DOCUSIGN_SEND_ENVELOPE',
    label: 'Send Envelope',
    category: 'envelopes',
    priority: 1,
    writeOperation: true,
  },
  { name: 'DOCUSIGN_GET_ENVELOPE', label: 'Get Envelope', category: 'envelopes', priority: 1 },
  { name: 'DOCUSIGN_LIST_ENVELOPES', label: 'List Envelopes', category: 'envelopes', priority: 1 },
  {
    name: 'DOCUSIGN_GET_ENVELOPE_STATUS',
    label: 'Get Envelope Status',
    category: 'signing',
    priority: 1,
  },
  { name: 'DOCUSIGN_LIST_TEMPLATES', label: 'List Templates', category: 'templates', priority: 1 },
];

const IMPORTANT_ACTIONS: DocuSignAction[] = [
  {
    name: 'DOCUSIGN_ADD_DOCUMENT',
    label: 'Add Document',
    category: 'documents',
    priority: 2,
    writeOperation: true,
  },
  { name: 'DOCUSIGN_GET_DOCUMENT', label: 'Get Document', category: 'documents', priority: 2 },
  { name: 'DOCUSIGN_LIST_DOCUMENTS', label: 'List Documents', category: 'documents', priority: 2 },
  {
    name: 'DOCUSIGN_ADD_RECIPIENT',
    label: 'Add Recipient',
    category: 'recipients',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'DOCUSIGN_LIST_RECIPIENTS',
    label: 'List Recipients',
    category: 'recipients',
    priority: 2,
  },
  { name: 'DOCUSIGN_GET_TEMPLATE', label: 'Get Template', category: 'templates', priority: 2 },
  {
    name: 'DOCUSIGN_CREATE_FROM_TEMPLATE',
    label: 'Create from Template',
    category: 'templates',
    priority: 2,
    writeOperation: true,
  },
];

const USEFUL_ACTIONS: DocuSignAction[] = [
  { name: 'DOCUSIGN_GET_SIGNING_URL', label: 'Get Signing URL', category: 'signing', priority: 3 },
  {
    name: 'DOCUSIGN_UPDATE_RECIPIENT',
    label: 'Update Recipient',
    category: 'recipients',
    priority: 3,
    writeOperation: true,
  },
  { name: 'DOCUSIGN_GET_RECIPIENT', label: 'Get Recipient', category: 'recipients', priority: 3 },
  {
    name: 'DOCUSIGN_RESEND_ENVELOPE',
    label: 'Resend Envelope',
    category: 'envelopes',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'DOCUSIGN_DOWNLOAD_DOCUMENT',
    label: 'Download Document',
    category: 'documents',
    priority: 3,
  },
  {
    name: 'DOCUSIGN_GET_ACCOUNT_INFO',
    label: 'Get Account Info',
    category: 'account',
    priority: 3,
  },
];

const ADVANCED_ACTIONS: DocuSignAction[] = [
  {
    name: 'DOCUSIGN_VOID_ENVELOPE',
    label: 'Void Envelope',
    category: 'envelopes',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'DOCUSIGN_DELETE_RECIPIENT',
    label: 'Delete Recipient',
    category: 'recipients',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'DOCUSIGN_CORRECT_ENVELOPE',
    label: 'Correct Envelope',
    category: 'envelopes',
    priority: 4,
    writeOperation: true,
  },
  {
    name: 'DOCUSIGN_GET_AUDIT_EVENTS',
    label: 'Get Audit Events',
    category: 'envelopes',
    priority: 4,
  },
  {
    name: 'DOCUSIGN_LIST_CUSTOM_FIELDS',
    label: 'List Custom Fields',
    category: 'envelopes',
    priority: 4,
  },
];

export const ALL_DOCUSIGN_ACTIONS: DocuSignAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

export function getDocuSignFeaturedActionNames(): string[] {
  return ALL_DOCUSIGN_ACTIONS.map((a) => a.name);
}
export function getDocuSignActionsByPriority(maxPriority: number = 3): DocuSignAction[] {
  return ALL_DOCUSIGN_ACTIONS.filter((a) => a.priority <= maxPriority);
}
export function getDocuSignActionNamesByPriority(maxPriority: number = 3): string[] {
  return getDocuSignActionsByPriority(maxPriority).map((a) => a.name);
}
export function getDocuSignActionsByCategory(category: DocuSignActionCategory): DocuSignAction[] {
  return ALL_DOCUSIGN_ACTIONS.filter((a) => a.category === category);
}
export function getDocuSignActionPriority(toolName: string): number {
  const n = toolName.replace(/^composio_/, '');
  return ALL_DOCUSIGN_ACTIONS.find((a) => a.name === n)?.priority ?? 99;
}
export function isKnownDocuSignAction(toolName: string): boolean {
  return ALL_DOCUSIGN_ACTIONS.some((a) => a.name === toolName.replace(/^composio_/, ''));
}
export function isDestructiveDocuSignAction(toolName: string): boolean {
  return (
    ALL_DOCUSIGN_ACTIONS.find((a) => a.name === toolName.replace(/^composio_/, ''))?.destructive ===
    true
  );
}
export function sortByDocuSignPriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort(
    (a, b) => getDocuSignActionPriority(a.name) - getDocuSignActionPriority(b.name)
  );
}

export function getDocuSignActionStats() {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_DOCUSIGN_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_DOCUSIGN_ACTIONS.length, byPriority, byCategory };
}

export function getDocuSignSystemPrompt(): string {
  return `
## DocuSign Integration (Full Capabilities)

You have **full DocuSign access** through the user's connected account. Use the \`composio_DOCUSIGN_*\` tools.

### Envelopes (Documents for Signing)
- Create envelopes with documents and recipients
- Send envelopes for signature
- Get envelope details and status tracking
- List all envelopes with filters (status, date range)
- Resend envelopes and correct errors
- Void envelopes that should no longer be signed

### Documents
- Add documents to envelopes
- Get and download signed documents
- List all documents in an envelope

### Recipients & Signing
- Add signers, CC recipients, and other recipient types
- Get signing URLs for embedded signing
- Track who has signed and who hasn't
- Update or remove recipients

### Templates
- List available envelope templates
- Get template details and fields
- Create envelopes from templates for quick sending

### Safety Rules
1. **ALWAYS confirm before sending for signature** - show all recipients, documents, and subject
2. **Confirm before voiding envelopes** - voiding is permanent and notifies all parties
3. **Verify recipient email addresses** - signing requests go to these addresses
4. **For template usage**, show which template and confirm variable values
5. **Handle documents with care** - they may contain sensitive legal content
`;
}

export function getDocuSignCapabilitySummary(): string {
  const stats = getDocuSignActionStats();
  return `DocuSign (${stats.total} actions: envelopes, documents, recipients, templates, signing)`;
}

export function logDocuSignToolkitStats(): void {
  const stats = getDocuSignActionStats();
  log.info('DocuSign Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
