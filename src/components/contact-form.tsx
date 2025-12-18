/**
 * CONTACT FORM COMPONENT
 *
 * PURPOSE:
 * - Secure contact form for external visitors
 * - Dropdown for contact reason categories
 * - Connects to support tickets API
 * - Includes honeypot spam protection
 */

'use client';

import { useState } from 'react';

// Categories matching admin inbox folders
const CONTACT_CATEGORIES = [
  { value: 'general', label: 'General Inquiry' },
  { value: 'technical_support', label: 'Technical Support' },
  { value: 'bug_report', label: 'Report a Bug' },
  { value: 'feature_request', label: 'Feature Request' },
  { value: 'billing', label: 'Billing Question' },
  { value: 'partnership', label: 'Partnership Opportunity' },
  { value: 'feedback', label: 'Feedback' },
  { value: 'other', label: 'Other' },
];

interface FormState {
  name: string;
  email: string;
  category: string;
  subject: string;
  message: string;
  honeypot: string; // Spam protection - should remain empty
}

export default function ContactForm() {
  const [formData, setFormData] = useState<FormState>({
    name: '',
    email: '',
    category: 'general',
    subject: '',
    message: '',
    honeypot: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus('idle');
    setErrorMessage('');

    try {
      const response = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: formData.category,
          subject: formData.subject,
          message: formData.message,
          senderEmail: formData.email,
          senderName: formData.name,
          honeypot: formData.honeypot,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit form');
      }

      setSubmitStatus('success');
      // Reset form
      setFormData({
        name: '',
        email: '',
        category: 'general',
        subject: '',
        message: '',
        honeypot: '',
      });
    } catch (error) {
      setSubmitStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitStatus === 'success') {
    return (
      <div className="glass-morphism rounded-2xl p-8 sm:p-12 text-center">
        <div className="text-5xl mb-6">✓</div>
        <h2 className="text-2xl sm:text-3xl font-bold mb-4 text-[#4DFFFF]">
          Message Sent!
        </h2>
        <p className="text-gray-300 mb-6">
          Thank you for reaching out. We typically respond within 24-48 hours during business days.
        </p>
        <button
          onClick={() => setSubmitStatus('idle')}
          className="px-6 py-3 rounded-lg bg-white/10 hover:bg-white/20 transition text-sm font-medium"
        >
          Send Another Message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="glass-morphism rounded-2xl p-8 sm:p-12">
      <div className="text-5xl mb-6 text-center">📬</div>
      <h2 className="text-2xl sm:text-3xl font-bold mb-2 text-center">Get in Touch</h2>
      <p className="text-gray-400 mb-8 text-center">
        Fill out the form below and we&apos;ll get back to you soon.
      </p>

      {submitStatus === 'error' && (
        <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
          {errorMessage}
        </div>
      )}

      <div className="space-y-5">
        {/* Name */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">
            Your Name
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="John Doe"
            className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-[#4DFFFF]/50 focus:ring-1 focus:ring-[#4DFFFF]/50 transition"
          />
        </div>

        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
            Email Address <span className="text-red-400">*</span>
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            placeholder="you@example.com"
            className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-[#4DFFFF]/50 focus:ring-1 focus:ring-[#4DFFFF]/50 transition"
          />
        </div>

        {/* Category Dropdown */}
        <div>
          <label htmlFor="category" className="block text-sm font-medium text-gray-300 mb-2">
            Reason for Contact <span className="text-red-400">*</span>
          </label>
          <select
            id="category"
            name="category"
            value={formData.category}
            onChange={handleChange}
            required
            className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-[#4DFFFF]/50 focus:ring-1 focus:ring-[#4DFFFF]/50 transition appearance-none cursor-pointer"
            style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em', paddingRight: '2.5rem' }}
          >
            {CONTACT_CATEGORIES.map(cat => (
              <option key={cat.value} value={cat.value} className="bg-gray-900">
                {cat.label}
              </option>
            ))}
          </select>
        </div>

        {/* Subject */}
        <div>
          <label htmlFor="subject" className="block text-sm font-medium text-gray-300 mb-2">
            Subject <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            id="subject"
            name="subject"
            value={formData.subject}
            onChange={handleChange}
            required
            placeholder="Brief description of your inquiry"
            className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-[#4DFFFF]/50 focus:ring-1 focus:ring-[#4DFFFF]/50 transition"
          />
        </div>

        {/* Message */}
        <div>
          <label htmlFor="message" className="block text-sm font-medium text-gray-300 mb-2">
            Message <span className="text-red-400">*</span>
          </label>
          <textarea
            id="message"
            name="message"
            value={formData.message}
            onChange={handleChange}
            required
            rows={5}
            placeholder="How can we help you?"
            className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-[#4DFFFF]/50 focus:ring-1 focus:ring-[#4DFFFF]/50 transition resize-none"
          />
        </div>

        {/* Honeypot - hidden from users, catches bots */}
        <input
          type="text"
          name="honeypot"
          value={formData.honeypot}
          onChange={handleChange}
          className="hidden"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
        />

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-4 rounded-lg bg-[#4DFFFF] text-black font-semibold hover:bg-[#3dcccc] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Sending...
            </span>
          ) : (
            'Send Message'
          )}
        </button>
      </div>

      <p className="text-gray-500 text-xs mt-6 text-center">
        We typically respond within 24-48 hours during business days.
      </p>
    </form>
  );
}
