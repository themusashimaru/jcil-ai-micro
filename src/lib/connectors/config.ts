/**
 * CONNECTORS CONFIGURATION
 * Defines all available external service integrations
 */

export interface ConnectorField {
  key: string;
  label: string;
  placeholder: string;
  type?: 'text' | 'password';
  helpText?: string;
}

export interface ConnectorConfig {
  id: string;
  name: string;
  description: string;
  category: 'code' | 'ecommerce' | 'docs' | 'project' | 'analytics' | 'ai' | 'communication' | 'website';
  icon: string; // We'll use simple text icons or could be URLs
  color: string; // Brand color for UI
  tokenLabel: string; // e.g., "Personal Access Token" or "API Key"
  tokenHelpUrl: string; // Link to docs on how to get the token
  placeholder: string; // Placeholder text for input
  capabilities: string[]; // What the AI can do with this connector
  comingSoon?: boolean; // If true, show as "Coming Soon"
  fields?: ConnectorField[]; // For connectors that need multiple inputs (e.g., Supabase)
  fieldSeparator?: string; // How to join multiple fields when storing (default: '|')
}

export const CONNECTORS: ConnectorConfig[] = [
  // CODE & DEV
  {
    id: 'github',
    name: 'GitHub',
    description: 'Read, write, and manage code repositories',
    category: 'code',
    icon: '🐙',
    color: '#24292e',
    tokenLabel: 'Personal Access Token',
    tokenHelpUrl: 'https://github.com/settings/tokens',
    placeholder: 'ghp_xxxxxxxxxxxxxxxxxxxx',
    capabilities: [
      'Read repository files',
      'Create and edit files',
      'Create commits and branches',
      'Open pull requests',
      'Manage issues',
    ],
  },
  {
    id: 'gitlab',
    name: 'GitLab',
    description: 'Manage GitLab repositories and CI/CD',
    category: 'code',
    icon: '🦊',
    color: '#fc6d26',
    tokenLabel: 'Personal Access Token',
    tokenHelpUrl: 'https://gitlab.com/-/profile/personal_access_tokens',
    placeholder: 'glpat-xxxxxxxxxxxxxxxxxxxx',
    capabilities: [
      'Read repository files',
      'Create and edit files',
      'Manage merge requests',
      'View pipelines',
    ],
    comingSoon: true,
  },
  {
    id: 'vercel',
    name: 'Vercel',
    description: 'Manage deployments and projects',
    category: 'code',
    icon: '▲',
    color: '#000000',
    tokenLabel: 'API Token',
    tokenHelpUrl: 'https://vercel.com/account/tokens',
    placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxx',
    capabilities: [
      'List projects',
      'View deployments',
      'Check deployment status',
      'View environment variables',
      'Trigger redeployments',
    ],
  },
  {
    id: 'supabase',
    name: 'Supabase',
    description: 'Manage database and authentication',
    category: 'code',
    icon: '⚡',
    color: '#3ecf8e',
    tokenLabel: 'Project Credentials',
    tokenHelpUrl: 'https://supabase.com/dashboard/project/_/settings/api',
    placeholder: '', // Not used when fields is defined
    capabilities: [
      'List and query database tables',
      'Insert, update, delete records',
      'View table schemas',
      'List authenticated users',
      'Run custom queries',
    ],
    fields: [
      {
        key: 'url',
        label: 'Project URL',
        placeholder: 'https://abcd1234.supabase.co',
        type: 'text',
        helpText: 'Find this in Settings → API → Project URL',
      },
      {
        key: 'key',
        label: 'Service Role Key',
        placeholder: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        type: 'password',
        helpText: 'Find this in Settings → API → service_role (secret)',
      },
    ],
    fieldSeparator: '|',
  },

  // E-COMMERCE
  {
    id: 'shopify',
    name: 'Shopify',
    description: 'Manage your Shopify store',
    category: 'ecommerce',
    icon: '🛒',
    color: '#96bf48',
    tokenLabel: 'Admin API Access Token',
    tokenHelpUrl: 'https://admin.shopify.com/store/YOUR_STORE/settings/apps/development',
    placeholder: 'shpat_xxxxxxxxxxxxxxxxxxxxxxxx',
    capabilities: [
      'View and edit products',
      'Manage inventory',
      'View orders',
      'Update prices',
    ],
    comingSoon: true,
  },
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'View payments and manage subscriptions',
    category: 'ecommerce',
    icon: '💳',
    color: '#635bff',
    tokenLabel: 'Secret Key',
    tokenHelpUrl: 'https://dashboard.stripe.com/apikeys',
    placeholder: 'sk_xxxx_xxxxxxxxxxxxxxxxxxxxxxxx',
    capabilities: [
      'View transactions',
      'Manage subscriptions',
      'View customer data',
    ],
    comingSoon: true,
  },

  // DOCS & DATA
  {
    id: 'notion',
    name: 'Notion',
    description: 'Read and edit Notion pages and databases',
    category: 'docs',
    icon: '📝',
    color: '#000000',
    tokenLabel: 'Integration Token',
    tokenHelpUrl: 'https://www.notion.so/my-integrations',
    placeholder: 'secret_xxxxxxxxxxxxxxxxxxxxxxxx',
    capabilities: [
      'Read pages and databases',
      'Create and edit pages',
      'Search content',
      'Query databases',
    ],
    comingSoon: true,
  },
  {
    id: 'airtable',
    name: 'Airtable',
    description: 'Query and update Airtable bases',
    category: 'docs',
    icon: '📊',
    color: '#18bfff',
    tokenLabel: 'Personal Access Token',
    tokenHelpUrl: 'https://airtable.com/create/tokens',
    placeholder: 'patxxxxxxxxxxxxxxxx',
    capabilities: [
      'Query tables',
      'Create records',
      'Update records',
      'Delete records',
    ],
    comingSoon: true,
  },

  // PROJECT MANAGEMENT
  {
    id: 'linear',
    name: 'Linear',
    description: 'Manage issues and projects',
    category: 'project',
    icon: '📐',
    color: '#5e6ad2',
    tokenLabel: 'API Key',
    tokenHelpUrl: 'https://linear.app/settings/api',
    placeholder: 'lin_api_xxxxxxxxxxxxxxxxxxxxxxxx',
    capabilities: [
      'Create issues',
      'Update issue status',
      'View projects',
      'Assign team members',
    ],
    comingSoon: true,
  },
  {
    id: 'jira',
    name: 'Jira',
    description: 'Manage Jira issues and boards',
    category: 'project',
    icon: '🎯',
    color: '#0052cc',
    tokenLabel: 'API Token',
    tokenHelpUrl: 'https://id.atlassian.com/manage-profile/security/api-tokens',
    placeholder: 'ATATT3xFfGF0...',
    capabilities: [
      'Create issues',
      'Update tickets',
      'View sprints',
      'Search issues',
    ],
    comingSoon: true,
  },
  {
    id: 'asana',
    name: 'Asana',
    description: 'Manage tasks and projects',
    category: 'project',
    icon: '✅',
    color: '#f06a6a',
    tokenLabel: 'Personal Access Token',
    tokenHelpUrl: 'https://app.asana.com/0/developer-console',
    placeholder: '1/1234567890:abcdefghijklmnop',
    capabilities: [
      'Create tasks',
      'Update task status',
      'View projects',
      'Assign tasks',
    ],
    comingSoon: true,
  },
  {
    id: 'trello',
    name: 'Trello',
    description: 'Manage Trello boards and cards',
    category: 'project',
    icon: '📋',
    color: '#0079bf',
    tokenLabel: 'API Key + Token',
    tokenHelpUrl: 'https://trello.com/power-ups/admin',
    placeholder: 'key:token format',
    capabilities: [
      'Create cards',
      'Move cards between lists',
      'Add comments',
      'Manage boards',
    ],
    comingSoon: true,
  },
  {
    id: 'clickup',
    name: 'ClickUp',
    description: 'Manage ClickUp tasks and spaces',
    category: 'project',
    icon: '🎨',
    color: '#7b68ee',
    tokenLabel: 'API Token',
    tokenHelpUrl: 'https://app.clickup.com/settings/apps',
    placeholder: 'pk_xxxxxxxxxxxxxxxx',
    capabilities: [
      'Create tasks',
      'Update status',
      'View spaces',
      'Manage lists',
    ],
    comingSoon: true,
  },
  {
    id: 'monday',
    name: 'Monday.com',
    description: 'Manage Monday boards and items',
    category: 'project',
    icon: '📅',
    color: '#ff3d57',
    tokenLabel: 'API Token',
    tokenHelpUrl: 'https://monday.com/developers/apps',
    placeholder: 'eyJhbGciOiJIUzI1NiJ9...',
    capabilities: [
      'Create items',
      'Update columns',
      'View boards',
      'Manage groups',
    ],
    comingSoon: true,
  },

  // ANALYTICS
  {
    id: 'mixpanel',
    name: 'Mixpanel',
    description: 'Query analytics data',
    category: 'analytics',
    icon: '📈',
    color: '#7856ff',
    tokenLabel: 'Service Account Secret',
    tokenHelpUrl: 'https://mixpanel.com/settings/project#serviceaccounts',
    placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxx',
    capabilities: [
      'Query events',
      'View funnels',
      'Analyze user behavior',
    ],
    comingSoon: true,
  },
  {
    id: 'amplitude',
    name: 'Amplitude',
    description: 'Query product analytics',
    category: 'analytics',
    icon: '📊',
    color: '#1e61e4',
    tokenLabel: 'API Key + Secret',
    tokenHelpUrl: 'https://analytics.amplitude.com/settings/profile',
    placeholder: 'api_key:secret_key',
    capabilities: [
      'Query events',
      'View charts',
      'Analyze cohorts',
    ],
    comingSoon: true,
  },

  // AI & VOICE
  {
    id: 'elevenlabs',
    name: 'ElevenLabs',
    description: 'Generate speech and clone voices',
    category: 'ai',
    icon: '🎙️',
    color: '#000000',
    tokenLabel: 'API Key',
    tokenHelpUrl: 'https://elevenlabs.io/settings/api-keys',
    placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    capabilities: [
      'Text-to-speech',
      'Voice cloning',
      'Audio generation',
    ],
    comingSoon: true,
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'Use your own OpenAI API key',
    category: 'ai',
    icon: '🤖',
    color: '#10a37f',
    tokenLabel: 'API Key',
    tokenHelpUrl: 'https://platform.openai.com/api-keys',
    placeholder: 'sk-xxxxxxxxxxxxxxxxxxxxxxxx',
    capabilities: [
      'Use GPT models',
      'Generate images with DALL-E',
      'Embeddings',
    ],
    comingSoon: true,
  },

  // COMMUNICATION
  {
    id: 'twilio',
    name: 'Twilio',
    description: 'Send SMS messages',
    category: 'communication',
    icon: '📱',
    color: '#f22f46',
    tokenLabel: 'Account SID + Auth Token',
    tokenHelpUrl: 'https://console.twilio.com/',
    placeholder: 'ACXXXXXXXX:auth_token',
    capabilities: [
      'Send SMS',
      'View message history',
    ],
    comingSoon: true,
  },

  // WEBSITES & CMS
  {
    id: 'wordpress',
    name: 'WordPress',
    description: 'Manage WordPress posts and pages',
    category: 'website',
    icon: '🌐',
    color: '#21759b',
    tokenLabel: 'Application Password',
    tokenHelpUrl: 'https://make.wordpress.org/core/2020/11/05/application-passwords-integration-guide/',
    placeholder: 'username:xxxx xxxx xxxx xxxx',
    capabilities: [
      'Create posts',
      'Edit pages',
      'Manage media',
      'Update content',
    ],
    comingSoon: true,
  },
  {
    id: 'webflow',
    name: 'Webflow',
    description: 'Manage Webflow CMS content',
    category: 'website',
    icon: '🎨',
    color: '#4353ff',
    tokenLabel: 'API Token',
    tokenHelpUrl: 'https://webflow.com/dashboard/account/integrations',
    placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    capabilities: [
      'Edit CMS items',
      'Manage collections',
      'Publish changes',
    ],
    comingSoon: true,
  },
  {
    id: 'ghost',
    name: 'Ghost',
    description: 'Manage Ghost blog content',
    category: 'website',
    icon: '👻',
    color: '#15171a',
    tokenLabel: 'Admin API Key',
    tokenHelpUrl: 'https://ghost.org/docs/admin-api/',
    placeholder: 'xxxxxxxxxxxxxxxxxxxx:yyyyyyyyyyyyyyyy',
    capabilities: [
      'Create posts',
      'Edit content',
      'Manage tags',
    ],
    comingSoon: true,
  },
];

// Get connectors by category
export function getConnectorsByCategory(category: ConnectorConfig['category']): ConnectorConfig[] {
  return CONNECTORS.filter(c => c.category === category);
}

// Get a specific connector by ID
export function getConnectorById(id: string): ConnectorConfig | undefined {
  return CONNECTORS.find(c => c.id === id);
}

// Get all active (non-coming-soon) connectors
export function getActiveConnectors(): ConnectorConfig[] {
  return CONNECTORS.filter(c => !c.comingSoon);
}

// Category labels for UI
export const CATEGORY_LABELS: Record<ConnectorConfig['category'], string> = {
  code: 'Code & Development',
  ecommerce: 'E-Commerce',
  docs: 'Docs & Data',
  project: 'Project Management',
  analytics: 'Analytics',
  ai: 'AI & Voice',
  communication: 'Communication',
  website: 'Websites & CMS',
};
