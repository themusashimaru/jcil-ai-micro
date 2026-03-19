/**
 * GET STARTED CAROUSEL
 *
 * Horizontal scrollable carousel shown on empty/new chats.
 * Showcases tool categories with example prompts users can click to try.
 * Rotates through different suggestions to demonstrate breadth.
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

// Tool showcase cards — each represents a category with a concrete example prompt
const ALL_CARDS: CarouselCardData[] = [
  {
    id: 'research',
    title: 'Research',
    description: 'Search the web and analyze sources',
    iconBg: 'bg-gray-700/50',
    iconColor: 'text-gray-300',
    icon: 'search',
    adminOnly: false,
  },
  {
    id: 'create-document',
    title: 'Documents',
    description: 'Create reports, spreadsheets, PDFs',
    iconBg: 'bg-gray-700/50',
    iconColor: 'text-gray-300',
    icon: 'file-text',
    adminOnly: false,
  },
  {
    id: 'business',
    title: 'Business',
    description: 'SWOT, proposals, OKRs, contracts',
    iconBg: 'bg-gray-700/50',
    iconColor: 'text-gray-300',
    icon: 'briefcase',
    adminOnly: false,
  },
  {
    id: 'education',
    title: 'Education',
    description: 'Lesson plans, quizzes, rubrics',
    iconBg: 'bg-gray-700/50',
    iconColor: 'text-gray-300',
    icon: 'graduation-cap',
    adminOnly: false,
  },
  {
    id: 'ministry',
    title: 'Ministry',
    description: 'Sermons, devotionals, Bible study',
    iconBg: 'bg-gray-700/50',
    iconColor: 'text-gray-300',
    icon: 'book-open',
    adminOnly: false,
  },
  {
    id: 'create-image',
    title: 'Images',
    description: 'Generate and edit visuals with AI',
    iconBg: 'bg-gray-700/50',
    iconColor: 'text-gray-300',
    icon: 'image-plus',
    adminOnly: false,
  },
  {
    id: 'code',
    title: 'Code',
    description: 'Write, run, and debug code',
    iconBg: 'bg-gray-700/50',
    iconColor: 'text-gray-300',
    icon: 'terminal',
    adminOnly: false,
  },
  {
    id: 'planning',
    title: 'Planning',
    description: 'Trip plans, meal plans, budgets',
    iconBg: 'bg-gray-700/50',
    iconColor: 'text-gray-300',
    icon: 'calendar',
    adminOnly: false,
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
    <div className="w-full max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-1.5 px-1">
        <h3 className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">What can I help you with?</h3>
        <button
          onClick={handleDismiss}
          className="p-0.5 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-2.5 h-2.5" />
        </button>
      </div>

      {/* Carousel Container */}
      <div className="relative group">
        {/* Left scroll button */}
        {canScrollLeft && (
          <button
            onClick={() => scroll('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-6 h-6 flex items-center justify-center bg-background border border-border text-muted-foreground hover:text-foreground hover:border-accent/30 transition-all opacity-0 group-hover:opacity-100 -translate-x-1/2"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-3 h-3" />
          </button>
        )}

        {/* Scrollable container */}
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
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-6 h-6 flex items-center justify-center bg-background border border-border text-muted-foreground hover:text-foreground hover:border-accent/30 transition-all opacity-0 group-hover:opacity-100 translate-x-1/2"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}
