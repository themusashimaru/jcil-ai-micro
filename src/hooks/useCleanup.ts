/**
 * CLEANUP AND MEMORY SAFETY HOOKS - LOW-007 FIX
 *
 * Provides utilities for safe cleanup of:
 * - Event listeners
 * - Subscriptions
 * - Async operations
 * - Timers and intervals
 *
 * Prevents memory leaks and state updates on unmounted components.
 */

import { useEffect, useRef, useCallback, useState } from 'react';

// ============================================================================
// USE IS MOUNTED
// ============================================================================

/**
 * Track component mount state to prevent state updates after unmount
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const isMounted = useIsMounted();
 *
 *   useEffect(() => {
 *     fetchData().then(data => {
 *       if (isMounted()) {
 *         setData(data);
 *       }
 *     });
 *   }, []);
 * }
 * ```
 */
export function useIsMounted(): () => boolean {
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return useCallback(() => isMountedRef.current, []);
}

// ============================================================================
// USE SAFE STATE
// ============================================================================

/**
 * A useState wrapper that only updates state if component is mounted
 * Prevents "Can't perform a React state update on an unmounted component" warnings
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const [data, setData] = useSafeState<DataType | null>(null);
 *
 *   useEffect(() => {
 *     fetchData().then(setData); // Safe even if component unmounts
 *   }, []);
 * }
 * ```
 */
export function useSafeState<T>(initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const isMounted = useIsMounted();
  const [state, setState] = useState<T>(initialValue);

  const setSafeState = useCallback(
    (value: T | ((prev: T) => T)) => {
      if (isMounted()) {
        setState(value);
      }
    },
    [isMounted]
  );

  return [state, setSafeState];
}

// ============================================================================
// USE CLEANUP
// ============================================================================

type CleanupFn = () => void;

/**
 * Register cleanup functions that will be called on unmount
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const registerCleanup = useCleanup();
 *
 *   useEffect(() => {
 *     const subscription = someEvent.subscribe(handler);
 *     registerCleanup(() => subscription.unsubscribe());
 *
 *     const timer = setInterval(tick, 1000);
 *     registerCleanup(() => clearInterval(timer));
 *   }, []);
 * }
 * ```
 */
export function useCleanup(): (cleanup: CleanupFn) => void {
  const cleanupFns = useRef<CleanupFn[]>([]);

  useEffect(() => {
    return () => {
      cleanupFns.current.forEach((fn) => {
        try {
          fn();
        } catch (error) {
          console.error('[useCleanup] Cleanup function error:', error);
        }
      });
      cleanupFns.current = [];
    };
  }, []);

  return useCallback((cleanup: CleanupFn) => {
    cleanupFns.current.push(cleanup);
  }, []);
}

// ============================================================================
// USE EVENT LISTENER
// ============================================================================

/**
 * Safely attach event listeners with automatic cleanup
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   useEventListener('resize', handleResize);
 *   useEventListener('keydown', handleKeydown, { target: document });
 * }
 * ```
 */
export function useEventListener<K extends keyof WindowEventMap>(
  eventName: K,
  handler: (event: WindowEventMap[K]) => void,
  options?: {
    target?: Window | Document | HTMLElement | null;
    capture?: boolean;
    passive?: boolean;
  }
): void {
  const savedHandler = useRef(handler);

  // Update ref when handler changes
  useEffect(() => {
    savedHandler.current = handler;
  }, [handler]);

  useEffect(() => {
    const target = options?.target ?? window;
    if (!target?.addEventListener) return;

    const eventListener = (event: Event) => {
      savedHandler.current(event as WindowEventMap[K]);
    };

    const eventOptions = {
      capture: options?.capture,
      passive: options?.passive,
    };

    target.addEventListener(eventName, eventListener, eventOptions);

    return () => {
      target.removeEventListener(eventName, eventListener, eventOptions);
    };
  }, [eventName, options?.target, options?.capture, options?.passive]);
}

// ============================================================================
// USE INTERVAL
// ============================================================================

/**
 * Safe interval hook with automatic cleanup
 *
 * @example
 * ```tsx
 * function Timer() {
 *   const [count, setCount] = useState(0);
 *
 *   useInterval(() => {
 *     setCount(c => c + 1);
 *   }, 1000);
 * }
 * ```
 */
export function useInterval(callback: () => void, delay: number | null): void {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === null) return;

    const id = setInterval(() => savedCallback.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}

// ============================================================================
// USE TIMEOUT
// ============================================================================

/**
 * Safe timeout hook with automatic cleanup
 *
 * @example
 * ```tsx
 * function Delayed() {
 *   const [visible, setVisible] = useState(false);
 *
 *   useTimeout(() => {
 *     setVisible(true);
 *   }, 2000);
 * }
 * ```
 */
export function useTimeout(callback: () => void, delay: number | null): void {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === null) return;

    const id = setTimeout(() => savedCallback.current(), delay);
    return () => clearTimeout(id);
  }, [delay]);
}

// ============================================================================
// USE ABORT CONTROLLER
// ============================================================================

/**
 * Provides an AbortController that automatically aborts on unmount
 * Useful for cancelling fetch requests
 *
 * @example
 * ```tsx
 * function DataFetcher() {
 *   const getSignal = useAbortController();
 *
 *   useEffect(() => {
 *     fetch('/api/data', { signal: getSignal() })
 *       .then(res => res.json())
 *       .then(setData)
 *       .catch(err => {
 *         if (err.name !== 'AbortError') {
 *           setError(err);
 *         }
 *       });
 *   }, []);
 * }
 * ```
 */
export function useAbortController(): () => AbortSignal {
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
    };
  }, []);

  return useCallback(() => {
    // Abort previous controller if exists
    controllerRef.current?.abort();
    // Create new controller
    controllerRef.current = new AbortController();
    return controllerRef.current.signal;
  }, []);
}

// ============================================================================
// USE SUBSCRIPTION
// ============================================================================

interface Subscription {
  unsubscribe: () => void;
}

type SubscribeFn<T> = (callback: (value: T) => void) => Subscription;

/**
 * Manage subscriptions with automatic cleanup
 *
 * @example
 * ```tsx
 * function RealtimeData() {
 *   const [data, setData] = useState(null);
 *
 *   useSubscription(
 *     (callback) => dataStream.subscribe(callback),
 *     (value) => setData(value),
 *     [dataStream]
 *   );
 * }
 * ```
 */
export function useSubscription<T>(
  subscribe: SubscribeFn<T>,
  callback: (value: T) => void,
  deps: React.DependencyList = []
): void {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const subscription = subscribe((value) => {
      callbackRef.current(value);
    });

    return () => {
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

// ============================================================================
// EXPORTS
// ============================================================================

const CleanupHooks = {
  useIsMounted,
  useSafeState,
  useCleanup,
  useEventListener,
  useInterval,
  useTimeout,
  useAbortController,
  useSubscription,
};

export default CleanupHooks;
