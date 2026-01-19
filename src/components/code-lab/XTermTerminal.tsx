'use client';

/**
 * XTERM TERMINAL COMPONENT
 *
 * Real PTY terminal using xterm.js for Claude Code parity.
 * Provides authentic terminal experience with:
 * - True terminal emulation (xterm.js)
 * - WebSocket-based PTY communication
 * - Resize handling with fit addon
 * - Clickable links with web-links addon
 * - Search functionality
 * - Clipboard support
 * - Customizable themes
 *
 * @version 1.0.0
 */

import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from 'react';

// Dynamic imports for xterm to avoid SSR issues
let Terminal: typeof import('@xterm/xterm').Terminal | undefined;
let FitAddon: typeof import('@xterm/addon-fit').FitAddon | undefined;
let WebLinksAddon: typeof import('@xterm/addon-web-links').WebLinksAddon | undefined;
let SearchAddon: typeof import('@xterm/addon-search').SearchAddon | undefined;

// ============================================================================
// TYPES
// ============================================================================

export interface XTermTheme {
  background: string;
  foreground: string;
  cursor: string;
  cursorAccent: string;
  selection: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
}

export interface XTermTerminalProps {
  sessionId: string;
  sandboxId?: string;
  onData?: (data: string) => void;
  onResize?: (cols: number, rows: number) => void;
  onTitle?: (title: string) => void;
  theme?: Partial<XTermTheme>;
  fontSize?: number;
  fontFamily?: string;
  className?: string;
  readOnly?: boolean;
}

export interface XTermTerminalRef {
  write: (data: string) => void;
  writeln: (data: string) => void;
  clear: () => void;
  reset: () => void;
  focus: () => void;
  blur: () => void;
  fit: () => void;
  search: (query: string) => boolean;
  searchNext: () => boolean;
  searchPrevious: () => boolean;
  scrollToBottom: () => void;
  getSelection: () => string;
  dispose: () => void;
}

// ============================================================================
// DEFAULT THEME (matches Claude Code dark theme)
// ============================================================================

