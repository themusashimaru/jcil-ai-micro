import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useDebounceValue,
  useDebounceCallback,
  useDebounceLeading,
  useThrottle,
} from './useDebounce';

// -------------------------------------------------------------------
// useDebounceValue
// -------------------------------------------------------------------
describe('useDebounceValue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return initial value immediately', () => {
    const { result } = renderHook(() => useDebounceValue('hello', 300));
    expect(result.current).toBe('hello');
  });

  it('should not update until delay has passed', () => {
    const { result, rerender } = renderHook(({ value }) => useDebounceValue(value, 300), {
      initialProps: { value: 'hello' },
    });

    rerender({ value: 'world' });
    expect(result.current).toBe('hello');

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe('hello');
  });

  it('should update after delay', () => {
    const { result, rerender } = renderHook(({ value }) => useDebounceValue(value, 300), {
      initialProps: { value: 'hello' },
    });

    rerender({ value: 'world' });

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toBe('world');
  });

  it('should reset timer on rapid value changes', () => {
    const { result, rerender } = renderHook(({ value }) => useDebounceValue(value, 300), {
      initialProps: { value: 'a' },
    });

    rerender({ value: 'b' });
    act(() => {
      vi.advanceTimersByTime(200);
    });

    rerender({ value: 'c' });
    act(() => {
      vi.advanceTimersByTime(200);
    });

    // Should still be 'a' because timer restarted
    expect(result.current).toBe('a');

    act(() => {
      vi.advanceTimersByTime(100);
    });
    // Now it should be 'c' (300ms after last change)
    expect(result.current).toBe('c');
  });
});

// -------------------------------------------------------------------
// useDebounceCallback
// -------------------------------------------------------------------
describe('useDebounceCallback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return a function', () => {
    const { result } = renderHook(() => useDebounceCallback(() => {}, 300));
    expect(typeof result.current).toBe('function');
  });

  it('should debounce the callback', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebounceCallback(callback, 300));

    act(() => {
      result.current();
      result.current();
      result.current();
    });

    expect(callback).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should pass arguments to the callback', () => {
    const callback = vi.fn();
    const { result } = renderHook(() =>
      useDebounceCallback(callback as (...args: string[]) => void, 300)
    );

    act(() => {
      result.current('test-arg');
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(callback).toHaveBeenCalledWith('test-arg');
  });
});

// -------------------------------------------------------------------
// useDebounceLeading
// -------------------------------------------------------------------
describe('useDebounceLeading', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should fire immediately on first call', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebounceLeading(callback, 300));

    act(() => {
      result.current();
    });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should not fire again within delay window', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebounceLeading(callback, 300));

    act(() => {
      result.current();
      result.current();
      result.current();
    });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should allow firing again after delay expires', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebounceLeading(callback, 300));

    act(() => {
      result.current();
    });
    expect(callback).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(300);
    });

    act(() => {
      result.current();
    });
    expect(callback).toHaveBeenCalledTimes(2);
  });
});

// -------------------------------------------------------------------
// useThrottle
// -------------------------------------------------------------------
describe('useThrottle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should fire immediately on first call', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useThrottle(callback, 100));

    act(() => {
      result.current();
    });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should throttle subsequent calls', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useThrottle(callback, 100));

    act(() => {
      result.current(); // fires immediately
      result.current(); // throttled
      result.current(); // throttled
    });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should fire pending call after throttle period', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useThrottle(callback, 100));

    act(() => {
      result.current(); // fires immediately
      result.current(); // queued
    });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(callback).toHaveBeenCalledTimes(2);
  });
});
