/**
 * LANDING HEADER
 *
 * Premium sticky nav with glassmorphism.
 * Full-screen mobile menu with staggered animations and gradient accents.
 */

'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import LandingLogo from '../LandingLogo';

const navItems = [
  { label: 'Products', href: '/#products', description: 'Chat & Code Lab' },
  { label: 'Features', href: '/#features', description: '51 real AI tools' },
  { label: 'Code Lab', href: '/code-lab/about', description: 'Full AI IDE' },
  { label: 'Pricing', href: '/#pricing', description: 'Plans & BYOK' },
  { label: 'About', href: '/about', description: 'Our mission' },
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
      : 'bg-zinc-950/80 backdrop-blur-xl border-b border-white/[0.06] shadow-[0_1px_24px_rgba(0,0,0,0.4)]';

  return (
    <>
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${bg}`}>
        <div className="mx-auto max-w-6xl px-6">
          <nav className="flex h-16 items-center justify-between" aria-label="Main navigation">
            <LandingLogo />

            {/* Desktop nav — pill-shaped container */}
            <div className="hidden lg:flex lg:items-center lg:gap-0.5 rounded-full border border-white/[0.06] bg-white/[0.02] px-1.5 py-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-full px-4 py-1.5 text-[13px] font-medium text-zinc-400 transition-all hover:bg-white/[0.06] hover:text-white"
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
                className="relative rounded-full bg-gradient-to-r from-amber-400 to-amber-500 px-5 py-2 text-sm font-semibold text-zinc-900 shadow-[0_0_20px_rgba(251,191,36,0.25)] transition-all hover:shadow-[0_0_30px_rgba(251,191,36,0.4)]"
                style={{ color: '#18181b' }}
              >
                {ctaText}
              </Link>
            </div>

            {/* Mobile menu button — styled box with animated lines */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden relative flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-zinc-400 transition-all hover:border-white/[0.15] hover:text-white"
              aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              <div className="flex h-4 w-5 flex-col items-center justify-center gap-[5px]">
                <span
                  className={`h-[1.5px] w-5 bg-current transition-all duration-300 ${isMobileMenuOpen ? 'translate-y-[3.25px] rotate-45' : ''}`}
                />
                <span
                  className={`h-[1.5px] w-5 bg-current transition-all duration-300 ${isMobileMenuOpen ? '-translate-y-[3.25px] -rotate-45' : ''}`}
                />
              </div>
            </button>
          </nav>
        </div>
      </header>

      {/* Mobile menu — full-screen premium overlay */}
      <div
        className={`fixed inset-0 z-[100] lg:hidden transition-all duration-500 ${
          isMobileMenuOpen ? 'visible opacity-100' : 'invisible opacity-0 pointer-events-none'
        }`}
      >
        {/* Backdrop */}
        <div
          className={`absolute inset-0 bg-zinc-950/95 backdrop-blur-2xl transition-opacity duration-500 ${
            isMobileMenuOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={() => setIsMobileMenuOpen(false)}
        />

        {/* Content */}
        <div className="relative flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-4">
            <LandingLogo />
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-zinc-400 transition-all hover:text-white"
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

          {/* Decorative gradient orb */}
          <div className="pointer-events-none absolute left-1/2 top-1/3 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500/[0.06] blur-[120px]" />

          {/* Nav items — large, with descriptions */}
          <nav
            className="relative flex-1 overflow-y-auto px-6 pt-12"
            role="dialog"
            aria-label="Mobile menu"
          >
            <div className="space-y-1">
              {navItems.map((item, i) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="group flex items-center justify-between rounded-2xl px-5 py-4 transition-all hover:bg-white/[0.04]"
                  style={{
                    animation: isMobileMenuOpen
                      ? `fadeInUp 0.4s ease-out ${i * 50}ms both`
                      : 'none',
                  }}
                >
                  <div>
                    <div className="text-lg font-medium text-white">{item.label}</div>
                    <div className="mt-0.5 text-sm text-zinc-500">{item.description}</div>
                  </div>
                  <svg
                    className="h-4 w-4 text-zinc-600 transition-all group-hover:translate-x-1 group-hover:text-zinc-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>

            {/* Gradient divider */}
            <div className="my-8 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

            {/* Quick links */}
            <div className="flex flex-wrap gap-3 px-2">
              {['Docs', 'FAQ', 'Contact'].map((label) => (
                <Link
                  key={label}
                  href={`/${label.toLowerCase()}`}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="rounded-full border border-white/[0.06] bg-white/[0.02] px-4 py-2 text-sm text-zinc-400 transition-all hover:border-white/[0.12] hover:text-white"
                >
                  {label}
                </Link>
              ))}
            </div>
          </nav>

          {/* Bottom CTAs */}
          <div className="relative border-t border-white/[0.06] px-6 py-6 space-y-3">
            <Link
              href={ctaHref}
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center justify-center w-full py-4 text-base font-semibold text-zinc-900 bg-gradient-to-r from-amber-400 to-amber-500 rounded-2xl shadow-[0_0_30px_rgba(251,191,36,0.2)] transition-all"
              style={{ color: '#18181b' }}
            >
              {ctaText}
            </Link>
            <Link
              href="/login"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center justify-center w-full py-3.5 text-base text-zinc-400 rounded-2xl border border-white/[0.08] bg-white/[0.02] transition-all hover:bg-white/[0.04]"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
