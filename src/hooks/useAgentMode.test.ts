/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * TEST-002: useAgentMode Hook Tests
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('@/agents/strategy', () => ({
  StrategyStreamEvent: {},
}));

import { useAgentMode } from './useAgentMode';

describe('useAgentMode', () => {
  it('should initialize with default values', () => {
    const { result } = renderHook(() => useAgentMode());

    expect(result.current.isActive).toBe(false);
    expect(result.current.sessionId).toBeNull();
    expect(result.current.phase).toBe('idle');
    expect(result.current.loading).toBe(false);
    expect(result.current.events).toEqual([]);
  });

  it('should toggle active state', () => {
    const { result } = renderHook(() => useAgentMode());

    act(() => result.current.setActive(true));
    expect(result.current.isActive).toBe(true);

    act(() => result.current.setActive(false));
    expect(result.current.isActive).toBe(false);
  });

  it('should set session ID', () => {
    const { result } = renderHook(() => useAgentMode());

    act(() => result.current.setSessionId('session-123'));
    expect(result.current.sessionId).toBe('session-123');

    act(() => result.current.setSessionId(null));
    expect(result.current.sessionId).toBeNull();
  });

  it('should cycle through phases', () => {
    const { result } = renderHook(() => useAgentMode());

    const phases = ['idle', 'intake', 'executing', 'complete', 'error'] as const;
    for (const phase of phases) {
      act(() => result.current.setPhase(phase));
      expect(result.current.phase).toBe(phase);
    }
  });

  it('should toggle loading state', () => {
    const { result } = renderHook(() => useAgentMode());

    act(() => result.current.setLoading(true));
    expect(result.current.loading).toBe(true);

    act(() => result.current.setLoading(false));
    expect(result.current.loading).toBe(false);
  });

  it('should manage events', () => {
    const { result } = renderHook(() => useAgentMode());

    const mockEvent = { type: 'progress', data: 'test' } as any;
    act(() => result.current.setEvents([mockEvent]));
    expect(result.current.events).toEqual([mockEvent]);
  });

  it('should reset all state', () => {
    const { result } = renderHook(() => useAgentMode());

    // Set all state
    act(() => {
      result.current.setActive(true);
      result.current.setSessionId('session-456');
      result.current.setPhase('executing');
      result.current.setLoading(true);
      result.current.setEvents([{ type: 'test' } as any]);
    });

    // Reset
    act(() => result.current.reset());

    expect(result.current.isActive).toBe(false);
    expect(result.current.sessionId).toBeNull();
    expect(result.current.phase).toBe('idle');
    expect(result.current.loading).toBe(false);
    expect(result.current.events).toEqual([]);
  });

  it('should support multiple independent instances', () => {
    const { result: hook1 } = renderHook(() => useAgentMode());
    const { result: hook2 } = renderHook(() => useAgentMode());

    act(() => hook1.current.setActive(true));
    act(() => hook2.current.setPhase('executing'));

    expect(hook1.current.isActive).toBe(true);
    expect(hook2.current.isActive).toBe(false);
    expect(hook1.current.phase).toBe('idle');
    expect(hook2.current.phase).toBe('executing');
  });
});
