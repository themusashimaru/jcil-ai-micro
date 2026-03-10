/**
 * Tests for src/lib/composio/chat-tools.ts
 *
 * Covers:
 * - Exported type interfaces (ClaudeTool, ComposioToolContext)
 * - isComposioTool and isComposioToolkitTool
 * - All 37 individual toolkit checkers
 * - getFeaturedActions
 * - getConnectedAppsSummary
 * - getComposioToolsForUser
 * - executeComposioTool
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// vi.hoisted — these run BEFORE vi.mock factories (which are hoisted)
// ---------------------------------------------------------------------------

const {
  mockIsComposioConfigured,
  mockGetConnectedAccounts,
  mockGetAvailableTools,
  mockExecuteTool,
  mockGetToolkitById,
} = vi.hoisted(() => ({
  mockIsComposioConfigured: vi.fn(() => false),
  mockGetConnectedAccounts: vi.fn(async () => [] as unknown[]),
  mockGetAvailableTools: vi.fn(async () => [] as unknown[]),
  mockExecuteTool: vi.fn(
    async () => ({ success: true, data: { ok: true } }) as Record<string, unknown>
  ),
  mockGetToolkitById: vi.fn((_id: string) => undefined as { displayName: string } | undefined),
}));

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('./client', () => ({
  isComposioConfigured: mockIsComposioConfigured,
  getConnectedAccounts: mockGetConnectedAccounts,
  getAvailableTools: mockGetAvailableTools,
  executeTool: mockExecuteTool,
}));

vi.mock('./toolkits', () => ({
  getToolkitById: mockGetToolkitById,
}));

// Generic toolkit mock factory — returns passthrough sort + stub prompts
function tkMock(prefix: string) {
  return {
    [`sortBy${prefix}Priority`]: vi.fn(<T>(tools: T[]) => tools),
    [`get${prefix}SystemPrompt`]: vi.fn(() => `\n### ${prefix} prompt\n`),
    [`log${prefix}ToolkitStats`]: vi.fn(),
    [`get${prefix}CapabilitySummary`]: vi.fn(() => `${prefix} capabilities`),
  };
}

vi.mock('./github-toolkit', () => ({
  ...tkMock('GitHub'),
  getGitHubActionNamesByPriority: vi.fn(() => []),
}));
vi.mock('./gmail-toolkit', () => ({
  ...tkMock('Gmail'),
  getGmailActionNamesByPriority: vi.fn(() => []),
}));
vi.mock('./outlook-toolkit', () => ({
  ...tkMock('Outlook'),
  getOutlookActionNamesByPriority: vi.fn(() => []),
}));
vi.mock('./slack-toolkit', () => ({
  ...tkMock('Slack'),
  getSlackActionNamesByPriority: vi.fn(() => []),
}));
vi.mock('./googlesheets-toolkit', () => ({
  ...tkMock('GoogleSheets'),
  getGoogleSheetsActionNamesByPriority: vi.fn(() => []),
}));
vi.mock('./discord-toolkit', () => ({
  ...tkMock('Discord'),
  getDiscordActionNamesByPriority: vi.fn(() => []),
}));
vi.mock('./googledocs-toolkit', () => ({
  ...tkMock('GoogleDocs'),
  getGoogleDocsActionNamesByPriority: vi.fn(() => []),
}));
vi.mock('./twitter-toolkit', () => ({
  ...tkMock('Twitter'),
  getTwitterActionNamesByPriority: vi.fn(() => []),
}));
vi.mock('./linkedin-toolkit', () => ({
  ...tkMock('LinkedIn'),
  getLinkedInActionNamesByPriority: vi.fn(() => []),
}));
vi.mock('./instagram-toolkit', () => ({
  ...tkMock('Instagram'),
  getInstagramActionNamesByPriority: vi.fn(() => []),
}));
vi.mock('./youtube-toolkit', () => ({
  ...tkMock('YouTube'),
  getYouTubeActionNamesByPriority: vi.fn(() => []),
}));
vi.mock('./vercel-toolkit', () => ({
  ...tkMock('Vercel'),
  getVercelActionNamesByPriority: vi.fn(() => []),
}));
vi.mock('./stripe-toolkit', () => ({
  ...tkMock('Stripe'),
  getStripeActionNamesByPriority: vi.fn(() => []),
}));
vi.mock('./googledrive-toolkit', () => ({
  ...tkMock('GoogleDrive'),
  getGoogleDriveActionNamesByPriority: vi.fn(() => []),
}));
vi.mock('./airtable-toolkit', () => ({
  ...tkMock('Airtable'),
  getAirtableActionNamesByPriority: vi.fn(() => []),
}));
vi.mock('./microsoftteams-toolkit', () => ({
  ...tkMock('MicrosoftTeams'),
  getMicrosoftTeamsActionNamesByPriority: vi.fn(() => []),
}));
vi.mock('./linear-toolkit', () => ({
  ...tkMock('Linear'),
  getLinearActionNamesByPriority: vi.fn(() => []),
}));
vi.mock('./googlecalendar-toolkit', () => ({
  ...tkMock('GoogleCalendar'),
  getGoogleCalendarActionNamesByPriority: vi.fn(() => []),
}));
vi.mock('./hubspot-toolkit', () => ({
  ...tkMock('HubSpot'),
  getHubSpotActionNamesByPriority: vi.fn(() => []),
}));
vi.mock('./salesforce-toolkit', () => ({
  ...tkMock('Salesforce'),
  getSalesforceActionNamesByPriority: vi.fn(() => []),
}));
vi.mock('./sentry-toolkit', () => ({
  ...tkMock('Sentry'),
  getSentryActionNamesByPriority: vi.fn(() => []),
}));
vi.mock('./supabase-toolkit', () => ({
  ...tkMock('Supabase'),
  getSupabaseActionNamesByPriority: vi.fn(() => []),
}));
vi.mock('./cloudflare-toolkit', () => ({
  ...tkMock('Cloudflare'),
  getCloudflareActionNamesByPriority: vi.fn(() => []),
}));
vi.mock('./reddit-toolkit', () => ({
  ...tkMock('Reddit'),
  getRedditActionNamesByPriority: vi.fn(() => []),
}));
vi.mock('./shopify-toolkit', () => ({
  ...tkMock('Shopify'),
  getShopifyActionNamesByPriority: vi.fn(() => []),
}));
vi.mock('./googleslides-toolkit', () => ({
  ...tkMock('GoogleSlides'),
  getGoogleSlidesActionNamesByPriority: vi.fn(() => []),
}));
vi.mock('./googletasks-toolkit', () => ({
  ...tkMock('GoogleTasks'),
  getGoogleTasksActionNamesByPriority: vi.fn(() => []),
}));
vi.mock('./googlemeet-toolkit', () => ({
  ...tkMock('GoogleMeet'),
  getGoogleMeetActionNamesByPriority: vi.fn(() => []),
}));
vi.mock('./googlephotos-toolkit', () => ({
  ...tkMock('GooglePhotos'),
  getGooglePhotosActionNamesByPriority: vi.fn(() => []),
}));
vi.mock('./googleanalytics-toolkit', () => ({
  ...tkMock('GoogleAnalytics'),
  getGoogleAnalyticsActionNamesByPriority: vi.fn(() => []),
}));
vi.mock('./googlesearchconsole-toolkit', () => ({
  ...tkMock('GoogleSearchConsole'),
  getGoogleSearchConsoleActionNamesByPriority: vi.fn(() => []),
}));
vi.mock('./googleads-toolkit', () => ({
  ...tkMock('GoogleAds'),
  getGoogleAdsActionNamesByPriority: vi.fn(() => []),
}));
vi.mock('./googlemaps-toolkit', () => ({
  ...tkMock('GoogleMaps'),
  getGoogleMapsActionNamesByPriority: vi.fn(() => []),
}));
vi.mock('./dropbox-toolkit', () => ({
  ...tkMock('Dropbox'),
  getDropboxActionNamesByPriority: vi.fn(() => []),
}));
vi.mock('./elevenlabs-toolkit', () => ({
  ...tkMock('ElevenLabs'),
  getElevenLabsActionNamesByPriority: vi.fn(() => []),
}));
vi.mock('./serpapi-toolkit', () => ({
  ...tkMock('SerpAPI'),
  getSerpAPIActionNamesByPriority: vi.fn(() => []),
}));
vi.mock('./perplexityai-toolkit', () => ({
  ...tkMock('PerplexityAI'),
  getPerplexityAIActionNamesByPriority: vi.fn(() => []),
}));

// ---------------------------------------------------------------------------
// Import the module under test AFTER all mocks are set up
// ---------------------------------------------------------------------------

import {
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
} from './chat-tools';

import type { ClaudeTool, ComposioToolContext } from './chat-tools';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('chat-tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsComposioConfigured.mockReturnValue(false);
    mockGetConnectedAccounts.mockResolvedValue([]);
    mockGetAvailableTools.mockResolvedValue([]);
    mockExecuteTool.mockResolvedValue({ success: true, data: { ok: true } });
    mockGetToolkitById.mockReturnValue(undefined);
  });

  // ========================================================================
  // Type checks
  // ========================================================================

  describe('exported types', () => {
    it('ClaudeTool interface is structurally correct', () => {
      const tool: ClaudeTool = {
        name: 'composio_GITHUB_CREATE_ISSUE',
        description: 'Create a GitHub issue',
        input_schema: {
          type: 'object',
          properties: { title: { type: 'string' } },
          required: ['title'],
        },
      };
      expect(tool.name).toBe('composio_GITHUB_CREATE_ISSUE');
      expect(tool.input_schema.type).toBe('object');
    });

    it('ComposioToolContext interface is structurally correct', () => {
      const ctx: ComposioToolContext = {
        connectedApps: ['github'],
        tools: [],
        systemPromptAddition: '',
        hasGitHub: true,
        hasGmail: false,
        hasOutlook: false,
        hasSlack: false,
      };
      expect(ctx.connectedApps).toContain('github');
      expect(ctx.hasGitHub).toBe(true);
    });
  });

  // ========================================================================
  // isComposioTool
  // ========================================================================

  describe('isComposioTool', () => {
    it('returns true for tool names starting with composio_', () => {
      expect(isComposioTool('composio_GITHUB_CREATE_ISSUE')).toBe(true);
      expect(isComposioTool('composio_GMAIL_SEND_EMAIL')).toBe(true);
    });

    it('returns false for non-composio tool names', () => {
      expect(isComposioTool('run_code')).toBe(false);
      expect(isComposioTool('COMPOSIO_UPPER')).toBe(false);
      expect(isComposioTool('')).toBe(false);
    });
  });

  // ========================================================================
  // isComposioToolkitTool
  // ========================================================================

  describe('isComposioToolkitTool', () => {
    it('matches the correct prefix', () => {
      expect(isComposioToolkitTool('composio_GITHUB_CREATE_ISSUE', 'GITHUB')).toBe(true);
      expect(isComposioToolkitTool('composio_GMAIL_SEND_EMAIL', 'GMAIL')).toBe(true);
    });

    it('does not match a different prefix', () => {
      expect(isComposioToolkitTool('composio_GITHUB_CREATE_ISSUE', 'GMAIL')).toBe(false);
    });

    it('does not match partial prefix', () => {
      expect(isComposioToolkitTool('composio_GIT_SOMETHING', 'GITHUB')).toBe(false);
    });
  });

  // ========================================================================
  // Individual toolkit checkers (37 total)
  // ========================================================================

  describe('individual toolkit checkers', () => {
    const checkers: Array<{
      fn: (name: string) => boolean;
      prefix: string;
      fnName: string;
    }> = [
      { fn: isComposioGitHubTool, prefix: 'composio_GITHUB_', fnName: 'isComposioGitHubTool' },
      { fn: isComposioGmailTool, prefix: 'composio_GMAIL_', fnName: 'isComposioGmailTool' },
      {
        fn: isComposioOutlookTool,
        prefix: 'composio_OUTLOOK_',
        fnName: 'isComposioOutlookTool',
      },
      { fn: isComposioSlackTool, prefix: 'composio_SLACK_', fnName: 'isComposioSlackTool' },
      {
        fn: isComposioGoogleSheetsTool,
        prefix: 'composio_GOOGLESHEETS_',
        fnName: 'isComposioGoogleSheetsTool',
      },
      {
        fn: isComposioDiscordTool,
        prefix: 'composio_DISCORD_',
        fnName: 'isComposioDiscordTool',
      },
      {
        fn: isComposioGoogleDocsTool,
        prefix: 'composio_GOOGLEDOCS_',
        fnName: 'isComposioGoogleDocsTool',
      },
      {
        fn: isComposioTwitterTool,
        prefix: 'composio_TWITTER_',
        fnName: 'isComposioTwitterTool',
      },
      {
        fn: isComposioLinkedInTool,
        prefix: 'composio_LINKEDIN_',
        fnName: 'isComposioLinkedInTool',
      },
      {
        fn: isComposioInstagramTool,
        prefix: 'composio_INSTAGRAM_',
        fnName: 'isComposioInstagramTool',
      },
      {
        fn: isComposioYouTubeTool,
        prefix: 'composio_YOUTUBE_',
        fnName: 'isComposioYouTubeTool',
      },
      { fn: isComposioVercelTool, prefix: 'composio_VERCEL_', fnName: 'isComposioVercelTool' },
      { fn: isComposioStripeTool, prefix: 'composio_STRIPE_', fnName: 'isComposioStripeTool' },
      {
        fn: isComposioGoogleDriveTool,
        prefix: 'composio_GOOGLEDRIVE_',
        fnName: 'isComposioGoogleDriveTool',
      },
      {
        fn: isComposioAirtableTool,
        prefix: 'composio_AIRTABLE_',
        fnName: 'isComposioAirtableTool',
      },
      {
        fn: isComposioMicrosoftTeamsTool,
        prefix: 'composio_MICROSOFTTEAMS_',
        fnName: 'isComposioMicrosoftTeamsTool',
      },
      { fn: isComposioLinearTool, prefix: 'composio_LINEAR_', fnName: 'isComposioLinearTool' },
      {
        fn: isComposioGoogleCalendarTool,
        prefix: 'composio_GOOGLECALENDAR_',
        fnName: 'isComposioGoogleCalendarTool',
      },
      {
        fn: isComposioHubSpotTool,
        prefix: 'composio_HUBSPOT_',
        fnName: 'isComposioHubSpotTool',
      },
      {
        fn: isComposioSalesforceTool,
        prefix: 'composio_SALESFORCE_',
        fnName: 'isComposioSalesforceTool',
      },
      { fn: isComposioSentryTool, prefix: 'composio_SENTRY_', fnName: 'isComposioSentryTool' },
      {
        fn: isComposioSupabaseTool,
        prefix: 'composio_SUPABASE_',
        fnName: 'isComposioSupabaseTool',
      },
      {
        fn: isComposioCloudfareTool,
        prefix: 'composio_CLOUDFLARE_',
        fnName: 'isComposioCloudfareTool',
      },
      { fn: isComposioRedditTool, prefix: 'composio_REDDIT_', fnName: 'isComposioRedditTool' },
      {
        fn: isComposioShopifyTool,
        prefix: 'composio_SHOPIFY_',
        fnName: 'isComposioShopifyTool',
      },
      {
        fn: isComposioGoogleSlidesTool,
        prefix: 'composio_GOOGLESLIDES_',
        fnName: 'isComposioGoogleSlidesTool',
      },
      {
        fn: isComposioGoogleTasksTool,
        prefix: 'composio_GOOGLETASKS_',
        fnName: 'isComposioGoogleTasksTool',
      },
      {
        fn: isComposioGoogleMeetTool,
        prefix: 'composio_GOOGLEMEET_',
        fnName: 'isComposioGoogleMeetTool',
      },
      {
        fn: isComposioGooglePhotosTool,
        prefix: 'composio_GOOGLEPHOTOS_',
        fnName: 'isComposioGooglePhotosTool',
      },
      {
        fn: isComposioGoogleAnalyticsTool,
        prefix: 'composio_GOOGLEANALYTICS_',
        fnName: 'isComposioGoogleAnalyticsTool',
      },
      {
        fn: isComposioGoogleSearchConsoleTool,
        prefix: 'composio_GOOGLESEARCHCONSOLE_',
        fnName: 'isComposioGoogleSearchConsoleTool',
      },
      {
        fn: isComposioGoogleAdsTool,
        prefix: 'composio_GOOGLEADS_',
        fnName: 'isComposioGoogleAdsTool',
      },
      {
        fn: isComposioGoogleMapsTool,
        prefix: 'composio_GOOGLEMAPS_',
        fnName: 'isComposioGoogleMapsTool',
      },
      {
        fn: isComposioDropboxTool,
        prefix: 'composio_DROPBOX_',
        fnName: 'isComposioDropboxTool',
      },
      {
        fn: isComposioElevenLabsTool,
        prefix: 'composio_ELEVENLABS_',
        fnName: 'isComposioElevenLabsTool',
      },
      {
        fn: isComposioSerpAPITool,
        prefix: 'composio_SERPAPI_',
        fnName: 'isComposioSerpAPITool',
      },
      {
        fn: isComposioPerplexityAITool,
        prefix: 'composio_PERPLEXITYAI_',
        fnName: 'isComposioPerplexityAITool',
      },
    ];

    for (const { fn, prefix, fnName } of checkers) {
      it(`${fnName} returns true for matching prefix`, () => {
        expect(fn(`${prefix}SOME_ACTION`)).toBe(true);
      });

      it(`${fnName} returns false for non-matching name`, () => {
        expect(fn('composio_OTHER_ACTION')).toBe(false);
        expect(fn('some_random_tool')).toBe(false);
      });
    }

    it('covers all 37 toolkit checkers', () => {
      expect(checkers.length).toBe(37);
    });
  });

  // ========================================================================
  // getFeaturedActions
  // ========================================================================

  describe('getFeaturedActions', () => {
    it('returns an object with string keys and string values', () => {
      const actions = getFeaturedActions();
      expect(typeof actions).toBe('object');
      for (const [key, value] of Object.entries(actions)) {
        expect(typeof key).toBe('string');
        expect(typeof value).toBe('string');
      }
    });

    it('contains common actions like tweet, slack, email, github', () => {
      const actions = getFeaturedActions();
      expect(actions['Post a tweet']).toBe('composio_TWITTER_CREATE_TWEET');
      expect(actions['Send a Slack message']).toBe(
        'composio_SLACK_SENDS_A_MESSAGE_TO_A_SLACK_CHANNEL'
      );
      expect(actions['Send an email']).toBe('composio_GMAIL_SEND_EMAIL');
      expect(actions['Create GitHub issue']).toBe('composio_GITHUB_CREATE_ISSUE');
    });

    it('all values start with composio_', () => {
      const actions = getFeaturedActions();
      for (const value of Object.values(actions)) {
        expect(value.startsWith('composio_')).toBe(true);
      }
    });

    it('returns a new object each call (not a shared reference)', () => {
      const a = getFeaturedActions();
      const b = getFeaturedActions();
      expect(a).toEqual(b);
      expect(a).not.toBe(b);
    });
  });

  // ========================================================================
  // getConnectedAppsSummary
  // ========================================================================

  describe('getConnectedAppsSummary', () => {
    it('returns empty string when Composio is not configured', async () => {
      mockIsComposioConfigured.mockReturnValue(false);
      const result = await getConnectedAppsSummary('user-1');
      expect(result).toBe('');
    });

    it('returns empty string when no connected accounts', async () => {
      mockIsComposioConfigured.mockReturnValue(true);
      mockGetConnectedAccounts.mockResolvedValue([]);
      const result = await getConnectedAppsSummary('user-1');
      expect(result).toBe('');
    });

    it('returns empty string when accounts exist but none are connected', async () => {
      mockIsComposioConfigured.mockReturnValue(true);
      mockGetConnectedAccounts.mockResolvedValue([
        { id: '1', toolkit: 'github', status: 'pending' },
      ]);
      const result = await getConnectedAppsSummary('user-1');
      expect(result).toBe('');
    });

    it('returns summary string with connected app display names', async () => {
      mockIsComposioConfigured.mockReturnValue(true);
      mockGetConnectedAccounts.mockResolvedValue([
        { id: '1', toolkit: 'github', status: 'connected' },
        { id: '2', toolkit: 'slack', status: 'connected' },
      ]);
      mockGetToolkitById.mockImplementation((id: string) => {
        if (id === 'github') return { displayName: 'GitHub' };
        if (id === 'slack') return { displayName: 'Slack' };
        return undefined;
      });

      const result = await getConnectedAppsSummary('user-1');
      expect(result).toContain('GitHub');
      expect(result).toContain('Slack');
      expect(result).toContain('AI automation');
    });

    it('falls back to toolkit id when getToolkitById returns undefined', async () => {
      mockIsComposioConfigured.mockReturnValue(true);
      mockGetConnectedAccounts.mockResolvedValue([
        { id: '1', toolkit: 'unknownapp', status: 'connected' },
      ]);
      mockGetToolkitById.mockReturnValue(undefined);

      const result = await getConnectedAppsSummary('user-1');
      expect(result).toContain('unknownapp');
    });

    it('returns empty string when getConnectedAccounts throws', async () => {
      mockIsComposioConfigured.mockReturnValue(true);
      mockGetConnectedAccounts.mockRejectedValue(new Error('network'));
      const result = await getConnectedAppsSummary('user-1');
      expect(result).toBe('');
    });
  });

  // ========================================================================
  // getComposioToolsForUser
  // ========================================================================

  describe('getComposioToolsForUser', () => {
    it('returns empty context when Composio is not configured', async () => {
      mockIsComposioConfigured.mockReturnValue(false);
      const ctx = await getComposioToolsForUser('user-1');
      expect(ctx.connectedApps).toEqual([]);
      expect(ctx.tools).toEqual([]);
      expect(ctx.systemPromptAddition).toBe('');
      expect(ctx.hasGitHub).toBe(false);
      expect(ctx.hasGmail).toBe(false);
      expect(ctx.hasOutlook).toBe(false);
      expect(ctx.hasSlack).toBe(false);
    });

    it('returns empty context when no connected apps', async () => {
      mockIsComposioConfigured.mockReturnValue(true);
      mockGetConnectedAccounts.mockResolvedValue([
        { id: '1', toolkit: 'github', status: 'pending' },
      ]);

      const ctx = await getComposioToolsForUser('user-1');
      expect(ctx.connectedApps).toEqual([]);
      expect(ctx.tools).toEqual([]);
    });

    it('returns empty context when getConnectedAccounts throws', async () => {
      mockIsComposioConfigured.mockReturnValue(true);
      mockGetConnectedAccounts.mockRejectedValue(new Error('network'));

      const ctx = await getComposioToolsForUser('user-1');
      expect(ctx.connectedApps).toEqual([]);
      expect(ctx.tools).toEqual([]);
      expect(ctx.hasGitHub).toBe(false);
    });

    it('detects GitHub connection and sets hasGitHub', async () => {
      mockIsComposioConfigured.mockReturnValue(true);
      mockGetConnectedAccounts.mockResolvedValue([
        { id: '1', toolkit: 'github', status: 'connected' },
      ]);
      mockGetAvailableTools.mockResolvedValue([
        {
          name: 'GITHUB_CREATE_ISSUE',
          description: 'Create issue',
          parameters: {
            type: 'object',
            properties: { title: { type: 'string', description: 'Issue title' } },
            required: ['title'],
          },
        },
      ]);

      const ctx = await getComposioToolsForUser('user-1');
      expect(ctx.hasGitHub).toBe(true);
      expect(ctx.connectedApps).toContain('github');
      expect(ctx.tools.length).toBeGreaterThanOrEqual(1);
      expect(ctx.tools[0].name).toBe('composio_GITHUB_CREATE_ISSUE');
    });

    it('detects Gmail connection and sets hasGmail', async () => {
      mockIsComposioConfigured.mockReturnValue(true);
      mockGetConnectedAccounts.mockResolvedValue([
        { id: '1', toolkit: 'gmail', status: 'connected' },
      ]);
      mockGetAvailableTools.mockResolvedValue([
        {
          name: 'GMAIL_SEND_EMAIL',
          description: 'Send email',
          parameters: { type: 'object', properties: {}, required: [] },
        },
      ]);

      const ctx = await getComposioToolsForUser('user-1');
      expect(ctx.hasGmail).toBe(true);
    });

    it('detects Outlook connection and sets hasOutlook', async () => {
      mockIsComposioConfigured.mockReturnValue(true);
      mockGetConnectedAccounts.mockResolvedValue([
        { id: '1', toolkit: 'microsoft_outlook', status: 'connected' },
      ]);
      mockGetAvailableTools.mockResolvedValue([]);

      const ctx = await getComposioToolsForUser('user-1');
      expect(ctx.hasOutlook).toBe(true);
    });

    it('detects Slack connection and sets hasSlack', async () => {
      mockIsComposioConfigured.mockReturnValue(true);
      mockGetConnectedAccounts.mockResolvedValue([
        { id: '1', toolkit: 'slack', status: 'connected' },
      ]);
      mockGetAvailableTools.mockResolvedValue([]);

      const ctx = await getComposioToolsForUser('user-1');
      expect(ctx.hasSlack).toBe(true);
    });

    it('system prompt includes connected app names and safety rules', async () => {
      mockIsComposioConfigured.mockReturnValue(true);
      mockGetConnectedAccounts.mockResolvedValue([
        { id: '1', toolkit: 'github', status: 'connected' },
        { id: '2', toolkit: 'slack', status: 'connected' },
      ]);
      mockGetAvailableTools.mockResolvedValue([
        {
          name: 'GITHUB_LIST_REPOS',
          description: 'List repos',
          parameters: { type: 'object', properties: {}, required: [] },
        },
        {
          name: 'SLACK_SEND_MSG',
          description: 'Send msg',
          parameters: { type: 'object', properties: {}, required: [] },
        },
      ]);
      mockGetToolkitById.mockImplementation((id: string) => {
        if (id === 'github') return { displayName: 'GitHub' };
        if (id === 'slack') return { displayName: 'Slack' };
        return undefined;
      });

      const ctx = await getComposioToolsForUser('user-1');
      expect(ctx.systemPromptAddition).toContain('Connected App Integrations');
      expect(ctx.systemPromptAddition).toContain('Safety Rules');
    });

    it('handles getAvailableTools failure gracefully', async () => {
      mockIsComposioConfigured.mockReturnValue(true);
      mockGetConnectedAccounts.mockResolvedValue([
        { id: '1', toolkit: 'github', status: 'connected' },
      ]);
      mockGetAvailableTools.mockRejectedValue(new Error('API error'));

      const ctx = await getComposioToolsForUser('user-1');
      expect(ctx.connectedApps).toContain('github');
      expect(ctx.hasGitHub).toBe(true);
      expect(ctx.tools).toEqual([]);
    });

    it('filters out tools with invalid names', async () => {
      mockIsComposioConfigured.mockReturnValue(true);
      mockGetConnectedAccounts.mockResolvedValue([
        { id: '1', toolkit: 'github', status: 'connected' },
      ]);
      mockGetAvailableTools.mockResolvedValue([
        {
          name: 'GITHUB_VALID_TOOL',
          description: 'Valid',
          parameters: { type: 'object', properties: {}, required: [] },
        },
        {
          name: 'GITHUB INVALID TOOL',
          description: 'Invalid (spaces)',
          parameters: { type: 'object', properties: {}, required: [] },
        },
        {
          name: '',
          description: 'Empty name',
          parameters: { type: 'object', properties: {}, required: [] },
        },
      ]);

      const ctx = await getComposioToolsForUser('user-1');
      const validTools = ctx.tools.filter((t) => t.name === 'composio_GITHUB_VALID_TOOL');
      expect(validTools.length).toBe(1);
      const invalidTools = ctx.tools.filter(
        (t) => t.name.includes('INVALID') || t.name === 'composio_'
      );
      expect(invalidTools.length).toBe(0);
    });

    it('sanitizes tool parameter schemas correctly', async () => {
      mockIsComposioConfigured.mockReturnValue(true);
      mockGetConnectedAccounts.mockResolvedValue([
        { id: '1', toolkit: 'github', status: 'connected' },
      ]);
      mockGetAvailableTools.mockResolvedValue([
        {
          name: 'GITHUB_CREATE_ISSUE',
          description: 'Create issue',
          parameters: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Issue title' },
              labels: { type: 'array', items: { type: 'string' }, description: 'Labels' },
              priority: { type: 'integer', enum: [1, 2, 3], default: 2 },
              '123invalid': { type: 'string' },
            },
            required: ['title', '123invalid', 'nonexistent'],
          },
        },
      ]);

      const ctx = await getComposioToolsForUser('user-1');
      const tool = ctx.tools.find((t) => t.name === 'composio_GITHUB_CREATE_ISSUE');
      expect(tool).toBeDefined();
      expect(tool!.input_schema.properties.title).toBeDefined();
      expect(tool!.input_schema.properties.labels).toBeDefined();
      expect(tool!.input_schema.properties.priority).toBeDefined();
      expect(tool!.input_schema.properties['123invalid']).toBeUndefined();
      expect(tool!.input_schema.required).toContain('title');
      expect(tool!.input_schema.required).not.toContain('123invalid');
      expect(tool!.input_schema.required).not.toContain('nonexistent');
    });

    it('defaults description when tool has no description', async () => {
      mockIsComposioConfigured.mockReturnValue(true);
      mockGetConnectedAccounts.mockResolvedValue([
        { id: '1', toolkit: 'discord', status: 'connected' },
      ]);
      mockGetAvailableTools.mockResolvedValue([
        {
          name: 'DISCORD_SEND_MESSAGE',
          description: '',
          parameters: { type: 'object', properties: {}, required: [] },
        },
      ]);

      const ctx = await getComposioToolsForUser('user-1');
      const tool = ctx.tools.find((t) => t.name === 'composio_DISCORD_SEND_MESSAGE');
      expect(tool).toBeDefined();
      expect(tool!.description).toContain('Action:');
    });

    it('caps tools per toolkit according to registry cap', async () => {
      mockIsComposioConfigured.mockReturnValue(true);
      mockGetConnectedAccounts.mockResolvedValue([
        { id: '1', toolkit: 'discord', status: 'connected' },
      ]);

      // Generate 20 tools - Discord cap is 15
      const tools = Array.from({ length: 20 }, (_, i) => ({
        name: `DISCORD_ACTION_${i}`,
        description: `Action ${i}`,
        parameters: { type: 'object' as const, properties: {}, required: [] },
      }));
      mockGetAvailableTools.mockResolvedValue(tools);

      const ctx = await getComposioToolsForUser('user-1');
      const discordTools = ctx.tools.filter((t) => t.name.startsWith('composio_DISCORD_'));
      expect(discordTools.length).toBeLessThanOrEqual(15);
    });
  });

  // ========================================================================
  // executeComposioTool
  // ========================================================================

  describe('executeComposioTool', () => {
    it('strips composio_ prefix and calls executeTool', async () => {
      const result = await executeComposioTool('user-1', 'composio_GITHUB_CREATE_ISSUE', {
        title: 'Bug',
      });
      expect(mockExecuteTool).toHaveBeenCalledWith('user-1', 'GITHUB_CREATE_ISSUE', {
        title: 'Bug',
      });
      expect(result.success).toBe(true);
      expect(result.result).toEqual({ ok: true });
    });

    it('returns error when executeTool returns failure', async () => {
      mockExecuteTool.mockResolvedValue({ success: false, error: 'Rate limited' });

      const result = await executeComposioTool('user-1', 'composio_SLACK_SEND', {});
      expect(result.success).toBe(false);
      expect(result.error).toBe('Rate limited');
    });

    it('returns default error message when failure has no error string', async () => {
      mockExecuteTool.mockResolvedValue({ success: false });

      const result = await executeComposioTool('user-1', 'composio_SLACK_SEND', {});
      expect(result.success).toBe(false);
      expect(result.error).toBe('Tool execution failed');
    });

    it('handles thrown Error from executeTool', async () => {
      mockExecuteTool.mockRejectedValue(new Error('Connection timeout'));

      const result = await executeComposioTool('user-1', 'composio_GMAIL_SEND_EMAIL', {});
      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection timeout');
    });

    it('handles non-Error thrown values', async () => {
      mockExecuteTool.mockRejectedValue('string error');

      const result = await executeComposioTool('user-1', 'composio_GMAIL_SEND_EMAIL', {});
      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error');
    });

    it('works with toolName that has no composio_ prefix', async () => {
      await executeComposioTool('user-1', 'GITHUB_CREATE_ISSUE', { title: 'Test' });
      expect(mockExecuteTool).toHaveBeenCalledWith('user-1', 'GITHUB_CREATE_ISSUE', {
        title: 'Test',
      });
    });
  });

  // ========================================================================
  // Export existence / type checks
  // ========================================================================

  describe('all exports exist and are the correct type', () => {
    it('getComposioToolsForUser is a function', () => {
      expect(typeof getComposioToolsForUser).toBe('function');
    });

    it('executeComposioTool is a function', () => {
      expect(typeof executeComposioTool).toBe('function');
    });

    it('isComposioTool is a function', () => {
      expect(typeof isComposioTool).toBe('function');
    });

    it('isComposioToolkitTool is a function', () => {
      expect(typeof isComposioToolkitTool).toBe('function');
    });

    it('getConnectedAppsSummary is a function', () => {
      expect(typeof getConnectedAppsSummary).toBe('function');
    });

    it('getFeaturedActions is a function', () => {
      expect(typeof getFeaturedActions).toBe('function');
    });
  });
});
