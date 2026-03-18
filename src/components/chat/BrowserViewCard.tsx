'use client';

/**
 * BROWSER VIEW CARD
 *
 * Displays a link preview card when browser_visit extracts content from a page.
 * Shows: favicon, page title, domain, content snippet, and a link to the source.
 * Matches the dark glassmorphism design language of ChainProgressCard.
 */

export interface BrowserViewData {
  url: string;
  title: string;
  domain: string;
  snippet: string;
  linksCount?: number;
}

interface BrowserViewCardProps {
  data: BrowserViewData;
}

export default function BrowserViewCard({ data }: BrowserViewCardProps) {
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(data.domain)}&sz=32`;

  return (
    <a
      href={data.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block my-3 rounded-xl overflow-hidden bg-zinc-900 border border-zinc-700 max-w-[500px] hover:border-zinc-500 transition-colors group no-underline"
      aria-label={`Visit ${data.title || data.domain}`}
    >
      {/* Header with favicon + domain */}
      <div className="px-4 py-2.5 flex items-center gap-2.5 bg-zinc-800 border-b border-zinc-700">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={faviconUrl}
          alt=""
          className="w-4 h-4 rounded-sm"
          loading="lazy"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
        <span className="text-xs text-gray-400 truncate">{data.domain}</span>
        <svg
          className="w-3 h-3 text-gray-500 ml-auto opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
          />
        </svg>
      </div>

      {/* Content */}
      <div className="px-4 py-3">
        {data.title && (
          <div className="font-semibold text-white text-sm mb-1 line-clamp-2">{data.title}</div>
        )}
        {data.snippet && (
          <div className="text-xs text-gray-400 line-clamp-3 leading-relaxed">{data.snippet}</div>
        )}
        {data.linksCount !== undefined && data.linksCount > 0 && (
          <div className="text-xs text-gray-500 mt-2">
            {data.linksCount} link{data.linksCount !== 1 ? 's' : ''} found
          </div>
        )}
      </div>
    </a>
  );
}

// ============================================================================
// PARSING HELPERS
// ============================================================================

/**
 * Parse a browser-view code block from markdown.
 * Format: ```browser-view\n{JSON}\n```
 */
export function parseBrowserView(block: string): BrowserViewData | null {
  try {
    const match = block.match(/```browser-view\n([\s\S]*?)\n```/);
    if (!match) return null;
    const data = JSON.parse(match[1]);
    if (!data.url || !data.domain) return null;
    return data as BrowserViewData;
  } catch {
    return null;
  }
}
