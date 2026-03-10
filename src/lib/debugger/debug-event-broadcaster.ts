/**
 * DEBUG EVENT BROADCASTER - SSE-COMPATIBLE REAL-TIME DEBUG EVENTS
 *
 * Broadcasts debug events to connected SSE clients.
 * Works in serverless environments (Vercel) by integrating with
 * the existing SSE realtime API.
 *
 * Events:
 * - debug:initialized - Debug session initialized
 * - debug:connected - Debugger connected
 * - debug:output - stdout/stderr from debugged program
 * - debug:stopped - Execution stopped (breakpoint, step, etc.)
 * - debug:continued - Execution resumed
 * - debug:breakpoint - Breakpoint hit or changed
 * - debug:terminated - Debug session ended
 * - debug:exited - Program exited
 * - debug:error - Error occurred
 */

import { EventEmitter } from 'events';
import { logger } from '@/lib/logger';

const log = logger('DebugEventBroadcaster');

// ============================================================================
// TYPES
// ============================================================================

export type DebugEventType =
  | 'debug:initialized'
  | 'debug:connected'
  | 'debug:disconnected'
  | 'debug:output'
  | 'debug:stopped'
  | 'debug:continued'
  | 'debug:breakpoint'
  | 'debug:terminated'
  | 'debug:exited'
  | 'debug:process'
  | 'debug:thread'
  | 'debug:loadedSource'
  | 'debug:error';

export interface DebugEvent {
  type: DebugEventType;
  sessionId: string;
  payload: DebugEventPayload;
  timestamp: number;
}

export type DebugEventPayload =
  | InitializedPayload
  | OutputPayload
  | StoppedPayload
  | ContinuedPayload
  | BreakpointPayload
  | TerminatedPayload
  | ExitedPayload
  | ProcessPayload
  | ThreadPayload
  | LoadedSourcePayload
  | ErrorPayload
  | Record<string, unknown>;

export interface InitializedPayload {
  language?: string;
  program?: string;
}

export interface OutputPayload {
  category: 'stdout' | 'stderr' | 'console' | 'important';
  output: string;
  source?: {
    path?: string;
    line?: number;
  };
}

export interface StoppedPayload {
  reason: 'breakpoint' | 'step' | 'exception' | 'pause' | 'entry' | string;
  threadId: number;
  description?: string;
  text?: string;
  allThreadsStopped?: boolean;
  hitBreakpointIds?: number[];
}

export interface ContinuedPayload {
  threadId: number;
  allThreadsContinued?: boolean;
}

export interface BreakpointPayload {
  reason: 'new' | 'changed' | 'removed';
  breakpoint: {
    id: number;
    verified: boolean;
    line?: number;
    column?: number;
    source?: { path?: string };
    message?: string;
  };
}

export interface TerminatedPayload {
  restart?: boolean;
}

export interface ExitedPayload {
  exitCode: number;
}

export interface ProcessPayload {
  name: string;
  systemProcessId?: number;
  isLocalProcess?: boolean;
  startMethod?: 'launch' | 'attach' | 'attachForSuspendedLaunch';
}

export interface ThreadPayload {
  reason: 'started' | 'exited';
  threadId: number;
}

export interface LoadedSourcePayload {
  reason: 'new' | 'changed' | 'removed';
  source: {
    name?: string;
    path?: string;
    sourceReference?: number;
  };
}

export interface ErrorPayload {
  message: string;
  code?: string;
  details?: unknown;
}

// ============================================================================
// DEBUG EVENT BROADCASTER
// ============================================================================

class DebugEventBroadcaster extends EventEmitter {
  // Track which sessions are being debugged and their associated data
  private activeSessions: Map<
    string,
    {
      startedAt: Date;
      language?: string;
      program?: string;
    }
  > = new Map();

  constructor() {
    super();
    // Allow many listeners for broadcast events
    this.setMaxListeners(100);
  }

  /**
   * Register a debug session
   * Call this when a debug session starts
   */
  registerSession(sessionId: string, options?: { language?: string; program?: string }): void {
    this.activeSessions.set(sessionId, {
      startedAt: new Date(),
      language: options?.language,
      program: options?.program,
    });
    log.info('Debug session registered', { sessionId, ...options });
  }

  /**
   * Unregister a debug session
   * Call this when a debug session ends
   */
  unregisterSession(sessionId: string): void {
    this.activeSessions.delete(sessionId);
    log.info('Debug session unregistered', { sessionId });
  }

  /**
   * Check if a session is active
   */
  isSessionActive(sessionId: string): boolean {
    return this.activeSessions.has(sessionId);
  }

  /**
   * Get active session info
   */
  getSessionInfo(sessionId: string) {
    return this.activeSessions.get(sessionId);
  }

  /**
   * Broadcast a debug event
   * This emits an event that the SSE realtime route listens to
   */
  broadcast(type: DebugEventType, sessionId: string, payload: DebugEventPayload): void {
    const event: DebugEvent = {
      type,
      sessionId,
      payload,
      timestamp: Date.now(),
    };

    // Emit for SSE subscribers
    this.emit('debug:broadcast', event);

    // Also emit specific event type for targeted listeners
    this.emit(type, event);

    log.debug('Debug event broadcast', { type, sessionId });
  }

