'use client';

/**
 * ASYNC STATE HOOK
 *
 * HIGH-003: Prevents race conditions in async state updates
 *
 * Features:
 * - Request ID tracking to ignore stale responses
 * - Automatic abort controller management
 * - Loading state management
 * - Error handling
 * - Component unmount cleanup
 */

import { useState, useRef, useCallback, useEffect } from 'react';

// ============================================================================
// TYPES
// ============================================================================

interface AsyncState<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
}

interface UseAsyncStateOptions<T> {
  /** Initial data value */
  initialData?: T | null;
  /** Called when an error occurs */
  onError?: (error: Error) => void;
  /** Called when data is successfully loaded */
  onSuccess?: (data: T) => void;
}

interface UseAsyncStateReturn<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  setData: (data: T | null) => void;
  execute: (asyncFn: (signal: AbortSignal) => Promise<T>, key?: string) => Promise<T | null>;
  cancel: () => void;
  reset: () => void;
}

// ============================================================================
// HOOK
// ============================================================================

/**
 * Hook for managing async state with race condition protection
 *
 * @example
 * const { data, isLoading, execute } = useAsyncState<Message[]>();
 *
 * const loadMessages = useCallback((sessionId: string) => {
 *   execute(async (signal) => {
 *     const res = await fetch(`/api/messages/${sessionId}`, { signal });
 *     return res.json();
 *   }, sessionId); // key ensures only latest request is applied
 * }, [execute]);
 */
export function useAsyncState<T>({
  initialData = null,
  onError,
  onSuccess,
}: UseAsyncStateOptions<T> = {}): UseAsyncStateReturn<T> {
  const [state, setState] = useState<AsyncState<T>>({
    data: initialData,
    isLoading: false,
    error: null,
  });

  // Track request IDs to prevent race conditions
  const requestIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, []);

  const execute = useCallback(
    async (asyncFn: (signal: AbortSignal) => Promise<T>, _key?: string): Promise<T | null> => {
      // Cancel any pending request
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      // Increment request ID for this specific key
      const requestId = ++requestIdRef.current;

      // Set loading state
      if (mountedRef.current) {
        setState((prev) => ({ ...prev, isLoading: true, error: null }));
      }

      try {
        const result = await asyncFn(controller.signal);

        // HIGH-003: Only update state if this is still the latest request
        // and the component is still mounted
        if (mountedRef.current && requestIdRef.current === requestId) {
          setState({
            data: result,
            isLoading: false,
            error: null,
          });
          onSuccess?.(result);
          return result;
        }

        return null;
      } catch (err) {
        // Don't handle abort errors
        if (err instanceof Error && err.name === 'AbortError') {
          return null;
        }

        const error = err instanceof Error ? err : new Error(String(err));

        // Only update state if this is still the latest request
        if (mountedRef.current && requestIdRef.current === requestId) {
          setState({
            data: null,
            isLoading: false,
            error,
          });
          onError?.(error);
        }

        return null;
      }
    },
    [onError, onSuccess]
  );

  const cancel = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    if (mountedRef.current) {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  const reset = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    requestIdRef.current = 0;
    if (mountedRef.current) {
      setState({
        data: initialData,
        isLoading: false,
        error: null,
      });
    }
  }, [initialData]);

  const setData = useCallback((data: T | null) => {
    if (mountedRef.current) {
      setState((prev) => ({ ...prev, data }));
    }
  }, []);

  return {
    data: state.data,
    isLoading: state.isLoading,
    error: state.error,
    setData,
    execute,
    cancel,
    reset,
  };
}

// ============================================================================
// HELPER: useLatestCallback
// ============================================================================

/**
 * Returns a stable callback reference that always calls the latest version
 * Useful for callbacks passed to async operations to avoid stale closures
 */
export function useLatestCallback<T extends (...args: Parameters<T>) => ReturnType<T>>(
  callback: T
): T {
  const callbackRef = useRef(callback);

  // Update ref on each render
  callbackRef.current = callback;

  // Return stable callback that uses the ref
  const stableCallback = useCallback(
    (...args: Parameters<T>) => callbackRef.current(...args),
    []
  ) as T;

  return stableCallback;
}

// ============================================================================
// HELPER: useMountedRef
// ============================================================================

/**
 * Returns a ref that tracks whether the component is mounted
 * Useful for preventing state updates after unmount
 */
export function useMountedRef(): React.MutableRefObject<boolean> {
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return mountedRef;
}

// ============================================================================
// HELPER: usePreviousValue
// ============================================================================

/**
 * Returns the previous value of a variable
 * Useful for detecting changes in async operations
 */
export function usePreviousValue<T>(value: T): T | undefined {
  const ref = useRef<T>();

  useEffect(() => {
    ref.current = value;
  }, [value]);

  return ref.current;
}

export default useAsyncState;
