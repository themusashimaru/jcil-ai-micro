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

export const DEFAULT_THEME: XTermTheme = {
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
