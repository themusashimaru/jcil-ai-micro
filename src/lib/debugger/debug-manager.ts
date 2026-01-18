/**
 * DEBUG MANAGER - ORCHESTRATES DEBUG SESSIONS
 *
 * Manages multiple debug sessions, coordinates with WebSocket
 * for real-time debug events to the UI.
 */

import { EventEmitter } from 'events';
import {
  DebugAdapter,
  DebugConfiguration,
  DebugSession,
  Breakpoint,
  Source,
  StackFrame,
  Scope,
  Variable,
  Thread,
  createDebugAdapter,
} from './debug-adapter';
import { getWebSocketServer } from '@/lib/realtime';
import { logger } from '@/lib/logger';

const log = logger('DebugManager');

// ============================================================================
// TYPES
// ============================================================================

export interface DebugSessionInfo {
  id: string;
  type: 'node' | 'python';
  state: 'idle' | 'running' | 'paused' | 'stopped';
  configuration: DebugConfiguration;
  startedAt: Date;
  userId: string;
  workspaceId: string;
}

// ============================================================================
// DEBUG MANAGER
// ============================================================================

export class DebugManager extends EventEmitter {
  private sessions: Map<string, {
    adapter: DebugAdapter;
    info: DebugSessionInfo;
  }> = new Map();

