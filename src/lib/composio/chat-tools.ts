/**
 * COMPOSIO CHAT TOOLS
 * ===================
 *
 * Integrates Composio app connections with Claude's tool system.
 * Allows AI to use connected apps (Twitter, Slack, GitHub, Gmail, etc.) as tools.
 *
 * Uses a registry-based approach where each toolkit declares:
 * - Tool prefix for routing (e.g., composio_GITHUB_)
 * - Tool cap (budget per toolkit)
 * - Priority sort function
 * - System prompt injection
 *
 * Supported Toolkits (37):
 * - GitHub, Gmail, Outlook, Slack
 * - Google Sheets, Discord, Google Docs
 * - Twitter, LinkedIn, Instagram, YouTube
 * - Vercel, Stripe, Google Drive, Airtable
 * - Microsoft Teams, Linear, Google Calendar
 * - HubSpot, Salesforce, Sentry, Supabase
 * - Cloudflare, Reddit, Shopify
 * - Google Slides, Google Tasks, Google Meet
 * - Google Photos, Google Analytics
 * - Google Search Console, Google Ads, Google Maps
 * - Dropbox, ElevenLabs, SerpAPI, Perplexity AI
 */

import { logger } from '@/lib/logger';
import {
  getConnectedAccounts,
  getAvailableTools,
  executeTool,
  isComposioConfigured,
} from './client';
import { getToolkitById } from './toolkits';
import type { ComposioTool } from './types';

// Original 4 toolkit imports
import {
  sortByGitHubPriority,
  getGitHubSystemPrompt,
  logGitHubToolkitStats,
  getGitHubCapabilitySummary,
} from './github-toolkit';
import {
  sortByGmailPriority,
  getGmailSystemPrompt,
  logGmailToolkitStats,
  getGmailCapabilitySummary,
} from './gmail-toolkit';
import {
  sortByOutlookPriority,
  getOutlookSystemPrompt,
  logOutlookToolkitStats,
  getOutlookCapabilitySummary,
} from './outlook-toolkit';
import {
  sortBySlackPriority,
  getSlackSystemPrompt,
  logSlackToolkitStats,
  getSlackCapabilitySummary,
} from './slack-toolkit';

// New toolkit imports
import {
  sortByGoogleSheetsPriority,
  getGoogleSheetsSystemPrompt,
  logGoogleSheetsToolkitStats,
  getGoogleSheetsCapabilitySummary,
} from './googlesheets-toolkit';
import {
  sortByDiscordPriority,
  getDiscordSystemPrompt,
  logDiscordToolkitStats,
  getDiscordCapabilitySummary,
} from './discord-toolkit';
import {
  sortByGoogleDocsPriority,
  getGoogleDocsSystemPrompt,
  logGoogleDocsToolkitStats,
  getGoogleDocsCapabilitySummary,
} from './googledocs-toolkit';
import {
  sortByTwitterPriority,
  getTwitterSystemPrompt,
  logTwitterToolkitStats,
  getTwitterCapabilitySummary,
} from './twitter-toolkit';
import {
  sortByLinkedInPriority,
  getLinkedInSystemPrompt,
  logLinkedInToolkitStats,
  getLinkedInCapabilitySummary,
} from './linkedin-toolkit';
import {
  sortByInstagramPriority,
  getInstagramSystemPrompt,
  logInstagramToolkitStats,
  getInstagramCapabilitySummary,
} from './instagram-toolkit';
import {
  sortByYouTubePriority,
  getYouTubeSystemPrompt,
  logYouTubeToolkitStats,
  getYouTubeCapabilitySummary,
} from './youtube-toolkit';
import {
  sortByVercelPriority,
  getVercelSystemPrompt,
  logVercelToolkitStats,
  getVercelCapabilitySummary,
} from './vercel-toolkit';
import {
  sortByStripePriority,
  getStripeSystemPrompt,
  logStripeToolkitStats,
  getStripeCapabilitySummary,
} from './stripe-toolkit';
import {
  sortByGoogleDrivePriority,
  getGoogleDriveSystemPrompt,
  logGoogleDriveToolkitStats,
  getGoogleDriveCapabilitySummary,
} from './googledrive-toolkit';
import {
  sortByAirtablePriority,
  getAirtableSystemPrompt,
  logAirtableToolkitStats,
  getAirtableCapabilitySummary,
} from './airtable-toolkit';
import {
  sortByMicrosoftTeamsPriority,
  getMicrosoftTeamsSystemPrompt,
  logMicrosoftTeamsToolkitStats,
  getMicrosoftTeamsCapabilitySummary,
} from './microsoftteams-toolkit';
import {
  sortByLinearPriority,
  getLinearSystemPrompt,
  logLinearToolkitStats,
  getLinearCapabilitySummary,
} from './linear-toolkit';
import {
  sortByGoogleCalendarPriority,
  getGoogleCalendarSystemPrompt,
  logGoogleCalendarToolkitStats,
  getGoogleCalendarCapabilitySummary,
} from './googlecalendar-toolkit';
import {
  sortByHubSpotPriority,
  getHubSpotSystemPrompt,
  logHubSpotToolkitStats,
  getHubSpotCapabilitySummary,
} from './hubspot-toolkit';
import {
  sortBySalesforcePriority,
  getSalesforceSystemPrompt,
  logSalesforceToolkitStats,
  getSalesforceCapabilitySummary,
} from './salesforce-toolkit';
import {
  sortBySentryPriority,
  getSentrySystemPrompt,
  logSentryToolkitStats,
  getSentryCapabilitySummary,
} from './sentry-toolkit';
import {
  sortBySupabasePriority,
  getSupabaseSystemPrompt,
  logSupabaseToolkitStats,
  getSupabaseCapabilitySummary,
} from './supabase-toolkit';
import {
  sortByCloudflarePriority,
  getCloudflareSystemPrompt,
  logCloudflareToolkitStats,
  getCloudflareCapabilitySummary,
} from './cloudflare-toolkit';
import {
  sortByRedditPriority,
  getRedditSystemPrompt,
  logRedditToolkitStats,
  getRedditCapabilitySummary,
} from './reddit-toolkit';
import {
  sortByShopifyPriority,
  getShopifySystemPrompt,
  logShopifyToolkitStats,
  getShopifyCapabilitySummary,
} from './shopify-toolkit';
import {
  sortByGoogleSlidesPriority,
  getGoogleSlidesSystemPrompt,
  logGoogleSlidesToolkitStats,
  getGoogleSlidesCapabilitySummary,
} from './googleslides-toolkit';
import {
  sortByGoogleTasksPriority,
  getGoogleTasksSystemPrompt,
  logGoogleTasksToolkitStats,
  getGoogleTasksCapabilitySummary,
} from './googletasks-toolkit';
import {
  sortByGoogleMeetPriority,
  getGoogleMeetSystemPrompt,
  logGoogleMeetToolkitStats,
  getGoogleMeetCapabilitySummary,
} from './googlemeet-toolkit';
import {
  sortByGooglePhotosPriority,
  getGooglePhotosSystemPrompt,
  logGooglePhotosToolkitStats,
  getGooglePhotosCapabilitySummary,
} from './googlephotos-toolkit';
import {
  sortByGoogleAnalyticsPriority,
  getGoogleAnalyticsSystemPrompt,
  logGoogleAnalyticsToolkitStats,
  getGoogleAnalyticsCapabilitySummary,
} from './googleanalytics-toolkit';
import {
  sortByGoogleSearchConsolePriority,
  getGoogleSearchConsoleSystemPrompt,
  logGoogleSearchConsoleToolkitStats,
  getGoogleSearchConsoleCapabilitySummary,
} from './googlesearchconsole-toolkit';
import {
  sortByGoogleAdsPriority,
  getGoogleAdsSystemPrompt,
  logGoogleAdsToolkitStats,
  getGoogleAdsCapabilitySummary,
} from './googleads-toolkit';
import {
  sortByGoogleMapsPriority,
  getGoogleMapsSystemPrompt,
  logGoogleMapsToolkitStats,
  getGoogleMapsCapabilitySummary,
} from './googlemaps-toolkit';
import {
  sortByDropboxPriority,
  getDropboxSystemPrompt,
  logDropboxToolkitStats,
  getDropboxCapabilitySummary,
} from './dropbox-toolkit';
import {
  sortByElevenLabsPriority,
  getElevenLabsSystemPrompt,
  logElevenLabsToolkitStats,
  getElevenLabsCapabilitySummary,
} from './elevenlabs-toolkit';
import {
  sortBySerpAPIPriority,
  getSerpAPISystemPrompt,
  logSerpAPIToolkitStats,
  getSerpAPICapabilitySummary,
} from './serpapi-toolkit';
import {
  sortByPerplexityAIPriority,
  getPerplexityAISystemPrompt,
  logPerplexityAIToolkitStats,
  getPerplexityAICapabilitySummary,
} from './perplexityai-toolkit';

