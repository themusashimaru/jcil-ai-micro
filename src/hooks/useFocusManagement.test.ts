// @ts-nocheck - Test file with extensive mocking
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useFocusTrap,
  useFocusOnMount,
  useFocusRestoration,
  useRovingTabindex,
  useFocusVisible,
  useEscapeKey,
} from './useFocusManagement';
import FocusManagementHooks from './useFocusManagement';

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// -------------------------------------------------------------------
// Default export — FocusManagementHooks object
// -------------------------------------------------------------------
describe('FocusManagementHooks default export', () => {
  it('should export all hooks in a single object', () => {
    expect(FocusManagementHooks).toBeDefined();
    expect(typeof FocusManagementHooks).toBe('object');
  });

  it('should contain useFocusTrap', () => {
    expect(FocusManagementHooks.useFocusTrap).toBe(useFocusTrap);
  });

  it('should contain useFocusOnMount', () => {
    expect(FocusManagementHooks.useFocusOnMount).toBe(useFocusOnMount);
  });

  it('should contain useFocusRestoration', () => {
    expect(FocusManagementHooks.useFocusRestoration).toBe(useFocusRestoration);
  });

  it('should contain useRovingTabindex', () => {
    expect(FocusManagementHooks.useRovingTabindex).toBe(useRovingTabindex);
  });

  it('should contain useFocusVisible', () => {
    expect(FocusManagementHooks.useFocusVisible).toBe(useFocusVisible);
  });

  it('should contain useEscapeKey', () => {
    expect(FocusManagementHooks.useEscapeKey).toBe(useEscapeKey);
  });

  it('should have exactly 6 hooks', () => {
    expect(Object.keys(FocusManagementHooks)).toHaveLength(6);
  });
});

