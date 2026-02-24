/**
 * LANDING HEADER COMPONENT
 *
 * Professional sticky header with glassmorphism effect
 * Responsive navigation with mobile drawer
 * Anthropic-inspired clean design
 */

'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import LandingLogo from '../LandingLogo';

interface NavItem {
  label: string;
  href: string;
  highlight?: boolean;
}

interface LandingHeaderProps {
  transparent?: boolean;
  ctaText?: string;
  ctaHref?: string;
}

const navItems: NavItem[] = [
  { label: 'Products', href: '/#products' },
  { label: 'Code Lab', href: '/code-lab/about', highlight: true },
  { label: 'Documentation', href: '/docs' },
  { label: 'Pricing', href: '/#pricing' },
  { label: 'About', href: '/about' },
];

export default function LandingHeader({
  transparent = false,
  ctaText = 'Get Started',
  ctaHref = '/signup',
}: LandingHeaderProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  const headerBg =
    transparent && !isScrolled
      ? 'bg-transparent'
      : 'bg-black/90 backdrop-blur-xl border-b border-white/5';

  return (
    <>
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${headerBg}`}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <nav className="flex h-16 items-center justify-between lg:h-20" aria-label="Main navigation">
            {/* Logo */}
            <Link href="/" className="flex items-center">
              <LandingLogo />
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex lg:items-center lg:gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-4 py-2 text-sm font-medium transition-colors rounded-lg hover:bg-white/5 ${
                    item.highlight
                      ? 'text-fuchsia-400 hover:text-fuchsia-300'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>

            {/* Desktop CTA */}
            <div className="hidden lg:flex lg:items-center lg:gap-3">
              <Link
                href="/login"
                className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
              >
                Sign in
              </Link>
              <Link
                href={ctaHref}
                className="rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-slate-100 transition-all"
              >
                {ctaText}
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 text-slate-300 hover:text-white"
              aria-label="Open menu"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
          </nav>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[100] lg:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          />

          {/* Drawer */}
          <div className="absolute right-0 top-0 h-full w-full max-w-sm bg-black/95 backdrop-blur-xl border-l border-white/10 shadow-2xl" role="dialog" aria-label="Mobile navigation menu">
            {/* Subtle gradient overlay for depth */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />

            <div className="relative flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <LandingLogo />
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                  aria-label="Close menu"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {/* Navigation */}
              <nav className="flex-1 overflow-y-auto p-4">
                <div className="space-y-1">
                  {navItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex items-center px-4 py-3.5 text-base font-medium rounded-xl transition-all ${
                        item.highlight
                          ? 'text-fuchsia-400 hover:bg-fuchsia-500/10 hover:text-fuchsia-300'
                          : 'text-slate-200 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </nav>

              {/* Footer CTAs */}
              <div className="p-4 border-t border-white/10 space-y-3 bg-white/[0.02]">
                <Link
                  href="/login"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center justify-center w-full px-4 py-3.5 text-base font-medium text-slate-200 hover:text-white rounded-xl border border-white/20 hover:bg-white/10 hover:border-white/30 transition-all"
                >
                  Sign in
                </Link>
                <Link
                  href={ctaHref}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center justify-center w-full px-4 py-3.5 text-base font-semibold text-black bg-white rounded-xl hover:bg-slate-100 transition-all shadow-lg"
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
