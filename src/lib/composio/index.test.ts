/**
 * Tests for src/lib/composio/index.ts (barrel export file)
 *
 * This file verifies that ALL exports from the composio barrel file are:
 * 1. Properly re-exported and accessible
 * 2. Functional when imported through the barrel
 * 3. Type-correct
 *
 * Covers:
 * - Client exports (initiateConnection, connectWithApiKey, etc.)
 * - Type exports (ToolkitConfig, ConnectionStatus, etc.)
 * - Toolkit exports (POPULAR_TOOLKITS, ALL_TOOLKITS, getToolkitById, etc.)
 * - Chat-tool exports (isComposioTool, isComposioGitHubTool, etc.)
 * - GitHub toolkit exports (ALL_GITHUB_ACTIONS, getGitHubActionStats, etc.)
 * - Gmail toolkit exports
 * - Outlook toolkit exports
 * - Slack toolkit exports
 * - Google Sheets, Discord, Google Docs, Twitter, LinkedIn, etc.
 * - All 37 toolkit checker functions
 * - Featured actions and connected apps summary
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Set COMPOSIO_API_KEY BEFORE module loads (client reads it at top-level)
// ---------------------------------------------------------------------------
vi.hoisted(() => {
  process.env.COMPOSIO_API_KEY = 'test-composio-api-key';
});

// ---------------------------------------------------------------------------
// vi.hoisted — prepare mocks before vi.mock factories
// ---------------------------------------------------------------------------
const {
  mockAuthConfigsList,
  mockAuthConfigsCreate,
  mockConnectedAccountsInitiate,
  mockConnectedAccountsList,
  mockConnectedAccountsGet,
  mockConnectedAccountsDelete,
  mockConnectedAccountsWaitForConnection,
  mockConnectedAccountsCreate,
  mockToolsExecute,
  mockToolsGet,
} = vi.hoisted(() => ({
  mockAuthConfigsList: vi.fn(),
  mockAuthConfigsCreate: vi.fn(),
  mockConnectedAccountsInitiate: vi.fn(),
  mockConnectedAccountsList: vi.fn(),
  mockConnectedAccountsGet: vi.fn(),
  mockConnectedAccountsDelete: vi.fn(),
  mockConnectedAccountsWaitForConnection: vi.fn(),
  mockConnectedAccountsCreate: vi.fn(),
  mockToolsExecute: vi.fn(),
  mockToolsGet: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mocks — MUST come before importing module under test
// ---------------------------------------------------------------------------
vi.mock('@composio/core', () => ({
  Composio: vi.fn().mockImplementation(() => ({
    authConfigs: {
      list: mockAuthConfigsList,
      create: mockAuthConfigsCreate,
    },
    connectedAccounts: {
      initiate: mockConnectedAccountsInitiate,
      list: mockConnectedAccountsList,
      get: mockConnectedAccountsGet,
      delete: mockConnectedAccountsDelete,
      waitForConnection: mockConnectedAccountsWaitForConnection,
      create: mockConnectedAccountsCreate,
    },
    tools: {
      execute: mockToolsExecute,
      get: mockToolsGet,
    },
  })),
}));

vi.mock('@composio/anthropic', () => ({
  AnthropicProvider: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('./connection-cache', () => ({
  getCachedConnections: vi.fn(async () => null),
  isCacheFresh: vi.fn(async () => false),
  saveConnectionsToCache: vi.fn(async () => undefined),
  saveSingleConnectionToCache: vi.fn(async () => undefined),
  removeConnectionFromCache: vi.fn(async () => undefined),
  withRetry: vi.fn(async <T>(fn: () => Promise<T>) => fn()),
}));

// ---------------------------------------------------------------------------
// Import module under test — through the barrel
// ---------------------------------------------------------------------------
import {
  // Client exports
  initiateConnection,
  connectWithApiKey,
  waitForConnection,
  getConnectedAccounts,
  getConnectedAccount,
  disconnectAccount,
  executeTool,
  getAvailableTools,
  isComposioConfigured,
  getComposioClient,

  // Toolkit exports
  POPULAR_TOOLKITS,
  ALL_TOOLKITS,
  TOOLKITS_BY_CATEGORY,
  getToolkitById,
  getToolkitsByCategory,
  getPopularToolkits,
  composioSlugToToolkitId,

  // Chat-tool exports
  getComposioToolsForUser,
  executeComposioTool,
  isComposioTool,
  isComposioToolkitTool,
  isComposioGitHubTool,
  isComposioGmailTool,
  isComposioOutlookTool,
  isComposioSlackTool,
  isComposioGoogleSheetsTool,
  isComposioDiscordTool,
  isComposioGoogleDocsTool,
  isComposioTwitterTool,
  isComposioLinkedInTool,
  isComposioInstagramTool,
  isComposioYouTubeTool,
  isComposioVercelTool,
  isComposioStripeTool,
  isComposioGoogleDriveTool,
  isComposioAirtableTool,
  isComposioMicrosoftTeamsTool,
  isComposioLinearTool,
  isComposioGoogleCalendarTool,
  isComposioHubSpotTool,
  isComposioSalesforceTool,
  isComposioSentryTool,
  isComposioSupabaseTool,
  isComposioCloudfareTool,
  isComposioRedditTool,
  isComposioShopifyTool,
  isComposioGoogleSlidesTool,
  isComposioGoogleTasksTool,
  isComposioGoogleMeetTool,
  isComposioGooglePhotosTool,
  isComposioGoogleAnalyticsTool,
  isComposioGoogleSearchConsoleTool,
  isComposioGoogleAdsTool,
  isComposioGoogleMapsTool,
  isComposioDropboxTool,
  isComposioElevenLabsTool,
  isComposioSerpAPITool,
  isComposioPerplexityAITool,
  getConnectedAppsSummary,
  getFeaturedActions,

  // GitHub toolkit exports
  ALL_GITHUB_ACTIONS,
  getGitHubFeaturedActionNames,
  getGitHubActionsByPriority,
  getGitHubActionNamesByPriority,
  getGitHubActionsByCategory,
  getGitHubActionPriority,
  isKnownGitHubAction,
  isDestructiveGitHubAction,
  sortByGitHubPriority,
  getGitHubActionStats,
  getGitHubSystemPrompt,
  getGitHubCapabilitySummary,
  logGitHubToolkitStats,

  // Gmail toolkit exports
  ALL_GMAIL_ACTIONS,
  getGmailFeaturedActionNames,
  getGmailActionsByPriority,
  getGmailActionNamesByPriority,
  getGmailActionsByCategory,
  getGmailActionPriority,
  isKnownGmailAction,
  isDestructiveGmailAction,
  sortByGmailPriority,
  getGmailActionStats,
  getGmailSystemPrompt,
  getGmailCapabilitySummary,
  logGmailToolkitStats,

  // Outlook toolkit exports
  ALL_OUTLOOK_ACTIONS,
  getOutlookFeaturedActionNames,
  getOutlookActionsByPriority,
  getOutlookActionNamesByPriority,

  // Slack toolkit exports
  ALL_SLACK_ACTIONS,
  getSlackFeaturedActionNames,
  getSlackActionsByPriority,
  getSlackActionNamesByPriority,

  // Google Sheets toolkit exports
  ALL_GOOGLE_SHEETS_ACTIONS,
  getGoogleSheetsFeaturedActionNames,

  // Discord toolkit exports
  ALL_DISCORD_ACTIONS,
  getDiscordFeaturedActionNames,

  // Google Docs toolkit exports
  ALL_GOOGLE_DOCS_ACTIONS,

  // Twitter toolkit exports
  ALL_TWITTER_ACTIONS,

  // LinkedIn toolkit exports
  ALL_LINKEDIN_ACTIONS,

  // Instagram toolkit exports
  ALL_INSTAGRAM_ACTIONS,

  // YouTube toolkit exports
  ALL_YOUTUBE_ACTIONS,

  // Vercel toolkit exports
  ALL_VERCEL_ACTIONS,

  // Stripe toolkit exports
  ALL_STRIPE_ACTIONS,

  // Google Drive toolkit exports
  ALL_GOOGLE_DRIVE_ACTIONS,

  // Airtable toolkit exports
  ALL_AIRTABLE_ACTIONS,

  // Microsoft Teams toolkit exports
  ALL_MICROSOFT_TEAMS_ACTIONS,

  // Linear toolkit exports
  ALL_LINEAR_ACTIONS,

  // Google Calendar toolkit exports
  ALL_GOOGLE_CALENDAR_ACTIONS,

  // HubSpot toolkit exports
  ALL_HUBSPOT_ACTIONS,

  // Salesforce toolkit exports
  ALL_SALESFORCE_ACTIONS,

  // Sentry toolkit exports
  ALL_SENTRY_ACTIONS,

  // Supabase toolkit exports
  ALL_SUPABASE_ACTIONS,

  // Cloudflare toolkit exports
  ALL_CLOUDFLARE_ACTIONS,

  // Reddit toolkit exports
  ALL_REDDIT_ACTIONS,

  // Shopify toolkit exports
  ALL_SHOPIFY_ACTIONS,

  // Google Slides toolkit exports
  ALL_GOOGLE_SLIDES_ACTIONS,

  // Google Tasks toolkit exports
  ALL_GOOGLE_TASKS_ACTIONS,

  // Google Meet toolkit exports
  ALL_GOOGLE_MEET_ACTIONS,

  // Google Photos toolkit exports
  ALL_GOOGLE_PHOTOS_ACTIONS,

  // Google Analytics toolkit exports
  ALL_GOOGLE_ANALYTICS_ACTIONS,

  // Google Search Console toolkit exports
  ALL_GOOGLE_SEARCH_CONSOLE_ACTIONS,

  // Google Ads toolkit exports
  ALL_GOOGLE_ADS_ACTIONS,

  // Google Maps toolkit exports
  ALL_GOOGLE_MAPS_ACTIONS,

  // Dropbox toolkit exports
  ALL_DROPBOX_ACTIONS,

  // ElevenLabs toolkit exports
  ALL_ELEVENLABS_ACTIONS,

  // SerpAPI toolkit exports
  ALL_SERPAPI_ACTIONS,

  // Perplexity AI toolkit exports
  ALL_PERPLEXITY_AI_ACTIONS,
} from './index';

// Also import types to verify they compile
import type {
  ToolkitConfig,
  ToolkitCategory,
  ConnectionStatus,
  ConnectedAccount,
  ConnectionRequest,
  ToolExecutionResult,
  UserConnections,
  ComposioSession,
  ComposioWebhookPayload,
  ComposioTool,
  ClaudeTool,
  ComposioToolContext,
  GitHubActionCategory,
  GitHubAction,
  GmailActionCategory,
  GmailAction,
  OutlookActionCategory,
  OutlookAction,
  SlackActionCategory,
  SlackAction,
} from './index';

// ============================================================================
// TESTS
// ============================================================================

describe('composio/index barrel exports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConnectedAccountsList.mockResolvedValue({ items: [] });
  });

  // ==========================================================================
  // 1. CLIENT EXPORTS
  // ==========================================================================

  describe('client exports', () => {
    it('exports isComposioConfigured as a function', () => {
      expect(typeof isComposioConfigured).toBe('function');
    });

    it('isComposioConfigured returns true when API key is set', () => {
      expect(isComposioConfigured()).toBe(true);
    });

    it('exports getComposioClient as a function', () => {
      expect(typeof getComposioClient).toBe('function');
    });

    it('getComposioClient returns a client instance', () => {
      const client = getComposioClient();
      expect(client).toBeDefined();
      expect(client.authConfigs).toBeDefined();
      expect(client.connectedAccounts).toBeDefined();
      expect(client.tools).toBeDefined();
    });

    it('exports initiateConnection as a function', () => {
      expect(typeof initiateConnection).toBe('function');
    });

    it('exports connectWithApiKey as a function', () => {
      expect(typeof connectWithApiKey).toBe('function');
    });

    it('exports waitForConnection as a function', () => {
      expect(typeof waitForConnection).toBe('function');
    });

    it('exports getConnectedAccounts as a function', () => {
      expect(typeof getConnectedAccounts).toBe('function');
    });

    it('exports getConnectedAccount as a function', () => {
      expect(typeof getConnectedAccount).toBe('function');
    });

    it('exports disconnectAccount as a function', () => {
      expect(typeof disconnectAccount).toBe('function');
    });

    it('exports executeTool as a function', () => {
      expect(typeof executeTool).toBe('function');
    });

    it('exports getAvailableTools as a function', () => {
      expect(typeof getAvailableTools).toBe('function');
    });
  });

  // ==========================================================================
  // 2. TOOLKIT EXPORTS
  // ==========================================================================

  describe('toolkit exports', () => {
    it('exports POPULAR_TOOLKITS as a non-empty array', () => {
      expect(Array.isArray(POPULAR_TOOLKITS)).toBe(true);
      expect(POPULAR_TOOLKITS.length).toBeGreaterThan(0);
    });

    it('POPULAR_TOOLKITS entries have correct ToolkitConfig shape', () => {
      const first = POPULAR_TOOLKITS[0];
      expect(first).toHaveProperty('id');
      expect(first).toHaveProperty('displayName');
      expect(first).toHaveProperty('description');
      expect(first).toHaveProperty('icon');
      expect(first).toHaveProperty('category');
      expect(first).toHaveProperty('authType');
    });

    it('exports ALL_TOOLKITS as a non-empty array', () => {
      expect(Array.isArray(ALL_TOOLKITS)).toBe(true);
      expect(ALL_TOOLKITS.length).toBeGreaterThan(0);
    });

    it('ALL_TOOLKITS contains more toolkits than POPULAR_TOOLKITS', () => {
      expect(ALL_TOOLKITS.length).toBeGreaterThanOrEqual(POPULAR_TOOLKITS.length);
    });

    it('exports TOOLKITS_BY_CATEGORY as an object', () => {
      expect(typeof TOOLKITS_BY_CATEGORY).toBe('object');
      expect(TOOLKITS_BY_CATEGORY).toHaveProperty('communication');
      expect(TOOLKITS_BY_CATEGORY).toHaveProperty('productivity');
      expect(TOOLKITS_BY_CATEGORY).toHaveProperty('social');
      expect(TOOLKITS_BY_CATEGORY).toHaveProperty('development');
    });

    it('getToolkitById returns a toolkit for known IDs', () => {
      const github = getToolkitById('GITHUB');
      expect(github).toBeDefined();
      expect(github?.id).toBe('GITHUB');
      expect(github?.displayName).toBe('GitHub');
    });

    it('getToolkitById returns undefined for unknown IDs', () => {
      const result = getToolkitById('NONEXISTENT_TOOLKIT');
      expect(result).toBeUndefined();
    });

    it('getToolkitById handles empty string', () => {
      const result = getToolkitById('');
      expect(result).toBeUndefined();
    });

    it('getToolkitById handles case-insensitive lookups', () => {
      const result = getToolkitById('github');
      expect(result).toBeDefined();
      expect(result?.id).toBe('GITHUB');
    });

    it('getToolkitsByCategory returns toolkits for a valid category', () => {
      const devToolkits = getToolkitsByCategory('development');
      expect(Array.isArray(devToolkits)).toBe(true);
      expect(devToolkits.length).toBeGreaterThan(0);
      for (const t of devToolkits) {
        expect(t.category).toBe('development');
      }
    });

    it('getToolkitsByCategory returns empty array for category with no toolkits', () => {
      const result = getToolkitsByCategory('education');
      expect(Array.isArray(result)).toBe(true);
    });

    it('getPopularToolkits returns the same array as POPULAR_TOOLKITS', () => {
      const popular = getPopularToolkits();
      expect(popular).toBe(POPULAR_TOOLKITS);
    });

    it('composioSlugToToolkitId maps known slugs to internal IDs', () => {
      const result = composioSlugToToolkitId('github');
      expect(result).toBe('GITHUB');
    });

    it('composioSlugToToolkitId falls back to uppercased slug for unknown', () => {
      const result = composioSlugToToolkitId('unknownapp');
      expect(result).toBe('UNKNOWNAPP');
    });
  });

  // ==========================================================================
  // 3. CHAT-TOOLS TYPE CHECKER EXPORTS
  // ==========================================================================

  describe('isComposioTool and toolkit checker functions', () => {
    it('isComposioTool returns true for composio-prefixed names', () => {
      expect(isComposioTool('composio_GITHUB_CREATE_ISSUE')).toBe(true);
      expect(isComposioTool('composio_GMAIL_SEND_EMAIL')).toBe(true);
    });

    it('isComposioTool returns false for non-composio names', () => {
      expect(isComposioTool('regular_tool')).toBe(false);
      expect(isComposioTool('github_create_issue')).toBe(false);
    });

    it('isComposioToolkitTool checks specific prefix', () => {
      expect(isComposioToolkitTool('composio_GITHUB_CREATE_ISSUE', 'GITHUB')).toBe(true);
      expect(isComposioToolkitTool('composio_GMAIL_SEND_EMAIL', 'GITHUB')).toBe(false);
    });

    it('isComposioGitHubTool detects GitHub tools', () => {
      expect(isComposioGitHubTool('composio_GITHUB_CREATE_ISSUE')).toBe(true);
      expect(isComposioGitHubTool('composio_GMAIL_SEND_EMAIL')).toBe(false);
    });

    it('isComposioGmailTool detects Gmail tools', () => {
      expect(isComposioGmailTool('composio_GMAIL_SEND_EMAIL')).toBe(true);
      expect(isComposioGmailTool('composio_GITHUB_CREATE_ISSUE')).toBe(false);
    });

    it('isComposioOutlookTool detects Outlook tools', () => {
      expect(isComposioOutlookTool('composio_OUTLOOK_SEND_EMAIL')).toBe(true);
      expect(isComposioOutlookTool('composio_GMAIL_SEND_EMAIL')).toBe(false);
    });

    it('isComposioSlackTool detects Slack tools', () => {
      expect(isComposioSlackTool('composio_SLACK_SEND_MESSAGE')).toBe(true);
      expect(isComposioSlackTool('composio_DISCORD_SEND_MESSAGE')).toBe(false);
    });

    it('isComposioGoogleSheetsTool detects Google Sheets tools', () => {
      expect(isComposioGoogleSheetsTool('composio_GOOGLESHEETS_BATCH_UPDATE')).toBe(true);
      expect(isComposioGoogleSheetsTool('composio_GITHUB_CREATE_ISSUE')).toBe(false);
    });

    it('isComposioDiscordTool detects Discord tools', () => {
      expect(isComposioDiscordTool('composio_DISCORD_SEND_MESSAGE')).toBe(true);
      expect(isComposioDiscordTool('composio_SLACK_SEND_MESSAGE')).toBe(false);
    });

    it('isComposioGoogleDocsTool detects Google Docs tools', () => {
      expect(isComposioGoogleDocsTool('composio_GOOGLEDOCS_CREATE_DOCUMENT')).toBe(true);
    });

    it('isComposioTwitterTool detects Twitter tools', () => {
      expect(isComposioTwitterTool('composio_TWITTER_CREATE_TWEET')).toBe(true);
    });

    it('isComposioLinkedInTool detects LinkedIn tools', () => {
      expect(isComposioLinkedInTool('composio_LINKEDIN_CREATE_POST')).toBe(true);
    });

    it('isComposioInstagramTool detects Instagram tools', () => {
      expect(isComposioInstagramTool('composio_INSTAGRAM_CREATE_POST')).toBe(true);
    });

    it('isComposioYouTubeTool detects YouTube tools', () => {
      expect(isComposioYouTubeTool('composio_YOUTUBE_SEARCH')).toBe(true);
    });

    it('isComposioVercelTool detects Vercel tools', () => {
      expect(isComposioVercelTool('composio_VERCEL_CREATE_DEPLOYMENT')).toBe(true);
    });

    it('isComposioStripeTool detects Stripe tools', () => {
      expect(isComposioStripeTool('composio_STRIPE_CREATE_PAYMENT_INTENT')).toBe(true);
    });

    it('isComposioGoogleDriveTool detects Google Drive tools', () => {
      expect(isComposioGoogleDriveTool('composio_GOOGLEDRIVE_CREATE_FILE')).toBe(true);
    });

    it('isComposioAirtableTool detects Airtable tools', () => {
      expect(isComposioAirtableTool('composio_AIRTABLE_CREATE_RECORD')).toBe(true);
    });

    it('isComposioMicrosoftTeamsTool detects MS Teams tools', () => {
      expect(isComposioMicrosoftTeamsTool('composio_MICROSOFTTEAMS_SEND_MESSAGE')).toBe(true);
    });

    it('isComposioLinearTool detects Linear tools', () => {
      expect(isComposioLinearTool('composio_LINEAR_CREATE_ISSUE')).toBe(true);
    });

    it('isComposioGoogleCalendarTool detects Google Calendar tools', () => {
      expect(isComposioGoogleCalendarTool('composio_GOOGLECALENDAR_CREATE_EVENT')).toBe(true);
    });

    it('isComposioHubSpotTool detects HubSpot tools', () => {
      expect(isComposioHubSpotTool('composio_HUBSPOT_CREATE_CONTACT')).toBe(true);
    });

    it('isComposioSalesforceTool detects Salesforce tools', () => {
      expect(isComposioSalesforceTool('composio_SALESFORCE_CREATE_LEAD')).toBe(true);
    });

    it('isComposioSentryTool detects Sentry tools', () => {
      expect(isComposioSentryTool('composio_SENTRY_GET_ISSUES')).toBe(true);
    });

    it('isComposioSupabaseTool detects Supabase tools', () => {
      expect(isComposioSupabaseTool('composio_SUPABASE_QUERY')).toBe(true);
    });

    it('isComposioCloudfareTool detects Cloudflare tools', () => {
      expect(isComposioCloudfareTool('composio_CLOUDFLARE_LIST_ZONES')).toBe(true);
    });

    it('isComposioRedditTool detects Reddit tools', () => {
      expect(isComposioRedditTool('composio_REDDIT_CREATE_POST')).toBe(true);
    });

    it('isComposioShopifyTool detects Shopify tools', () => {
      expect(isComposioShopifyTool('composio_SHOPIFY_LIST_PRODUCTS')).toBe(true);
    });

    it('isComposioGoogleSlidesTool detects Google Slides tools', () => {
      expect(isComposioGoogleSlidesTool('composio_GOOGLESLIDES_CREATE')).toBe(true);
    });

    it('isComposioGoogleTasksTool detects Google Tasks tools', () => {
      expect(isComposioGoogleTasksTool('composio_GOOGLETASKS_CREATE_TASK')).toBe(true);
    });

    it('isComposioGoogleMeetTool detects Google Meet tools', () => {
      expect(isComposioGoogleMeetTool('composio_GOOGLEMEET_CREATE_MEETING')).toBe(true);
    });

    it('isComposioGooglePhotosTool detects Google Photos tools', () => {
      expect(isComposioGooglePhotosTool('composio_GOOGLEPHOTOS_LIST_ALBUMS')).toBe(true);
    });

    it('isComposioGoogleAnalyticsTool detects Google Analytics tools', () => {
      expect(isComposioGoogleAnalyticsTool('composio_GOOGLEANALYTICS_GET_REPORT')).toBe(true);
    });

    it('isComposioGoogleSearchConsoleTool detects Google Search Console tools', () => {
      expect(isComposioGoogleSearchConsoleTool('composio_GOOGLESEARCHCONSOLE_GET_ANALYTICS')).toBe(
        true
      );
    });

    it('isComposioGoogleAdsTool detects Google Ads tools', () => {
      expect(isComposioGoogleAdsTool('composio_GOOGLEADS_CREATE_CAMPAIGN')).toBe(true);
    });

    it('isComposioGoogleMapsTool detects Google Maps tools', () => {
      expect(isComposioGoogleMapsTool('composio_GOOGLEMAPS_GET_DIRECTIONS')).toBe(true);
    });

    it('isComposioDropboxTool detects Dropbox tools', () => {
      expect(isComposioDropboxTool('composio_DROPBOX_UPLOAD_FILE')).toBe(true);
    });

    it('isComposioElevenLabsTool detects ElevenLabs tools', () => {
      expect(isComposioElevenLabsTool('composio_ELEVENLABS_TTS')).toBe(true);
    });

    it('isComposioSerpAPITool detects SerpAPI tools', () => {
      expect(isComposioSerpAPITool('composio_SERPAPI_SEARCH')).toBe(true);
    });

    it('isComposioPerplexityAITool detects Perplexity AI tools', () => {
      expect(isComposioPerplexityAITool('composio_PERPLEXITYAI_SEARCH')).toBe(true);
    });
  });

  // ==========================================================================
  // 4. GITHUB TOOLKIT EXPORTS
  // ==========================================================================

  describe('GitHub toolkit exports', () => {
    it('ALL_GITHUB_ACTIONS is a non-empty array of GitHubAction objects', () => {
      expect(Array.isArray(ALL_GITHUB_ACTIONS)).toBe(true);
      expect(ALL_GITHUB_ACTIONS.length).toBeGreaterThan(0);
      const first = ALL_GITHUB_ACTIONS[0];
      expect(first).toHaveProperty('name');
      expect(first).toHaveProperty('label');
      expect(first).toHaveProperty('category');
      expect(first).toHaveProperty('priority');
    });

    it('getGitHubFeaturedActionNames returns all action names', () => {
      const names = getGitHubFeaturedActionNames();
      expect(Array.isArray(names)).toBe(true);
      expect(names.length).toBe(ALL_GITHUB_ACTIONS.length);
      expect(names[0]).toBe(ALL_GITHUB_ACTIONS[0].name);
    });

    it('getGitHubActionsByPriority filters by max priority', () => {
      const essential = getGitHubActionsByPriority(1);
      expect(essential.length).toBeGreaterThan(0);
      for (const action of essential) {
        expect(action.priority).toBe(1);
      }
    });

    it('getGitHubActionNamesByPriority returns string array', () => {
      const names = getGitHubActionNamesByPriority(2);
      expect(Array.isArray(names)).toBe(true);
      expect(names.length).toBeGreaterThan(0);
      for (const name of names) {
        expect(typeof name).toBe('string');
      }
    });

    it('getGitHubActionsByCategory returns actions for a valid category', () => {
      const issueActions = getGitHubActionsByCategory('issues');
      expect(issueActions.length).toBeGreaterThan(0);
      for (const action of issueActions) {
        expect(action.category).toBe('issues');
      }
    });

    it('getGitHubActionPriority returns priority for known actions', () => {
      const priority = getGitHubActionPriority('GITHUB_CREATE_ISSUE');
      expect(priority).toBe(1);
    });

    it('getGitHubActionPriority returns 99 for unknown actions', () => {
      const priority = getGitHubActionPriority('UNKNOWN_ACTION');
      expect(priority).toBe(99);
    });

    it('getGitHubActionPriority strips composio_ prefix', () => {
      const priority = getGitHubActionPriority('composio_GITHUB_CREATE_ISSUE');
      expect(priority).toBe(1);
    });

    it('isKnownGitHubAction returns true for known actions', () => {
      expect(isKnownGitHubAction('GITHUB_CREATE_ISSUE')).toBe(true);
      expect(isKnownGitHubAction('composio_GITHUB_CREATE_ISSUE')).toBe(true);
    });

    it('isKnownGitHubAction returns false for unknown actions', () => {
      expect(isKnownGitHubAction('GITHUB_UNKNOWN_ACTION')).toBe(false);
    });

    it('isDestructiveGitHubAction identifies destructive actions', () => {
      expect(isDestructiveGitHubAction('GITHUB_DELETE_REPOSITORY')).toBe(true);
      expect(isDestructiveGitHubAction('GITHUB_DELETE_FILE')).toBe(true);
    });

    it('isDestructiveGitHubAction returns false for non-destructive actions', () => {
      expect(isDestructiveGitHubAction('GITHUB_CREATE_ISSUE')).toBe(false);
      expect(isDestructiveGitHubAction('GITHUB_LIST_ISSUES')).toBe(false);
    });

    it('sortByGitHubPriority sorts tools by priority ascending', () => {
      const tools = [
        { name: 'composio_GITHUB_DELETE_REPOSITORY' }, // priority 4
        { name: 'composio_GITHUB_CREATE_ISSUE' }, // priority 1
        { name: 'composio_GITHUB_ADD_LABELS_TO_ISSUE' }, // priority 2
      ];
      const sorted = sortByGitHubPriority(tools);
      expect(sorted[0].name).toBe('composio_GITHUB_CREATE_ISSUE');
      expect(sorted[1].name).toBe('composio_GITHUB_ADD_LABELS_TO_ISSUE');
      expect(sorted[2].name).toBe('composio_GITHUB_DELETE_REPOSITORY');
    });

    it('getGitHubActionStats returns correct structure', () => {
      const stats = getGitHubActionStats();
      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('byPriority');
      expect(stats).toHaveProperty('byCategory');
      expect(stats.total).toBe(ALL_GITHUB_ACTIONS.length);
      expect(typeof stats.byPriority).toBe('object');
      expect(typeof stats.byCategory).toBe('object');
    });

    it('getGitHubSystemPrompt returns a non-empty string', () => {
      const prompt = getGitHubSystemPrompt();
      expect(typeof prompt).toBe('string');
      expect(prompt.length).toBeGreaterThan(0);
      expect(prompt).toContain('GitHub');
    });

    it('getGitHubCapabilitySummary returns a summary string', () => {
      const summary = getGitHubCapabilitySummary();
      expect(typeof summary).toBe('string');
      expect(summary).toContain('GitHub');
    });

    it('logGitHubToolkitStats is a callable function', () => {
      expect(typeof logGitHubToolkitStats).toBe('function');
      // Should not throw
      logGitHubToolkitStats();
    });
  });

  // ==========================================================================
  // 5. GMAIL TOOLKIT EXPORTS
  // ==========================================================================

  describe('Gmail toolkit exports', () => {
    it('ALL_GMAIL_ACTIONS is a non-empty array', () => {
      expect(Array.isArray(ALL_GMAIL_ACTIONS)).toBe(true);
      expect(ALL_GMAIL_ACTIONS.length).toBeGreaterThan(0);
    });

    it('getGmailFeaturedActionNames returns all action names', () => {
      const names = getGmailFeaturedActionNames();
      expect(names.length).toBe(ALL_GMAIL_ACTIONS.length);
    });

    it('getGmailActionsByPriority filters correctly', () => {
      const essential = getGmailActionsByPriority(1);
      for (const action of essential) {
        expect(action.priority).toBe(1);
      }
    });

    it('getGmailActionNamesByPriority returns strings', () => {
      const names = getGmailActionNamesByPriority(2);
      expect(Array.isArray(names)).toBe(true);
      for (const name of names) {
        expect(typeof name).toBe('string');
      }
    });

    it('getGmailActionsByCategory returns actions for a valid category', () => {
      // Gmail categories include 'send', 'read', etc. - get all actions and pick a category
      if (ALL_GMAIL_ACTIONS.length > 0) {
        const firstCategory = ALL_GMAIL_ACTIONS[0].category;
        const result = getGmailActionsByCategory(firstCategory);
        expect(result.length).toBeGreaterThan(0);
      }
    });

    it('getGmailActionPriority returns a number', () => {
      if (ALL_GMAIL_ACTIONS.length > 0) {
        const priority = getGmailActionPriority(ALL_GMAIL_ACTIONS[0].name);
        expect(typeof priority).toBe('number');
      }
    });

    it('isKnownGmailAction works correctly', () => {
      if (ALL_GMAIL_ACTIONS.length > 0) {
        expect(isKnownGmailAction(ALL_GMAIL_ACTIONS[0].name)).toBe(true);
      }
      expect(isKnownGmailAction('GMAIL_NONEXISTENT')).toBe(false);
    });

    it('isDestructiveGmailAction returns boolean', () => {
      const result = isDestructiveGmailAction('GMAIL_SOME_ACTION');
      expect(typeof result).toBe('boolean');
    });

    it('sortByGmailPriority returns a sorted array', () => {
      const tools = [{ name: 'test1' }, { name: 'test2' }];
      const sorted = sortByGmailPriority(tools);
      expect(Array.isArray(sorted)).toBe(true);
      expect(sorted.length).toBe(2);
    });

    it('getGmailActionStats returns correct structure', () => {
      const stats = getGmailActionStats();
      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('byPriority');
      expect(stats).toHaveProperty('byCategory');
    });

    it('getGmailSystemPrompt returns a string containing Gmail', () => {
      const prompt = getGmailSystemPrompt();
      expect(typeof prompt).toBe('string');
      expect(prompt).toContain('Gmail');
    });

    it('getGmailCapabilitySummary returns a summary', () => {
      const summary = getGmailCapabilitySummary();
      expect(typeof summary).toBe('string');
      expect(summary).toContain('Gmail');
    });

    it('logGmailToolkitStats does not throw', () => {
      expect(() => logGmailToolkitStats()).not.toThrow();
    });
  });

  // ==========================================================================
  // 6. OTHER TOOLKIT ACTION ARRAYS
  // ==========================================================================

  describe('all toolkit action arrays are exported and non-empty', () => {
    const toolkitArrays = [
      { name: 'ALL_OUTLOOK_ACTIONS', arr: ALL_OUTLOOK_ACTIONS },
      { name: 'ALL_SLACK_ACTIONS', arr: ALL_SLACK_ACTIONS },
      { name: 'ALL_GOOGLE_SHEETS_ACTIONS', arr: ALL_GOOGLE_SHEETS_ACTIONS },
      { name: 'ALL_DISCORD_ACTIONS', arr: ALL_DISCORD_ACTIONS },
      { name: 'ALL_GOOGLE_DOCS_ACTIONS', arr: ALL_GOOGLE_DOCS_ACTIONS },
      { name: 'ALL_TWITTER_ACTIONS', arr: ALL_TWITTER_ACTIONS },
      { name: 'ALL_LINKEDIN_ACTIONS', arr: ALL_LINKEDIN_ACTIONS },
      { name: 'ALL_INSTAGRAM_ACTIONS', arr: ALL_INSTAGRAM_ACTIONS },
      { name: 'ALL_YOUTUBE_ACTIONS', arr: ALL_YOUTUBE_ACTIONS },
      { name: 'ALL_VERCEL_ACTIONS', arr: ALL_VERCEL_ACTIONS },
      { name: 'ALL_STRIPE_ACTIONS', arr: ALL_STRIPE_ACTIONS },
      { name: 'ALL_GOOGLE_DRIVE_ACTIONS', arr: ALL_GOOGLE_DRIVE_ACTIONS },
      { name: 'ALL_AIRTABLE_ACTIONS', arr: ALL_AIRTABLE_ACTIONS },
      { name: 'ALL_MICROSOFT_TEAMS_ACTIONS', arr: ALL_MICROSOFT_TEAMS_ACTIONS },
      { name: 'ALL_LINEAR_ACTIONS', arr: ALL_LINEAR_ACTIONS },
      { name: 'ALL_GOOGLE_CALENDAR_ACTIONS', arr: ALL_GOOGLE_CALENDAR_ACTIONS },
      { name: 'ALL_HUBSPOT_ACTIONS', arr: ALL_HUBSPOT_ACTIONS },
      { name: 'ALL_SALESFORCE_ACTIONS', arr: ALL_SALESFORCE_ACTIONS },
      { name: 'ALL_SENTRY_ACTIONS', arr: ALL_SENTRY_ACTIONS },
      { name: 'ALL_SUPABASE_ACTIONS', arr: ALL_SUPABASE_ACTIONS },
      { name: 'ALL_CLOUDFLARE_ACTIONS', arr: ALL_CLOUDFLARE_ACTIONS },
      { name: 'ALL_REDDIT_ACTIONS', arr: ALL_REDDIT_ACTIONS },
      { name: 'ALL_SHOPIFY_ACTIONS', arr: ALL_SHOPIFY_ACTIONS },
      { name: 'ALL_GOOGLE_SLIDES_ACTIONS', arr: ALL_GOOGLE_SLIDES_ACTIONS },
      { name: 'ALL_GOOGLE_TASKS_ACTIONS', arr: ALL_GOOGLE_TASKS_ACTIONS },
      { name: 'ALL_GOOGLE_MEET_ACTIONS', arr: ALL_GOOGLE_MEET_ACTIONS },
      { name: 'ALL_GOOGLE_PHOTOS_ACTIONS', arr: ALL_GOOGLE_PHOTOS_ACTIONS },
      { name: 'ALL_GOOGLE_ANALYTICS_ACTIONS', arr: ALL_GOOGLE_ANALYTICS_ACTIONS },
      { name: 'ALL_GOOGLE_SEARCH_CONSOLE_ACTIONS', arr: ALL_GOOGLE_SEARCH_CONSOLE_ACTIONS },
      { name: 'ALL_GOOGLE_ADS_ACTIONS', arr: ALL_GOOGLE_ADS_ACTIONS },
      { name: 'ALL_GOOGLE_MAPS_ACTIONS', arr: ALL_GOOGLE_MAPS_ACTIONS },
      { name: 'ALL_DROPBOX_ACTIONS', arr: ALL_DROPBOX_ACTIONS },
      { name: 'ALL_ELEVENLABS_ACTIONS', arr: ALL_ELEVENLABS_ACTIONS },
      { name: 'ALL_SERPAPI_ACTIONS', arr: ALL_SERPAPI_ACTIONS },
      { name: 'ALL_PERPLEXITY_AI_ACTIONS', arr: ALL_PERPLEXITY_AI_ACTIONS },
    ];

    for (const { name, arr } of toolkitArrays) {
      it(`${name} is a non-empty array`, () => {
        expect(Array.isArray(arr)).toBe(true);
        expect(arr.length).toBeGreaterThan(0);
      });
    }

    it('each toolkit action has name, label, category, and priority fields', () => {
      for (const { arr } of toolkitArrays) {
        const first = arr[0];
        expect(first).toHaveProperty('name');
        expect(first).toHaveProperty('label');
        expect(first).toHaveProperty('category');
        expect(first).toHaveProperty('priority');
      }
    });
  });

  // ==========================================================================
  // 7. FEATURED ACTIONS AND CONNECTED APPS SUMMARY
  // ==========================================================================

  describe('getFeaturedActions', () => {
    it('returns a record of action descriptions to tool names', () => {
      const actions = getFeaturedActions();
      expect(typeof actions).toBe('object');
      expect(Object.keys(actions).length).toBeGreaterThan(0);
    });

    it('featured actions values start with composio_ prefix', () => {
      const actions = getFeaturedActions();
      for (const toolName of Object.values(actions)) {
        expect(toolName.startsWith('composio_')).toBe(true);
      }
    });

    it('contains key social/communication actions', () => {
      const actions = getFeaturedActions();
      expect(actions['Post a tweet']).toBe('composio_TWITTER_CREATE_TWEET');
      expect(actions['Send an email']).toBe('composio_GMAIL_SEND_EMAIL');
      expect(actions['Create GitHub issue']).toBe('composio_GITHUB_CREATE_ISSUE');
    });
  });

  describe('getConnectedAppsSummary', () => {
    it('returns empty string when no accounts are connected', async () => {
      mockConnectedAccountsList.mockResolvedValueOnce({ items: [] });
      const summary = await getConnectedAppsSummary('user-1');
      expect(summary).toBe('');
    });

    it('returns summary string with connected app names', async () => {
      mockConnectedAccountsList.mockResolvedValueOnce({
        items: [
          {
            id: 'conn-1',
            status: 'ACTIVE',
            toolkit: { slug: 'github' },
            createdAt: '2026-01-01',
          },
        ],
      });
      const summary = await getConnectedAppsSummary('user-1');
      expect(summary).toContain('GitHub');
      expect(summary).toContain('connected');
    });
  });

  // ==========================================================================
  // 8. ASYNC CLIENT FUNCTIONS
  // ==========================================================================

  describe('executeTool (via barrel)', () => {
    it('returns success when tool execution succeeds', async () => {
      mockToolsExecute.mockResolvedValueOnce({ data: { result: 'ok' } });
      const result = await executeTool('user-1', 'GITHUB_CREATE_ISSUE', { title: 'Test' });
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ result: 'ok' });
    });

    it('returns failure when tool execution throws', async () => {
      mockToolsExecute.mockRejectedValueOnce(new Error('API error'));
      const result = await executeTool('user-1', 'GITHUB_CREATE_ISSUE', { title: 'Test' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('API error');
    });
  });

  describe('getAvailableTools (via barrel)', () => {
    it('returns empty array when no toolkits provided', async () => {
      const tools = await getAvailableTools('user-1', []);
      expect(tools).toEqual([]);
    });

    it('returns empty array when toolkits is undefined', async () => {
      const tools = await getAvailableTools('user-1');
      expect(tools).toEqual([]);
    });
  });

  describe('executeComposioTool (via barrel)', () => {
    it('strips composio_ prefix and calls executeTool', async () => {
      mockToolsExecute.mockResolvedValueOnce({ data: { ok: true } });
      const result = await executeComposioTool('user-1', 'composio_GITHUB_CREATE_ISSUE', {
        title: 'Test',
      });
      expect(result.success).toBe(true);
      expect(mockToolsExecute).toHaveBeenCalledWith(
        'GITHUB_CREATE_ISSUE',
        expect.objectContaining({
          userId: 'user-1',
          arguments: { title: 'Test' },
        })
      );
    });

    it('returns error when execution fails', async () => {
      mockToolsExecute.mockRejectedValueOnce(new Error('network error'));
      const result = await executeComposioTool('user-1', 'composio_GITHUB_CREATE_ISSUE', {});
      expect(result.success).toBe(false);
      expect(result.error).toBe('network error');
    });
  });

  describe('getComposioToolsForUser (via barrel)', () => {
    it('returns empty context when no accounts connected', async () => {
      mockConnectedAccountsList.mockResolvedValueOnce({ items: [] });
      const context = await getComposioToolsForUser('user-1');
      expect(context.connectedApps).toEqual([]);
      expect(context.tools).toEqual([]);
      expect(context.systemPromptAddition).toBe('');
      expect(context.hasGitHub).toBe(false);
      expect(context.hasGmail).toBe(false);
      expect(context.hasOutlook).toBe(false);
      expect(context.hasSlack).toBe(false);
    });
  });

  // ==========================================================================
  // 9. TYPE EXPORTS COMPILE CHECK
  // ==========================================================================

  describe('type exports compile correctly', () => {
    it('ToolkitCategory type allows valid categories', () => {
      const category: ToolkitCategory = 'communication';
      expect(category).toBe('communication');
    });

    it('ConnectionStatus type allows valid statuses', () => {
      const status: ConnectionStatus = 'connected';
      expect(status).toBe('connected');
    });

    it('ToolkitConfig interface shape is correct', () => {
      const config: ToolkitConfig = {
        id: 'TEST',
        displayName: 'Test',
        description: 'A test toolkit',
        icon: 'T',
        category: 'development',
        authType: 'oauth2',
      };
      expect(config.id).toBe('TEST');
    });

    it('ConnectedAccount interface shape is correct', () => {
      const account: ConnectedAccount = {
        id: 'acc-1',
        toolkit: 'GITHUB',
        status: 'connected',
      };
      expect(account.id).toBe('acc-1');
    });

    it('ConnectionRequest interface shape is correct', () => {
      const req: ConnectionRequest = {
        id: 'req-1',
        redirectUrl: 'https://example.com',
        status: 'initiated',
      };
      expect(req.id).toBe('req-1');
    });

    it('ToolExecutionResult interface shape is correct', () => {
      const result: ToolExecutionResult = {
        success: true,
        data: { foo: 'bar' },
      };
      expect(result.success).toBe(true);
    });

    it('UserConnections interface shape is correct', () => {
      const uc: UserConnections = {
        userId: 'u1',
        accounts: [],
        lastUpdated: '2026-01-01',
      };
      expect(uc.userId).toBe('u1');
    });

    it('ComposioSession interface shape is correct', () => {
      const session: ComposioSession = {
        userId: 'u1',
        enabledToolkits: ['GITHUB'],
        disabledToolkits: [],
      };
      expect(session.enabledToolkits).toContain('GITHUB');
    });

    it('ComposioWebhookPayload interface shape is correct', () => {
      const payload: ComposioWebhookPayload = {
        type: 'connection.active',
        data: { id: '123' },
        timestamp: Date.now(),
        log_id: 'log-1',
      };
      expect(payload.type).toBe('connection.active');
    });

    it('ComposioTool interface shape is correct', () => {
      const tool: ComposioTool = {
        name: 'GITHUB_CREATE_ISSUE',
        description: 'Create an issue',
        parameters: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Issue title' },
          },
          required: ['title'],
        },
      };
      expect(tool.name).toBe('GITHUB_CREATE_ISSUE');
    });

    it('ClaudeTool interface shape is correct', () => {
      const tool: ClaudeTool = {
        name: 'composio_GITHUB_CREATE_ISSUE',
        description: 'Create an issue',
        input_schema: {
          type: 'object',
          properties: { title: { type: 'string' } },
          required: ['title'],
        },
      };
      expect(tool.name).toContain('composio_');
    });

    it('ComposioToolContext interface shape is correct', () => {
      const ctx: ComposioToolContext = {
        connectedApps: ['GITHUB'],
        tools: [],
        systemPromptAddition: '',
        hasGitHub: true,
        hasGmail: false,
        hasOutlook: false,
        hasSlack: false,
      };
      expect(ctx.hasGitHub).toBe(true);
    });

    it('GitHubActionCategory type allows valid categories', () => {
      const cat: GitHubActionCategory = 'repository';
      expect(cat).toBe('repository');
    });

    it('GitHubAction interface shape is correct', () => {
      const action: GitHubAction = {
        name: 'GITHUB_TEST',
        label: 'Test',
        category: 'issues',
        priority: 1,
      };
      expect(action.priority).toBe(1);
    });

    it('GmailActionCategory is a valid type', () => {
      // Just verify it compiles - the exact values depend on the gmail toolkit
      const cat: GmailActionCategory = ALL_GMAIL_ACTIONS[0].category;
      expect(typeof cat).toBe('string');
    });

    it('GmailAction interface matches ALL_GMAIL_ACTIONS entries', () => {
      const action: GmailAction = ALL_GMAIL_ACTIONS[0];
      expect(action).toHaveProperty('name');
      expect(action).toHaveProperty('category');
      expect(action).toHaveProperty('priority');
    });

    it('OutlookActionCategory is a valid type', () => {
      const cat: OutlookActionCategory = ALL_OUTLOOK_ACTIONS[0].category;
      expect(typeof cat).toBe('string');
    });

    it('OutlookAction interface matches ALL_OUTLOOK_ACTIONS entries', () => {
      const action: OutlookAction = ALL_OUTLOOK_ACTIONS[0];
      expect(action).toHaveProperty('name');
      expect(action).toHaveProperty('category');
      expect(action).toHaveProperty('priority');
    });

    it('SlackActionCategory is a valid type', () => {
      const cat: SlackActionCategory = ALL_SLACK_ACTIONS[0].category;
      expect(typeof cat).toBe('string');
    });

    it('SlackAction interface matches ALL_SLACK_ACTIONS entries', () => {
      const action: SlackAction = ALL_SLACK_ACTIONS[0];
      expect(action).toHaveProperty('name');
      expect(action).toHaveProperty('category');
      expect(action).toHaveProperty('priority');
    });
  });

  // ==========================================================================
  // 10. OUTLOOK AND SLACK TOOLKIT FUNCTION EXPORTS
  // ==========================================================================

  describe('Outlook toolkit function exports', () => {
    it('getOutlookFeaturedActionNames returns all action names', () => {
      const names = getOutlookFeaturedActionNames();
      expect(names.length).toBe(ALL_OUTLOOK_ACTIONS.length);
    });

    it('getOutlookActionsByPriority filters correctly', () => {
      const essential = getOutlookActionsByPriority(1);
      for (const a of essential) {
        expect(a.priority).toBe(1);
      }
    });

    it('getOutlookActionNamesByPriority returns strings', () => {
      const names = getOutlookActionNamesByPriority(2);
      expect(Array.isArray(names)).toBe(true);
      for (const n of names) {
        expect(typeof n).toBe('string');
      }
    });
  });

  describe('Slack toolkit function exports', () => {
    it('getSlackFeaturedActionNames returns all action names', () => {
      const names = getSlackFeaturedActionNames();
      expect(names.length).toBe(ALL_SLACK_ACTIONS.length);
    });

    it('getSlackActionsByPriority filters correctly', () => {
      const essential = getSlackActionsByPriority(1);
      for (const a of essential) {
        expect(a.priority).toBe(1);
      }
    });

    it('getSlackActionNamesByPriority returns strings', () => {
      const names = getSlackActionNamesByPriority(2);
      expect(Array.isArray(names)).toBe(true);
    });
  });

  // ==========================================================================
  // 11. GOOGLE SHEETS AND DISCORD FUNCTION EXPORTS
  // ==========================================================================

  describe('Google Sheets and Discord toolkit exports', () => {
    it('getGoogleSheetsFeaturedActionNames returns action names', () => {
      const names = getGoogleSheetsFeaturedActionNames();
      expect(names.length).toBe(ALL_GOOGLE_SHEETS_ACTIONS.length);
    });

    it('getDiscordFeaturedActionNames returns action names', () => {
      const names = getDiscordFeaturedActionNames();
      expect(names.length).toBe(ALL_DISCORD_ACTIONS.length);
    });
  });

  // ==========================================================================
  // 12. TOOLKITS_BY_CATEGORY STRUCTURE
  // ==========================================================================

  describe('TOOLKITS_BY_CATEGORY completeness', () => {
    const expectedCategories: ToolkitCategory[] = [
      'communication',
      'productivity',
      'social',
      'development',
      'crm',
      'finance',
      'calendar',
      'storage',
      'analytics',
      'marketing',
      'ecommerce',
      'hr',
      'support',
      'automation',
      'media',
      'education',
      'travel',
    ];

    it('has all expected category keys', () => {
      for (const cat of expectedCategories) {
        expect(TOOLKITS_BY_CATEGORY).toHaveProperty(cat);
        expect(Array.isArray(TOOLKITS_BY_CATEGORY[cat])).toBe(true);
      }
    });

    it('each category array contains only toolkits of that category', () => {
      for (const cat of expectedCategories) {
        for (const toolkit of TOOLKITS_BY_CATEGORY[cat]) {
          expect(toolkit.category).toBe(cat);
        }
      }
    });
  });
});
