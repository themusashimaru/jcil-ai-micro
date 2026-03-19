/**
 * LANDING HEADER
 *
 * Clean sticky nav with glassmorphism and pill-shaped CTAs.
 * Composio-inspired: minimal, transparent, responsive.
 */

'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import LandingLogo from '../LandingLogo';

const navItems = [
  { label: 'Products', href: '/capabilities' },
  { label: 'Code Lab', href: '/code-lab/about' },
  { label: 'Pricing', href: '/signup' },
  { label: 'Docs', href: '/docs' },
  { label: 'About', href: '/about' },
];

interface LandingHeaderProps {
  transparent?: boolean;
  ctaText?: string;
  ctaHref?: string;
}

export default function LandingHeader({
  transparent = false,
  ctaText = 'Get Started',
  ctaHref = '/signup',
}: LandingHeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  const bg =
    transparent && !isScrolled
      ? 'bg-transparent'
      : 'bg-zinc-950/80 backdrop-blur-xl border-b border-white/[0.06]';

  return (
    <>
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${bg}`}>
        <div className="mx-auto max-w-6xl px-6">
          <nav className="flex h-16 items-center justify-between" aria-label="Main navigation">
            <LandingLogo />

            {/* Desktop nav */}
            <div className="hidden lg:flex lg:items-center lg:gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-full px-4 py-2 text-sm text-zinc-400 transition-colors hover:bg-white/[0.05] hover:text-white"
                >
                  {item.label}
                </Link>
              ))}
            </div>

            {/* Desktop CTA */}
            <div className="hidden lg:flex lg:items-center lg:gap-3">
              <Link
                href="/login"
                className="px-4 py-2 text-sm text-zinc-400 transition-colors hover:text-white"
              >
                Sign in
              </Link>
              <Link
                href={ctaHref}
                className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-zinc-900 transition-all hover:shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                style={{ color: '#18181b' }}
              >
                {ctaText}
              </Link>
            </div>

            {/* Mobile burger */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden rounded-full p-2 text-zinc-400 hover:bg-white/[0.05] hover:text-white transition-colors"
              aria-label="Open menu"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 9h16.5m-16.5 6.75h16.5"
                />
              </svg>
            </button>
          </nav>
        </div>
      </header>

      {/* Mobile menu */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[100] lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div
            className="absolute right-0 top-0 h-full w-full max-w-sm bg-zinc-950/95 backdrop-blur-xl border-l border-white/[0.06]"
            role="dialog"
            aria-label="Mobile menu"
          >
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
                <LandingLogo />
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="rounded-full p-2 text-zinc-400 hover:bg-white/[0.05] hover:text-white transition-colors"
                  aria-label="Close menu"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <nav className="flex-1 overflow-y-auto p-4">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center px-4 py-3.5 text-base text-zinc-300 rounded-xl hover:bg-white/[0.05] hover:text-white transition-all"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>

              <div className="p-4 border-t border-white/[0.06] space-y-3">
                <Link
                  href="/login"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center justify-center w-full py-3.5 text-base text-zinc-300 rounded-full border border-white/[0.1] hover:bg-white/[0.05] transition-all"
                >
                  Sign in
                </Link>
                <Link
                  href={ctaHref}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center justify-center w-full py-3.5 text-base font-semibold text-zinc-900 bg-white rounded-full transition-all"
                  style={{ color: '#18181b' }}
                >
                  {ctaText}
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
