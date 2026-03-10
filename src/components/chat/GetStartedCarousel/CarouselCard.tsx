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
        flex-shrink-0 w-[120px] p-2 border transition-all text-left carousel-card
        ${card.comingSoon ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}
      `}
      style={{
        backgroundColor: card.comingSoon
          ? 'var(--carousel-card-disabled-bg)'
          : 'var(--carousel-card-bg)',
        borderColor: 'var(--carousel-card-border)',
      }}
    >
      {/* Icon + Title row */}
      <div className="flex items-center gap-1.5 mb-1">
        <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 bg-[var(--carousel-icon-bg)]">
          <IconComponent className="w-3 h-3 text-[var(--carousel-icon-color)]" />
        </div>
        <h4 className="font-mono text-[9px] font-medium leading-tight whitespace-nowrap uppercase tracking-wider text-[var(--carousel-text)]">
          {card.title}
        </h4>
        {card.comingSoon && (
          <span className="font-mono text-[6px] px-1 py-0.5 border border-[var(--carousel-card-hover-border)] text-[var(--carousel-icon-color)] font-medium flex-shrink-0">
            Soon
          </span>
        )}
      </div>

      {/* Description */}
      <p className="font-mono text-[7px] leading-tight line-clamp-1 text-[var(--carousel-text-muted)]">
        {card.description}
      </p>

      {/* Badge for admin features */}
      {card.badge && (
        <p className="font-mono text-[6px] mt-0.5 font-medium truncate text-[var(--carousel-text-muted)]">
          {card.badge}
        </p>
      )}
    </button>
  );
}
