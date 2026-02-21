/**
 * COMPOSIO TOOLKITS CONFIGURATION
 * ================================
 *
 * Approved app integrations available through Composio.
 * 67 approved integrations organized by category.
 */

import type { ToolkitConfig, ToolkitCategory } from './types';
import { getGitHubActionNamesByPriority } from './github-toolkit';
import { getGmailActionNamesByPriority } from './gmail-toolkit';
import { getOutlookActionNamesByPriority } from './outlook-toolkit';
import { getSlackActionNamesByPriority } from './slack-toolkit';
import { getGoogleSheetsActionNamesByPriority } from './googlesheets-toolkit';
import { getDiscordActionNamesByPriority } from './discord-toolkit';
import { getGoogleDocsActionNamesByPriority } from './googledocs-toolkit';
import { getTwitterActionNamesByPriority } from './twitter-toolkit';
import { getLinkedInActionNamesByPriority } from './linkedin-toolkit';
import { getInstagramActionNamesByPriority } from './instagram-toolkit';
import { getYouTubeActionNamesByPriority } from './youtube-toolkit';
import { getVercelActionNamesByPriority } from './vercel-toolkit';
import { getStripeActionNamesByPriority } from './stripe-toolkit';
import { getGoogleDriveActionNamesByPriority } from './googledrive-toolkit';
import { getAirtableActionNamesByPriority } from './airtable-toolkit';
import { getMicrosoftTeamsActionNamesByPriority } from './microsoftteams-toolkit';
import { getLinearActionNamesByPriority } from './linear-toolkit';
import { getGoogleCalendarActionNamesByPriority } from './googlecalendar-toolkit';
import { getHubSpotActionNamesByPriority } from './hubspot-toolkit';
import { getSalesforceActionNamesByPriority } from './salesforce-toolkit';
import { getSentryActionNamesByPriority } from './sentry-toolkit';
import { getSupabaseActionNamesByPriority } from './supabase-toolkit';
import { getCloudflareActionNamesByPriority } from './cloudflare-toolkit';
import { getRedditActionNamesByPriority } from './reddit-toolkit';
import { getShopifyActionNamesByPriority } from './shopify-toolkit';
import { getGoogleSlidesActionNamesByPriority } from './googleslides-toolkit';
import { getGoogleTasksActionNamesByPriority } from './googletasks-toolkit';
import { getGoogleMeetActionNamesByPriority } from './googlemeet-toolkit';
import { getGooglePhotosActionNamesByPriority } from './googlephotos-toolkit';
import { getGoogleAnalyticsActionNamesByPriority } from './googleanalytics-toolkit';
import { getGoogleSearchConsoleActionNamesByPriority } from './googlesearchconsole-toolkit';
import { getGoogleAdsActionNamesByPriority } from './googleads-toolkit';
import { getGoogleMapsActionNamesByPriority } from './googlemaps-toolkit';
import { getDropboxActionNamesByPriority } from './dropbox-toolkit';
import { getElevenLabsActionNamesByPriority } from './elevenlabs-toolkit';
import { getSerpAPIActionNamesByPriority } from './serpapi-toolkit';
import { getPerplexityAIActionNamesByPriority } from './perplexityai-toolkit';
import { getNotionActionNamesByPriority } from './notion-toolkit';
import { getJiraActionNamesByPriority } from './jira-toolkit';
import { getAsanaActionNamesByPriority } from './asana-toolkit';
import { getZoomActionNamesByPriority } from './zoom-toolkit';
import { getTrelloActionNamesByPriority } from './trello-toolkit';
import { getCalendlyActionNamesByPriority } from './calendly-toolkit';
import { getClickUpActionNamesByPriority } from './clickup-toolkit';
import { getTelegramActionNamesByPriority } from './telegram-toolkit';
import { getMailchimpActionNamesByPriority } from './mailchimp-toolkit';
import { getZendeskActionNamesByPriority } from './zendesk-toolkit';
import { getWhatsAppActionNamesByPriority } from './whatsapp-toolkit';
import { getFigmaActionNamesByPriority } from './figma-toolkit';
import { getDocuSignActionNamesByPriority } from './docusign-toolkit';
import { getGitLabActionNamesByPriority } from './gitlab-toolkit';
import { getMondayActionNamesByPriority } from './monday-toolkit';
import { getConfluenceActionNamesByPriority } from './confluence-toolkit';
import { getIntercomActionNamesByPriority } from './intercom-toolkit';
import { getQuickBooksActionNamesByPriority } from './quickbooks-toolkit';
import { getSendGridActionNamesByPriority } from './sendgrid-toolkit';
import { getPipedriveActionNamesByPriority } from './pipedrive-toolkit';
import { getTwilioActionNamesByPriority } from './twilio-toolkit';
import { getFreshdeskActionNamesByPriority } from './freshdesk-toolkit';
import { getTypeformActionNamesByPriority } from './typeform-toolkit';
import { getBoxActionNamesByPriority } from './box-toolkit';
import { getBitbucketActionNamesByPriority } from './bitbucket-toolkit';
import { getTodoistActionNamesByPriority } from './todoist-toolkit';
import { getEvernoteActionNamesByPriority } from './evernote-toolkit';
import { getWebflowActionNamesByPriority } from './webflow-toolkit';
import { getPagerDutyActionNamesByPriority } from './pagerduty-toolkit';
import { getLoomActionNamesByPriority } from './loom-toolkit';

