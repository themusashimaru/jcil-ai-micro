/**
 * useTerminalState
 *
 * Standalone hook and utility for managing terminal lines outside of the
 * full CodeLabTerminal component. Useful for simpler terminal displays
 * or when you need terminal state without the full UI.
 */

import { useState, useCallback } from 'react';
import { generateLineId } from './terminalAnsiParser';
import type { TerminalLine } from './terminalAnsiParser';

/**
 * Create a new TerminalLine with a unique ID and current timestamp.
 */
export function createTerminalLine(type: TerminalLine['type'], content: string): TerminalLine {
  return {
    id: generateLineId(),
    type,
    content,
    timestamp: new Date(),
  };
}

/**
 * Hook providing terminal line state management.
 * Returns lines, running state, and convenience methods for adding output.
 */
export function useTerminalState() {
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const addLine = useCallback((type: TerminalLine['type'], content: string) => {
    setLines((prev) => [...prev, createTerminalLine(type, content)]);
  }, []);

  const addCommand = useCallback((command: string) => addLine('command', command), [addLine]);
  const addOutput = useCallback(
    (output: string, isError = false) => addLine(isError ? 'stderr' : 'stdout', output),
    [addLine]
  );
  const addInfo = useCallback((info: string) => addLine('info', info), [addLine]);
  const addSuccess = useCallback((message: string) => addLine('success', message), [addLine]);
  const addError = useCallback((error: string) => addLine('error', error), [addLine]);
  const clear = useCallback(() => setLines([]), []);

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
