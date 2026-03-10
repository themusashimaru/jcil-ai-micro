'use client';

/**
 * CODE LAB COMMAND PALETTE
 *
 * VSCode-style Cmd+K command palette for quick actions.
 * Features:
 * - Fuzzy search across all commands
 * - Keyboard navigation
 * - Recent commands
 * - Slash command execution
 * - Quick file search
 * - Git operations
 * - AI actions
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useCommands, categoryLabels, Command } from './CommandPaletteCommands';
import { CommandPaletteStyles } from './CommandPaletteStyles';

interface CodeLabCommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onExecuteSlashCommand: (command: string) => void;
  onSendMessage: (message: string) => void;
}

export function CodeLabCommandPalette({
  isOpen,
  onClose,
  onExecuteSlashCommand,
  onSendMessage,
}: CodeLabCommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus trap for modal accessibility (WCAG 2.4.3)
  const { containerRef } = useFocusTrap<HTMLDivElement>({
    enabled: isOpen,
    onEscape: onClose,
    restoreFocus: true,
    initialFocus: '.palette-input',
  });

  // Define all available commands
  const commands: Command[] = useCommands(onExecuteSlashCommand, onSendMessage);

  // Filter commands based on query
  const filteredCommands = useMemo(() => {
    if (!query.trim()) {
      return commands;
    }

    const lowerQuery = query.toLowerCase();
    return commands
      .filter(
        (cmd) =>
          cmd.title.toLowerCase().includes(lowerQuery) ||
          cmd.description?.toLowerCase().includes(lowerQuery) ||
          cmd.category.toLowerCase().includes(lowerQuery)
      )
      .sort((a, b) => {
        // Prioritize exact matches
        const aExact = a.title.toLowerCase().startsWith(lowerQuery);
        const bExact = b.title.toLowerCase().startsWith(lowerQuery);
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        return 0;
      });
  }, [commands, query]);

  // Group commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, Command[]> = {};
    for (const cmd of filteredCommands) {
      if (!groups[cmd.category]) {
        groups[cmd.category] = [];
      }
      groups[cmd.category].push(cmd);
    }
    return groups;
  }, [filteredCommands]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, filteredCommands.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].action();
            onClose();
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [filteredCommands, selectedIndex, onClose]
  );

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const selectedItem = list.querySelector(`[data-index="${selectedIndex}"]`);
    if (selectedItem) {
      selectedItem.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  let currentIndex = 0;

  return (
    <div className="command-palette-overlay" onClick={onClose}>
      <div
        ref={containerRef}
        className="command-palette"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
      >
        {/* Search Input */}
        <div className="palette-header">
          <svg
            className="search-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command or search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="palette-input"
            aria-label="Search commands"
            aria-autocomplete="list"
            aria-controls="command-list"
            aria-activedescendant={filteredCommands[selectedIndex]?.id}
          />
          <kbd className="palette-hint">ESC</kbd>
        </div>

        {/* Command List */}
        <div
          id="command-list"
          className="palette-list"
          ref={listRef}
          role="listbox"
          aria-label="Available commands"
        >
          {Object.entries(groupedCommands).map(([category, cmds]) => (
            <div
              key={category}
              className="command-group"
              role="group"
              aria-labelledby={`group-${category}`}
            >
              <div id={`group-${category}`} className="group-label" role="presentation">
                {categoryLabels[category] || category}
              </div>
              {cmds.map((cmd) => {
                const index = currentIndex++;
                return (
                  <button
                    key={cmd.id}
                    id={cmd.id}
                    data-index={index}
                    className={`command-item ${index === selectedIndex ? 'selected' : ''}`}
                    role="option"
                    aria-selected={index === selectedIndex}
                    onClick={() => {
                      cmd.action();
                      onClose();
                    }}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <span className="command-icon">{cmd.icon}</span>
                    <div className="command-info">
                      <span className="command-title">{cmd.title}</span>
                      {cmd.description && <span className="command-desc">{cmd.description}</span>}
                    </div>
                    {cmd.shortcut && <kbd className="command-shortcut">{cmd.shortcut}</kbd>}
                  </button>
                );
              })}
            </div>
          ))}

          {filteredCommands.length === 0 && (
            <div className="no-results">
              <span>No commands found for &ldquo;{query}&rdquo;</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="palette-footer">
          <span className="footer-hint">
            <kbd>↑↓</kbd> navigate
          </span>
          <span className="footer-hint">
            <kbd>↵</kbd> select
          </span>
          <span className="footer-hint">
            <kbd>esc</kbd> close
          </span>
        </div>
      </div>

      <CommandPaletteStyles />
    </div>
  );
}
