'use client';

/**
 * BRAND LOGO COMPONENT
 *
 * Displays official brand logos for app integrations.
 * Falls back to styled initials if logo not available.
 */

/* eslint-disable @next/next/no-img-element */
import { useState } from 'react';

// Brand logo URLs (using official sources and CDNs)
const BRAND_LOGOS: Record<string, string> = {
  // Communication
  GMAIL: 'https://www.gstatic.com/images/branding/product/1x/gmail_2020q4_48dp.png',
  SLACK: 'https://a.slack-edge.com/80588/marketing/img/icons/icon_slack_hash_colored.png',
  DISCORD:
    'https://assets-global.website-files.com/6257adef93867e50d84d30e2/636e0a69f118df70ad7828d4_icon_clyde_blurple_RGB.svg',
  MICROSOFT_TEAMS:
    'https://upload.wikimedia.org/wikipedia/commons/c/c9/Microsoft_Office_Teams_%282018%E2%80%93present%29.svg',
  WHATSAPP: 'https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg',
  TELEGRAM: 'https://upload.wikimedia.org/wikipedia/commons/8/82/Telegram_logo.svg',
  ZOOM: 'https://st1.zoom.us/zoom.ico',
  TWILIO: 'https://www.twilio.com/assets/icons/twilio-icon-512.png',
  INTERCOM:
    'https://static.intercomassets.com/assets/default-avatars/fin/128-6a5eabbb9e3486392f0ed21c4bf18232b0a4160980eb653c0823e372eaeb1452.png',
  MICROSOFT_OUTLOOK:
    'https://upload.wikimedia.org/wikipedia/commons/d/df/Microsoft_Office_Outlook_%282018%E2%80%93present%29.svg',
  LOOM: 'https://cdn.loom.com/assets/favicons-loom/favicon.svg',

  // Productivity
  NOTION: 'https://upload.wikimedia.org/wikipedia/commons/4/45/Notion_app_logo.png',
  GOOGLE_DOCS: 'https://ssl.gstatic.com/docs/documents/images/kix-favicon7.ico',
  GOOGLE_SHEETS: 'https://ssl.gstatic.com/docs/spreadsheets/images/favicon_jfk2.png',
  AIRTABLE: 'https://www.airtable.com/images/favicon/baymax/apple-touch-icon.png',
  TODOIST: 'https://d3ptyyxy2at9ui.cloudfront.net/assets/images/todoist-logo.svg',
  ASANA: 'https://luna1.co/eb0187.png',
  TRELLO: 'https://d2k1ftgv7pobq7.cloudfront.net/images/favicon.png',
  MONDAY:
    'https://dapulse-res.cloudinary.com/image/upload/f_auto,q_auto/remote_mondaycom_static/img/monday-logo-x2.png',
  CLICKUP: 'https://clickup.com/landing/images/for-se/clickup-symbol_color.svg',
  EVERNOTE: 'https://evernote.com/img/favicon.ico',
  CONFLUENCE: 'https://wac-cdn.atlassian.com/assets/img/favicons/confluence/favicon-32x32.png',
  MIRO: 'https://miro.com/favicon.ico',
  FIGMA: 'https://static.figma.com/app/icon/1/favicon.svg',

  // Social Media
  TWITTER: 'https://abs.twimg.com/favicons/twitter.3.ico',
  LINKEDIN: 'https://static.licdn.com/sc/h/eahiplrwoq61f4uan012ia17y',
  INSTAGRAM: 'https://static.cdninstagram.com/rsrc.php/v3/yI/r/VsNE-OHk_8a.png',
  YOUTUBE: 'https://www.youtube.com/s/desktop/12a9f36e/img/favicon_144x144.png',
  TIKTOK:
    'https://sf16-website-login.neutral.ttwstatic.com/obj/tiktok_web_login_static/tiktok/webapp/main/webapp-desktop/47624c235266dedd8f59.png',
  FACEBOOK: 'https://static.xx.fbcdn.net/rsrc.php/yD/r/d4ZIVX-5C-b.ico',
  PINTEREST: 'https://s.pinimg.com/webapp/favicon-54a5b2af.png',
  REDDIT: 'https://www.redditstatic.com/shreddit/assets/favicon/64x64.png',
  BUFFER: 'https://buffer.com/static/icons/icon-144x144.png',

  // Development
  GITHUB: 'https://github.githubassets.com/favicons/favicon.svg',
  JIRA: 'https://wac-cdn.atlassian.com/assets/img/favicons/jira/favicon-32x32.png',
  LINEAR: 'https://linear.app/favicon.ico',
  GITLAB: 'https://about.gitlab.com/nuxt-images/ico/favicon.ico',
  BITBUCKET: 'https://wac-cdn.atlassian.com/assets/img/favicons/bitbucket/favicon-32x32.png',
  SENTRY: 'https://sentry.io/favicon.ico',
  DATADOG: 'https://imgix.datadoghq.com/img/dd_logo_n_70x75.png',
  VERCEL: 'https://vercel.com/favicon.ico',
  NETLIFY: 'https://www.netlify.com/favicon.ico',
  HEROKU: 'https://www.herokucdn.com/favicon.ico',
  SUPABASE: 'https://supabase.com/favicon/favicon-32x32.png',
  FIREBASE:
    'https://www.gstatic.com/devrel-devsite/prod/v0d244f667a3683225cca86d0ecf9b9b81b1e734e55a030bdcd3f3094b835c987/firebase/images/favicon.png',

  // CRM
  HUBSPOT: 'https://www.hubspot.com/favicon.ico',
  SALESFORCE: 'https://www.salesforce.com/etc/designs/sfdc-www/en_us/favicon.ico',
  PIPEDRIVE: 'https://www.pipedrive.com/favicon.ico',

  // Finance
  STRIPE: 'https://stripe.com/favicon.ico',
  QUICKBOOKS: 'https://quickbooks.intuit.com/etc/designs/quickbooks-v4/favicon.ico',
  PAYPAL: 'https://www.paypalobjects.com/webstatic/icon/pp144.png',
  SQUARE: 'https://squareup.com/favicon.ico',

  // Calendar
  GOOGLE_CALENDAR: 'https://ssl.gstatic.com/calendar/images/favicons_2020q4/calendar_31.ico',
  CALENDLY: 'https://assets.calendly.com/assets/favicon-32x32.png',
  CAL: 'https://cal.com/favicon.ico',

  // Storage
  GOOGLE_DRIVE: 'https://ssl.gstatic.com/docs/doclist/images/drive_2022q3_32dp.png',
  DROPBOX: 'https://cfl.dropboxstatic.com/static/images/favicon-vfl8lUR9B.ico',
  ONEDRIVE:
    'https://res-1.cdn.office.net/files/fabric-cdn-prod_20240214.001/assets/brand-icons/product/svg/onedrive_48x1.svg',
  BOX: 'https://www.box.com/themes/developer/favicon.ico',

  // Analytics
  GOOGLE_ANALYTICS: 'https://www.gstatic.com/analytics-suite/header/suite/v2/ic_analytics.svg',
  MIXPANEL: 'https://mixpanel.com/favicon.ico',
  POSTHOG: 'https://posthog.com/favicon.ico',

  // Marketing
  MAILCHIMP: 'https://eep.io/mc-cdn-images/favicon-256.png',
  SENDGRID: 'https://sendgrid.com/favicon.ico',

  // E-commerce
  SHOPIFY: 'https://cdn.shopify.com/static/shopify-favicon.png',
  GUMROAD: 'https://gumroad.com/favicon.ico',

  // Support
  ZENDESK:
    'https://d3v0px0pttie1i.cloudfront.net/uploads/branding_settings/open_graph_images/48656/zendesk_light_background.png',

  // Media
  SPOTIFY: 'https://open.spotifycdn.com/cdn/images/favicon32.b64ecc03.png',
  TWITCH: 'https://static.twitchcdn.net/assets/favicon-32-e29e246c157142c94346.png',
  VIMEO: 'https://f.vimeocdn.com/images_v6/favicon.ico',
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
  const logoUrl = BRAND_LOGOS[toolkitId.toUpperCase()];
  const brandColor = BRAND_COLORS[toolkitId.toUpperCase()] || '#6B7280';

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
        className={`${sizeClasses[size]} rounded-lg overflow-hidden flex items-center justify-center bg-white ${className}`}
      >
        <img
          src={logoUrl}
          alt={displayName}
          className="object-contain w-full h-full p-1"
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
