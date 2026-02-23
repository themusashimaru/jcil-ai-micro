import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';

// Mock navigator.platform to return 'Linux' so ctrlKey is the command key
const originalPlatform = Object.getOwnPropertyDescriptor(navigator, 'platform');
beforeEach(() => {
  Object.defineProperty(navigator, 'platform', {
    value: 'Linux',
    configurable: true,
  });
});
afterEach(() => {
  if (originalPlatform) {
    Object.defineProperty(navigator, 'platform', originalPlatform);
  } else {
    Object.defineProperty(navigator, 'platform', {
      value: '',
      configurable: true,
    });
  }
});

/**
 * Helper to fire a keyboard event on the window and return a spy on preventDefault.
 */
function fireKeyboardEvent(key: string, options: Partial<KeyboardEvent> = {}) {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...options,
  });
  const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
  window.dispatchEvent(event);
  return { event, preventDefaultSpy };
}

function createMockCallbacks() {
  return {
    createSession: vi.fn(),
    cancelStream: vi.fn(),
    setSidebarCollapsed: vi.fn(),
    setCommandPaletteOpen: vi.fn(),
    setShortcutsOpen: vi.fn(),
    setHistoryOpen: vi.fn(),
    setWorkspacePanelOpen: vi.fn(),
    setActiveWorkspaceTab: vi.fn(),
  };
}