// -------------------------------------------------------------------
// useFocusTrap
// -------------------------------------------------------------------
describe('useFocusTrap', () => {
  beforeEach(() => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 0;
    });
  });

  it('should return a ref object', () => {
    const { result } = renderHook(() => useFocusTrap());
    expect(result.current).toBeDefined();
    expect(result.current).toHaveProperty('current');
  });

  it('should return a ref with null initial value', () => {
    const { result } = renderHook(() => useFocusTrap());
    expect(result.current.current).toBeNull();
  });

  it('should accept isActive parameter defaulting to true', () => {
    const { result } = renderHook(() => useFocusTrap(true));
    expect(result.current).toBeDefined();
  });

  it('should accept isActive=false without errors', () => {
    const { result } = renderHook(() => useFocusTrap(false));
    expect(result.current).toBeDefined();
  });

  it('should focus first focusable element when active and container has focusables', () => {
    const container = document.createElement('div');
    const button = document.createElement('button');
    button.textContent = 'Click me';
    container.appendChild(button);
    document.body.appendChild(container);

    const focusSpy = vi.spyOn(button, 'focus');

    const { result } = renderHook(() => useFocusTrap(true));
    // Manually set the ref to the container
    (result.current as { current: HTMLElement | null }).current = container;

    // Re-render to trigger effect with the now-assigned ref
    const { unmount } = renderHook(() => {
      const ref = useFocusTrap(true);
      (ref as { current: HTMLElement | null }).current = container;
      return ref;
    });

    // The effect runs on mount; requestAnimationFrame is mocked to call synchronously
    expect(focusSpy).toHaveBeenCalled();

    unmount();
    document.body.removeChild(container);
  });

  it('should set tabindex on container when no focusable elements exist', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    renderHook(() => {
      const ref = useFocusTrap(true);
      (ref as { current: HTMLElement | null }).current = container;
      return ref;
    });

    expect(container.getAttribute('tabindex')).toBe('-1');
    document.body.removeChild(container);
  });

  it('should restore focus on cleanup when isActive changes', () => {
    const triggerButton = document.createElement('button');
    triggerButton.textContent = 'Trigger';
    document.body.appendChild(triggerButton);
    triggerButton.focus();

    const container = document.createElement('div');
    const innerButton = document.createElement('button');
    innerButton.textContent = 'Inner';
    container.appendChild(innerButton);
    document.body.appendChild(container);

    const restoreSpy = vi.spyOn(triggerButton, 'focus');

    const { unmount } = renderHook(() => {
      const ref = useFocusTrap(true);
      (ref as { current: HTMLElement | null }).current = container;
      return ref;
    });

    unmount();

    expect(restoreSpy).toHaveBeenCalled();

    document.body.removeChild(container);
    document.body.removeChild(triggerButton);
  });

  it('should handle Tab key on last element by wrapping to first', () => {
    const container = document.createElement('div');
    const button1 = document.createElement('button');
    button1.textContent = 'First';
    const button2 = document.createElement('button');
    button2.textContent = 'Last';
    container.appendChild(button1);
    container.appendChild(button2);
    document.body.appendChild(container);

    renderHook(() => {
      const ref = useFocusTrap(true);
      (ref as { current: HTMLElement | null }).current = container;
      return ref;
    });

    // Simulate Tab on last element
    button2.focus();
    const focusSpy = vi.spyOn(button1, 'focus');
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
    Object.defineProperty(event, 'shiftKey', { value: false });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

    container.dispatchEvent(event);

    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(focusSpy).toHaveBeenCalled();

    document.body.removeChild(container);
  });

  it('should handle Shift+Tab on first element by wrapping to last', () => {
    const container = document.createElement('div');
    const button1 = document.createElement('button');
    button1.textContent = 'First';
    const button2 = document.createElement('button');
    button2.textContent = 'Last';
    container.appendChild(button1);
    container.appendChild(button2);
    document.body.appendChild(container);

    renderHook(() => {
      const ref = useFocusTrap(true);
      (ref as { current: HTMLElement | null }).current = container;
      return ref;
    });

    // Focus the first element
    button1.focus();
    const focusSpy = vi.spyOn(button2, 'focus');
    const event = new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      bubbles: true,
    });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

    container.dispatchEvent(event);

    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(focusSpy).toHaveBeenCalled();

    document.body.removeChild(container);
  });

  it('should not prevent default for non-Tab keys', () => {
    const container = document.createElement('div');
    const button1 = document.createElement('button');
    container.appendChild(button1);
    document.body.appendChild(container);

    renderHook(() => {
      const ref = useFocusTrap(true);
      (ref as { current: HTMLElement | null }).current = container;
      return ref;
    });

    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

    container.dispatchEvent(event);

    expect(preventDefaultSpy).not.toHaveBeenCalled();

    document.body.removeChild(container);
  });

  it('should remove keydown listener on cleanup', () => {
    const container = document.createElement('div');
    const button1 = document.createElement('button');
    container.appendChild(button1);
    document.body.appendChild(container);

    const removeListenerSpy = vi.spyOn(container, 'removeEventListener');

    const { unmount } = renderHook(() => {
      const ref = useFocusTrap(true);
      (ref as { current: HTMLElement | null }).current = container;
      return ref;
    });

    unmount();

    expect(removeListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

    document.body.removeChild(container);
  });
});

