/**
 * CONTACT PAGE
 *
 * PURPOSE:
 * - Secure contact form
 * - Dark theme, tier-one presentation
 * - Connects to admin inbox via support tickets API
 */

import Link from 'next/link';
import ContactForm from '@/components/contact-form';
import LandingLogo from '../components/LandingLogo';
import MobileMenu from '../components/MobileMenu';

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-black/80 border-b border-white/10">
        <div className="container mx-auto px-4 py-4">
          <nav className="flex items-center justify-between">
            <Link href="/">
              <LandingLogo />
            </Link>

            <div className="hidden md:flex items-center space-x-6">
              <Link href="/#capabilities" className="text-slate-400 hover:text-white font-medium transition">
                Capabilities
              </Link>
              <Link href="/code-lab" className="text-slate-400 hover:text-white font-medium transition">
                Code Lab
              </Link>
              <Link href="/docs" className="text-slate-400 hover:text-white font-medium transition">
                Docs
              </Link>
              <Link href="/#pricing" className="text-slate-400 hover:text-white font-medium transition">
                Pricing
              </Link>
            </div>

            <div className="hidden md:flex items-center space-x-4">
              <Link href="/login" className="px-4 py-2 text-slate-400 hover:text-white font-medium transition">
                Log In
              </Link>
              <Link
                href="/signup"
                className="rounded-xl bg-white px-6 py-2 text-black font-semibold hover:bg-slate-100 transition-all duration-300"
              >
                Get Started
              </Link>
            </div>

            <MobileMenu />
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative py-20 sm:py-28 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[100px]" />
        </div>

        <div className="container mx-auto px-4 relative">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="mb-6 text-5xl sm:text-6xl font-bold text-white">Contact</h1>
            <p className="text-xl text-slate-400">
              Questions, feedback, or partnership inquiries.
            </p>
          </div>
        </div>
      </section>

      {/* Contact Form */}
      <section className="pb-24">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl">
            <div className="bg-slate-900/50 rounded-2xl p-8 border border-white/10">
              <ContactForm />
            </div>

            {/* Quick Links */}
            <div className="mt-8 bg-slate-900/30 rounded-2xl p-6 border border-white/10">
              <h3 className="mb-4 text-lg font-semibold text-center text-white">Quick Links</h3>
              <div className="flex flex-wrap justify-center gap-4">
                <Link
                  href="/faq"
                  className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-slate-300 hover:bg-white/10 hover:text-white transition"
                >
                  FAQ
                </Link>
                <Link
                  href="/about"
                  className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-slate-300 hover:bg-white/10 hover:text-white transition"
                >
                  About Us
                </Link>
                <Link
                  href="/docs"
                  className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-slate-300 hover:bg-white/10 hover:text-white transition"
                >
                  Documentation
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black py-12 border-t border-white/10">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-slate-500 text-sm">
              &copy; {new Date().getFullYear()} JCIL.AI. All rights reserved.
            </div>
            <div className="flex gap-6 text-sm">
              <Link href="/" className="text-slate-500 hover:text-white transition">Home</Link>
              <Link href="/about" className="text-slate-500 hover:text-white transition">About</Link>
              <Link href="/privacy" className="text-slate-500 hover:text-white transition">Privacy</Link>
              <Link href="/terms" className="text-slate-500 hover:text-white transition">Terms</Link>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
