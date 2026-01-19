/**
 * VIM MODE FOR CODE LAB EDITOR
 *
 * Provides vim-style keybindings for the code editor.
 *
 * Modes:
 * - Normal: Navigation and commands
 * - Insert: Text input
 * - Visual: Selection
 * - Command: Ex commands (:w, :q, etc.)
 *
 * Features:
 * - Basic navigation (h, j, k, l)
 * - Word movements (w, b, e)
 * - Line movements (0, $, ^)
 * - Insert mode triggers (i, a, o, O)
 * - Delete operations (x, dd, dw)
 * - Yank/paste (y, p)
 * - Visual selection (v, V)
 * - Search (/, ?)
 * - Ex commands (:w, :q, :wq)
 */

import { logger } from '@/lib/logger';

const log = logger('VimMode');

// ============================================================================
// TYPES
// ============================================================================

export type VimMode = 'normal' | 'insert' | 'visual' | 'visual-line' | 'command';

export interface VimState {
  mode: VimMode;
  cursor: {
    line: number;
    column: number;
  };
  selection?: {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  };
  register: string;
  commandBuffer: string;
  /** Buffer for multi-key sequences (e.g., 'dd', 'yy', 'gg') */
  keyBuffer: string;
  repeatCount: number;
  lastCommand?: string;
  searchPattern?: string;
  searchDirection: 'forward' | 'backward';
}

export interface VimAction {
  type: string;
  payload?: Record<string, unknown>;
}

export interface VimKeyHandler {
  key: string | RegExp;
  modes: VimMode[];
  handler: (state: VimState, key: string, textarea: HTMLTextAreaElement) => VimState;
  description: string;
}

// ============================================================================
// VIM STATE MANAGER
// ============================================================================

export class VimModeManager {
  private enabled: boolean = false;
  private state: VimState;
  private textarea: HTMLTextAreaElement | null = null;
  private handlers: VimKeyHandler[] = [];
  private onStateChange?: (state: VimState) => void;

  constructor() {
    this.state = this.getInitialState();
    this.registerDefaultHandlers();
  }

  private getInitialState(): VimState {
    return {
      mode: 'normal',
      cursor: { line: 1, column: 1 },
      register: '',
      commandBuffer: '',
      keyBuffer: '',
      repeatCount: 1,
      searchDirection: 'forward',
    };
  }

  /**
   * Enable vim mode
   */
  enable(textarea: HTMLTextAreaElement): void {
    this.enabled = true;
    this.textarea = textarea;
    this.state = this.getInitialState();
    log.info('Vim mode enabled');
  }

  /**
   * Disable vim mode
   */
  disable(): void {
    this.enabled = false;
    this.textarea = null;
    this.state = this.getInitialState();
    log.info('Vim mode disabled');
  }

  /**
   * Toggle vim mode
   */
  toggle(textarea?: HTMLTextAreaElement): boolean {
    if (this.enabled) {
      this.disable();
      return false;
    } else if (textarea) {
      this.enable(textarea);
      return true;
    }
    return false;
  }

  /**
   * Check if vim mode is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get current state
   */
  getState(): VimState {
    return { ...this.state };
  }

  /**
   * Set state change callback
   */
  setOnStateChange(callback: (state: VimState) => void): void {
    this.onStateChange = callback;
  }

