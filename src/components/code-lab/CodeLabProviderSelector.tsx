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

      <style jsx>{`
        .provider-selector {
          position: relative;
          display: inline-flex;
        }

        .provider-selector-trigger {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.75rem;
          background: var(--cl-bg-secondary, #f9fafb);
          border: 1px solid var(--cl-border-primary, #e5e7eb);
          border-radius: 8px;
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--cl-text-primary, #1a1f36);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .provider-selector-trigger:hover:not(:disabled) {
          background: var(--cl-bg-tertiary, #f3f4f6);
          border-color: var(--cl-border-secondary, #d1d5db);
        }

        .provider-selector-trigger:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .provider-selector.open .provider-selector-trigger {
          background: var(--cl-bg-tertiary, #f3f4f6);
          border-color: var(--cl-accent-primary, #1e3a5f);
        }

        .provider-icon {
          font-size: 1rem;
        }

        .provider-name {
          white-space: nowrap;
        }

        .chevron {
          transition: transform 0.2s ease;
        }

        .provider-selector.open .chevron {
          transform: rotate(180deg);
        }

        .provider-selector-dropdown {
          position: absolute;
          top: calc(100% + 4px);
          left: 0;
          min-width: 340px;
          background: var(--cl-bg-primary, #ffffff);
          border: 1px solid var(--cl-border-primary, #e5e7eb);
          border-radius: 12px;
          box-shadow:
            0 10px 25px -5px rgba(0, 0, 0, 0.1),
            0 8px 10px -6px rgba(0, 0, 0, 0.1);
          z-index: 100;
          overflow: hidden;
          animation: slideDown 0.15s ease;
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .provider-option {
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          padding: 0.75rem 1rem;
          background: none;
          border: none;
          border-bottom: 1px solid var(--cl-border-primary, #e5e7eb);
          cursor: pointer;
          text-align: left;
          transition: background 0.1s ease;
          position: relative;
        }

        .provider-option:last-of-type {
          border-bottom: none;
        }

        .provider-option:hover:not(:disabled) {
          background: var(--cl-bg-secondary, #f9fafb);
        }

        .provider-option:disabled {
          cursor: not-allowed;
          opacity: 0.6;
        }

        .provider-option.selected {
          background: color-mix(in srgb, var(--cl-accent-primary, #1e3a5f) 5%, transparent);
        }

        .provider-option.unavailable {
          opacity: 0.5;
        }

        .provider-option-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          width: 100%;
        }

        .provider-option-header .provider-name {
          font-weight: 600;
          color: var(--cl-text-primary, #1a1f36);
        }

        .provider-badge {
          font-size: 0.6875rem;
          font-weight: 600;
          padding: 0.125rem 0.375rem;
          border-radius: 4px;
          text-transform: uppercase;
          letter-spacing: 0.025em;
        }

        .provider-badge.recommended {
          background: color-mix(in srgb, var(--cl-success, #10b981) 15%, transparent);
          color: var(--cl-success, #10b981);
        }

        .provider-badge.unavailable {
          background: color-mix(in srgb, var(--cl-text-tertiary, #6b7280) 15%, transparent);
          color: var(--cl-text-tertiary, #6b7280);
        }

        .provider-option-details {
          margin-top: 0.375rem;
          padding-left: 1.5rem;
        }

        .provider-description {
          font-size: 0.8125rem;
          color: var(--cl-text-secondary, #374151);
          line-height: 1.4;
        }

        .provider-capabilities {
          display: flex;
          gap: 0.375rem;
          margin-top: 0.375rem;
        }

        .capability-badge {
          font-size: 0.625rem;
          padding: 0.0625rem 0.25rem;
          background: var(--cl-bg-tertiary, #f3f4f6);
          border-radius: 3px;
          color: var(--cl-text-tertiary, #6b7280);
        }

        .check {
          position: absolute;
          right: 1rem;
          top: 50%;
          transform: translateY(-50%);
          color: var(--cl-accent-primary, #1e3a5f);
        }

        .provider-selector-hint {
          padding: 0.5rem 1rem;
          background: var(--cl-bg-secondary, #f9fafb);
          border-top: 1px solid var(--cl-border-primary, #e5e7eb);
          font-size: 0.75rem;
          color: var(--cl-text-tertiary, #6b7280);
          text-align: center;
        }

        .provider-selector-hint kbd {
          padding: 0.125rem 0.375rem;
          background: var(--cl-bg-primary, #ffffff);
          border: 1px solid var(--cl-border-secondary, #d1d5db);
          border-radius: 4px;
          font-family: inherit;
          font-size: 0.6875rem;
        }

        /* Confirmation dialog */
        .provider-confirm {
          padding: 1rem;
          text-align: center;
        }

        .confirm-message {
          font-size: 0.9375rem;
          font-weight: 500;
          color: var(--cl-text-primary, #1a1f36);
          margin-bottom: 0.5rem;
        }

        .confirm-warning {
          font-size: 0.8125rem;
          color: var(--cl-text-secondary, #374151);
          margin-bottom: 1rem;
        }

        .confirm-actions {
          display: flex;
          gap: 0.5rem;
          justify-content: center;
        }

        .confirm-cancel,
        .confirm-proceed {
          padding: 0.5rem 1rem;
          border-radius: 6px;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .confirm-cancel {
          background: var(--cl-bg-secondary, #f9fafb);
          border: 1px solid var(--cl-border-primary, #e5e7eb);
          color: var(--cl-text-primary, #1a1f36);
        }

        .confirm-cancel:hover {
          background: var(--cl-bg-tertiary, #f3f4f6);
        }

        .confirm-proceed {
          background: var(--cl-accent-primary, #1e3a5f);
          border: none;
          color: white;
        }

        .confirm-proceed:hover {
          background: color-mix(in srgb, var(--cl-accent-primary, #1e3a5f) 85%, black);
        }

        /* Dark mode adjustments */
        @media (prefers-color-scheme: dark) {
          .provider-selector-trigger {
            background: var(--cl-bg-secondary);
          }

          .provider-selector-dropdown {
            background: var(--cl-bg-primary);
          }
        }

        /* Mobile: Compact view */
        @media (max-width: 768px) {
          .provider-selector-trigger {
            padding: 0.5rem;
            gap: 0.25rem;
            background: transparent;
            border: none;
            min-width: 40px;
            min-height: 40px;
            justify-content: center;
          }

          .provider-selector-trigger:hover:not(:disabled) {
            background: rgba(255, 255, 255, 0.1);
          }

          .provider-selector-trigger .provider-name {
            display: none;
          }

          .provider-selector-trigger .chevron {
            display: none;
          }

          .provider-selector.open .provider-selector-trigger {
            background: rgba(255, 255, 255, 0.15);
            border: none;
          }

          .provider-selector-dropdown {
            min-width: 300px;
            right: 0;
            left: auto;
          }
        }

        /* Extra small screens */
        @media (max-width: 480px) {
          .provider-selector-trigger {
            padding: 0.375rem;
            min-width: 36px;
            min-height: 36px;
          }

          .provider-selector-dropdown {
            min-width: 280px;
            max-width: calc(100vw - 2rem);
          }
        }
      `}</style>
    </div>
  );
}

export default CodeLabProviderSelector;
