import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBackgroundAgents } from './useBackgroundAgents';
import type { BackgroundAgent } from './useBackgroundAgents';

/**
 * useBackgroundAgents Hook Tests
 *
 * Tests the background agent lifecycle including:
 * - Initial state
 * - Window API exposure (spawn and update)
 * - Spawning agents
 * - Updating agent status and output
 * - Managing multiple concurrent agents
 * - Cleanup timer setup and teardown
 * - Auto-removal of completed agents after retention period
 * - Preservation of running agents during cleanup
 */

interface CodeLabAgentAPI {
  spawn: (name: string) => string;
  update: (
    id: string,
    update: Partial<{ status: 'running' | 'completed' | 'failed'; output: string }>
  ) => void;
}

declare global {
  interface Window {
    __codeLabAgentAPI?: CodeLabAgentAPI;
  }
}

describe('useBackgroundAgents', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Clean up the window API before each test
    delete (window as Record<string, unknown>).__codeLabAgentAPI;
  });

  afterEach(() => {
    vi.useRealTimers();
    delete (window as Record<string, unknown>).__codeLabAgentAPI;
  });

  describe('Initial state', () => {
    it('should initialize backgroundAgents as an empty array', () => {
      const { result } = renderHook(() => useBackgroundAgents());

      expect(result.current.backgroundAgents).toEqual([]);
      expect(Array.isArray(result.current.backgroundAgents)).toBe(true);
    });
  });

  describe('Window API exposure', () => {
    it('should expose __codeLabAgentAPI on window after mount', () => {
      renderHook(() => useBackgroundAgents());

      expect(window.__codeLabAgentAPI).toBeDefined();
      expect(typeof window.__codeLabAgentAPI?.spawn).toBe('function');
      expect(typeof window.__codeLabAgentAPI?.update).toBe('function');
    });

    it('should have spawn and update as the only API methods', () => {
      renderHook(() => useBackgroundAgents());

      const api = window.__codeLabAgentAPI;
      expect(api).toBeDefined();
      const keys = Object.keys(api!);
      expect(keys).toHaveLength(2);
      expect(keys).toContain('spawn');
      expect(keys).toContain('update');
    });
  });

  describe('Spawning agents', () => {
    it('should add an agent with status running when spawn is called', () => {
      const { result } = renderHook(() => useBackgroundAgents());

      act(() => {
        window.__codeLabAgentAPI!.spawn('test-task');
      });

      expect(result.current.backgroundAgents).toHaveLength(1);
      const agent = result.current.backgroundAgents[0];
      expect(agent.status).toBe('running');
      expect(agent.name).toBe('test-task');
    });

    it('should assign a unique id starting with "agent-"', () => {
      const { result } = renderHook(() => useBackgroundAgents());

      act(() => {
        window.__codeLabAgentAPI!.spawn('my-agent');
      });

      const agent = result.current.backgroundAgents[0];
      expect(agent.id).toMatch(/^agent-/);
      expect(agent.id.length).toBeGreaterThan('agent-'.length);
    });

    it('should set startedAt to a Date instance', () => {
      const { result } = renderHook(() => useBackgroundAgents());

      act(() => {
        window.__codeLabAgentAPI!.spawn('date-check');
      });

      const agent = result.current.backgroundAgents[0];
      expect(agent.startedAt).toBeInstanceOf(Date);
    });

    it('should set the correct name on the spawned agent', () => {
      const { result } = renderHook(() => useBackgroundAgents());

      act(() => {
        window.__codeLabAgentAPI!.spawn('compile-project');
      });

      expect(result.current.backgroundAgents[0].name).toBe('compile-project');
    });

    it('should return the agent id from spawn', () => {
      renderHook(() => useBackgroundAgents());

      let returnedId: string = '';
      act(() => {
        returnedId = window.__codeLabAgentAPI!.spawn('return-id-check');
      });

      expect(returnedId).toMatch(/^agent-/);
      expect(typeof returnedId).toBe('string');
    });

    it('should not have output property on a freshly spawned agent', () => {
      const { result } = renderHook(() => useBackgroundAgents());

      act(() => {
        window.__codeLabAgentAPI!.spawn('no-output');
      });

      const agent = result.current.backgroundAgents[0];
      expect(agent.output).toBeUndefined();
    });
  });

  describe('Updating agents', () => {
    it('should update the status of an agent', () => {
      const { result } = renderHook(() => useBackgroundAgents());

      let agentId: string = '';
      act(() => {
        agentId = window.__codeLabAgentAPI!.spawn('update-status');
      });

      act(() => {
        window.__codeLabAgentAPI!.update(agentId, { status: 'completed' });
      });

      const agent = result.current.backgroundAgents.find((a) => a.id === agentId);
      expect(agent?.status).toBe('completed');
    });

    it('should update the output of an agent', () => {
      const { result } = renderHook(() => useBackgroundAgents());

      let agentId: string = '';
      act(() => {
        agentId = window.__codeLabAgentAPI!.spawn('update-output');
      });

      act(() => {
        window.__codeLabAgentAPI!.update(agentId, { output: 'done' });
      });

      const agent = result.current.backgroundAgents.find((a) => a.id === agentId);
      expect(agent?.output).toBe('done');
    });

    it('should update both status and output simultaneously', () => {
      const { result } = renderHook(() => useBackgroundAgents());

      let agentId: string = '';
      act(() => {
        agentId = window.__codeLabAgentAPI!.spawn('update-both');
      });

      act(() => {
        window.__codeLabAgentAPI!.update(agentId, {
          status: 'completed',
          output: 'all done',
        });
      });

      const agent = result.current.backgroundAgents.find((a) => a.id === agentId);
      expect(agent?.status).toBe('completed');
      expect(agent?.output).toBe('all done');
    });

    it('should update the status to failed', () => {
      const { result } = renderHook(() => useBackgroundAgents());

      let agentId: string = '';
      act(() => {
        agentId = window.__codeLabAgentAPI!.spawn('fail-agent');
      });

      act(() => {
        window.__codeLabAgentAPI!.update(agentId, {
          status: 'failed',
          output: 'error occurred',
        });
      });

      const agent = result.current.backgroundAgents.find((a) => a.id === agentId);
      expect(agent?.status).toBe('failed');
      expect(agent?.output).toBe('error occurred');
    });

    it('should only update the targeted agent and leave others unchanged', () => {
      const { result } = renderHook(() => useBackgroundAgents());

      let id1: string = '';
      let id2: string = '';
      act(() => {
        id1 = window.__codeLabAgentAPI!.spawn('agent-one');
        id2 = window.__codeLabAgentAPI!.spawn('agent-two');
      });

      act(() => {
        window.__codeLabAgentAPI!.update(id1, { status: 'completed', output: 'finished' });
      });

      const agent1 = result.current.backgroundAgents.find((a) => a.id === id1);
      const agent2 = result.current.backgroundAgents.find((a) => a.id === id2);
      expect(agent1?.status).toBe('completed');
      expect(agent1?.output).toBe('finished');
      expect(agent2?.status).toBe('running');
      expect(agent2?.output).toBeUndefined();
    });

    it('should preserve existing agent properties not included in the update', () => {
      const { result } = renderHook(() => useBackgroundAgents());

      let agentId: string = '';
      act(() => {
        agentId = window.__codeLabAgentAPI!.spawn('preserve-props');
      });

      const originalAgent = result.current.backgroundAgents.find(
        (a) => a.id === agentId
      ) as BackgroundAgent;
      const originalName = originalAgent.name;
      const originalStartedAt = originalAgent.startedAt;

      act(() => {
        window.__codeLabAgentAPI!.update(agentId, { status: 'completed' });
      });

      const updatedAgent = result.current.backgroundAgents.find((a) => a.id === agentId);
      expect(updatedAgent?.name).toBe(originalName);
      expect(updatedAgent?.startedAt).toBe(originalStartedAt);
      expect(updatedAgent?.id).toBe(agentId);
    });
  });

  describe('Multiple agents', () => {
    it('should track multiple spawned agents', () => {
      const { result } = renderHook(() => useBackgroundAgents());

      act(() => {
        window.__codeLabAgentAPI!.spawn('agent-alpha');
        window.__codeLabAgentAPI!.spawn('agent-beta');
        window.__codeLabAgentAPI!.spawn('agent-gamma');
      });

      expect(result.current.backgroundAgents).toHaveLength(3);
    });

    it('should assign unique ids to each agent', () => {
      const { result } = renderHook(() => useBackgroundAgents());

      act(() => {
        window.__codeLabAgentAPI!.spawn('agent-1');
        window.__codeLabAgentAPI!.spawn('agent-2');
        window.__codeLabAgentAPI!.spawn('agent-3');
      });

      const ids = result.current.backgroundAgents.map((a) => a.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(3);
    });

    it('should preserve all agent names correctly', () => {
      const { result } = renderHook(() => useBackgroundAgents());

      act(() => {
        window.__codeLabAgentAPI!.spawn('build');
        window.__codeLabAgentAPI!.spawn('lint');
        window.__codeLabAgentAPI!.spawn('test');
      });

      const names = result.current.backgroundAgents.map((a) => a.name);
      expect(names).toContain('build');
      expect(names).toContain('lint');
      expect(names).toContain('test');
    });

    it('should allow independent updates to different agents', () => {
      const { result } = renderHook(() => useBackgroundAgents());

      let idA: string = '';
      let idB: string = '';
      act(() => {
        idA = window.__codeLabAgentAPI!.spawn('task-a');
        idB = window.__codeLabAgentAPI!.spawn('task-b');
      });

      act(() => {
        window.__codeLabAgentAPI!.update(idA, { status: 'completed', output: 'a done' });
      });

      act(() => {
        window.__codeLabAgentAPI!.update(idB, { status: 'failed', output: 'b failed' });
      });

      const agentA = result.current.backgroundAgents.find((a) => a.id === idA);
      const agentB = result.current.backgroundAgents.find((a) => a.id === idB);
      expect(agentA?.status).toBe('completed');
      expect(agentA?.output).toBe('a done');
      expect(agentB?.status).toBe('failed');
      expect(agentB?.output).toBe('b failed');
    });
  });

  describe('Cleanup timer setup', () => {
    it('should call setInterval on mount', () => {
      const setIntervalSpy = vi.spyOn(global, 'setInterval');

      renderHook(() => useBackgroundAgents());

      expect(setIntervalSpy).toHaveBeenCalled();
      // The cleanup interval should be 60000ms (1 minute)
      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 60000);

      setIntervalSpy.mockRestore();
    });
  });

  describe('Cleanup removes old completed agents', () => {
    it('should remove completed agents older than 5 minutes', () => {
      const { result } = renderHook(() => useBackgroundAgents());

      // Spawn an agent and mark it completed
      let agentId: string = '';
      act(() => {
        agentId = window.__codeLabAgentAPI!.spawn('old-completed');
      });

      act(() => {
        window.__codeLabAgentAPI!.update(agentId, { status: 'completed' });
      });

      expect(result.current.backgroundAgents).toHaveLength(1);

      // Advance time past the retention period (5 minutes = 300000ms)
      // and also past the cleanup interval (60000ms) to trigger the cleanup
      act(() => {
        vi.advanceTimersByTime(300001);
      });

      // After advancing past retention time, the next cleanup interval fires
      // and should remove the completed agent
      // The cleanup runs every 60000ms, and we've advanced 300001ms,
      // so multiple cleanup cycles have executed. The completed agent's
      // startedAt is now older than AGENT_RETENTION_TIME_MS (300000ms).
      expect(result.current.backgroundAgents).toHaveLength(0);
    });

    it('should keep completed agents younger than 5 minutes', () => {
      const { result } = renderHook(() => useBackgroundAgents());

      let agentId: string = '';
      act(() => {
        agentId = window.__codeLabAgentAPI!.spawn('recent-completed');
      });

      act(() => {
        window.__codeLabAgentAPI!.update(agentId, { status: 'completed' });
      });

      // Advance by one cleanup interval (60s) but still within retention (5 min)
      act(() => {
        vi.advanceTimersByTime(60000);
      });

      expect(result.current.backgroundAgents).toHaveLength(1);
      expect(result.current.backgroundAgents[0].status).toBe('completed');
    });

    it('should remove failed agents older than 5 minutes', () => {
      const { result } = renderHook(() => useBackgroundAgents());

      let agentId: string = '';
      act(() => {
        agentId = window.__codeLabAgentAPI!.spawn('old-failed');
      });

      act(() => {
        window.__codeLabAgentAPI!.update(agentId, { status: 'failed', output: 'error' });
      });

      // Advance past retention period
      act(() => {
        vi.advanceTimersByTime(300001);
      });

      expect(result.current.backgroundAgents).toHaveLength(0);
    });
  });

  describe('Cleanup keeps running agents', () => {
    it('should never remove running agents regardless of age', () => {
      const { result } = renderHook(() => useBackgroundAgents());

      act(() => {
        window.__codeLabAgentAPI!.spawn('long-running');
      });

      expect(result.current.backgroundAgents).toHaveLength(1);
      expect(result.current.backgroundAgents[0].status).toBe('running');

      // Advance well past the retention period
      act(() => {
        vi.advanceTimersByTime(600000); // 10 minutes
      });

      // Running agent should still be present
      expect(result.current.backgroundAgents).toHaveLength(1);
      expect(result.current.backgroundAgents[0].status).toBe('running');
      expect(result.current.backgroundAgents[0].name).toBe('long-running');
    });

    it('should remove completed agents but keep running agents during the same cleanup cycle', () => {
      const { result } = renderHook(() => useBackgroundAgents());

      let completedId: string = '';
      let runningId: string = '';
      act(() => {
        completedId = window.__codeLabAgentAPI!.spawn('will-complete');
        runningId = window.__codeLabAgentAPI!.spawn('stays-running');
      });

      act(() => {
        window.__codeLabAgentAPI!.update(completedId, {
          status: 'completed',
          output: 'done',
        });
      });

      expect(result.current.backgroundAgents).toHaveLength(2);

      // Advance past retention period to trigger cleanup
      act(() => {
        vi.advanceTimersByTime(300001);
      });

      // Only the completed agent should be removed
      expect(result.current.backgroundAgents).toHaveLength(1);
      expect(result.current.backgroundAgents[0].id).toBe(runningId);
      expect(result.current.backgroundAgents[0].status).toBe('running');
    });
  });

  describe('Cleanup interval cleared on unmount', () => {
    it('should call clearInterval when the hook unmounts', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

      const { unmount } = renderHook(() => useBackgroundAgents());

      unmount();

      expect(clearIntervalSpy).toHaveBeenCalled();

      clearIntervalSpy.mockRestore();
    });

    it('should not run cleanup after unmount', () => {
      const { result, unmount } = renderHook(() => useBackgroundAgents());

      act(() => {
        window.__codeLabAgentAPI!.spawn('pre-unmount-agent');
      });

      expect(result.current.backgroundAgents).toHaveLength(1);

      unmount();

      // Advancing timers after unmount should not cause errors
      // (the interval should have been cleared)
      act(() => {
        vi.advanceTimersByTime(600000);
      });

      // No error thrown — interval was properly cleaned up
    });
  });
});
