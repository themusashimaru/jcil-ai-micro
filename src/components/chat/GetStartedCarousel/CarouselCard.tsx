/**
 * CAROUSEL CARD
 *
 * Individual card for the GetStarted carousel.
 * Dark charcoal design with icon, title, and description.
 */

'use client';

import { Wand2, ImagePlus, Presentation, Search, BrainCircuit, Sparkles } from 'lucide-react';

export interface CarouselCardData {
  id: string;
  title: string;
  description: string;
  iconBg: string;
  iconColor: string;
  icon: 'wand' | 'image-plus' | 'presentation' | 'search' | 'brain-circuit' | 'sparkles';
  comingSoon?: boolean;
  adminOnly?: boolean;
  badge?: string;
}

interface CarouselCardProps {
  card: CarouselCardData;
  onClick: () => void;
}

const ICONS = {
  wand: Wand2,
  'image-plus': ImagePlus,
  presentation: Presentation,
  search: Search,
  'brain-circuit': BrainCircuit,
  sparkles: Sparkles,
};

export function CarouselCard({ card, onClick }: CarouselCardProps) {
  const IconComponent = ICONS[card.icon];

  return (
    <button
      onClick={onClick}
      disabled={card.comingSoon}
      className={`
        flex-shrink-0 w-[120px] p-2 rounded-lg border transition-all text-left carousel-card
        ${card.comingSoon ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
      `}
      style={{
        backgroundColor: card.comingSoon
          ? 'var(--carousel-card-disabled-bg)'
          : 'var(--carousel-card-bg)',
        borderColor: 'var(--carousel-card-border)',
      }}
    >
      {/* Icon + Title row - compact horizontal layout */}
      <div className="flex items-center gap-1.5 mb-1">
        <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 bg-[var(--carousel-icon-bg)]">
          <IconComponent className="w-3 h-3 text-[var(--carousel-icon-color)]" />
        </div>
        <h4 className="text-[10px] font-medium leading-tight whitespace-nowrap text-[var(--carousel-text)]">
          {card.title}
        </h4>
        {card.comingSoon && (
          <span className="text-[6px] px-1 py-0.5 rounded bg-blue-500/20 text-blue-400 font-medium flex-shrink-0">
            Soon
          </span>
        )}
      </div>

      {/* Description - single line */}
      <p className="text-[8px] leading-tight line-clamp-1 text-[var(--carousel-text-muted)]">
        {card.description}
      </p>

      {/* Badge for admin features */}
      {card.badge && (
        <p className="text-[6px] mt-0.5 font-medium truncate text-[var(--carousel-text-muted)]">
          {card.badge}
        </p>
      )}
    </button>
  );
}
