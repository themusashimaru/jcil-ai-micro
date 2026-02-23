/**
 * Tests for useTerminalState hook and createTerminalLine utility.
 *
 * Covers:
 * - createTerminalLine: type, content, unique IDs, timestamp generation
 * - useTerminalState: initial state, addLine, addCommand, addOutput,
 *   addInfo, addSuccess, addError, clear, setIsRunning, accumulation
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createTerminalLine, useTerminalState } from './useTerminalState';

// ============================================================================
// createTerminalLine
// ============================================================================

describe('createTerminalLine', () => {
  it('creates a line with the correct type', () => {
    const line = createTerminalLine('command', 'ls -la');
    expect(line.type).toBe('command');
  });

  it('creates a line with the correct content', () => {
    const line = createTerminalLine('stdout', 'hello world');
    expect(line.content).toBe('hello world');
  });

  it('generates a unique ID starting with "line-"', () => {
    const line = createTerminalLine('info', 'test');
    expect(line.id).toMatch(/^line-/);
  });

  it('generates a Date timestamp', () => {
    const line = createTerminalLine('error', 'fail');
    expect(line.timestamp).toBeInstanceOf(Date);
  });

  it('produces different IDs on separate calls', () => {
    const a = createTerminalLine('stdout', 'first');
    const b = createTerminalLine('stdout', 'second');
    expect(a.id).not.toBe(b.id);
  });
});

// ============================================================================
// useTerminalState
// ============================================================================

describe('useTerminalState', () => {
  it('starts with empty lines and isRunning=false', () => {
    const { result } = renderHook(() => useTerminalState());
    expect(result.current.lines).toEqual([]);
    expect(result.current.isRunning).toBe(false);
  });

  it('addLine adds a line with the correct type and content', () => {
    const { result } = renderHook(() => useTerminalState());
    act(() => {
      result.current.addLine('system', 'booting');
    });
    expect(result.current.lines).toHaveLength(1);
    expect(result.current.lines[0].type).toBe('system');
    expect(result.current.lines[0].content).toBe('booting');
  });

  it('addCommand adds a "command" type line', () => {
    const { result } = renderHook(() => useTerminalState());
    act(() => {
      result.current.addCommand('npm install');
    });
    expect(result.current.lines).toHaveLength(1);
    expect(result.current.lines[0].type).toBe('command');
    expect(result.current.lines[0].content).toBe('npm install');
  });

  it('addOutput adds a "stdout" line by default', () => {
    const { result } = renderHook(() => useTerminalState());
    act(() => {
      result.current.addOutput('data received');
    });
    expect(result.current.lines).toHaveLength(1);
    expect(result.current.lines[0].type).toBe('stdout');
    expect(result.current.lines[0].content).toBe('data received');
  });

  it('addOutput adds a "stderr" line when isError=true', () => {
    const { result } = renderHook(() => useTerminalState());
    act(() => {
      result.current.addOutput('something went wrong', true);
    });
    expect(result.current.lines).toHaveLength(1);
    expect(result.current.lines[0].type).toBe('stderr');
    expect(result.current.lines[0].content).toBe('something went wrong');
  });

  it('addInfo adds an "info" type line', () => {
    const { result } = renderHook(() => useTerminalState());
    act(() => {
      result.current.addInfo('connecting...');
    });
    expect(result.current.lines).toHaveLength(1);
    expect(result.current.lines[0].type).toBe('info');
    expect(result.current.lines[0].content).toBe('connecting...');
  });

  it('addSuccess adds a "success" type line', () => {
    const { result } = renderHook(() => useTerminalState());
    act(() => {
      result.current.addSuccess('done!');
    });
    expect(result.current.lines).toHaveLength(1);
    expect(result.current.lines[0].type).toBe('success');
    expect(result.current.lines[0].content).toBe('done!');
  });

  it('addError adds an "error" type line', () => {
    const { result } = renderHook(() => useTerminalState());
    act(() => {
      result.current.addError('fatal crash');
    });
    expect(result.current.lines).toHaveLength(1);
    expect(result.current.lines[0].type).toBe('error');
    expect(result.current.lines[0].content).toBe('fatal crash');
  });

  it('clear empties the lines array', () => {
    const { result } = renderHook(() => useTerminalState());
    act(() => {
      result.current.addLine('stdout', 'one');
      result.current.addLine('stdout', 'two');
    });
    expect(result.current.lines).toHaveLength(2);
    act(() => {
      result.current.clear();
    });
    expect(result.current.lines).toEqual([]);
  });

  it('setIsRunning changes running state', () => {
    const { result } = renderHook(() => useTerminalState());
    expect(result.current.isRunning).toBe(false);
    act(() => {
      result.current.setIsRunning(true);
    });
    expect(result.current.isRunning).toBe(true);
    act(() => {
      result.current.setIsRunning(false);
    });
    expect(result.current.isRunning).toBe(false);
  });

  it('multiple addLine calls accumulate lines in order', () => {
    const { result } = renderHook(() => useTerminalState());
    act(() => {
      result.current.addCommand('echo hi');
      result.current.addOutput('hi');
      result.current.addSuccess('exited with 0');
    });
    expect(result.current.lines).toHaveLength(3);
    expect(result.current.lines[0].type).toBe('command');
    expect(result.current.lines[1].type).toBe('stdout');
    expect(result.current.lines[2].type).toBe('success');
  });

  it('clear after multiple adds empties all lines', () => {
    const { result } = renderHook(() => useTerminalState());
    act(() => {
      result.current.addInfo('a');
      result.current.addError('b');
      result.current.addOutput('c');
      result.current.addCommand('d');
      result.current.addSuccess('e');
    });
    expect(result.current.lines).toHaveLength(5);
    act(() => {
      result.current.clear();
    });
    expect(result.current.lines).toHaveLength(0);
    expect(result.current.lines).toEqual([]);
  });
});
