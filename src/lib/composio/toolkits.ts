/**
 * COMPOSIO TOOLKITS CONFIGURATION
 * ================================
 *
 * Approved app integrations available through Composio.
 * Limited to 37 approved integrations organized by category.
 */

import type { ToolkitConfig, ToolkitCategory } from './types';

// ============================================================================
// POPULAR TOOLKITS (shown prominently in UI)
// ============================================================================

export const POPULAR_TOOLKITS: ToolkitConfig[] = [
  // Communication - Essential
  {
    id: 'GMAIL',
    displayName: 'Gmail',
    description: 'Send emails, manage inbox, search messages',
    icon: '📧',
    category: 'communication',
    authType: 'oauth2',
    popular: true,
  },
  {
    id: 'SLACK',
    displayName: 'Slack',
    description: 'Send messages, manage channels, automate workflows',
    icon: '💬',
    category: 'communication',
    authType: 'oauth2',
    popular: true,
  },
  {
    id: 'DISCORD',
    displayName: 'Discord',
    description: 'Manage servers, send messages, moderate communities',
    icon: '🎮',
    category: 'communication',
    authType: 'oauth2',
    popular: true,
  },
  {
    id: 'MICROSOFT_TEAMS',
    displayName: 'Microsoft Teams',
    description: 'Chat, meet, collaborate with your team',
    icon: '👥',
    category: 'communication',
    authType: 'oauth2',
    popular: true,
  },

  // Productivity - Must Have
  {
    id: 'GOOGLE_DOCS',
    displayName: 'Google Docs',
    description: 'Create and edit documents collaboratively',
    icon: '📄',
    category: 'productivity',
    authType: 'oauth2',
    popular: true,
  },
  {
    id: 'GOOGLE_SHEETS',
    displayName: 'Google Sheets',
    description: 'Create spreadsheets, analyze data, automate reports',
    icon: '📊',
    category: 'productivity',
    authType: 'oauth2',
    popular: true,
  },
  {
    id: 'AIRTABLE',
    displayName: 'Airtable',
    description: 'Build databases, track projects, organize anything',
    icon: '📋',
    category: 'productivity',
    authType: 'oauth2',
    popular: true,
  },

  // Social Media - High Demand
  {
    id: 'TWITTER',
    displayName: 'Twitter/X',
    description: 'Post tweets, manage timeline, engage followers',
    icon: '🐦',
    category: 'social',
    authType: 'oauth2',
    popular: true,
  },
  {
    id: 'LINKEDIN',
    displayName: 'LinkedIn',
    description: 'Post updates, manage connections, recruit talent',
    icon: '💼',
    category: 'social',
    authType: 'oauth2',
    popular: true,
  },
  {
    id: 'INSTAGRAM',
    displayName: 'Instagram',
    description: 'Post content, manage stories, engage audience',
    icon: '📸',
    category: 'social',
    authType: 'oauth2',
    popular: true,
  },
  {
    id: 'YOUTUBE',
    displayName: 'YouTube',
    description: 'Upload videos, manage channel, analyze performance',
    icon: '🎬',
    category: 'social',
    authType: 'oauth2',
    popular: true,
  },

  // Development - Core
  {
    id: 'GITHUB',
    displayName: 'GitHub',
    description: 'Manage repos, create issues, automate workflows',
    icon: '🐙',
    category: 'development',
    authType: 'oauth2',
    popular: true,
  },
  {
    id: 'LINEAR',
    displayName: 'Linear',
    description: 'Modern issue tracking for software teams',
    icon: '⚡',
    category: 'development',
    authType: 'oauth2',
    popular: true,
  },
];

// ============================================================================
// ALL AVAILABLE TOOLKITS (37 approved integrations)
// ============================================================================

