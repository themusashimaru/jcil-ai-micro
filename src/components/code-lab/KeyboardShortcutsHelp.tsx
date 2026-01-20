/**
 * KEYBOARD SHORTCUTS HELP - LOW-005 FIX
 *
 * Documentation modal for keyboard shortcuts in Code Lab.
 * Shows all available shortcuts organized by category.
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';

// ============================================================================
// TYPES
// ============================================================================

interface ShortcutCategory {
  name: string;
  shortcuts: Shortcut[];
}

interface Shortcut {
  keys: string[];
  description: string;
  platform?: 'mac' | 'windows' | 'all';
}

// ============================================================================
// SHORTCUT DATA
// ============================================================================

const SHORTCUT_CATEGORIES: ShortcutCategory[] = [
  {
    name: 'Editor',
    shortcuts: [
      { keys: ['Cmd/Ctrl', 'S'], description: 'Save file' },
      { keys: ['Cmd/Ctrl', 'F'], description: 'Find in file' },
      { keys: ['Cmd/Ctrl', 'Z'], description: 'Undo' },
      { keys: ['Cmd/Ctrl', 'Shift', 'Z'], description: 'Redo' },
      { keys: ['Tab'], description: 'Insert indent' },
      { keys: ['Shift', 'Tab'], description: 'Remove indent' },
      { keys: ['Cmd/Ctrl', 'D'], description: 'Duplicate line' },
      { keys: ['Cmd/Ctrl', '/'], description: 'Toggle comment' },
      { keys: ['Esc'], description: 'Close search/dialogs' },
    ],
  },
  {
    name: 'Navigation',
    shortcuts: [
      { keys: ['Cmd/Ctrl', 'P'], description: 'Quick open file' },
      { keys: ['Cmd/Ctrl', 'G'], description: 'Go to line' },
      { keys: ['Cmd/Ctrl', 'Shift', 'P'], description: 'Command palette' },
      { keys: ['Cmd/Ctrl', 'B'], description: 'Toggle sidebar' },
      { keys: ['Cmd/Ctrl', 'J'], description: 'Toggle terminal' },
      { keys: ['Cmd/Ctrl', '1-9'], description: 'Switch to tab N' },
      { keys: ['Cmd/Ctrl', 'W'], description: 'Close current tab' },
    ],
  },
  {
    name: 'Chat & AI',
    shortcuts: [
      { keys: ['Cmd/Ctrl', 'Enter'], description: 'Send message' },
      { keys: ['Cmd/Ctrl', 'Shift', 'Enter'], description: 'Send with new session' },
      { keys: ['Up'], description: 'Previous message (in empty input)' },
      { keys: ['Cmd/Ctrl', 'K'], description: 'Focus chat input' },
      { keys: ['Esc'], description: 'Cancel AI generation' },
    ],
  },
  {
    name: 'Code Changes',
    shortcuts: [
      { keys: ['Cmd/Ctrl', 'Shift', 'A'], description: 'Accept all changes' },
      { keys: ['Cmd/Ctrl', 'Shift', 'R'], description: 'Reject all changes' },
      { keys: ['Enter'], description: 'Accept current change' },
      { keys: ['Backspace'], description: 'Reject current change' },
      { keys: ['N'], description: 'Next change' },
      { keys: ['P'], description: 'Previous change' },
    ],
  },
  {
    name: 'Terminal',
    shortcuts: [
      { keys: ['Cmd/Ctrl', 'C'], description: 'Copy / Cancel running command' },
      { keys: ['Cmd/Ctrl', 'V'], description: 'Paste' },
      { keys: ['Cmd/Ctrl', 'L'], description: 'Clear terminal' },
      { keys: ['Up/Down'], description: 'Navigate command history' },
    ],
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatKey(key: string, isMac: boolean): string {
  const keyMap: Record<string, Record<string, string>> = {
    'Cmd/Ctrl': { mac: '⌘', windows: 'Ctrl' },
    Cmd: { mac: '⌘', windows: 'Ctrl' },
    Ctrl: { mac: '⌃', windows: 'Ctrl' },
    Alt: { mac: '⌥', windows: 'Alt' },
    Shift: { mac: '⇧', windows: 'Shift' },
    Enter: { mac: '↵', windows: 'Enter' },
    Tab: { mac: '⇥', windows: 'Tab' },
    Esc: { mac: '⎋', windows: 'Esc' },
    Backspace: { mac: '⌫', windows: 'Backspace' },
    Up: { mac: '↑', windows: '↑' },
    Down: { mac: '↓', windows: '↓' },
    Left: { mac: '←', windows: '←' },
    Right: { mac: '→', windows: '→' },
  };

  const platform = isMac ? 'mac' : 'windows';
  return keyMap[key]?.[platform] || key;
}

// ============================================================================
// COMPONENT
// ============================================================================

interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsHelp({ isOpen, onClose }: KeyboardShortcutsHelpProps) {
  const [isMac, setIsMac] = useState(false);

  // Detect platform
  useEffect(() => {
    setIsMac(navigator.platform.toLowerCase().includes('mac'));
  }, []);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      <div className="shortcuts-overlay" onClick={onClose} aria-hidden="true" />
      <div
        className="shortcuts-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
      >
        <div className="shortcuts-header">
          <h2 id="shortcuts-title">Keyboard Shortcuts</h2>
          <button
            className="shortcuts-close"
            onClick={onClose}
            aria-label="Close keyboard shortcuts"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="shortcuts-content">
          <div className="shortcuts-platform">
            <button
              className={`platform-btn ${isMac ? 'active' : ''}`}
              onClick={() => setIsMac(true)}
            >
              Mac
            </button>
            <button
              className={`platform-btn ${!isMac ? 'active' : ''}`}
              onClick={() => setIsMac(false)}
            >
              Windows/Linux
            </button>
          </div>

          <div className="shortcuts-grid">
            {SHORTCUT_CATEGORIES.map((category) => (
              <div key={category.name} className="shortcuts-category">
                <h3>{category.name}</h3>
                <div className="shortcuts-list">
                  {category.shortcuts.map((shortcut, index) => (
                    <div key={index} className="shortcut-item">
                      <span className="shortcut-description">{shortcut.description}</span>
                      <span className="shortcut-keys">
                        {shortcut.keys.map((key, i) => (
                          <React.Fragment key={key}>
                            {i > 0 && <span className="key-separator">+</span>}
                            <kbd>{formatKey(key, isMac)}</kbd>
                          </React.Fragment>
                        ))}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="shortcuts-footer">
          <span className="shortcuts-tip">
            Press <kbd>{isMac ? '⌘' : 'Ctrl'}</kbd>+<kbd>?</kbd> to toggle this help
          </span>
        </div>
      </div>

      <style jsx>{`
        .shortcuts-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 1000;
          animation: fadeIn 0.15s ease;
        }

        .shortcuts-modal {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 90%;
          max-width: 800px;
          max-height: 85vh;
          background: #ffffff;
          border-radius: 12px;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
          z-index: 1001;
          display: flex;
          flex-direction: column;
          animation: scaleIn 0.2s ease;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
        }

        .shortcuts-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem 1.5rem;
          border-bottom: 1px solid #e5e7eb;
        }

        .shortcuts-header h2 {
          margin: 0;
          font-size: 1.25rem;
          font-weight: 600;
          color: #111827;
        }

        .shortcuts-close {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          padding: 0;
          background: none;
          border: none;
          border-radius: 6px;
          color: #6b7280;
          cursor: pointer;
          transition: all 0.15s;
        }

        .shortcuts-close:hover {
          background: #f3f4f6;
          color: #111827;
        }

        .shortcuts-close svg {
          width: 20px;
          height: 20px;
        }

        .shortcuts-content {
          flex: 1;
          overflow-y: auto;
          padding: 1rem 1.5rem;
        }

        .shortcuts-platform {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1.5rem;
        }

        .platform-btn {
          padding: 0.5rem 1rem;
          background: #f3f4f6;
          border: 1px solid transparent;
          border-radius: 6px;
          font-size: 0.875rem;
          font-weight: 500;
          color: #6b7280;
          cursor: pointer;
          transition: all 0.15s;
        }

        .platform-btn.active {
          background: #1e3a5f;
          color: #ffffff;
        }

        .platform-btn:hover:not(.active) {
          background: #e5e7eb;
        }

        .shortcuts-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 1.5rem;
        }

        .shortcuts-category h3 {
          margin: 0 0 0.75rem;
          font-size: 0.875rem;
          font-weight: 600;
          color: #374151;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .shortcuts-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .shortcut-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.5rem 0.75rem;
          background: #f9fafb;
          border-radius: 6px;
        }

        .shortcut-description {
          font-size: 0.875rem;
          color: #374151;
        }

        .shortcut-keys {
          display: flex;
          align-items: center;
          gap: 0.25rem;
        }

        .key-separator {
          font-size: 0.75rem;
          color: #9ca3af;
        }

        kbd {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 24px;
          padding: 0.25rem 0.5rem;
          background: #ffffff;
          border: 1px solid #d1d5db;
          border-radius: 4px;
          font-family: ui-monospace, monospace;
          font-size: 0.75rem;
          font-weight: 500;
          color: #374151;
          box-shadow: 0 1px 0 rgba(0, 0, 0, 0.1);
        }

        .shortcuts-footer {
          padding: 1rem 1.5rem;
          border-top: 1px solid #e5e7eb;
          text-align: center;
        }

        .shortcuts-tip {
          font-size: 0.8125rem;
          color: #6b7280;
        }

        .shortcuts-tip kbd {
          margin: 0 0.125rem;
        }

        /* Dark mode */
        @media (prefers-color-scheme: dark) {
          .shortcuts-modal {
            background: #1f2937;
          }

          .shortcuts-header {
            border-color: #374151;
          }

          .shortcuts-header h2 {
            color: #f9fafb;
          }

          .shortcuts-close {
            color: #9ca3af;
          }

          .shortcuts-close:hover {
            background: #374151;
            color: #f9fafb;
          }

          .platform-btn {
            background: #374151;
            color: #9ca3af;
          }

          .platform-btn:hover:not(.active) {
            background: #4b5563;
          }

          .shortcuts-category h3 {
            color: #d1d5db;
          }

          .shortcut-item {
            background: #374151;
          }

          .shortcut-description {
            color: #d1d5db;
          }

          kbd {
            background: #1f2937;
            border-color: #4b5563;
            color: #d1d5db;
          }

          .shortcuts-footer {
            border-color: #374151;
          }

          .shortcuts-tip {
            color: #9ca3af;
          }
        }

        /* Mobile */
        @media (max-width: 640px) {
          .shortcuts-modal {
            width: 95%;
            max-height: 90vh;
          }

          .shortcuts-header {
            padding: 0.75rem 1rem;
          }

          .shortcuts-content {
            padding: 0.75rem 1rem;
          }

          .shortcuts-grid {
            grid-template-columns: 1fr;
          }

          .shortcut-item {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.25rem;
          }

          .shortcut-keys {
            align-self: flex-end;
          }
        }
      `}</style>
    </>
  );
}

// ============================================================================
// HOOK: useKeyboardShortcuts
// ============================================================================

/**
 * Hook to open keyboard shortcuts help with Cmd/Ctrl + ?
 */
export function useKeyboardShortcutsHelp(): {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
} {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + ? to toggle
      if ((e.metaKey || e.ctrlKey) && e.key === '?') {
        e.preventDefault();
        toggle();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggle]);

  return { isOpen, open, close, toggle };
}

export default KeyboardShortcutsHelp;
