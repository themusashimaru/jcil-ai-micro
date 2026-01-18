/**
 * FOCUS TRAP HOOK
 *
 * Traps keyboard focus within a container element.
 * Essential for modal accessibility (WCAG 2.4.3).
 *
 * Features:
 * - Traps Tab and Shift+Tab navigation
 * - Remembers and restores previous focus
 * - Handles dynamic content changes
 * - Escape key to close (optional)
 */

import { useEffect, useRef, useCallback } from 'react';

interface UseFocusTrapOptions {
  /** Whether the trap is active */
  enabled?: boolean;
  /** Callback when Escape is pressed */
  onEscape?: () => void;
  /** Whether to restore focus on unmount */
  restoreFocus?: boolean;
  /** Initial element to focus (selector or element) */
  initialFocus?: string | HTMLElement | null;
}

// Focusable element selectors
const FOCUSABLE_SELECTORS = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',');

export function useFocusTrap<T extends HTMLElement = HTMLDivElement>(
  options: UseFocusTrapOptions = {}
) {
  const { enabled = true, onEscape, restoreFocus = true, initialFocus } = options;

  const containerRef = useRef<T>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Get all focusable elements within container
  const getFocusableElements = useCallback((): HTMLElement[] => {
    if (!containerRef.current) return [];

    const elements = containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS);
    return Array.from(elements).filter((el) => {
      // Filter out hidden elements
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });
  }, []);

  // Focus the initial element or first focusable
  const focusInitial = useCallback(() => {
    if (!containerRef.current) return;

    let elementToFocus: HTMLElement | null = null;

    if (initialFocus) {
      if (typeof initialFocus === 'string') {
        elementToFocus = containerRef.current.querySelector<HTMLElement>(initialFocus);
      } else {
        elementToFocus = initialFocus;
      }
    }

    if (!elementToFocus) {
      const focusable = getFocusableElements();
      elementToFocus = focusable[0] || containerRef.current;
    }

    // Small delay to ensure DOM is ready
    requestAnimationFrame(() => {
      elementToFocus?.focus();
    });
  }, [getFocusableElements, initialFocus]);

  // Handle keydown events
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled || !containerRef.current) return;

      // Handle Escape
      if (event.key === 'Escape' && onEscape) {
        event.preventDefault();
        onEscape();
        return;
      }

      // Handle Tab
      if (event.key === 'Tab') {
        const focusable = getFocusableElements();
        if (focusable.length === 0) {
          event.preventDefault();
          return;
        }

        const firstElement = focusable[0];
        const lastElement = focusable[focusable.length - 1];
        const activeElement = document.activeElement as HTMLElement;

        // Shift+Tab on first element -> go to last
        if (event.shiftKey && activeElement === firstElement) {
          event.preventDefault();
          lastElement.focus();
          return;
        }

        // Tab on last element -> go to first
        if (!event.shiftKey && activeElement === lastElement) {
          event.preventDefault();
          firstElement.focus();
          return;
        }

        // If focus is outside container, bring it back
        if (!containerRef.current.contains(activeElement)) {
          event.preventDefault();
          if (event.shiftKey) {
            lastElement.focus();
          } else {
            firstElement.focus();
          }
        }
      }
    },
    [enabled, getFocusableElements, onEscape]
  );

  // Set up focus trap
  useEffect(() => {
    if (!enabled) return;

    // Store current focus to restore later
    previousActiveElement.current = document.activeElement as HTMLElement;

    // Focus initial element
    focusInitial();

    // Add event listener
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);

      // Restore focus
      if (restoreFocus && previousActiveElement.current) {
        // Small delay to prevent focus flash
        requestAnimationFrame(() => {
          previousActiveElement.current?.focus();
        });
      }
    };
  }, [enabled, focusInitial, handleKeyDown, restoreFocus]);

  // Handle clicks outside the container (optional)
  const handleClickOutside = useCallback((callback: () => void) => {
    const handler = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        callback();
      }
    };

    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return {
    containerRef,
    handleClickOutside,
    focusInitial,
    getFocusableElements,
  };
}

export default useFocusTrap;
