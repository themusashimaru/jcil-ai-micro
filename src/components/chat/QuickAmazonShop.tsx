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
  onShopComplete?: (response: string, query: string) => void;
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

  const scrollCarousel = (direction: 'left' | 'right') => {
    if (carouselRef.current) {
      const scrollAmount = 300;
      carouselRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

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
              content: `Search Amazon for: ${query}. Provide 3-5 product recommendations with: title, price, rating, and Amazon product link. Format as JSON array: [{"title": "...", "price": "$XX.XX", "rating": "X.X/5", "url": "https://amazon.com/..."}]`,
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
      try {
        const jsonMatch = searchResults.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const parsedProducts = JSON.parse(jsonMatch[0]);
          setProducts(parsedProducts);
        } else {
          // If no JSON, just show the text response
          setProducts([{
            title: 'Search Results',
            price: '',
            url: `https://www.amazon.com/s?k=${encodeURIComponent(query)}`,
          }]);
        }
      } catch (parseError) {
        console.error('Failed to parse products:', parseError);
        // Fallback: create generic Amazon search link
        setProducts([{
          title: `Search results for "${query}"`,
          price: '',
          url: `https://www.amazon.com/s?k=${encodeURIComponent(query)}`,
        }]);
      }

      // Send response to chat
      if (onShopComplete) {
        onShopComplete(searchResults, query);
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-2xl rounded-lg bg-black/90 p-6 shadow-xl backdrop-blur-xl border border-white/10">
            {/* Header */}
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">🛒 Amazon Shop</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-2 hover:bg-white/10"
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

            {/* Search Input */}
            <div className="mb-4">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="What are you looking for? (e.g., wireless headphones)"
                className="w-full rounded-lg border border-white/10 bg-white/5 p-3 text-white placeholder-gray-400 focus:border-white/20 focus:outline-none"
                autoFocus
              />
            </div>

            {/* Search Button */}
            <button
              onClick={handleSearch}
              disabled={!query.trim() || isSearching}
              className="mb-4 w-full rounded-lg bg-white px-4 py-2 font-semibold text-black transition hover:bg-gray-200 disabled:opacity-50"
            >
              {isSearching ? 'Searching Amazon...' : 'Search Products'}
            </button>

            {/* Error Message */}
            {error && (
              <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-red-400">
                {error}
              </div>
            )}

            {/* Product Carousel */}
            {products.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-400">
                    {products.length} Product{products.length > 1 ? 's' : ''} Found
                  </h3>

                  {/* Scroll Arrows */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => scrollCarousel('left')}
                      className="rounded-full bg-white/5 p-2 hover:bg-white/10 transition"
                      aria-label="Scroll left"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => scrollCarousel('right')}
                      className="rounded-full bg-white/5 p-2 hover:bg-white/10 transition"
                      aria-label="Scroll right"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Horizontal Scrolling Carousel */}
                <div
                  ref={carouselRef}
                  className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory"
                  style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                  {products.map((product, index) => (
                    <button
                      key={index}
                      onClick={() => handleProductClick(product)}
                      className="group relative flex-shrink-0 w-64 overflow-hidden rounded-lg border border-white/10 bg-white/5 text-left transition hover:border-white/20 hover:bg-white/10 snap-start"
                    >
                      {/* Product Image */}
                      {product.image && (
                        <div className="h-48 overflow-hidden">
                          <img
                            src={product.image}
                            alt={product.title}
                            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        </div>
                      )}

                      {/* Product Info */}
                      <div className="p-4 space-y-2">
                        <h4 className="line-clamp-2 text-sm font-semibold text-white group-hover:text-blue-400 min-h-[2.5rem]">
                          {product.title}
                        </h4>
                        {product.price && (
                          <p className="text-lg font-bold text-green-400">{product.price}</p>
                        )}
                        {product.rating && (
                          <p className="text-xs text-gray-400">⭐ {product.rating}</p>
                        )}
                      </div>

                      {/* Open Icon */}
                      <div className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
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

                {/* View All on Amazon */}
                <button
                  onClick={() => window.open(`https://www.amazon.com/s?k=${encodeURIComponent(query)}`, '_blank')}
                  className="w-full rounded-lg border border-white/10 bg-white/5 py-2 text-sm text-gray-400 hover:bg-white/10 hover:text-white"
                >
                  View all results on Amazon →
                </button>
              </div>
            )}

            {/* Help Text */}
            <p className="mt-4 text-xs text-gray-500">
              Click any product to open on Amazon • Scroll carousel with arrows or swipe
            </p>
          </div>
        </div>
      )}
    </>
  );
}