  /**
   * Start a new debug session
   */
  async startSession(
    userId: string,
    workspaceId: string,
    config: DebugConfiguration
  ): Promise<DebugSessionInfo> {
    const sessionId = `debug-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    log.info('Starting debug session', { sessionId, type: config.type, program: config.program });

    const adapter = createDebugAdapter(config.type);
    await adapter.initialize();

    const info: DebugSessionInfo = {
      id: sessionId,
      type: config.type,
      state: 'idle',
      configuration: config,
      startedAt: new Date(),
      userId,
      workspaceId,
    };

    // Set up event forwarding
    this.setupEventForwarding(sessionId, adapter, userId);

    this.sessions.set(sessionId, { adapter, info });

    // Launch or attach based on request type
    if (config.request === 'launch') {
      await adapter.launch(config);
    } else {
      await adapter.attach(config);
    }

    info.state = 'running';

    return info;
  }

  /**
   * Stop a debug session
   */
  async stopSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Debug session not found: ${sessionId}`);
    }

    log.info('Stopping debug session', { sessionId });

    await session.adapter.disconnect();
    this.sessions.delete(sessionId);
  }

  /**
   * Set breakpoints for a file
   */
  async setBreakpoints(
    sessionId: string,
    source: Source,
    breakpoints: Array<{ line: number; column?: number; condition?: string }>
  ): Promise<Breakpoint[]> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Debug session not found: ${sessionId}`);
    }

    return session.adapter.setBreakpoints(source, breakpoints);
  }

  /**
   * Continue execution
   */
  async continue(sessionId: string, threadId: number = 1): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Debug session not found: ${sessionId}`);
    }

    session.info.state = 'running';
    await session.adapter.continue(threadId);
  }

  /**
   * Step over
   */
  async stepOver(sessionId: string, threadId: number = 1): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Debug session not found: ${sessionId}`);
    }

    await session.adapter.stepOver(threadId);
  }

  /**
   * Step into
   */
  async stepInto(sessionId: string, threadId: number = 1): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Debug session not found: ${sessionId}`);
    }

    await session.adapter.stepInto(threadId);
  }

  /**
   * Step out
   */
  async stepOut(sessionId: string, threadId: number = 1): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Debug session not found: ${sessionId}`);
    }

    await session.adapter.stepOut(threadId);
  }

  /**
   * Pause execution
   */
  async pause(sessionId: string, threadId: number = 1): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Debug session not found: ${sessionId}`);
    }

    session.info.state = 'paused';
    await session.adapter.pause(threadId);
  }

  /**
   * Get threads
   */
  async getThreads(sessionId: string): Promise<Thread[]> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Debug session not found: ${sessionId}`);
    }

    return session.adapter.getThreads();
  }

  /**
   * Get stack trace
   */
  async getStackTrace(
    sessionId: string,
    threadId: number = 1,
    startFrame?: number,
    levels?: number
  ): Promise<StackFrame[]> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Debug session not found: ${sessionId}`);
    }

    return session.adapter.getStackTrace(threadId, startFrame, levels);
  }

  /**
   * Get scopes for a stack frame
   */
  async getScopes(sessionId: string, frameId: number): Promise<Scope[]> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Debug session not found: ${sessionId}`);
    }

    return session.adapter.getScopes(frameId);
  }

  /**
   * Get variables
   */
  async getVariables(sessionId: string, variablesReference: number): Promise<Variable[]> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Debug session not found: ${sessionId}`);
    }

    return session.adapter.getVariables(variablesReference);
  }

  /**
   * Evaluate expression
   */
  async evaluate(
    sessionId: string,
    expression: string,
    frameId?: number,
    context?: 'watch' | 'repl' | 'hover'
  ): Promise<{ result: string; type?: string; variablesReference: number }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Debug session not found: ${sessionId}`);
    }

    return session.adapter.evaluate(expression, frameId, context);
  }

  /**
   * Get session info
   */
  getSession(sessionId: string): DebugSessionInfo | null {
    const session = this.sessions.get(sessionId);
    return session?.info || null;
  }

  /**
   * Get all sessions for a user
   */
  getUserSessions(userId: string): DebugSessionInfo[] {
    const sessions: DebugSessionInfo[] = [];
    for (const session of this.sessions.values()) {
      if (session.info.userId === userId) {
        sessions.push(session.info);
      }
    }
    return sessions;
  }

  /**
   * Get all sessions for a workspace
   */
  getWorkspaceSessions(workspaceId: string): DebugSessionInfo[] {
    const sessions: DebugSessionInfo[] = [];
    for (const session of this.sessions.values()) {
      if (session.info.workspaceId === workspaceId) {
        sessions.push(session.info);
      }
    }
    return sessions;
  }

  /**
   * Set up event forwarding to WebSocket
   */
  private setupEventForwarding(
    sessionId: string,
    adapter: DebugAdapter,
    userId: string
  ): void {
    const ws = getWebSocketServer();

    // Forward debug events to WebSocket clients
    const forwardEvent = (event: string, data: unknown) => {
      ws.sendToUser(userId, {
        type: `debug:${event}`,
        payload: {
          sessionId,
          ...data as object,
        },
        timestamp: Date.now(),
      });

      // Also emit on the manager for local listeners
      this.emit(event, { sessionId, ...data as object });
    };

    adapter.on('initialized', () => {
      log.debug('Debug session initialized', { sessionId });
      forwardEvent('initialized', {});
    });

    adapter.on('stopped', (data) => {
      const session = this.sessions.get(sessionId);
      if (session) {
        session.info.state = 'paused';
      }
      log.debug('Debug session stopped', { sessionId, reason: data.reason });
      forwardEvent('stopped', data);
    });

    adapter.on('continued', (data) => {
      const session = this.sessions.get(sessionId);
      if (session) {
        session.info.state = 'running';
      }
      forwardEvent('continued', data);
    });

    adapter.on('exited', (data) => {
      log.info('Debug session exited', { sessionId, exitCode: data.exitCode });
      forwardEvent('exited', data);
    });

    adapter.on('terminated', () => {
      const session = this.sessions.get(sessionId);
      if (session) {
        session.info.state = 'stopped';
      }
      log.info('Debug session terminated', { sessionId });
      forwardEvent('terminated', {});
      this.sessions.delete(sessionId);
    });

    adapter.on('output', (data) => {
      forwardEvent('output', data);
    });

    adapter.on('breakpoint', (data) => {
      forwardEvent('breakpoint', data);
    });
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let debugManagerInstance: DebugManager | null = null;

export function getDebugManager(): DebugManager {
  if (!debugManagerInstance) {
    debugManagerInstance = new DebugManager();
  }
  return debugManagerInstance;
}
