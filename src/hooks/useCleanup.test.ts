import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useIsMounted,
  useSafeState,
  useCleanup,
  useInterval,
  useTimeout,
  useAbortController,
} from './useCleanup';

// -------------------------------------------------------------------
// useIsMounted
// -------------------------------------------------------------------
describe('useIsMounted', () => {
  it('should return true when mounted', () => {
    const { result } = renderHook(() => useIsMounted());
    expect(result.current()).toBe(true);
  });

  it('should return false after unmount', () => {
    const { result, unmount } = renderHook(() => useIsMounted());
    const isMounted = result.current;
    unmount();
    expect(isMounted()).toBe(false);
  });
});

// -------------------------------------------------------------------
// useSafeState
// -------------------------------------------------------------------
describe('useSafeState', () => {
  it('should behave like useState when mounted', () => {
    const { result } = renderHook(() => useSafeState(0));
    expect(result.current[0]).toBe(0);

    act(() => {
      result.current[1](42);
    });
    expect(result.current[0]).toBe(42);
  });

  it('should accept function updater', () => {
    const { result } = renderHook(() => useSafeState(10));

    act(() => {
      result.current[1]((prev) => prev + 5);
    });
    expect(result.current[0]).toBe(15);
  });

  it('should not throw when setting state after unmount', () => {
    const { result, unmount } = renderHook(() => useSafeState(0));
    const setter = result.current[1];
    unmount();

    // Should not throw even though component is unmounted
    expect(() => setter(99)).not.toThrow();
  });
});

// -------------------------------------------------------------------
// useCleanup
// -------------------------------------------------------------------
describe('useCleanup', () => {
  it('should call registered cleanup functions on unmount', () => {
    const cleanup1 = vi.fn();
    const cleanup2 = vi.fn();

    const { unmount } = renderHook(() => {
      const registerCleanup = useCleanup();
      registerCleanup(cleanup1);
      registerCleanup(cleanup2);
    });

    expect(cleanup1).not.toHaveBeenCalled();
    expect(cleanup2).not.toHaveBeenCalled();

    unmount();

    expect(cleanup1).toHaveBeenCalledTimes(1);
    expect(cleanup2).toHaveBeenCalledTimes(1);
  });

  it('should catch errors in cleanup functions', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const badCleanup = () => {
      throw new Error('cleanup error');
    };
    const goodCleanup = vi.fn();

    const { unmount } = renderHook(() => {
      const registerCleanup = useCleanup();
      registerCleanup(badCleanup);
      registerCleanup(goodCleanup);
    });

    unmount();

    // Both should have been attempted
    expect(goodCleanup).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

// -------------------------------------------------------------------
// useInterval
// -------------------------------------------------------------------
describe('useInterval', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should call callback at regular intervals', () => {
    const callback = vi.fn();
    renderHook(() => useInterval(callback, 1000));

    expect(callback).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(callback).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('should not start interval when delay is null', () => {
    const callback = vi.fn();
    renderHook(() => useInterval(callback, null));

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it('should clear interval on unmount', () => {
    const callback = vi.fn();
    const { unmount } = renderHook(() => useInterval(callback, 1000));

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(callback).toHaveBeenCalledTimes(1);

    unmount();

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    // Should not have been called again
    expect(callback).toHaveBeenCalledTimes(1);
  });
});

// -------------------------------------------------------------------
// useTimeout
// -------------------------------------------------------------------
describe('useTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should call callback after delay', () => {
    const callback = vi.fn();
    renderHook(() => useTimeout(callback, 500));

    expect(callback).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should not call callback when delay is null', () => {
    const callback = vi.fn();
    renderHook(() => useTimeout(callback, null));

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it('should clear timeout on unmount', () => {
    const callback = vi.fn();
    const { unmount } = renderHook(() => useTimeout(callback, 1000));

    unmount();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(callback).not.toHaveBeenCalled();
  });
});

// -------------------------------------------------------------------
// useAbortController
// -------------------------------------------------------------------
describe('useAbortController', () => {
  it('should return a function that creates AbortSignals', () => {
    const { result } = renderHook(() => useAbortController());
    expect(typeof result.current).toBe('function');

    let signal: AbortSignal;
    act(() => {
      signal = result.current();
    });
    expect(signal!).toBeInstanceOf(AbortSignal);
    expect(signal!.aborted).toBe(false);
  });

  it('should abort signal on unmount', () => {
    const { result, unmount } = renderHook(() => useAbortController());

    let signal: AbortSignal;
    act(() => {
      signal = result.current();
    });

    expect(signal!.aborted).toBe(false);
    unmount();
    expect(signal!.aborted).toBe(true);
  });

  it('should abort previous signal when new one is created', () => {
    const { result } = renderHook(() => useAbortController());

    let signal1: AbortSignal;
    let signal2: AbortSignal;

    act(() => {
      signal1 = result.current();
    });

    act(() => {
      signal2 = result.current();
    });

    expect(signal1!.aborted).toBe(true);
    expect(signal2!.aborted).toBe(false);
  });
});