  // ============================================================================
  // CONVENIENCE METHODS FOR COMMON EVENTS
  // ============================================================================

  /**
   * Broadcast initialization event
   */
  initialized(sessionId: string, payload?: InitializedPayload): void {
    this.broadcast('debug:initialized', sessionId, payload || {});
  }

  /**
   * Broadcast connected event
   */
  connected(sessionId: string): void {
    this.broadcast('debug:connected', sessionId, {});
  }

  /**
   * Broadcast disconnected event
   */
  disconnected(sessionId: string, reason?: string): void {
    this.broadcast('debug:disconnected', sessionId, { reason });
  }

  /**
   * Broadcast output event (stdout/stderr)
   */
  output(sessionId: string, payload: OutputPayload): void {
    this.broadcast('debug:output', sessionId, payload);
  }

  /**
   * Broadcast stopped event (breakpoint hit, step completed, etc.)
   */
  stopped(sessionId: string, payload: StoppedPayload): void {
    this.broadcast('debug:stopped', sessionId, payload);
  }

  /**
   * Broadcast continued event
   */
  continued(sessionId: string, payload: ContinuedPayload): void {
    this.broadcast('debug:continued', sessionId, payload);
  }

  /**
   * Broadcast breakpoint event
   */
  breakpoint(sessionId: string, payload: BreakpointPayload): void {
    this.broadcast('debug:breakpoint', sessionId, payload);
  }

  /**
   * Broadcast terminated event
   */
  terminated(sessionId: string, payload?: TerminatedPayload): void {
    this.broadcast('debug:terminated', sessionId, payload || {});
    this.unregisterSession(sessionId);
  }

  /**
   * Broadcast exited event
   */
  exited(sessionId: string, payload: ExitedPayload): void {
    this.broadcast('debug:exited', sessionId, payload);
  }

  /**
   * Broadcast process event
   */
  process(sessionId: string, payload: ProcessPayload): void {
    this.broadcast('debug:process', sessionId, payload);
  }

  /**
   * Broadcast thread event
   */
  thread(sessionId: string, payload: ThreadPayload): void {
    this.broadcast('debug:thread', sessionId, payload);
  }

  /**
   * Broadcast loaded source event
   */
  loadedSource(sessionId: string, payload: LoadedSourcePayload): void {
    this.broadcast('debug:loadedSource', sessionId, payload);
  }

  /**
   * Broadcast error event
   */
  error(sessionId: string, payload: ErrorPayload): void {
    this.broadcast('debug:error', sessionId, payload);
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let broadcasterInstance: DebugEventBroadcaster | null = null;

/**
 * Get the singleton debug event broadcaster
 */
export function getDebugEventBroadcaster(): DebugEventBroadcaster {
  if (!broadcasterInstance) {
    broadcasterInstance = new DebugEventBroadcaster();
  }
  return broadcasterInstance;
}

/**
 * Helper to wire up a debug adapter's events to the broadcaster
 * Use this to connect any EventEmitter-based debug adapter
 */
export function wireDebugAdapterToBroadcaster(
  adapter: EventEmitter,
  sessionId: string,
  options?: { language?: string; program?: string }
): void {
  const broadcaster = getDebugEventBroadcaster();

  // Register the session
  broadcaster.registerSession(sessionId, options);

  // Map adapter events to broadcaster events
  const eventMappings: Array<{ adapterEvent: string; broadcastType: DebugEventType }> = [
    { adapterEvent: 'initialized', broadcastType: 'debug:initialized' },
    { adapterEvent: 'connected', broadcastType: 'debug:connected' },
    { adapterEvent: 'disconnected', broadcastType: 'debug:disconnected' },
    { adapterEvent: 'output', broadcastType: 'debug:output' },
    { adapterEvent: 'stopped', broadcastType: 'debug:stopped' },
    { adapterEvent: 'continued', broadcastType: 'debug:continued' },
    { adapterEvent: 'breakpoint', broadcastType: 'debug:breakpoint' },
    { adapterEvent: 'terminated', broadcastType: 'debug:terminated' },
    { adapterEvent: 'exited', broadcastType: 'debug:exited' },
    { adapterEvent: 'process', broadcastType: 'debug:process' },
    { adapterEvent: 'thread', broadcastType: 'debug:thread' },
    { adapterEvent: 'loadedSource', broadcastType: 'debug:loadedSource' },
    { adapterEvent: 'error', broadcastType: 'debug:error' },
  ];

  for (const mapping of eventMappings) {
    adapter.on(mapping.adapterEvent, (payload: unknown) => {
      // Handle payloads that already include sessionId
      const payloadObj = (payload || {}) as Record<string, unknown>;
      const cleanPayload = { ...payloadObj };
      delete cleanPayload.sessionId; // Remove if present to avoid duplication

      broadcaster.broadcast(mapping.broadcastType, sessionId, cleanPayload as DebugEventPayload);
    });
  }

  // Auto-unregister on termination
  adapter.once('terminated', () => {
    broadcaster.unregisterSession(sessionId);
  });

  log.info('Debug adapter wired to broadcaster', { sessionId, ...options });
}

export { DebugEventBroadcaster };
