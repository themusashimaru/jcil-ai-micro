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
        flex-shrink-0 w-[220px] p-4 rounded-xl border transition-all text-left
        ${
          card.comingSoon
            ? 'bg-gray-900/50 border-gray-800 cursor-not-allowed opacity-60'
            : 'bg-gray-900 border-gray-800 hover:border-gray-700 hover:bg-gray-800/80 cursor-pointer'
        }
      `}
    >
      {/* Icon */}
      <div className={`w-10 h-10 rounded-lg ${card.iconBg} flex items-center justify-center mb-3`}>
        <IconComponent className={`w-5 h-5 ${card.iconColor}`} />
      </div>

      {/* Title */}
      <div className="flex items-center gap-2 mb-1">
        <h4 className="text-sm font-medium text-white">{card.title}</h4>
        {card.comingSoon && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-medium">
            Soon
          </span>
        )}
      </div>

      {/* Description */}
      <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{card.description}</p>

      {/* Badge for admin features */}
      {card.badge && <p className="text-[10px] text-purple-400 mt-2 font-medium">{card.badge}</p>}
    </button>
  );
}
