/** AI Provider selector dropdown for ChatComposer */

'use client';

import { useRef, useEffect } from 'react';
import type { ProviderId } from '@/lib/ai/providers';

const PROVIDER_CONFIG: Record<ProviderId, { name: string }> = {
  claude: { name: 'Claude' },
  openai: { name: 'OpenAI' },
  xai: { name: 'xAI Grok' },
  deepseek: { name: 'DeepSeek' },
  google: { name: 'Google Gemini' },
};

interface ComposerProviderMenuProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  selectedProvider: ProviderId;
  onProviderChange: (provider: ProviderId) => void;
  configuredProviders: ProviderId[];
  isStreaming: boolean;
  disabled?: boolean;
}

export function ComposerProviderMenu({
  isOpen,
  onToggle,
  onClose,
  selectedProvider,
  onProviderChange,
  configuredProviders,
  isStreaming,
  disabled,
}: ComposerProviderMenuProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (isOpen && !buttonRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  return (
    <div className="relative flex items-center">
      <button
        ref={buttonRef}
        onClick={onToggle}
        disabled={isStreaming || disabled}
        className="disabled:opacity-50 flex items-center gap-1 transition-all text-xs hover:opacity-80 text-text-primary"
        title="Select AI Provider"
      >
        <span>LLM</span>
        <svg
          className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div
          ref={menuRef}
          className="absolute bottom-full left-0 mb-2 w-64 rounded-xl shadow-xl overflow-hidden z-50 bg-surface-elevated border border-theme"
        >
          <div className="p-2 border-b border-theme">
            <p className="text-xs font-medium text-text-muted">Select AI Provider</p>
          </div>
          <div className="p-1">
            {(Object.keys(PROVIDER_CONFIG) as ProviderId[]).map((providerId) => {
              const provider = PROVIDER_CONFIG[providerId];
              const isConfigured = configuredProviders.includes(providerId);
              const isSelected = providerId === selectedProvider;

              return (
                <button
                  key={providerId}
                  onClick={() => {
                    if (isConfigured) {
                      onProviderChange(providerId);
                      onClose();
                    }
                  }}
                  disabled={!isConfigured}
                  className={`w-full flex items-center gap-2 p-2 rounded-lg transition-colors ${
                    isSelected ? 'bg-glass' : 'bg-transparent'
                  } ${
                    isSelected
                      ? 'text-text-primary'
                      : isConfigured
                        ? 'text-text-secondary'
                        : 'text-text-muted'
                  } ${isConfigured ? 'opacity-100 cursor-pointer' : 'opacity-50 cursor-not-allowed'}`}
                >
                  <p className="text-sm font-medium">{provider.name}</p>
                  {!isConfigured && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-glass text-text-muted">
                      Not configured
                    </span>
                  )}
                  {isSelected && isConfigured && (
                    <svg
                      className="w-4 h-4 ml-auto text-text-muted"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
