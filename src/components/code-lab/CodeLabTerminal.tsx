'use client';

/**
 * CODE LAB TERMINAL (v2.0)
 *
 * Production-grade persistent terminal with full shell emulation.
 * Sub-components and utilities are extracted into separate files:
 *
 *   terminalAnsiParser.ts      - ANSI parsing, shared types (TerminalLine, TerminalTab)
 *   TerminalLineRenderer.tsx   - Single line renderer with search highlighting
 *   TerminalTabBar.tsx         - Multi-tab bar component
 *   TerminalSearchBar.tsx      - Search bar with prev/next navigation
 *   useTerminalState.ts        - Standalone hook & createTerminalLine helper
 */

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  forwardRef,
  useImperativeHandle,
} from 'react';
import './code-lab-terminal.css';

// Extracted modules
import { stripANSI, generateLineId } from './terminalAnsiParser';
import type { TerminalLine, TerminalTab } from './terminalAnsiParser';
import { TerminalLineRenderer } from './TerminalLineRenderer';
import { TerminalTabBar } from './TerminalTabBar';
import { TerminalSearchBar } from './TerminalSearchBar';

// Re-export shared types so existing consumers continue to work
export type { TerminalLine } from './terminalAnsiParser';

// Re-export helper hook & utility from their dedicated file
export { createTerminalLine, useTerminalState } from './useTerminalState';

// ============================================================================
// TYPES
// ============================================================================

export interface CodeLabTerminalRef {
  addLine: (type: TerminalLine['type'], content: string) => void;
  addCommand: (command: string) => void;
  addOutput: (output: string, isError?: boolean) => void;
  addInfo: (info: string) => void;
  addSuccess: (message: string) => void;
  addError: (error: string) => void;
  clear: () => void;
  setRunning: (running: boolean) => void;
  streamOutput: (content: string) => void;
  finishStream: () => void;
}

