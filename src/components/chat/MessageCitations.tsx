/** Citations/sources section — Grok-style collapsed badge + expandable source list */

'use client';

import { useState, useMemo, useCallback } from 'react';

interface ParsedCitation {
  url: string;
  hostname: string;
  title: string;
  faviconUrl: string;
}

interface MessageCitationsProps {
  citations: unknown[];
}

function parseCitation(citation: unknown): ParsedCitation | null {
  let url = '';
  let title = '';

  if (typeof citation === 'string') {
    url = citation;
  } else if (citation && typeof citation === 'object') {
    const c = citation as Record<string, unknown>;
    url = String(c.url || c.link || c.source || c.href || c.source_url || '');
    title = String(c.title || c.name || c.source_name || '');
  }

  if (!url || !url.startsWith('http')) return null;

  let hostname = '';
  try {
    hostname = new URL(url).hostname.replace('www.', '');
  } catch {
    hostname = 'source';
  }

  if (!title) {
    title = hostname;
  }

  const faviconUrl = `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;

  return { url, hostname, title, faviconUrl };
}

/** Small favicon with fallback to a globe icon */
function Favicon({ src, hostname }: { src: string; hostname: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-white/10 text-[10px] text-text-muted flex-shrink-0">
        {hostname.charAt(0).toUpperCase()}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt=""
      width={16}
      height={16}
      className="w-4 h-4 rounded-sm flex-shrink-0"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

export function MessageCitations({ citations }: MessageCitationsProps) {
  const [expanded, setExpanded] = useState(false);

  const parsed = useMemo(
    () => citations.map(parseCitation).filter((c): c is ParsedCitation => c !== null),
    [citations]
  );

  const toggle = useCallback(() => setExpanded((prev) => !prev), []);

  if (parsed.length === 0) return null;

  // Unique favicons for the collapsed badge (dedupe by hostname, show up to 4)
  const uniqueByHost = useMemo(() => {
    const seen = new Set<string>();
    return parsed.filter((c) => {
      if (seen.has(c.hostname)) return false;
      seen.add(c.hostname);
      return true;
    });
  }, [parsed]);

  const previewFavicons = uniqueByHost.slice(0, 4);

  return (
    <div className="mt-3">
      {/* Collapsed badge — stacked favicons + "N Sources" */}
      <button
        type="button"
        onClick={toggle}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:brightness-125 cursor-pointer bg-white/[0.06] border border-white/10 text-text-secondary"
      >
        <span className="flex items-center -space-x-1.5">
          {previewFavicons.map((c) => (
            <span
              key={c.hostname}
              className="inline-block rounded-full ring-2 ring-[var(--bg-primary,#1a1a2e)] overflow-hidden"
            >
              <Favicon src={c.faviconUrl} hostname={c.hostname} />
            </span>
          ))}
        </span>
        <span>{parsed.length} Sources</span>
        <svg
          className={`h-3 w-3 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded source list */}
      {expanded && (
        <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
          <div className="max-h-[320px] overflow-y-auto divide-y divide-white/5">
            {parsed.map((c) => (
              <a
                key={c.url}
                href={c.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.04] transition-colors group"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(c.url, '_blank', 'noopener,noreferrer');
                  e.preventDefault();
                }}
              >
                <Favicon src={c.faviconUrl} hostname={c.hostname} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-text-primary truncate group-hover:text-primary transition-colors">
                    {c.title}
                  </div>
                  <div className="text-xs text-text-muted truncate">{c.hostname}</div>
                </div>
                <svg
                  className="h-3.5 w-3.5 flex-shrink-0 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
