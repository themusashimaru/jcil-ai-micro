'use client';

/**
 * BRAND LOGO COMPONENT
 *
 * Displays official brand logos for app integrations using Simple Icons CDN.
 * Falls back to styled initials if logo not available.
 */

/* eslint-disable @next/next/no-img-element */
import { useState } from 'react';

// Simple Icons CDN mapping - slug names for the CDN
// Format: https://cdn.simpleicons.org/{slug}/{color}
const SIMPLE_ICONS_SLUGS: Record<string, string> = {
  // Communication
  GMAIL: 'gmail',
  SLACK: 'slack',
  DISCORD: 'discord',
  MICROSOFT_TEAMS: 'microsoftteams',
  WHATSAPP: 'whatsapp',
  TELEGRAM: 'telegram',
  ZOOM: 'zoom',
  TWILIO: 'twilio',
  INTERCOM: 'intercom',
  MICROSOFT_OUTLOOK: 'microsoftoutlook',
  LOOM: 'loom',

  // Productivity
  NOTION: 'notion',
  GOOGLE_DOCS: 'googledocs',
  GOOGLE_SHEETS: 'googlesheets',
  AIRTABLE: 'airtable',
  TODOIST: 'todoist',
  ASANA: 'asana',
  TRELLO: 'trello',
  MONDAY: 'monday',
  CLICKUP: 'clickup',
  EVERNOTE: 'evernote',
  CONFLUENCE: 'confluence',
  MIRO: 'miro',
  FIGMA: 'figma',

  // Social Media
  TWITTER: 'x',
  LINKEDIN: 'linkedin',
  INSTAGRAM: 'instagram',
  YOUTUBE: 'youtube',
  TIKTOK: 'tiktok',
  FACEBOOK: 'facebook',
  PINTEREST: 'pinterest',
  REDDIT: 'reddit',
  BUFFER: 'buffer',

  // Development
  GITHUB: 'github',
  JIRA: 'jira',
  LINEAR: 'linear',
  GITLAB: 'gitlab',
  BITBUCKET: 'bitbucket',
  SENTRY: 'sentry',
  DATADOG: 'datadog',
  VERCEL: 'vercel',
  NETLIFY: 'netlify',
  HEROKU: 'heroku',
  SUPABASE: 'supabase',
  FIREBASE: 'firebase',

  // CRM
  HUBSPOT: 'hubspot',
  SALESFORCE: 'salesforce',
  PIPEDRIVE: 'pipedrive',

  // Finance
  STRIPE: 'stripe',
  QUICKBOOKS: 'quickbooks',
  PAYPAL: 'paypal',
  SQUARE: 'square',

  // Calendar
  GOOGLE_CALENDAR: 'googlecalendar',
  CALENDLY: 'calendly',
  CAL: 'caldotcom',

  // Storage
  GOOGLE_DRIVE: 'googledrive',
  DROPBOX: 'dropbox',
  ONEDRIVE: 'microsoftonedrive',
  BOX: 'box',

  // Analytics
  GOOGLE_ANALYTICS: 'googleanalytics',
  MIXPANEL: 'mixpanel',
  POSTHOG: 'posthog',

  // Marketing
  MAILCHIMP: 'mailchimp',
  SENDGRID: 'sendgrid',

  // E-commerce
  SHOPIFY: 'shopify',
  GUMROAD: 'gumroad',

  // Support
  ZENDESK: 'zendesk',

  // Media
  SPOTIFY: 'spotify',
  TWITCH: 'twitch',
  VIMEO: 'vimeo',
};

// Brand colors for fallback initials
const BRAND_COLORS: Record<string, string> = {
  GMAIL: '#EA4335',
  SLACK: '#4A154B',
  DISCORD: '#5865F2',
  MICROSOFT_TEAMS: '#6264A7',
  WHATSAPP: '#25D366',
  TELEGRAM: '#0088CC',
  ZOOM: '#2D8CFF',
  NOTION: '#000000',
  GOOGLE_DOCS: '#4285F4',
  GOOGLE_SHEETS: '#0F9D58',
  AIRTABLE: '#FFBF00',
  TODOIST: '#E44332',
  ASANA: '#F06A6A',
  TRELLO: '#0079BF',
  TWITTER: '#1DA1F2',
  LINKEDIN: '#0A66C2',
  INSTAGRAM: '#E4405F',
  YOUTUBE: '#FF0000',
  TIKTOK: '#000000',
  FACEBOOK: '#1877F2',
  GITHUB: '#181717',
  JIRA: '#0052CC',
  LINEAR: '#5E6AD2',
  GITLAB: '#FC6D26',
  STRIPE: '#635BFF',
  HUBSPOT: '#FF7A59',
  SALESFORCE: '#00A1E0',
  SPOTIFY: '#1DB954',
  SHOPIFY: '#96BF48',
  DROPBOX: '#0061FF',
  GOOGLE_CALENDAR: '#4285F4',
  GOOGLE_DRIVE: '#4285F4',
  ZENDESK: '#03363D',
};

interface BrandLogoProps {
  toolkitId: string;
  displayName: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function BrandLogo({
  toolkitId,
  displayName,
  size = 'md',
  className = '',
}: BrandLogoProps) {
  const [imgError, setImgError] = useState(false);
  const upperToolkitId = toolkitId.toUpperCase();
  const iconSlug = SIMPLE_ICONS_SLUGS[upperToolkitId];
  const brandColor = BRAND_COLORS[upperToolkitId] || '#6B7280';

  // Use Simple Icons CDN for reliable brand SVGs
  // Format: https://cdn.simpleicons.org/{slug} (uses official brand color)
  const logoUrl = iconSlug ? `https://cdn.simpleicons.org/${iconSlug}` : null;

  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  };

  const fontSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  // Get initials from display name (max 2 characters)
  const getInitials = (name: string) => {
    const words = name.split(/[\s_-]+/);
    if (words.length === 1) {
      return name.substring(0, 2).toUpperCase();
    }
    return (words[0][0] + (words[1]?.[0] || '')).toUpperCase();
  };

  // If we have a logo URL and no error, try to display it
  if (logoUrl && !imgError) {
    return (
      <div
        className={`${sizeClasses[size]} rounded-lg overflow-hidden flex items-center justify-center bg-white/10 ${className}`}
      >
        <img
          src={logoUrl}
          alt={displayName}
          className="object-contain w-3/4 h-3/4"
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  // Fallback to styled initials with brand color
  return (
    <div
      className={`${sizeClasses[size]} rounded-lg flex items-center justify-center font-bold ${fontSizes[size]} text-white ${className}`}
      style={{ backgroundColor: brandColor }}
      title={displayName}
    >
      {getInitials(displayName)}
    </div>
  );
}
