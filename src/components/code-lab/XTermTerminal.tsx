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

import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import type { XTermTerminalRef, XTermTerminalProps } from './xterm-types';
import { DEFAULT_THEME } from './xterm-types';
import { XTermLoadingState, XTermErrorState, XTermGlobalStyles } from './xterm-styles';

export type { XTermTheme, XTermTerminalProps, XTermTerminalRef } from './xterm-types';
export { useXTermTerminal } from './xterm-hooks';

// Dynamic imports for xterm to avoid SSR issues
let Terminal: typeof import('@xterm/xterm').Terminal | undefined;
let FitAddon: typeof import('@xterm/addon-fit').FitAddon | undefined;
let WebLinksAddon: typeof import('@xterm/addon-web-links').WebLinksAddon | undefined;
let SearchAddon: typeof import('@xterm/addon-search').SearchAddon | undefined;

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
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = sandboxId
          ? `${protocol}//${window.location.host}/api/code-lab/pty?sessionId=${sessionId}&sandboxId=${sandboxId}`
          : null;

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
            reconnectTimeoutRef.current = setTimeout(() => {
              if (terminalRef.current) {
                connectWebSocket();
              }
            }, 3000);
          };
        } catch {
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
      return <XTermLoadingState className={className} />;
    }

    if (error) {
      return <XTermErrorState className={className} error={error} />;
    }

    return (
      <>
        <div ref={containerRef} className={`xterm-container ${className}`} />
        <XTermGlobalStyles />
      </>
    );
  }
);

export default XTermTerminal;