const DEFAULT_THEME: XTermTheme = {
  background: '#0d1117',
  foreground: '#c9d1d9',
  cursor: '#58a6ff',
  cursorAccent: '#0d1117',
  selection: 'rgba(56, 139, 253, 0.3)',
  black: '#484f58',
  red: '#ff7b72',
  green: '#3fb950',
  yellow: '#d29922',
  blue: '#58a6ff',
  magenta: '#bc8cff',
  cyan: '#39c5cf',
  white: '#b1bac4',
  brightBlack: '#6e7681',
  brightRed: '#ffa198',
  brightGreen: '#56d364',
  brightYellow: '#e3b341',
  brightBlue: '#79c0ff',
  brightMagenta: '#d2a8ff',
  brightCyan: '#56d4dd',
  brightWhite: '#f0f6fc',
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const XTermTerminal = forwardRef<XTermTerminalRef, XTermTerminalProps>(
  function XTermTerminal(
    {
      sessionId,
      sandboxId,
      onData,
      onResize,
      onTitle,
      theme,
      fontSize = 14,
      fontFamily = "'SF Mono', 'Fira Code', 'JetBrains Mono', 'Menlo', monospace",
      className = '',
      readOnly = false,
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const terminalRef = useRef<InstanceType<typeof import('@xterm/xterm').Terminal> | null>(null);
    const fitAddonRef = useRef<InstanceType<typeof import('@xterm/addon-fit').FitAddon> | null>(
      null
    );
    const searchAddonRef = useRef<InstanceType<
      typeof import('@xterm/addon-search').SearchAddon
    > | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Load xterm modules dynamically
    useEffect(() => {
      const loadModules = async () => {
        try {
          const [xtermModule, fitModule, webLinksModule, searchModule] = await Promise.all([
            import('@xterm/xterm'),
            import('@xterm/addon-fit'),
            import('@xterm/addon-web-links'),
            import('@xterm/addon-search'),
          ]);

          Terminal = xtermModule.Terminal;
          FitAddon = fitModule.FitAddon;
          WebLinksAddon = webLinksModule.WebLinksAddon;
          SearchAddon = searchModule.SearchAddon;

          setIsLoading(false);
        } catch (err) {
          setError('Failed to load terminal modules');
          setIsLoading(false);
          console.error('Failed to load xterm modules:', err);
        }
      };

      loadModules();
    }, []);

    // Initialize terminal
    useEffect(() => {
      if (
        isLoading ||
        !containerRef.current ||
        !Terminal ||
        !FitAddon ||
        !WebLinksAddon ||
        !SearchAddon
      ) {
        return;
      }

      const mergedTheme = { ...DEFAULT_THEME, ...theme };

      // Create terminal instance
      const term = new Terminal({
        cursorBlink: true,
        cursorStyle: 'block',
        fontSize,
        fontFamily,
        theme: mergedTheme,
        allowProposedApi: true,
        convertEol: true,
        scrollback: 10000,
        disableStdin: readOnly,
      });

      // Create and load addons
      const fitAddon = new FitAddon();
      const webLinksAddon = new WebLinksAddon();
      const searchAddon = new SearchAddon();

      term.loadAddon(fitAddon);
      term.loadAddon(webLinksAddon);
      term.loadAddon(searchAddon);

      // Open terminal in container
      term.open(containerRef.current);

      // Initial fit
      setTimeout(() => {
        fitAddon.fit();
      }, 0);

      // Store refs
      terminalRef.current = term;
      fitAddonRef.current = fitAddon;
      searchAddonRef.current = searchAddon;

      // Handle data input
      if (!readOnly && onData) {
        term.onData((data) => {
          onData(data);
        });
      }

      // Handle resize
      term.onResize(({ cols, rows }) => {
        onResize?.(cols, rows);
      });

      // Handle title changes
      term.onTitleChange((title) => {
        onTitle?.(title);
      });

      // Write welcome message
      term.writeln('\x1b[1;34m╔══════════════════════════════════════════════════════════╗\x1b[0m');
      term.writeln(
        '\x1b[1;34m║\x1b[0m  \x1b[1;32mCode Lab Terminal\x1b[0m - Real PTY Experience                \x1b[1;34m║\x1b[0m'
      );
      term.writeln(
        '\x1b[1;34m║\x1b[0m  Type commands to execute in sandbox                      \x1b[1;34m║\x1b[0m'
      );
      term.writeln('\x1b[1;34m╚══════════════════════════════════════════════════════════╝\x1b[0m');
      term.writeln('');

      setIsReady(true);

      // Handle window resize
      const handleResize = () => {
        fitAddon.fit();
      };

      window.addEventListener('resize', handleResize);

      // Cleanup
      return () => {
        window.removeEventListener('resize', handleResize);
        if (wsRef.current) {
          wsRef.current.close();
        }
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        term.dispose();
      };
    }, [isLoading, fontSize, fontFamily, theme, readOnly, onData, onResize, onTitle]);

    // Connect to PTY WebSocket when ready
    useEffect(() => {
      if (!isReady || !sessionId) return;

      const connectWebSocket = () => {
        // Check if WebSocket endpoint exists
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = sandboxId
          ? `${protocol}//${window.location.host}/api/code-lab/pty?sessionId=${sessionId}&sandboxId=${sandboxId}`
          : null;

        // For now, we'll use HTTP-based execution as fallback
        // Real PTY requires WebSocket server support
        if (!wsUrl) {
          terminalRef.current?.writeln(
            '\x1b[33m[PTY Mode: Commands execute via sandbox API]\x1b[0m'
          );
          terminalRef.current?.write('\x1b[32m$ \x1b[0m');
          return;
        }

        try {
          const ws = new WebSocket(wsUrl);

          ws.onopen = () => {
            wsRef.current = ws;
            terminalRef.current?.writeln('\x1b[32m[Connected to PTY]\x1b[0m');
            terminalRef.current?.write('\x1b[32m$ \x1b[0m');
          };

          ws.onmessage = (event) => {
            terminalRef.current?.write(event.data);
          };

          ws.onerror = () => {
            terminalRef.current?.writeln(
              '\x1b[33m[PTY connection unavailable, using API mode]\x1b[0m'
            );
            terminalRef.current?.write('\x1b[32m$ \x1b[0m');
          };

          ws.onclose = () => {
            wsRef.current = null;
            // Attempt reconnect after 3 seconds
            reconnectTimeoutRef.current = setTimeout(() => {
              if (terminalRef.current) {
                connectWebSocket();
              }
            }, 3000);
          };
        } catch {
          // WebSocket not available, use API mode
          terminalRef.current?.writeln('\x1b[33m[Using API execution mode]\x1b[0m');
          terminalRef.current?.write('\x1b[32m$ \x1b[0m');
        }
      };

      connectWebSocket();
    }, [isReady, sessionId, sandboxId]);

    // Imperative handle
    useImperativeHandle(
      ref,
      () => ({
        write: (data: string) => {
          terminalRef.current?.write(data);
        },
        writeln: (data: string) => {
          terminalRef.current?.writeln(data);
        },
        clear: () => {
          terminalRef.current?.clear();
        },
        reset: () => {
          terminalRef.current?.reset();
        },
        focus: () => {
          terminalRef.current?.focus();
        },
        blur: () => {
          terminalRef.current?.blur();
        },
        fit: () => {
          fitAddonRef.current?.fit();
        },
        search: (query: string) => {
          return searchAddonRef.current?.findNext(query) ?? false;
        },
        searchNext: () => {
          return searchAddonRef.current?.findNext('') ?? false;
        },
        searchPrevious: () => {
          return searchAddonRef.current?.findPrevious('') ?? false;
        },
        scrollToBottom: () => {
          terminalRef.current?.scrollToBottom();
        },
        getSelection: () => {
          return terminalRef.current?.getSelection() ?? '';
        },
        dispose: () => {
          terminalRef.current?.dispose();
        },
      }),
      []
    );

    if (isLoading) {
      return (
        <div className={`xterm-container loading ${className}`}>
          <div className="loading-spinner">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="32">
                <animate
                  attributeName="stroke-dashoffset"
                  dur="1s"
                  repeatCount="indefinite"
                  values="32;0"
                />
              </circle>
            </svg>
            <span>Loading terminal...</span>
          </div>
          <style jsx>{`
            .xterm-container.loading {
              display: flex;
              align-items: center;
              justify-content: center;
              background: #0d1117;
              min-height: 200px;
              border-radius: 8px;
            }
            .loading-spinner {
              display: flex;
              align-items: center;
              gap: 12px;
              color: #58a6ff;
            }
            .loading-spinner svg {
              width: 24px;
              height: 24px;
              animation: spin 1s linear infinite;
            }
            @keyframes spin {
              from {
                transform: rotate(0deg);
              }
              to {
                transform: rotate(360deg);
              }
            }
          `}</style>
        </div>
      );
    }

    if (error) {
      return (
        <div className={`xterm-container error ${className}`}>
          <div className="error-message">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
            <span>{error}</span>
          </div>
          <style jsx>{`
            .xterm-container.error {
              display: flex;
              align-items: center;
              justify-content: center;
              background: #0d1117;
              min-height: 200px;
              border-radius: 8px;
            }
            .error-message {
              display: flex;
              align-items: center;
              gap: 12px;
              color: #f85149;
            }
            .error-message svg {
              width: 24px;
              height: 24px;
            }
          `}</style>
        </div>
      );
    }

    return (
      <>
        <div ref={containerRef} className={`xterm-container ${className}`} />
        <style jsx global>{`
          .xterm-container {
            width: 100%;
            height: 100%;
            min-height: 200px;
            background: #0d1117;
            border-radius: 8px;
            overflow: hidden;
          }

          .xterm-container .xterm {
            padding: 12px;
            height: 100%;
          }

          .xterm-container .xterm-viewport {
            background-color: transparent !important;
          }

          .xterm-container .xterm-screen {
            padding: 0;
          }

          /* xterm.js core styles */
          .xterm {
            cursor: text;
            position: relative;
            user-select: none;
            -ms-user-select: none;
            -webkit-user-select: none;
          }

          .xterm.focus,
          .xterm:focus {
            outline: none;
          }

          .xterm .xterm-helpers {
            position: absolute;
            top: 0;
            z-index: 5;
          }

          .xterm .xterm-helper-textarea {
            padding: 0;
            border: 0;
            margin: 0;
            position: absolute;
            opacity: 0;
            left: -9999em;
            top: 0;
            width: 0;
            height: 0;
            z-index: -5;
            white-space: nowrap;
            overflow: hidden;
            resize: none;
          }

          .xterm .composition-view {
            background: #000;
            color: #fff;
            display: none;
            position: absolute;
            white-space: nowrap;
            z-index: 1;
          }

          .xterm .composition-view.active {
            display: block;
          }

          .xterm .xterm-viewport {
            background-color: #000;
            overflow-y: scroll;
            cursor: default;
            position: absolute;
            right: 0;
            left: 0;
            top: 0;
            bottom: 0;
          }

          .xterm .xterm-screen {
            position: relative;
          }

          .xterm .xterm-screen canvas {
            position: absolute;
            left: 0;
            top: 0;
          }

          .xterm .xterm-scroll-area {
            visibility: hidden;
          }

          .xterm-char-measure-element {
            display: inline-block;
            visibility: hidden;
            position: absolute;
            top: 0;
            left: -9999em;
            line-height: normal;
          }

          .xterm.enable-mouse-events {
            cursor: default;
          }

          .xterm .xterm-cursor-pointer {
            cursor: pointer;
          }

          .xterm.column-select.focus {
            cursor: crosshair;
          }

          .xterm .xterm-accessibility,
          .xterm .xterm-message {
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            right: 0;
            z-index: 10;
            color: transparent;
            pointer-events: none;
          }

          .xterm .xterm-accessibility-tree:not(.debug) {
            position: absolute;
            left: 0;
            top: 0;
            width: 0;
            height: 0;
            z-index: -5;
            clip: rect(0, 0, 0, 0);
            clip-path: inset(50%);
            white-space: nowrap;
          }

          .xterm .live-region {
            position: absolute;
            left: -9999px;
            width: 1px;
            height: 1px;
            overflow: hidden;
          }

          .xterm-dim {
            opacity: 0.5;
          }

          .xterm-underline-1 {
            text-decoration: underline;
          }
          .xterm-underline-2 {
            text-decoration: double underline;
          }
          .xterm-underline-3 {
            text-decoration: wavy underline;
          }
          .xterm-underline-4 {
            text-decoration: dotted underline;
          }
          .xterm-underline-5 {
            text-decoration: dashed underline;
          }

          .xterm-overline {
            text-decoration: overline;
          }

          .xterm-overline.xterm-underline-1 {
            text-decoration: overline underline;
          }
          .xterm-overline.xterm-underline-2 {
            text-decoration: overline double underline;
          }
          .xterm-overline.xterm-underline-3 {
            text-decoration: overline wavy underline;
          }
          .xterm-overline.xterm-underline-4 {
            text-decoration: overline dotted underline;
          }
          .xterm-overline.xterm-underline-5 {
            text-decoration: overline dashed underline;
          }

          .xterm-strikethrough {
            text-decoration: line-through;
          }

          .xterm-screen .xterm-decoration-container .xterm-decoration {
            z-index: 6;
            position: absolute;
          }

          .xterm-screen .xterm-decoration-container .xterm-decoration.xterm-decoration-top-layer {
            z-index: 7;
          }

          .xterm-decoration-overview-ruler {
            z-index: 8;
            position: absolute;
            top: 0;
            right: 0;
            pointer-events: none;
          }

          .xterm-decoration-top {
            z-index: 2;
            position: relative;
          }
        `}</style>
      </>
    );
  }
);

// ============================================================================
// HELPER HOOKS
// ============================================================================

/**
 * Hook to manage xterm terminal state
 */
export function useXTermTerminal(sessionId: string, sandboxId?: string) {
  const terminalRef = useRef<XTermTerminalRef>(null);
  const [commandBuffer, setCommandBuffer] = useState('');

  // Execute command via API
  const executeCommand = useCallback(
    async (command: string) => {
      if (!command.trim()) return;

      // Echo command
      terminalRef.current?.writeln(`\x1b[32m$ \x1b[0m${command}`);

      try {
        const response = await fetch('/api/code-lab/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            sandboxId,
            command,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          terminalRef.current?.writeln(
            `\x1b[31mError: ${error.message || 'Command failed'}\x1b[0m`
          );
        } else {
          const result = await response.json();
          if (result.stdout) {
            terminalRef.current?.write(result.stdout);
          }
          if (result.stderr) {
            terminalRef.current?.write(`\x1b[31m${result.stderr}\x1b[0m`);
          }
        }
      } catch (err) {
        terminalRef.current?.writeln(
          `\x1b[31mError: ${err instanceof Error ? err.message : 'Unknown error'}\x1b[0m`
        );
      }

      // Show new prompt
      terminalRef.current?.write('\x1b[32m$ \x1b[0m');
    },
    [sessionId, sandboxId]
  );

  // Handle data input
  const handleData = useCallback(
    (data: string) => {
      // Handle Enter key
      if (data === '\r') {
        executeCommand(commandBuffer);
        setCommandBuffer('');
        return;
      }

      // Handle backspace
      if (data === '\x7f') {
        if (commandBuffer.length > 0) {
          setCommandBuffer((prev) => prev.slice(0, -1));
          terminalRef.current?.write('\b \b');
        }
        return;
      }

      // Handle Ctrl+C
      if (data === '\x03') {
        setCommandBuffer('');
        terminalRef.current?.writeln('^C');
        terminalRef.current?.write('\x1b[32m$ \x1b[0m');
        return;
      }

      // Handle Ctrl+L (clear)
      if (data === '\x0c') {
        terminalRef.current?.clear();
        terminalRef.current?.write('\x1b[32m$ \x1b[0m');
        return;
      }

      // Echo printable characters
      if (data >= ' ' || data === '\t') {
        setCommandBuffer((prev) => prev + data);
        terminalRef.current?.write(data);
      }
    },
    [commandBuffer, executeCommand]
  );

  return {
    terminalRef,
    handleData,
    executeCommand,
  };
}

export default XTermTerminal;
