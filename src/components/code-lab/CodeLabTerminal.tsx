'use client';

/**
 * CODE LAB TERMINAL
 *
 * A terminal panel that displays real-time shell output.
 * Features:
 * - Real-time streaming output
 * - Command history
 * - Copy output
 * - Clear terminal
 * - Color-coded output (stdout/stderr)
 */

import { useState, useEffect, useRef, useCallback } from 'react';

export interface TerminalLine {
  id: string;
  type: 'command' | 'stdout' | 'stderr' | 'info' | 'success' | 'error';
  content: string;
  timestamp: Date;
}

interface CodeLabTerminalProps {
  lines: TerminalLine[];
  isRunning?: boolean;
  onClear?: () => void;
  onKill?: () => void;
  workspaceId?: string;
  className?: string;
}

export function CodeLabTerminal({
  lines,
  isRunning = false,
  onClear,
  onKill,
  className = '',
}: CodeLabTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);

  // Auto-scroll to bottom when new lines arrive
  useEffect(() => {
    if (autoScroll && terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [lines, autoScroll]);

  // Detect manual scroll
  const handleScroll = useCallback(() => {
    if (!terminalRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = terminalRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setAutoScroll(isAtBottom);
  }, []);

  // Copy all output
  const handleCopy = async () => {
    const text = lines.map(l => {
      if (l.type === 'command') return `$ ${l.content}`;
      return l.content;
    }).join('\n');

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Get line class
  const getLineClass = (type: TerminalLine['type']) => {
    switch (type) {
      case 'command': return 'line-command';
      case 'stdout': return 'line-stdout';
      case 'stderr': return 'line-stderr';
      case 'info': return 'line-info';
      case 'success': return 'line-success';
      case 'error': return 'line-error';
      default: return '';
    }
  };

  return (
    <div className={`terminal-panel ${className}`}>
      {/* Header */}
      <div className="terminal-header">
        <div className="terminal-title">
          <div className="terminal-dots">
            <span className="dot red" />
            <span className="dot yellow" />
            <span className="dot green" />
          </div>
          <span className="title-text">Terminal</span>
          {isRunning && (
            <span className="running-indicator">
              <span className="pulse" />
              Running
            </span>
          )}
        </div>
        <div className="terminal-actions">
          {isRunning && onKill && (
            <button
              className="terminal-btn kill"
              onClick={onKill}
              title="Kill process"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
              </svg>
              Stop
            </button>
          )}
          <button
            className="terminal-btn"
            onClick={handleCopy}
            title="Copy output"
          >
            {copied ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </button>
          {onClear && (
            <button
              className="terminal-btn"
              onClick={onClear}
              title="Clear terminal"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Terminal Output */}
      <div
        ref={terminalRef}
        className="terminal-output"
        onScroll={handleScroll}
      >
        {lines.length === 0 ? (
          <div className="terminal-empty">
            <span className="prompt">$</span>
            <span className="cursor" />
          </div>
        ) : (
          lines.map((line) => (
            <div key={line.id} className={`terminal-line ${getLineClass(line.type)}`}>
              {line.type === 'command' && <span className="prompt">$</span>}
              <span className="content">{line.content}</span>
            </div>
          ))
        )}
        {isRunning && (
          <div className="terminal-line running">
            <span className="cursor" />
          </div>
        )}
      </div>

      {/* Scroll indicator */}
      {!autoScroll && lines.length > 0 && (
        <button
          className="scroll-to-bottom"
          onClick={() => {
            setAutoScroll(true);
            if (terminalRef.current) {
              terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
            }
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
          Scroll to bottom
        </button>
      )}

      <style jsx>{`
        .terminal-panel {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #0d1117;
          border-radius: 8px;
          overflow: hidden;
          font-family: 'SF Mono', 'Menlo', 'Monaco', 'Consolas', monospace;
        }

        .terminal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.5rem 0.75rem;
          background: #161b22;
          border-bottom: 1px solid #30363d;
        }

        .terminal-title {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .terminal-dots {
          display: flex;
          gap: 6px;
        }

        .dot {
          width: 12px;
          height: 12px;
          border-radius: 50%;
        }

        .dot.red { background: #ff5f56; }
        .dot.yellow { background: #ffbd2e; }
        .dot.green { background: #27c93f; }

        .title-text {
          font-size: 0.8125rem;
          color: #8b949e;
          font-weight: 500;
        }

        .running-indicator {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          font-size: 0.6875rem;
          color: #3fb950;
          padding: 0.125rem 0.5rem;
          background: rgba(63, 185, 80, 0.1);
          border-radius: 9999px;
        }

        .pulse {
          width: 6px;
          height: 6px;
          background: #3fb950;
          border-radius: 50%;
          animation: pulse 2s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }

        .terminal-actions {
          display: flex;
          gap: 0.375rem;
        }

        .terminal-btn {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.25rem 0.5rem;
          background: transparent;
          border: 1px solid #30363d;
          border-radius: 4px;
          color: #8b949e;
          font-size: 0.6875rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .terminal-btn:hover {
          background: #21262d;
          border-color: #8b949e;
          color: #c9d1d9;
        }

        .terminal-btn.kill {
          color: #f85149;
          border-color: #f85149;
        }

        .terminal-btn.kill:hover {
          background: rgba(248, 81, 73, 0.1);
        }

        .terminal-btn svg {
          width: 14px;
          height: 14px;
        }

        .terminal-output {
          flex: 1;
          padding: 0.75rem;
          overflow-y: auto;
          font-size: 0.8125rem;
          line-height: 1.6;
        }

        .terminal-output::-webkit-scrollbar {
          width: 8px;
        }

        .terminal-output::-webkit-scrollbar-track {
          background: #0d1117;
        }

        .terminal-output::-webkit-scrollbar-thumb {
          background: #30363d;
          border-radius: 4px;
        }

        .terminal-output::-webkit-scrollbar-thumb:hover {
          background: #484f58;
        }

        .terminal-empty {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: #8b949e;
        }

        .terminal-line {
          display: flex;
          gap: 0.5rem;
          white-space: pre-wrap;
          word-break: break-all;
        }

        .terminal-line + .terminal-line {
          margin-top: 0.125rem;
        }

        .prompt {
          color: #3fb950;
          flex-shrink: 0;
          font-weight: 600;
        }

        .content {
          color: #c9d1d9;
        }

        .line-command .content {
          color: #58a6ff;
          font-weight: 500;
        }

        .line-stdout .content {
          color: #c9d1d9;
        }

        .line-stderr .content {
          color: #f85149;
        }

        .line-info .content {
          color: #8b949e;
          font-style: italic;
        }

        .line-success .content {
          color: #3fb950;
        }

        .line-error .content {
          color: #f85149;
        }

        .cursor {
          display: inline-block;
          width: 8px;
          height: 1.2em;
          background: #c9d1d9;
          animation: blink 1s step-end infinite;
        }

        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }

        .scroll-to-bottom {
          position: absolute;
          bottom: 1rem;
          right: 1rem;
          display: flex;
          align-items: center;
          gap: 0.375rem;
          padding: 0.375rem 0.75rem;
          background: #21262d;
          border: 1px solid #30363d;
          border-radius: 9999px;
          color: #8b949e;
          font-size: 0.6875rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .scroll-to-bottom:hover {
          background: #30363d;
          color: #c9d1d9;
        }

        .scroll-to-bottom svg {
          width: 14px;
          height: 14px;
        }

        /* Mobile responsive */
        @media (max-width: 768px) {
          .terminal-header {
            padding: 0.375rem 0.5rem;
          }

          .terminal-dots {
            gap: 4px;
          }

          .dot {
            width: 10px;
            height: 10px;
          }

          .terminal-output {
            font-size: 0.75rem;
            padding: 0.5rem;
          }
        }
      `}</style>
    </div>
  );
}

// Helper to generate unique IDs
let lineIdCounter = 0;
export function createTerminalLine(
  type: TerminalLine['type'],
  content: string
): TerminalLine {
  return {
    id: `line-${++lineIdCounter}-${Date.now()}`,
    type,
    content,
    timestamp: new Date(),
  };
}

// Export a simple terminal context hook for state management
export function useTerminalState() {
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const addLine = useCallback((type: TerminalLine['type'], content: string) => {
    setLines(prev => [...prev, createTerminalLine(type, content)]);
  }, []);

  const addCommand = useCallback((command: string) => {
    addLine('command', command);
  }, [addLine]);

  const addOutput = useCallback((output: string, isError = false) => {
    addLine(isError ? 'stderr' : 'stdout', output);
  }, [addLine]);

  const addInfo = useCallback((info: string) => {
    addLine('info', info);
  }, [addLine]);

  const addSuccess = useCallback((message: string) => {
    addLine('success', message);
  }, [addLine]);

  const addError = useCallback((error: string) => {
    addLine('error', error);
  }, [addLine]);

  const clear = useCallback(() => {
    setLines([]);
  }, []);

  return {
    lines,
    isRunning,
    setIsRunning,
    addLine,
    addCommand,
    addOutput,
    addInfo,
    addSuccess,
    addError,
    clear,
  };
}
