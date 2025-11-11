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

export function QuickAmazonShop({ onShopComplete }: QuickAmazonShopProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const carouselRef = useRef<HTMLDivElement>(null);

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
              content: `Search Amazon.com for: "${query}"

CRITICAL: You MUST use web search to find 3-5 REAL products currently on Amazon.com.

For EACH product:
1. Search Amazon.com and open actual product pages
2. Copy the EXACT ASIN from the URL (10-character code like B09XS7JWHH)
3. Copy the EXACT product image URL from the page (starts with https://m.media-amazon.com/images/I/)
4. Get the real current price (e.g., $49.99)
5. Get the customer rating (e.g., 4.6/5)

DO NOT make up or guess ASINs or image URLs. If you cannot find a real image URL, set image to null.

Return ONLY this JSON array (no markdown, no code blocks):
[{"title":"Exact product name","price":"$XX.XX","rating":"X.X/5","image":"https://m.media-amazon.com/images/I/REAL_ID.jpg","url":"https://www.amazon.com/dp/REAL_ASIN"}]

Example response:
[{"title":"Sony WH-1000XM5 Wireless Headphones","price":"$398.00","rating":"4.6/5","image":"https://m.media-amazon.com/images/I/51NBru9GxwL._AC_SL1500_.jpg","url":"https://www.amazon.com/dp/B09XS7JWHH"}]`,
            },
          ],
          tool: 'shopper',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to search products');
      }

      const data = await response.json();
      const aiResponse = data.content as string;

      console.log('AI Response:', aiResponse);

      // Extract JSON from response
      let jsonText = aiResponse;
      const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
      }

      let parsedProducts: Product[] = [];

      try {
        const raw = JSON.parse(jsonText);

        if (Array.isArray(raw)) {
          // Validate and clean products
          parsedProducts = raw
            .filter((item: any) => {
              // Must have title and URL
              if (!item.title || !item.url) return false;

              // Validate ASIN in URL (must be exactly 10 alphanumeric characters)
              const asinMatch = item.url.match(/\/dp\/([A-Z0-9]{10})/i);
              if (!asinMatch) return false;

              // If image exists, validate it's a real Amazon image URL
              if (item.image && !item.image.includes('media-amazon.com/images/I/')) {
                console.warn('Invalid image URL, removing:', item.image);
                item.image = null;
              }

              return true;
            })
            .map((item: any) => ({
              title: item.title,
              price: item.price || '',
              rating: item.rating,
              image: item.image || undefined,
              url: item.url,
            }));
        }

        console.log('Valid products:', parsedProducts);

        if (parsedProducts.length === 0) {
          throw new Error('No valid products found');
        }

        setProducts(parsedProducts);

        if (onShopComplete) {
          onShopComplete(aiResponse, query, parsedProducts);
        }
      } catch (parseError) {
        console.error('Parse error:', parseError);

        // Fallback to Amazon search
        const fallback: Product[] = [
          {
            title: `View "${query}" on Amazon.com`,
            price: 'Click to browse products',
            url: `https://www.amazon.com/s?k=${encodeURIComponent(query)}`,
          },
        ];

        setProducts(fallback);

        if (onShopComplete) {
          onShopComplete(`Search results for "${query}"`, query, fallback);
        }
      }
    } catch (err) {
      console.error('Search error:', err);
      setError(err instanceof Error ? err.message : 'Search failed');

      // Final fallback
      const fallback: Product[] = [
        {
          title: `View "${query}" on Amazon.com`,
          price: 'Click to browse',
          url: `https://www.amazon.com/s?k=${encodeURIComponent(query)}`,
        },
      ];
      setProducts(fallback);
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