describe('useKeyboardShortcuts', () => {
  describe('Ctrl+N — New session', () => {
    it('calls createSession on Ctrl+N', () => {
      const mocks = createMockCallbacks();
      renderHook(() =>
        useKeyboardShortcuts({
          isStreaming: false,
          sidebarCollapsed: true,
          ...mocks,
        })
      );

      const { preventDefaultSpy } = fireKeyboardEvent('n', { ctrlKey: true });

      expect(mocks.createSession).toHaveBeenCalledTimes(1);
      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('does not call createSession without Ctrl', () => {
      const mocks = createMockCallbacks();
      renderHook(() =>
        useKeyboardShortcuts({
          isStreaming: false,
          sidebarCollapsed: true,
          ...mocks,
        })
      );

      fireKeyboardEvent('n');

      expect(mocks.createSession).not.toHaveBeenCalled();
    });
  });

  describe('Escape — Cancel streaming', () => {
    it('calls cancelStream when streaming is active', () => {
      const mocks = createMockCallbacks();
      renderHook(() =>
        useKeyboardShortcuts({
          isStreaming: true,
          sidebarCollapsed: true,
          ...mocks,
        })
      );

      fireKeyboardEvent('Escape');

      expect(mocks.cancelStream).toHaveBeenCalledTimes(1);
    });

    it('does not call cancelStream when not streaming', () => {
      const mocks = createMockCallbacks();
      renderHook(() =>
        useKeyboardShortcuts({
          isStreaming: false,
          sidebarCollapsed: true,
          ...mocks,
        })
      );

      fireKeyboardEvent('Escape');

      expect(mocks.cancelStream).not.toHaveBeenCalled();
    });
  });

  describe('Escape — Close sidebar on mobile', () => {
    it('collapses sidebar on mobile (<=768px) when sidebar is open and not streaming', () => {
      const mocks = createMockCallbacks();
      // Simulate mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        value: 768,
        writable: true,
        configurable: true,
      });

      renderHook(() =>
        useKeyboardShortcuts({
          isStreaming: false,
          sidebarCollapsed: false,
          ...mocks,
        })
      );

      fireKeyboardEvent('Escape');

      expect(mocks.setSidebarCollapsed).toHaveBeenCalledWith(true);
      expect(mocks.cancelStream).not.toHaveBeenCalled();

      // Reset innerWidth
      Object.defineProperty(window, 'innerWidth', {
        value: 1024,
        writable: true,
        configurable: true,
      });
    });

    it('collapses sidebar on narrow viewport (<768px)', () => {
      const mocks = createMockCallbacks();
      Object.defineProperty(window, 'innerWidth', {
        value: 375,
        writable: true,
        configurable: true,
      });

      renderHook(() =>
        useKeyboardShortcuts({
          isStreaming: false,
          sidebarCollapsed: false,
          ...mocks,
        })
      );

      fireKeyboardEvent('Escape');

      expect(mocks.setSidebarCollapsed).toHaveBeenCalledWith(true);

      Object.defineProperty(window, 'innerWidth', {
        value: 1024,
        writable: true,
        configurable: true,
      });
    });

    it('does not collapse sidebar on desktop (>768px) even if sidebar is open', () => {
      const mocks = createMockCallbacks();
      Object.defineProperty(window, 'innerWidth', {
        value: 1024,
        writable: true,
        configurable: true,
      });

      renderHook(() =>
        useKeyboardShortcuts({
          isStreaming: false,
          sidebarCollapsed: false,
          ...mocks,
        })
      );

      fireKeyboardEvent('Escape');

      expect(mocks.setSidebarCollapsed).not.toHaveBeenCalled();
    });
  });

  describe('Escape — Does nothing when not streaming and sidebar collapsed', () => {
    it('does not call any callback when not streaming and sidebar is collapsed', () => {
      const mocks = createMockCallbacks();
      Object.defineProperty(window, 'innerWidth', {
        value: 768,
        writable: true,
        configurable: true,
      });

      renderHook(() =>
        useKeyboardShortcuts({
          isStreaming: false,
          sidebarCollapsed: true,
          ...mocks,
        })
      );

      fireKeyboardEvent('Escape');

      expect(mocks.cancelStream).not.toHaveBeenCalled();
      expect(mocks.setSidebarCollapsed).not.toHaveBeenCalled();

      Object.defineProperty(window, 'innerWidth', {
        value: 1024,
        writable: true,
        configurable: true,
      });
    });
  });

  describe('Escape — Streaming takes priority over sidebar close', () => {
    it('calls cancelStream (not setSidebarCollapsed) when both streaming and sidebar open on mobile', () => {
      const mocks = createMockCallbacks();
      Object.defineProperty(window, 'innerWidth', {
        value: 375,
        writable: true,
        configurable: true,
      });

      renderHook(() =>
        useKeyboardShortcuts({
          isStreaming: true,
          sidebarCollapsed: false,
          ...mocks,
        })
      );

      fireKeyboardEvent('Escape');

      expect(mocks.cancelStream).toHaveBeenCalledTimes(1);
      // The code uses if/else if, so sidebar collapse is skipped when streaming
      expect(mocks.setSidebarCollapsed).not.toHaveBeenCalled();

      Object.defineProperty(window, 'innerWidth', {
        value: 1024,
        writable: true,
        configurable: true,
      });
    });
  });

  describe('Ctrl+B — Open background tasks panel', () => {
    it('sets active workspace tab to tasks and opens workspace panel', () => {
      const mocks = createMockCallbacks();
      renderHook(() =>
        useKeyboardShortcuts({
          isStreaming: false,
          sidebarCollapsed: true,
          ...mocks,
        })
      );

      const { preventDefaultSpy } = fireKeyboardEvent('b', { ctrlKey: true });

      expect(mocks.setActiveWorkspaceTab).toHaveBeenCalledWith('tasks');
      expect(mocks.setWorkspacePanelOpen).toHaveBeenCalledWith(true);
      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('does not open tasks panel without Ctrl', () => {
      const mocks = createMockCallbacks();
      renderHook(() =>
        useKeyboardShortcuts({
          isStreaming: false,
          sidebarCollapsed: true,
          ...mocks,
        })
      );

      fireKeyboardEvent('b');

      expect(mocks.setActiveWorkspaceTab).not.toHaveBeenCalled();
    });
  });

  describe('Ctrl+Shift+B — Toggle sidebar', () => {
    it('calls setSidebarCollapsed with a toggling function', () => {
      const mocks = createMockCallbacks();
      renderHook(() =>
        useKeyboardShortcuts({
          isStreaming: false,
          sidebarCollapsed: true,
          ...mocks,
        })
      );

      const { preventDefaultSpy } = fireKeyboardEvent('b', {
        ctrlKey: true,
        shiftKey: true,
      });

      // Note: Ctrl+Shift+B triggers both the Ctrl+B handler (with shiftKey check)
      // and the Ctrl+Shift+B handler. The Ctrl+B handler has !e.shiftKey guard,
      // so only the Ctrl+Shift+B handler fires for sidebar toggle.
      expect(mocks.setSidebarCollapsed).toHaveBeenCalledTimes(1);
      expect(mocks.setSidebarCollapsed).toHaveBeenCalledWith(expect.any(Function));
      expect(preventDefaultSpy).toHaveBeenCalled();

      // Verify the toggling function works correctly
      const toggleFn = mocks.setSidebarCollapsed.mock.calls[0][0] as (prev: boolean) => boolean;
      expect(toggleFn(true)).toBe(false);
      expect(toggleFn(false)).toBe(true);
    });

    it('does not trigger Ctrl+B tasks panel when Shift is held', () => {
      const mocks = createMockCallbacks();
      renderHook(() =>
        useKeyboardShortcuts({
          isStreaming: false,
          sidebarCollapsed: true,
          ...mocks,
        })
      );

      fireKeyboardEvent('b', { ctrlKey: true, shiftKey: true });

      // The Ctrl+B handler checks !e.shiftKey, so tasks panel should not open
      // when Shift is held. But note: Ctrl+Shift+B handler sets workspace tab
      // only for sidebar toggle — let's verify tasks is NOT set via Ctrl+B path.
      // setSidebarCollapsed should be called (sidebar toggle), but setActiveWorkspaceTab
      // should NOT be called with 'tasks' from the Ctrl+B block.
      // However, both handlers fire: Ctrl+B is guarded by !e.shiftKey, so it won't fire.
      expect(mocks.setActiveWorkspaceTab).not.toHaveBeenCalled();
    });
  });

  describe('Ctrl+K — Open command palette', () => {
    it('opens command palette on Ctrl+K', () => {
      const mocks = createMockCallbacks();
      renderHook(() =>
        useKeyboardShortcuts({
          isStreaming: false,
          sidebarCollapsed: true,
          ...mocks,
        })
      );

      const { preventDefaultSpy } = fireKeyboardEvent('k', { ctrlKey: true });

      expect(mocks.setCommandPaletteOpen).toHaveBeenCalledWith(true);
      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('does not open command palette without Ctrl', () => {
      const mocks = createMockCallbacks();
      renderHook(() =>
        useKeyboardShortcuts({
          isStreaming: false,
          sidebarCollapsed: true,
          ...mocks,
        })
      );

      fireKeyboardEvent('k');

      expect(mocks.setCommandPaletteOpen).not.toHaveBeenCalled();
    });
  });

  describe('Ctrl+/ — Open shortcuts help', () => {
    it('opens shortcuts help on Ctrl+/', () => {
      const mocks = createMockCallbacks();
      renderHook(() =>
        useKeyboardShortcuts({
          isStreaming: false,
          sidebarCollapsed: true,
          ...mocks,
        })
      );

      const { preventDefaultSpy } = fireKeyboardEvent('/', { ctrlKey: true });

      expect(mocks.setShortcutsOpen).toHaveBeenCalledWith(true);
      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('does not open shortcuts help without Ctrl', () => {
      const mocks = createMockCallbacks();
      renderHook(() =>
        useKeyboardShortcuts({
          isStreaming: false,
          sidebarCollapsed: true,
          ...mocks,
        })
      );

      fireKeyboardEvent('/');

      expect(mocks.setShortcutsOpen).not.toHaveBeenCalled();
    });
  });

  describe('Ctrl+Shift+P — Open command palette (VSCode style)', () => {
    it('opens command palette on Ctrl+Shift+P', () => {
      const mocks = createMockCallbacks();
      renderHook(() =>
        useKeyboardShortcuts({
          isStreaming: false,
          sidebarCollapsed: true,
          ...mocks,
        })
      );

      const { preventDefaultSpy } = fireKeyboardEvent('p', {
        ctrlKey: true,
        shiftKey: true,
      });

      expect(mocks.setCommandPaletteOpen).toHaveBeenCalledWith(true);
      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('does not open command palette on Ctrl+P (without Shift)', () => {
      const mocks = createMockCallbacks();
      renderHook(() =>
        useKeyboardShortcuts({
          isStreaming: false,
          sidebarCollapsed: true,
          ...mocks,
        })
      );

      fireKeyboardEvent('p', { ctrlKey: true });

      // Ctrl+P without Shift should not trigger the Ctrl+Shift+P handler
      expect(mocks.setCommandPaletteOpen).not.toHaveBeenCalled();
    });
  });

  describe('Ctrl+E — Toggle workspace panel', () => {
    it('toggles workspace panel on Ctrl+E', () => {
      const mocks = createMockCallbacks();
      renderHook(() =>
        useKeyboardShortcuts({
          isStreaming: false,
          sidebarCollapsed: true,
          ...mocks,
        })
      );

      const { preventDefaultSpy } = fireKeyboardEvent('e', { ctrlKey: true });

      expect(mocks.setWorkspacePanelOpen).toHaveBeenCalledTimes(1);
      expect(mocks.setWorkspacePanelOpen).toHaveBeenCalledWith(expect.any(Function));
      expect(preventDefaultSpy).toHaveBeenCalled();

      // Verify the toggling function works correctly
      const toggleFn = mocks.setWorkspacePanelOpen.mock.calls[0][0] as (prev: boolean) => boolean;
      expect(toggleFn(true)).toBe(false);
      expect(toggleFn(false)).toBe(true);
    });

    it('does not toggle workspace panel without Ctrl', () => {
      const mocks = createMockCallbacks();
      renderHook(() =>
        useKeyboardShortcuts({
          isStreaming: false,
          sidebarCollapsed: true,
          ...mocks,
        })
      );

      fireKeyboardEvent('e');

      expect(mocks.setWorkspacePanelOpen).not.toHaveBeenCalled();
    });
  });

  describe('Ctrl+1-6 — Switch workspace tabs', () => {
    const tabMap: Record<string, string> = {
      '1': 'files',
      '2': 'diff',
      '3': 'deploy',
      '4': 'visual',
      '5': 'debug',
      '6': 'plan',
    };

    for (const [key, expectedTab] of Object.entries(tabMap)) {
      it(`Ctrl+${key} switches to "${expectedTab}" tab and opens workspace panel`, () => {
        const mocks = createMockCallbacks();
        renderHook(() =>
          useKeyboardShortcuts({
            isStreaming: false,
            sidebarCollapsed: true,
            ...mocks,
          })
        );

        const { preventDefaultSpy } = fireKeyboardEvent(key, { ctrlKey: true });

        expect(mocks.setActiveWorkspaceTab).toHaveBeenCalledWith(expectedTab);
        expect(mocks.setWorkspacePanelOpen).toHaveBeenCalledWith(true);
        expect(preventDefaultSpy).toHaveBeenCalled();
      });
    }

    it('does not switch tabs for Ctrl+7 (out of range)', () => {
      const mocks = createMockCallbacks();
      renderHook(() =>
        useKeyboardShortcuts({
          isStreaming: false,
          sidebarCollapsed: true,
          ...mocks,
        })
      );

      fireKeyboardEvent('7', { ctrlKey: true });

      // setActiveWorkspaceTab should not be called for keys outside 1-6
      expect(mocks.setActiveWorkspaceTab).not.toHaveBeenCalled();
    });

    it('does not switch tabs for number keys without Ctrl', () => {
      const mocks = createMockCallbacks();
      renderHook(() =>
        useKeyboardShortcuts({
          isStreaming: false,
          sidebarCollapsed: true,
          ...mocks,
        })
      );

      fireKeyboardEvent('1');

      expect(mocks.setActiveWorkspaceTab).not.toHaveBeenCalled();
      expect(mocks.setWorkspacePanelOpen).not.toHaveBeenCalled();
    });
  });

  describe('Ctrl+H — Open session history', () => {
    it('opens session history on Ctrl+H', () => {
      const mocks = createMockCallbacks();
      renderHook(() =>
        useKeyboardShortcuts({
          isStreaming: false,
          sidebarCollapsed: true,
          ...mocks,
        })
      );

      const { preventDefaultSpy } = fireKeyboardEvent('h', { ctrlKey: true });

      expect(mocks.setHistoryOpen).toHaveBeenCalledWith(true);
      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('does not open session history without Ctrl', () => {
      const mocks = createMockCallbacks();
      renderHook(() =>
        useKeyboardShortcuts({
          isStreaming: false,
          sidebarCollapsed: true,
          ...mocks,
        })
      );

      fireKeyboardEvent('h');

      expect(mocks.setHistoryOpen).not.toHaveBeenCalled();
    });
  });

  describe('preventDefault is called on all Ctrl shortcuts', () => {
    const ctrlShortcuts: Array<{ key: string; shiftKey?: boolean; label: string }> = [
      { key: 'n', label: 'Ctrl+N' },
      { key: 'b', label: 'Ctrl+B' },
      { key: 'b', shiftKey: true, label: 'Ctrl+Shift+B' },
      { key: 'k', label: 'Ctrl+K' },
      { key: '/', label: 'Ctrl+/' },
      { key: 'p', shiftKey: true, label: 'Ctrl+Shift+P' },
      { key: 'e', label: 'Ctrl+E' },
      { key: '1', label: 'Ctrl+1' },
      { key: '2', label: 'Ctrl+2' },
      { key: '3', label: 'Ctrl+3' },
      { key: '4', label: 'Ctrl+4' },
      { key: '5', label: 'Ctrl+5' },
      { key: '6', label: 'Ctrl+6' },
      { key: 'h', label: 'Ctrl+H' },
    ];

    for (const shortcut of ctrlShortcuts) {
      it(`calls preventDefault for ${shortcut.label}`, () => {
        const mocks = createMockCallbacks();
        renderHook(() =>
          useKeyboardShortcuts({
            isStreaming: false,
            sidebarCollapsed: true,
            ...mocks,
          })
        );

        const { preventDefaultSpy } = fireKeyboardEvent(shortcut.key, {
          ctrlKey: true,
          shiftKey: shortcut.shiftKey ?? false,
        });

        expect(preventDefaultSpy).toHaveBeenCalled();
      });
    }

    it('does not call preventDefault for Escape', () => {
      const mocks = createMockCallbacks();
      renderHook(() =>
        useKeyboardShortcuts({
          isStreaming: true,
          sidebarCollapsed: true,
          ...mocks,
        })
      );

      const { preventDefaultSpy } = fireKeyboardEvent('Escape');

      expect(preventDefaultSpy).not.toHaveBeenCalled();
    });
  });

  describe('Cleanup — event listener removal', () => {
    it('removes the keydown event listener on unmount', () => {
      const mocks = createMockCallbacks();
      const { unmount } = renderHook(() =>
        useKeyboardShortcuts({
          isStreaming: false,
          sidebarCollapsed: true,
          ...mocks,
        })
      );

      unmount();

      // After unmount, firing a keyboard event should not trigger any callback
      fireKeyboardEvent('n', { ctrlKey: true });

      expect(mocks.createSession).not.toHaveBeenCalled();
    });
  });

  describe('Reactivity — hook responds to prop changes', () => {
    it('uses updated isStreaming value after rerender', () => {
      const mocks = createMockCallbacks();
      const { rerender } = renderHook(
        ({ isStreaming }: { isStreaming: boolean }) =>
          useKeyboardShortcuts({
            isStreaming,
            sidebarCollapsed: true,
            ...mocks,
          }),
        { initialProps: { isStreaming: false } }
      );

      // Escape does nothing when not streaming
      fireKeyboardEvent('Escape');
      expect(mocks.cancelStream).not.toHaveBeenCalled();

      // Switch to streaming
      rerender({ isStreaming: true });

      // Now Escape should cancel streaming
      fireKeyboardEvent('Escape');
      expect(mocks.cancelStream).toHaveBeenCalledTimes(1);
    });
  });
});
