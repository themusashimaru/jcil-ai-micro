'use client';

import { useState } from 'react';

interface ContactSupportFormProps {
  onSuccess: () => void;
}

const categories = [
  { value: 'general', label: 'General Inquiry' },
  { value: 'technical_support', label: 'Technical Support' },
  { value: 'bug_report', label: 'Report a Bug' },
  { value: 'feature_request', label: 'Feature Request' },
  { value: 'billing', label: 'Billing Question' },
  { value: 'feedback', label: 'Feedback' },
];

export function ContactSupportForm({ onSuccess }: ContactSupportFormProps) {
  const [formData, setFormData] = useState({
    category: 'general',
    subject: '',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit');
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto px-4 sm:px-6 py-6">
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-2 text-text-secondary">Category</label>
          <select
            value={formData.category}
            onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
            className="w-full px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition appearance-none bg-glass border border-theme text-text-primary"
          >
            {categories.map((cat) => (
              <option key={cat.value} value={cat.value} className="bg-surface">
                {cat.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 text-text-secondary">Subject</label>
          <input
            type="text"
            value={formData.subject}
            onChange={(e) => setFormData((prev) => ({ ...prev, subject: e.target.value }))}
            required
            placeholder="Brief description of your inquiry"
            className="w-full px-4 py-3 rounded-lg focus:outline-none focus:ring-2 transition bg-glass border border-theme text-text-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 text-text-secondary">Message</label>
          <textarea
            value={formData.message}
            onChange={(e) => setFormData((prev) => ({ ...prev, message: e.target.value }))}
            required
            rows={6}
            placeholder="How can we help you?"
            className="w-full px-4 py-3 rounded-lg resize-none focus:outline-none focus:ring-2 transition bg-glass border border-theme text-text-primary"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3 rounded-lg font-semibold transition disabled:opacity-50 bg-primary text-surface"
        >
          {isSubmitting ? 'Sending...' : 'Send Message'}
        </button>

        <p className="text-xs text-center text-text-muted">
          We typically respond within 24-48 hours
        </p>
      </form>
    </div>
  );
}
