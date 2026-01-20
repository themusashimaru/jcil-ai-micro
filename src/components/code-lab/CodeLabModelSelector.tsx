'use client';

/**
 * CODE LAB MODEL SELECTOR
 *
 * Dropdown component for selecting AI model.
 * Features:
 * - Sonnet/Opus/Haiku selection
 * - Model capability badges
 * - Keyboard shortcut (Cmd+M)
 * - Cost indicators
 *
 * @version 1.0.0
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import type { ModelType, ModelConfig } from '@/lib/workspace/model-config';
import { AVAILABLE_MODELS } from '@/lib/workspace/model-config';

interface CodeLabModelSelectorProps {
  currentModel: string;
  onModelChange: (modelId: string) => void;
  disabled?: boolean;
  className?: string;
}

// Model icons
const modelIcons: Record<ModelType, string> = {
  sonnet: '🎵',
  opus: '🎼',
  haiku: '🍃',
};

export function CodeLabModelSelector({
  currentModel,
  onModelChange,
  disabled = false,
  className = '',
}: CodeLabModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const selectedModel = AVAILABLE_MODELS.find((m) => m.id === currentModel) || AVAILABLE_MODELS[0];

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcut (Cmd+M)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'm') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }

      if (isOpen && e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleSelect = useCallback(
    (modelId: string) => {
      onModelChange(modelId);
      setIsOpen(false);
    },
    [onModelChange]
  );

  const formatCost = (model: ModelConfig): string => {
    const avgCost = (model.costPer1kInput + model.costPer1kOutput) / 2;
    if (avgCost < 0.1) return '$';
    if (avgCost < 0.5) return '$$';
    return '$$$';
  };

  return (
    <div ref={dropdownRef} className={`model-selector ${isOpen ? 'open' : ''} ${className}`}>
      {/* Trigger Button */}
      <button
        ref={buttonRef}
        className="model-selector-trigger"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={`Select model: ${selectedModel.name}`}
      >
        <span className="model-icon">{modelIcons[selectedModel.type]}</span>
        <span className="model-name">{selectedModel.name}</span>
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
        <div className="model-selector-dropdown" role="listbox">
          {AVAILABLE_MODELS.map((model) => (
            <button
              key={model.id}
              className={`model-option ${model.id === currentModel ? 'selected' : ''}`}
              onClick={() => handleSelect(model.id)}
              role="option"
              aria-selected={model.id === currentModel}
            >
              <div className="model-option-header">
                <span className="model-icon">{modelIcons[model.type]}</span>
                <span className="model-name">{model.name}</span>
                {model.recommended && <span className="model-badge recommended">Recommended</span>}
                {model.type === 'opus' && (
                  <span className="model-badge capability">Most Capable</span>
                )}
                {model.type === 'haiku' && <span className="model-badge speed">Fastest</span>}
              </div>
              <div className="model-option-details">
                <span className="model-description">{model.description}</span>
                <div className="model-meta">
                  <span className="model-cost">{formatCost(model)}</span>
                  {model.supportsExtendedThinking && (
                    <span className="model-feature">Extended Thinking</span>
                  )}
                  {model.supportsVision && <span className="model-feature">Vision</span>}
                </div>
              </div>
              {model.id === currentModel && (
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
          ))}

          {/* Keyboard hint */}
          <div className="model-selector-hint">
            <kbd>⌘M</kbd> to toggle
          </div>
        </div>
      )}

      <style jsx>{`
        .model-selector {
          position: relative;
          display: inline-flex;
        }

        .model-selector-trigger {
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

        .model-selector-trigger:hover:not(:disabled) {
          background: var(--cl-bg-tertiary, #f3f4f6);
          border-color: var(--cl-border-secondary, #d1d5db);
        }

        .model-selector-trigger:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .model-selector.open .model-selector-trigger {
          background: var(--cl-bg-tertiary, #f3f4f6);
          border-color: var(--cl-accent-primary, #1e3a5f);
        }

        .model-icon {
          font-size: 1rem;
        }

        .model-name {
          white-space: nowrap;
        }

        .chevron {
          transition: transform 0.2s ease;
        }

        .model-selector.open .chevron {
          transform: rotate(180deg);
        }

        .model-selector-dropdown {
          position: absolute;
          top: calc(100% + 4px);
          left: 0;
          min-width: 320px;
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

        .model-option {
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

        .model-option:last-of-type {
          border-bottom: none;
        }

        .model-option:hover {
          background: var(--cl-bg-secondary, #f9fafb);
        }

        .model-option.selected {
          background: color-mix(in srgb, var(--cl-accent-primary, #1e3a5f) 5%, transparent);
        }

        .model-option-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          width: 100%;
        }

        .model-option-header .model-name {
          font-weight: 600;
          color: var(--cl-text-primary, #1a1f36);
        }

        .model-badge {
          font-size: 0.6875rem;
          font-weight: 600;
          padding: 0.125rem 0.375rem;
          border-radius: 4px;
          text-transform: uppercase;
          letter-spacing: 0.025em;
        }

        .model-badge.recommended {
          background: color-mix(in srgb, var(--cl-success, #10b981) 15%, transparent);
          color: var(--cl-success, #10b981);
        }

        .model-badge.capability {
          background: color-mix(in srgb, var(--cl-model-opus, #8b5cf6) 15%, transparent);
          color: var(--cl-model-opus, #8b5cf6);
        }

        .model-badge.speed {
          background: color-mix(in srgb, var(--cl-model-haiku, #10b981) 15%, transparent);
          color: var(--cl-model-haiku, #10b981);
        }

        .model-option-details {
          margin-top: 0.375rem;
          padding-left: 1.5rem;
        }

        .model-description {
          font-size: 0.8125rem;
          color: var(--cl-text-secondary, #374151);
          line-height: 1.4;
        }

        .model-meta {
          display: flex;
          gap: 0.5rem;
          margin-top: 0.375rem;
        }

        .model-cost {
          font-size: 0.75rem;
          color: var(--cl-text-tertiary, #6b7280);
        }

        .model-feature {
          font-size: 0.6875rem;
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

        .model-selector-hint {
          padding: 0.5rem 1rem;
          background: var(--cl-bg-secondary, #f9fafb);
          border-top: 1px solid var(--cl-border-primary, #e5e7eb);
          font-size: 0.75rem;
          color: var(--cl-text-tertiary, #6b7280);
          text-align: center;
        }

        .model-selector-hint kbd {
          padding: 0.125rem 0.375rem;
          background: var(--cl-bg-primary, #ffffff);
          border: 1px solid var(--cl-border-secondary, #d1d5db);
          border-radius: 4px;
          font-family: inherit;
          font-size: 0.6875rem;
        }

        /* Dark mode adjustments */
        @media (prefers-color-scheme: dark) {
          .model-selector-trigger {
            background: var(--cl-bg-secondary);
          }

          .model-selector-dropdown {
            background: var(--cl-bg-primary);
          }
        }

        /* Mobile: Compact view - borderless icon only */
        @media (max-width: 768px) {
          .model-selector-trigger {
            padding: 0.5rem;
            gap: 0.25rem;
            background: transparent;
            border: none;
            min-width: 40px;
            min-height: 40px;
            justify-content: center;
          }

          .model-selector-trigger:hover:not(:disabled) {
            background: rgba(255, 255, 255, 0.1);
          }

          .model-selector-trigger .model-name {
            display: none;
          }

          .model-selector-trigger .chevron {
            display: none;
          }

          .model-selector.open .model-selector-trigger {
            background: rgba(255, 255, 255, 0.15);
            border: none;
          }

          .model-selector-dropdown {
            min-width: 280px;
            right: 0;
            left: auto;
          }
        }

        /* Extra small screens */
        @media (max-width: 480px) {
          .model-selector-trigger {
            padding: 0.375rem;
            min-width: 36px;
            min-height: 36px;
          }

          .model-selector-dropdown {
            min-width: 260px;
            max-width: calc(100vw - 2rem);
          }
        }
      `}</style>
    </div>
  );
}

export default CodeLabModelSelector;