  /**
   * Handle keydown event with support for multi-key sequences (dd, yy, gg)
   */
  handleKeyDown(e: KeyboardEvent): boolean {
    if (!this.enabled || !this.textarea) return false;

    const key = this.getKeyString(e);

    // Handle escape key - always return to normal mode and clear key buffer
    if (key === 'Escape') {
      if (this.state.mode !== 'normal' || this.state.keyBuffer) {
        this.state = { ...this.state, mode: 'normal', commandBuffer: '', keyBuffer: '' };
        this.notifyStateChange();
        e.preventDefault();
        return true;
      }
      return false;
    }

    // In insert mode, let most keys pass through
    if (this.state.mode === 'insert' && !this.isVimControlKey(key)) {
      return false;
    }

    // In normal/visual mode, handle multi-key sequences
    if (this.state.mode === 'normal' || this.state.mode === 'visual') {
      // Accumulate key in buffer
      const keySequence = this.state.keyBuffer + key;

      // First, check for exact multi-key match
      for (const handler of this.handlers) {
        if (!handler.modes.includes(this.state.mode)) continue;

        const handlerKey = typeof handler.key === 'string' ? handler.key : null;
        if (handlerKey && handlerKey === keySequence) {
          // Full match - execute and clear buffer
          this.state = handler.handler(this.state, keySequence, this.textarea);
          this.state.keyBuffer = '';
          this.notifyStateChange();
          e.preventDefault();
          return true;
        }
      }

      // Check if this could be the start of a multi-key sequence
      const potentialMultiKey = this.handlers.some((h) => {
        const hKey = typeof h.key === 'string' ? h.key : null;
        return hKey && hKey.length > 1 && hKey.startsWith(keySequence);
      });

      if (potentialMultiKey) {
        // Could be start of multi-key - buffer and wait
        this.state.keyBuffer = keySequence;
        this.notifyStateChange();
        e.preventDefault();
        return true;
      }

      // Not a multi-key sequence - check for single key match
      // First clear the buffer and try the accumulated sequence as separate keys
      if (this.state.keyBuffer) {
        this.state.keyBuffer = '';
      }

      // Now check for single key handler
      for (const handler of this.handlers) {
        if (!handler.modes.includes(this.state.mode)) continue;

        const matches =
          typeof handler.key === 'string' ? handler.key === key : handler.key.test(key);

        if (matches) {
          this.state = handler.handler(this.state, key, this.textarea);
          this.notifyStateChange();
          e.preventDefault();
          return true;
        }
      }
    }

    // In command mode, accumulate input
    if (this.state.mode === 'command') {
      if (key === 'Enter') {
        this.executeCommand();
      } else if (key === 'Backspace') {
        this.state.commandBuffer = this.state.commandBuffer.slice(0, -1);
        if (this.state.commandBuffer === '') {
          this.state.mode = 'normal';
        }
      } else if (key.length === 1) {
        this.state.commandBuffer += key;
      }
      this.notifyStateChange();
      e.preventDefault();
      return true;
    }

    return false;
  }

  /**
   * Execute ex command
   */
  private executeCommand(): void {
    const cmd = this.state.commandBuffer.substring(1); // Remove leading :
    log.debug('Executing vim command', { cmd });

    switch (cmd) {
      case 'w':
        // Trigger save
        this.textarea?.dispatchEvent(new CustomEvent('vim-save'));
        break;
      case 'q':
        // Trigger close
        this.textarea?.dispatchEvent(new CustomEvent('vim-close'));
        break;
      case 'wq':
        // Save and close
        this.textarea?.dispatchEvent(new CustomEvent('vim-save'));
        this.textarea?.dispatchEvent(new CustomEvent('vim-close'));
        break;
      case 'q!':
        // Force close without saving
        this.textarea?.dispatchEvent(new CustomEvent('vim-force-close'));
        break;
      default:
        log.warn('Unknown vim command', { cmd });
    }

    this.state.mode = 'normal';
    this.state.commandBuffer = '';
  }

