/**
 * GET STARTED CAROUSEL
 *
 * Horizontal scrollable carousel shown on empty/new chats.
 * Provides quick access to creative tools and AI agents.
 *
 * Card order (matching Manus.AI):
 * - Edit Image
 * - Create Image
 * - Create Slides
 * - Research Agent (all users)
 * - Deep Research (admin only)
 * - Deep Strategy (admin only)
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { CarouselCard, type CarouselCardData } from './CarouselCard';

interface GetStartedCarouselProps {
  isAdmin?: boolean;
  onSelectCard: (cardId: string) => void;
  onDismiss?: () => void;
}

// Card definitions - order matters
// Unified charcoal/gray color scheme
const ALL_CARDS: CarouselCardData[] = [
  {
    id: 'edit-image',
    title: 'Edit Image',
    description: 'Transform photos with AI-powered editing',
    iconBg: 'bg-gray-700/50',
    iconColor: 'text-gray-300',
    icon: 'wand',
    adminOnly: false,
  },
  {
    id: 'create-image',
    title: 'Create Image',
    description: 'Generate stunning visuals from text',
    iconBg: 'bg-gray-700/50',
    iconColor: 'text-gray-300',
    icon: 'image-plus',
    adminOnly: false,
  },
  {
    id: 'create-slides',
    title: 'Create Slides',
    description: 'Pro presentations with AI visuals',
    iconBg: 'bg-gray-700/50',
    iconColor: 'text-gray-300',
    icon: 'presentation',
    adminOnly: false,
  },
  {
    id: 'research',
    title: 'Research',
    description: 'Deep web research with citations',
    iconBg: 'bg-gray-700/50',
    iconColor: 'text-gray-300',
    icon: 'search',
    adminOnly: false,
  },
  {
    id: 'deep-research',
    title: 'Deep Research',
    description: 'Autonomous agents with puppeteering and vision',
    iconBg: 'bg-gray-700/50',
    iconColor: 'text-gray-300',
    icon: 'brain-circuit',
    adminOnly: true,
    badge: 'Opus + Sonnet + Haiku',
  },
  {
    id: 'deep-strategy',
    title: 'Deep Strategy',
    description: 'Multi-agent army for complex problems',
    iconBg: 'bg-gray-700/50',
    iconColor: 'text-gray-300',
    icon: 'sparkles',
    adminOnly: true,
    badge: 'Opus + Sonnet + Haiku',
  },
];

export function GetStartedCarousel({
  isAdmin = false,
  onSelectCard,
  onDismiss,
}: GetStartedCarouselProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  // Filter cards based on admin status
  const visibleCards = ALL_CARDS.filter((card) => !card.adminOnly || isAdmin);

  // Check scroll position
  const updateScrollButtons = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    setCanScrollLeft(container.scrollLeft > 0);
    setCanScrollRight(container.scrollLeft < container.scrollWidth - container.clientWidth - 10);
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    container.addEventListener('scroll', updateScrollButtons);
    // Initial check
    updateScrollButtons();

    return () => container.removeEventListener('scroll', updateScrollButtons);
  }, []);

  const scroll = (direction: 'left' | 'right') => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollAmount = 300;
    container.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  if (isDismissed) return null;

  return (
    <div className="w-full max-w-xl mx-auto">
      {/* Header - minimal */}
      <div className="flex items-center justify-between mb-1.5 px-1">
        <h3 className="text-[10px] font-medium text-gray-600">Quick actions</h3>
        <button
          onClick={handleDismiss}
          className="p-0.5 rounded text-gray-600 hover:text-gray-400 hover:bg-gray-800/50 transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-2.5 h-2.5" />
        </button>
      </div>

      {/* Carousel Container - centered with flex wrap for small screens */}
      <div className="relative group">
        {/* Left scroll button */}
        {canScrollLeft && (
          <button
            onClick={() => scroll('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-6 h-6 flex items-center justify-center rounded-full bg-gray-800/90 border border-gray-700 text-gray-300 hover:text-white hover:bg-gray-700 transition-all opacity-0 group-hover:opacity-100 -translate-x-1/2"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-3 h-3" />
          </button>
        )}

        {/* Scrollable container - start from left, scroll horizontally */}
        <div
          ref={scrollContainerRef}
          className="flex gap-2 overflow-x-auto scrollbar-hide scroll-smooth pb-1 px-1"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {visibleCards.map((card) => (
            <CarouselCard key={card.id} card={card} onClick={() => onSelectCard(card.id)} />
          ))}
        </div>

        {/* Right scroll button */}
        {canScrollRight && (
          <button
            onClick={() => scroll('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-6 h-6 flex items-center justify-center rounded-full bg-gray-800/90 border border-gray-700 text-gray-300 hover:text-white hover:bg-gray-700 transition-all opacity-0 group-hover:opacity-100 translate-x-1/2"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}
