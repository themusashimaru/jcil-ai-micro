/**
 * QUICK AMAZON SHOP MODAL
 *
 * PURPOSE:
 * - Search Amazon products with one click
 * - Display results in product carousel
 * - Deep link to Amazon app on mobile
 */

'use client';

import { useState, useRef } from 'react';

interface QuickAmazonShopProps {
  onShopComplete?: (response: string, query: string, products: Product[]) => void;
}

interface Product {
  title: string;
  price: string;
  rating?: string;
  image?: string;
  url: string;
}

const ASIN_REGEX = /(?:dp|gp\/product|product)\/?([A-Z0-9]{10})/i;
const GENERIC_ASIN_REGEX = /\b([A-Z0-9]{10})\b/;

const decodeAmazonString = (value: string) =>
  value
    .replace(/\\u002F/g, '/')
    .replace(/\\u0026/g, '&')
    .replace(/&amp;/g, '&')
    .replace(/^"|"$/g, '');

const extractAsin = (value: string): string | null => {
  const asinMatch = value.match(ASIN_REGEX);
  if (asinMatch?.[1]) {
    return asinMatch[1].toUpperCase();
  }

  const genericMatch = value.match(GENERIC_ASIN_REGEX);
  if (genericMatch?.[1]) {
    return genericMatch[1].toUpperCase();
  }

  return null;
};

const sanitizeAmazonUrl = (value: unknown): string | null => {
  if (!value) return null;

  let raw = decodeAmazonString(String(value).trim());
  if (!raw) return null;

  raw = raw.replace(/\s/g, '');

  if (raw.startsWith('//')) {
    raw = `https:${raw}`;
  }

  const asinFromRaw = extractAsin(raw);
  if (asinFromRaw) {
    return `https://www.amazon.com/dp/${asinFromRaw}`;
  }

  if (!raw.startsWith('http')) {
    if (raw.startsWith('/')) {
      return `https://www.amazon.com${raw}`;
    }
    return null;
  }

  try {
    const url = new URL(raw);
    const asinFromUrl = extractAsin(`${url.pathname}${url.search}`);
    if (asinFromUrl) {
      return `https://www.amazon.com/dp/${asinFromUrl}`;
    }

    if (url.hostname.includes('amazon.')) {
      url.protocol = 'https:';
      if (!url.hostname.startsWith('www.')) {
        url.hostname = `www.${url.hostname}`.replace(/^www\.www\./, 'www.');
      }
      return url.toString();
    }
  } catch (error) {
    console.warn('Invalid Amazon URL received:', error);
  }

  return null;
};

const sanitizeAmazonImage = (value: unknown): string | undefined => {
  if (!value) return undefined;

  let raw = decodeAmazonString(String(value).trim());
  if (!raw) return undefined;

  raw = raw.replace(/\s/g, '');

  if (raw.startsWith('//')) {
    raw = `https:${raw}`;
  }

  if (!raw.startsWith('http')) {
    if (raw.includes('m.media-amazon.com') || raw.includes('images-amazon.com')) {
      return `https://${raw.replace(/^https?:\/\//, '')}`;
    }
    return undefined;
  }

  try {
    const url = new URL(raw);
    if (url.hostname.includes('amazon') || url.hostname.includes('images-amazon')) {
      url.protocol = 'https:';
      return url.toString();
    }
  } catch (error) {
    console.warn('Invalid Amazon image URL received:', error);
  }

  return undefined;
};

