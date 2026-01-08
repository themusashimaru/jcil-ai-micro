/**
 * LOGO CAROUSEL COMPONENT
 *
 * Infinite scrolling carousel for partner/tech logos
 * CSS-only animation for performance
 */

'use client';

import { AnthropicLogo, VercelLogo, SupabaseLogo, StripeLogo } from './Icons';

interface Logo {
  name: string;
  icon: React.ReactNode;
}

const techLogos: Logo[] = [
  {
    name: 'Anthropic',
    icon: <AnthropicLogo className="h-6 w-auto" />,
  },
  {
    name: 'Vercel',
    icon: <VercelLogo className="h-5 w-auto" />,
  },
  {
    name: 'Supabase',
    icon: <SupabaseLogo className="h-6 w-auto" />,
  },
  {
    name: 'Stripe',
    icon: <StripeLogo className="h-6 w-auto" />,
  },
  {
    name: 'E2B',
    icon: <span className="font-bold text-xl tracking-tight">E2B</span>,
  },
  {
    name: 'Upstash',
    icon: <span className="font-bold text-xl tracking-tight">Upstash</span>,
  },
  {
    name: 'Redis',
    icon: <span className="font-bold text-xl tracking-tight">Redis</span>,
  },
  {
    name: 'TypeScript',
    icon: <span className="font-bold text-xl tracking-tight">TypeScript</span>,
  },
];

const churchLogos: Logo[] = [
  { name: 'Grace Community', icon: <span className="font-semibold">Grace Community Church</span> },
  { name: 'Saddleback', icon: <span className="font-semibold">Saddleback Church</span> },
  { name: 'FaithTech', icon: <span className="font-semibold">FaithTech</span> },
  { name: 'TGC', icon: <span className="font-semibold">The Gospel Coalition</span> },
  { name: 'Covenant', icon: <span className="font-semibold">Covenant Seminary</span> },
  { name: 'Ligonier', icon: <span className="font-semibold">Ligonier Ministries</span> },
  { name: 'DTS', icon: <span className="font-semibold">Dallas Theological Seminary</span> },
  { name: 'Life.Church', icon: <span className="font-semibold">Life.Church</span> },
];

interface LogoCarouselProps {
  variant?: 'tech' | 'churches';
  title?: string;
  speed?: 'slow' | 'normal' | 'fast';
  className?: string;
}

export default function LogoCarousel({
  variant = 'tech',
  title,
  speed = 'normal',
  className = '',
}: LogoCarouselProps) {
  const logos = variant === 'tech' ? techLogos : churchLogos;
  const animationDuration = speed === 'slow' ? '60s' : speed === 'fast' ? '20s' : '40s';

  // Duplicate logos for seamless infinite scroll
  const duplicatedLogos = [...logos, ...logos];

  return (
    <div className={`overflow-hidden ${className}`}>
      {title && <p className="text-center text-sm text-slate-500 mb-8">{title}</p>}

      {/* Carousel container */}
      <div className="relative">
        {/* Gradient masks for fade effect */}
        <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-black to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-black to-transparent z-10 pointer-events-none" />

        {/* Scrolling track */}
        <div
          className="flex items-center gap-12 lg:gap-16 animate-scroll"
          style={{
            animationDuration,
            width: 'max-content',
          }}
        >
          {duplicatedLogos.map((logo, i) => (
            <div
              key={`${logo.name}-${i}`}
              className="flex items-center gap-3 text-slate-400 hover:text-white transition-colors shrink-0"
            >
              <span className="opacity-70 hover:opacity-100 transition-opacity">{logo.icon}</span>
            </div>
          ))}
        </div>
      </div>

      {/* CSS animation */}
      <style jsx>{`
        @keyframes scroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        .animate-scroll {
          animation: scroll linear infinite;
        }
        .animate-scroll:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
}

// Static logo grid for sections that shouldn't animate
export function LogoGrid({
  variant = 'tech',
  className = '',
}: {
  variant?: 'tech' | 'churches';
  className?: string;
}) {
  const logos = variant === 'tech' ? techLogos : churchLogos;

  return (
    <div className={`flex flex-wrap justify-center items-center gap-8 lg:gap-12 ${className}`}>
      {logos.slice(0, 6).map((logo) => (
        <div
          key={logo.name}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors opacity-60 hover:opacity-100"
        >
          {logo.icon}
        </div>
      ))}
    </div>
  );
}

// Compact version for footer or smaller sections
export function LogoStrip({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-6 text-slate-500 ${className}`}>
      <span className="text-xs uppercase tracking-wider">Powered by</span>
      <div className="flex items-center gap-4">
        <AnthropicLogo className="h-4 w-auto opacity-50 hover:opacity-100 transition-opacity" />
        <VercelLogo className="h-3 w-auto opacity-50 hover:opacity-100 transition-opacity" />
        <SupabaseLogo className="h-4 w-auto opacity-50 hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
}
