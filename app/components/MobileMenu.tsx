/**
 * MOBILE MENU COMPONENT
 *
 * PURPOSE:
 * - Hamburger menu for mobile navigation
 * - Dark glassmorphism slide-out drawer
 * - Matches tier-one brand identity
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function MobileMenu() {
  const [isOpen, setIsOpen] = useState(false);

  // Close menu on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleLinkClick = () => {
    setIsOpen(false);
  };

  return (
    <>
      {/* Hamburger Button - Dark theme */}
      <button
        onClick={() => setIsOpen(true)}
        className="md:hidden p-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 transition"
        aria-label="Open menu"
      >
        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Slide-out Menu - Solid Dark Background */}
      <div
        className={`fixed top-0 right-0 h-full w-80 z-50 transform transition-transform duration-300 ease-in-out md:hidden
          border-l border-white/10 shadow-2xl ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ backgroundColor: '#020617' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <span className="text-xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
            JCIL.AI
          </span>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition"
            aria-label="Close menu"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="p-5">
          <ul className="space-y-2">
            <li>
              <Link
                href="/chat"
                onClick={handleLinkClick}
                className="flex items-center gap-3 px-4 py-4 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-xl transition font-medium"
              >
                <span className="text-lg">💬</span>
                Chat
              </Link>
            </li>
            <li>
              <Link
                href="/code-lab"
                onClick={handleLinkClick}
                className="flex items-center gap-3 px-4 py-4 text-fuchsia-400 hover:text-fuchsia-300 hover:bg-fuchsia-500/10 rounded-xl transition font-medium"
              >
                <span className="text-lg">💻</span>
                Code Lab
              </Link>
            </li>
            <li>
              <Link
                href="/docs"
                onClick={handleLinkClick}
                className="flex items-center gap-3 px-4 py-4 text-slate-300 hover:text-white hover:bg-white/5 rounded-xl transition font-medium"
              >
                <span className="text-lg">📚</span>
                Docs
              </Link>
            </li>
            <li>
              <Link
                href="#pricing"
                onClick={handleLinkClick}
                className="flex items-center gap-3 px-4 py-4 text-slate-300 hover:text-white hover:bg-white/5 rounded-xl transition font-medium"
              >
                <span className="text-lg">💰</span>
                Pricing
              </Link>
            </li>
            <li>
              <Link
                href="/about"
                onClick={handleLinkClick}
                className="flex items-center gap-3 px-4 py-4 text-slate-300 hover:text-white hover:bg-white/5 rounded-xl transition font-medium"
              >
                <span className="text-lg">ℹ️</span>
                About
              </Link>
            </li>
          </ul>

          {/* Divider */}
          <div className="my-6 border-t border-white/10" />

          {/* Auth Buttons */}
          <div className="space-y-3">
            <Link
              href="/login"
              onClick={handleLinkClick}
              className="block w-full px-4 py-4 text-center text-white border border-white/20 rounded-xl font-semibold hover:bg-white/5 hover:border-white/30 transition text-lg"
            >
              Log In
            </Link>
            <Link
              href="/signup"
              onClick={handleLinkClick}
              className="block w-full px-4 py-4 text-center text-white bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl font-semibold hover:shadow-lg hover:shadow-purple-500/25 transition text-lg"
            >
              Get Started Free
            </Link>
          </div>
        </nav>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-5 border-t border-white/10" style={{ backgroundColor: '#020617' }}>
          <p className="text-center text-sm text-slate-500">
            Same AI. Biblical foundation.
          </p>
        </div>
      </div>
    </>
  );
}