const log = logger('ComposioTools');

// ============================================================================
// TYPES
// ============================================================================

export interface ClaudeTool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface ComposioToolContext {
  connectedApps: string[];
  tools: ClaudeTool[];
  systemPromptAddition: string;
  hasGitHub: boolean; // Whether GitHub is connected via Composio
  hasGmail: boolean; // Whether Gmail is connected via Composio
  hasOutlook: boolean; // Whether Outlook is connected via Composio
  hasSlack: boolean; // Whether Slack is connected via Composio
}

// ============================================================================
// TOOLKIT REGISTRY
// ============================================================================

interface ToolkitIntegration {
  id: string; // Internal ID (e.g., 'GITHUB')
  displayName: string; // Human-readable name
  prefix: string; // Tool name prefix (e.g., 'composio_GITHUB_')
  cap: number; // Max tools to load
  appMatchers: string[]; // Normalized app names to match (lowercase, no separators)
  sortFn: <T extends { name: string }>(tools: T[]) => T[];
  systemPromptFn: () => string;
  logStatsFn: () => void;
  capabilitySummaryFn: () => string;
}

// Default cap for non-toolkit-specific Composio tools per session
const MAX_COMPOSIO_TOOLS_DEFAULT = 50;

/**
 * All supported toolkit integrations.
 * Each toolkit gets its own tool budget, priority sorting, and system prompt.
 */
