'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Fingerprint, Shield, Zap } from 'lucide-react';
import {
  supportsPasskeys,
  getBiometricName,
  registerPasskey,
  getPasskeys,
} from '@/lib/auth/webauthn-client';

interface PasskeyPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function PasskeyPromptModal({
  isOpen,
  onClose,
  onSuccess,
}: PasskeyPromptModalProps) {
  const [isSupported, setIsSupported] = useState(false);
  const [biometricName, setBiometricName] = useState('Face ID');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function checkSupport() {
      const supported = await supportsPasskeys();
      setIsSupported(supported);
      if (supported) {
        setBiometricName(getBiometricName());
      }
    }
    if (isOpen) {
      checkSupport();
    }
  }, [isOpen]);

  const handleEnable = async () => {
    setIsLoading(true);
    setError(null);

    const result = await registerPasskey();

    setIsLoading(false);

    if (result.success) {
      setSuccess(true);
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1500);
    } else {
      setError(result.error || 'Failed to enable passkey');
    }
  };

  const handleDismiss = async () => {
    // Mark as dismissed so we don't show again
    try {
      await fetch('/api/user/dismiss-passkey-prompt', { method: 'POST' });
    } catch {
      // Ignore errors
    }
    onClose();
  };

  // Focus management
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen || !isSupported) return;
    previousFocusRef.current = document.activeElement as HTMLElement;
    const timer = setTimeout(() => modalRef.current?.focus(), 50);
    return () => {
      clearTimeout(timer);
      previousFocusRef.current?.focus();
    };
  }, [isOpen, isSupported]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [onClose]
  );

  if (!isOpen || !isSupported) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label="Set up passkey"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className="relative mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-800 outline-none"
      >
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <X className="h-5 w-5" />
        </button>

        {success ? (
          // Success state
          <div className="py-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
              <Shield className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {biometricName} Enabled!
            </h2>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              You can now sign in instantly with {biometricName}
            </p>
          </div>
        ) : (
          // Prompt state
          <>
            {/* Icon */}
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
              <Fingerprint className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>

            {/* Title */}
            <h2 className="text-center text-xl font-semibold text-gray-900 dark:text-white">
              Enable {biometricName}?
            </h2>

            {/* Description */}
            <p className="mt-2 text-center text-gray-600 dark:text-gray-400">
              Sign in faster and more securely with {biometricName}
            </p>

            {/* Benefits */}
            <div className="mt-6 space-y-3">
              <div className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
                <Zap className="h-5 w-5 text-yellow-500" />
                <span>Instant sign-in, no password needed</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
                <Shield className="h-5 w-5 text-green-500" />
                <span>More secure than passwords</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
                <Fingerprint className="h-5 w-5 text-blue-500" />
                <span>Your biometric data never leaves your device</span>
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                {error}
              </div>
            )}

            {/* Buttons */}
            <div className="mt-6 flex gap-3">
              <button
                onClick={handleDismiss}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Not Now
              </button>
              <button
                onClick={handleEnable}
                disabled={isLoading}
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isLoading ? 'Setting up...' : `Enable ${biometricName}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Hook to check if user should see the passkey prompt
 */
export function usePasskeyPrompt() {
  const [shouldShow, setShouldShow] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    async function check() {
      try {
        // Check if device supports passkeys
        const supported = await supportsPasskeys();
        if (!supported) {
          setIsChecking(false);
          return;
        }

        // Check if user already has passkeys
        const { passkeys } = await getPasskeys();
        if (passkeys.length > 0) {
          setIsChecking(false);
          return;
        }

        // Check if user dismissed the prompt (stored in localStorage)
        const dismissed = localStorage.getItem('passkey-prompt-dismissed');
        if (dismissed) {
          setIsChecking(false);
          return;
        }

        // Show the prompt
        setShouldShow(true);
      } catch {
        // On error, don't show prompt
      } finally {
        setIsChecking(false);
      }
    }

    check();
  }, []);

  const dismiss = () => {
    localStorage.setItem('passkey-prompt-dismissed', 'true');
    setShouldShow(false);
  };

  return { shouldShow, isChecking, dismiss };
}
