/**
 * QUICK DAILY DEVOTIONAL
 *
 * PURPOSE:
 * - Display a daily Christian devotional using KJV Bible
 * - Same devotional for all users, refreshed at 12:01 AM daily
 * - Provides Scripture, meditation, prayer, and application
 */

'use client';

import { useState, useEffect } from 'react';

interface Devotional {
  date: string;
  title: string;
  scripture: {
    reference: string;
    text: string;
  };
  meditation: string;
  prayer: string;
  application: string;
}

export function QuickDailyDevotional() {
  const [isOpen, setIsOpen] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [devotional, setDevotional] = useState<Devotional | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && !devotional) {
      fetchDevotional();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const fetchDevotional = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/devotional/daily');

      if (!response.ok) {
        throw new Error('Failed to load devotional');
      }

      const data = await response.json();
      setDevotional(data.devotional);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load devotional');
    }

    setIsLoading(false);
  };

  const handleSendEmail = () => {
    if (!devotional) return;

    const subject = `Daily Devotional: ${devotional.title}`;
    const body = `${devotional.title}\n${devotional.date}\n\n${devotional.scripture.reference}\n"${devotional.scripture.text}"\n\nMeditation:\n${devotional.meditation}\n\nPrayer:\n${devotional.prayer}\n\nApplication:\n${devotional.application}`;

    const mailto = `mailto:${recipientEmail || ''}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;

    // Use anchor element to prevent auth session disruption
    const link = document.createElement('a');
    link.href = mailto;
    link.click();
  };

  const handleClose = () => {
    setIsOpen(false);
    setRecipientEmail('');
  };

  return (
    <>
      {/* Devotional Button - Compact header style */}
      <button
        onClick={() => setIsOpen(true)}
        className="rounded-lg px-2 py-1 md:px-3 md:py-1.5 text-xs font-medium transition hover:bg-white/10 text-primary"
        title="Daily Devotional"
      >
        <span className="flex items-center gap-1">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
            />
          </svg>
          <span className="hidden sm:inline">Devotional</span>
        </span>
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/70 backdrop-blur-sm">
          <div className="flex justify-center px-3 pb-4 pt-20 sm:px-6 sm:pb-10">
            <div className="w-full max-w-2xl overflow-hidden rounded-t-3xl border border-white/10 bg-zinc-950/95 shadow-2xl">
              <div className="flex max-h-[85vh] flex-col">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/10 px-6 pt-5 pb-4">
                  <div className="flex items-center gap-3">
                    <span
                      className="hidden h-1.5 w-16 rounded-full bg-white/10 sm:block"
                      aria-hidden="true"
                    />
                    <h2 className="text-lg font-semibold sm:text-xl">📖 Daily Devotional</h2>
                  </div>
                  <button
                    onClick={handleClose}
                    className="rounded-lg p-2 text-gray-400 hover:bg-white/10 hover:text-white"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-6 pb-6 pt-4">
                  {isLoading && (
                    <div className="flex items-center justify-center py-12">
                      <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-white"></div>
                    </div>
                  )}

                  {error && (
                    <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
                      {error}
                    </div>
                  )}

                  {devotional && !isLoading && (
                    <div className="space-y-6">
                      {/* Date */}
                      <div className="text-center">
                        <p className="text-sm text-gray-400">{devotional.date}</p>
                      </div>

                      {/* Title */}
                      <div className="text-center">
                        <h3 className="text-2xl font-bold text-white">{devotional.title}</h3>
                      </div>

                      {/* Scripture */}
                      <div className="rounded-xl bg-white/5 p-6 border border-white/10">
                        <p className="text-sm font-semibold text-amber-400 mb-3">
                          {devotional.scripture.reference}
                        </p>
                        <p className="text-base leading-relaxed text-gray-200 italic">
                          {devotional.scripture.text}
                        </p>
                      </div>

                      {/* Meditation */}
                      <div className="space-y-3">
                        <h4 className="text-lg font-semibold text-white">Meditation</h4>
                        <p className="text-sm leading-relaxed text-gray-300 whitespace-pre-line">
                          {devotional.meditation}
                        </p>
                      </div>

                      {/* Prayer */}
                      <div className="rounded-xl bg-gradient-to-br from-purple-900/20 to-blue-900/20 p-6 border border-white/10">
                        <h4 className="text-lg font-semibold text-white mb-3">Prayer</h4>
                        <p className="text-sm leading-relaxed text-gray-300 italic whitespace-pre-line">
                          {devotional.prayer}
                        </p>
                      </div>

                      {/* Application */}
                      <div className="space-y-3">
                        <h4 className="text-lg font-semibold text-white">Application</h4>
                        <p className="text-sm leading-relaxed text-gray-300 whitespace-pre-line">
                          {devotional.application}
                        </p>
                      </div>

                      {/* Footer */}
                      <div className="border-t border-white/10 pt-4 text-center">
                        <p className="text-xs text-gray-500">
                          This devotional is refreshed daily at 12:01 AM
                        </p>
                      </div>

                      {/* Recipient Email */}
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-300">
                          Recipient Email (Optional)
                        </label>
                        <input
                          type="email"
                          value={recipientEmail}
                          onChange={(e) => setRecipientEmail(e.target.value)}
                          placeholder="e.g., friend@example.com"
                          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-gray-400 focus:border-white/20 focus:outline-none"
                        />
                        <p className="text-xs text-gray-500">
                          Required only if you want to use the &quot;Send Email&quot; button
                        </p>
                      </div>

                      {/* Send Email Button */}
                      <button
                        onClick={handleSendEmail}
                        className="w-full rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 px-4 py-3 font-semibold text-white hover:from-blue-600 hover:to-purple-600 transition flex items-center justify-center gap-2"
                        title={
                          !recipientEmail
                            ? 'Enter recipient email to enable'
                            : 'Open in your default email client'
                        }
                      >
                        <svg
                          className="h-5 w-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                          />
                        </svg>
                        {recipientEmail ? 'Send Email' : 'Send Email (Add Recipient Email)'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