const TOOLKIT_REGISTRY: ToolkitIntegration[] = [
  // ==================== ORIGINAL 4 ====================
  {
    id: 'GITHUB',
    displayName: 'GitHub',
    prefix: 'composio_GITHUB_',
    cap: 100,
    appMatchers: ['github'],
    sortFn: sortByGitHubPriority,
    systemPromptFn: getGitHubSystemPrompt,
    logStatsFn: logGitHubToolkitStats,
    capabilitySummaryFn: getGitHubCapabilitySummary,
  },
  {
    id: 'GMAIL',
    displayName: 'Gmail',
    prefix: 'composio_GMAIL_',
    cap: 40,
    appMatchers: ['gmail'],
    sortFn: sortByGmailPriority,
    systemPromptFn: getGmailSystemPrompt,
    logStatsFn: logGmailToolkitStats,
    capabilitySummaryFn: getGmailCapabilitySummary,
  },
  {
    id: 'MICROSOFT_OUTLOOK',
    displayName: 'Outlook',
    prefix: 'composio_OUTLOOK_',
    cap: 64,
    appMatchers: ['microsoftoutlook', 'outlook'],
    sortFn: sortByOutlookPriority,
    systemPromptFn: getOutlookSystemPrompt,
    logStatsFn: logOutlookToolkitStats,
    capabilitySummaryFn: getOutlookCapabilitySummary,
  },
  {
    id: 'SLACK',
    displayName: 'Slack',
    prefix: 'composio_SLACK_',
    cap: 80,
    appMatchers: ['slack'],
    sortFn: sortBySlackPriority,
    systemPromptFn: getSlackSystemPrompt,
    logStatsFn: logSlackToolkitStats,
    capabilitySummaryFn: getSlackCapabilitySummary,
  },

  // ==================== NEW 11 TOOLKITS ====================
  {
    id: 'GOOGLE_SHEETS',
    displayName: 'Google Sheets',
    prefix: 'composio_GOOGLESHEETS_',
    cap: 44,
    appMatchers: ['googlesheets'],
    sortFn: sortByGoogleSheetsPriority,
    systemPromptFn: getGoogleSheetsSystemPrompt,
    logStatsFn: logGoogleSheetsToolkitStats,
    capabilitySummaryFn: getGoogleSheetsCapabilitySummary,
  },
  {
    id: 'DISCORD',
    displayName: 'Discord',
    prefix: 'composio_DISCORD_',
    cap: 15,
    appMatchers: ['discord'],
    sortFn: sortByDiscordPriority,
    systemPromptFn: getDiscordSystemPrompt,
    logStatsFn: logDiscordToolkitStats,
    capabilitySummaryFn: getDiscordCapabilitySummary,
  },
  {
    id: 'GOOGLE_DOCS',
    displayName: 'Google Docs',
    prefix: 'composio_GOOGLEDOCS_',
    cap: 35,
    appMatchers: ['googledocs'],
    sortFn: sortByGoogleDocsPriority,
    systemPromptFn: getGoogleDocsSystemPrompt,
    logStatsFn: logGoogleDocsToolkitStats,
    capabilitySummaryFn: getGoogleDocsCapabilitySummary,
  },
  {
    id: 'TWITTER',
    displayName: 'Twitter/X',
    prefix: 'composio_TWITTER_',
    cap: 75,
    appMatchers: ['twitter', 'twitterx', 'x'],
    sortFn: sortByTwitterPriority,
    systemPromptFn: getTwitterSystemPrompt,
    logStatsFn: logTwitterToolkitStats,
    capabilitySummaryFn: getTwitterCapabilitySummary,
  },
  {
    id: 'LINKEDIN',
    displayName: 'LinkedIn',
    prefix: 'composio_LINKEDIN_',
    cap: 11,
    appMatchers: ['linkedin'],
    sortFn: sortByLinkedInPriority,
    systemPromptFn: getLinkedInSystemPrompt,
    logStatsFn: logLinkedInToolkitStats,
    capabilitySummaryFn: getLinkedInCapabilitySummary,
  },
  {
    id: 'INSTAGRAM',
    displayName: 'Instagram',
    prefix: 'composio_INSTAGRAM_',
    cap: 32,
    appMatchers: ['instagram'],
    sortFn: sortByInstagramPriority,
    systemPromptFn: getInstagramSystemPrompt,
    logStatsFn: logInstagramToolkitStats,
    capabilitySummaryFn: getInstagramCapabilitySummary,
  },
  {
    id: 'YOUTUBE',
    displayName: 'YouTube',
    prefix: 'composio_YOUTUBE_',
    cap: 24,
    appMatchers: ['youtube'],
    sortFn: sortByYouTubePriority,
    systemPromptFn: getYouTubeSystemPrompt,
    logStatsFn: logYouTubeToolkitStats,
    capabilitySummaryFn: getYouTubeCapabilitySummary,
  },
  {
    id: 'VERCEL',
    displayName: 'Vercel',
    prefix: 'composio_VERCEL_',
    cap: 50,
    appMatchers: ['vercel'],
    sortFn: sortByVercelPriority,
    systemPromptFn: getVercelSystemPrompt,
    logStatsFn: logVercelToolkitStats,
    capabilitySummaryFn: getVercelCapabilitySummary,
  },
  {
    id: 'STRIPE',
    displayName: 'Stripe',
    prefix: 'composio_STRIPE_',
    cap: 80,
    appMatchers: ['stripe'],
    sortFn: sortByStripePriority,
    systemPromptFn: getStripeSystemPrompt,
    logStatsFn: logStripeToolkitStats,
    capabilitySummaryFn: getStripeCapabilitySummary,
  },
  {
    id: 'GOOGLE_DRIVE',
    displayName: 'Google Drive',
    prefix: 'composio_GOOGLEDRIVE_',
    cap: 59,
    appMatchers: ['googledrive'],
    sortFn: sortByGoogleDrivePriority,
    systemPromptFn: getGoogleDriveSystemPrompt,
    logStatsFn: logGoogleDriveToolkitStats,
    capabilitySummaryFn: getGoogleDriveCapabilitySummary,
  },
  {
    id: 'AIRTABLE',
    displayName: 'Airtable',
    prefix: 'composio_AIRTABLE_',
    cap: 26,
    appMatchers: ['airtable'],
    sortFn: sortByAirtablePriority,
    systemPromptFn: getAirtableSystemPrompt,
    logStatsFn: logAirtableToolkitStats,
    capabilitySummaryFn: getAirtableCapabilitySummary,
  },

  // ==================== NEW 22 TOOLKITS ====================
  {
    id: 'MICROSOFT_TEAMS',
    displayName: 'Microsoft Teams',
    prefix: 'composio_MICROSOFTTEAMS_',
    cap: 40,
    appMatchers: ['microsoftteams', 'msteams', 'teams'],
    sortFn: sortByMicrosoftTeamsPriority,
    systemPromptFn: getMicrosoftTeamsSystemPrompt,
    logStatsFn: logMicrosoftTeamsToolkitStats,
    capabilitySummaryFn: getMicrosoftTeamsCapabilitySummary,
  },
  {
    id: 'LINEAR',
    displayName: 'Linear',
    prefix: 'composio_LINEAR_',
    cap: 45,
    appMatchers: ['linear'],
    sortFn: sortByLinearPriority,
    systemPromptFn: getLinearSystemPrompt,
    logStatsFn: logLinearToolkitStats,
    capabilitySummaryFn: getLinearCapabilitySummary,
  },
  {
    id: 'GOOGLE_CALENDAR',
    displayName: 'Google Calendar',
    prefix: 'composio_GOOGLECALENDAR_',
    cap: 30,
    appMatchers: ['googlecalendar'],
    sortFn: sortByGoogleCalendarPriority,
    systemPromptFn: getGoogleCalendarSystemPrompt,
    logStatsFn: logGoogleCalendarToolkitStats,
    capabilitySummaryFn: getGoogleCalendarCapabilitySummary,
  },
  {
    id: 'HUBSPOT',
    displayName: 'HubSpot',
    prefix: 'composio_HUBSPOT_',
    cap: 45,
    appMatchers: ['hubspot'],
    sortFn: sortByHubSpotPriority,
    systemPromptFn: getHubSpotSystemPrompt,
    logStatsFn: logHubSpotToolkitStats,
    capabilitySummaryFn: getHubSpotCapabilitySummary,
  },
  {
    id: 'SALESFORCE',
    displayName: 'Salesforce',
    prefix: 'composio_SALESFORCE_',
    cap: 45,
    appMatchers: ['salesforce'],
    sortFn: sortBySalesforcePriority,
    systemPromptFn: getSalesforceSystemPrompt,
    logStatsFn: logSalesforceToolkitStats,
    capabilitySummaryFn: getSalesforceCapabilitySummary,
  },
  {
    id: 'SENTRY',
    displayName: 'Sentry',
    prefix: 'composio_SENTRY_',
    cap: 30,
    appMatchers: ['sentry'],
    sortFn: sortBySentryPriority,
    systemPromptFn: getSentrySystemPrompt,
    logStatsFn: logSentryToolkitStats,
    capabilitySummaryFn: getSentryCapabilitySummary,
  },
  {
    id: 'SUPABASE',
    displayName: 'Supabase',
    prefix: 'composio_SUPABASE_',
    cap: 30,
    appMatchers: ['supabase'],
    sortFn: sortBySupabasePriority,
    systemPromptFn: getSupabaseSystemPrompt,
    logStatsFn: logSupabaseToolkitStats,
    capabilitySummaryFn: getSupabaseCapabilitySummary,
  },
  {
    id: 'CLOUDFLARE',
    displayName: 'Cloudflare',
    prefix: 'composio_CLOUDFLARE_',
    cap: 30,
    appMatchers: ['cloudflare'],
    sortFn: sortByCloudflarePriority,
    systemPromptFn: getCloudflareSystemPrompt,
    logStatsFn: logCloudflareToolkitStats,
    capabilitySummaryFn: getCloudflareCapabilitySummary,
  },
  {
    id: 'REDDIT',
    displayName: 'Reddit',
    prefix: 'composio_REDDIT_',
    cap: 28,
    appMatchers: ['reddit'],
    sortFn: sortByRedditPriority,
    systemPromptFn: getRedditSystemPrompt,
    logStatsFn: logRedditToolkitStats,
    capabilitySummaryFn: getRedditCapabilitySummary,
  },
  {
    id: 'SHOPIFY',
    displayName: 'Shopify',
    prefix: 'composio_SHOPIFY_',
    cap: 40,
    appMatchers: ['shopify'],
    sortFn: sortByShopifyPriority,
    systemPromptFn: getShopifySystemPrompt,
    logStatsFn: logShopifyToolkitStats,
    capabilitySummaryFn: getShopifyCapabilitySummary,
  },
  {
    id: 'GOOGLE_SLIDES',
    displayName: 'Google Slides',
    prefix: 'composio_GOOGLESLIDES_',
    cap: 22,
    appMatchers: ['googleslides'],
    sortFn: sortByGoogleSlidesPriority,
    systemPromptFn: getGoogleSlidesSystemPrompt,
    logStatsFn: logGoogleSlidesToolkitStats,
    capabilitySummaryFn: getGoogleSlidesCapabilitySummary,
  },
  {
    id: 'GOOGLE_TASKS',
    displayName: 'Google Tasks',
    prefix: 'composio_GOOGLETASKS_',
    cap: 16,
    appMatchers: ['googletasks'],
    sortFn: sortByGoogleTasksPriority,
    systemPromptFn: getGoogleTasksSystemPrompt,
    logStatsFn: logGoogleTasksToolkitStats,
    capabilitySummaryFn: getGoogleTasksCapabilitySummary,
  },
  {
    id: 'GOOGLE_MEET',
    displayName: 'Google Meet',
    prefix: 'composio_GOOGLEMEET_',
    cap: 16,
    appMatchers: ['googlemeet'],
    sortFn: sortByGoogleMeetPriority,
    systemPromptFn: getGoogleMeetSystemPrompt,
    logStatsFn: logGoogleMeetToolkitStats,
    capabilitySummaryFn: getGoogleMeetCapabilitySummary,
  },
  {
    id: 'GOOGLE_PHOTOS',
    displayName: 'Google Photos',
    prefix: 'composio_GOOGLEPHOTOS_',
    cap: 16,
    appMatchers: ['googlephotos'],
    sortFn: sortByGooglePhotosPriority,
    systemPromptFn: getGooglePhotosSystemPrompt,
    logStatsFn: logGooglePhotosToolkitStats,
    capabilitySummaryFn: getGooglePhotosCapabilitySummary,
  },
  {
    id: 'GOOGLE_ANALYTICS',
    displayName: 'Google Analytics',
    prefix: 'composio_GOOGLEANALYTICS_',
    cap: 20,
    appMatchers: ['googleanalytics'],
    sortFn: sortByGoogleAnalyticsPriority,
    systemPromptFn: getGoogleAnalyticsSystemPrompt,
    logStatsFn: logGoogleAnalyticsToolkitStats,
    capabilitySummaryFn: getGoogleAnalyticsCapabilitySummary,
  },
  {
    id: 'GOOGLE_SEARCH_CONSOLE',
    displayName: 'Google Search Console',
    prefix: 'composio_GOOGLESEARCHCONSOLE_',
    cap: 16,
    appMatchers: ['googlesearchconsole'],
    sortFn: sortByGoogleSearchConsolePriority,
    systemPromptFn: getGoogleSearchConsoleSystemPrompt,
    logStatsFn: logGoogleSearchConsoleToolkitStats,
    capabilitySummaryFn: getGoogleSearchConsoleCapabilitySummary,
  },
  {
    id: 'GOOGLE_ADS',
    displayName: 'Google Ads',
    prefix: 'composio_GOOGLEADS_',
    cap: 24,
    appMatchers: ['googleads'],
    sortFn: sortByGoogleAdsPriority,
    systemPromptFn: getGoogleAdsSystemPrompt,
    logStatsFn: logGoogleAdsToolkitStats,
    capabilitySummaryFn: getGoogleAdsCapabilitySummary,
  },
  {
    id: 'GOOGLE_MAPS',
    displayName: 'Google Maps',
    prefix: 'composio_GOOGLEMAPS_',
    cap: 14,
    appMatchers: ['googlemaps'],
    sortFn: sortByGoogleMapsPriority,
    systemPromptFn: getGoogleMapsSystemPrompt,
    logStatsFn: logGoogleMapsToolkitStats,
    capabilitySummaryFn: getGoogleMapsCapabilitySummary,
  },
  {
    id: 'DROPBOX',
    displayName: 'Dropbox',
    prefix: 'composio_DROPBOX_',
    cap: 24,
    appMatchers: ['dropbox'],
    sortFn: sortByDropboxPriority,
    systemPromptFn: getDropboxSystemPrompt,
    logStatsFn: logDropboxToolkitStats,
    capabilitySummaryFn: getDropboxCapabilitySummary,
  },
  {
    id: 'ELEVENLABS',
    displayName: 'ElevenLabs',
    prefix: 'composio_ELEVENLABS_',
    cap: 16,
    appMatchers: ['elevenlabs'],
    sortFn: sortByElevenLabsPriority,
    systemPromptFn: getElevenLabsSystemPrompt,
    logStatsFn: logElevenLabsToolkitStats,
    capabilitySummaryFn: getElevenLabsCapabilitySummary,
  },
  {
    id: 'SERPAPI',
    displayName: 'SerpAPI',
    prefix: 'composio_SERPAPI_',
    cap: 14,
    appMatchers: ['serpapi'],
    sortFn: sortBySerpAPIPriority,
    systemPromptFn: getSerpAPISystemPrompt,
    logStatsFn: logSerpAPIToolkitStats,
    capabilitySummaryFn: getSerpAPICapabilitySummary,
  },
  {
    id: 'PERPLEXITY_AI',
    displayName: 'Perplexity AI',
    prefix: 'composio_PERPLEXITYAI_',
    cap: 10,
    appMatchers: ['perplexityai', 'perplexity'],
    sortFn: sortByPerplexityAIPriority,
    systemPromptFn: getPerplexityAISystemPrompt,
    logStatsFn: logPerplexityAIToolkitStats,
    capabilitySummaryFn: getPerplexityAICapabilitySummary,
  },
];

