'use client';

import { useEffect, useCallback } from 'react';

interface UseChatKeyboardShortcutsArgs {
  onNewChat: () => void;
  onToggleSidebar: () => void;
  onToggleShortcuts: () => void;
  onStopStreaming?: () => void;
  isStreaming?: boolean;
}

export function useChatKeyboardShortcuts({
  onNewChat,
  onToggleSidebar,
  onToggleShortcuts,
  onStopStreaming,
  isStreaming,
}: UseChatKeyboardShortcutsArgs) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const isCmd = e.metaKey || e.ctrlKey;

      // Cmd+N — New chat
      if (isCmd && e.key === 'n') {
        e.preventDefault();
        onNewChat();
        return;
      }

      // Cmd+/ — Toggle shortcuts modal
      if (isCmd && e.key === '/') {
        e.preventDefault();
        onToggleShortcuts();
        return;
      }

      // Cmd+Shift+S — Toggle sidebar
      if (isCmd && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        onToggleSidebar();
        return;
      }

      // Escape — Stop streaming
      if (e.key === 'Escape' && isStreaming && onStopStreaming) {
        e.preventDefault();
        onStopStreaming();
        return;
      }
    },
    [onNewChat, onToggleSidebar, onToggleShortcuts, onStopStreaming, isStreaming]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
