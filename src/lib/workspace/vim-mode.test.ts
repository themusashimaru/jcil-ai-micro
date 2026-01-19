/**
 * VIM MODE TESTS
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VimModeManager, getVimManager, resetVimManager } from './vim-mode';

// Mock textarea
function createMockTextarea(value: string = ''): HTMLTextAreaElement {
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.selectionStart = 0;
  textarea.selectionEnd = 0;

  // Mock setSelectionRange
  textarea.setSelectionRange = vi.fn((start, end) => {
    textarea.selectionStart = start;
    textarea.selectionEnd = end;
  });

  // Mock dispatchEvent
  textarea.dispatchEvent = vi.fn();

  return textarea;
}

describe('VimModeManager', () => {
  let manager: VimModeManager;
  let textarea: HTMLTextAreaElement;

  beforeEach(() => {
    manager = new VimModeManager();
    textarea = createMockTextarea('Hello World\nSecond Line\nThird Line');
  });

  describe('enable/disable', () => {
    it('should start disabled', () => {
      expect(manager.isEnabled()).toBe(false);
    });

    it('should enable vim mode', () => {
      manager.enable(textarea);
      expect(manager.isEnabled()).toBe(true);
    });

    it('should disable vim mode', () => {
      manager.enable(textarea);
      manager.disable();
      expect(manager.isEnabled()).toBe(false);
    });

    it('should toggle vim mode', () => {
      expect(manager.toggle(textarea)).toBe(true);
      expect(manager.isEnabled()).toBe(true);
      expect(manager.toggle()).toBe(false);
      expect(manager.isEnabled()).toBe(false);
    });
  });

  describe('initial state', () => {
    it('should start in normal mode', () => {
      manager.enable(textarea);
      expect(manager.getState().mode).toBe('normal');
    });

    it('should have cursor at 1,1', () => {
      manager.enable(textarea);
      const state = manager.getState();
      expect(state.cursor.line).toBe(1);
      expect(state.cursor.column).toBe(1);
    });

    it('should have empty register', () => {
      manager.enable(textarea);
      expect(manager.getState().register).toBe('');
    });
  });

  describe('mode switching', () => {
    beforeEach(() => {
      manager.enable(textarea);
    });

    it('should switch to insert mode with "i"', () => {
      const event = new KeyboardEvent('keydown', { key: 'i' });
      manager.handleKeyDown(event);
      expect(manager.getState().mode).toBe('insert');
    });

    it('should switch to visual mode with "v"', () => {
      const event = new KeyboardEvent('keydown', { key: 'v' });
      manager.handleKeyDown(event);
      expect(manager.getState().mode).toBe('visual');
    });

    it('should switch to command mode with ":"', () => {
      const event = new KeyboardEvent('keydown', { key: ':' });
      manager.handleKeyDown(event);
      expect(manager.getState().mode).toBe('command');
    });

    it('should return to normal mode with Escape', () => {
      // Enter insert mode
      manager.handleKeyDown(new KeyboardEvent('keydown', { key: 'i' }));
      expect(manager.getState().mode).toBe('insert');

      // Return to normal
      manager.handleKeyDown(new KeyboardEvent('keydown', { key: 'Escape' }));
      expect(manager.getState().mode).toBe('normal');
    });
  });

  describe('mode indicators', () => {
    beforeEach(() => {
      manager.enable(textarea);
    });

    it('should show NORMAL indicator', () => {
      expect(manager.getModeIndicator()).toBe('-- NORMAL --');
    });

    it('should show INSERT indicator', () => {
      manager.handleKeyDown(new KeyboardEvent('keydown', { key: 'i' }));
      expect(manager.getModeIndicator()).toBe('-- INSERT --');
    });

    it('should show VISUAL indicator', () => {
      manager.handleKeyDown(new KeyboardEvent('keydown', { key: 'v' }));
      expect(manager.getModeIndicator()).toBe('-- VISUAL --');
    });

    it('should show command buffer in command mode', () => {
      manager.handleKeyDown(new KeyboardEvent('keydown', { key: ':' }));
      expect(manager.getModeIndicator()).toBe(':');
    });
  });

  describe('navigation', () => {
    beforeEach(() => {
      manager.enable(textarea);
    });

    it('should not handle keys when disabled', () => {
      manager.disable();
      const event = new KeyboardEvent('keydown', { key: 'j' });
      expect(manager.handleKeyDown(event)).toBe(false);
    });

    it('should handle h key (left)', () => {
      // First move right to have room to move left
      manager.handleKeyDown(new KeyboardEvent('keydown', { key: 'l' }));
      manager.handleKeyDown(new KeyboardEvent('keydown', { key: 'l' }));
      const col = manager.getState().cursor.column;

      manager.handleKeyDown(new KeyboardEvent('keydown', { key: 'h' }));
      expect(manager.getState().cursor.column).toBe(col - 1);
    });

    it('should handle j key (down)', () => {
      const line = manager.getState().cursor.line;
      manager.handleKeyDown(new KeyboardEvent('keydown', { key: 'j' }));
      expect(manager.getState().cursor.line).toBe(line + 1);
    });

    it('should handle k key (up)', () => {
      // Move down first
      manager.handleKeyDown(new KeyboardEvent('keydown', { key: 'j' }));
      const line = manager.getState().cursor.line;

      manager.handleKeyDown(new KeyboardEvent('keydown', { key: 'k' }));
      expect(manager.getState().cursor.line).toBe(line - 1);
    });

    it('should handle l key (right)', () => {
      const col = manager.getState().cursor.column;
      manager.handleKeyDown(new KeyboardEvent('keydown', { key: 'l' }));
      expect(manager.getState().cursor.column).toBe(col + 1);
    });

    it('should handle 0 key (line start)', () => {
      // Move right first
      manager.handleKeyDown(new KeyboardEvent('keydown', { key: 'l' }));
      manager.handleKeyDown(new KeyboardEvent('keydown', { key: 'l' }));

      manager.handleKeyDown(new KeyboardEvent('keydown', { key: '0' }));
      expect(manager.getState().cursor.column).toBe(1);
    });

    it('should handle $ key (line end)', () => {
      manager.handleKeyDown(new KeyboardEvent('keydown', { key: '$' }));
      expect(manager.getState().cursor.column).toBeGreaterThan(1);
    });

    it('should handle G key (bottom)', () => {
      manager.handleKeyDown(new KeyboardEvent('keydown', { key: 'G' }));
      expect(manager.getState().cursor.line).toBe(3);
    });
  });

  describe('insert mode triggers', () => {
    beforeEach(() => {
      manager.enable(textarea);
    });

    it('should handle a (append)', () => {
      manager.handleKeyDown(new KeyboardEvent('keydown', { key: 'a' }));
      expect(manager.getState().mode).toBe('insert');
    });

    it('should handle o (open below)', () => {
      manager.handleKeyDown(new KeyboardEvent('keydown', { key: 'o' }));
      expect(manager.getState().mode).toBe('insert');
      expect(manager.getState().cursor.line).toBe(2);
    });

    it('should handle O (open above)', () => {
      // First move to line 2
      manager.handleKeyDown(new KeyboardEvent('keydown', { key: 'j' }));
      const line = manager.getState().cursor.line;

      manager.handleKeyDown(new KeyboardEvent('keydown', { key: 'O' }));
      expect(manager.getState().mode).toBe('insert');
      expect(manager.getState().cursor.line).toBe(line);
    });

    it('should handle I (insert at line start)', () => {
      manager.handleKeyDown(new KeyboardEvent('keydown', { key: 'l' }));
      manager.handleKeyDown(new KeyboardEvent('keydown', { key: 'l' }));

      manager.handleKeyDown(new KeyboardEvent('keydown', { key: 'I' }));
      expect(manager.getState().mode).toBe('insert');
    });

    it('should handle A (append at line end)', () => {
      manager.handleKeyDown(new KeyboardEvent('keydown', { key: 'A' }));
      expect(manager.getState().mode).toBe('insert');
    });
  });

  describe('editing', () => {
    beforeEach(() => {
      manager.enable(textarea);
    });

    it('should handle x (delete char)', () => {
      const originalLength = textarea.value.length;
      manager.handleKeyDown(new KeyboardEvent('keydown', { key: 'x' }));
      expect(textarea.value.length).toBe(originalLength - 1);
    });

    it('should handle yy (yank line)', () => {
      manager.handleKeyDown(new KeyboardEvent('keydown', { key: 'y' }));
      manager.handleKeyDown(new KeyboardEvent('keydown', { key: 'y' }));
      expect(manager.getState().register).toContain('Hello World');
    });
  });

  describe('key bindings', () => {
    it('should return all key bindings', () => {
      const bindings = manager.getKeyBindings();
      expect(bindings.length).toBeGreaterThan(0);
      expect(bindings.some((b) => b.key === 'h')).toBe(true);
      expect(bindings.some((b) => b.key === 'j')).toBe(true);
      expect(bindings.some((b) => b.key === 'k')).toBe(true);
      expect(bindings.some((b) => b.key === 'l')).toBe(true);
    });
  });

  describe('state change callback', () => {
    it('should call callback on state change', () => {
      manager.enable(textarea);
      const callback = vi.fn();
      manager.setOnStateChange(callback);

      manager.handleKeyDown(new KeyboardEvent('keydown', { key: 'i' }));
      expect(callback).toHaveBeenCalled();
    });
  });
});

describe('singleton', () => {
  beforeEach(() => {
    resetVimManager();
  });

  it('should return same instance', () => {
    const manager1 = getVimManager();
    const manager2 = getVimManager();
    expect(manager1).toBe(manager2);
  });

  it('should reset instance', () => {
    const textarea = createMockTextarea();
    const manager1 = getVimManager();
    manager1.enable(textarea);
    expect(manager1.isEnabled()).toBe(true);

    resetVimManager();
    const manager2 = getVimManager();
    expect(manager2.isEnabled()).toBe(false);
  });
});
