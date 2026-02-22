'use client';

/**
 * API KEY MODAL
 *
 * Modal dialog for entering API keys for services that require them
 * (e.g., ElevenLabs, Stripe, Sentry, etc.)
 */

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (apiKey: string) => Promise<void>;
  toolkit: {
    id: string;
    displayName: string;
    description: string;
    icon: string;
  };
  isSubmitting?: boolean;
  error?: string | null;
}

// API key help links for various services
const API_KEY_HELP: Record<string, { url: string; instructions: string }> = {
  ELEVENLABS: {
    url: 'https://elevenlabs.io/app/settings/api-keys',
    instructions: 'Go to Settings > API Keys in your ElevenLabs dashboard',
  },
  STRIPE: {
    url: 'https://dashboard.stripe.com/apikeys',
    instructions: 'Find your API key in the Stripe Dashboard under Developers > API keys',
  },
  SENTRY: {
    url: 'https://sentry.io/settings/account/api/auth-tokens/',
    instructions: 'Create an auth token in Sentry Settings > Auth Tokens',
  },
  SUPABASE: {
    url: 'https://supabase.com/dashboard/project/_/settings/api',
    instructions: 'Find your API key in Project Settings > API',
  },
  CLOUDFLARE: {
    url: 'https://dash.cloudflare.com/profile/api-tokens',
    instructions: 'Create an API token in your Cloudflare Profile > API Tokens',
  },
  GOOGLE_MAPS: {
    url: 'https://console.cloud.google.com/google/maps-apis/credentials',
    instructions: 'Create credentials in the Google Cloud Console',
  },
  SERPAPI: {
    url: 'https://serpapi.com/manage-api-key',
    instructions: 'Find your API key in your SerpAPI dashboard',
  },
  PERPLEXITY_AI: {
    url: 'https://www.perplexity.ai/settings/api',
    instructions: 'Get your API key from Perplexity AI Settings',
  },
};

export default function ApiKeyModal({
  isOpen,
  onClose,
  onSubmit,
  toolkit,
  isSubmitting = false,
  error,
}: ApiKeyModalProps) {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setApiKey('');
      setShowKey(false);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, isSubmitting, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim() || isSubmitting) return;
    await onSubmit(apiKey.trim());
  };

  const helpInfo = API_KEY_HELP[toolkit.id];

  if (!isOpen || !mounted) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl border shadow-2xl"
        style={{
          backgroundColor: 'var(--background)',
          borderColor: 'var(--border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-4 border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">{toolkit.icon}</span>
            <div>
              <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                Connect {toolkit.displayName}
              </h2>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Enter your API key to connect
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
            style={{ color: 'var(--text-muted)' }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-4">
          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Help info */}
          {helpInfo && (
            <div
              className="mb-4 p-3 rounded-lg border"
              style={{
                backgroundColor: 'var(--background-secondary)',
                borderColor: 'var(--border)',
              }}
            >
              <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
                {helpInfo.instructions}
              </p>
              <a
                href={helpInfo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm font-medium hover:underline"
                style={{ color: 'var(--primary)' }}
              >
                Get your API key
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </a>
            </div>
          )}

          {/* API Key input */}
          <div className="mb-4">
            <label
              htmlFor="api-key"
              className="block text-sm font-medium mb-1.5"
              style={{ color: 'var(--text-primary)' }}
            >
              API Key
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                id="api-key"
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={`Enter your ${toolkit.displayName} API key`}
                className="w-full px-3 py-2.5 pr-10 rounded-lg border text-sm transition-colors focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                style={{
                  backgroundColor: 'var(--background)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-primary)',
                }}
                disabled={isSubmitting}
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                style={{ color: 'var(--text-muted)' }}
                aria-label={showKey ? 'Hide API key' : 'Show API key'}
              >
                {showKey ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                    />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                )}
              </button>
            </div>
            <p className="mt-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
              Your API key is stored securely and used only to connect to {toolkit.displayName}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
              style={{
                borderColor: 'var(--border)',
                color: 'var(--text-primary)',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!apiKey.trim() || isSubmitting}
              className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ backgroundColor: 'var(--primary)' }}
            >
              {isSubmitting ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Connecting...
                </>
              ) : (
                'Connect'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