// -------------------------------------------------------------------
// useFocusOnMount
// -------------------------------------------------------------------
describe('useFocusOnMount', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('should return a ref object', () => {
    const { result } = renderHook(() => useFocusOnMount());
    vi.runAllTimers();
    expect(result.current).toBeDefined();
    expect(result.current).toHaveProperty('current');
  });

  it('should return a ref with null initial value', () => {
    const { result } = renderHook(() => useFocusOnMount());
    vi.runAllTimers();
    expect(result.current.current).toBeNull();
  });

  it('should focus the element on mount with default options', () => {
    const element = document.createElement('input');
    document.body.appendChild(element);
    const focusSpy = vi.spyOn(element, 'focus');

    const { result } = renderHook(() => useFocusOnMount<HTMLInputElement>());
    (result.current as { current: HTMLInputElement | null }).current = element;

    // Re-render to pick up the ref
    const {} = renderHook(() => {
      const ref = useFocusOnMount<HTMLInputElement>();
      (ref as { current: HTMLInputElement | null }).current = element;
      return ref;
    });

    act(() => {
      vi.runAllTimers();
    });

    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: false });

    document.body.removeChild(element);
  });

  it('should accept custom delay option', () => {
    const element = document.createElement('input');
    document.body.appendChild(element);
    const focusSpy = vi.spyOn(element, 'focus');

    renderHook(() => {
      const ref = useFocusOnMount<HTMLInputElement>({ delay: 500 });
      (ref as { current: HTMLInputElement | null }).current = element;
      return ref;
    });

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(focusSpy).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: false });

    document.body.removeChild(element);
  });

  it('should accept preventScroll option', () => {
    const element = document.createElement('input');
    document.body.appendChild(element);
    const focusSpy = vi.spyOn(element, 'focus');

    renderHook(() => {
      const ref = useFocusOnMount<HTMLInputElement>({ preventScroll: true });
      (ref as { current: HTMLInputElement | null }).current = element;
      return ref;
    });

    act(() => {
      vi.runAllTimers();
    });
    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });

    document.body.removeChild(element);
  });

  it('should accept both delay and preventScroll options', () => {
    const element = document.createElement('input');
    document.body.appendChild(element);
    const focusSpy = vi.spyOn(element, 'focus');

    renderHook(() => {
      const ref = useFocusOnMount<HTMLInputElement>({ delay: 100, preventScroll: true });
      (ref as { current: HTMLInputElement | null }).current = element;
      return ref;
    });

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });

    document.body.removeChild(element);
  });

  it('should clear timeout on unmount', () => {
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

    const { unmount } = renderHook(() => useFocusOnMount({ delay: 1000 }));
    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('should handle empty options object', () => {
    const { result } = renderHook(() => useFocusOnMount({}));
    act(() => {
      vi.runAllTimers();
    });
    expect(result.current).toBeDefined();
  });

  it('should not throw when ref.current is null at focus time', () => {
    renderHook(() => useFocusOnMount());
    expect(() => {
      act(() => {
        vi.runAllTimers();
      });
    }).not.toThrow();
  });
});

// -------------------------------------------------------------------
// useFocusRestoration
// -------------------------------------------------------------------
describe('useFocusRestoration', () => {
  beforeEach(() => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 0;
    });
  });

  it('should not throw when mounted', () => {
    expect(() => {
      renderHook(() => useFocusRestoration());
    }).not.toThrow();
  });

  it('should restore focus to previously active element on unmount', () => {
    const button = document.createElement('button');
    button.textContent = 'Previous';
    document.body.appendChild(button);
    button.focus();

    const focusSpy = vi.spyOn(button, 'focus');

    const { unmount } = renderHook(() => useFocusRestoration());

    unmount();

    expect(focusSpy).toHaveBeenCalled();

    document.body.removeChild(button);
  });

  it('should not throw when previous element is not an HTMLElement', () => {
    // When document.activeElement is document.body or null
    const { unmount } = renderHook(() => useFocusRestoration());

    expect(() => unmount()).not.toThrow();
  });

  it('should capture activeElement at mount time', () => {
    const button1 = document.createElement('button');
    const button2 = document.createElement('button');
    document.body.appendChild(button1);
    document.body.appendChild(button2);

    button1.focus();
    const focusSpy1 = vi.spyOn(button1, 'focus');

    const { unmount } = renderHook(() => useFocusRestoration());

    // Even if focus moves to button2 after mount, it should restore to button1
    button2.focus();

    unmount();

    expect(focusSpy1).toHaveBeenCalled();

    document.body.removeChild(button1);
    document.body.removeChild(button2);
  });

  it('should return void', () => {
    const { result } = renderHook(() => useFocusRestoration());
    expect(result.current).toBeUndefined();
  });
});