  /**
   * Register default key handlers
   */
  private registerDefaultHandlers(): void {
    // Normal mode navigation
    this.handlers.push(
      // Basic movement
      {
        key: 'h',
        modes: ['normal', 'visual'],
        handler: (state, _key, textarea) => this.moveCursor(state, textarea, 0, -1),
        description: 'Move left',
      },
      {
        key: 'j',
        modes: ['normal', 'visual'],
        handler: (state, _key, textarea) => this.moveCursor(state, textarea, 1, 0),
        description: 'Move down',
      },
      {
        key: 'k',
        modes: ['normal', 'visual'],
        handler: (state, _key, textarea) => this.moveCursor(state, textarea, -1, 0),
        description: 'Move up',
      },
      {
        key: 'l',
        modes: ['normal', 'visual'],
        handler: (state, _key, textarea) => this.moveCursor(state, textarea, 0, 1),
        description: 'Move right',
      },

      // Line movements
      {
        key: '0',
        modes: ['normal', 'visual'],
        handler: (state, _key, textarea) => this.moveToLineStart(state, textarea),
        description: 'Move to line start',
      },
      {
        key: '$',
        modes: ['normal', 'visual'],
        handler: (state, _key, textarea) => this.moveToLineEnd(state, textarea),
        description: 'Move to line end',
      },
      {
        key: '^',
        modes: ['normal', 'visual'],
        handler: (state, _key, textarea) => this.moveToFirstNonBlank(state, textarea),
        description: 'Move to first non-blank',
      },

      // Word movements
      {
        key: 'w',
        modes: ['normal', 'visual'],
        handler: (state, _key, textarea) => this.moveWordForward(state, textarea),
        description: 'Move to next word',
      },
      {
        key: 'b',
        modes: ['normal', 'visual'],
        handler: (state, _key, textarea) => this.moveWordBackward(state, textarea),
        description: 'Move to previous word',
      },
      {
        key: 'e',
        modes: ['normal', 'visual'],
        handler: (state, _key, textarea) => this.moveToWordEnd(state, textarea),
        description: 'Move to word end',
      },

      // Page movements
      {
        key: 'gg',
        modes: ['normal', 'visual'],
        handler: (state, _key, textarea) => this.moveToTop(state, textarea),
        description: 'Move to top',
      },
      {
        key: 'G',
        modes: ['normal', 'visual'],
        handler: (state, _key, textarea) => this.moveToBottom(state, textarea),
        description: 'Move to bottom',
      },

      // Insert mode triggers
      {
        key: 'i',
        modes: ['normal'],
        handler: (state) => ({ ...state, mode: 'insert' as VimMode }),
        description: 'Insert before cursor',
      },
      {
        key: 'a',
        modes: ['normal'],
        handler: (state, _key, textarea) => {
          this.moveCursor(state, textarea, 0, 1);
          return { ...state, mode: 'insert' as VimMode };
        },
        description: 'Insert after cursor',
      },
      {
        key: 'o',
        modes: ['normal'],
        handler: (state, _key, textarea) => this.insertLineBelow(state, textarea),
        description: 'Insert line below',
      },
      {
        key: 'O',
        modes: ['normal'],
        handler: (state, _key, textarea) => this.insertLineAbove(state, textarea),
        description: 'Insert line above',
      },
      {
        key: 'I',
        modes: ['normal'],
        handler: (state, _key, textarea) => {
          this.moveToFirstNonBlank(state, textarea);
          return { ...state, mode: 'insert' as VimMode };
        },
        description: 'Insert at line start',
      },
      {
        key: 'A',
        modes: ['normal'],
        handler: (state, _key, textarea) => {
          this.moveToLineEnd(state, textarea);
          return { ...state, mode: 'insert' as VimMode };
        },
        description: 'Insert at line end',
      },

      // Visual mode
      {
        key: 'v',
        modes: ['normal'],
        handler: (state) => ({
          ...state,
          mode: 'visual' as VimMode,
          selection: {
            startLine: state.cursor.line,
            startColumn: state.cursor.column,
            endLine: state.cursor.line,
            endColumn: state.cursor.column,
          },
        }),
        description: 'Visual mode',
      },
      {
        key: 'V',
        modes: ['normal'],
        handler: (state) => ({
          ...state,
          mode: 'visual-line' as VimMode,
          selection: {
            startLine: state.cursor.line,
            startColumn: 1,
            endLine: state.cursor.line,
            endColumn: Infinity,
          },
        }),
        description: 'Visual line mode',
      },

      // Delete operations
      {
        key: 'x',
        modes: ['normal'],
        handler: (state, _key, textarea) => this.deleteChar(state, textarea),
        description: 'Delete character',
      },
      {
        key: 'dd',
        modes: ['normal'],
        handler: (state, _key, textarea) => this.deleteLine(state, textarea),
        description: 'Delete line',
      },

      // Yank and paste
      {
        key: 'yy',
        modes: ['normal'],
        handler: (state, _key, textarea) => this.yankLine(state, textarea),
        description: 'Yank line',
      },
      {
        key: 'p',
        modes: ['normal'],
        handler: (state, _key, textarea) => this.paste(state, textarea),
        description: 'Paste after',
      },
      {
        key: 'P',
        modes: ['normal'],
        handler: (state, _key, textarea) => this.pasteBefore(state, textarea),
        description: 'Paste before',
      },

      // Undo/Redo
      {
        key: 'u',
        modes: ['normal'],
        handler: (state, _key, textarea) => {
          textarea.dispatchEvent(new CustomEvent('vim-undo'));
          return state;
        },
        description: 'Undo',
      },
      {
        key: 'Ctrl-r',
        modes: ['normal'],
        handler: (state, _key, textarea) => {
          textarea.dispatchEvent(new CustomEvent('vim-redo'));
          return state;
        },
        description: 'Redo',
      },

      // Command mode
      {
        key: ':',
        modes: ['normal'],
        handler: (state) => ({ ...state, mode: 'command' as VimMode, commandBuffer: ':' }),
        description: 'Enter command mode',
      },

      // Search
      {
        key: '/',
        modes: ['normal'],
        handler: (state) => ({
          ...state,
          mode: 'command' as VimMode,
          commandBuffer: '/',
          searchDirection: 'forward' as const,
        }),
        description: 'Search forward',
      },
      {
        key: '?',
        modes: ['normal'],
        handler: (state) => ({
          ...state,
          mode: 'command' as VimMode,
          commandBuffer: '?',
          searchDirection: 'backward' as const,
        }),
        description: 'Search backward',
      }
    );
  }

