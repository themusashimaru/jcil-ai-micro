/** Inline model selector dropdown for CodeLab composer */

'use client';

import { useRef, useEffect } from 'react';

// Model display names organized by provider
const MODEL_DISPLAY_NAMES: Record<
  string,
  { name: string; description?: string; provider?: string }
> = {
  'claude-sonnet-4-6': { name: 'Sonnet 4.6', description: 'Fast & capable', provider: 'claude' },
  'claude-opus-4-6': { name: 'Opus', description: 'Most capable', provider: 'claude' },
  'claude-haiku-4-5-20251001': { name: 'Haiku 4.5', description: 'Fastest', provider: 'claude' },
  'claude-sonnet-4-6-thinking': {
    name: 'Sonnet (Thinking)',
    description: 'Deep reasoning',
    provider: 'claude',
  },
  'claude-opus-4-6-thinking': {
    name: 'Opus (Thinking)',
    description: 'Deepest reasoning',
    provider: 'claude',
  },
  'gpt-5.2': { name: 'GPT-5.2', description: 'All-around + strong coding', provider: 'openai' },
  'grok-4-1-fast-reasoning': {
    name: 'Grok 4.1 Fast (R)',
    description: 'Reasoning, 2M context ($0.20/$0.50)',
    provider: 'xai',
  },
  'grok-code-fast-1': {
    name: 'Grok Code Fast',
    description: 'Agentic coding ($0.20/$1.50)',
    provider: 'xai',
  },
  'deepseek-reasoner': {
    name: 'DeepSeek Reasoner',
    description: 'Math, logic, coding ($0.55/$2.19)',
    provider: 'deepseek',
  },
  'gemini-3-pro-preview': {
    name: 'Gemini 3 Pro',
    description: 'Deep reasoning, complex coding ($2/$12)',
    provider: 'google',
  },
  'gemini-3-flash-preview': {
    name: 'Gemini 3 Flash',
    description: 'Fast general AI, production ($0.50/$3)',
    provider: 'google',
  },
};

const PROVIDERS = [
  { id: 'claude', label: 'Claude (Anthropic)' },
  { id: 'openai', label: 'OpenAI GPT' },
  { id: 'xai', label: 'xAI (Grok)' },
  { id: 'deepseek', label: 'DeepSeek' },
  { id: 'google', label: 'Google (Gemini)' },
];

interface CodeLabComposerModelDropdownProps {
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  displayModelId: string;
  onModelChange: (modelId: string) => void;
  disabled?: boolean;
  isStreaming: boolean;
  modelSwitchFlash?: boolean;
}

export function CodeLabComposerModelDropdown({
  isOpen,
  onToggle,
  onClose,
  displayModelId,
  onModelChange,
  disabled,
  isStreaming,
  modelSwitchFlash,
}: CodeLabComposerModelDropdownProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div className="inline-model-selector" ref={ref}>
      <button
        className={`model-selector-trigger ${modelSwitchFlash ? 'model-flash' : ''}`}
        onClick={onToggle}
        disabled={disabled || isStreaming}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className="model-name">{MODEL_DISPLAY_NAMES[displayModelId]?.name || 'Model'}</span>
        <svg
          className={`model-chevron ${isOpen ? 'open' : ''}`}
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="model-dropdown" role="listbox">
          {PROVIDERS.map(({ id, label }) => {
            const models = Object.entries(MODEL_DISPLAY_NAMES).filter(
              ([, { provider }]) => provider === id
            );
            if (models.length === 0) return null;
            return (
              <div key={id}>
                <div className="model-provider-header">{label}</div>
                {models.map(([modelId, { name, description }]) => (
                  <button
                    key={modelId}
                    className={`model-option ${modelId === displayModelId ? 'selected' : ''}`}
                    onClick={() => {
                      onModelChange(modelId);
                      onClose();
                    }}
                    role="option"
                    aria-selected={modelId === displayModelId}
                  >
                    <div className="model-info">
                      <span className="model-name">{name}</span>
                      {description && <span className="model-desc">{description}</span>}
                    </div>
                    {modelId === displayModelId && (
                      <svg
                        className="check"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            );
          })}
          <div className="model-hint">⌘M to toggle</div>
        </div>
      )}
    </div>
  );
}
