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
        { keys: ['Escape'], description: 'Close modal / Cancel stream' },
      ],
    },
    {
      title: 'Sessions',
      shortcuts: [
        { keys: [cmdKey, 'N'], description: 'New session' },
        { keys: [cmdKey, 'E'], description: 'Export current session' },
      ],
    },
    {
      title: 'Composer',
      shortcuts: [
        { keys: ['Enter'], description: 'Send message' },
        { keys: ['Shift', 'Enter'], description: 'New line' },
        { keys: [cmdKey, 'Enter'], description: 'Send message (force)' },
        { keys: [cmdKey, 'V'], description: 'Paste files/images' },
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
          <button className="close-btn" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
          max-width: 720px;
          max-height: 85vh;
          background: white;
          border-radius: 16px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
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
          border-bottom: 1px solid #e5e7eb;
          background: linear-gradient(to bottom, #f9fafb, #ffffff);
        }

        .shortcuts-header h2 {
          margin: 0;
          font-size: 1.25rem;
          font-weight: 600;
          color: #1a1f36;
        }

        .close-btn {
          background: none;
          border: none;
          padding: 0.5rem;
          cursor: pointer;
          color: #6b7280;
          border-radius: 8px;
          transition: all 0.15s;
        }

        .close-btn:hover {
          background: #f3f4f6;
          color: #1a1f36;
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
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 1.5rem;
        }

        .shortcut-category {
          background: #f9fafb;
          border-radius: 12px;
          padding: 1rem;
        }

        .shortcut-category h3 {
          margin: 0 0 0.75rem;
          font-size: 0.8125rem;
          font-weight: 600;
          color: #1e3a5f;
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
          gap: 1rem;
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
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          font-size: 0.75rem;
          font-family: inherit;
          font-weight: 500;
          color: #374151;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        }

        .shortcut-keys kbd.command {
          background: #eef2ff;
          border-color: #c7d2fe;
          color: #1e3a5f;
          font-family: 'SF Mono', 'Menlo', monospace;
        }

        .key-separator {
          color: #9ca3af;
          font-size: 0.6875rem;
          margin: 0 0.125rem;
        }

        .shortcut-desc {
          font-size: 0.8125rem;
          color: #4b5563;
          text-align: right;
        }

        .shortcuts-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.875rem 1.5rem;
          border-top: 1px solid #e5e7eb;
          background: #f9fafb;
        }

        .platform-note {
          font-size: 0.75rem;
          color: #9ca3af;
        }

        .shortcuts-footer kbd {
          display: inline-flex;
          align-items: center;
          padding: 0.25rem 0.5rem;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 4px;
          font-size: 0.6875rem;
          font-family: inherit;
          color: #6b7280;
          margin-right: 0.25rem;
        }

        @media (max-width: 640px) {
          .shortcuts-panel {
            max-height: 90vh;
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
