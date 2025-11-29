/**
 * CONTACT PAGE
 *
 * PURPOSE:
 * - Professional contact form
 * - Multiple contact options
 */

'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: 'general',
    message: '',
  });
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');

    // Create mailto link with form data
    const subject = encodeURIComponent(`[${formData.subject.toUpperCase()}] Contact from ${formData.name}`);
    const body = encodeURIComponent(
      `Name: ${formData.name}\nEmail: ${formData.email}\nSubject: ${formData.subject}\n\nMessage:\n${formData.message}`
    );

    // Open email client
    window.location.href = `mailto:support@jcil.ai?subject=${subject}&body=${body}`;

    // Show success state
    setTimeout(() => {
      setStatus('sent');
      setFormData({ name: '', email: '', subject: 'general', message: '' });
    }, 500);
  };

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
            We would love to hear from you.
          </p>
        </div>
      </section>

      {/* Contact Content */}
      <section className="container mx-auto px-4 pb-20">
        <div className="mx-auto max-w-5xl grid gap-8 md:grid-cols-2">
          {/* Contact Form */}
          <div className="glass-morphism rounded-2xl p-6 sm:p-8">
            <h2 className="mb-6 text-2xl font-bold">Send a Message</h2>

            {status === 'sent' ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-4">✓</div>
                <h3 className="text-xl font-semibold mb-2">Email Client Opened</h3>
                <p className="text-gray-400">
                  Complete sending the email in your email application.
                </p>
                <button
                  onClick={() => setStatus('idle')}
                  className="mt-4 text-blue-400 hover:text-blue-300"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full rounded-lg bg-white/10 border border-white/20 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Your name"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full rounded-lg bg-white/10 border border-white/20 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="you@example.com"
                  />
                </div>

                <div>
                  <label htmlFor="subject" className="block text-sm font-medium mb-2">
                    Subject
                  </label>
                  <select
                    id="subject"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full rounded-lg bg-white/10 border border-white/20 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="general" className="bg-gray-900">General Inquiry</option>
                    <option value="support" className="bg-gray-900">Technical Support</option>
                    <option value="billing" className="bg-gray-900">Billing Question</option>
                    <option value="feedback" className="bg-gray-900">Feedback</option>
                    <option value="partnership" className="bg-gray-900">Partnership</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-medium mb-2">
                    Message
                  </label>
                  <textarea
                    id="message"
                    required
                    rows={5}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full rounded-lg bg-white/10 border border-white/20 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder="How can we help you?"
                  />
                </div>

                <button
                  type="submit"
                  disabled={status === 'sending'}
                  className="w-full rounded-lg bg-blue-500 py-3 font-semibold hover:bg-blue-600 transition disabled:opacity-50"
                >
                  {status === 'sending' ? 'Opening Email...' : 'Send Message'}
                </button>
              </form>
            )}
          </div>

          {/* Contact Info */}
          <div className="space-y-6">
            <div className="glass-morphism rounded-2xl p-6">
              <h3 className="mb-4 text-xl font-semibold">Email Us</h3>
              <div className="space-y-3">
                <a
                  href="mailto:support@jcil.ai"
                  className="flex items-center gap-3 text-gray-300 hover:text-white transition"
                >
                  <span className="text-2xl">📧</span>
                  <div>
                    <div className="font-medium">Support</div>
                    <div className="text-sm text-gray-400">support@jcil.ai</div>
                  </div>
                </a>
                <a
                  href="mailto:info@jcil.ai"
                  className="flex items-center gap-3 text-gray-300 hover:text-white transition"
                >
                  <span className="text-2xl">💼</span>
                  <div>
                    <div className="font-medium">General Inquiries</div>
                    <div className="text-sm text-gray-400">info@jcil.ai</div>
                  </div>
                </a>
              </div>
            </div>

            <div className="glass-morphism rounded-2xl p-6">
              <h3 className="mb-4 text-xl font-semibold">Quick Links</h3>
              <div className="space-y-3">
                <Link
                  href="/faq"
                  className="flex items-center gap-3 text-gray-300 hover:text-white transition"
                >
                  <span className="text-2xl">❓</span>
                  <div>
                    <div className="font-medium">FAQ</div>
                    <div className="text-sm text-gray-400">Find answers to common questions</div>
                  </div>
                </Link>
                <Link
                  href="/about"
                  className="flex items-center gap-3 text-gray-300 hover:text-white transition"
                >
                  <span className="text-2xl">ℹ️</span>
                  <div>
                    <div className="font-medium">About Us</div>
                    <div className="text-sm text-gray-400">Learn more about JCIL.AI</div>
                  </div>
                </Link>
              </div>
            </div>

            <div className="glass-morphism rounded-2xl p-6">
              <h3 className="mb-4 text-xl font-semibold">Response Time</h3>
              <p className="text-gray-300">
                We typically respond to inquiries within 24-48 hours during business days.
              </p>
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
