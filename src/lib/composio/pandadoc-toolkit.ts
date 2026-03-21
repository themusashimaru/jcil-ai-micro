/**
 * COMPOSIO PANDADOC TOOLKIT
 * =========================
 *
 * Comprehensive PandaDoc integration via Composio's tools.
 * Provides categorized actions, priority-based selection, and
 * context-aware tool loading for both Chat and Code Lab.
 *
 * Categories:
 * - Documents (create, send, list, get status)
 * - Templates (create, list, get template details)
 * - Contacts (create, list, update contacts)
 * - Forms (create, list, get form submissions)
 */

import { logger } from '@/lib/logger';

const log = logger('PandaDocToolkit');

// ============================================================================
// PANDADOC ACTION CATEGORIES
// ============================================================================

export type PandaDocActionCategory = 'documents' | 'templates' | 'contacts' | 'forms';

export interface PandaDocAction {
  name: string; // Composio action name (e.g., PANDADOC_CREATE_DOCUMENT)
  label: string; // Human-readable label
  category: PandaDocActionCategory;
  priority: number; // 1 = highest (always include), 4 = lowest
  destructive?: boolean; // Requires extra confirmation
  writeOperation?: boolean; // Modifies state (vs read-only)
}

// ============================================================================
// PRIORITY 1 - ESSENTIAL (Always loaded when PandaDoc connected)
// ============================================================================

const ESSENTIAL_ACTIONS: PandaDocAction[] = [
  // Documents - Core
  {
    name: 'PANDADOC_CREATE_DOCUMENT',
    label: 'Create Document',
    category: 'documents',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'PANDADOC_SEND_DOCUMENT',
    label: 'Send Document',
    category: 'documents',
    priority: 1,
    writeOperation: true,
  },
  {
    name: 'PANDADOC_LIST_DOCUMENTS',
    label: 'List Documents',
    category: 'documents',
    priority: 1,
  },
  {
    name: 'PANDADOC_GET_DOCUMENT_STATUS',
    label: 'Get Document Status',
    category: 'documents',
    priority: 1,
  },

  // Templates - Core
  {
    name: 'PANDADOC_LIST_TEMPLATES',
    label: 'List Templates',
    category: 'templates',
    priority: 1,
  },
  {
    name: 'PANDADOC_GET_TEMPLATE_DETAILS',
    label: 'Get Template Details',
    category: 'templates',
    priority: 1,
  },
];

// ============================================================================
// PRIORITY 2 - IMPORTANT (Loaded when tool budget allows)
// ============================================================================

const IMPORTANT_ACTIONS: PandaDocAction[] = [
  // Documents - Extended
  {
    name: 'PANDADOC_GET_DOCUMENT_DETAILS',
    label: 'Get Document Details',
    category: 'documents',
    priority: 2,
  },
  {
    name: 'PANDADOC_CREATE_DOCUMENT_FROM_TEMPLATE',
    label: 'Create from Template',
    category: 'documents',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'PANDADOC_DOWNLOAD_DOCUMENT',
    label: 'Download Document',
    category: 'documents',
    priority: 2,
  },

  // Templates - Extended
  {
    name: 'PANDADOC_CREATE_TEMPLATE',
    label: 'Create Template',
    category: 'templates',
    priority: 2,
    writeOperation: true,
  },

  // Contacts - Core
  {
    name: 'PANDADOC_CREATE_CONTACT',
    label: 'Create Contact',
    category: 'contacts',
    priority: 2,
    writeOperation: true,
  },
  {
    name: 'PANDADOC_LIST_CONTACTS',
    label: 'List Contacts',
    category: 'contacts',
    priority: 2,
  },

  // Forms - Core
  {
    name: 'PANDADOC_LIST_FORMS',
    label: 'List Forms',
    category: 'forms',
    priority: 2,
  },
];

