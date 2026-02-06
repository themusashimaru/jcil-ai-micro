/**
 * COMPOSIO TOOLKITS CONFIGURATION
 * ================================
 *
 * Available toolkits that users can connect.
 * These map to Composio's 500+ app integrations.
 */

import type { ToolkitConfig } from './types';

// ============================================================================
// POPULAR TOOLKITS (shown prominently in UI)
// ============================================================================

export const POPULAR_TOOLKITS: ToolkitConfig[] = [
  // Communication
  {
    id: 'GMAIL',
    displayName: 'Gmail',
    description: 'Send emails, read inbox, manage labels',
    icon: '📧',
    category: 'communication',
    authType: 'oauth2',
    scopes: ['gmail.send', 'gmail.readonly', 'gmail.labels'],
    popular: true,
  },
  {
    id: 'SLACK',
    displayName: 'Slack',
    description: 'Send messages, manage channels, post updates',
    icon: '💬',
    category: 'communication',
    authType: 'oauth2',
    scopes: ['chat:write', 'channels:read', 'users:read'],
    popular: true,
  },
  {
    id: 'DISCORD',
    displayName: 'Discord',
    description: 'Send messages, manage servers',
    icon: '🎮',
    category: 'communication',
    authType: 'oauth2',
    popular: true,
  },

  // Productivity
  {
    id: 'NOTION',
    displayName: 'Notion',
    description: 'Create pages, manage databases, search workspace',
    icon: '📝',
    category: 'productivity',
    authType: 'oauth2',
    popular: true,
  },
  {
    id: 'GOOGLE_CALENDAR',
    displayName: 'Google Calendar',
    description: 'Create events, check availability, manage schedules',
    icon: '📅',
    category: 'calendar',
    authType: 'oauth2',
    scopes: ['calendar.events', 'calendar.readonly'],
    popular: true,
  },
  {
    id: 'GOOGLE_DRIVE',
    displayName: 'Google Drive',
    description: 'Upload files, create documents, manage folders',
    icon: '📁',
    category: 'storage',
    authType: 'oauth2',
    popular: true,
  },
  {
    id: 'GOOGLE_SHEETS',
    displayName: 'Google Sheets',
    description: 'Read/write spreadsheets, analyze data',
    icon: '📊',
    category: 'productivity',
    authType: 'oauth2',
    popular: true,
  },

  // Social
  {
    id: 'TWITTER',
    displayName: 'Twitter / X',
    description: 'Post tweets, read timeline, manage followers',
    icon: '🐦',
    category: 'social',
    authType: 'oauth2',
    scopes: ['tweet.read', 'tweet.write', 'users.read'],
    popular: true,
  },
  {
    id: 'LINKEDIN',
    displayName: 'LinkedIn',
    description: 'Post updates, manage profile, share content',
    icon: '💼',
    category: 'social',
    authType: 'oauth2',
    popular: true,
  },
  {
    id: 'INSTAGRAM',
    displayName: 'Instagram',
    description: 'Post content, manage media, view insights',
    icon: '📸',
    category: 'social',
    authType: 'oauth2',
    popular: true,
  },
  {
    id: 'FACEBOOK',
    displayName: 'Facebook',
    description: 'Post to pages, manage content, view insights',
    icon: '👤',
    category: 'social',
    authType: 'oauth2',
    popular: true,
  },

  // Development
  {
    id: 'GITHUB',
    displayName: 'GitHub',
    description: 'Manage repos, create issues, PRs',
    icon: '🐙',
    category: 'development',
    authType: 'oauth2',
    scopes: ['repo', 'user:email'],
    popular: true,
  },
  {
    id: 'LINEAR',
    displayName: 'Linear',
    description: 'Create issues, manage projects, track progress',
    icon: '📋',
    category: 'development',
    authType: 'oauth2',
    popular: true,
  },
];

// ============================================================================
// ALL AVAILABLE TOOLKITS (organized by category)
// ============================================================================