  // ========================================================================
  // MOVEMENT HELPERS
  // ========================================================================

  private moveCursor(
    state: VimState,
    textarea: HTMLTextAreaElement,
    lineDelta: number,
    columnDelta: number
  ): VimState {
    const lines = textarea.value.split('\n');
    let newLine = state.cursor.line + lineDelta;
    let newColumn = state.cursor.column + columnDelta;

    // Clamp line
    newLine = Math.max(1, Math.min(lines.length, newLine));

    // Clamp column
    const lineLength = lines[newLine - 1]?.length || 0;
    newColumn = Math.max(1, Math.min(lineLength + 1, newColumn));

    // Update textarea selection
    const newPos = this.getPosition(textarea, newLine, newColumn);
    textarea.setSelectionRange(newPos, newPos);

    return {
      ...state,
      cursor: { line: newLine, column: newColumn },
    };
  }

  private moveToLineStart(state: VimState, textarea: HTMLTextAreaElement): VimState {
    const newColumn = 1;
    const newPos = this.getPosition(textarea, state.cursor.line, newColumn);
    textarea.setSelectionRange(newPos, newPos);

    return {
      ...state,
      cursor: { ...state.cursor, column: newColumn },
    };
  }

  private moveToLineEnd(state: VimState, textarea: HTMLTextAreaElement): VimState {
    const lines = textarea.value.split('\n');
    const lineLength = lines[state.cursor.line - 1]?.length || 0;
    const newColumn = Math.max(1, lineLength + 1);
    const newPos = this.getPosition(textarea, state.cursor.line, newColumn);
    textarea.setSelectionRange(newPos, newPos);

    return {
      ...state,
      cursor: { ...state.cursor, column: newColumn },
    };
  }

  private moveToFirstNonBlank(state: VimState, textarea: HTMLTextAreaElement): VimState {
    const lines = textarea.value.split('\n');
    const line = lines[state.cursor.line - 1] || '';
    const match = line.match(/^\s*/);
    const newColumn = (match ? match[0].length : 0) + 1;
    const newPos = this.getPosition(textarea, state.cursor.line, newColumn);
    textarea.setSelectionRange(newPos, newPos);

    return {
      ...state,
      cursor: { ...state.cursor, column: newColumn },
    };
  }

  private moveWordForward(state: VimState, textarea: HTMLTextAreaElement): VimState {
    const value = textarea.value;
    const pos = this.getPosition(textarea, state.cursor.line, state.cursor.column);

    // Find next word boundary
    const remaining = value.substring(pos);
    const match = remaining.match(/^\w*\s*/);
    const offset = match ? match[0].length : 1;
    const newPos = Math.min(pos + offset, value.length);

    textarea.setSelectionRange(newPos, newPos);
    const { line, column } = this.getLineColumn(textarea, newPos);

    return {
      ...state,
      cursor: { line, column },
    };
  }

  private moveWordBackward(state: VimState, textarea: HTMLTextAreaElement): VimState {
    const value = textarea.value;
    const pos = this.getPosition(textarea, state.cursor.line, state.cursor.column);

    // Find previous word boundary
    const before = value.substring(0, pos);
    const match = before.match(/\s*\w*$/);
    const offset = match ? match[0].length : 1;
    const newPos = Math.max(pos - offset, 0);

    textarea.setSelectionRange(newPos, newPos);
    const { line, column } = this.getLineColumn(textarea, newPos);

    return {
      ...state,
      cursor: { line, column },
    };
  }

