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
        flex-shrink-0 w-[140px] p-3 rounded-xl border transition-all text-left
        ${
          card.comingSoon
            ? 'bg-gray-900/50 border-gray-800 cursor-not-allowed opacity-60'
            : 'bg-gray-900 border-gray-800 hover:border-gray-600 hover:bg-gray-800/80 cursor-pointer hover:scale-[1.02]'
        }
      `}
    >
      {/* Icon */}
      <div className={`w-8 h-8 rounded-lg ${card.iconBg} flex items-center justify-center mb-2`}>
        <IconComponent className={`w-4 h-4 ${card.iconColor}`} />
      </div>

      {/* Title */}
      <div className="flex items-center gap-1.5 mb-0.5">
        <h4 className="text-xs font-medium text-white">{card.title}</h4>
        {card.comingSoon && (
          <span className="text-[8px] px-1 py-0.5 rounded bg-blue-500/20 text-blue-400 font-medium">
            Soon
          </span>
        )}
      </div>

      {/* Description - shorter on small cards */}
      <p className="text-[10px] text-gray-500 leading-tight line-clamp-2">{card.description}</p>

      {/* Badge for admin features */}
      {card.badge && <p className="text-[8px] text-purple-400 mt-1.5 font-medium">{card.badge}</p>}
    </button>
  );
}
