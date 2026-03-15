/**
 * FIRST-RUN ONBOARDING MODAL
 *
 * Shown to new users on their first visit. A 4-step walkthrough:
 *   1. Welcome — brief overview of what JCIL AI can do
 *   2. Connectors — explain how integrations work (Gmail, Slack, Calendar, etc.)
 *   3. Scheduled Tasks — show how to automate workflows in plain English
 *   4. Name — collect user's name to personalize the experience
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useUserProfile } from '@/contexts/UserProfileContext';

interface FirstRunModalProps {
  isOpen: boolean;
  onComplete: () => void;
}

type Step = 'welcome' | 'connectors' | 'scheduling' | 'name';

const STEPS: Step[] = ['welcome', 'connectors', 'scheduling', 'name'];

export function FirstRunModal({ isOpen, onComplete }: FirstRunModalProps) {
  const { profile, updateProfile } = useUserProfile();
  const [name, setName] = useState(profile.name || '');
  const [step, setStep] = useState<Step>('welcome');
  const [isSaving, setIsSaving] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const stepIndex = STEPS.indexOf(step);

  // Focus management
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      modalRef.current?.focus();
    }
    return () => {
      previousFocusRef.current?.focus();
    };
  }, [isOpen]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      // Don't allow escape on first-run — they need to complete it
      e.preventDefault();
    }
  }, []);

  const goNext = () => {
    const next = STEPS[stepIndex + 1];
    if (next) setStep(next);
  };

  const goBack = () => {
    const prev = STEPS[stepIndex - 1];
    if (prev) setStep(prev);
  };

  const handleComplete = async () => {
    setIsSaving(true);

    // Save name to local profile
    updateProfile({ ...profile, name: name.trim() });

    // Mark first-run as completed in DB
    try {
      await fetch('/api/user/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ first_run_completed: true }),
      });
    } catch {
      // Non-critical — localStorage profile is saved
    }

    localStorage.setItem('jcil-first-run-completed', 'true');
    setIsSaving(false);
    onComplete();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to JCIL AI"
      ref={modalRef}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
    >
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-8 max-w-[520px] w-[90%] shadow-2xl">
        {/* Progress indicator */}
        <div className="flex items-center gap-1.5 mb-6">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-all duration-500 ${
                i <= stepIndex ? 'bg-orange-500' : 'bg-zinc-700'
              }`}
            />
          ))}
        </div>

        {/* Step 1: Welcome */}
        {step === 'welcome' && (
          <>
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">Welcome to JCIL AI</h2>
              <p className="text-sm text-zinc-400">
                Your intelligent assistant for research, coding, documents, and more.
              </p>
            </div>

            <div className="flex flex-col gap-4 mb-6">
              {[
                {
                  icon: '\u{1F50D}',
                  title: 'Web Search & Research',
                  desc: 'Get current information, analyze websites, and do deep research.',
                },
                {
                  icon: '\u{1F4BB}',
                  title: 'Code Execution',
                  desc: 'Run Python and JavaScript code in a secure sandbox.',
                },
                {
                  icon: '\u{1F4C4}',
                  title: 'Document Generation',
                  desc: 'Create Excel spreadsheets, Word documents, and PDFs.',
                },
                {
                  icon: '\u{1F5BC}',
                  title: 'Image Generation & Analysis',
                  desc: 'Create images and analyze visual content.',
                },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-3">
                  <span className="text-2xl shrink-0 mt-0.5" role="img" aria-hidden="true">
                    {item.icon}
                  </span>
                  <div>
                    <strong className="block text-white text-sm mb-0.5">{item.title}</strong>
                    <p className="text-zinc-400 text-xs leading-relaxed m-0">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <button
              className="w-full py-2.5 px-6 rounded-lg text-sm font-semibold bg-orange-500 hover:bg-orange-600 text-white transition-colors"
              onClick={goNext}
              aria-label="Continue to connectors"
            >
              Next
            </button>
          </>
        )}

        {/* Step 2: Connectors */}
        {step === 'connectors' && (
          <>
            <div className="text-center mb-5">
              <h2 className="text-2xl font-bold text-white mb-2">Connect Your Apps</h2>
              <p className="text-sm text-zinc-400">
                JCIL connects to 67+ apps so you can work across all your tools from one place.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-5">
              {[
                { icon: '\u2709\uFE0F', name: 'Gmail', desc: 'Read, send, and manage emails' },
                { icon: '\u{1F4AC}', name: 'Slack', desc: 'Send messages and automate channels' },
                { icon: '\u{1F4C5}', name: 'Google Calendar', desc: 'View and create events' },
                { icon: '\u{1F41B}', name: 'GitHub', desc: 'Repos, issues, and pull requests' },
                { icon: '\u{1F4B3}', name: 'Stripe', desc: 'Payments and subscriptions' },
                { icon: '\u{1F4C1}', name: 'Google Drive', desc: 'Files, docs, and sheets' },
              ].map((app) => (
                <div
                  key={app.name}
                  className="flex items-start gap-2.5 p-3 rounded-lg bg-zinc-800/60 border border-zinc-700/50"
                >
                  <span className="text-lg shrink-0 mt-0.5">{app.icon}</span>
                  <div className="min-w-0">
                    <strong className="block text-white text-xs">{app.name}</strong>
                    <p className="text-zinc-500 text-[11px] leading-snug m-0">{app.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-zinc-800/40 rounded-lg p-3 mb-5 border border-zinc-700/30">
              <p className="text-zinc-400 text-xs leading-relaxed m-0">
                <strong className="text-zinc-300">How to connect:</strong> Just ask in the chat —
                for example, &ldquo;Connect my Gmail&rdquo; — and JCIL will walk you through it
                securely.
              </p>
            </div>

            <div className="flex gap-3 justify-between">
              <button
                className="py-2.5 px-6 rounded-lg text-sm font-semibold bg-transparent text-zinc-400 border border-zinc-600 hover:border-zinc-500 transition-colors"
                onClick={goBack}
                aria-label="Go back"
              >
                Back
              </button>
              <button
                className="py-2.5 px-6 rounded-lg text-sm font-semibold bg-orange-500 hover:bg-orange-600 text-white transition-colors"
                onClick={goNext}
                aria-label="Continue to scheduling"
              >
                Next
              </button>
            </div>
          </>
        )}

        {/* Step 3: Scheduled Tasks */}
        {step === 'scheduling' && (
          <>
            <div className="text-center mb-5">
              <h2 className="text-2xl font-bold text-white mb-2">Automate Your Day</h2>
              <p className="text-sm text-zinc-400">
                Schedule tasks in plain English. JCIL handles the rest.
              </p>
            </div>

            <div className="space-y-2.5 mb-5">
              {[
                {
                  icon: '\u2709\uFE0F',
                  example: 'Send me a weekly email summary every Monday at 9 AM',
                },
                {
                  icon: '\u{1F4C5}',
                  example: 'Remind me to review my goals every Friday at 5 PM',
                },
                {
                  icon: '\u{1F4AC}',
                  example: 'Post a standup reminder in Slack every morning at 9',
                },
              ].map((item) => (
                <div
                  key={item.example}
                  className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/60 border border-zinc-700/50"
                >
                  <span className="text-lg shrink-0">{item.icon}</span>
                  <p className="text-zinc-300 text-xs italic leading-snug m-0">
                    &ldquo;{item.example}&rdquo;
                  </p>
                </div>
              ))}
            </div>

            <div className="bg-zinc-800/40 rounded-lg p-3 mb-5 border border-zinc-700/30">
              <p className="text-zinc-400 text-xs leading-relaxed m-0">
                <strong className="text-zinc-300">Daily, weekly, or one-time</strong> — your
                scheduled tasks appear in the sidebar. Pause, edit, or delete them anytime.
              </p>
            </div>

            <div className="flex gap-3 justify-between">
              <button
                className="py-2.5 px-6 rounded-lg text-sm font-semibold bg-transparent text-zinc-400 border border-zinc-600 hover:border-zinc-500 transition-colors"
                onClick={goBack}
                aria-label="Go back"
              >
                Back
              </button>
              <button
                className="py-2.5 px-6 rounded-lg text-sm font-semibold bg-orange-500 hover:bg-orange-600 text-white transition-colors"
                onClick={goNext}
                aria-label="Continue to name"
              >
                Next
              </button>
            </div>
          </>
        )}

        {/* Step 4: Name */}
        {step === 'name' && (
          <>
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">What should we call you?</h2>
              <p className="text-sm text-zinc-400">This helps personalize your experience.</p>
            </div>

            <div className="mb-6">
              <label htmlFor="first-run-name" className="block text-zinc-400 text-xs mb-2">
                Your name
              </label>
              <input
                id="first-run-name"
                type="text"
                className="w-full py-3 px-4 bg-zinc-800 border border-zinc-600 rounded-lg text-white text-base outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 transition-colors"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && name.trim()) {
                    handleComplete();
                  }
                }}
              />
            </div>

            <div className="flex gap-3 justify-between">
              <button
                className="py-2.5 px-6 rounded-lg text-sm font-semibold bg-transparent text-zinc-400 border border-zinc-600 hover:border-zinc-500 transition-colors"
                onClick={goBack}
                aria-label="Go back"
              >
                Back
              </button>
              <button
                className="py-2.5 px-6 rounded-lg text-sm font-semibold bg-orange-500 hover:bg-orange-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleComplete}
                disabled={!name.trim() || isSaving}
                aria-label="Complete setup"
              >
                {isSaving ? 'Saving...' : "Let's Go"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