// ============================================================================
// PRIORITY 3 - USEFUL (Loaded for power users or specific contexts)
// ============================================================================

const USEFUL_ACTIONS: PandaDocAction[] = [
  // Documents - Extended
  {
    name: 'PANDADOC_UPDATE_DOCUMENT',
    label: 'Update Document',
    category: 'documents',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'PANDADOC_GET_DOCUMENT_FIELDS',
    label: 'Get Document Fields',
    category: 'documents',
    priority: 3,
  },
  {
    name: 'PANDADOC_SHARE_DOCUMENT',
    label: 'Share Document Link',
    category: 'documents',
    priority: 3,
    writeOperation: true,
  },

  // Contacts - Extended
  {
    name: 'PANDADOC_GET_CONTACT',
    label: 'Get Contact Details',
    category: 'contacts',
    priority: 3,
  },
  {
    name: 'PANDADOC_UPDATE_CONTACT',
    label: 'Update Contact',
    category: 'contacts',
    priority: 3,
    writeOperation: true,
  },

  // Forms - Extended
  {
    name: 'PANDADOC_CREATE_FORM',
    label: 'Create Form',
    category: 'forms',
    priority: 3,
    writeOperation: true,
  },
  {
    name: 'PANDADOC_GET_FORM_SUBMISSIONS',
    label: 'Get Form Submissions',
    category: 'forms',
    priority: 3,
  },

  // Templates - Extended
  {
    name: 'PANDADOC_UPDATE_TEMPLATE',
    label: 'Update Template',
    category: 'templates',
    priority: 3,
    writeOperation: true,
  },
];

// ============================================================================
// PRIORITY 4 - ADVANCED (Destructive operations & specialized)
// ============================================================================

const ADVANCED_ACTIONS: PandaDocAction[] = [
  // Documents - Destructive
  {
    name: 'PANDADOC_DELETE_DOCUMENT',
    label: 'Delete Document',
    category: 'documents',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
  {
    name: 'PANDADOC_ARCHIVE_DOCUMENT',
    label: 'Archive Document',
    category: 'documents',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },

  // Templates - Destructive
  {
    name: 'PANDADOC_DELETE_TEMPLATE',
    label: 'Delete Template',
    category: 'templates',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },

  // Contacts - Destructive
  {
    name: 'PANDADOC_DELETE_CONTACT',
    label: 'Delete Contact',
    category: 'contacts',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },

  // Forms - Destructive
  {
    name: 'PANDADOC_DELETE_FORM',
    label: 'Delete Form',
    category: 'forms',
    priority: 4,
    writeOperation: true,
    destructive: true,
  },
];

// ============================================================================
// COMBINED ACTION REGISTRY
// ============================================================================

export const ALL_PANDADOC_ACTIONS: PandaDocAction[] = [
  ...ESSENTIAL_ACTIONS,
  ...IMPORTANT_ACTIONS,
  ...USEFUL_ACTIONS,
  ...ADVANCED_ACTIONS,
];

// ============================================================================
// QUERY HELPERS
// ============================================================================

export function getPandaDocFeaturedActionNames(): string[] {
  return ALL_PANDADOC_ACTIONS.map((a) => a.name);
}

export function getPandaDocActionsByPriority(maxPriority: number = 3): PandaDocAction[] {
  return ALL_PANDADOC_ACTIONS.filter((a) => a.priority <= maxPriority);
}

export function getPandaDocActionNamesByPriority(maxPriority: number = 3): string[] {
  return getPandaDocActionsByPriority(maxPriority).map((a) => a.name);
}

export function getPandaDocActionsByCategory(category: PandaDocActionCategory): PandaDocAction[] {
  return ALL_PANDADOC_ACTIONS.filter((a) => a.category === category);
}

export function getPandaDocActionPriority(toolName: string): number {
  const normalized = toolName.replace(/^composio_/, '');
  const action = ALL_PANDADOC_ACTIONS.find((a) => a.name === normalized);
  return action?.priority ?? 99;
}

export function isKnownPandaDocAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_PANDADOC_ACTIONS.some((a) => a.name === normalized);
}