  private moveToWordEnd(state: VimState, textarea: HTMLTextAreaElement): VimState {
    const value = textarea.value;
    const pos = this.getPosition(textarea, state.cursor.line, state.cursor.column);

    // Skip current word and find end of next word
    const remaining = value.substring(pos + 1);
    const match = remaining.match(/^\s*\w*/);
    const offset = (match ? match[0].length : 0) + 1;
    const newPos = Math.min(pos + offset, value.length);

    textarea.setSelectionRange(newPos, newPos);
    const { line, column } = this.getLineColumn(textarea, newPos);

    return {
      ...state,
      cursor: { line, column },
    };
  }

  private moveToTop(state: VimState, textarea: HTMLTextAreaElement): VimState {
    textarea.setSelectionRange(0, 0);
    return {
      ...state,
      cursor: { line: 1, column: 1 },
    };
  }

  private moveToBottom(state: VimState, textarea: HTMLTextAreaElement): VimState {
    const lines = textarea.value.split('\n');
    const lastLine = lines.length;
    const lastColumn = (lines[lastLine - 1]?.length || 0) + 1;
    const pos = textarea.value.length;

    textarea.setSelectionRange(pos, pos);
    return {
      ...state,
      cursor: { line: lastLine, column: lastColumn },
    };
  }

  // ========================================================================
  // EDIT HELPERS
  // ========================================================================

  private insertLineBelow(state: VimState, textarea: HTMLTextAreaElement): VimState {
    const lines = textarea.value.split('\n');
    const currentLine = state.cursor.line - 1;
    lines.splice(currentLine + 1, 0, '');
    textarea.value = lines.join('\n');

    const newLine = state.cursor.line + 1;
    const newPos = this.getPosition(textarea, newLine, 1);
    textarea.setSelectionRange(newPos, newPos);

    textarea.dispatchEvent(new Event('input', { bubbles: true }));

    return {
      ...state,
      mode: 'insert',
      cursor: { line: newLine, column: 1 },
    };
  }

  private insertLineAbove(state: VimState, textarea: HTMLTextAreaElement): VimState {
    const lines = textarea.value.split('\n');
    const currentLine = state.cursor.line - 1;
    lines.splice(currentLine, 0, '');
    textarea.value = lines.join('\n');

    const newPos = this.getPosition(textarea, state.cursor.line, 1);
    textarea.setSelectionRange(newPos, newPos);

    textarea.dispatchEvent(new Event('input', { bubbles: true }));

    return {
      ...state,
      mode: 'insert',
      cursor: { ...state.cursor, column: 1 },
    };
  }

  private deleteChar(state: VimState, textarea: HTMLTextAreaElement): VimState {
    const pos = this.getPosition(textarea, state.cursor.line, state.cursor.column);
    const value = textarea.value;

    if (pos < value.length) {
      textarea.value = value.substring(0, pos) + value.substring(pos + 1);
      textarea.setSelectionRange(pos, pos);
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }

    return state;
  }

  private deleteLine(state: VimState, textarea: HTMLTextAreaElement): VimState {
    const lines = textarea.value.split('\n');
    const currentLine = state.cursor.line - 1;

    // Store deleted line in register
    const deletedLine = lines[currentLine];
    lines.splice(currentLine, 1);

    // Ensure at least one empty line
    if (lines.length === 0) {
      lines.push('');
    }

    textarea.value = lines.join('\n');

    // Adjust cursor
    const newLine = Math.min(state.cursor.line, lines.length);
    const newPos = this.getPosition(textarea, newLine, 1);
    textarea.setSelectionRange(newPos, newPos);

    textarea.dispatchEvent(new Event('input', { bubbles: true }));

    return {
      ...state,
      register: deletedLine + '\n',
      cursor: { line: newLine, column: 1 },
    };
  }

  private yankLine(state: VimState, textarea: HTMLTextAreaElement): VimState {
    const lines = textarea.value.split('\n');
    const currentLine = state.cursor.line - 1;
    const yankedLine = lines[currentLine] + '\n';

    return {
      ...state,
      register: yankedLine,
    };
  }

