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

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Don't allow escape on first-run — they need to complete it
        e.preventDefault();
      }
    },
    []
  );

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
      className="first-run-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to JCIL AI"
      ref={modalRef}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
    >
      <div className="first-run-modal">
        {step === 'welcome' ? (
          <>
            <div className="first-run-header">
              <h2>Welcome to JCIL AI</h2>
              <p>Your intelligent assistant for research, coding, documents, and more.</p>
            </div>

            <div className="first-run-capabilities">
              <div className="capability-item">
                <span className="capability-icon" role="img" aria-hidden="true">
                  &#x1F50D;
                </span>
                <div>
                  <strong>Web Search & Research</strong>
                  <p>Get current information, analyze websites, and do deep research.</p>
                </div>
              </div>
              <div className="capability-item">
                <span className="capability-icon" role="img" aria-hidden="true">
                  &#x1F4BB;
                </span>
                <div>
                  <strong>Code Execution</strong>
                  <p>Run Python and JavaScript code in a secure sandbox.</p>
                </div>
              </div>
              <div className="capability-item">
                <span className="capability-icon" role="img" aria-hidden="true">
                  &#x1F4C4;
                </span>
                <div>
                  <strong>Document Generation</strong>
                  <p>Create Excel spreadsheets, Word documents, and PDFs.</p>
                </div>
              </div>
              <div className="capability-item">
                <span className="capability-icon" role="img" aria-hidden="true">
                  &#x1F5BC;
                </span>
                <div>
                  <strong>Image Generation & Analysis</strong>
                  <p>Create images and analyze visual content.</p>
                </div>
              </div>
            </div>

            <button
              className="first-run-btn primary"
              onClick={() => setStep('name')}
              aria-label="Get started"
            >
              Get Started
            </button>
          </>
        ) : (
          <>
            <div className="first-run-header">
              <h2>What should we call you?</h2>
              <p>This helps personalize your experience.</p>
            </div>

            <div className="first-run-form">
              <label htmlFor="first-run-name" className="first-run-label">
                Your name
              </label>
              <input
                id="first-run-name"
                type="text"
                className="first-run-input"
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

            <div className="first-run-actions">
              <button
                className="first-run-btn secondary"
                onClick={() => setStep('welcome')}
                aria-label="Go back"
              >
                Back
              </button>
              <button
                className="first-run-btn primary"
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

      <style jsx>{`
        .first-run-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(4px);
        }
        .first-run-modal {
          background: var(--bg-secondary, #1a1a2e);
          border: 1px solid var(--border-color, #333);
          border-radius: 16px;
          padding: 2rem;
          max-width: 480px;
          width: 90%;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        }
        .first-run-header {
          text-align: center;
          margin-bottom: 1.5rem;
        }
        .first-run-header h2 {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--text-primary, #fff);
          margin: 0 0 0.5rem;
        }
        .first-run-header p {
          font-size: 0.95rem;
          color: var(--text-secondary, #aaa);
          margin: 0;
        }
        .first-run-capabilities {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }
        .capability-item {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
        }
        .capability-icon {
          font-size: 1.5rem;
          flex-shrink: 0;
          margin-top: 2px;
        }
        .capability-item strong {
          display: block;
          color: var(--text-primary, #fff);
          font-size: 0.9rem;
          margin-bottom: 2px;
        }
        .capability-item p {
          color: var(--text-secondary, #aaa);
          font-size: 0.8rem;
          margin: 0;
          line-height: 1.4;
        }
        .first-run-form {
          margin-bottom: 1.5rem;
        }
        .first-run-label {
          display: block;
          color: var(--text-secondary, #aaa);
          font-size: 0.85rem;
          margin-bottom: 0.5rem;
        }
        .first-run-input {
          width: 100%;
          padding: 0.75rem 1rem;
          background: var(--bg-primary, #0f0f23);
          border: 1px solid var(--border-color, #333);
          border-radius: 8px;
          color: var(--text-primary, #fff);
          font-size: 1rem;
          outline: none;
          box-sizing: border-box;
        }
        .first-run-input:focus {
          border-color: var(--primary, #6366f1);
          box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
        }
        .first-run-actions {
          display: flex;
          gap: 0.75rem;
          justify-content: flex-end;
        }
        .first-run-btn {
          padding: 0.65rem 1.5rem;
          border-radius: 8px;
          font-size: 0.95rem;
          font-weight: 600;
          cursor: pointer;
          border: none;
          transition: opacity 0.15s;
        }
        .first-run-btn:hover {
          opacity: 0.9;
        }
        .first-run-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .first-run-btn.primary {
          background: var(--primary, #6366f1);
          color: #fff;
          width: ${step === 'welcome' ? '100%' : 'auto'};
        }
        .first-run-btn.secondary {
          background: transparent;
          color: var(--text-secondary, #aaa);
          border: 1px solid var(--border-color, #333);
        }
      `}</style>
    </div>
  );
}