export function isDestructivePandaDocAction(toolName: string): boolean {
  const normalized = toolName.replace(/^composio_/, '');
  return ALL_PANDADOC_ACTIONS.find((a) => a.name === normalized)?.destructive === true;
}

/**
 * Sort Composio tools by PandaDoc action priority.
 * Known PandaDoc actions sorted by priority (1-4), unknown actions last.
 */
export function sortByPandaDocPriority<T extends { name: string }>(tools: T[]): T[] {
  return [...tools].sort((a, b) => {
    return getPandaDocActionPriority(a.name) - getPandaDocActionPriority(b.name);
  });
}

export function getPandaDocActionStats(): {
  total: number;
  byPriority: Record<number, number>;
  byCategory: Record<string, number>;
} {
  const byPriority: Record<number, number> = {};
  const byCategory: Record<string, number> = {};
  for (const action of ALL_PANDADOC_ACTIONS) {
    byPriority[action.priority] = (byPriority[action.priority] || 0) + 1;
    byCategory[action.category] = (byCategory[action.category] || 0) + 1;
  }
  return { total: ALL_PANDADOC_ACTIONS.length, byPriority, byCategory };
}

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

/**
 * Generate PandaDoc-specific system prompt when user has PandaDoc connected.
 * Tells Claude exactly what it can do via the Composio PandaDoc toolkit.
 */
export function getPandaDocSystemPrompt(): string {
  return `
## PandaDoc Integration (Full Capabilities)

You have **full PandaDoc access** through the user's connected account. Use the \`composio_PANDADOC_*\` tools.

### Documents
- Create new documents from scratch or from templates
- Send documents for signature and review
- List and search documents by status or date
- Get document status (draft, sent, viewed, completed)
- Get document details and field values
- Download completed documents
- Share document links
- Update, archive, or delete documents (with confirmation)

### Templates
- List available document templates
- Get template details and field definitions
- Create new reusable templates
- Update existing templates
- Delete templates (with confirmation)

### Contacts
- Create contact records for recipients
- List and search contacts
- Get contact details
- Update contact information
- Delete contacts (with confirmation)

### Forms
- List available forms
- Create new intake forms
- Get form submission data
- Delete forms (with confirmation)

### Safety Rules
1. **ALWAYS preview before sending** - show document details using the action-preview format:
\`\`\`action-preview
{
  "platform": "PandaDoc",
  "action": "Send Document",
  "documentName": "Document Title",
  "recipients": ["recipient@example.com"],
  "toolName": "composio_PANDADOC_SEND_DOCUMENT",
  "toolParams": { "document_id": "...", "message": "..." }
}
\`\`\`
2. **Confirm recipients before sending** - verify email addresses with the user
3. **Never delete without confirmation** - always show what will be deleted and get explicit approval
4. **For template-based documents**, show all field values before creating
5. **For shared links**, confirm access permissions before generating
6. **Check document status** before attempting operations (e.g., can't send an already-completed doc)
7. **Handle document lifecycle** - draft -> sent -> viewed -> completed
`;
}

/**
 * Get concise summary for limited-space contexts
 */
export function getPandaDocCapabilitySummary(): string {
  const stats = getPandaDocActionStats();
  return `PandaDoc (${stats.total} actions: documents, templates, contacts, forms)`;
}

export function logPandaDocToolkitStats(): void {
  const stats = getPandaDocActionStats();
  log.info('PandaDoc Toolkit loaded', {
    totalActions: stats.total,
    essential: stats.byPriority[1] || 0,
    important: stats.byPriority[2] || 0,
    useful: stats.byPriority[3] || 0,
    advanced: stats.byPriority[4] || 0,
    categories: stats.byCategory,
  });
}