export interface CodeLabTerminalProps {
  onCommand?: (command: string, tabId: string) => Promise<void>;
  onKill?: () => void;
  initialCwd?: string;
  maxHistoryLines?: number;
  className?: string;
  height?: number | string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const CodeLabTerminal = forwardRef<CodeLabTerminalRef, CodeLabTerminalProps>(
  function CodeLabTerminal(
    {
      onCommand,
      onKill,
      initialCwd = '/workspace',
      maxHistoryLines = 10000,
      className = '',
      height = 300,
    },
    ref
  ) {
    // State
    const [tabs, setTabs] = useState<TerminalTab[]>(() => [
      {
        id: 'main',
        name: 'bash',
        cwd: initialCwd,
        lines: [],
        commandHistory: [],
        historyIndex: -1,
        isRunning: false,
      },
    ]);
    const [activeTabId, setActiveTabId] = useState('main');
    const [currentInput, setCurrentInput] = useState('');
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
    const [showTimestamps, setShowTimestamps] = useState(false);
    const [autoScroll, setAutoScroll] = useState(true);
    const [copied, setCopied] = useState(false);

    // Refs
    const outputRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Active tab
    const activeTab = useMemo(
      () => tabs.find((t) => t.id === activeTabId) || tabs[0],
      [tabs, activeTabId]
    );

    // Search results
    const searchResults = useMemo(() => {
      if (!searchQuery) return [];
      const strippedQuery = searchQuery.toLowerCase();
      return activeTab.lines
        .map((line, index) => ({ line, index }))
        .filter(({ line }) => stripANSI(line.content).toLowerCase().includes(strippedQuery));
    }, [activeTab.lines, searchQuery]);

    // Auto-scroll
    useEffect(() => {
      if (autoScroll && outputRef.current) {
        outputRef.current.scrollTop = outputRef.current.scrollHeight;
      }
    }, [activeTab.lines, autoScroll]);

    // Focus input on tab change
    useEffect(() => {
      inputRef.current?.focus();
    }, [activeTabId]);

    // ==================== IMPERATIVE HANDLE ====================
    const addLine = useCallback(
      (type: TerminalLine['type'], content: string) => {
        setTabs((prev) =>
          prev.map((tab) =>
            tab.id === activeTabId
              ? {
                  ...tab,
                  lines: [
                    ...tab.lines.slice(-maxHistoryLines + 1),
                    {
                      id: generateLineId(),
                      type,
                      content,
                      timestamp: new Date(),
                    },
                  ],
                }
              : tab
          )
        );
      },
      [activeTabId, maxHistoryLines]
    );

    const streamOutput = useCallback(
      (content: string) => {
        setTabs((prev) =>
          prev.map((tab) => {
            if (tab.id !== activeTabId) return tab;
            const lastLine = tab.lines[tab.lines.length - 1];
            if (lastLine?.isStreaming) {
              return {
                ...tab,
                lines: tab.lines.map((line, i) =>
                  i === tab.lines.length - 1 ? { ...line, content: line.content + content } : line
                ),
              };
            }
            return {
              ...tab,
              lines: [
                ...tab.lines,
                {
                  id: generateLineId(),
                  type: 'stdout',
                  content,
                  timestamp: new Date(),
                  isStreaming: true,
                },
              ],
            };
          })
        );
      },
      [activeTabId]
    );

    const finishStream = useCallback(() => {
      setTabs((prev) =>
        prev.map((tab) =>
          tab.id === activeTabId
            ? {
                ...tab,
                lines: tab.lines.map((line) =>
                  line.isStreaming ? { ...line, isStreaming: false } : line
                ),
              }
            : tab
        )
      );
    }, [activeTabId]);

    const clear = useCallback(() => {
      setTabs((prev) => prev.map((tab) => (tab.id === activeTabId ? { ...tab, lines: [] } : tab)));
    }, [activeTabId]);

    const setRunning = useCallback(
      (running: boolean) => {
        setTabs((prev) =>
          prev.map((tab) => (tab.id === activeTabId ? { ...tab, isRunning: running } : tab))
        );
      },
      [activeTabId]
    );

    useImperativeHandle(
      ref,
      () => ({
        addLine,
        addCommand: (command: string) => addLine('command', command),
        addOutput: (output: string, isError = false) =>
          addLine(isError ? 'stderr' : 'stdout', output),
        addInfo: (info: string) => addLine('info', info),
        addSuccess: (message: string) => addLine('success', message),
        addError: (error: string) => addLine('error', error),
        clear,
        setRunning,
        streamOutput,
        finishStream,
      }),
      [addLine, clear, setRunning, streamOutput, finishStream]
    );

    // ==================== HANDLERS ====================
    const handleCommand = useCallback(
      async (command: string) => {
        if (!command.trim()) return;
        const trimmed = command.trim();

        // Add to command history
        setTabs((prev) =>
          prev.map((tab) =>
            tab.id === activeTabId
              ? {
                  ...tab,
                  commandHistory: [...tab.commandHistory.filter((c) => c !== trimmed), trimmed],
                  historyIndex: -1,
                }
              : tab
          )
        );

        // Display command
        addLine('command', trimmed);

        // Built-in: clear
        if (trimmed === 'clear' || trimmed === 'cls') {
          clear();
          setCurrentInput('');
          return;
        }

        // Built-in: cd
        if (trimmed.startsWith('cd ')) {
          const target = trimmed.slice(3).trim();
          const newCwd = target.startsWith('/')
            ? target
            : `${activeTab.cwd}/${target}`.replace(/\/+/g, '/');
          setTabs((prev) =>
            prev.map((tab) => (tab.id === activeTabId ? { ...tab, cwd: newCwd } : tab))
          );
          addLine('system', `Changed directory to ${newCwd}`);
          setCurrentInput('');
          return;
        }

        // Execute via callback
        if (onCommand) {
          setRunning(true);
          try {
            await onCommand(trimmed, activeTabId);
          } catch (err) {
            addLine('error', err instanceof Error ? err.message : 'Command failed');
          } finally {
            setRunning(false);
            finishStream();
          }
        } else {
          addLine('system', '[Command execution placeholder - connect onCommand prop]');
        }

        setCurrentInput('');
      },
      [activeTabId, activeTab.cwd, addLine, clear, setRunning, finishStream, onCommand]
    );

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>) => {
        const { commandHistory, historyIndex } = activeTab;

        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleCommand(currentInput);
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          const newIndex = historyIndex + 1;
          if (newIndex < commandHistory.length) {
            setTabs((prev) =>
              prev.map((tab) => (tab.id === activeTabId ? { ...tab, historyIndex: newIndex } : tab))
            );
            setCurrentInput(commandHistory[commandHistory.length - 1 - newIndex] || '');
          }
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          const newIndex = historyIndex - 1;
          if (newIndex >= -1) {
            setTabs((prev) =>
              prev.map((tab) => (tab.id === activeTabId ? { ...tab, historyIndex: newIndex } : tab))
            );
            setCurrentInput(
              newIndex === -1 ? '' : commandHistory[commandHistory.length - 1 - newIndex] || ''
            );
          }
        } else if (e.key === 'c' && e.ctrlKey) {
          if (activeTab.isRunning && onKill) {
            onKill();
            addLine('system', '^C');
            setRunning(false);
          }
          setCurrentInput('');
        } else if (e.key === 'l' && e.ctrlKey) {
          e.preventDefault();
          clear();
        } else if (e.key === 'f' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          setIsSearchOpen((prev) => !prev);
        }
      },
      [activeTab, activeTabId, currentInput, handleCommand, addLine, clear, setRunning, onKill]
    );

    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      setAutoScroll(el.scrollHeight - el.scrollTop - el.clientHeight < 50);
    }, []);

    const handleNewTab = useCallback(() => {
      const id = `tab-${Date.now()}`;
      const num = tabs.length + 1;
      setTabs((prev) => [
        ...prev,
        {
          id,
          name: `bash ${num}`,
          cwd: initialCwd,
          lines: [],
          commandHistory: [],
          historyIndex: -1,
          isRunning: false,
        },
      ]);
      setActiveTabId(id);
    }, [tabs.length, initialCwd]);

    const handleCloseTab = useCallback(
      (id: string) => {
        setTabs((prev) => {
          const filtered = prev.filter((t) => t.id !== id);
          if (activeTabId === id && filtered.length > 0) {
            setActiveTabId(filtered[0].id);
          }
          return filtered;
        });
      },
      [activeTabId]
    );

    const handleCopy = useCallback(async () => {
      const text = activeTab.lines
        .map((l) => {
          const content = stripANSI(l.content);
          return l.type === 'command' ? `$ ${content}` : content;
        })
        .join('\n');
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        /* ignore */
      }
    }, [activeTab.lines]);

    const handleSearchNext = useCallback(() => {
      if (searchResults.length > 0) {
        setCurrentSearchIndex((prev) => (prev + 1) % searchResults.length);
      }
    }, [searchResults.length]);

    const handleSearchPrev = useCallback(() => {
      if (searchResults.length > 0) {
        setCurrentSearchIndex((prev) => (prev === 0 ? searchResults.length - 1 : prev - 1));
      }
    }, [searchResults.length]);

    // Scroll to current search match
    useEffect(() => {
      if (searchResults.length > 0 && outputRef.current) {
        const matchIndex = searchResults[currentSearchIndex]?.index;
        const lineEl = outputRef.current.querySelector(`[data-line-index="${matchIndex}"]`);
        lineEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, [currentSearchIndex, searchResults]);

    return (
      <div className={`terminal-container ${className}`} style={{ height }}>
        <TerminalTabBar
          tabs={tabs}
          activeTabId={activeTabId}
          onTabSelect={setActiveTabId}
          onTabClose={handleCloseTab}
          onNewTab={handleNewTab}
        />

        <div className="terminal-header">
          <div className="terminal-title">
            <div className="terminal-dots">
              <span className="red" />
              <span className="yellow" />
              <span className="green" />
            </div>
            <span className="terminal-label">Terminal</span>
            {activeTab.isRunning && (
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '11px',
                  color: 'var(--cl-terminal-prompt)',
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    background: 'var(--cl-terminal-prompt)',
                    borderRadius: '50%',
                    animation: 'pulse 1.5s infinite',
                  }}
                />
                Running
              </span>
            )}
          </div>
          <div className="terminal-actions">
            {activeTab.isRunning && onKill && (
              <button className="terminal-btn kill" onClick={onKill} title="Kill process (Ctrl+C)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="4" y="4" width="16" height="16" rx="2" />
                </svg>
                Stop
              </button>
            )}
            <button
              className={`terminal-btn ${isSearchOpen ? 'active' : ''}`}
              onClick={() => setIsSearchOpen((p) => !p)}
              title="Search (Ctrl+F)"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
            </button>
            <button
              className={`terminal-btn ${showTimestamps ? 'active' : ''}`}
              onClick={() => setShowTimestamps((p) => !p)}
              title="Toggle timestamps"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
            </button>
            <button className="terminal-btn" onClick={handleCopy} title="Copy output">
              {copied ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
              )}
            </button>
            <button className="terminal-btn" onClick={clear} title="Clear (Ctrl+L)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              </svg>
            </button>
          </div>
        </div>

        {isSearchOpen && (
          <TerminalSearchBar
            query={searchQuery}
            onQueryChange={setSearchQuery}
            resultCount={searchResults.length}
            currentIndex={currentSearchIndex}
            onNext={handleSearchNext}
            onPrev={handleSearchPrev}
            onClose={() => {
              setIsSearchOpen(false);
              setSearchQuery('');
            }}
          />
        )}

        <div
          ref={outputRef}
          className="terminal-output"
          onScroll={handleScroll}
          onClick={() => inputRef.current?.focus()}
          role="log"
          aria-live="polite"
          aria-label="Terminal output"
        >
          {activeTab.lines.length === 0 ? (
            <div className="terminal-empty">
              <span style={{ color: 'var(--cl-terminal-prompt)' }}>&#10095;</span>
              <span style={{ animation: 'blink 1s step-start infinite' }}>&#9611;</span>
            </div>
          ) : (
            activeTab.lines.map((line, index) => {
              const matchIdx = searchResults.findIndex((r) => r.index === index);
              const isMatch = matchIdx !== -1;
              const isCurrent = matchIdx === currentSearchIndex;

              return (
                <div key={line.id} data-line-index={index}>
                  <TerminalLineRenderer
                    line={line}
                    showTimestamp={showTimestamps}
                    searchHighlight={searchQuery}
                    isSearchMatch={isMatch}
                    isCurrentMatch={isCurrent}
                  />
                </div>
              );
            })
          )}
        </div>

        {!autoScroll && activeTab.lines.length > 0 && (
          <button
            className="scroll-indicator"
            onClick={() => {
              setAutoScroll(true);
              if (outputRef.current) {
                outputRef.current.scrollTop = outputRef.current.scrollHeight;
              }
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12">
              <path d="M6 9L2 5h8z" fill="currentColor" />
            </svg>
            Scroll to bottom
          </button>
        )}

        <div className="terminal-input-area">
          <span className="input-cwd" title={activeTab.cwd}>
            {activeTab.cwd}
          </span>
          <span className="input-prompt">&#10095;</span>
          <input
            ref={inputRef}
            type="text"
            className="input-field"
            value={currentInput}
            onChange={(e) => setCurrentInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter command..."
            aria-label="Terminal input"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      </div>
    );
  }
);

export default CodeLabTerminal;
