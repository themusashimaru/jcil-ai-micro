'use client';

/**
 * CODE LAB THINKING TOGGLE
 *
 * Toggle button for enabling extended thinking mode.
 * Features:
 * - Visual indicator when enabled
 * - Budget configuration
 * - Keyboard shortcut (Cmd+T)
 *
 * @version 1.0.0
 */

import { useState, useCallback, useEffect } from 'react';
import type { ExtendedThinkingConfig } from '@/lib/workspace/extended-thinking';

interface CodeLabThinkingToggleProps {
  config: ExtendedThinkingConfig;
  onToggle: () => void;
  onBudgetChange: (budget: number) => void;
  disabled?: boolean;
  className?: string;
}

const BUDGET_PRESETS = [
  { value: 5000, label: '5K', description: 'Quick thinking' },
  { value: 10000, label: '10K', description: 'Standard' },
  { value: 25000, label: '25K', description: 'Deep analysis' },
  { value: 50000, label: '50K', description: 'Maximum depth' },
];

export function CodeLabThinkingToggle({
  config,
  onToggle,
  onBudgetChange,
  disabled = false,
  className = '',
}: CodeLabThinkingToggleProps) {
  const [showBudgetMenu, setShowBudgetMenu] = useState(false);

  // Keyboard shortcut (Cmd+T)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 't' && !e.shiftKey) {
        e.preventDefault();
        if (!disabled) {
          onToggle();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onToggle, disabled]);

  const handleBudgetSelect = useCallback(
    (budget: number) => {
      onBudgetChange(budget);
      setShowBudgetMenu(false);
    },
    [onBudgetChange]
  );

  const currentPreset = BUDGET_PRESETS.find((p) => p.value === config.budgetTokens);

  return (
    <div className={`thinking-toggle-container ${className}`}>
      {/* Main toggle button */}
      <button
        className={`thinking-toggle ${config.enabled ? 'enabled' : ''}`}
        onClick={onToggle}
        disabled={disabled}
        aria-pressed={config.enabled}
        aria-label={`Extended thinking: ${config.enabled ? 'enabled' : 'disabled'}`}
        title={`Extended Thinking (⌘T)${config.enabled ? ` - ${currentPreset?.label || config.budgetTokens} tokens` : ''}`}
      >
        <span className="thinking-icon">💭</span>
        <span className="thinking-label">Think</span>
        {config.enabled && (
          <span className="thinking-badge">
            {currentPreset?.label || `${Math.round(config.budgetTokens / 1000)}K`}
          </span>
        )}
      </button>

      {/* Budget selector dropdown */}
      {config.enabled && (
        <div className="budget-selector">
          <button
            className="budget-trigger"
            onClick={() => setShowBudgetMenu(!showBudgetMenu)}
            aria-expanded={showBudgetMenu}
            aria-label="Select thinking budget"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {showBudgetMenu && (
            <div className="budget-menu">
              {BUDGET_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  className={`budget-option ${config.budgetTokens === preset.value ? 'selected' : ''}`}
                  onClick={() => handleBudgetSelect(preset.value)}
                >
                  <span className="budget-value">{preset.label}</span>
                  <span className="budget-description">{preset.description}</span>
                  {config.budgetTokens === preset.value && (
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
          )}
        </div>
      )}

      <style jsx>{`
        .thinking-toggle-container {
          display: flex;
          align-items: center;
          gap: 2px;
        }

        .thinking-toggle {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.375rem 0.625rem;
          background: var(--cl-bg-secondary, #f9fafb);
          border: 1px solid var(--cl-border-primary, #e5e7eb);
          border-radius: 6px;
          font-size: 0.8125rem;
          font-weight: 500;
          color: var(--cl-text-secondary, #6b7280);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .thinking-toggle:hover:not(:disabled) {
          background: var(--cl-bg-tertiary, #f3f4f6);
          color: var(--cl-text-primary, #1a1f36);
        }

        .thinking-toggle:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .thinking-toggle.enabled {
          background: color-mix(in srgb, var(--cl-thinking, #8b5cf6) 10%, transparent);
          border-color: var(--cl-thinking, #8b5cf6);
          color: var(--cl-thinking, #8b5cf6);
        }

        .thinking-icon {
          font-size: 1rem;
        }

        .thinking-label {
          white-space: nowrap;
        }

        .thinking-badge {
          padding: 0.0625rem 0.25rem;
          background: var(--cl-thinking, #8b5cf6);
          border-radius: 3px;
          font-size: 0.625rem;
          font-weight: 600;
          color: white;
        }

        .budget-selector {
          position: relative;
        }

        .budget-trigger {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 28px;
          background: var(--cl-bg-secondary, #f9fafb);
          border: 1px solid var(--cl-border-primary, #e5e7eb);
          border-left: none;
          border-radius: 0 6px 6px 0;
          color: var(--cl-text-tertiary, #6b7280);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .budget-trigger:hover {
          background: var(--cl-bg-tertiary, #f3f4f6);
          color: var(--cl-text-primary, #1a1f36);
        }

        .budget-menu {
          position: absolute;
          top: calc(100% + 4px);
          right: 0;
          min-width: 160px;
          background: var(--cl-bg-primary, #ffffff);
          border: 1px solid var(--cl-border-primary, #e5e7eb);
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          z-index: 100;
          overflow: hidden;
          animation: slideDown 0.15s ease;
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .budget-option {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.75rem;
          background: none;
          border: none;
          border-bottom: 1px solid var(--cl-border-primary, #e5e7eb);
          cursor: pointer;
          text-align: left;
          transition: background 0.1s ease;
          position: relative;
        }

        .budget-option:last-child {
          border-bottom: none;
        }

        .budget-option:hover {
          background: var(--cl-bg-secondary, #f9fafb);
        }

        .budget-option.selected {
          background: color-mix(in srgb, var(--cl-thinking, #8b5cf6) 5%, transparent);
        }

        .budget-value {
          font-weight: 600;
          font-family: 'SF Mono', monospace;
          font-size: 0.8125rem;
          color: var(--cl-text-primary, #1a1f36);
        }

        .budget-description {
          font-size: 0.75rem;
          color: var(--cl-text-tertiary, #6b7280);
        }

        .check {
          position: absolute;
          right: 0.75rem;
          color: var(--cl-thinking, #8b5cf6);
        }

        /* Combine toggle and dropdown visually when enabled */
        .thinking-toggle.enabled {
          border-radius: 6px 0 0 6px;
        }

        /* Mobile: Compact view - borderless icon only */
        @media (max-width: 768px) {
          .thinking-toggle-container {
            gap: 0;
          }

          .thinking-toggle {
            padding: 0.5rem;
            gap: 0.25rem;
            background: transparent;
            border: none;
            min-width: 40px;
            min-height: 40px;
            justify-content: center;
          }

          .thinking-toggle:hover:not(:disabled) {
            background: rgba(255, 255, 255, 0.1);
          }

          .thinking-toggle.enabled {
            background: rgba(139, 92, 246, 0.2);
            border: none;
            border-radius: 6px;
          }

          .thinking-label {
            display: none;
          }

          .thinking-badge {
            display: none;
          }

          .budget-trigger {
            display: none;
          }

          .budget-menu {
            min-width: 140px;
          }
        }

        /* Extra small screens */
        @media (max-width: 480px) {
          .thinking-toggle {
            padding: 0.375rem;
            min-width: 36px;
            min-height: 36px;
          }

          .thinking-icon {
            font-size: 0.875rem;
          }
        }
      `}</style>
    </div>
  );
}

export default CodeLabThinkingToggle;
