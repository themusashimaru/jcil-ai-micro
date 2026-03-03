/**
 * LOGO CAROUSEL COMPONENT
 *
 * Infinite scrolling carousel for tech partner logos
 * CSS-only animation for performance
 * Only real technology partners - no fake church affiliations
 */

'use client';

import { AnthropicLogo, VercelLogo, SupabaseLogo, StripeLogo } from './Icons';

interface Logo {
  name: string;
  icon: React.ReactNode;
}

const techLogos: Logo[] = [
  { name: 'Anthropic', icon: <AnthropicLogo className="h-6 w-auto" /> },
  { name: 'Vercel', icon: <VercelLogo className="h-5 w-auto" /> },
  { name: 'Supabase', icon: <SupabaseLogo className="h-6 w-auto" /> },
  { name: 'Stripe', icon: <StripeLogo className="h-6 w-auto" /> },
  { name: 'E2B', icon: <span className="font-bold text-xl tracking-tight">E2B</span> },
  { name: 'Upstash', icon: <span className="font-bold text-xl tracking-tight">Upstash</span> },
  { name: 'Redis', icon: <span className="font-bold text-xl tracking-tight">Redis</span> },
  {
    name: 'TypeScript',
    icon: <span className="font-bold text-xl tracking-tight">TypeScript</span>,
  },
  { name: 'Composio', icon: <span className="font-bold text-xl tracking-tight">Composio</span> },
];

interface LogoCarouselProps {
  title?: string;
  speed?: 'slow' | 'normal' | 'fast';
  className?: string;
}

export default function LogoCarousel({
  title,
  speed = 'normal',
  className = '',
}: LogoCarouselProps) {
  const animationDuration = speed === 'slow' ? '60s' : speed === 'fast' ? '20s' : '40s';
  const duplicatedLogos = [...techLogos, ...techLogos];

  return (
    <div className={`overflow-hidden ${className}`}>
      {title && <p className="text-center text-sm text-slate-500 mb-8">{title}</p>}

      <div className="relative">
        <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-black to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-black to-transparent z-10 pointer-events-none" />

        <div
          className="flex items-center gap-12 lg:gap-16 animate-scroll"
          style={{ animationDuration, width: 'max-content' }}
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

export function LogoGrid({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-wrap justify-center items-center gap-8 lg:gap-12 ${className}`}>
      {techLogos.slice(0, 6).map((logo) => (
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
