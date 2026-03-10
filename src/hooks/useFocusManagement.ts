/**
 * FOCUS MANAGEMENT HOOKS - LOW-008 FIX
 *
 * Provides accessibility-focused utilities for:
 * - Focus trapping in modals/dialogs
 * - Focus restoration after modal close
 * - Focus on mount for dynamic content
 * - Focus ring management
 * - Keyboard navigation support
 */

import { useEffect, useRef, useCallback, useState } from 'react';

// ============================================================================
// TYPES
// ============================================================================

type FocusableElement =
  | HTMLButtonElement
  | HTMLAnchorElement
  | HTMLInputElement
  | HTMLSelectElement
  | HTMLTextAreaElement
  | HTMLElement;

// ============================================================================
// CONSTANTS
// ============================================================================

const FOCUSABLE_SELECTORS = [
  'button:not([disabled]):not([aria-hidden="true"])',
  'a[href]:not([aria-hidden="true"])',
  'input:not([disabled]):not([type="hidden"]):not([aria-hidden="true"])',
  'select:not([disabled]):not([aria-hidden="true"])',
  'textarea:not([disabled]):not([aria-hidden="true"])',
  '[tabindex]:not([tabindex="-1"]):not([aria-hidden="true"])',
  '[contenteditable="true"]:not([aria-hidden="true"])',
].join(', ');

// ============================================================================
// USE FOCUS TRAP
// ============================================================================

/**
 * Trap focus within a container (for modals, dialogs, etc.)
 *
 * @example
 * ```tsx
 * function Modal({ isOpen, onClose, children }) {
 *   const containerRef = useFocusTrap(isOpen);
 *
 *   if (!isOpen) return null;
 *
 *   return (
 *     <div ref={containerRef} role="dialog" aria-modal="true">
 *       {children}
 *       <button onClick={onClose}>Close</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useFocusTrap<T extends HTMLElement = HTMLDivElement>(
  isActive: boolean = true
): React.RefObject<T | null> {
  const containerRef = useRef<T | null>(null);
  const previousActiveElement = useRef<Element | null>(null);

  useEffect(() => {
    if (!isActive) return;

    // Store the currently focused element
    previousActiveElement.current = document.activeElement;

    const container = containerRef.current;
    if (!container) return;

    // Focus the first focusable element or the container itself
    const focusableElements = container.querySelectorAll<FocusableElement>(FOCUSABLE_SELECTORS);
    const firstFocusable = focusableElements[0];

    if (firstFocusable) {
      // Delay to ensure DOM is ready
      requestAnimationFrame(() => {
        firstFocusable.focus();
      });
    } else {
      // Make container focusable and focus it
      container.setAttribute('tabindex', '-1');
      container.focus();
    }

    // Handle keyboard navigation
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;

      const focusables = container.querySelectorAll<FocusableElement>(FOCUSABLE_SELECTORS);
      const firstFocusable = focusables[0];
      const lastFocusable = focusables[focusables.length - 1];

      if (!firstFocusable || !lastFocusable) return;

      // Shift + Tab on first element -> focus last
      if (event.shiftKey && document.activeElement === firstFocusable) {
        event.preventDefault();
        lastFocusable.focus();
      }
      // Tab on last element -> focus first
      else if (!event.shiftKey && document.activeElement === lastFocusable) {
        event.preventDefault();
        firstFocusable.focus();
      }
    };

    container.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('keydown', handleKeyDown);

      // Restore focus to previous element
      if (previousActiveElement.current instanceof HTMLElement) {
        previousActiveElement.current.focus();
      }
    };
  }, [isActive]);

  return containerRef;
}

// ============================================================================
// USE FOCUS ON MOUNT
// ============================================================================

/**
 * Focus an element when component mounts
 *
 * @example
 * ```tsx
 * function SearchModal() {
 *   const inputRef = useFocusOnMount<HTMLInputElement>();
 *
 *   return <input ref={inputRef} placeholder="Search..." />;
 * }
 * ```
 */
export function useFocusOnMount<T extends HTMLElement = HTMLElement>(
  options: { delay?: number; preventScroll?: boolean } = {}
): React.RefObject<T | null> {
  const ref = useRef<T | null>(null);
  const { delay = 0, preventScroll = false } = options;

  useEffect(() => {
    const timer = setTimeout(() => {
      ref.current?.focus({ preventScroll });
    }, delay);

    return () => clearTimeout(timer);
  }, [delay, preventScroll]);

  return ref;
}

// ============================================================================
// USE FOCUS RESTORATION
// ============================================================================

