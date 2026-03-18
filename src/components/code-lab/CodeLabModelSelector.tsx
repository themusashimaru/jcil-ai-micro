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
import './code-lab-model-selector.css';

interface CodeLabModelSelectorProps {
  currentModel: string;
  onModelChange: (modelId: string) => void;
  disabled?: boolean;
  className?: string;
}

// Model type indicators (simple text)
const modelIndicators: Record<ModelType, string> = {
  sonnet: 'S',
  opus: 'O',
  haiku: 'H',
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
        <span className="model-indicator">{modelIndicators[selectedModel.type]}</span>
        <span className="model-name">{selectedModel.name}</span>
        <svg
          className="chevron"
          width="10"
          height="10"
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
                <span className="model-indicator">{modelIndicators[model.type]}</span>
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

    </div>
  );
}

export default CodeLabModelSelector;