export function QuickAmazonShop({ onShopComplete }: QuickAmazonShopProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const carouselRef = useRef<HTMLDivElement>(null);

  const extractJsonArray = (input: string): string | null => {
    if (!input) return null;

    // Prefer fenced code blocks (```json ... ```)
    const fencedMatch = input.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fencedMatch?.[1]) {
      return fencedMatch[1];
    }

    // Fallback: grab text between the first [ and last ]
    const firstBracket = input.indexOf('[');
    const lastBracket = input.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      return input.slice(firstBracket, lastBracket + 1);
    }

    return null;
  };

  const normalizeProducts = (items: unknown): Product[] => {
    if (!Array.isArray(items)) return [];

    const uniqueProducts = new Map<string, Product>();

    for (const item of items) {
      if (!item || typeof item !== 'object') continue;

      const record = item as Record<string, unknown>;

      const title = record.title ?? record.name ?? record.productName;
      if (!title) continue;

      const sanitizedUrl =
        sanitizeAmazonUrl(record.url ?? record.link ?? record.href ?? record.productUrl ?? record.asin) ??
        undefined;

      if (!sanitizedUrl) continue;

      const price = record.price ?? record.cost ?? record.priceText ?? record.priceValue;
      const rating = record.rating ?? record.stars ?? record.reviewScore ?? record.reviews;
      const image =
        sanitizeAmazonImage(
          record.image ??
            record.imageUrl ??
            record.image_url ??
            record.thumbnail ??
            record.thumbnailUrl ??
            record.thumb ??
            record.img ??
            record.imageSrc ??
            record.picture
        ) ?? undefined;

      const product: Product = {
        title: decodeAmazonString(String(title)),
        url: sanitizedUrl,
        price: price ? decodeAmazonString(String(price)) : '',
        rating: rating ? decodeAmazonString(String(rating)) : undefined,
        image,
      };

      if (!uniqueProducts.has(product.url)) {
        uniqueProducts.set(product.url, product);
      }
    }

    return Array.from(uniqueProducts.values());
  };

  const handleSearch = async () => {
    if (!query.trim()) return;

    setIsOpen(true);
    setIsSearching(true);
    setError(null);
    setProducts([]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: `Find 3-5 popular products on Amazon for: "${query}". Use real-time search to get current products with REAL product images and working Amazon links.

Return ONLY a JSON array in this EXACT format:
[
  {
    "title": "Full product name from Amazon",
    "price": "$XX.XX",
    "rating": "X.X/5",
    "image": "direct Amazon product image URL (https://m.media-amazon.com/... or similar)",
    "url": "actual Amazon product page URL (https://www.amazon.com/dp/...)"
  }
]

CRITICAL:
- Use live web search to find REAL Amazon products
- Include actual Amazon product image URLs
- Include working Amazon product page links (dp/ASIN format)
- Get current prices and ratings
- Return ONLY the JSON array, no extra text`,
            },
          ],
          tool: 'research', // Use research tool for live search
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to search Amazon products');
      }

      const data = await response.json();
      const searchResults = data.content as string;

      // Try to parse JSON from response
      let parsedProducts: Product[] = [];
      try {
        const jsonText = extractJsonArray(searchResults);
        if (jsonText) {
          const raw = JSON.parse(jsonText);
          parsedProducts = normalizeProducts(raw);
        }

        if (parsedProducts.length === 0) {
          parsedProducts = [
            {
              title: `Search results for "${query}"`,
              price: '',
              url: `https://www.amazon.com/s?k=${encodeURIComponent(query)}`,
            },
          ];
        }

        setProducts(parsedProducts);
      } catch (parseError) {
        console.error('Failed to parse products:', parseError);
        parsedProducts = [
          {
            title: `Search results for "${query}"`,
            price: '',
            url: `https://www.amazon.com/s?k=${encodeURIComponent(query)}`,
          },
        ];
        setProducts(parsedProducts);
      }

      // Send response to chat with products
      if (onShopComplete) {
        onShopComplete(searchResults, query, parsedProducts);
      }
    } catch (err) {
      console.error('Amazon search error:', err);
      setError(err instanceof Error ? err.message : 'Search failed');
    }
    setIsSearching(false);
  };

  const handleProductClick = (product: Product) => {
    // Open Amazon link directly - Amazon will handle app prompt on mobile
    window.open(product.url, '_blank');
  };

  return (
    <>
      {/* Shop Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 rounded-lg bg-white/5 px-3 py-1.5 text-sm text-gray-400 hover:bg-white/10 hover:text-white transition"
        title="Search Amazon products"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
          />
        </svg>
        <span>Shop</span>
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/70 backdrop-blur-sm">
          <div className="flex justify-center px-3 pb-4 pt-20 sm:px-6 sm:pb-10">
            <div className="w-full max-w-4xl overflow-hidden rounded-t-3xl border border-white/10 bg-zinc-950/95 shadow-2xl">
              <div className="flex h-[90vh] max-h-[96vh] flex-col">
                {/* Header - Fixed */}
                <div className="flex items-center justify-between border-b border-white/10 px-6 pt-5 pb-4">
                  <div className="flex items-center gap-3">
                    <span
                      className="hidden h-1.5 w-16 rounded-full bg-white/10 sm:block"
                      aria-hidden="true"
                    />
                    <h2 className="text-lg font-semibold sm:text-xl">
                      🛍️ Intelligent Personal Shopping
                    </h2>
                  </div>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="rounded-lg p-2 text-gray-400 hover:bg-white/10 hover:text-white"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto px-6 pb-6 pt-4">
                  {/* Search Input */}
                  <div className="mb-4 space-y-3">
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      placeholder="What are you looking for? (e.g., wireless headphones)"
                      className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-white placeholder-gray-400 focus:border-white/20 focus:outline-none"
                      autoFocus
                    />

                    <button
                      onClick={handleSearch}
                      disabled={!query.trim() || isSearching}
                      className="w-full rounded-xl bg-white px-4 py-2 font-semibold text-black transition hover:bg-gray-200 disabled:opacity-50"
                    >
                      {isSearching ? 'Searching Amazon...' : 'Search Products'}
                    </button>
                  </div>

                  {/* Error Message */}
                  {error && (
                    <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
                      {error}
                    </div>
                  )}

                  {/* Product Carousel */}
                  {products.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-gray-300">
                          {products.length} Product{products.length > 1 ? 's' : ''} Found
                        </h3>
                        <button
                          onClick={() =>
                            window.open(
                              `https://www.amazon.com/s?k=${encodeURIComponent(query)}`,
                              '_blank'
                            )
                          }
                          className="rounded-full border border-white/10 px-3 py-1 text-xs text-gray-400 transition hover:border-white/30 hover:text-white"
                        >
                          View all →
                        </button>
                      </div>

                      {/* Horizontal Scrolling Carousel */}
                      <div
                        ref={carouselRef}
                        className="flex gap-4 overflow-x-auto pb-3 pr-1 scrollbar-hide snap-x snap-mandatory"
                        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                      >
                        {products.map((product, index) => (
                          <button
                            key={index}
                            onClick={() => handleProductClick(product)}
                            className="group relative flex w-72 flex-shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] text-left transition hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.08]"
                          >
                            {/* Product Image */}
                            {product.image ? (
                              <div className="relative h-56 overflow-hidden bg-black/40">
                                <img
                                  src={product.image}
                                  alt={product.title}
                                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                                />
                                <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/80 to-transparent" />
                              </div>
                            ) : (
                              <div className="flex h-56 items-center justify-center bg-black/60">
                                <span className="px-6 text-center text-xs font-medium uppercase tracking-wide text-white/50">
                                  Image preview unavailable
                                </span>
                              </div>
                            )}

                            {/* Product Info */}
                            <div className="flex flex-1 flex-col justify-between gap-2 p-4">
                              <div className="space-y-2">
                                <h4 className="line-clamp-2 text-sm font-semibold text-white group-hover:text-blue-400">
                                  {product.title}
                                </h4>
                                {product.rating && (
                                  <p className="text-xs text-gray-400">⭐ {product.rating}</p>
                                )}
                              </div>

                              {product.price && (
                                <p className="text-lg font-semibold text-emerald-400">
                                  {product.price}
                                </p>
                              )}
                            </div>

                            {/* Open Icon */}
                            <div className="absolute right-3 top-3 rounded-full bg-black/70 p-2 opacity-0 transition-opacity group-hover:opacity-100">
                              <svg
                                className="h-4 w-4"
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
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Help Text */}
                  <p className="mt-6 text-center text-xs text-gray-500">
                    Tap a product to open it on Amazon • Swipe horizontally to browse all results
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
