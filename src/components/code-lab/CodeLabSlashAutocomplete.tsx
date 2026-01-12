'use client';

/**
 * CODE LAB SLASH COMMAND AUTOCOMPLETE
 *
 * Inline autocomplete that appears when user types "/"
 * Features:
 * - Real-time filtering as user types
 * - Keyboard navigation
 * - Command preview with description
 * - Smart positioning near cursor
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getAllCommands } from '@/lib/workspace/slash-commands';

interface CodeLabSlashAutocompleteProps {
  inputValue: string;
  cursorPosition: number; // Reserved for future cursor-aware positioning
  onSelect: (command: string) => void;
  onClose: () => void;
  inputElement: HTMLTextAreaElement | null;
}

export function CodeLabSlashAutocomplete({
  inputValue,
  cursorPosition: _cursorPosition,
  onSelect,
  onClose,
  inputElement,
}: CodeLabSlashAutocompleteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const listRef = useRef<HTMLDivElement>(null);

  // Get all available commands
  const allCommands = getAllCommands();

  // Check if we should show autocomplete
  const shouldShow = inputValue.startsWith('/') && inputValue.length > 0;
  const query = shouldShow ? inputValue.slice(1).toLowerCase() : '';

  // Filter commands based on query
  const filteredCommands = allCommands.filter(
    (cmd) =>
      cmd.name.toLowerCase().startsWith(query) ||
      cmd.aliases.some((a) => a.toLowerCase().startsWith(query)) ||
      cmd.description.toLowerCase().includes(query)
  );

  // Calculate position relative to input
  useEffect(() => {
    if (!shouldShow || !inputElement) {
      setIsVisible(false);
      return;
    }

    // Position above the input
    const rect = inputElement.getBoundingClientRect();
    setPosition({
      top: rect.top - 8, // 8px gap
      left: rect.left,
    });
    setIsVisible(true);
    setSelectedIndex(0);
  }, [shouldShow, inputElement, inputValue]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isVisible || filteredCommands.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          e.stopPropagation();
          setSelectedIndex((i) => Math.min(i + 1, filteredCommands.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          e.stopPropagation();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case 'Tab':
        case 'Enter':
          if (filteredCommands[selectedIndex]) {
            e.preventDefault();
            e.stopPropagation();
            onSelect(`/${filteredCommands[selectedIndex].name} `);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [isVisible, filteredCommands, selectedIndex, onSelect, onClose]
  );

  // Attach keyboard listener
  useEffect(() => {
    if (isVisible) {
      window.addEventListener('keydown', handleKeyDown, true);
      return () => window.removeEventListener('keydown', handleKeyDown, true);
    }
  }, [isVisible, handleKeyDown]);

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const selectedItem = list.querySelector(`[data-index="${selectedIndex}"]`);
    if (selectedItem) {
      selectedItem.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!isVisible || filteredCommands.length === 0) {
    return null;
  }

  return (
    <div
      className="slash-autocomplete"
      style={{
        position: 'fixed',
        bottom: `calc(100vh - ${position.top}px)`,
        left: position.left,
      }}
    >
      <div className="autocomplete-header">
        <span className="autocomplete-title">Commands</span>
        <span className="autocomplete-hint">Tab to select</span>
      </div>

      <div className="autocomplete-list" ref={listRef}>
        {filteredCommands.map((cmd, index) => (
          <button
            key={cmd.name}
            data-index={index}
            className={`autocomplete-item ${index === selectedIndex ? 'selected' : ''}`}
            onClick={() => {
              onSelect(`/${cmd.name} `);
            }}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <div className="item-main">
              <span className="item-name">/{cmd.name}</span>
              <span className="item-aliases">
                {cmd.aliases.length > 0 && `(${cmd.aliases.map((a) => '/' + a).join(', ')})`}
              </span>
            </div>
            <span className="item-desc">{cmd.description}</span>
          </button>
        ))}
      </div>

      <style jsx>{`
        .slash-autocomplete {
          width: 320px;
          max-height: 280px;
          background: white;
          border-radius: 10px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
          border: 1px solid #e5e7eb;
          overflow: hidden;
          z-index: 100;
          animation: slideUp 0.15s ease;
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .autocomplete-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.5rem 0.75rem;
          background: #f9fafb;
          border-bottom: 1px solid #e5e7eb;
        }

        .autocomplete-title {
          font-size: 0.6875rem;
          font-weight: 600;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .autocomplete-hint {
          font-size: 0.6875rem;
          color: #9ca3af;
        }

        .autocomplete-list {
          max-height: 220px;
          overflow-y: auto;
          padding: 0.375rem;
        }

        .autocomplete-item {
          display: block;
          width: 100%;
          padding: 0.5rem 0.625rem;
          border: none;
          background: transparent;
          border-radius: 6px;
          cursor: pointer;
          text-align: left;
          transition: background 0.1s;
        }

        .autocomplete-item:hover,
        .autocomplete-item.selected {
          background: #f3f4f6;
        }

        .autocomplete-item.selected {
          background: #e0e7ff;
        }

        .item-main {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.125rem;
        }

        .item-name {
          font-family: 'SF Mono', 'Menlo', monospace;
          font-size: 0.8125rem;
          font-weight: 600;
          color: #1e3a5f;
        }

        .item-aliases {
          font-size: 0.6875rem;
          color: #9ca3af;
        }

        .item-desc {
          display: block;
          font-size: 0.75rem;
          color: #6b7280;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      `}</style>
    </div>
  );
}