/**
 * Check if a connected app matches a toolkit registration
 */
function appMatchesToolkit(appName: string, toolkit: ToolkitIntegration): boolean {
  const normalized = appName.toLowerCase().replace(/[_\-\s]/g, '');
  return toolkit.appMatchers.some((m) => normalized === m);
}

// ============================================================================
// TOOL CONVERSION
// ============================================================================

/**
 * Sanitize and validate a JSON Schema property definition
 * Ensures properties conform to Anthropic's expected format
 */
function sanitizeSchemaProperty(key: string, prop: unknown): Record<string, unknown> | null {
  if (!prop || typeof prop !== 'object') {
    return null;
  }

  const p = prop as Record<string, unknown>;
  const sanitized: Record<string, unknown> = {};

  // Type is required - default to 'string' if missing
  const validTypes = ['string', 'number', 'integer', 'boolean', 'array', 'object', 'null'];
  let propType = String(p.type || 'string').toLowerCase();

  // Handle invalid or missing types
  if (!validTypes.includes(propType)) {
    log.warn('Invalid property type, defaulting to string', { key, type: p.type });
    propType = 'string';
  }
  sanitized.type = propType;

  // Description is optional but helpful
  if (p.description && typeof p.description === 'string') {
    sanitized.description = p.description;
  }

  // Enum values for constrained strings
  if (Array.isArray(p.enum) && p.enum.length > 0) {
    sanitized.enum = p.enum.filter((v) => typeof v === 'string' || typeof v === 'number');
  }

  // Default value
  if (p.default !== undefined) {
    sanitized.default = p.default;
  }

  // For array types, include items schema
  if (propType === 'array' && p.items) {
    sanitized.items = typeof p.items === 'object' ? p.items : { type: 'string' };
  }

  return sanitized;
}

