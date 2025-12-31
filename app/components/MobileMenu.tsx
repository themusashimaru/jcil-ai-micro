/**
 * MOBILE MENU COMPONENT
 *
 * PURPOSE:
 * - Hamburger menu for mobile navigation on landing page
 * - Slide-out drawer with navigation links
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
      // Prevent body scroll when menu is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Close menu when clicking a link
  const handleLinkClick = () => {
    setIsOpen(false);
  };

  return (
    <>
      {/* Hamburger Button - Only visible on mobile */}
      <button
        onClick={() => setIsOpen(true)}
        className="md:hidden p-2 rounded-lg bg-slate-100 hover:bg-slate-200 transition"
        aria-label="Open menu"
      >
        <svg className="w-6 h-6 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-50 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Slide-out Menu */}
      <div
        className={`fixed top-0 right-0 h-full w-72 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out md:hidden ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ backgroundColor: '#ffffff' }}
      >
        {/* Close Button */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <span className="text-xl font-bold bg-gradient-to-r from-blue-900 to-blue-700 bg-clip-text text-transparent">
            JCIL.AI
          </span>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 text-slate-500 hover:text-slate-700 transition"
            aria-label="Close menu"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="p-4">
          <ul className="space-y-2">
            <li>
              <Link
                href="#how-it-works"
                onClick={handleLinkClick}
                className="block px-4 py-3 text-slate-700 hover:bg-slate-50 rounded-lg transition font-medium"
              >
                How It Works
              </Link>
            </li>
            <li>
              <Link
                href="/coding"
                onClick={handleLinkClick}
                className="block px-4 py-3 text-slate-700 hover:bg-slate-50 rounded-lg transition font-medium"
              >
                Coding Assistant
              </Link>
            </li>
            <li>
              <Link
                href="#pricing"
                onClick={handleLinkClick}
                className="block px-4 py-3 text-slate-700 hover:bg-slate-50 rounded-lg transition font-medium"
              >
                Pricing
              </Link>
            </li>
            <li>
              <Link
                href="/about"
                onClick={handleLinkClick}
                className="block px-4 py-3 text-slate-700 hover:bg-slate-50 rounded-lg transition font-medium"
              >
                About
              </Link>
            </li>
            <li>
              <Link
                href="/contact"
                onClick={handleLinkClick}
                className="block px-4 py-3 text-slate-700 hover:bg-slate-50 rounded-lg transition font-medium"
              >
                Contact
              </Link>
            </li>
          </ul>

          {/* Divider */}
          <div className="my-4 border-t border-slate-200" />

          {/* Auth Buttons */}
          <div className="space-y-3">
            <Link
              href="/login"
              onClick={handleLinkClick}
              className="block w-full px-4 py-3 text-center text-slate-700 border border-slate-300 rounded-xl font-semibold hover:bg-slate-50 transition"
            >
              Log In
            </Link>
            <Link
              href="/signup"
              onClick={handleLinkClick}
              className="block w-full px-4 py-3 text-center text-white bg-gradient-to-r from-blue-900 to-blue-700 rounded-xl font-semibold hover:shadow-lg transition"
            >
              Sign Up Free
            </Link>
          </div>
        </nav>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-200 bg-slate-50">
          <p className="text-center text-xs text-slate-500">
            AI-powered tools built for people of faith
          </p>
        </div>
      </div>
    </>
  );
}