// ============================================================================
// POPULAR TOOLKITS (shown prominently in UI)
// ============================================================================

export const POPULAR_TOOLKITS: ToolkitConfig[] = [
  // Communication - Essential
  {
    id: 'GMAIL',
    displayName: 'Gmail',
    description:
      'Full Gmail integration: send, read, search, drafts, labels, contacts, attachments, and more',
    icon: '📧',
    category: 'communication',
    authType: 'oauth2',
    popular: true,
    featuredActions: getGmailActionNamesByPriority(2),
    toolLimit: 40,
  },
  {
    id: 'SLACK',
    displayName: 'Slack',
    description:
      'Full Slack integration: messages, channels, users, files, canvases, reminders, and more',
    icon: '💬',
    category: 'communication',
    authType: 'oauth2',
    popular: true,
    featuredActions: getSlackActionNamesByPriority(2),
    toolLimit: 80,
  },
  {
    id: 'DISCORD',
    displayName: 'Discord',
    description: 'Full Discord integration: manage servers, send messages, moderate communities',
    icon: '🎮',
    category: 'communication',
    authType: 'oauth2',
    popular: true,
    featuredActions: getDiscordActionNamesByPriority(2),
    toolLimit: 15,
  },
  {
    id: 'MICROSOFT_TEAMS',
    displayName: 'Microsoft Teams',
    description:
      'Full Microsoft Teams integration: messaging, channels, meetings, file sharing, and more',
    icon: '👥',
    category: 'communication',
    authType: 'oauth2',
    popular: true,
    featuredActions: getMicrosoftTeamsActionNamesByPriority(2),
    toolLimit: 40,
  },

  // Productivity - Must Have
  {
    id: 'GOOGLE_DOCS',
    displayName: 'Google Docs',
    description: 'Full Google Docs integration: create, edit, format documents, tables, and more',
    icon: '📄',
    category: 'productivity',
    authType: 'oauth2',
    popular: true,
    featuredActions: getGoogleDocsActionNamesByPriority(2),
    toolLimit: 35,
  },
  {
    id: 'GOOGLE_SHEETS',
    displayName: 'Google Sheets',
    description:
      'Full Google Sheets integration: create spreadsheets, read/write cells, analyze data, automate reports',
    icon: '📊',
    category: 'productivity',
    authType: 'oauth2',
    popular: true,
    featuredActions: getGoogleSheetsActionNamesByPriority(2),
    toolLimit: 44,
  },
  {
    id: 'AIRTABLE',
    displayName: 'Airtable',
    description: 'Full Airtable integration: manage bases, records, tables, and collaboration',
    icon: '📋',
    category: 'productivity',
    authType: 'oauth2',
    popular: true,
    featuredActions: getAirtableActionNamesByPriority(2),
    toolLimit: 26,
  },

  // Social Media - High Demand
  {
    id: 'TWITTER',
    displayName: 'Twitter/X',
    description: 'Full Twitter/X integration: tweets, search, DMs, users, lists, spaces, and more',
    icon: '🐦',
    category: 'social',
    authType: 'oauth2',
    popular: true,
    featuredActions: getTwitterActionNamesByPriority(2),
    toolLimit: 75,
  },
  {
    id: 'LINKEDIN',
    displayName: 'LinkedIn',
    description: 'Full LinkedIn integration: posts, profile management, media sharing',
    icon: '💼',
    category: 'social',
    authType: 'oauth2',
    popular: true,
    featuredActions: getLinkedInActionNamesByPriority(2),
    toolLimit: 11,
  },
  {
    id: 'INSTAGRAM',
    displayName: 'Instagram',
    description: 'Full Instagram integration: publish, media, engagement, messaging, analytics',
    icon: '📸',
    category: 'social',
    authType: 'oauth2',
    popular: true,
    featuredActions: getInstagramActionNamesByPriority(2),
    toolLimit: 32,
  },
  {
    id: 'YOUTUBE',
    displayName: 'YouTube',
    description: 'Full YouTube integration: search, videos, channels, playlists, engagement',
    icon: '🎬',
    category: 'social',
    authType: 'oauth2',
    popular: true,
    featuredActions: getYouTubeActionNamesByPriority(2),
    toolLimit: 24,
  },

  // Development - Core
  {
    id: 'GITHUB',
    displayName: 'GitHub',
    description:
      'Full GitHub integration: repos, issues, PRs, code, CI/CD, releases, teams, search, gists, and more',
    icon: '🐙',
    category: 'development',
    authType: 'oauth2',
    popular: true,
    featuredActions: getGitHubActionNamesByPriority(2),
    toolLimit: 100,
  },
  {
    id: 'LINEAR',
    displayName: 'Linear',
    description: 'Full Linear integration: issues, projects, cycles, labels, workflows, and more',
    icon: '⚡',
    category: 'development',
    authType: 'oauth2',
    popular: true,
    featuredActions: getLinearActionNamesByPriority(2),
    toolLimit: 45,
  },

  // Productivity - Top Picks
  {
    id: 'NOTION',
    displayName: 'Notion',
    description: 'Full Notion integration: pages, databases, blocks, comments, search, and more',
    icon: '📝',
    category: 'productivity',
    authType: 'oauth2',
    popular: true,
    featuredActions: getNotionActionNamesByPriority(2),
    toolLimit: 26,
  },
  {
    id: 'JIRA',
    displayName: 'Jira',
    description: 'Full Jira integration: issues, projects, sprints, boards, comments, and more',
    icon: '🎯',
    category: 'development',
    authType: 'oauth2',
    popular: true,
    featuredActions: getJiraActionNamesByPriority(2),
    toolLimit: 38,
  },
];