/**
 * Convert Composio tool to Claude tool format
 * Safely handles missing or malformed tool data
 * Validates and sanitizes schema to prevent API errors
 */
function toClaudeTool(tool: ComposioTool): ClaudeTool | null {
  try {
    if (!tool || !tool.name) {
      log.warn('Invalid tool missing name', { tool });
      return null;
    }

    // Validate tool name - must be alphanumeric with underscores
    const toolName = `composio_${tool.name}`;
    if (!/^[a-zA-Z0-9_]+$/.test(toolName)) {
      log.warn('Invalid tool name characters, skipping', { name: tool.name });
      return null;
    }

    // Sanitize properties to ensure valid JSON Schema
    const rawProperties = tool.parameters?.properties || {};
    const sanitizedProperties: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(rawProperties)) {
      // Validate property key - must be alphanumeric with underscores
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
        log.warn('Skipping property with invalid key', { toolName, key });
        continue;
      }

      const sanitized = sanitizeSchemaProperty(key, value);
      if (sanitized) {
        sanitizedProperties[key] = sanitized;
      }
    }

    // Filter required array to only include properties that exist
    const rawRequired = tool.parameters?.required || [];
    const sanitizedRequired = rawRequired.filter(
      (r) => typeof r === 'string' && r in sanitizedProperties
    );

    return {
      name: toolName,
      description: tool.description || `Action: ${tool.name.replace(/_/g, ' ')}`,
      input_schema: {
        type: 'object',
        properties: sanitizedProperties,
        required: sanitizedRequired,
      },
    };
  } catch (error) {
    log.error('Failed to convert tool to Claude format', { toolName: tool?.name, error });
    return null;
  }
}

