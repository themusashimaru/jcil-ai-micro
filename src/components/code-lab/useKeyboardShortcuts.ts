/**
 * Keyboard Shortcuts Hook for CodeLab
 *
 * Handles all global keyboard shortcuts:
 * - Cmd/Ctrl+N: New session
 * - Cmd/Ctrl+K / Cmd/Ctrl+Shift+P: Command palette
 * - Cmd/Ctrl+E: Toggle workspace panel
 * - Cmd/Ctrl+B: Background tasks
 * - Cmd/Ctrl+Shift+B: Toggle sidebar
 * - Cmd/Ctrl+1-6: Switch workspace tabs
 * - Cmd/Ctrl+/: Keyboard shortcuts help
 * - Cmd/Ctrl+H: Session history
 * - Escape: Cancel streaming or close sidebar
 */

import { useEffect } from 'react';

type WorkspaceTab = 'files' | 'diff' | 'deploy' | 'visual' | 'debug' | 'plan' | 'memory' | 'tasks';

interface UseKeyboardShortcutsOptions {
  isStreaming: boolean;
  sidebarCollapsed: boolean;
  createSession: () => void;
  cancelStream: () => void;
  setSidebarCollapsed: (value: boolean | ((prev: boolean) => boolean)) => void;
  setCommandPaletteOpen: (value: boolean) => void;
  setShortcutsOpen: (value: boolean) => void;
  setHistoryOpen: (value: boolean) => void;
  setWorkspacePanelOpen: (value: boolean | ((prev: boolean) => boolean)) => void;
  setActiveWorkspaceTab: (tab: WorkspaceTab) => void;
}

export function useKeyboardShortcuts({
  isStreaming,
  sidebarCollapsed,
  createSession,
  cancelStream,
  setSidebarCollapsed,
  setCommandPaletteOpen,
  setShortcutsOpen,
  setHistoryOpen,
  setWorkspacePanelOpen,
  setActiveWorkspaceTab,
}: UseKeyboardShortcutsOptions): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdKey = isMac ? e.metaKey : e.ctrlKey;

      // Cmd/Ctrl+N - New session
      if (cmdKey && e.key === 'n') {
        e.preventDefault();
        createSession();
      }

      // Escape - Cancel streaming or close sidebar on mobile
      if (e.key === 'Escape') {
        if (isStreaming) {
          cancelStream();
        } else if (!sidebarCollapsed && window.innerWidth <= 768) {
          setSidebarCollapsed(true);
        }
      }

      // Cmd/Ctrl+B - Open background tasks panel (Claude Code parity)
      if (cmdKey && e.key === 'b' && !e.shiftKey) {
        e.preventDefault();
        setActiveWorkspaceTab('tasks');
        setWorkspacePanelOpen(true);
      }

      // Cmd/Ctrl+Shift+B - Toggle sidebar
      if (cmdKey && e.shiftKey && e.key === 'b') {
        e.preventDefault();
        setSidebarCollapsed((prev: boolean) => !prev);
      }

      // Cmd/Ctrl+K - Open command palette
      if (cmdKey && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }

      // Cmd/Ctrl+/ - Show keyboard shortcuts
      if (cmdKey && e.key === '/') {
        e.preventDefault();
        setShortcutsOpen(true);
      }

      // Cmd/Ctrl+Shift+P - Open command palette (VSCode style)
      if (cmdKey && e.shiftKey && e.key === 'p') {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }

      // Cmd/Ctrl+E - Toggle workspace panel
      if (cmdKey && e.key === 'e') {
        e.preventDefault();
        setWorkspacePanelOpen((prev: boolean) => !prev);
      }

      // Cmd/Ctrl+1-6 - Switch workspace tabs
      const tabKeys: Record<string, WorkspaceTab> = {
        '1': 'files',
        '2': 'diff',
        '3': 'deploy',
        '4': 'visual',
        '5': 'debug',
        '6': 'plan',
      };
      if (cmdKey && tabKeys[e.key]) {
        e.preventDefault();
        setActiveWorkspaceTab(tabKeys[e.key]);
        setWorkspacePanelOpen(true);
      }

      // Cmd/Ctrl+H - Open session history search (Claude Code parity)
      if (cmdKey && e.key === 'h') {
        e.preventDefault();
        setHistoryOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- createSession is intentionally not memoized
  }, [isStreaming, cancelStream, sidebarCollapsed, createSession]);
}