// -------------------------------------------------------------------
// useRovingTabindex
// -------------------------------------------------------------------
describe('useRovingTabindex', () => {
  it('should return focusedIndex, setFocusedIndex, and getRovingProps', () => {
    const { result } = renderHook(() => useRovingTabindex(3));
    expect(result.current).toHaveProperty('focusedIndex');
    expect(result.current).toHaveProperty('setFocusedIndex');
    expect(result.current).toHaveProperty('getRovingProps');
  });

  it('should initialize focusedIndex to 0', () => {
    const { result } = renderHook(() => useRovingTabindex(5));
    expect(result.current.focusedIndex).toBe(0);
  });

  it('should return getRovingProps as a function', () => {
    const { result } = renderHook(() => useRovingTabindex(3));
    expect(typeof result.current.getRovingProps).toBe('function');
  });

  it('should return setFocusedIndex as a function', () => {
    const { result } = renderHook(() => useRovingTabindex(3));
    expect(typeof result.current.setFocusedIndex).toBe('function');
  });

  describe('getRovingProps', () => {
    it('should return tabIndex 0 for focused item', () => {
      const { result } = renderHook(() => useRovingTabindex(3));
      const props = result.current.getRovingProps(0);
      expect(props.tabIndex).toBe(0);
    });

    it('should return tabIndex -1 for non-focused items', () => {
      const { result } = renderHook(() => useRovingTabindex(3));
      const props = result.current.getRovingProps(1);
      expect(props.tabIndex).toBe(-1);
    });

    it('should include ref callback', () => {
      const { result } = renderHook(() => useRovingTabindex(3));
      const props = result.current.getRovingProps(0);
      expect(typeof props.ref).toBe('function');
    });

    it('should include onKeyDown handler', () => {
      const { result } = renderHook(() => useRovingTabindex(3));
      const props = result.current.getRovingProps(0);
      expect(typeof props.onKeyDown).toBe('function');
    });

    it('should include onFocus handler', () => {
      const { result } = renderHook(() => useRovingTabindex(3));
      const props = result.current.getRovingProps(0);
      expect(typeof props.onFocus).toBe('function');
    });

    it('should update focusedIndex when onFocus fires', () => {
      const { result } = renderHook(() => useRovingTabindex(3));
      const props2 = result.current.getRovingProps(2);

      act(() => {
        props2.onFocus();
      });

      expect(result.current.focusedIndex).toBe(2);
    });

    it('should store element reference via ref callback', () => {
      const { result } = renderHook(() => useRovingTabindex(3));
      const props = result.current.getRovingProps(0);
      const element = document.createElement('button');

      // Should not throw
      expect(() => props.ref(element)).not.toThrow();
    });

    it('should handle ref callback with null', () => {
      const { result } = renderHook(() => useRovingTabindex(3));
      const props = result.current.getRovingProps(0);
      expect(() => props.ref(null)).not.toThrow();
    });
  });

  describe('keyboard navigation with wrap=true (default)', () => {
    it('should move focus forward on ArrowRight', () => {
      const { result } = renderHook(() => useRovingTabindex(3));

      act(() => {
        const props = result.current.getRovingProps(0);
        props.onKeyDown({ key: 'ArrowRight', preventDefault: vi.fn() });
      });

      expect(result.current.focusedIndex).toBe(1);
    });

    it('should move focus forward on ArrowDown', () => {
      const { result } = renderHook(() => useRovingTabindex(3));

      act(() => {
        const props = result.current.getRovingProps(0);
        props.onKeyDown({ key: 'ArrowDown', preventDefault: vi.fn() });
      });

      expect(result.current.focusedIndex).toBe(1);
    });

    it('should move focus backward on ArrowLeft', () => {
      const { result } = renderHook(() => useRovingTabindex(3));

      // First move to index 1
      act(() => {
        result.current.getRovingProps(0).onFocus();
      });
      act(() => {
        result.current.setFocusedIndex(1);
      });

      act(() => {
        const props = result.current.getRovingProps(1);
        props.onKeyDown({ key: 'ArrowLeft', preventDefault: vi.fn() });
      });

      expect(result.current.focusedIndex).toBe(0);
    });

    it('should move focus backward on ArrowUp', () => {
      const { result } = renderHook(() => useRovingTabindex(3));

      act(() => {
        result.current.setFocusedIndex(2);
      });

      act(() => {
        const props = result.current.getRovingProps(2);
        props.onKeyDown({ key: 'ArrowUp', preventDefault: vi.fn() });
      });

      expect(result.current.focusedIndex).toBe(1);
    });

    it('should wrap to last item when going backward from first', () => {
      const { result } = renderHook(() => useRovingTabindex(3));

      act(() => {
        const props = result.current.getRovingProps(0);
        props.onKeyDown({ key: 'ArrowLeft', preventDefault: vi.fn() });
      });

      expect(result.current.focusedIndex).toBe(2);
    });

    it('should wrap to first item when going forward from last', () => {
      const { result } = renderHook(() => useRovingTabindex(3));

      act(() => {
        result.current.setFocusedIndex(2);
      });

      act(() => {
        const props = result.current.getRovingProps(2);
        props.onKeyDown({ key: 'ArrowRight', preventDefault: vi.fn() });
      });

      expect(result.current.focusedIndex).toBe(0);
    });

    it('should jump to first item on Home key', () => {
      const { result } = renderHook(() => useRovingTabindex(5));

      act(() => {
        result.current.setFocusedIndex(3);
      });

      act(() => {
        const props = result.current.getRovingProps(3);
        props.onKeyDown({ key: 'Home', preventDefault: vi.fn() });
      });

      expect(result.current.focusedIndex).toBe(0);
    });

    it('should jump to last item on End key', () => {
      const { result } = renderHook(() => useRovingTabindex(5));

      act(() => {
        const props = result.current.getRovingProps(0);
        props.onKeyDown({ key: 'End', preventDefault: vi.fn() });
      });

      expect(result.current.focusedIndex).toBe(4);
    });

    it('should call preventDefault for arrow keys', () => {
      const { result } = renderHook(() => useRovingTabindex(3));
      const preventDefaultSpy = vi.fn();

      act(() => {
        const props = result.current.getRovingProps(0);
        props.onKeyDown({ key: 'ArrowRight', preventDefault: preventDefaultSpy });
      });

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('should call preventDefault for Home key', () => {
      const { result } = renderHook(() => useRovingTabindex(3));
      const preventDefaultSpy = vi.fn();

      act(() => {
        const props = result.current.getRovingProps(1);
        props.onKeyDown({ key: 'Home', preventDefault: preventDefaultSpy });
      });

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('should call preventDefault for End key', () => {
      const { result } = renderHook(() => useRovingTabindex(3));
      const preventDefaultSpy = vi.fn();

      act(() => {
        const props = result.current.getRovingProps(1);
        props.onKeyDown({ key: 'End', preventDefault: preventDefaultSpy });
      });

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('should not call preventDefault for unhandled keys', () => {
      const { result } = renderHook(() => useRovingTabindex(3));
      const preventDefaultSpy = vi.fn();

      act(() => {
        const props = result.current.getRovingProps(0);
        props.onKeyDown({ key: 'Enter', preventDefault: preventDefaultSpy });
      });

      expect(preventDefaultSpy).not.toHaveBeenCalled();
    });

    it('should not change focusedIndex for unhandled keys', () => {
      const { result } = renderHook(() => useRovingTabindex(3));

      act(() => {
        const props = result.current.getRovingProps(0);
        props.onKeyDown({ key: 'a', preventDefault: vi.fn() });
      });

      expect(result.current.focusedIndex).toBe(0);
    });
  });

  describe('keyboard navigation with wrap=false', () => {
    it('should clamp at index 0 when going backward from first', () => {
      const { result } = renderHook(() => useRovingTabindex(3, { wrap: false }));

      act(() => {
        const props = result.current.getRovingProps(0);
        props.onKeyDown({ key: 'ArrowLeft', preventDefault: vi.fn() });
      });

      expect(result.current.focusedIndex).toBe(0);
    });

    it('should clamp at last index when going forward from last', () => {
      const { result } = renderHook(() => useRovingTabindex(3, { wrap: false }));

      act(() => {
        result.current.setFocusedIndex(2);
      });

      act(() => {
        const props = result.current.getRovingProps(2);
        props.onKeyDown({ key: 'ArrowRight', preventDefault: vi.fn() });
      });

      expect(result.current.focusedIndex).toBe(2);
    });

    it('should still navigate normally in the middle', () => {
      const { result } = renderHook(() => useRovingTabindex(5, { wrap: false }));

      act(() => {
        result.current.setFocusedIndex(2);
      });

      act(() => {
        const props = result.current.getRovingProps(2);
        props.onKeyDown({ key: 'ArrowRight', preventDefault: vi.fn() });
      });

      expect(result.current.focusedIndex).toBe(3);
    });
  });

  describe('edge cases', () => {
    it('should handle itemCount of 1', () => {
      const { result } = renderHook(() => useRovingTabindex(1));
      expect(result.current.focusedIndex).toBe(0);

      act(() => {
        const props = result.current.getRovingProps(0);
        props.onKeyDown({ key: 'ArrowRight', preventDefault: vi.fn() });
      });

      expect(result.current.focusedIndex).toBe(0);
    });

    it('should handle itemCount of 0 without crashing', () => {
      const { result } = renderHook(() => useRovingTabindex(0));
      expect(result.current.focusedIndex).toBe(0);
    });

    it('should focus DOM element when setFocusedIndex is called with element ref', () => {
      const { result } = renderHook(() => useRovingTabindex(3));

      const button = document.createElement('button');
      document.body.appendChild(button);
      const focusSpy = vi.spyOn(button, 'focus');

      // Register the element via ref callback
      act(() => {
        result.current.getRovingProps(1).ref(button);
      });

      act(() => {
        result.current.setFocusedIndex(1);
      });

      expect(focusSpy).toHaveBeenCalled();

      document.body.removeChild(button);
    });
  });
});

// -------------------------------------------------------------------
// useFocusVisible
// -------------------------------------------------------------------
describe('useFocusVisible', () => {
  it('should return isFocusVisible and focusProps', () => {
    const { result } = renderHook(() => useFocusVisible());
    expect(result.current).toHaveProperty('isFocusVisible');
    expect(result.current).toHaveProperty('focusProps');
  });

  it('should initialize isFocusVisible to false', () => {
    const { result } = renderHook(() => useFocusVisible());
    expect(result.current.isFocusVisible).toBe(false);
  });

  it('should return focusProps with onFocus handler', () => {
    const { result } = renderHook(() => useFocusVisible());
    expect(typeof result.current.focusProps.onFocus).toBe('function');
  });

  it('should return focusProps with onBlur handler', () => {
    const { result } = renderHook(() => useFocusVisible());
    expect(typeof result.current.focusProps.onBlur).toBe('function');
  });

  it('should return focusProps with onMouseDown handler', () => {
    const { result } = renderHook(() => useFocusVisible());
    expect(typeof result.current.focusProps.onMouseDown).toBe('function');
  });

  it('should return focusProps with onKeyDown handler', () => {
    const { result } = renderHook(() => useFocusVisible());
    expect(typeof result.current.focusProps.onKeyDown).toBe('function');
  });

  it('should set isFocusVisible to true after keyboard then focus', () => {
    const { result } = renderHook(() => useFocusVisible());

    act(() => {
      result.current.focusProps.onKeyDown();
    });

    act(() => {
      result.current.focusProps.onFocus();
    });

    expect(result.current.isFocusVisible).toBe(true);
  });

  it('should not set isFocusVisible on focus after mouse interaction', () => {
    const { result } = renderHook(() => useFocusVisible());

    act(() => {
      result.current.focusProps.onMouseDown();
    });

    act(() => {
      result.current.focusProps.onFocus();
    });

    expect(result.current.isFocusVisible).toBe(false);
  });

  it('should reset isFocusVisible on blur', () => {
    const { result } = renderHook(() => useFocusVisible());

    // Make focus visible
    act(() => {
      result.current.focusProps.onKeyDown();
    });
    act(() => {
      result.current.focusProps.onFocus();
    });
    expect(result.current.isFocusVisible).toBe(true);

    // Blur should reset
    act(() => {
      result.current.focusProps.onBlur();
    });

    expect(result.current.isFocusVisible).toBe(false);
  });

  it('should track global keyboard events', () => {
    const { result } = renderHook(() => useFocusVisible());

    // Simulate global keyboard event
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
    });

    // Now focus should be visible
    act(() => {
      result.current.focusProps.onFocus();
    });

    expect(result.current.isFocusVisible).toBe(true);
  });

  it('should track global mouse events to disable focus visible', () => {
    const { result } = renderHook(() => useFocusVisible());

    // Keyboard first
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
    });

    // Then mouse
    act(() => {
      document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });

    // Focus should not be visible
    act(() => {
      result.current.focusProps.onFocus();
    });

    expect(result.current.isFocusVisible).toBe(false);
  });

  it('should clean up global event listeners on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

    const { unmount } = renderHook(() => useFocusVisible());
    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function), true);
    expect(removeEventListenerSpy).toHaveBeenCalledWith('mousedown', expect.any(Function), true);
  });

  it('should handle rapid keyboard then mouse then focus sequence', () => {
    const { result } = renderHook(() => useFocusVisible());

    act(() => {
      result.current.focusProps.onKeyDown();
      result.current.focusProps.onMouseDown();
      result.current.focusProps.onFocus();
    });

    // Mouse came after keyboard, so focus not visible
    expect(result.current.isFocusVisible).toBe(false);
  });

  it('should handle multiple blur/focus cycles', () => {
    const { result } = renderHook(() => useFocusVisible());

    // Cycle 1: keyboard focus
    act(() => {
      result.current.focusProps.onKeyDown();
      result.current.focusProps.onFocus();
    });
    expect(result.current.isFocusVisible).toBe(true);

    act(() => {
      result.current.focusProps.onBlur();
    });
    expect(result.current.isFocusVisible).toBe(false);

    // Cycle 2: mouse focus
    act(() => {
      result.current.focusProps.onMouseDown();
      result.current.focusProps.onFocus();
    });
    expect(result.current.isFocusVisible).toBe(false);
  });
});

