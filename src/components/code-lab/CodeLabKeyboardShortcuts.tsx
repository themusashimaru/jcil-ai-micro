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
import './code-lab-keyboard-shortcuts.css';

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

    </div>
  );
}
