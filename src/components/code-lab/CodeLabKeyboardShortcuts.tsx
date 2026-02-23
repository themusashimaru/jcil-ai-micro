'use client';

/**
 * CODE LAB KEYBOARD SHORTCUTS PANEL
 *
 * A beautiful modal showing all available keyboard shortcuts.
 * Features:
 * - Categorized shortcuts
 * - Platform-aware (Mac vs Windows/Linux)
 * - Easy to scan layout
 */

import { useEffect, useRef } from 'react';

interface CodeLabKeyboardShortcutsProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Shortcut {
  keys: string[];
  description: string;
}

interface ShortcutCategory {
  title: string;
  shortcuts: Shortcut[];
}

export function CodeLabKeyboardShortcuts({ isOpen, onClose }: CodeLabKeyboardShortcutsProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Detect Mac vs other platforms
  const isMac =
    typeof window !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const cmdKey = isMac ? '⌘' : 'Ctrl';
  // optKey available for future use: const optKey = isMac ? '⌥' : 'Alt';

  const categories: ShortcutCategory[] = [
    {
      title: 'Navigation',
      shortcuts: [
        { keys: [cmdKey, 'K'], description: 'Open command palette' },
        { keys: [cmdKey, 'Shift', 'P'], description: 'Open command palette (alt)' },
        { keys: [cmdKey, '/'], description: 'Show keyboard shortcuts' },
        { keys: [cmdKey, 'B'], description: 'Toggle sidebar' },
        { keys: [cmdKey, '1-9'], description: 'Switch to session 1-9' },
        { keys: ['Escape'], description: 'Close modal / Cancel stream' },
      ],
    },
    {
      title: 'Sessions',
      shortcuts: [
        { keys: [cmdKey, 'N'], description: 'New session' },
        { keys: [cmdKey, 'E'], description: 'Export current session' },
        { keys: [cmdKey, 'W'], description: 'Close current session' },
        { keys: [cmdKey, 'Shift', 'T'], description: 'Reopen closed session' },
      ],
    },
    {
      title: 'Composer',
      shortcuts: [
        { keys: ['Enter'], description: 'Send message' },
        { keys: ['Shift', 'Enter'], description: 'New line' },
        { keys: [cmdKey, 'Enter'], description: 'Send message (force)' },
        { keys: [cmdKey, 'V'], description: 'Paste files/images' },
        { keys: ['↑'], description: 'Previous message (when empty)' },
        { keys: [cmdKey, 'L'], description: 'Clear conversation' },
      ],
    },
    {
      title: 'Editor',
      shortcuts: [
        { keys: [cmdKey, 'S'], description: 'Save file' },
        { keys: [cmdKey, 'Z'], description: 'Undo' },
        { keys: [cmdKey, 'Shift', 'Z'], description: 'Redo' },
        { keys: [cmdKey, 'F'], description: 'Find in file' },
        { keys: [cmdKey, 'G'], description: 'Go to line' },
        { keys: ['F12'], description: 'Go to definition' },
        { keys: ['Shift', 'F12'], description: 'Find references' },
        { keys: [cmdKey, 'Space'], description: 'Trigger autocomplete' },
      ],
    },
    {
      title: 'Terminal',
      shortcuts: [
        { keys: [cmdKey, '`'], description: 'Toggle terminal' },
        { keys: [cmdKey, 'Shift', '`'], description: 'New terminal' },
        { keys: ['Ctrl', 'C'], description: 'Cancel running command' },
        { keys: ['Ctrl', 'L'], description: 'Clear terminal' },
        { keys: ['↑', '↓'], description: 'Navigate command history' },
        { keys: ['Tab'], description: 'Autocomplete command' },
      ],
    },
    {
      title: 'Slash Commands',
      shortcuts: [
        { keys: ['/fix'], description: 'Fix errors and bugs' },
        { keys: ['/test'], description: 'Run tests' },
        { keys: ['/build'], description: 'Run build' },
        { keys: ['/commit'], description: 'Stage and commit changes' },
        { keys: ['/push'], description: 'Push to remote' },
        { keys: ['/review'], description: 'Code review' },
        { keys: ['/explain'], description: 'Explain code' },
        { keys: ['/refactor'], description: 'Refactor code' },
        { keys: ['/workspace'], description: 'Enable sandbox mode' },
        { keys: ['/help'], description: 'Show all commands' },
      ],
    },
    {
      title: 'Voice & Search',
      shortcuts: [
        { keys: ['🎤'], description: 'Click mic for voice input' },
        { keys: ['🔍'], description: 'Click search for web search' },
        { keys: [cmdKey, 'K'], description: 'Toggle web search (in composer)' },
      ],
    },
  ];

  // Close on escape
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Focus trap
  useEffect(() => {
    if (isOpen && panelRef.current) {
      panelRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="shortcuts-overlay" onClick={onClose}>
      <div
        ref={panelRef}
        className="shortcuts-panel"
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        <div className="shortcuts-header">
          <h2>Keyboard Shortcuts</h2>
          <button className="close-btn" onClick={onClose} aria-label="Close keyboard shortcuts">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="shortcuts-content">
          {categories.map((category) => (
            <div key={category.title} className="shortcut-category">
              <h3>{category.title}</h3>
              <div className="shortcut-list">
                {category.shortcuts.map((shortcut, idx) => (
                  <div key={idx} className="shortcut-item">
                    <div className="shortcut-keys">
                      {shortcut.keys.map((key, keyIdx) => (
                        <span key={keyIdx}>
                          <kbd className={key.startsWith('/') ? 'command' : ''}>{key}</kbd>
                          {keyIdx < shortcut.keys.length - 1 && (
                            <span className="key-separator">+</span>
                          )}
                        </span>
                      ))}
                    </div>
                    <span className="shortcut-desc">{shortcut.description}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="shortcuts-footer">
          <span className="platform-note">
            {isMac ? 'Showing Mac shortcuts' : 'Showing Windows/Linux shortcuts'}
          </span>
          <kbd>ESC</kbd> to close
        </div>
      </div>

      <style jsx>{`
        .shortcuts-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          animation: fadeIn 0.15s ease;
          padding: 1rem;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .shortcuts-panel {
          width: 100%;
          max-width: 800px;
          max-height: 85vh;
          background: var(--cl-bg-primary);
          border-radius: 16px;
          box-shadow: var(--cl-shadow-xl);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          animation: slideUp 0.2s ease;
          outline: none;
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .shortcuts-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.25rem 1.5rem;
          border-bottom: 1px solid var(--cl-border-primary);
          background: var(--cl-bg-secondary);
        }

        .shortcuts-header h2 {
          margin: 0;
          font-size: 1.25rem;
          font-weight: 600;
          color: var(--cl-text-primary);
        }

        .close-btn {
          background: none;
          border: none;
          padding: 0.625rem;
          min-width: 44px;
          min-height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: var(--cl-text-muted);
          border-radius: 8px;
          transition: all 0.15s;
        }

        .close-btn:hover {
          background: var(--cl-bg-hover);
          color: var(--cl-text-primary);
        }

        .close-btn svg {
          width: 20px;
          height: 20px;
        }

        .shortcuts-content {
          flex: 1;
          overflow-y: auto;
          padding: 1.5rem;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 1.25rem;
        }

        .shortcut-category {
          background: var(--cl-bg-secondary);
          border-radius: 12px;
          padding: 1rem;
        }

        .shortcut-category h3 {
          margin: 0 0 0.75rem;
          font-size: 0.8125rem;
          font-weight: 600;
          color: var(--cl-accent-primary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .shortcut-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .shortcut-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          padding: 0.375rem 0;
        }

        .shortcut-keys {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          flex-shrink: 0;
        }

        .shortcut-keys kbd {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 24px;
          padding: 0.25rem 0.5rem;
          background: var(--cl-bg-primary);
          border: 1px solid var(--cl-border-primary);
          border-radius: 6px;
          font-size: 0.75rem;
          font-family: inherit;
          font-weight: 500;
          color: var(--cl-text-secondary);
          box-shadow: var(--cl-shadow-sm);
        }

        .shortcut-keys kbd.command {
          background: var(--cl-accent-bg);
          border-color: var(--cl-accent-primary);
          color: var(--cl-accent-primary);
          font-family: 'SF Mono', 'Menlo', monospace;
        }

        .key-separator {
          color: var(--cl-text-muted);
          font-size: 0.6875rem;
          margin: 0 0.125rem;
        }

        .shortcut-desc {
          font-size: 0.8125rem;
          color: var(--cl-text-tertiary);
          text-align: right;
        }

        .shortcuts-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.875rem 1.5rem;
          border-top: 1px solid var(--cl-border-primary);
          background: var(--cl-bg-secondary);
        }

        .platform-note {
          font-size: 0.75rem;
          color: var(--cl-text-muted);
        }

        .shortcuts-footer kbd {
          display: inline-flex;
          align-items: center;
          padding: 0.25rem 0.5rem;
          background: var(--cl-bg-primary);
          border: 1px solid var(--cl-border-primary);
          border-radius: 4px;
          font-size: 0.6875rem;
          font-family: inherit;
          color: var(--cl-text-muted);
          margin-right: 0.25rem;
        }

        @media (max-width: 640px) {
          .shortcuts-panel {
            max-height: 90vh;
            border-radius: 16px 16px 0 0;
          }

          .shortcuts-content {
            padding: 1rem;
            grid-template-columns: 1fr;
            gap: 1rem;
          }

          .shortcut-category {
            padding: 0.75rem;
          }

          .shortcut-desc {
            font-size: 0.75rem;
          }
        }
      `}</style>
    </div>
  );
}