// ============================================================================
// MAIN TOOL LOADER
// ============================================================================

/**
 * Get Composio tools for a user, formatted for Claude.
 *
 * Uses a registry-based approach:
 * 1. Detect which toolkits are connected
 * 2. Split tools into per-toolkit buckets by prefix
 * 3. Sort each bucket by priority (essential actions first)
 * 4. Cap each bucket to its tool budget
 * 5. Inject toolkit-specific system prompts
 *
 * hasGitHub is set for callers that need to know about GitHub dedup.
 */
export async function getComposioToolsForUser(userId: string): Promise<ComposioToolContext> {
  if (!isComposioConfigured()) {
    return {
      connectedApps: [],
      tools: [],
      systemPromptAddition: '',
      hasGitHub: false,
      hasGmail: false,
      hasOutlook: false,
      hasSlack: false,
    };
  }

  try {
    // Get user's connected accounts
    const accounts = await getConnectedAccounts(userId);
    const connectedApps = accounts.filter((a) => a.status === 'connected').map((a) => a.toolkit);

    if (connectedApps.length === 0) {
      return {
        connectedApps: [],
        tools: [],
        systemPromptAddition: '',
        hasGitHub: false,
        hasGmail: false,
        hasOutlook: false,
        hasSlack: false,
      };
    }

    // Detect which registered toolkits are connected
    const activeToolkits: ToolkitIntegration[] = [];
    const activeToolkitIds = new Set<string>();

    for (const toolkit of TOOLKIT_REGISTRY) {
      const isActive = connectedApps.some((app) => appMatchesToolkit(app, toolkit));
      if (isActive) {
        activeToolkits.push(toolkit);
        activeToolkitIds.add(toolkit.id);
        toolkit.logStatsFn();
      }
    }

    // Legacy flags for backward compatibility (used by route files)
    const hasGitHub = activeToolkitIds.has('GITHUB');
    const hasGmail = activeToolkitIds.has('GMAIL');
    const hasOutlook = activeToolkitIds.has('MICROSOFT_OUTLOOK');
    const hasSlack = activeToolkitIds.has('SLACK');

    log.info('User has connected apps', {
      userId,
      apps: connectedApps,
      activeToolkits: activeToolkits.map((t) => t.id),
      hasGitHub,
    });

    // Get available tools for connected apps
    let composioTools: ComposioTool[] = [];
    try {
      composioTools = await getAvailableTools(userId, connectedApps);
      log.info('Retrieved Composio tools', {
        userId,
        rawToolCount: composioTools.length,
        toolNames: composioTools.slice(0, 10).map((t) => t.name),
      });
    } catch (toolsError) {
      log.error('Failed to get available tools', { userId, connectedApps, error: toolsError });
    }

    // Convert to Claude format, filtering out any null/invalid tools
    let tools = composioTools.map(toClaudeTool).filter((t): t is ClaudeTool => t !== null);

    // Split tools into per-toolkit buckets by prefix
    const toolBuckets = new Map<string, ClaudeTool[]>();
    const otherTools: ClaudeTool[] = [];

    for (const tool of tools) {
      let matched = false;
      for (const toolkit of activeToolkits) {
        if (tool.name.startsWith(toolkit.prefix)) {
          const bucket = toolBuckets.get(toolkit.id);
          if (bucket) {
            bucket.push(tool);
          } else {
            toolBuckets.set(toolkit.id, [tool]);
          }
          matched = true;
          break;
        }
      }
      if (!matched) {
        otherTools.push(tool);
      }
    }

    // Sort and cap each toolkit bucket, then combine
    const allToolkitTools: ClaudeTool[] = [];
    const toolkitStats: Record<string, number> = {};

    for (const toolkit of activeToolkits) {
      const bucket = toolBuckets.get(toolkit.id) || [];
      const sorted = toolkit.sortFn(bucket);
      const capped = sorted.slice(0, toolkit.cap);
      allToolkitTools.push(...capped);
      toolkitStats[`${toolkit.id}_loaded`] = capped.length;
      toolkitStats[`${toolkit.id}_dropped`] = bucket.length - capped.length;
    }

    const cappedOtherTools = otherTools.slice(0, MAX_COMPOSIO_TOOLS_DEFAULT);

    // Combine: toolkit tools first (superpowers), then others
    tools = [...allToolkitTools, ...cappedOtherTools];

    log.info('Prepared Composio tools for Claude', {
      userId,
      totalTools: tools.length,
      toolkitBreakdown: toolkitStats,
      otherTools: cappedOtherTools.length,
      otherToolsDropped: otherTools.length - cappedOtherTools.length,
    });

    // Build system prompt addition
    const appList = connectedApps
      .map((app) => {
        const config = getToolkitById(app);
        return config ? config.displayName : app;
      })
      .join(', ');

    let systemPromptAddition = `

## Connected App Integrations

The user has connected the following apps: ${appList}
`;

    // Add toolkit-specific system prompts for all active toolkits
    for (const toolkit of activeToolkits) {
      const bucket = toolBuckets.get(toolkit.id) || [];
      if (bucket.length > 0) {
        systemPromptAddition += toolkit.systemPromptFn();
      }
    }

    // Build dynamic capability lines
    const capabilityLines: string[] = [];
    for (const toolkit of activeToolkits) {
      capabilityLines.push(
        `- **Full ${toolkit.displayName} operations** (${toolkit.capabilitySummaryFn()})`
      );
    }

    // Add general app guidance
    systemPromptAddition += `
### Connected App Usage

You can use these apps to help the user with tasks like:
${capabilityLines.join('\n')}
- And more based on what they've connected

### IMPORTANT: Preview Before Sending

**ALWAYS show a preview before posting, sending, or publishing anything.**

Use this exact JSON format to show an interactive preview card:

\`\`\`action-preview
{
  "platform": "Twitter",
  "action": "Post Tweet",
  "content": "Your tweet content here...",
  "toolName": "composio_TWITTER_CREATE_TWEET",
  "toolParams": { "text": "Your tweet content here..." }
}
\`\`\`

For emails, include recipient and subject:
\`\`\`action-preview
{
  "platform": "Gmail",
  "action": "Send Email",
  "recipient": "user@example.com",
  "subject": "Subject line",
  "content": "Email body here...",
  "toolName": "composio_GMAIL_SEND_EMAIL",
  "toolParams": { "recipient_email": "user@example.com", "subject": "...", "body": "..." }
}
\`\`\`

The user will see a card with Send/Edit/Cancel buttons. Only execute the tool when they click Send.
If they click Edit and provide instructions, regenerate the preview with their changes.

### Tool Usage

Tool names are prefixed with "composio_" followed by the action:
- Tweet: composio_TWITTER_CREATE_TWEET
- Slack message: composio_SLACK_SENDS_A_MESSAGE_TO_A_SLACK_CHANNEL
- LinkedIn post: composio_LINKEDIN_CREATE_POST
- Send email: composio_GMAIL_SEND_EMAIL
- Outlook email: composio_OUTLOOK_SEND_EMAIL
- GitHub issue: composio_GITHUB_CREATE_ISSUE
- Google Sheets: composio_GOOGLESHEETS_BATCH_UPDATE
- Google Docs: composio_GOOGLEDOCS_CREATE_DOCUMENT
- Discord message: composio_DISCORD_SEND_MESSAGE
- Instagram post: composio_INSTAGRAM_CREATE_POST
- YouTube search: composio_YOUTUBE_SEARCH
- Vercel deploy: composio_VERCEL_CREATE_DEPLOYMENT
- Stripe payment: composio_STRIPE_CREATE_PAYMENT_INTENT
- Google Drive: composio_GOOGLEDRIVE_CREATE_FILE
- Airtable record: composio_AIRTABLE_CREATE_RECORD

### Safety Rules

1. **Never post without preview + confirmation**
2. **Never send emails without showing recipient, subject, and body first**
3. **For bulk actions, show a summary and get explicit approval**
4. **If unsure about tone or content, ask clarifying questions first**
5. **For destructive actions (delete, cancel), always confirm first**
6. **For financial actions (Stripe payments, charges), show full details before executing**
`;

    return {
      connectedApps,
      tools,
      systemPromptAddition,
      hasGitHub,
      hasGmail,
      hasOutlook,
      hasSlack,
    };
  } catch (error) {
    log.error('Failed to get Composio tools', { userId, error });
    return {
      connectedApps: [],
      tools: [],
      systemPromptAddition: '',
      hasGitHub: false,
      hasGmail: false,
      hasOutlook: false,
      hasSlack: false,
    };
  }
}

