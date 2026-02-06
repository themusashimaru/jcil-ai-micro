'use client';

/**
 * BRAND LOGO COMPONENT
 *
 * Displays official brand logos for app integrations.
 * Uses Simple Icons CDN for most icons, with embedded SVGs for those not available.
 */

/* eslint-disable @next/next/no-img-element */
import { useState } from 'react';

// Simple Icons CDN mapping - slug names for the CDN
// Format: https://cdn.simpleicons.org/{slug}
// NOTE: Only include icons that ARE available on Simple Icons CDN
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

  // Social Media (LinkedIn removed - not on Simple Icons)
  TWITTER: 'x',
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

// Embedded SVG icons for brands not available on Simple Icons CDN
// These are official brand icons embedded directly for reliability
const EMBEDDED_SVGS: Record<string, React.ReactNode> = {
  // LinkedIn - official "in" logo (not on Simple Icons due to trademark)
  LINKEDIN: (
    <svg viewBox="0 0 24 24" fill="#0A66C2" className="w-full h-full">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  ),
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
  TWITTER: '#000000',
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
  PINTEREST: '#E60023',
  REDDIT: '#FF4500',
  PAYPAL: '#00457C',
  WHATSAPP_BUSINESS: '#25D366',
  TELEGRAM_BOT: '#0088CC',
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
  const embeddedSvg = EMBEDDED_SVGS[upperToolkitId];
  const brandColor = BRAND_COLORS[upperToolkitId] || '#6B7280';

  // Use Simple Icons CDN for icons that are available there
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

  // Priority 1: Use embedded SVG if available (for icons not on Simple Icons)
  if (embeddedSvg) {
    return (
      <div
        className={`${sizeClasses[size]} rounded-lg overflow-hidden flex items-center justify-center bg-white p-1.5 ${className}`}
      >
        {embeddedSvg}
      </div>
    );
  }

  // Priority 2: Use Simple Icons CDN if slug exists and no error
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
          loading="lazy"
        />
      </div>
    );
  }

  // Priority 3: Fallback to styled initials with brand color
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
