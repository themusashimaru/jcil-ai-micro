'use client';

import { useState } from 'react';

/** Inline screenshot/image component with click-to-expand lightbox */
export function InlineScreenshot({ src, alt }: { src?: string; alt?: string }) {
  const [expanded, setExpanded] = useState(false);

  if (!src) return null;

  const isScreenshot =
    alt?.toLowerCase().includes('screenshot') || alt?.toLowerCase().includes('desktop');
  const label = alt || 'Image';

  return (
    <>
      <figure
        className="my-3 max-w-full cursor-pointer group"
        onClick={() => setExpanded(true)}
        role="button"
        tabIndex={0}
        aria-label={`View full size: ${label}`}
        onKeyDown={(e) => e.key === 'Enter' && setExpanded(true)}
      >
        <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black/20">
          {isScreenshot && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border-b border-white/10 text-xs text-white/50">
              <span>🌐</span>
              <span className="truncate">{label}</span>
            </div>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={label}
            className="w-full h-auto max-h-[400px] object-contain"
            loading="lazy"
          />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
            <span className="bg-black/60 text-white text-xs px-3 py-1.5 rounded-full">
              Click to expand
            </span>
          </div>
        </div>
      </figure>

      {/* Lightbox overlay */}
      {expanded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setExpanded(false)}
          role="dialog"
          aria-label="Expanded image view"
        >
          <button
            className="absolute top-4 right-4 text-white/70 hover:text-white text-2xl z-10"
            onClick={() => setExpanded(false)}
            aria-label="Close"
          >
            ✕
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={label}
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
