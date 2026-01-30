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
        flex-shrink-0 w-[100px] p-2 rounded-lg border transition-all text-left
        ${
          card.comingSoon
            ? 'bg-gray-900/50 border-gray-800 cursor-not-allowed opacity-60'
            : 'bg-gray-900 border-gray-700/50 hover:border-gray-600 hover:bg-gray-800/80 cursor-pointer'
        }
      `}
    >
      {/* Icon + Title row - compact horizontal layout */}
      <div className="flex items-center gap-1.5 mb-1">
        <div
          className={`w-5 h-5 rounded-md ${card.iconBg} flex items-center justify-center flex-shrink-0`}
        >
          <IconComponent className={`w-3 h-3 ${card.iconColor}`} />
        </div>
        <h4 className="text-[10px] font-medium text-white leading-tight truncate">{card.title}</h4>
        {card.comingSoon && (
          <span className="text-[6px] px-1 py-0.5 rounded bg-blue-500/20 text-blue-400 font-medium flex-shrink-0">
            Soon
          </span>
        )}
      </div>

      {/* Description - single line */}
      <p className="text-[8px] text-gray-500 leading-tight line-clamp-1">{card.description}</p>

      {/* Badge for admin features */}
      {card.badge && (
        <p className="text-[6px] text-gray-400 mt-0.5 font-medium truncate">{card.badge}</p>
      )}
    </button>
  );
}
