/**
 * COMPOSIO INTEGRATION
 * ====================
 *
 * 500+ app integrations for your AI agents.
 * Replace OAuth nightmares with one API call.
 *
 * Toolkit Superpowers (15 integrated toolkits):
 * - GitHub: 100+ prioritized actions for repos, issues, PRs, code, CI/CD, releases, teams, search
 * - Gmail: 40 prioritized actions for send, read, search, drafts, labels, contacts, settings
 * - Outlook: 64 prioritized actions for email, calendar, contacts, Teams chat, rules
 * - Slack: 100+ prioritized actions for messaging, channels, users, files, canvases, workflows
 * - Google Sheets: 44 actions for spreadsheets, data, formulas, charts
 * - Discord: 15 actions for servers, messages, moderation
 * - Google Docs: 35 actions for documents, formatting, tables
 * - Twitter/X: 75 actions for tweets, search, DMs, users, lists, spaces
 * - LinkedIn: 11 actions for posts, profile, media
 * - Instagram: 32 actions for publishing, media, engagement, messaging
 * - YouTube: 24 actions for search, videos, channels, playlists
 * - Vercel: 50 actions for deployments, projects, domains, env vars
 * - Stripe: 80 actions for payments, customers, subscriptions, invoicing
 * - Google Drive: 59 actions for files, sharing, drives, collaboration
 * - Airtable: 26 actions for bases, records, tables
 */

// Client functions
export {
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
} from './client';

// Types
export type {
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
} from './types';

// Toolkits
export {
  POPULAR_TOOLKITS,
  ALL_TOOLKITS,
  TOOLKITS_BY_CATEGORY,
  getToolkitById,
  getToolkitsByCategory,
  getPopularToolkits,
  composioSlugToToolkitId,
} from './toolkits';

// Chat integration (Claude tools)
export {
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
  getConnectedAppsSummary,
  getFeaturedActions,
} from './chat-tools';

export type { ClaudeTool, ComposioToolContext } from './chat-tools';

// GitHub Toolkit
export {
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
} from './github-toolkit';

export type { GitHubActionCategory, GitHubAction } from './github-toolkit';

// Gmail Toolkit
export {
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
} from './gmail-toolkit';

export type { GmailActionCategory, GmailAction } from './gmail-toolkit';

// Outlook Toolkit
export {
  ALL_OUTLOOK_ACTIONS,
  getOutlookFeaturedActionNames,
  getOutlookActionsByPriority,
  getOutlookActionNamesByPriority,
  getOutlookActionsByCategory,
  getOutlookActionPriority,
  isKnownOutlookAction,
  isDestructiveOutlookAction,
  sortByOutlookPriority,
  getOutlookActionStats,
  getOutlookSystemPrompt,
  getOutlookCapabilitySummary,
  logOutlookToolkitStats,
} from './outlook-toolkit';

export type { OutlookActionCategory, OutlookAction } from './outlook-toolkit';

// Slack Toolkit
export {
  ALL_SLACK_ACTIONS,
  getSlackFeaturedActionNames,
  getSlackActionsByPriority,
  getSlackActionNamesByPriority,
  getSlackActionsByCategory,
  getSlackActionPriority,
  isKnownSlackAction,
  isDestructiveSlackAction,
  sortBySlackPriority,
  getSlackActionStats,
  getSlackSystemPrompt,
  getSlackCapabilitySummary,
  logSlackToolkitStats,
} from './slack-toolkit';

export type { SlackActionCategory, SlackAction } from './slack-toolkit';

// Google Sheets Toolkit
export {
  ALL_GOOGLE_SHEETS_ACTIONS,
  getGoogleSheetsFeaturedActionNames,
  getGoogleSheetsActionsByPriority,
  getGoogleSheetsActionNamesByPriority,
  getGoogleSheetsActionsByCategory,
  getGoogleSheetsActionPriority,
  isKnownGoogleSheetsAction,
  isDestructiveGoogleSheetsAction,
  sortByGoogleSheetsPriority,
  getGoogleSheetsActionStats,
  getGoogleSheetsSystemPrompt,
  getGoogleSheetsCapabilitySummary,
  logGoogleSheetsToolkitStats,
} from './googlesheets-toolkit';

export type { GoogleSheetsActionCategory, GoogleSheetsAction } from './googlesheets-toolkit';

// Discord Toolkit
export {
  ALL_DISCORD_ACTIONS,
  getDiscordFeaturedActionNames,
  getDiscordActionsByPriority,
  getDiscordActionNamesByPriority,
  getDiscordActionsByCategory,
  getDiscordActionPriority,
  isKnownDiscordAction,
  isDestructiveDiscordAction,
  sortByDiscordPriority,
  getDiscordActionStats,
  getDiscordSystemPrompt,
  getDiscordCapabilitySummary,
  logDiscordToolkitStats,
} from './discord-toolkit';

export type { DiscordActionCategory, DiscordAction } from './discord-toolkit';

// Google Docs Toolkit
export {
  ALL_GOOGLE_DOCS_ACTIONS,
  getGoogleDocsFeaturedActionNames,
  getGoogleDocsActionsByPriority,
  getGoogleDocsActionNamesByPriority,
  getGoogleDocsActionsByCategory,
  getGoogleDocsActionPriority,
  isKnownGoogleDocsAction,
  isDestructiveGoogleDocsAction,
  sortByGoogleDocsPriority,
  getGoogleDocsActionStats,
  getGoogleDocsSystemPrompt,
  getGoogleDocsCapabilitySummary,
  logGoogleDocsToolkitStats,
} from './googledocs-toolkit';