/**
 * Restore focus to a previous element when component unmounts
 *
 * @example
 * ```tsx
 * function TemporaryPanel({ onClose }) {
 *   useFocusRestoration();
 *
 *   return (
 *     <div>
 *       <button onClick={onClose}>Close</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useFocusRestoration(): void {
  const previousElement = useRef<Element | null>(null);

  useEffect(() => {
    previousElement.current = document.activeElement;

    return () => {
      if (previousElement.current instanceof HTMLElement) {
        // Delay to ensure DOM is stable
        requestAnimationFrame(() => {
          (previousElement.current as HTMLElement).focus();
        });
      }
    };
  }, []);
}

// ============================================================================
// USE ROVING TABINDEX
// ============================================================================

/**
 * Implement roving tabindex pattern for lists/grids
 * Only one item is tabbable at a time, arrow keys move focus
 *
 * @example
 * ```tsx
 * function Toolbar() {
 *   const { getRovingProps, focusedIndex } = useRovingTabindex(items.length);
 *
 *   return (
 *     <div role="toolbar">
 *       {items.map((item, index) => (
 *         <button key={item.id} {...getRovingProps(index)}>
 *           {item.label}
 *         </button>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useRovingTabindex(itemCount: number, options: { wrap?: boolean } = {}) {
  const { wrap = true } = options;
  const [focusedIndex, setFocusedIndex] = useState(0);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);

  const focusItem = useCallback(
    (index: number) => {
      let newIndex = index;

      if (wrap) {
        if (newIndex < 0) newIndex = itemCount - 1;
        if (newIndex >= itemCount) newIndex = 0;
      } else {
        newIndex = Math.max(0, Math.min(itemCount - 1, newIndex));
      }

      setFocusedIndex(newIndex);
      itemRefs.current[newIndex]?.focus();
    },
    [itemCount, wrap]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent, index: number) => {
      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          event.preventDefault();
          focusItem(index + 1);
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          event.preventDefault();
          focusItem(index - 1);
          break;
        case 'Home':
          event.preventDefault();
          focusItem(0);
          break;
        case 'End':
          event.preventDefault();
          focusItem(itemCount - 1);
          break;
      }
    },
    [focusItem, itemCount]
  );

  const getRovingProps = useCallback(
    (index: number) => ({
      ref: (el: HTMLElement | null) => {
        itemRefs.current[index] = el;
      },
      tabIndex: index === focusedIndex ? 0 : -1,
      onKeyDown: (e: React.KeyboardEvent) => handleKeyDown(e, index),
      onFocus: () => setFocusedIndex(index),
    }),
    [focusedIndex, handleKeyDown]
  );

  return {
    focusedIndex,
    setFocusedIndex: focusItem,
    getRovingProps,
  };
}

// ============================================================================
// USE FOCUS VISIBLE
// ============================================================================

/**
 * Detect if focus should be visible (keyboard navigation vs mouse click)
 * Helps implement :focus-visible polyfill behavior
 *
 * @example
 * ```tsx
 * function Button({ children }) {
 *   const { isFocusVisible, focusProps } = useFocusVisible();
 *
 *   return (
 *     <button
 *       {...focusProps}
 *       className={isFocusVisible ? 'focus-ring' : ''}
 *     >
 *       {children}
 *     </button>
 *   );
 * }
 * ```
 */
export function useFocusVisible(): {
  isFocusVisible: boolean;
  focusProps: {
    onFocus: () => void;
    onBlur: () => void;
    onMouseDown: () => void;
    onKeyDown: () => void;
  };
} {
  const [isFocusVisible, setIsFocusVisible] = useState(false);
  const hadKeyboardEvent = useRef(false);

  const focusProps = {
    onFocus: () => {
      if (hadKeyboardEvent.current) {
        setIsFocusVisible(true);
      }
    },
    onBlur: () => {
      setIsFocusVisible(false);
    },
    onMouseDown: () => {
      hadKeyboardEvent.current = false;
    },
    onKeyDown: () => {
      hadKeyboardEvent.current = true;
    },
  };

  // Track keyboard usage globally
  useEffect(() => {
    const handleKeyDown = () => {
      hadKeyboardEvent.current = true;
    };

    const handleMouseDown = () => {
      hadKeyboardEvent.current = false;
    };

    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('mousedown', handleMouseDown, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('mousedown', handleMouseDown, true);
    };
  }, []);

  return { isFocusVisible, focusProps };
}

// ============================================================================
// USE ESCAPE KEY
// ============================================================================

/**
 * Handle Escape key press (for closing modals, etc.)
 *
 * @example
 * ```tsx
 * function Modal({ isOpen, onClose }) {
 *   useEscapeKey(onClose, isOpen);
 *
 *   return isOpen ? <div>Modal Content</div> : null;
 * }
 * ```
 */
export function useEscapeKey(callback: () => void, isActive: boolean = true): void {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        callbackRef.current();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isActive]);
}

// ============================================================================
// EXPORTS
// ============================================================================

const FocusManagementHooks = {
  useFocusTrap,
  useFocusOnMount,
  useFocusRestoration,
  useRovingTabindex,
  useFocusVisible,
  useEscapeKey,
};

export default FocusManagementHooks;
