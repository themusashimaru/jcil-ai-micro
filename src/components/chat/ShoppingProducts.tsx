/** Shopping product cards — horizontal scrolling product list */

'use client';

import type { Message } from '@/app/chat/types';

interface ShoppingProductsProps {
  products: NonNullable<Message['products']>;
}

export function ShoppingProducts({ products }: ShoppingProductsProps) {
  return (
    <div className="mb-3">
      <div
        className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {products.map((product) => (
          <a
            key={product.url || product.title}
            href={product.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative flex-shrink-0 w-64 overflow-hidden rounded-lg border border-white/10 bg-white/5 transition hover:border-white/20 hover:bg-white/10 snap-start"
          >
            {product.image && (
              <div className="h-48 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={product.image}
                  alt={product.title}
                  className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
            )}
            <div className="p-4 space-y-2">
              <h4 className="line-clamp-2 text-sm font-semibold text-white group-hover:text-blue-400 min-h-[2.5rem]">
                {product.title}
              </h4>
              {product.price && <p className="text-lg font-bold text-green-400">{product.price}</p>}
              {product.rating && <p className="text-xs text-gray-400">⭐ {product.rating}</p>}
            </div>
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
          </a>
        ))}
      </div>
    </div>
  );
}
