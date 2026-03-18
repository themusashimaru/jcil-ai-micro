'use client';

/**
 * SCREENSHOT GALLERY
 *
 * When a message contains multiple screenshots/images, renders them
 * in a horizontal scrollable gallery with thumbnails and lightbox.
 */

import { useState, useRef, useCallback, useEffect } from 'react';

export interface GalleryImage {
  src: string;
  alt: string;
}

interface ScreenshotGalleryProps {
  images: GalleryImage[];
}

export default function ScreenshotGallery({ images }: ScreenshotGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (selectedIndex === null) return;
      if (e.key === 'Escape') {
        setSelectedIndex(null);
      } else if (e.key === 'ArrowRight') {
        setSelectedIndex((prev) => (prev !== null && prev < images.length - 1 ? prev + 1 : prev));
      } else if (e.key === 'ArrowLeft') {
        setSelectedIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : prev));
      }
    },
    [selectedIndex, images.length]
  );

  useEffect(() => {
    if (selectedIndex !== null) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [selectedIndex, handleKeyDown]);

  if (images.length === 0) return null;

  // Single image — use simple InlineScreenshot style
  if (images.length === 1) {
    return (
      <figure
        className="my-3 max-w-full cursor-pointer group"
        onClick={() => setSelectedIndex(0)}
        role="button"
        tabIndex={0}
        aria-label={`View full size: ${images[0].alt}`}
        onKeyDown={(e) => e.key === 'Enter' && setSelectedIndex(0)}
      >
        <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black/20">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={images[0].src}
            alt={images[0].alt}
            className="w-full h-auto max-h-[400px] object-contain"
            loading="lazy"
          />
        </div>
      </figure>
    );
  }

  return (
    <>
      {/* Gallery container */}
      <div className="my-3 rounded-xl overflow-hidden border border-white/10 bg-black/20">
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border-b border-white/10 text-xs text-white/50">
          <span>{'📸'}</span>
          <span>
            {images.length} screenshot{images.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Scrollable row */}
        <div
          ref={scrollRef}
          className="flex gap-2 p-2 overflow-x-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
          role="list"
          aria-label="Screenshot gallery"
        >
          {images.map((img, i) => (
            <button
              key={`gallery-${i}`}
              className="flex-shrink-0 relative overflow-hidden rounded-lg border border-white/10 hover:border-white/30 transition-colors cursor-pointer group focus:outline-none focus:ring-2 focus:ring-primary/50"
              onClick={() => setSelectedIndex(i)}
              role="listitem"
              aria-label={`Screenshot ${i + 1}: ${img.alt}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.src}
                alt={img.alt}
                className="h-[160px] w-auto object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                <span className="bg-black/60 text-white text-xs px-2 py-1 rounded-full">
                  {i + 1}/{images.length}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Lightbox */}
      {selectedIndex !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setSelectedIndex(null)}
          role="dialog"
          aria-label={`Screenshot ${selectedIndex + 1} of ${images.length}`}
        >
          {/* Close */}
          <button
            className="absolute top-4 right-4 text-white/70 hover:text-white text-2xl z-10"
            onClick={() => setSelectedIndex(null)}
            aria-label="Close"
          >
            {'✕'}
          </button>

          {/* Counter */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/60 text-sm z-10">
            {selectedIndex + 1} / {images.length}
          </div>

          {/* Previous */}
          {selectedIndex > 0 && (
            <button
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white text-4xl z-10"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : prev));
              }}
              aria-label="Previous screenshot"
            >
              {'‹'}
            </button>
          )}

          {/* Image */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={images[selectedIndex].src}
            alt={images[selectedIndex].alt}
            className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />

          {/* Next */}
          {selectedIndex < images.length - 1 && (
            <button
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white text-4xl z-10"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedIndex((prev) =>
                  prev !== null && prev < images.length - 1 ? prev + 1 : prev
                );
              }}
              aria-label="Next screenshot"
            >
              {'›'}
            </button>
          )}

          {/* Thumbnail strip */}
          {images.length > 2 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 bg-black/50 rounded-full px-3 py-2">
              {images.map((_, i) => (
                <button
                  key={`dot-${i}`}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i === selectedIndex ? 'bg-white' : 'bg-white/30 hover:bg-white/60'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedIndex(i);
                  }}
                  aria-label={`Go to screenshot ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ============================================================================
// PARSING HELPERS
// ============================================================================

/**
 * Parse a screenshot-gallery code block from markdown.
 * Format: ```screenshot-gallery\n[{src, alt}, ...]\n```
 */
export function parseScreenshotGallery(block: string): GalleryImage[] | null {
  try {
    const match = block.match(/```screenshot-gallery\n([\s\S]*?)\n```/);
    if (!match) return null;
    const data = JSON.parse(match[1]);
    if (!Array.isArray(data) || data.length === 0) return null;
    return data as GalleryImage[];
  } catch {
    return null;
  }
}

/**
 * Extract all markdown image URLs from content.
 * Returns array of {src, alt} for images that look like screenshots.
 */
export function extractGalleryImages(content: string): GalleryImage[] {
  const images: GalleryImage[] = [];
  // Match both ![alt](src) and inline <img> patterns
  const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  let match;
  while ((match = imgRegex.exec(content)) !== null) {
    images.push({ alt: match[1], src: match[2] });
  }
  return images;
}
