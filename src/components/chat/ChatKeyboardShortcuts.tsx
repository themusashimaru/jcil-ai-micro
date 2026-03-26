'use client';

/**
 * CHAT KEYBOARD SHORTCUTS MODAL
 * Shows all available keyboard shortcuts for the chat interface.
 */

import { useEffect, useRef } from 'react';

interface ChatKeyboardShortcutsProps {
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

export function ChatKeyboardShortcuts({ isOpen, onClose }: ChatKeyboardShortcutsProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  const isMac =
    typeof window !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const cmdKey = isMac ? '⌘' : 'Ctrl';

  const categories: ShortcutCategory[] = [
    {
      title: 'Chat',
      shortcuts: [
        { keys: ['Enter'], description: 'Send message' },
        { keys: ['Shift', 'Enter'], description: 'New line' },
        { keys: [cmdKey, 'N'], description: 'New conversation' },
        { keys: ['Escape'], description: 'Stop streaming' },
      ],
    },
    {
      title: 'Navigation',
      shortcuts: [
        { keys: [cmdKey, '/'], description: 'Show keyboard shortcuts' },
        { keys: [cmdKey, 'Shift', 'S'], description: 'Toggle sidebar' },
        { keys: [cmdKey, 'K'], description: 'Search conversations' },
      ],
    },
    {
      title: 'Code Blocks',
      shortcuts: [
        { keys: ['Click', 'Copy'], description: 'Copy code to clipboard' },
        { keys: ['Click', 'Download'], description: 'Download as file' },
        { keys: ['Click', 'Test'], description: 'Run code in sandbox' },
        { keys: ['Click', 'Panel'], description: 'Open in artifact panel' },
      ],
    },
  ];

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Focus trap
  useEffect(() => {
    if (isOpen && panelRef.current) {
      panelRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
    >
      <div
        ref={panelRef}
        className="w-full max-w-lg mx-4 rounded-2xl border border-white/10 bg-gray-900/95 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Keyboard Shortcuts</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Categories */}
        <div className="space-y-6">
          {categories.map((category) => (
            <div key={category.title}>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/40">
                {category.title}
              </h3>
              <div className="space-y-2">
                {category.shortcuts.map((shortcut, i) => (
                  <div key={i} className="flex items-center justify-between py-1">
                    <span className="text-sm text-white/70">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, j) => (
                        <span key={j}>
                          {j > 0 && <span className="mx-0.5 text-white/20">+</span>}
                          <kbd className="inline-flex min-w-[28px] items-center justify-center rounded-md border border-white/20 bg-white/5 px-2 py-0.5 text-xs font-medium text-white/60">
                            {key}
                          </kbd>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-6 border-t border-white/10 pt-4 text-center text-xs text-white/30">
          Press{' '}
          <kbd className="rounded border border-white/20 bg-white/5 px-1.5 py-0.5 text-white/50">
            Esc
          </kbd>{' '}
          to close
        </div>
      </div>
    </div>
  );
}
