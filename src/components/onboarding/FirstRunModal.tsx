/**
 * FIRST-RUN ONBOARDING MODAL
 *
 * Shown to new users on their first visit. Collects their name
 * and gives a brief overview of capabilities.
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useUserProfile } from '@/contexts/UserProfileContext';

interface FirstRunModalProps {
  isOpen: boolean;
  onComplete: () => void;
}

export function FirstRunModal({ isOpen, onComplete }: FirstRunModalProps) {
  const { profile, updateProfile } = useUserProfile();
  const [name, setName] = useState(profile.name || '');
  const [step, setStep] = useState<'welcome' | 'name'>('welcome');
  const [isSaving, setIsSaving] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

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
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-8 max-w-[480px] w-[90%] shadow-2xl">
        {step === 'welcome' ? (
          <>
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">Welcome to JCIL AI</h2>
              <p className="text-sm text-zinc-400">
                Your intelligent assistant for research, coding, documents, and more.
              </p>
            </div>

            <div className="flex flex-col gap-4 mb-6">
              <div className="flex items-start gap-3">
                <span className="text-2xl shrink-0 mt-0.5" role="img" aria-hidden="true">
                  &#x1F50D;
                </span>
                <div>
                  <strong className="block text-white text-sm mb-0.5">Web Search & Research</strong>
                  <p className="text-zinc-400 text-xs leading-relaxed m-0">
                    Get current information, analyze websites, and do deep research.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-2xl shrink-0 mt-0.5" role="img" aria-hidden="true">
                  &#x1F4BB;
                </span>
                <div>
                  <strong className="block text-white text-sm mb-0.5">Code Execution</strong>
                  <p className="text-zinc-400 text-xs leading-relaxed m-0">
                    Run Python and JavaScript code in a secure sandbox.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-2xl shrink-0 mt-0.5" role="img" aria-hidden="true">
                  &#x1F4C4;
                </span>
                <div>
                  <strong className="block text-white text-sm mb-0.5">Document Generation</strong>
                  <p className="text-zinc-400 text-xs leading-relaxed m-0">
                    Create Excel spreadsheets, Word documents, and PDFs.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-2xl shrink-0 mt-0.5" role="img" aria-hidden="true">
                  &#x1F5BC;
                </span>
                <div>
                  <strong className="block text-white text-sm mb-0.5">
                    Image Generation & Analysis
                  </strong>
                  <p className="text-zinc-400 text-xs leading-relaxed m-0">
                    Create images and analyze visual content.
                  </p>
                </div>
              </div>
            </div>

            <button
              className="w-full py-2.5 px-6 rounded-lg text-sm font-semibold bg-orange-500 hover:bg-orange-600 text-white transition-colors disabled:opacity-50"
              onClick={() => setStep('name')}
              aria-label="Get started"
            >
              Get Started
            </button>
          </>
        ) : (
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

            <div className="flex gap-3 justify-end">
              <button
                className="py-2.5 px-6 rounded-lg text-sm font-semibold bg-transparent text-zinc-400 border border-zinc-600 hover:border-zinc-500 transition-colors"
                onClick={() => setStep('welcome')}
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