export type { GoogleDocsActionCategory, GoogleDocsAction } from './googledocs-toolkit';

// Twitter Toolkit
export {
  ALL_TWITTER_ACTIONS,
  getTwitterFeaturedActionNames,
  getTwitterActionsByPriority,
  getTwitterActionNamesByPriority,
  getTwitterActionsByCategory,
  getTwitterActionPriority,
  isKnownTwitterAction,
  isDestructiveTwitterAction,
  sortByTwitterPriority,
  getTwitterActionStats,
  getTwitterSystemPrompt,
  getTwitterCapabilitySummary,
  logTwitterToolkitStats,
} from './twitter-toolkit';

export type { TwitterActionCategory, TwitterAction } from './twitter-toolkit';

// LinkedIn Toolkit
export {
  ALL_LINKEDIN_ACTIONS,
  getLinkedInFeaturedActionNames,
  getLinkedInActionsByPriority,
  getLinkedInActionNamesByPriority,
  getLinkedInActionsByCategory,
  getLinkedInActionPriority,
  isKnownLinkedInAction,
  isDestructiveLinkedInAction,
  sortByLinkedInPriority,
  getLinkedInActionStats,
  getLinkedInSystemPrompt,
  getLinkedInCapabilitySummary,
  logLinkedInToolkitStats,
} from './linkedin-toolkit';

export type { LinkedInActionCategory, LinkedInAction } from './linkedin-toolkit';

// Instagram Toolkit
export {
  ALL_INSTAGRAM_ACTIONS,
  getInstagramFeaturedActionNames,
  getInstagramActionsByPriority,
  getInstagramActionNamesByPriority,
  getInstagramActionsByCategory,
  getInstagramActionPriority,
  isKnownInstagramAction,
  isDestructiveInstagramAction,
  sortByInstagramPriority,
  getInstagramActionStats,
  getInstagramSystemPrompt,
  getInstagramCapabilitySummary,
  logInstagramToolkitStats,
} from './instagram-toolkit';

export type { InstagramActionCategory, InstagramAction } from './instagram-toolkit';

// YouTube Toolkit
export {
  ALL_YOUTUBE_ACTIONS,
  getYouTubeFeaturedActionNames,
  getYouTubeActionsByPriority,
  getYouTubeActionNamesByPriority,
  getYouTubeActionsByCategory,
  getYouTubeActionPriority,
  isKnownYouTubeAction,
  isDestructiveYouTubeAction,
  sortByYouTubePriority,
  getYouTubeActionStats,
  getYouTubeSystemPrompt,
  getYouTubeCapabilitySummary,
  logYouTubeToolkitStats,
} from './youtube-toolkit';

export type { YouTubeActionCategory, YouTubeAction } from './youtube-toolkit';

// Vercel Toolkit
export {
  ALL_VERCEL_ACTIONS,
  getVercelFeaturedActionNames,
  getVercelActionsByPriority,
  getVercelActionNamesByPriority,
  getVercelActionsByCategory,
  getVercelActionPriority,
  isKnownVercelAction,
  isDestructiveVercelAction,
  sortByVercelPriority,
  getVercelActionStats,
  getVercelSystemPrompt,
  getVercelCapabilitySummary,
  logVercelToolkitStats,
} from './vercel-toolkit';

export type { VercelActionCategory, VercelAction } from './vercel-toolkit';

// Stripe Toolkit
export {
  ALL_STRIPE_ACTIONS,
  getStripeFeaturedActionNames,
  getStripeActionsByPriority,
  getStripeActionNamesByPriority,
  getStripeActionsByCategory,
  getStripeActionPriority,
  isKnownStripeAction,
  isDestructiveStripeAction,
  sortByStripePriority,
  getStripeActionStats,
  getStripeSystemPrompt,
  getStripeCapabilitySummary,
  logStripeToolkitStats,
} from './stripe-toolkit';

export type { StripeActionCategory, StripeAction } from './stripe-toolkit';

// Google Drive Toolkit
export {
  ALL_GOOGLE_DRIVE_ACTIONS,
  getGoogleDriveFeaturedActionNames,
  getGoogleDriveActionsByPriority,
  getGoogleDriveActionNamesByPriority,
  getGoogleDriveActionsByCategory,
  getGoogleDriveActionPriority,
  isKnownGoogleDriveAction,
  isDestructiveGoogleDriveAction,
  sortByGoogleDrivePriority,
  getGoogleDriveActionStats,
  getGoogleDriveSystemPrompt,
  getGoogleDriveCapabilitySummary,
  logGoogleDriveToolkitStats,
} from './googledrive-toolkit';

export type { GoogleDriveActionCategory, GoogleDriveAction } from './googledrive-toolkit';

// Airtable Toolkit
export {
  ALL_AIRTABLE_ACTIONS,
  getAirtableFeaturedActionNames,
  getAirtableActionsByPriority,
  getAirtableActionNamesByPriority,
  getAirtableActionsByCategory,
  getAirtableActionPriority,
  isKnownAirtableAction,
  isDestructiveAirtableAction,
  sortByAirtablePriority,
  getAirtableActionStats,
  getAirtableSystemPrompt,
  getAirtableCapabilitySummary,
  logAirtableToolkitStats,
} from './airtable-toolkit';

export type { AirtableActionCategory, AirtableAction } from './airtable-toolkit';