export const ALL_TOOLKITS: ToolkitConfig[] = [
  // ==================== COMMUNICATION ====================
  {
    id: 'GMAIL',
    displayName: 'Gmail',
    description: 'Send emails, manage inbox, search messages',
    icon: '📧',
    category: 'communication',
    authType: 'oauth2',
    popular: true,
  },
  {
    id: 'SLACK',
    displayName: 'Slack',
    description: 'Send messages, manage channels, automate workflows',
    icon: '💬',
    category: 'communication',
    authType: 'oauth2',
    popular: true,
  },
  {
    id: 'DISCORD',
    displayName: 'Discord',
    description: 'Manage servers, send messages, moderate communities',
    icon: '🎮',
    category: 'communication',
    authType: 'oauth2',
    popular: true,
  },
  {
    id: 'MICROSOFT_TEAMS',
    displayName: 'Microsoft Teams',
    description: 'Chat, meet, collaborate with your team',
    icon: '👥',
    category: 'communication',
    authType: 'oauth2',
    popular: true,
  },
  {
    id: 'MICROSOFT_OUTLOOK',
    displayName: 'Outlook',
    description: 'Manage emails, calendars, and contacts',
    icon: '📬',
    category: 'communication',
    authType: 'oauth2',
  },

  // ==================== PRODUCTIVITY ====================
  {
    id: 'GOOGLE_DOCS',
    displayName: 'Google Docs',
    description: 'Create and edit documents collaboratively',
    icon: '📄',
    category: 'productivity',
    authType: 'oauth2',
    popular: true,
  },
  {
    id: 'GOOGLE_SHEETS',
    displayName: 'Google Sheets',
    description: 'Create spreadsheets, analyze data, automate reports',
    icon: '📊',
    category: 'productivity',
    authType: 'oauth2',
    popular: true,
  },
  {
    id: 'AIRTABLE',
    displayName: 'Airtable',
    description: 'Build databases, track projects, organize anything',
    icon: '📋',
    category: 'productivity',
    authType: 'oauth2',
    popular: true,
  },
  {
    id: 'GOOGLE_SLIDES',
    displayName: 'Google Slides',
    description: 'Create presentations online',
    icon: '📽️',
    category: 'productivity',
    authType: 'oauth2',
  },
  {
    id: 'GOOGLE_TASKS',
    displayName: 'Google Tasks',
    description: 'Create and manage tasks and to-do lists',
    icon: '✅',
    category: 'productivity',
    authType: 'oauth2',
  },

  // ==================== SOCIAL MEDIA ====================
  {
    id: 'TWITTER',
    displayName: 'Twitter/X',
    description: 'Post tweets, manage timeline, engage followers',
    icon: '🐦',
    category: 'social',
    authType: 'oauth2',
    popular: true,
  },
  {
    id: 'LINKEDIN',
    displayName: 'LinkedIn',
    description: 'Post updates, manage connections, recruit talent',
    icon: '💼',
    category: 'social',
    authType: 'oauth2',
    popular: true,
  },
  {
    id: 'INSTAGRAM',
    displayName: 'Instagram',
    description: 'Post content, manage stories, engage audience',
    icon: '📸',
    category: 'social',
    authType: 'oauth2',
    popular: true,
  },
  {
    id: 'YOUTUBE',
    displayName: 'YouTube',
    description: 'Upload videos, manage channel, analyze performance',
    icon: '🎬',
    category: 'social',
    authType: 'oauth2',
    popular: true,
  },
  {
    id: 'REDDIT',
    displayName: 'Reddit',
    description: 'Post content, engage communities, monitor mentions',
    icon: '🤖',
    category: 'social',
    authType: 'oauth2',
  },

  // ==================== DEVELOPMENT ====================
  {
    id: 'GITHUB',
    displayName: 'GitHub',
    description: 'Manage repos, create issues, automate workflows',
    icon: '🐙',
    category: 'development',
    authType: 'oauth2',
    popular: true,
  },
  {
    id: 'LINEAR',
    displayName: 'Linear',
    description: 'Modern issue tracking for software teams',
    icon: '⚡',
    category: 'development',
    authType: 'oauth2',
    popular: true,
  },
  {
    id: 'SENTRY',
    displayName: 'Sentry',
    description: 'Error tracking and performance monitoring',
    icon: '🐛',
    category: 'development',
    authType: 'api_key',
  },
  {
    id: 'VERCEL',
    displayName: 'Vercel',
    description: 'Deploy and host web applications',
    icon: '▲',
    category: 'development',
    authType: 'oauth2',
  },
  {
    id: 'SUPABASE',
    displayName: 'Supabase',
    description: 'Open source Firebase alternative',
    icon: '⚡',
    category: 'development',
    authType: 'api_key',
  },
  {
    id: 'CLOUDFLARE',
    displayName: 'Cloudflare',
    description: 'Web security, performance, and DNS management',
    icon: '🔶',
    category: 'development',
    authType: 'api_key',
  },

  // ==================== CRM ====================
  {
    id: 'HUBSPOT',
    displayName: 'HubSpot',
    description: 'CRM, marketing, sales, and service software',
    icon: '🧲',
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

  // ==================== FINANCE ====================
  {
    id: 'STRIPE',
    displayName: 'Stripe',
    description: 'Payment processing and billing',
    icon: '💳',
    category: 'finance',
    authType: 'api_key',
  },

  // ==================== CALENDAR ====================
  {
    id: 'GOOGLE_CALENDAR',
    displayName: 'Google Calendar',
    description: 'Schedule events, set reminders, share calendars',
    icon: '📅',
    category: 'calendar',
    authType: 'oauth2',
  },
  {
    id: 'GOOGLE_MEET',
    displayName: 'Google Meet',
    description: 'Video meetings and conferencing',
    icon: '📹',
    category: 'calendar',
    authType: 'oauth2',
  },

  // ==================== STORAGE ====================
  {
    id: 'GOOGLE_DRIVE',
    displayName: 'Google Drive',
    description: 'Cloud storage and file sharing',
    icon: '💾',
    category: 'storage',
    authType: 'oauth2',
  },
  {
    id: 'DROPBOX',
    displayName: 'Dropbox',
    description: 'File hosting and synchronization',
    icon: '📦',
    category: 'storage',
    authType: 'oauth2',
  },
  {
    id: 'GOOGLE_PHOTOS',
    displayName: 'Google Photos',
    description: 'Photo and video storage and sharing',
    icon: '📷',
    category: 'storage',
    authType: 'oauth2',
  },

  // ==================== ANALYTICS ====================
  {
    id: 'GOOGLE_ANALYTICS',
    displayName: 'Google Analytics',
    description: 'Web analytics and insights',
    icon: '📈',
    category: 'analytics',
    authType: 'oauth2',
  },
  {
    id: 'GOOGLE_SEARCH_CONSOLE',
    displayName: 'Google Search Console',
    description: 'Monitor and optimize search performance',
    icon: '🔍',
    category: 'analytics',
    authType: 'oauth2',
  },

  // ==================== MARKETING ====================
  {
    id: 'GOOGLE_ADS',
    displayName: 'Google Ads',
    description: 'Online advertising platform',
    icon: '📢',
    category: 'marketing',
    authType: 'oauth2',
  },

  // ==================== ECOMMERCE ====================
  {
    id: 'SHOPIFY',
    displayName: 'Shopify',
    description: 'Ecommerce platform for online stores',
    icon: '🛒',
    category: 'ecommerce',
    authType: 'oauth2',
  },

  // ==================== TRAVEL ====================
  {
    id: 'GOOGLE_MAPS',
    displayName: 'Google Maps',
    description: 'Maps, directions, and places',
    icon: '🗺️',
    category: 'travel',
    authType: 'api_key',
  },

  // ==================== AI & TOOLS ====================
  {
    id: 'ELEVENLABS',
    displayName: 'ElevenLabs',
    description: 'AI voice synthesis and text-to-speech',
    icon: '🎙️',
    category: 'media',
    authType: 'api_key',
  },
  {
    id: 'SERPAPI',
    displayName: 'SerpAPI',
    description: 'Search engine results API for web scraping',
    icon: '🔎',
    category: 'analytics',
    authType: 'api_key',
  },
  {
    id: 'PERPLEXITY_AI',
    displayName: 'Perplexity AI',
    description: 'AI-powered search and answer engine',
    icon: '🤖',
    category: 'analytics',
    authType: 'api_key',
  },
];

// ============================================================================
// TOOLKIT HELPERS
// ============================================================================

/**
 * Group toolkits by category for organized display
 */
export const TOOLKITS_BY_CATEGORY: Record<ToolkitCategory, ToolkitConfig[]> = {
  communication: ALL_TOOLKITS.filter((t) => t.category === 'communication'),
  productivity: ALL_TOOLKITS.filter((t) => t.category === 'productivity'),
  social: ALL_TOOLKITS.filter((t) => t.category === 'social'),
  development: ALL_TOOLKITS.filter((t) => t.category === 'development'),
  crm: ALL_TOOLKITS.filter((t) => t.category === 'crm'),
  finance: ALL_TOOLKITS.filter((t) => t.category === 'finance'),
  calendar: ALL_TOOLKITS.filter((t) => t.category === 'calendar'),
  storage: ALL_TOOLKITS.filter((t) => t.category === 'storage'),
  analytics: ALL_TOOLKITS.filter((t) => t.category === 'analytics'),
  marketing: ALL_TOOLKITS.filter((t) => t.category === 'marketing'),
  ecommerce: ALL_TOOLKITS.filter((t) => t.category === 'ecommerce'),
  hr: ALL_TOOLKITS.filter((t) => t.category === 'hr'),
  support: ALL_TOOLKITS.filter((t) => t.category === 'support'),
  automation: ALL_TOOLKITS.filter((t) => t.category === 'automation'),
  media: ALL_TOOLKITS.filter((t) => t.category === 'media'),
  education: ALL_TOOLKITS.filter((t) => t.category === 'education'),
  travel: ALL_TOOLKITS.filter((t) => t.category === 'travel'),
};

/**
 * Get toolkit config by ID
 */
export function getToolkitById(id: string): ToolkitConfig | undefined {
  return ALL_TOOLKITS.find((t) => t.id === id || t.id === id.toUpperCase());
}

/**
 * Get toolkits by category
 */
export function getToolkitsByCategory(category: ToolkitCategory): ToolkitConfig[] {
  return TOOLKITS_BY_CATEGORY[category] || [];
}

/**
 * Get popular toolkits
 */
export function getPopularToolkits(): ToolkitConfig[] {
  return POPULAR_TOOLKITS;
}

/**
 * Search toolkits by name or description
 */
export function searchToolkits(query: string): ToolkitConfig[] {
  const lowerQuery = query.toLowerCase();
  return ALL_TOOLKITS.filter(
    (t) =>
      t.displayName.toLowerCase().includes(lowerQuery) ||
      t.description.toLowerCase().includes(lowerQuery) ||
      t.id.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Get total count of available integrations
 */
export function getTotalIntegrationsCount(): number {
  return ALL_TOOLKITS.length;
}
