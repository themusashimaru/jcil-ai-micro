/** Citations/sources section for messages with search results */

'use client';

interface MessageCitationsProps {
  citations: unknown[];
}

export function MessageCitations({ citations }: MessageCitationsProps) {
  return (
    <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
      <div className="flex items-center gap-1 text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
          />
        </svg>
        <span>Sources ({citations.length})</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {citations.slice(0, 5).map((citation) => {
          let url = '';
          let title = '';

          if (typeof citation === 'string') {
            url = citation;
          } else if (citation && typeof citation === 'object') {
            const c = citation as unknown as Record<string, unknown>;
            url = String(c.url || c.link || c.source || c.href || c.source_url || '');
            title = String(c.title || c.name || c.source_name || '');
          }

          if (!title && url) {
            try {
              title = new URL(url).hostname.replace('www.', '');
            } catch {
              title = 'Source';
            }
          }

          if (!url || !url.startsWith('http')) return null;

          return (
            <a
              key={url}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all hover:scale-105 cursor-pointer"
              style={{
                backgroundColor: 'var(--primary-hover)',
                color: 'var(--primary)',
                border: '1px solid var(--primary)',
              }}
              title={url}
              onClick={(e) => {
                e.stopPropagation();
                window.open(url, '_blank', 'noopener,noreferrer');
              }}
            >
              <span className="truncate max-w-[150px]">{title}</span>
              <svg
                className="h-3 w-3 flex-shrink-0"
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
          );
        })}
        {citations.length > 5 && (
          <span className="px-2 py-1 text-xs" style={{ color: 'var(--text-muted)' }}>
            +{citations.length - 5} more
          </span>
        )}
      </div>
    </div>
  );
}
