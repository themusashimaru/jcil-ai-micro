/**
 * CONTACT PAGE
 *
 * PURPOSE:
 * - Professional contact form
 * - Submits to admin inbox
 * - Multiple category options
 */

'use client';

import Link from 'next/link';
import { useState } from 'react';

const CATEGORIES = [
  { value: 'general', label: 'General Inquiry' },
  { value: 'technical_support', label: 'Technical Support' },
  { value: 'bug_report', label: 'Bug Report' },
  { value: 'feature_request', label: 'Feature Request' },
  { value: 'billing', label: 'Billing Question' },
  { value: 'feedback', label: 'Feedback' },
  { value: 'partnership', label: 'Partnership Inquiry' },
  { value: 'other', label: 'Other' },
];

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    category: 'general',
    subject: '',
    message: '',
    honeypot: '', // Spam protection
  });
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    setErrorMessage('');

    try {
      const response = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderName: formData.name,
          senderEmail: formData.email,
          category: formData.category,
          subject: formData.subject || `${CATEGORIES.find(c => c.value === formData.category)?.label} from ${formData.name}`,
          message: formData.message,
          honeypot: formData.honeypot,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send message');
      }

      setStatus('sent');
      setFormData({ name: '', email: '', category: 'general', subject: '', message: '', honeypot: '' });
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Failed to send message');
    }
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
                <h3 className="text-xl font-semibold mb-2">Message Sent</h3>
                <p className="text-gray-400">
                  Thank you for reaching out. We typically respond within 24-48 hours.
                </p>
                <button
                  onClick={() => setStatus('idle')}
                  className="mt-4 text-blue-400 hover:text-blue-300"
                >
                  Send another message
                </button>
              </div>
            ) : status === 'error' ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-4">!</div>
                <h3 className="text-xl font-semibold mb-2 text-red-400">Error</h3>
                <p className="text-gray-400 mb-4">
                  {errorMessage || 'Something went wrong. Please try again.'}
                </p>
                <button
                  onClick={() => setStatus('idle')}
                  className="text-blue-400 hover:text-blue-300"
                >
                  Try again
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Honeypot field - hidden from users, catches bots */}
                <input
                  type="text"
                  name="website"
                  value={formData.honeypot}
                  onChange={(e) => setFormData({ ...formData, honeypot: e.target.value })}
                  className="hidden"
                  tabIndex={-1}
                  autoComplete="off"
                />

                <div>
                  <label htmlFor="name" className="block text-sm font-medium mb-2">
                    Name <span className="text-red-400">*</span>
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
                    Email <span className="text-red-400">*</span>
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
                  <label htmlFor="category" className="block text-sm font-medium mb-2">
                    Category <span className="text-red-400">*</span>
                  </label>
                  <select
                    id="category"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full rounded-lg bg-white/10 border border-white/20 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value} className="bg-gray-900">
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="subject" className="block text-sm font-medium mb-2">
                    Subject
                  </label>
                  <input
                    type="text"
                    id="subject"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full rounded-lg bg-white/10 border border-white/20 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Brief description of your inquiry"
                  />
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-medium mb-2">
                    Message <span className="text-red-400">*</span>
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
                  {status === 'sending' ? 'Sending...' : 'Send Message'}
                </button>

                <p className="text-xs text-gray-500 text-center">
                  Your message will be sent directly to our team. We never share your information.
                </p>
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
