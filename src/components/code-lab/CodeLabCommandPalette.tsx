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

interface Command {
  id: string;
  title: string;
  description?: string;
  icon: string;
  category: 'slash' | 'git' | 'file' | 'ai' | 'settings' | 'help';
  shortcut?: string;
  action: () => void;
}

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

  // Define all available commands
  const commands: Command[] = useMemo(() => [
    // Slash Commands
    {
      id: 'fix',
      title: '/fix',
      description: 'Fix errors and bugs in the codebase',
      icon: '🔧',
      category: 'slash',
      shortcut: '',
      action: () => onExecuteSlashCommand('/fix'),
    },
    {
      id: 'test',
      title: '/test',
      description: 'Run tests and fix failures',
      icon: '🧪',
      category: 'slash',
      action: () => onExecuteSlashCommand('/test'),
    },
    {
      id: 'build',
      title: '/build',
      description: 'Run build and resolve errors',
      icon: '🔨',
      category: 'slash',
      action: () => onExecuteSlashCommand('/build'),
    },
    {
      id: 'commit',
      title: '/commit',
      description: 'Stage changes and create commit',
      icon: '✅',
      category: 'slash',
      action: () => onExecuteSlashCommand('/commit'),
    },
    {
      id: 'push',
      title: '/push',
      description: 'Push commits to remote',
      icon: '🚀',
      category: 'slash',
      action: () => onExecuteSlashCommand('/push'),
    },
    {
      id: 'review',
      title: '/review',
      description: 'Code review and analysis',
      icon: '👀',
      category: 'slash',
      action: () => onExecuteSlashCommand('/review'),
    },
    {
      id: 'explain',
      title: '/explain',
      description: 'Explain code architecture',
      icon: '📖',
      category: 'slash',
      action: () => onExecuteSlashCommand('/explain'),
    },
    {
      id: 'refactor',
      title: '/refactor',
      description: 'Refactor code for quality',
      icon: '♻️',
      category: 'slash',
      action: () => onExecuteSlashCommand('/refactor'),
    },
    {
      id: 'install',
      title: '/install',
      description: 'Install packages/dependencies',
      icon: '📦',
      category: 'slash',
      action: () => onExecuteSlashCommand('/install'),
    },
    {
      id: 'workspace',
      title: '/workspace',
      description: 'Enable sandbox execution mode',
      icon: '>',
      category: 'slash',
      action: () => onExecuteSlashCommand('/workspace'),
    },

    // Git Commands
    {
      id: 'git-status',
      title: 'Git: Status',
      description: 'Show git status',
      icon: '📊',
      category: 'git',
      action: () => onSendMessage('Show me the git status'),
    },
    {
      id: 'git-diff',
      title: 'Git: Diff',
      description: 'Show all changes',
      icon: '📋',
      category: 'git',
      action: () => onSendMessage('Show me the git diff'),
    },
    {
      id: 'git-log',
      title: 'Git: Log',
      description: 'Show recent commits',
      icon: '📜',
      category: 'git',
      action: () => onSendMessage('Show me the recent git log'),
    },
    {
      id: 'git-branch',
      title: 'Git: Branches',
      description: 'List all branches',
      icon: '🌿',
      category: 'git',
      action: () => onSendMessage('List all git branches'),
    },

    // AI Actions
    {
      id: 'ai-improve',
      title: 'AI: Improve Code',
      description: 'Suggest improvements for current code',
      icon: '✨',
      category: 'ai',
      action: () => onSendMessage('Review my code and suggest improvements'),
    },
    {
      id: 'ai-document',
      title: 'AI: Add Documentation',
      description: 'Generate documentation for code',
      icon: '📝',
      category: 'ai',
      action: () => onSendMessage('Add documentation comments to the code'),
    },
    {
      id: 'ai-optimize',
      title: 'AI: Optimize Performance',
      description: 'Analyze and optimize performance',
      icon: '⚡',
      category: 'ai',
      action: () => onSendMessage('Analyze this code for performance issues and optimize it'),
    },
    {
      id: 'ai-security',
      title: 'AI: Security Audit',
      description: 'Check for security vulnerabilities',
      icon: '🔒',
      category: 'ai',
      action: () => onSendMessage('Perform a security audit on this codebase'),
    },
    {
      id: 'ai-types',
      title: 'AI: Add TypeScript Types',
      description: 'Add proper TypeScript types',
      icon: '📘',
      category: 'ai',
      action: () => onSendMessage('Add proper TypeScript types to this code'),
    },
    {
      id: 'ai-tests',
      title: 'AI: Generate Tests',
      description: 'Generate unit tests',
      icon: '🧪',
      category: 'ai',
      action: () => onSendMessage('Generate comprehensive unit tests for this code'),
    },

    // File Operations
    {
      id: 'file-new',
      title: 'File: New',
      description: 'Create a new file',
      icon: '📄',
      category: 'file',
      action: () => onSendMessage('Create a new file at'),
    },
    {
      id: 'file-search',
      title: 'File: Search',
      description: 'Search files by name',
      icon: '🔍',
      category: 'file',
      action: () => onSendMessage('Search for files matching'),
    },
    {
      id: 'file-tree',
      title: 'File: Show Tree',
      description: 'Display project structure',
      icon: '🌲',
      category: 'file',
      action: () => onSendMessage('Show me the project file structure'),
    },

    // Help
    {
      id: 'help-commands',
      title: 'Help: All Commands',
      description: 'Show all available commands',
      icon: '❓',
      category: 'help',
      shortcut: '⌘/',
      action: () => onExecuteSlashCommand('/help'),
    },
    {
      id: 'help-shortcuts',
      title: 'Help: Keyboard Shortcuts',
      description: 'Show keyboard shortcuts',
      icon: '⌨️',
      category: 'help',
      action: () => onSendMessage('What keyboard shortcuts are available?'),
    },
  ], [onExecuteSlashCommand, onSendMessage]);

  // Filter commands based on query
  const filteredCommands = useMemo(() => {
    if (!query.trim()) {
      return commands;
    }

    const lowerQuery = query.toLowerCase();
    return commands.filter(cmd =>
      cmd.title.toLowerCase().includes(lowerQuery) ||
      cmd.description?.toLowerCase().includes(lowerQuery) ||
      cmd.category.toLowerCase().includes(lowerQuery)
    ).sort((a, b) => {
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

  const categoryLabels: Record<string, string> = {
    slash: 'Slash Commands',
    git: 'Git',
    ai: 'AI Actions',
    file: 'Files',
    settings: 'Settings',
    help: 'Help',
  };

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, filteredCommands.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
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
  }, [filteredCommands, selectedIndex, onClose]);

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
      <div className="command-palette" onClick={e => e.stopPropagation()}>
        {/* Search Input */}
        <div className="palette-header">
          <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
          />
          <kbd className="palette-hint">ESC</kbd>
        </div>

        {/* Command List */}
        <div className="palette-list" ref={listRef}>
          {Object.entries(groupedCommands).map(([category, cmds]) => (
            <div key={category} className="command-group">
              <div className="group-label">{categoryLabels[category] || category}</div>
              {cmds.map((cmd) => {
                const index = currentIndex++;
                return (
                  <button
                    key={cmd.id}
                    data-index={index}
                    className={`command-item ${index === selectedIndex ? 'selected' : ''}`}
                    onClick={() => {
                      cmd.action();
                      onClose();
                    }}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <span className="command-icon">{cmd.icon}</span>
                    <div className="command-info">
                      <span className="command-title">{cmd.title}</span>
                      {cmd.description && (
                        <span className="command-desc">{cmd.description}</span>
                      )}
                    </div>
                    {cmd.shortcut && (
                      <kbd className="command-shortcut">{cmd.shortcut}</kbd>
                    )}
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

      <style jsx>{`
        .command-palette-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding-top: 15vh;
          z-index: 1000;
          animation: fadeIn 0.15s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .command-palette {
          width: 100%;
          max-width: 560px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          overflow: hidden;
          animation: slideDown 0.15s ease;
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .palette-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1rem;
          border-bottom: 1px solid #e5e7eb;
        }

        .search-icon {
          width: 20px;
          height: 20px;
          color: #9ca3af;
          flex-shrink: 0;
        }

        .palette-input {
          flex: 1;
          border: none;
          outline: none;
          font-size: 1rem;
          background: transparent;
          color: #1a1f36;
        }

        .palette-input::placeholder {
          color: #9ca3af;
        }

        .palette-hint {
          padding: 0.25rem 0.5rem;
          background: #f3f4f6;
          border-radius: 4px;
          font-size: 0.75rem;
          color: #6b7280;
          font-family: inherit;
        }

        .palette-list {
          max-height: 400px;
          overflow-y: auto;
          padding: 0.5rem;
        }

        .command-group {
          margin-bottom: 0.5rem;
        }

        .group-label {
          padding: 0.5rem 0.75rem;
          font-size: 0.6875rem;
          font-weight: 600;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .command-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          width: 100%;
          padding: 0.625rem 0.75rem;
          border: none;
          background: transparent;
          border-radius: 8px;
          cursor: pointer;
          text-align: left;
          transition: background 0.1s;
        }

        .command-item:hover,
        .command-item.selected {
          background: #f3f4f6;
        }

        .command-item.selected {
          background: #e0e7ff;
        }

        .command-icon {
          font-size: 1.25rem;
          flex-shrink: 0;
          width: 28px;
          text-align: center;
        }

        .command-info {
          flex: 1;
          min-width: 0;
        }

        .command-title {
          display: block;
          font-size: 0.875rem;
          font-weight: 500;
          color: #1a1f36;
        }

        .command-desc {
          display: block;
          font-size: 0.75rem;
          color: #6b7280;
          margin-top: 0.125rem;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .command-shortcut {
          padding: 0.25rem 0.5rem;
          background: #e5e7eb;
          border-radius: 4px;
          font-size: 0.6875rem;
          color: #4b5563;
          font-family: inherit;
        }

        .no-results {
          padding: 2rem;
          text-align: center;
          color: #6b7280;
        }

        .palette-footer {
          display: flex;
          gap: 1rem;
          padding: 0.75rem 1rem;
          border-top: 1px solid #e5e7eb;
          background: #f9fafb;
        }

        .footer-hint {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          font-size: 0.75rem;
          color: #6b7280;
        }

        .footer-hint kbd {
          padding: 0.125rem 0.375rem;
          background: #e5e7eb;
          border-radius: 3px;
          font-size: 0.6875rem;
          font-family: inherit;
        }

        @media (max-width: 640px) {
          .command-palette-overlay {
            padding: 1rem;
            padding-top: 5vh;
          }

          .command-palette {
            max-height: 80vh;
          }
        }
      `}</style>
    </div>
  );
}
