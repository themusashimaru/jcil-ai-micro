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
  honeypot: string;
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
    setFormData((prev) => ({ ...prev, [name]: value }));
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
      <div className="rounded-2xl p-8 sm:p-12 text-center bg-gray-900/95 border border-gray-700 backdrop-blur-[10px]">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center bg-cyan-400/20">
          <svg
            className="w-8 h-8 text-cyan-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold mb-4 text-cyan-400">Message Sent!</h2>
        <p className="mb-8 text-gray-400">
          Thank you for reaching out. We typically respond within 24-48 hours during business days.
        </p>
        <button
          onClick={() => setSubmitStatus('idle')}
          className="px-6 py-3 rounded-lg transition text-sm font-medium bg-gray-700 text-white border border-gray-600"
        >
          Send Another Message
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl p-8 sm:p-12 bg-gray-900/95 border border-gray-700 backdrop-blur-[10px]"
    >
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center bg-cyan-400/20">
          <svg
            className="w-8 h-8 text-cyan-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-white">Get in Touch</h2>
        <p className="mt-2 text-gray-400">
          Fill out the form below and we&apos;ll get back to you soon.
        </p>
      </div>

      {submitStatus === 'error' && (
        <div className="mb-6 p-4 rounded-lg bg-red-900/30 border border-red-800 text-red-400">
          {errorMessage}
        </div>
      )}

      <div className="space-y-5">
        {/* Name */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium mb-2 text-gray-300">
            Your Name
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="John Doe"
            maxLength={100}
            className="w-full px-4 py-3 rounded-lg focus:outline-none focus:ring-2 transition bg-gray-800/80 border border-gray-600 text-white focus:ring-cyan-400"
          />
        </div>

        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-2 text-gray-300">
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
            className="w-full px-4 py-3 rounded-lg focus:outline-none focus:ring-2 transition bg-gray-800/80 border border-gray-600 text-white"
          />
        </div>

        {/* Category Dropdown */}
        <div>
          <label htmlFor="category" className="block text-sm font-medium mb-2 text-gray-300">
            Reason for Contact <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <select
              id="category"
              name="category"
              value={formData.category}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 rounded-lg appearance-none cursor-pointer pr-10 focus:outline-none focus:ring-2 transition bg-gray-800/80 border border-gray-600 text-white"
            >
              {CONTACT_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value} className="bg-gray-800 text-white">
                  {cat.label}
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <svg
                className="w-5 h-5 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Subject */}
        <div>
          <label htmlFor="subject" className="block text-sm font-medium mb-2 text-gray-300">
            Subject <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            id="subject"
            name="subject"
            value={formData.subject}
            onChange={handleChange}
            required
            minLength={3}
            maxLength={200}
            placeholder="Brief description of your inquiry"
            className="w-full px-4 py-3 rounded-lg focus:outline-none focus:ring-2 transition bg-gray-800/80 border border-gray-600 text-white"
          />
        </div>

        {/* Message */}
        <div>
          <label htmlFor="message" className="block text-sm font-medium mb-2 text-gray-300">
            Message <span className="text-red-400">*</span>
          </label>
          <textarea
            id="message"
            name="message"
            value={formData.message}
            onChange={handleChange}
            required
            minLength={10}
            maxLength={5000}
            rows={5}
            placeholder="How can we help you?"
            className="w-full px-4 py-3 rounded-lg resize-none focus:outline-none focus:ring-2 transition bg-gray-800/80 border border-gray-600 text-white"
          />
          <p className="text-xs mt-1 text-right text-gray-500">{formData.message.length}/5000</p>
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
          className="w-full py-4 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 bg-gradient-to-r from-cyan-500 to-cyan-600 text-black shadow-[0_10px_25px_-5px_rgba(6,182,212,0.3)]"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Sending...
            </span>
          ) : (
            'Send Message'
          )}
        </button>
      </div>

      <p className="text-xs mt-6 text-center text-gray-500">
        We typically respond within 24-48 hours during business days.
      </p>
    </form>
  );
}