// -------------------------------------------------------------------
// useEscapeKey
// -------------------------------------------------------------------
describe('useEscapeKey', () => {
  it('should call callback when Escape key is pressed', () => {
    const callback = vi.fn();
    renderHook(() => useEscapeKey(callback));

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should not call callback for non-Escape keys', () => {
    const callback = vi.fn();
    renderHook(() => useEscapeKey(callback));

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it('should not call callback when isActive is false', () => {
    const callback = vi.fn();
    renderHook(() => useEscapeKey(callback, false));

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it('should default isActive to true', () => {
    const callback = vi.fn();
    renderHook(() => useEscapeKey(callback));

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should update callback reference when callback changes', () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();

    const { rerender } = renderHook(({ cb }) => useEscapeKey(cb), {
      initialProps: { cb: callback1 },
    });

    rerender({ cb: callback2 });

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(callback1).not.toHaveBeenCalled();
    expect(callback2).toHaveBeenCalledTimes(1);
  });

  it('should remove listener on unmount', () => {
    const callback = vi.fn();
    const removeListenerSpy = vi.spyOn(document, 'removeEventListener');

    const { unmount } = renderHook(() => useEscapeKey(callback));
    unmount();

    expect(removeListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('should remove listener when isActive changes to false', () => {
    const callback = vi.fn();

    const { rerender } = renderHook(({ active }) => useEscapeKey(callback, active), {
      initialProps: { active: true },
    });

    rerender({ active: false });

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it('should re-attach listener when isActive changes back to true', () => {
    const callback = vi.fn();

    const { rerender } = renderHook(({ active }) => useEscapeKey(callback, active), {
      initialProps: { active: false },
    });

    rerender({ active: true });

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should handle multiple Escape presses', () => {
    const callback = vi.fn();
    renderHook(() => useEscapeKey(callback));

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(callback).toHaveBeenCalledTimes(3);
  });

  it('should ignore Tab key', () => {
    const callback = vi.fn();
    renderHook(() => useEscapeKey(callback));

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it('should ignore Space key', () => {
    const callback = vi.fn();
    renderHook(() => useEscapeKey(callback));

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    });

    expect(callback).not.toHaveBeenCalled();
  });
});
