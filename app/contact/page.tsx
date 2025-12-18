/**
 * CONTACT PAGE
 *
 * PURPOSE:
 * - Secure contact form for external visitors
 * - No exposed email address
 * - Connects to admin inbox via support tickets API
 */

import Link from 'next/link';
import ContactForm from '@/components/contact-form';

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <nav className="flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold">
            JCIL.AI
          </Link>
          <div className="flex items-center space-x-2 sm:space-x-4">
            <Link href="/login" className="px-3 py-2 hover:text-gray-300 text-sm sm:text-base">
              Log In
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-white px-4 py-2 sm:px-6 text-black font-semibold hover:bg-gray-200 text-sm sm:text-base"
            >
              Sign Up
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 py-12 sm:py-16">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="mb-4 text-4xl sm:text-5xl font-bold">Contact Us</h1>
          <p className="text-xl text-gray-300">
            We&apos;d love to hear from you.
          </p>
        </div>
      </section>

      {/* Contact Form */}
      <section className="container mx-auto px-4 pb-20">
        <div className="mx-auto max-w-2xl">
          <ContactForm />

          {/* Quick Links */}
          <div className="mt-8 glass-morphism rounded-2xl p-6">
            <h3 className="mb-4 text-xl font-semibold text-center">Quick Links</h3>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                href="/faq"
                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition text-sm"
              >
                FAQ
              </Link>
              <Link
                href="/about"
                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition text-sm"
              >
                About Us
              </Link>
              <Link
                href="/"
                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition text-sm"
              >
                Home
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-12">
        <div className="container mx-auto px-4 text-center text-sm text-gray-500">
          <p>&copy; {new Date().getFullYear()} JCIL.AI. All rights reserved.</p>
          <div className="mt-4 space-x-4">
            <Link href="/privacy" className="hover:text-white">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-white">Terms of Service</Link>
            <Link href="/" className="hover:text-white">Home</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