// ============================================================================
// ALL AVAILABLE TOOLKITS (67 approved integrations)
// ============================================================================

export const ALL_TOOLKITS: ToolkitConfig[] = [
  // ==================== COMMUNICATION ====================
  {
    id: 'GMAIL',
    displayName: 'Gmail',
    description:
      'Full Gmail integration: send, read, search, drafts, labels, contacts, attachments, and more',
    icon: '📧',
    category: 'communication',
    authType: 'oauth2',
    popular: true,
    featuredActions: getGmailActionNamesByPriority(2),
    toolLimit: 40,
  },
  {
    id: 'SLACK',
    displayName: 'Slack',
    description:
      'Full Slack integration: messages, channels, users, files, canvases, reminders, and more',
    icon: '💬',
    category: 'communication',
    authType: 'oauth2',
    popular: true,
    featuredActions: getSlackActionNamesByPriority(2),
    toolLimit: 80,
  },
  {
    id: 'DISCORD',
    displayName: 'Discord',
    description: 'Full Discord integration: manage servers, send messages, moderate communities',
    icon: '🎮',
    category: 'communication',
    authType: 'oauth2',
    popular: true,
    featuredActions: getDiscordActionNamesByPriority(2),
    toolLimit: 15,
  },
  {
    id: 'MICROSOFT_TEAMS',
    displayName: 'Microsoft Teams',
    description:
      'Full Microsoft Teams integration: messaging, channels, meetings, file sharing, and more',
    icon: '👥',
    category: 'communication',
    authType: 'oauth2',
    popular: true,
    featuredActions: getMicrosoftTeamsActionNamesByPriority(2),
    toolLimit: 40,
  },
  {
    id: 'MICROSOFT_OUTLOOK',
    displayName: 'Outlook',
    description: 'Full Outlook integration: email, calendar, contacts, Teams chat, rules, and more',
    icon: '📬',
    category: 'communication',
    authType: 'oauth2',
    featuredActions: getOutlookActionNamesByPriority(2),
    toolLimit: 64,
  },

  // ==================== PRODUCTIVITY ====================
  {
    id: 'GOOGLE_DOCS',
    displayName: 'Google Docs',
    description: 'Full Google Docs integration: create, edit, format documents, tables, and more',
    icon: '📄',
    category: 'productivity',
    authType: 'oauth2',
    popular: true,
    featuredActions: getGoogleDocsActionNamesByPriority(2),
    toolLimit: 35,
  },
  {
    id: 'GOOGLE_SHEETS',
    displayName: 'Google Sheets',
    description:
      'Full Google Sheets integration: create spreadsheets, read/write cells, analyze data, automate reports',
    icon: '📊',
    category: 'productivity',
    authType: 'oauth2',
    popular: true,
    featuredActions: getGoogleSheetsActionNamesByPriority(2),
    toolLimit: 44,
  },
  {
    id: 'AIRTABLE',
    displayName: 'Airtable',
    description: 'Full Airtable integration: manage bases, records, tables, and collaboration',
    icon: '📋',
    category: 'productivity',
    authType: 'oauth2',
    popular: true,
    featuredActions: getAirtableActionNamesByPriority(2),
    toolLimit: 26,
  },
  {
    id: 'GOOGLE_SLIDES',
    displayName: 'Google Slides',
    description:
      'Full Google Slides integration: create presentations, manage slides, add elements, formatting',
    icon: '📽️',
    category: 'productivity',
    authType: 'oauth2',
    featuredActions: getGoogleSlidesActionNamesByPriority(2),
    toolLimit: 22,
  },
  {
    id: 'GOOGLE_TASKS',
    displayName: 'Google Tasks',
    description:
      'Full Google Tasks integration: create, manage, and organize tasks and to-do lists',
    icon: '✅',
    category: 'productivity',
    authType: 'oauth2',
    featuredActions: getGoogleTasksActionNamesByPriority(2),
    toolLimit: 16,
  },

  // ==================== SOCIAL MEDIA ====================
  {
    id: 'TWITTER',
    displayName: 'Twitter/X',
    description: 'Full Twitter/X integration: tweets, search, DMs, users, lists, spaces, and more',
    icon: '🐦',
    category: 'social',
    authType: 'oauth2',
    popular: true,
    featuredActions: getTwitterActionNamesByPriority(2),
    toolLimit: 75,
  },
  {
    id: 'LINKEDIN',
    displayName: 'LinkedIn',
    description: 'Full LinkedIn integration: posts, profile management, media sharing',
    icon: '💼',
    category: 'social',
    authType: 'oauth2',
    popular: true,
    featuredActions: getLinkedInActionNamesByPriority(2),
    toolLimit: 11,
  },
  {
    id: 'INSTAGRAM',
    displayName: 'Instagram',
    description: 'Full Instagram integration: publish, media, engagement, messaging, analytics',
    icon: '📸',
    category: 'social',
    authType: 'oauth2',
    popular: true,
    featuredActions: getInstagramActionNamesByPriority(2),
    toolLimit: 32,
  },
  {
    id: 'YOUTUBE',
    displayName: 'YouTube',
    description: 'Full YouTube integration: search, videos, channels, playlists, engagement',
    icon: '🎬',
    category: 'social',
    authType: 'oauth2',
    popular: true,
    featuredActions: getYouTubeActionNamesByPriority(2),
    toolLimit: 24,
  },
  {
    id: 'REDDIT',
    displayName: 'Reddit',
    description: 'Full Reddit integration: posts, comments, subreddits, messages, and more',
    icon: '🤖',
    category: 'social',
    authType: 'oauth2',
    featuredActions: getRedditActionNamesByPriority(2),
    toolLimit: 28,
  },

  // ==================== DEVELOPMENT ====================
  {
    id: 'GITHUB',
    displayName: 'GitHub',
    description:
      'Full GitHub integration: repos, issues, PRs, code, CI/CD, releases, teams, search, gists, and more',
    icon: '🐙',
    category: 'development',
    authType: 'oauth2',
    popular: true,
    featuredActions: getGitHubActionNamesByPriority(2),
    toolLimit: 100,
  },
  {
    id: 'LINEAR',
    displayName: 'Linear',
    description: 'Full Linear integration: issues, projects, cycles, labels, workflows, and more',
    icon: '⚡',
    category: 'development',
    authType: 'oauth2',
    popular: true,
    featuredActions: getLinearActionNamesByPriority(2),
    toolLimit: 45,
  },
  {
    id: 'SENTRY',
    displayName: 'Sentry',
    description:
      'Full Sentry integration: error tracking, issue management, releases, alerts, and more',
    icon: '🐛',
    category: 'development',
    authType: 'api_key',
    featuredActions: getSentryActionNamesByPriority(2),
    toolLimit: 30,
  },
  {
    id: 'VERCEL',
    displayName: 'Vercel',
    description:
      'Full Vercel integration: deployments, projects, domains, env vars, edge config, and more',
    icon: '▲',
    category: 'development',
    authType: 'oauth2',
    featuredActions: getVercelActionNamesByPriority(2),
    toolLimit: 50,
  },
  {
    id: 'SUPABASE',
    displayName: 'Supabase',
    description:
      'Full Supabase integration: database CRUD, auth, file storage, edge functions, and more',
    icon: '⚡',
    category: 'development',
    authType: 'api_key',
    featuredActions: getSupabaseActionNamesByPriority(2),
    toolLimit: 30,
  },
  {
    id: 'CLOUDFLARE',
    displayName: 'Cloudflare',
    description:
      'Full Cloudflare integration: DNS, zones, workers, firewall, cache, Pages, and more',
    icon: '🔶',
    category: 'development',
    authType: 'api_key',
    featuredActions: getCloudflareActionNamesByPriority(2),
    toolLimit: 30,
  },

  // ==================== CRM ====================
  {
    id: 'HUBSPOT',
    displayName: 'HubSpot',
    description:
      'Full HubSpot integration: contacts, deals, companies, tickets, emails, tasks, and more',
    icon: '🧲',
    category: 'crm',
    authType: 'oauth2',
    featuredActions: getHubSpotActionNamesByPriority(2),
    toolLimit: 45,
  },
  {
    id: 'SALESFORCE',
    displayName: 'Salesforce',
    description:
      'Full Salesforce integration: leads, contacts, accounts, opportunities, cases, and more',
    icon: '☁️',
    category: 'crm',
    authType: 'oauth2',
    featuredActions: getSalesforceActionNamesByPriority(2),
    toolLimit: 45,
  },

  // ==================== FINANCE ====================
  {
    id: 'STRIPE',
    displayName: 'Stripe',
    description:
      'Full Stripe integration: payments, customers, subscriptions, invoicing, products, and more',
    icon: '💳',
    category: 'finance',
    authType: 'api_key',
    featuredActions: getStripeActionNamesByPriority(2),
    toolLimit: 80,
  },

  // ==================== CALENDAR ====================
  {
    id: 'GOOGLE_CALENDAR',
    displayName: 'Google Calendar',
    description:
      'Full Google Calendar integration: events, calendars, attendees, reminders, scheduling',
    icon: '📅',
    category: 'calendar',
    authType: 'oauth2',
    featuredActions: getGoogleCalendarActionNamesByPriority(2),
    toolLimit: 30,
  },
  {
    id: 'GOOGLE_MEET',
    displayName: 'Google Meet',
    description:
      'Full Google Meet integration: meetings, participants, recordings, transcripts, spaces',
    icon: '📹',
    category: 'calendar',
    authType: 'oauth2',
    featuredActions: getGoogleMeetActionNamesByPriority(2),
    toolLimit: 16,
  },

  // ==================== STORAGE ====================
  {
    id: 'GOOGLE_DRIVE',
    displayName: 'Google Drive',
    description: 'Full Google Drive integration: files, sharing, drives, collaboration, and more',
    icon: '💾',
    category: 'storage',
    authType: 'oauth2',
    featuredActions: getGoogleDriveActionNamesByPriority(2),
    toolLimit: 59,
  },
  {
    id: 'DROPBOX',
    displayName: 'Dropbox',
    description: 'Full Dropbox integration: files, folders, sharing, collaboration, and more',
    icon: '📦',
    category: 'storage',
    authType: 'oauth2',
    featuredActions: getDropboxActionNamesByPriority(2),
    toolLimit: 24,
  },
  {
    id: 'GOOGLE_PHOTOS',
    displayName: 'Google Photos',
    description: 'Full Google Photos integration: media browsing, albums, sharing, and more',
    icon: '📷',
    category: 'storage',
    authType: 'oauth2',
    featuredActions: getGooglePhotosActionNamesByPriority(2),
    toolLimit: 16,
  },

  // ==================== ANALYTICS ====================
  {
    id: 'GOOGLE_ANALYTICS',
    displayName: 'Google Analytics',
    description:
      'Full Google Analytics integration: reports, real-time data, audiences, conversions, and more',
    icon: '📈',
    category: 'analytics',
    authType: 'oauth2',
    featuredActions: getGoogleAnalyticsActionNamesByPriority(2),
    toolLimit: 20,
  },
  {
    id: 'GOOGLE_SEARCH_CONSOLE',
    displayName: 'Google Search Console',
    description:
      'Full Search Console integration: search analytics, sitemaps, URL inspection, and more',
    icon: '🔍',
    category: 'analytics',
    authType: 'oauth2',
    featuredActions: getGoogleSearchConsoleActionNamesByPriority(2),
    toolLimit: 16,
  },

  // ==================== MARKETING ====================
  {
    id: 'GOOGLE_ADS',
    displayName: 'Google Ads',
    description:
      'Full Google Ads integration: campaigns, ad groups, ads, keywords, budgets, and more',
    icon: '📢',
    category: 'marketing',
    authType: 'oauth2',
    featuredActions: getGoogleAdsActionNamesByPriority(2),
    toolLimit: 24,
  },

  // ==================== ECOMMERCE ====================
  {
    id: 'SHOPIFY',
    displayName: 'Shopify',
    description:
      'Full Shopify integration: products, orders, customers, inventory, collections, and more',
    icon: '🛒',
    category: 'ecommerce',
    authType: 'oauth2',
    featuredActions: getShopifyActionNamesByPriority(2),
    toolLimit: 40,
  },

  // ==================== TRAVEL ====================
  {
    id: 'GOOGLE_MAPS',
    displayName: 'Google Maps',
    description: 'Full Google Maps integration: places, directions, geocoding, distance, and more',
    icon: '🗺️',
    category: 'travel',
    authType: 'api_key',
    featuredActions: getGoogleMapsActionNamesByPriority(2),
    toolLimit: 14,
  },

  // ==================== AI & TOOLS ====================
  {
    id: 'ELEVENLABS',
    displayName: 'ElevenLabs',
    description: 'Full ElevenLabs integration: text-to-speech, voice management, cloning, and more',
    icon: '🎙️',
    category: 'media',
    authType: 'api_key',
    featuredActions: getElevenLabsActionNamesByPriority(2),
    toolLimit: 16,
  },
  {
    id: 'SERPAPI',
    displayName: 'SerpAPI',
    description: 'Full SerpAPI integration: Google search, images, news, shopping, local, and more',
    icon: '🔎',
    category: 'analytics',
    authType: 'api_key',
    featuredActions: getSerpAPIActionNamesByPriority(2),
    toolLimit: 14,
  },
  {
    id: 'PERPLEXITY_AI',
    displayName: 'Perplexity AI',
    description: 'Full Perplexity AI integration: AI search, research, fact-checking, and more',
    icon: '🤖',
    category: 'analytics',
    authType: 'api_key',
    featuredActions: getPerplexityAIActionNamesByPriority(2),
    toolLimit: 10,
  },

  // ==================== PRODUCTIVITY (NEW) ====================
  {
    id: 'NOTION',
    displayName: 'Notion',
    description: 'Full Notion integration: pages, databases, blocks, comments, search, and more',
    icon: '📝',
    category: 'productivity',
    authType: 'oauth2',
    popular: true,
    featuredActions: getNotionActionNamesByPriority(2),
    toolLimit: 26,
  },
  {
    id: 'ASANA',
    displayName: 'Asana',
    description: 'Full Asana integration: tasks, projects, sections, tags, comments, and more',
    icon: '🎯',
    category: 'productivity',
    authType: 'oauth2',
    featuredActions: getAsanaActionNamesByPriority(2),
    toolLimit: 29,
  },
  {
    id: 'TRELLO',
    displayName: 'Trello',
    description:
      'Full Trello integration: cards, boards, lists, labels, checklists, comments, and more',
    icon: '📋',
    category: 'productivity',
    authType: 'oauth2',
    featuredActions: getTrelloActionNamesByPriority(2),
    toolLimit: 29,
  },
  {
    id: 'CLICKUP',
    displayName: 'ClickUp',
    description:
      'Full ClickUp integration: tasks, spaces, lists, folders, goals, time tracking, and more',
    icon: '✨',
    category: 'productivity',
    authType: 'oauth2',
    featuredActions: getClickUpActionNamesByPriority(2),
    toolLimit: 28,
  },

  // ==================== DEVELOPMENT (NEW) ====================
  {
    id: 'JIRA',
    displayName: 'Jira',
    description:
      'Full Jira integration: issues, projects, sprints, boards, comments, attachments, and more',
    icon: '🎯',
    category: 'development',
    authType: 'oauth2',
    popular: true,
    featuredActions: getJiraActionNamesByPriority(2),
    toolLimit: 38,
  },

  // ==================== COMMUNICATION (NEW) ====================
  {
    id: 'TELEGRAM',
    displayName: 'Telegram',
    description: 'Full Telegram integration: messages, media, chats, photos, documents, and more',
    icon: '✈️',
    category: 'communication',
    authType: 'api_key',
    featuredActions: getTelegramActionNamesByPriority(2),
    toolLimit: 18,
  },

  // ==================== CALENDAR (NEW) ====================
  {
    id: 'ZOOM',
    displayName: 'Zoom',
    description: 'Full Zoom integration: meetings, recordings, webinars, users, and more',
    icon: '📹',
    category: 'calendar',
    authType: 'oauth2',
    featuredActions: getZoomActionNamesByPriority(2),
    toolLimit: 17,
  },
  {
    id: 'CALENDLY',
    displayName: 'Calendly',
    description:
      'Full Calendly integration: events, event types, invitees, scheduling links, and more',
    icon: '📆',
    category: 'calendar',
    authType: 'oauth2',
    featuredActions: getCalendlyActionNamesByPriority(2),
    toolLimit: 18,
  },

  // ==================== MARKETING (NEW) ====================
  {
    id: 'MAILCHIMP',
    displayName: 'Mailchimp',
    description:
      'Full Mailchimp integration: campaigns, audiences, subscribers, templates, reports, and more',
    icon: '🐵',
    category: 'marketing',
    authType: 'oauth2',
    featuredActions: getMailchimpActionNamesByPriority(2),
    toolLimit: 26,
  },

  // ==================== SUPPORT (NEW) ====================
  {
    id: 'ZENDESK',
    displayName: 'Zendesk',
    description:
      'Full Zendesk integration: tickets, users, organizations, comments, groups, and more',
    icon: '🎧',
    category: 'support',
    authType: 'oauth2',
    featuredActions: getZendeskActionNamesByPriority(2),
    toolLimit: 26,
  },

  // ==================== COMMUNICATION (BATCH 3) ====================
  {
    id: 'WHATSAPP',
    displayName: 'WhatsApp Business',
    description:
      'Full WhatsApp Business integration: messages, media, contacts, templates, business profiles',
    icon: '📱',
    category: 'communication',
    authType: 'oauth2',
    popular: true,
    featuredActions: getWhatsAppActionNamesByPriority(2),
    toolLimit: 20,
  },

  // ==================== DEVELOPMENT (BATCH 3) ====================
  {
    id: 'FIGMA',
    displayName: 'Figma',
    description:
      'Full Figma integration: files, components, comments, projects, teams, styles, and more',
    icon: '🎨',
    category: 'development',
    authType: 'oauth2',
    featuredActions: getFigmaActionNamesByPriority(2),
    toolLimit: 21,
  },
  {
    id: 'GITLAB',
    displayName: 'GitLab',
    description:
      'Full GitLab integration: projects, issues, merge requests, branches, pipelines, CI/CD, and more',
    icon: '🦊',
    category: 'development',
    authType: 'oauth2',
    featuredActions: getGitLabActionNamesByPriority(2),
    toolLimit: 34,
  },

  // ==================== PRODUCTIVITY (BATCH 3) ====================
  {
    id: 'DOCUSIGN',
    displayName: 'DocuSign',
    description:
      'Full DocuSign integration: envelopes, documents, recipients, templates, signing, and more',
    icon: '✍️',
    category: 'productivity',
    authType: 'oauth2',
    featuredActions: getDocuSignActionNamesByPriority(2),
    toolLimit: 24,
  },
  {
    id: 'MONDAY',
    displayName: 'Monday.com',
    description:
      'Full Monday.com integration: items, boards, groups, columns, updates, users, and more',
    icon: '📊',
    category: 'productivity',
    authType: 'oauth2',
    featuredActions: getMondayActionNamesByPriority(2),
    toolLimit: 21,
  },
  {
    id: 'CONFLUENCE',
    displayName: 'Confluence',
    description:
      'Full Confluence integration: pages, spaces, comments, labels, attachments, and more',
    icon: '📖',
    category: 'productivity',
    authType: 'oauth2',
    featuredActions: getConfluenceActionNamesByPriority(2),
    toolLimit: 24,
  },

  // ==================== SUPPORT (BATCH 3) ====================
  {
    id: 'INTERCOM',
    displayName: 'Intercom',
    description:
      'Full Intercom integration: conversations, contacts, companies, articles, tags, and more',
    icon: '💬',
    category: 'support',
    authType: 'oauth2',
    featuredActions: getIntercomActionNamesByPriority(2),
    toolLimit: 26,
  },

  // ==================== FINANCE (BATCH 3) ====================
  {
    id: 'QUICKBOOKS',
    displayName: 'QuickBooks',
    description:
      'Full QuickBooks integration: invoices, customers, payments, items, accounts, reports, and more',
    icon: '💰',
    category: 'finance',
    authType: 'oauth2',
    featuredActions: getQuickBooksActionNamesByPriority(2),
    toolLimit: 23,
  },

  // ==================== MARKETING (BATCH 3) ====================
  {
    id: 'SENDGRID',
    displayName: 'SendGrid',
    description:
      'Full SendGrid integration: email sending, contacts, lists, templates, stats, and more',
    icon: '📤',
    category: 'marketing',
    authType: 'api_key',
    featuredActions: getSendGridActionNamesByPriority(2),
    toolLimit: 20,
  },

  // ==================== CRM (BATCH 3) ====================
  {
    id: 'PIPEDRIVE',
    displayName: 'Pipedrive',
    description:
      'Full Pipedrive integration: deals, contacts, organizations, activities, pipelines, and more',
    icon: '🤝',
    category: 'crm',
    authType: 'oauth2',
    featuredActions: getPipedriveActionNamesByPriority(2),
    toolLimit: 27,
  },

  // ==================== COMMUNICATION (BATCH 4) ====================
  {
    id: 'TWILIO',
    displayName: 'Twilio',
    description:
      'Full Twilio integration: SMS, MMS, voice calls, phone numbers, recordings, and more',
    icon: '📞',
    category: 'communication',
    authType: 'api_key',
    featuredActions: getTwilioActionNamesByPriority(2),
    toolLimit: 20,
  },

  // ==================== SUPPORT (BATCH 4) ====================
  {
    id: 'FRESHDESK',
    displayName: 'Freshdesk',
    description:
      'Full Freshdesk integration: tickets, contacts, companies, agents, groups, and more',
    icon: '🎫',
    category: 'support',
    authType: 'api_key',
    featuredActions: getFreshdeskActionNamesByPriority(2),
    toolLimit: 21,
  },

  // ==================== PRODUCTIVITY (BATCH 4) ====================
  {
    id: 'TYPEFORM',
    displayName: 'Typeform',
    description: 'Full Typeform integration: forms, responses, workspaces, themes, and more',
    icon: '📝',
    category: 'productivity',
    authType: 'oauth2',
    featuredActions: getTypeformActionNamesByPriority(2),
    toolLimit: 16,
  },
  {
    id: 'TODOIST',
    displayName: 'Todoist',
    description: 'Full Todoist integration: tasks, projects, sections, labels, comments, and more',
    icon: '✅',
    category: 'productivity',
    authType: 'oauth2',
    featuredActions: getTodoistActionNamesByPriority(2),
    toolLimit: 21,
  },
  {
    id: 'EVERNOTE',
    displayName: 'Evernote',
    description: 'Full Evernote integration: notes, notebooks, tags, search, and more',
    icon: '🐘',
    category: 'productivity',
    authType: 'oauth2',
    featuredActions: getEvernoteActionNamesByPriority(2),
    toolLimit: 16,
  },

  // ==================== STORAGE (BATCH 4) ====================
  {
    id: 'BOX',
    displayName: 'Box',
    description: 'Full Box integration: files, folders, sharing, collaboration, comments, and more',
    icon: '📦',
    category: 'storage',
    authType: 'oauth2',
    featuredActions: getBoxActionNamesByPriority(2),
    toolLimit: 22,
  },

  // ==================== DEVELOPMENT (BATCH 4) ====================
  {
    id: 'BITBUCKET',
    displayName: 'Bitbucket',
    description:
      'Full Bitbucket integration: repos, pull requests, issues, branches, pipelines, and more',
    icon: '🪣',
    category: 'development',
    authType: 'oauth2',
    featuredActions: getBitbucketActionNamesByPriority(2),
    toolLimit: 22,
  },
  {
    id: 'WEBFLOW',
    displayName: 'Webflow',
    description:
      'Full Webflow integration: sites, CMS collections, items, domains, forms, and more',
    icon: '🌐',
    category: 'development',
    authType: 'oauth2',
    featuredActions: getWebflowActionNamesByPriority(2),
    toolLimit: 18,
  },
  {
    id: 'PAGERDUTY',
    displayName: 'PagerDuty',
    description:
      'Full PagerDuty integration: incidents, services, on-call, schedules, escalations, and more',
    icon: '🚨',
    category: 'development',
    authType: 'api_key',
    featuredActions: getPagerDutyActionNamesByPriority(2),
    toolLimit: 21,
  },

  // ==================== MEDIA (BATCH 4) ====================
  {
    id: 'LOOM',
    displayName: 'Loom',
    description: 'Full Loom integration: videos, folders, sharing, transcripts, comments, and more',
    icon: '🎥',
    category: 'media',
    authType: 'oauth2',
    featuredActions: getLoomActionNamesByPriority(2),
    toolLimit: 15,
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
 * Handles multiple formats:
 * - Our internal format: GOOGLE_SHEETS
 * - Composio slug format: googlesheets (no underscores)
 * - Composio with underscores: google_sheets
 * - Composio with hyphens: google-sheets
 */
export function getToolkitById(id: string): ToolkitConfig | undefined {
  if (!id) return undefined;

  // Normalize input: uppercase and remove special chars for comparison
  const normalizedInput = id.toUpperCase().replace(/[-_]/g, '');

  return ALL_TOOLKITS.find((t) => {
    // Exact match
    if (t.id === id || t.id === id.toUpperCase()) return true;

    // Normalized match (remove underscores/hyphens from both)
    const normalizedToolkitId = t.id.replace(/[-_]/g, '');
    return normalizedToolkitId === normalizedInput;
  });
}

/**
 * Convert Composio slug to our internal toolkit ID format
 * e.g., "googlesheets" -> "GOOGLE_SHEETS"
 */
export function composioSlugToToolkitId(slug: string): string {
  const toolkit = getToolkitById(slug);
  return toolkit?.id || slug.toUpperCase();
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
