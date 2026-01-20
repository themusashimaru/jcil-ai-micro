/**
 * USE DEBOUNCE HOOK - MEDIUM-010 FIX
 *
 * Provides debounced values and callbacks for search inputs and
 * other rapid-fire user interactions.
 *
 * Features:
 * - Configurable delay (default: 300ms from UI constants)
 * - Immediate mode option for instant first call
 * - Cleanup on unmount
 * - Type-safe generics
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { UI } from '@/lib/constants';

// ============================================================================
// USE DEBOUNCE VALUE
// ============================================================================

/**
 * Returns a debounced version of the provided value
 *
 * @example
 * const [search, setSearch] = useState('');
 * const debouncedSearch = useDebounceValue(search, 300);
 *
 * useEffect(() => {
 *   if (debouncedSearch) {
 *     performSearch(debouncedSearch);
 *   }
 * }, [debouncedSearch]);
 */
export function useDebounceValue<T>(value: T, delay: number = UI.SEARCH_DEBOUNCE): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

// ============================================================================
// USE DEBOUNCE CALLBACK
// ============================================================================

/**
 * Returns a debounced version of the provided callback
 *
 * @example
 * const handleSearch = useDebounceCallback((query: string) => {
 *   performSearch(query);
 * }, 300);
 *
 * <input onChange={(e) => handleSearch(e.target.value)} />
 */
export function useDebounceCallback<T extends (...args: Parameters<T>) => void>(
  callback: T,
  delay: number = UI.SEARCH_DEBOUNCE
): T {
  const callbackRef = useRef(callback);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Keep callback ref updated
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    },
    [delay]
  ) as T;

  return debouncedCallback;
}

// ============================================================================
// USE DEBOUNCE WITH LEADING EDGE
// ============================================================================

/**
 * Returns a debounced callback that fires immediately on first call,
 * then debounces subsequent calls
 *
 * @example
 * const handleClick = useDebounceLeading((id: string) => {
 *   processClick(id);
 * }, 1000);
 */
export function useDebounceLeading<T extends (...args: Parameters<T>) => void>(
  callback: T,
  delay: number = UI.SEARCH_DEBOUNCE
): T {
  const callbackRef = useRef(callback);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const canCallRef = useRef(true);

  // Keep callback ref updated
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      if (canCallRef.current) {
        canCallRef.current = false;
        callbackRef.current(...args);
      }

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        canCallRef.current = true;
      }, delay);
    },
    [delay]
  ) as T;

  return debouncedCallback;
}

// ============================================================================
// USE THROTTLE
// ============================================================================

/**
 * Returns a throttled callback that fires at most once per delay period
 *
 * @example
 * const handleScroll = useThrottle((e: Event) => {
 *   updateScrollPosition(e);
 * }, 100);
 */
export function useThrottle<T extends (...args: Parameters<T>) => void>(
  callback: T,
  delay: number = 100
): T {
  const callbackRef = useRef(callback);
  const lastCallRef = useRef(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Keep callback ref updated
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const throttledCallback = useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();
      const remaining = delay - (now - lastCallRef.current);

      if (remaining <= 0) {
        lastCallRef.current = now;
        callbackRef.current(...args);
      } else if (!timeoutRef.current) {
        timeoutRef.current = setTimeout(() => {
          lastCallRef.current = Date.now();
          timeoutRef.current = null;
          callbackRef.current(...args);
        }, remaining);
      }
    },
    [delay]
  ) as T;

  return throttledCallback;
}

export default useDebounceValue;
