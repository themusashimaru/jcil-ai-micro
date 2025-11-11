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
      const searchResults = data.content;

      // Try to parse JSON from response
      let parsedProducts: Product[] = [];
      try {
        const jsonMatch = searchResults.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          parsedProducts = JSON.parse(jsonMatch[0]);
          setProducts(parsedProducts);
        } else {
          // If no JSON, just show the text response
          parsedProducts = [{
            title: 'Search Results',
            price: '',
            url: `https://www.amazon.com/s?k=${encodeURIComponent(query)}`,
          }];
          setProducts(parsedProducts);
        }
      } catch (parseError) {
        console.error('Failed to parse products:', parseError);
        // Fallback: create generic Amazon search link
        parsedProducts = [{
          title: `Search results for "${query}"`,
          price: '',
          url: `https://www.amazon.com/s?k=${encodeURIComponent(query)}`,
        }];
        setProducts(parsedProducts);
      }

      // Send response to chat with products
      if (onShopComplete) {
        onShopComplete(searchResults, query, parsedProducts);
      }

      setIsSearching(false);
    } catch (err) {
      console.error('Amazon search error:', err);
      setError(err instanceof Error ? err.message : 'Search failed');
      setIsSearching(false);
    }
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
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm p-4 sm:p-6">
          <div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-white/10 bg-zinc-950/95 shadow-2xl">
            <div className="flex max-h-[80vh] flex-col">
              {/* Header - Fixed */}
              <div className="flex items-center justify-between border-b border-white/10 px-6 pt-5 pb-4">
                <div className="flex items-center gap-3">
                  <span className="hidden h-1.5 w-16 rounded-full bg-white/10 sm:block" aria-hidden="true" />
                  <h2 className="text-lg font-semibold sm:text-xl">🛍️ Intelligent Personal Shopping</h2>
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
                        onClick={() => window.open(`https://www.amazon.com/s?k=${encodeURIComponent(query)}`, '_blank')}
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
                          {product.image && (
                            <div className="relative h-56 overflow-hidden bg-black/40">
                              <img
                                src={product.image}
                                alt={product.title}
                                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                              />
                              <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/80 to-transparent" />
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
                              <p className="text-lg font-semibold text-emerald-400">{product.price}</p>
                            )}
                          </div>

                          {/* Open Icon */}
                          <div className="absolute right-3 top-3 rounded-full bg-black/70 p-2 opacity-0 transition-opacity group-hover:opacity-100">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
      )}
    </>
  );
}
