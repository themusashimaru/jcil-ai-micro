'use client';

/**
 * CODE LAB PROVIDER SELECTOR
 *
 * Dropdown component for selecting AI provider.
 * Features:
 * - Claude/OpenAI/xAI/DeepSeek selection
 * - Provider capability badges
 * - Status indicators (configured/available)
 * - Keyboard shortcut (Cmd+Shift+P)
 *
 * @version 1.0.0
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import type { ProviderId } from '@/lib/ai/providers';
import './code-lab-provider-selector.css';

interface ProviderConfig {
  id: ProviderId;
  name: string;
  description: string;
  icon: string;
  color: string;
  capabilities: {
    vision: boolean;
    toolCalling: boolean;
    streaming: boolean;
  };
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: 'claude',
    name: 'Claude',
    description: 'Anthropic Claude - best for complex reasoning and code',
    icon: '🟣',
    color: '#8B5CF6',
    capabilities: {
      vision: true,
      toolCalling: true,
      streaming: true,
    },
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT-5 series - versatile general-purpose AI',
    icon: '🟢',
    color: '#10B981',
    capabilities: {
      vision: true,
      toolCalling: true,
      streaming: true,
    },
  },
  {
    id: 'xai',
    name: 'xAI Grok',
    description: 'Grok 4 - excels at real-time knowledge',
    icon: '⚡',
    color: '#F59E0B',
    capabilities: {
      vision: true,
      toolCalling: true,
      streaming: true,
    },
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    description: 'DeepSeek V3.2 - cost-effective coding assistant',
    icon: '🔵',
    color: '#3B82F6',
    capabilities: {
      vision: false,
      toolCalling: true,
      streaming: true,
    },
  },
  {
    id: 'google',
    name: 'Google Gemini',
    description: 'Gemini 2.5 Pro - multimodal AI with strong reasoning',
    icon: '🔴',
    color: '#EA4335',
    capabilities: {
      vision: true,
      toolCalling: true,
      streaming: true,
    },
  },
];

interface CodeLabProviderSelectorProps {
  currentProvider: ProviderId;
  onProviderChange: (providerId: ProviderId) => void;
  configuredProviders?: ProviderId[];
  disabled?: boolean;
  className?: string;
  showSwitchWarning?: boolean;
}

export function CodeLabProviderSelector({
  currentProvider,
  onProviderChange,
  configuredProviders = ['claude'],
  disabled = false,
  className = '',
  showSwitchWarning = false,
}: CodeLabProviderSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [confirmSwitch, setConfirmSwitch] = useState<ProviderId | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const selectedProvider = PROVIDERS.find((p) => p.id === currentProvider) || PROVIDERS[0];
  const isConfigured = useCallback(
    (id: ProviderId) => configuredProviders.includes(id),
    [configuredProviders]
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setConfirmSwitch(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcut (Cmd+Shift+P)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'p') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }

      if (isOpen && e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
        setConfirmSwitch(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleSelect = useCallback(
    (providerId: ProviderId) => {
      if (!isConfigured(providerId)) return;

      if (showSwitchWarning && providerId !== currentProvider) {
        setConfirmSwitch(providerId);
        return;
      }

      onProviderChange(providerId);
      setIsOpen(false);
    },
    [currentProvider, isConfigured, onProviderChange, showSwitchWarning]
  );

  const confirmProviderSwitch = useCallback(() => {
    if (confirmSwitch) {
      onProviderChange(confirmSwitch);
      setConfirmSwitch(null);
      setIsOpen(false);
    }
  }, [confirmSwitch, onProviderChange]);

  return (
    <div ref={dropdownRef} className={`provider-selector ${isOpen ? 'open' : ''} ${className}`}>
      {/* Trigger Button */}
      <button
        ref={buttonRef}
        className="provider-selector-trigger"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={`Select provider: ${selectedProvider.name}`}
        title="Switch AI Provider (Cmd+Shift+P)"
      >
        <span className="provider-icon">{selectedProvider.icon}</span>
        <span className="provider-name">{selectedProvider.name}</span>
        <svg
          className="chevron"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="provider-selector-dropdown" role="listbox">
          {/* Confirmation dialog */}
          {confirmSwitch && (
            <div className="provider-confirm">
              <p className="confirm-message">
                Switch to <strong>{PROVIDERS.find((p) => p.id === confirmSwitch)?.name}</strong>?
              </p>
              <p className="confirm-warning">
                Context will be preserved but some features may differ.
              </p>
              <div className="confirm-actions">
                <button className="confirm-cancel" onClick={() => setConfirmSwitch(null)}>
                  Cancel
                </button>
                <button className="confirm-proceed" onClick={confirmProviderSwitch}>
                  Switch
                </button>
              </div>
            </div>
          )}

          {/* Provider options */}
          {!confirmSwitch &&
            PROVIDERS.map((provider) => {
              const configured = isConfigured(provider.id);
              const isSelected = provider.id === currentProvider;

              return (
                <button
                  key={provider.id}
                  className={`provider-option ${isSelected ? 'selected' : ''} ${!configured ? 'unavailable' : ''}`}
                  onClick={() => handleSelect(provider.id)}
                  role="option"
                  aria-selected={isSelected}
                  disabled={!configured}
                >
                  <div className="provider-option-header">
                    <span className="provider-icon" style={{ color: provider.color }}>
                      {provider.icon}
                    </span>
                    <span className="provider-name">{provider.name}</span>
                    {!configured && (
                      <span className="provider-badge unavailable">Not Configured</span>
                    )}
                    {configured && provider.id === 'claude' && (
                      <span className="provider-badge recommended">Default</span>
                    )}
                  </div>
                  <div className="provider-option-details">
                    <span className="provider-description">{provider.description}</span>
                    <div className="provider-capabilities">
                      {provider.capabilities.vision && (
                        <span className="capability-badge">Vision</span>
                      )}
                      {provider.capabilities.toolCalling && (
                        <span className="capability-badge">Tools</span>
                      )}
                    </div>
                  </div>
                  {isSelected && (
                    <svg
                      className="check"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                    </svg>
                  )}
                </button>
              );
            })}

          {/* Keyboard hint */}
          {!confirmSwitch && (
            <div className="provider-selector-hint">
              <kbd>Cmd+Shift+P</kbd> to toggle
            </div>
          )}
        </div>
      )}

    </div>
  );
}

export default CodeLabProviderSelector;
