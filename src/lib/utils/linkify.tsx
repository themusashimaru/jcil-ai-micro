/**
 * LINKIFY UTILITY
 *
 * PURPOSE:
 * - Convert plain text URLs to clickable HTML links
 * - Support http://, https://, and www. prefixes
 * - Open links in new tab with security attributes
 * - Extract clean source names from URLs for news display
 *
 * USAGE:
 * - linkify(text) - Returns HTML string with clickable links
 * - linkifyToReact(text) - Returns React elements array
 */

import React from 'react';

/**
 * Map of domain patterns to clean source names
 */
const SOURCE_NAME_MAP: Record<string, string> = {
  'usgs.gov': 'USGS',
  'weather.gov': 'National Weather Service',
  'noaa.gov': 'NOAA',
  'fbi.gov': 'FBI',
  'cia.gov': 'CIA',
  'nsa.gov': 'NSA',
  'dhs.gov': 'DHS',
  'justice.gov': 'DOJ',
  'defense.gov': 'Defense.gov',
  'state.gov': 'State Department',
  'cdc.gov': 'CDC',
  'nih.gov': 'NIH',
  'reuters.com': 'Reuters',
  'apnews.com': 'Associated Press',
  'ap.org': 'Associated Press',
  'foxnews.com': 'Fox News',
  'wsj.com': 'Wall Street Journal',
  'bloomberg.com': 'Bloomberg',
  'nypost.com': 'New York Post',
  'washingtonexaminer.com': 'Washington Examiner',
  'dailywire.com': 'Daily Wire',
  'bbc.com': 'BBC News',
  'bbc.co.uk': 'BBC News',
  'telegraph.co.uk': 'The Telegraph',
  'dailymail.co.uk': 'Daily Mail',
  'theguardian.com': 'The Guardian',
  'cnn.com': 'CNN',
  'nytimes.com': 'New York Times',
  'washingtonpost.com': 'Washington Post',
  'militarytimes.com': 'Military Times',
  'stripes.com': 'Stars and Stripes',
  'foreignpolicy.com': 'Foreign Policy',
  'thediplomat.com': 'The Diplomat',
  'wired.com': 'Wired',
  'arstechnica.com': 'Ars Technica',
  'theverge.com': 'The Verge',
  'techcrunch.com': 'TechCrunch',
  'krebsonsecurity.com': 'Krebs on Security',
  'cyberscoop.com': 'CyberScoop',
  'christianitytoday.com': 'Christianity Today',
  'christianpost.com': 'The Christian Post',
  'goodnewsnetwork.org': 'Good News Network',
  'abc.net.au': 'ABC Australia',
  'smh.com.au': 'Sydney Morning Herald',
  'yonhapnews.co.kr': 'Yonhap News',
  'koreaherald.com': 'Korea Herald',
  'taipeitimes.com': 'Taipei Times',
  'japantimes.co.jp': 'Japan Times',
  'nhk.or.jp': 'NHK',
  'scmp.com': 'South China Morning Post',
  'rferl.org': 'Radio Free Europe',
  'voanews.com': 'Voice of America',
  'epochtimes.com': 'The Epoch Times',
  'accuweather.com': 'AccuWeather',
  'weather.com': 'The Weather Channel',
  'cbc.ca': 'CBC News',
  'globeandmail.com': 'Globe and Mail',
  'france24.com': 'France 24',
  'dw.com': 'Deutsche Welle',
  'rte.ie': 'RTE Ireland',
  'irishtimes.com': 'Irish Times',
};

/**
 * Extract a clean source name from a URL
 */
function getSourceNameFromUrl(url: string): string {
  try {
    // Parse the URL to get the hostname
    const urlObj = new URL(url.startsWith('www.') ? `https://${url}` : url);
    let hostname = urlObj.hostname.replace(/^www\./, '');

    // Check for exact match first
    if (SOURCE_NAME_MAP[hostname]) {
      return SOURCE_NAME_MAP[hostname];
    }

    // Check for partial match (e.g., "edition.cnn.com" -> "cnn.com")
    for (const [domain, name] of Object.entries(SOURCE_NAME_MAP)) {
      if (hostname.endsWith(domain) || hostname.includes(domain.split('.')[0])) {
        return name;
      }
    }

    // Fallback: Clean up the domain name
    // Remove common prefixes and suffixes, capitalize
    hostname = hostname
      .replace(/\.(com|org|gov|net|co\.uk|co|io)$/i, '')
      .replace(/^(www|news|edition|m)\./i, '');

    // Capitalize each word
    return hostname
      .split(/[-.]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  } catch {
    // If URL parsing fails, try basic cleanup
    return url
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .split('/')[0]
      .replace(/\.(com|org|gov|net)$/i, '');
  }
}

/**
 * Detect and convert URLs in text to clickable HTML links with clean source names
 */
export function linkify(text: string): string {
  // URL detection regex - matches http://, https://, and www.
  const urlRegex = /(https?:\/\/[^\s<>)"']+|www\.[^\s<>)"']+)/gi;

  return text.replace(urlRegex, (url) => {
    // Add https:// to www. links
    const href = url.startsWith('www.') ? `https://${url}` : url;

    // Get clean source name for display
    const displayName = getSourceNameFromUrl(url);

    return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:text-blue-300 underline">${displayName}</a>`;
  });
}

/**
 * Convert text with URLs to React elements with clean source names
 * Use this for React components that can't use dangerouslySetInnerHTML
 */
export function linkifyToReact(text: string): (string | JSX.Element)[] {
  const urlRegex = /(https?:\/\/[^\s<>)"']+|www\.[^\s<>)"']+)/gi;
  const parts: (string | JSX.Element)[] = [];
  let lastIndex = 0;
  let match;

  while ((match = urlRegex.exec(text)) !== null) {
    // Add text before URL
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    // Add URL as link with clean source name
    const url = match[0];
    const href = url.startsWith('www.') ? `https://${url}` : url;
    const displayName = getSourceNameFromUrl(url);

    parts.push(
      <a
        key={match.index}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-400 hover:text-blue-300 underline cursor-pointer"
        style={{ pointerEvents: 'auto' }}
      >
        {displayName}
      </a>
    );

    lastIndex = match.index + url.length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}
