/**
 * DEBUG EVENT BROADCASTER TESTS
 *
 * Tests for the SSE-compatible debug event broadcasting system.
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getDebugEventBroadcaster,
  wireDebugAdapterToBroadcaster,
  type DebugEvent,
} from './debug-event-broadcaster';
import { EventEmitter } from 'events';

describe('DebugEventBroadcaster', () => {
  let broadcaster: ReturnType<typeof getDebugEventBroadcaster>;

  beforeEach(() => {
    // Get fresh broadcaster instance
    broadcaster = getDebugEventBroadcaster();
  });

  afterEach(() => {
    // Clean up listeners
    broadcaster.removeAllListeners();
  });

  describe('Session Management', () => {
    test('should register a session', () => {
      const sessionId = 'test-session-1';
      broadcaster.registerSession(sessionId, { language: 'python' });

      expect(broadcaster.isSessionActive(sessionId)).toBe(true);
      expect(broadcaster.getSessionInfo(sessionId)?.language).toBe('python');
    });

    test('should unregister a session', () => {
      const sessionId = 'test-session-2';
      broadcaster.registerSession(sessionId);

      expect(broadcaster.isSessionActive(sessionId)).toBe(true);

      broadcaster.unregisterSession(sessionId);

      expect(broadcaster.isSessionActive(sessionId)).toBe(false);
    });

    test('should return undefined for non-existent session', () => {
      expect(broadcaster.getSessionInfo('non-existent')).toBeUndefined();
    });
  });

  describe('Event Broadcasting', () => {
    test('should emit debug:broadcast event', () => {
      const sessionId = 'test-session-3';
      const listener = vi.fn();

      broadcaster.on('debug:broadcast', listener);
      broadcaster.registerSession(sessionId);
      broadcaster.initialized(sessionId, { language: 'node' });

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'debug:initialized',
          sessionId,
          payload: { language: 'node' },
        })
      );
    });

    test('should emit output events', () => {
      const sessionId = 'test-session-4';
      const listener = vi.fn();

      broadcaster.on('debug:output', listener);
      broadcaster.registerSession(sessionId);
      broadcaster.output(sessionId, {
        category: 'stdout',
        output: 'Hello, World!',
      });

      expect(listener).toHaveBeenCalledTimes(1);
      const event = listener.mock.calls[0][0] as DebugEvent;
      expect(event.type).toBe('debug:output');
      expect(event.payload).toEqual({
        category: 'stdout',
        output: 'Hello, World!',
      });
    });

    test('should emit stopped events with reason', () => {
      const sessionId = 'test-session-5';
      const listener = vi.fn();

      broadcaster.on('debug:stopped', listener);
      broadcaster.registerSession(sessionId);
      broadcaster.stopped(sessionId, {
        reason: 'breakpoint',
        threadId: 1,
        description: 'Hit breakpoint at line 10',
      });

      expect(listener).toHaveBeenCalledTimes(1);
      const event = listener.mock.calls[0][0] as DebugEvent;
      expect(event.type).toBe('debug:stopped');
      expect(event.payload).toMatchObject({
        reason: 'breakpoint',
        threadId: 1,
      });
    });

    test('should emit continued events', () => {
      const sessionId = 'test-session-6';
      const listener = vi.fn();

      broadcaster.on('debug:continued', listener);
      broadcaster.registerSession(sessionId);
      broadcaster.continued(sessionId, { threadId: 1 });

      expect(listener).toHaveBeenCalledTimes(1);
    });

    test('should emit terminated and unregister session', () => {
      const sessionId = 'test-session-7';
      const listener = vi.fn();

      broadcaster.on('debug:terminated', listener);
      broadcaster.registerSession(sessionId);

      expect(broadcaster.isSessionActive(sessionId)).toBe(true);

      broadcaster.terminated(sessionId);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(broadcaster.isSessionActive(sessionId)).toBe(false);
    });

    test('should emit exited events with exit code', () => {
      const sessionId = 'test-session-8';
      const listener = vi.fn();

      broadcaster.on('debug:exited', listener);
      broadcaster.registerSession(sessionId);
      broadcaster.exited(sessionId, { exitCode: 0 });

      expect(listener).toHaveBeenCalledTimes(1);
      const event = listener.mock.calls[0][0] as DebugEvent;
      expect(event.payload).toEqual({ exitCode: 0 });
    });

    test('should emit error events', () => {
      const sessionId = 'test-session-9';
      const listener = vi.fn();

      broadcaster.on('debug:error', listener);
      broadcaster.registerSession(sessionId);
      broadcaster.error(sessionId, {
        message: 'Connection failed',
        code: 'ECONNREFUSED',
      });

      expect(listener).toHaveBeenCalledTimes(1);
      const event = listener.mock.calls[0][0] as DebugEvent;
      expect(event.payload).toMatchObject({
        message: 'Connection failed',
        code: 'ECONNREFUSED',
      });
    });
  });

  describe('Adapter Wiring', () => {
    test('should wire debug adapter events to broadcaster', () => {
      const sessionId = 'test-session-10';
      const adapter = new EventEmitter();
      const broadcastListener = vi.fn();

      broadcaster.on('debug:broadcast', broadcastListener);

      wireDebugAdapterToBroadcaster(adapter, sessionId, { language: 'python' });

      // Simulate adapter events
      adapter.emit('initialized', {});
      adapter.emit('output', { category: 'stdout', output: 'test output' });
      adapter.emit('stopped', { reason: 'breakpoint', threadId: 1 });
      adapter.emit('continued', { threadId: 1 });

      // Should have 4 events (initialized, output, stopped, continued)
      expect(broadcastListener).toHaveBeenCalledTimes(4);
    });

    test('should unregister session on terminated event', () => {
      const sessionId = 'test-session-11';
      const adapter = new EventEmitter();

      wireDebugAdapterToBroadcaster(adapter, sessionId);

      expect(broadcaster.isSessionActive(sessionId)).toBe(true);

      adapter.emit('terminated', {});

      expect(broadcaster.isSessionActive(sessionId)).toBe(false);
    });

    test('should strip sessionId from payload to avoid duplication', () => {
      const sessionId = 'test-session-12';
      const adapter = new EventEmitter();
      const broadcastListener = vi.fn();

      broadcaster.on('debug:broadcast', broadcastListener);
      wireDebugAdapterToBroadcaster(adapter, sessionId);

      // Simulate adapter emitting with sessionId in payload (like container adapter does)
      adapter.emit('output', {
        sessionId: 'should-be-removed',
        category: 'stdout',
        output: 'test',
      });

      const event = broadcastListener.mock.calls[0][0] as DebugEvent;
      // sessionId should be at event level, not in payload
      expect(event.sessionId).toBe(sessionId);
      expect((event.payload as Record<string, unknown>).sessionId).toBeUndefined();
    });
  });

  describe('Event Timestamps', () => {
    test('should include timestamp in events', () => {
      const sessionId = 'test-session-13';
      const listener = vi.fn();
      const beforeTime = Date.now();

      broadcaster.on('debug:broadcast', listener);
      broadcaster.registerSession(sessionId);
      broadcaster.initialized(sessionId);

      const afterTime = Date.now();
      const event = listener.mock.calls[0][0] as DebugEvent;

      expect(event.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(event.timestamp).toBeLessThanOrEqual(afterTime);
    });
  });
});