export const ALL_TOOLKITS: ToolkitConfig[] = [
  ...POPULAR_TOOLKITS,

  // Additional Communication
  {
    id: 'OUTLOOK',
    displayName: 'Outlook',
    description: 'Microsoft email and calendar',
    icon: '📬',
    category: 'communication',
    authType: 'oauth2',
  },
  {
    id: 'MICROSOFT_TEAMS',
    displayName: 'Microsoft Teams',
    description: 'Team chat and collaboration',
    icon: '👥',
    category: 'communication',
    authType: 'oauth2',
  },
  {
    id: 'WHATSAPP',
    displayName: 'WhatsApp Business',
    description: 'Send messages via WhatsApp Business API',
    icon: '📱',
    category: 'communication',
    authType: 'api_key',
  },
  {
    id: 'ZOOM',
    displayName: 'Zoom',
    description: 'Schedule meetings, manage recordings',
    icon: '📹',
    category: 'communication',
    authType: 'oauth2',
  },

  // Additional Productivity
  {
    id: 'AIRTABLE',
    displayName: 'Airtable',
    description: 'Database and spreadsheet hybrid',
    icon: '🗃️',
    category: 'productivity',
    authType: 'oauth2',
  },
  {
    id: 'ASANA',
    displayName: 'Asana',
    description: 'Project and task management',
    icon: '✅',
    category: 'productivity',
    authType: 'oauth2',
  },
  {
    id: 'TRELLO',
    displayName: 'Trello',
    description: 'Kanban boards and task cards',
    icon: '📌',
    category: 'productivity',
    authType: 'oauth2',
  },
  {
    id: 'CLICKUP',
    displayName: 'ClickUp',
    description: 'All-in-one productivity platform',
    icon: '🚀',
    category: 'productivity',
    authType: 'oauth2',
  },
  {
    id: 'MONDAY',
    displayName: 'Monday.com',
    description: 'Work management platform',
    icon: '📆',
    category: 'productivity',
    authType: 'oauth2',
  },
  {
    id: 'TODOIST',
    displayName: 'Todoist',
    description: 'Personal task management',
    icon: '☑️',
    category: 'productivity',
    authType: 'oauth2',
  },

  // CRM
  {
    id: 'HUBSPOT',
    displayName: 'HubSpot',
    description: 'CRM, marketing, sales automation',
    icon: '🧡',
    category: 'crm',
    authType: 'oauth2',
  },
  {
    id: 'SALESFORCE',
    displayName: 'Salesforce',
    description: 'Enterprise CRM platform',
    icon: '☁️',
    category: 'crm',
    authType: 'oauth2',
  },
  {
    id: 'PIPEDRIVE',
    displayName: 'Pipedrive',
    description: 'Sales CRM and pipeline management',
    icon: '🔄',
    category: 'crm',
    authType: 'oauth2',
  },

  // Finance
  {
    id: 'STRIPE',
    displayName: 'Stripe',
    description: 'Payment processing and invoices',
    icon: '💳',
    category: 'finance',
    authType: 'api_key',
  },
  {
    id: 'QUICKBOOKS',
    displayName: 'QuickBooks',
    description: 'Accounting and invoicing',
    icon: '📒',
    category: 'finance',
    authType: 'oauth2',
  },

  // Storage
  {
    id: 'DROPBOX',
    displayName: 'Dropbox',
    description: 'Cloud file storage',
    icon: '📦',
    category: 'storage',
    authType: 'oauth2',
  },
  {
    id: 'BOX',
    displayName: 'Box',
    description: 'Enterprise cloud storage',
    icon: '🗄️',
    category: 'storage',
    authType: 'oauth2',
  },

  // Development
  {
    id: 'JIRA',
    displayName: 'Jira',
    description: 'Issue tracking and project management',
    icon: '🎫',
    category: 'development',
    authType: 'oauth2',
  },
  {
    id: 'GITLAB',
    displayName: 'GitLab',
    description: 'Git repository and CI/CD',
    icon: '🦊',
    category: 'development',
    authType: 'oauth2',
  },
  {
    id: 'SENTRY',
    displayName: 'Sentry',
    description: 'Error tracking and monitoring',
    icon: '🐛',
    category: 'development',
    authType: 'api_key',
  },

  // Music & Entertainment (replacing your custom connectors)
  {
    id: 'SPOTIFY',
    displayName: 'Spotify',
    description: 'Control music, create playlists, get recommendations',
    icon: '🎵',
    category: 'communication', // Using communication for entertainment
    authType: 'oauth2',
    scopes: [
      'user-read-private',
      'user-read-email',
      'playlist-read-private',
      'playlist-modify-public',
      'playlist-modify-private',
      'user-read-playback-state',
      'user-modify-playback-state',
    ],
  },

  // Calendar
  {
    id: 'CALENDLY',
    displayName: 'Calendly',
    description: 'Scheduling and appointment booking',
    icon: '🗓️',
    category: 'calendar',
    authType: 'oauth2',
  },
];

// ============================================================================
// TOOLKIT HELPERS
// ============================================================================

export function getToolkitById(id: string): ToolkitConfig | undefined {
  return ALL_TOOLKITS.find((t) => t.id === id);
}

export function getToolkitsByCategory(category: ToolkitConfig['category']): ToolkitConfig[] {
  return ALL_TOOLKITS.filter((t) => t.category === category);
}

export function getPopularToolkits(): ToolkitConfig[] {
  return ALL_TOOLKITS.filter((t) => t.popular);
}

// Toolkits grouped by category for UI
export const TOOLKITS_BY_CATEGORY = {
  communication: getToolkitsByCategory('communication'),
  productivity: getToolkitsByCategory('productivity'),
  social: getToolkitsByCategory('social'),
  development: getToolkitsByCategory('development'),
  crm: getToolkitsByCategory('crm'),
  finance: getToolkitsByCategory('finance'),
  calendar: getToolkitsByCategory('calendar'),
  storage: getToolkitsByCategory('storage'),
};