// ============================================================================
// TOOL EXECUTION
// ============================================================================

/**
 * Execute a Composio tool call from Claude
 */
export async function executeComposioTool(
  userId: string,
  toolName: string,
  params: Record<string, unknown>
): Promise<{
  success: boolean;
  result?: unknown;
  error?: string;
}> {
  // Remove the composio_ prefix to get the actual tool name
  const actualToolName = toolName.replace(/^composio_/, '');

  log.info('Executing Composio tool', { userId, toolName: actualToolName });

  try {
    const result = await executeTool(userId, actualToolName, params);

    if (result.success) {
      return {
        success: true,
        result: result.data,
      };
    } else {
      return {
        success: false,
        error: result.error || 'Tool execution failed',
      };
    }
  } catch (error) {
    log.error('Composio tool execution error', { userId, toolName, error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// TOOL TYPE CHECKERS
// ============================================================================

/**
 * Check if a tool name is a Composio tool
 */
export function isComposioTool(toolName: string): boolean {
  return toolName.startsWith('composio_');
}

/**
 * Check if a tool name belongs to a specific Composio toolkit
 */
export function isComposioToolkitTool(toolName: string, prefix: string): boolean {
  return toolName.startsWith(`composio_${prefix}_`);
}

// Individual toolkit checkers (for backward compatibility and convenience)
export function isComposioGitHubTool(toolName: string): boolean {
  return toolName.startsWith('composio_GITHUB_');
}

export function isComposioGmailTool(toolName: string): boolean {
  return toolName.startsWith('composio_GMAIL_');
}

export function isComposioOutlookTool(toolName: string): boolean {
  return toolName.startsWith('composio_OUTLOOK_');
}

export function isComposioSlackTool(toolName: string): boolean {
  return toolName.startsWith('composio_SLACK_');
}

export function isComposioGoogleSheetsTool(toolName: string): boolean {
  return toolName.startsWith('composio_GOOGLESHEETS_');
}

export function isComposioDiscordTool(toolName: string): boolean {
  return toolName.startsWith('composio_DISCORD_');
}

export function isComposioGoogleDocsTool(toolName: string): boolean {
  return toolName.startsWith('composio_GOOGLEDOCS_');
}

export function isComposioTwitterTool(toolName: string): boolean {
  return toolName.startsWith('composio_TWITTER_');
}

export function isComposioLinkedInTool(toolName: string): boolean {
  return toolName.startsWith('composio_LINKEDIN_');
}

export function isComposioInstagramTool(toolName: string): boolean {
  return toolName.startsWith('composio_INSTAGRAM_');
}

export function isComposioYouTubeTool(toolName: string): boolean {
  return toolName.startsWith('composio_YOUTUBE_');
}

export function isComposioVercelTool(toolName: string): boolean {
  return toolName.startsWith('composio_VERCEL_');
}

export function isComposioStripeTool(toolName: string): boolean {
  return toolName.startsWith('composio_STRIPE_');
}

export function isComposioGoogleDriveTool(toolName: string): boolean {
  return toolName.startsWith('composio_GOOGLEDRIVE_');
}

export function isComposioAirtableTool(toolName: string): boolean {
  return toolName.startsWith('composio_AIRTABLE_');
}

export function isComposioMicrosoftTeamsTool(toolName: string): boolean {
  return toolName.startsWith('composio_MICROSOFTTEAMS_');
}

export function isComposioLinearTool(toolName: string): boolean {
  return toolName.startsWith('composio_LINEAR_');
}

export function isComposioGoogleCalendarTool(toolName: string): boolean {
  return toolName.startsWith('composio_GOOGLECALENDAR_');
}

export function isComposioHubSpotTool(toolName: string): boolean {
  return toolName.startsWith('composio_HUBSPOT_');
}

export function isComposioSalesforceTool(toolName: string): boolean {
  return toolName.startsWith('composio_SALESFORCE_');
}

export function isComposioSentryTool(toolName: string): boolean {
  return toolName.startsWith('composio_SENTRY_');
}

export function isComposioSupabaseTool(toolName: string): boolean {
  return toolName.startsWith('composio_SUPABASE_');
}

export function isComposioCloudfareTool(toolName: string): boolean {
  return toolName.startsWith('composio_CLOUDFLARE_');
}

export function isComposioRedditTool(toolName: string): boolean {
  return toolName.startsWith('composio_REDDIT_');
}

export function isComposioShopifyTool(toolName: string): boolean {
  return toolName.startsWith('composio_SHOPIFY_');
}

export function isComposioGoogleSlidesTool(toolName: string): boolean {
  return toolName.startsWith('composio_GOOGLESLIDES_');
}

export function isComposioGoogleTasksTool(toolName: string): boolean {
  return toolName.startsWith('composio_GOOGLETASKS_');
}

export function isComposioGoogleMeetTool(toolName: string): boolean {
  return toolName.startsWith('composio_GOOGLEMEET_');
}

export function isComposioGooglePhotosTool(toolName: string): boolean {
  return toolName.startsWith('composio_GOOGLEPHOTOS_');
}

export function isComposioGoogleAnalyticsTool(toolName: string): boolean {
  return toolName.startsWith('composio_GOOGLEANALYTICS_');
}

export function isComposioGoogleSearchConsoleTool(toolName: string): boolean {
  return toolName.startsWith('composio_GOOGLESEARCHCONSOLE_');
}

export function isComposioGoogleAdsTool(toolName: string): boolean {
  return toolName.startsWith('composio_GOOGLEADS_');
}

export function isComposioGoogleMapsTool(toolName: string): boolean {
  return toolName.startsWith('composio_GOOGLEMAPS_');
}

export function isComposioDropboxTool(toolName: string): boolean {
  return toolName.startsWith('composio_DROPBOX_');
}

export function isComposioElevenLabsTool(toolName: string): boolean {
  return toolName.startsWith('composio_ELEVENLABS_');
}

export function isComposioSerpAPITool(toolName: string): boolean {
  return toolName.startsWith('composio_SERPAPI_');
}

export function isComposioPerplexityAITool(toolName: string): boolean {
  return toolName.startsWith('composio_PERPLEXITYAI_');
}

// ============================================================================
// QUICK CONTEXT HELPERS
// ============================================================================

/**
 * Get a quick summary of connected apps for system prompt
 * (lightweight version without full tool definitions)
 */
export async function getConnectedAppsSummary(userId: string): Promise<string> {
  if (!isComposioConfigured()) {
    return '';
  }

  try {
    const accounts = await getConnectedAccounts(userId);
    const connected = accounts.filter((a) => a.status === 'connected');

    if (connected.length === 0) {
      return '';
    }

    const appNames = connected
      .map((a) => {
        const config = getToolkitById(a.toolkit);
        return config ? config.displayName : a.toolkit;
      })
      .join(', ');

    return `User has connected these apps for AI automation: ${appNames}. `;
  } catch {
    return '';
  }
}

/**
 * Get featured actions for common tasks
 */
export function getFeaturedActions(): Record<string, string> {
  return {
    // Social & Communication
    'Post a tweet': 'composio_TWITTER_CREATE_TWEET',
    'Send a Slack message': 'composio_SLACK_SENDS_A_MESSAGE_TO_A_SLACK_CHANNEL',
    'Send a Slack DM': 'composio_SLACK_SEND_ME_A_DIRECT_MESSAGE_ON_SLACK',
    'Send an email': 'composio_GMAIL_SEND_EMAIL',
    'Send Outlook email': 'composio_OUTLOOK_SEND_EMAIL',
    'Post to LinkedIn': 'composio_LINKEDIN_CREATE_POST',
    'Post to Instagram': 'composio_INSTAGRAM_CREATE_POST',
    'Send Discord message': 'composio_DISCORD_SEND_MESSAGE',

    // Productivity
    'Create Google Doc': 'composio_GOOGLEDOCS_CREATE_DOCUMENT',
    'Update Google Sheet': 'composio_GOOGLESHEETS_BATCH_UPDATE',
    'Create Airtable record': 'composio_AIRTABLE_CREATE_RECORD',
    'Upload to Google Drive': 'composio_GOOGLEDRIVE_CREATE_FILE',
    'Create a Notion page': 'composio_NOTION_CREATE_PAGE',
    'Add calendar event': 'composio_GOOGLE_CALENDAR_CREATE_EVENT',

    // Development
    'Create GitHub issue': 'composio_GITHUB_CREATE_ISSUE',
    'Create pull request': 'composio_GITHUB_CREATE_PULL_REQUEST',
    'Search GitHub code': 'composio_GITHUB_SEARCH_CODE',
    'List my repos': 'composio_GITHUB_LIST_REPOS_FOR_AUTHENTICATED_USER',
    'Create GitHub release': 'composio_GITHUB_CREATE_RELEASE',
    'Trigger GitHub workflow': 'composio_GITHUB_CREATE_WORKFLOW_DISPATCH',
    'Merge pull request': 'composio_GITHUB_MERGE_PULL_REQUEST',
    'Deploy to Vercel': 'composio_VERCEL_CREATE_DEPLOYMENT',
    'List Vercel projects': 'composio_VERCEL_LIST_PROJECTS',

    // Calendar & Events
    'Create Outlook event': 'composio_OUTLOOK_CALENDAR_CREATE_EVENT',

    // Media
    'Search YouTube': 'composio_YOUTUBE_SEARCH',

    // Finance
    'Create Stripe payment': 'composio_STRIPE_CREATE_PAYMENT_INTENT',
    'List Stripe customers': 'composio_STRIPE_LIST_CUSTOMERS',
  };
}
