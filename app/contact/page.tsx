/**
 * CONTACT PAGE
 *
 * Secure contact form with shared header/footer
 * Connects to admin inbox via support tickets API
 */

import Link from 'next/link';
import ContactForm from '@/components/contact-form';
import LandingHeader from '../components/landing/LandingHeader';
import LandingFooter from '../components/landing/LandingFooter';

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <LandingHeader />

      {/* Hero */}
      <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-28 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[100px]" />
        </div>

        <div className="container mx-auto px-4 relative">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="mb-6 text-5xl sm:text-6xl font-bold text-white">Contact</h1>
            <p className="text-xl text-slate-400">Questions, feedback, or partnership inquiries.</p>
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

      <LandingFooter />
    </main>
  );
}