  private paste(state: VimState, textarea: HTMLTextAreaElement): VimState {
    if (!state.register) return state;

    const pos = this.getPosition(textarea, state.cursor.line, state.cursor.column);
    const value = textarea.value;

    // If register ends with newline, paste on new line
    if (state.register.endsWith('\n')) {
      const lines = value.split('\n');
      const currentLine = state.cursor.line;
      lines.splice(currentLine, 0, state.register.slice(0, -1));
      textarea.value = lines.join('\n');

      const newPos = this.getPosition(textarea, currentLine + 1, 1);
      textarea.setSelectionRange(newPos, newPos);

      textarea.dispatchEvent(new Event('input', { bubbles: true }));

      return {
        ...state,
        cursor: { line: currentLine + 1, column: 1 },
      };
    } else {
      // Paste inline
      textarea.value = value.substring(0, pos + 1) + state.register + value.substring(pos + 1);
      const newPos = pos + 1 + state.register.length;
      textarea.setSelectionRange(newPos, newPos);

      textarea.dispatchEvent(new Event('input', { bubbles: true }));

      const { line, column } = this.getLineColumn(textarea, newPos);
      return {
        ...state,
        cursor: { line, column },
      };
    }
  }

  private pasteBefore(state: VimState, textarea: HTMLTextAreaElement): VimState {
    if (!state.register) return state;

    const pos = this.getPosition(textarea, state.cursor.line, state.cursor.column);
    const value = textarea.value;

    // If register ends with newline, paste on line above
    if (state.register.endsWith('\n')) {
      const lines = value.split('\n');
      const currentLine = state.cursor.line - 1;
      lines.splice(currentLine, 0, state.register.slice(0, -1));
      textarea.value = lines.join('\n');

      const newPos = this.getPosition(textarea, state.cursor.line, 1);
      textarea.setSelectionRange(newPos, newPos);

      textarea.dispatchEvent(new Event('input', { bubbles: true }));

      return {
        ...state,
        cursor: { ...state.cursor, column: 1 },
      };
    } else {
      // Paste inline before cursor
      textarea.value = value.substring(0, pos) + state.register + value.substring(pos);
      const newPos = pos + state.register.length;
      textarea.setSelectionRange(newPos, newPos);

      textarea.dispatchEvent(new Event('input', { bubbles: true }));

      const { line, column } = this.getLineColumn(textarea, newPos);
      return {
        ...state,
        cursor: { line, column },
      };
    }
  }

  // ========================================================================
  // UTILITY HELPERS
  // ========================================================================

  private getPosition(textarea: HTMLTextAreaElement, line: number, column: number): number {
    const lines = textarea.value.split('\n');
    let pos = 0;

    for (let i = 0; i < line - 1 && i < lines.length; i++) {
      pos += lines[i].length + 1; // +1 for newline
    }

    pos += Math.min(column - 1, lines[line - 1]?.length || 0);
    return pos;
  }

  private getLineColumn(
    textarea: HTMLTextAreaElement,
    position: number
  ): { line: number; column: number } {
    const value = textarea.value.substring(0, position);
    const lines = value.split('\n');
    const line = lines.length;
    const column = lines[lines.length - 1].length + 1;
    return { line, column };
  }

  private getKeyString(e: KeyboardEvent): string {
    let key = e.key;

    if (e.ctrlKey) key = `Ctrl-${key}`;
    if (e.altKey) key = `Alt-${key}`;
    if (e.metaKey) key = `Meta-${key}`;

    return key;
  }

  private isVimControlKey(key: string): boolean {
    return ['Escape', 'Ctrl-c'].includes(key);
  }

  private notifyStateChange(): void {
    if (this.onStateChange) {
      this.onStateChange(this.state);
    }
  }

  /**
   * Get mode indicator for status bar
   */
  getModeIndicator(): string {
    const indicators: Record<VimMode, string> = {
      normal: '-- NORMAL --',
      insert: '-- INSERT --',
      visual: '-- VISUAL --',
      'visual-line': '-- VISUAL LINE --',
      command: this.state.commandBuffer,
    };
    return indicators[this.state.mode];
  }

  /**
   * Get all key bindings for help display
   */
  getKeyBindings(): Array<{ key: string; mode: string; description: string }> {
    return this.handlers.map((h) => ({
      key: typeof h.key === 'string' ? h.key : h.key.toString(),
      mode: h.modes.join(', '),
      description: h.description,
    }));
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let vimManagerInstance: VimModeManager | null = null;

/**
 * Get the singleton vim mode manager
 */
export function getVimManager(): VimModeManager {
  if (!vimManagerInstance) {
    vimManagerInstance = new VimModeManager();
  }
  return vimManagerInstance;
}

/**
 * Reset the vim mode manager
 */
export function resetVimManager(): void {
  if (vimManagerInstance) {
    vimManagerInstance.disable();
  }
  vimManagerInstance = null;
}
