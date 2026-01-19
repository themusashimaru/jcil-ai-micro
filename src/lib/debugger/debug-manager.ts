/**
 * DEBUG MANAGER - ORCHESTRATES DEBUG SESSIONS
 *
 * Manages multiple debug sessions, coordinates with WebSocket
 * for real-time debug events to the UI.
 *
 * Supports two modes:
 * 1. Local debugging - Uses CDP/DAP clients directly (development)
 * 2. Container debugging - Runs debug servers inside E2B containers (production)
 */

import { EventEmitter } from 'events';
import {
  DebugAdapter,
  DebugConfiguration,
  Breakpoint,
  Source,
  StackFrame,
  Scope,
  Variable,
  Thread,
  createDebugAdapter,
} from './debug-adapter';
import {
  ContainerDebugAdapter,
  ContainerDebugConfig,
  getContainerDebugAdapter,
} from './container-debug-adapter';
import { getWebSocketServer } from '@/lib/realtime/websocket-server';
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
  isContainer?: boolean; // True if running in E2B container
}

// ============================================================================
// DEBUG MANAGER
// ============================================================================

export class DebugManager extends EventEmitter {
  private sessions: Map<
    string,
    {
      adapter: DebugAdapter | null;
      containerAdapter?: ContainerDebugAdapter;
      info: DebugSessionInfo;
      isContainer: boolean;
    }
  > = new Map();

  private containerDebugAdapter: ContainerDebugAdapter | null = null;

  /**
   * Get or create container debug adapter
   */
  private getContainerAdapter(): ContainerDebugAdapter {
    if (!this.containerDebugAdapter) {
      this.containerDebugAdapter = getContainerDebugAdapter();
    }
    return this.containerDebugAdapter;
  }

  /**
   * Determine if we should use container debugging
   * - In production/serverless: Always use container (E2B)
   * - In development: Use local debugging unless explicitly requested
   */
  private shouldUseContainer(config: DebugConfiguration): boolean {
    // Explicit container mode flag
    if ((config as DebugConfiguration & { useContainer?: boolean }).useContainer) {
      return true;
    }

    // In serverless/Vercel environment, always use containers
    if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
      return true;
    }

    // Check for E2B API key as indicator of container availability
    if (process.env.E2B_API_KEY) {
      return true;
    }

    // Default: local debugging
    return false;
  }

  /**
   * Start a new debug session
   */
  async startSession(
    userId: string,
    workspaceId: string,
    config: DebugConfiguration
  ): Promise<DebugSessionInfo> {
    const useContainer = this.shouldUseContainer(config);

    log.info('Starting debug session', {
      type: config.type,
      program: config.program,
      useContainer,
    });

    if (useContainer) {
      return this.startContainerSession(userId, workspaceId, config);
    } else {
      return this.startLocalSession(userId, workspaceId, config);
    }
  }

  /**
   * Start a container-based debug session (E2B)
   */
  private async startContainerSession(
    userId: string,
    workspaceId: string,
    config: DebugConfiguration
  ): Promise<DebugSessionInfo> {
    const containerAdapter = this.getContainerAdapter();

    // Convert to container config
    const containerConfig: ContainerDebugConfig = {
      type: config.type,
      program: config.program || '',
      args: config.args,
      cwd: config.cwd,
      env: config.env,
      stopOnEntry: config.request === 'launch', // Stop on first line for launch
    };

    // Start the container debug session
    const containerSession = await containerAdapter.startSession(workspaceId, containerConfig);

    // Create session info
    const info: DebugSessionInfo = {
      id: containerSession.id,
      type: config.type,
      state:
        containerSession.state === 'paused'
          ? 'paused'
          : containerSession.state === 'running'
            ? 'running'
            : containerSession.state === 'error'
              ? 'stopped'
              : 'idle',
      configuration: config,
      startedAt: new Date(),
      userId,
      workspaceId,
      isContainer: true,
    };

    // Set up event forwarding for container adapter
    this.setupContainerEventForwarding(containerSession.id, containerAdapter, userId);

    // Store session
    this.sessions.set(containerSession.id, {
      adapter: null,
      containerAdapter,
      info,
      isContainer: true,
    });

    return info;
  }

  /**
   * Start a local debug session (development mode)
   */
  private async startLocalSession(
    userId: string,
    workspaceId: string,
    config: DebugConfiguration
  ): Promise<DebugSessionInfo> {
    const sessionId = `debug-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

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
      isContainer: false,
    };

    // Set up event forwarding
    this.setupEventForwarding(sessionId, adapter, userId);

    this.sessions.set(sessionId, { adapter, info, isContainer: false });

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

    log.info('Stopping debug session', { sessionId, isContainer: session.isContainer });

    if (session.isContainer && session.containerAdapter) {
      await session.containerAdapter.stopSession(sessionId);
    } else if (session.adapter) {
      await session.adapter.disconnect();
    }

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

    if (session.isContainer && session.containerAdapter) {
      const result = await session.containerAdapter.setBreakpoints(sessionId, source, breakpoints);
      // Convert to Breakpoint format
      return result.map((bp) => ({
        id: bp.id,
        verified: bp.verified,
        line: bp.line,
        column: bp.column,
        source: bp.source as Source,
        message: bp.message,
      }));
    } else if (session.adapter) {
      return session.adapter.setBreakpoints(source, breakpoints);
    }

    return [];
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

    if (session.isContainer && session.containerAdapter) {
      await session.containerAdapter.continue(sessionId, threadId);
    } else if (session.adapter) {
      await session.adapter.continue(threadId);
    }
  }

  /**
   * Step over
   */
  async stepOver(sessionId: string, threadId: number = 1): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Debug session not found: ${sessionId}`);
    }

    if (session.isContainer && session.containerAdapter) {
      await session.containerAdapter.stepOver(sessionId, threadId);
    } else if (session.adapter) {
      await session.adapter.stepOver(threadId);
    }
  }

  /**
   * Step into
   */
  async stepInto(sessionId: string, threadId: number = 1): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Debug session not found: ${sessionId}`);
    }

    if (session.isContainer && session.containerAdapter) {
      await session.containerAdapter.stepInto(sessionId, threadId);
    } else if (session.adapter) {
      await session.adapter.stepInto(threadId);
    }
  }

  /**
   * Step out
   */
  async stepOut(sessionId: string, threadId: number = 1): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Debug session not found: ${sessionId}`);
    }

    if (session.isContainer && session.containerAdapter) {
      await session.containerAdapter.stepOut(sessionId, threadId);
    } else if (session.adapter) {
      await session.adapter.stepOut(threadId);
    }
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

    if (session.isContainer && session.containerAdapter) {
      await session.containerAdapter.pause(sessionId, threadId);
    } else if (session.adapter) {
      await session.adapter.pause(threadId);
    }
  }

  /**
   * Get threads
   */
  async getThreads(sessionId: string): Promise<Thread[]> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Debug session not found: ${sessionId}`);
    }

    if (session.isContainer && session.containerAdapter) {
      return session.containerAdapter.getThreads(sessionId);
    } else if (session.adapter) {
      return session.adapter.getThreads();
    }

    return [{ id: 1, name: 'Main Thread' }];
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

    if (session.isContainer && session.containerAdapter) {
      const frames = await session.containerAdapter.getStackTrace(
        sessionId,
        threadId,
        startFrame,
        levels
      );
      return frames.map((f) => ({
        id: f.id,
        name: f.name,
        source: f.source as Source,
        line: f.line,
        column: f.column,
        endLine: f.endLine,
        endColumn: f.endColumn,
      }));
    } else if (session.adapter) {
      return session.adapter.getStackTrace(threadId, startFrame, levels);
    }

    return [];
  }

  /**
   * Get scopes for a stack frame
   */
  async getScopes(sessionId: string, frameId: number): Promise<Scope[]> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Debug session not found: ${sessionId}`);
    }

    if (session.isContainer && session.containerAdapter) {
      return session.containerAdapter.getScopes(sessionId, frameId);
    } else if (session.adapter) {
      return session.adapter.getScopes(frameId);
    }

    return [];
  }

  /**
   * Get variables
   */
  async getVariables(sessionId: string, variablesReference: number): Promise<Variable[]> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Debug session not found: ${sessionId}`);
    }

    if (session.isContainer && session.containerAdapter) {
      return session.containerAdapter.getVariables(sessionId, variablesReference);
    } else if (session.adapter) {
      return session.adapter.getVariables(variablesReference);
    }

    return [];
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

    if (session.isContainer && session.containerAdapter) {
      return session.containerAdapter.evaluate(sessionId, expression, frameId, context);
    } else if (session.adapter) {
      return session.adapter.evaluate(expression, frameId, context);
    }

    return { result: 'Error: No adapter available', variablesReference: 0 };
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
  private setupEventForwarding(sessionId: string, adapter: DebugAdapter, userId: string): void {
    const ws = getWebSocketServer();

    // Forward debug events to WebSocket clients
    const forwardEvent = (event: string, data: unknown) => {
      ws.sendToUser(userId, {
        type: `debug:${event}`,
        payload: {
          sessionId,
          ...(data as object),
        },
        timestamp: Date.now(),
      });

      // Also emit on the manager for local listeners
      this.emit(event, { sessionId, ...(data as object) });
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

  /**
   * Set up event forwarding for container debug adapter
   */
  private setupContainerEventForwarding(
    sessionId: string,
    containerAdapter: ContainerDebugAdapter,
    userId: string
  ): void {
    const ws = getWebSocketServer();

    // Forward debug events to WebSocket clients
    const forwardEvent = (event: string, data: unknown) => {
      ws.sendToUser(userId, {
        type: `debug:${event}`,
        payload: {
          sessionId,
          ...(data as object),
        },
        timestamp: Date.now(),
      });

      // Also emit on the manager for local listeners
      this.emit(event, { sessionId, ...(data as object) });
    };

    // Listen for events from container adapter
    containerAdapter.on('initialized', (data: { sessionId: string }) => {
      if (data.sessionId === sessionId) {
        log.debug('Container debug session initialized', { sessionId });
        forwardEvent('initialized', {});
      }
    });

    containerAdapter.on(
      'stopped',
      (data: { sessionId: string; reason: string; threadId?: number }) => {
        if (data.sessionId === sessionId) {
          const session = this.sessions.get(sessionId);
          if (session) {
            session.info.state = 'paused';
          }
          log.debug('Container debug session stopped', { sessionId, reason: data.reason });
          forwardEvent('stopped', { reason: data.reason, threadId: data.threadId || 1 });
        }
      }
    );

    containerAdapter.on('continued', (data: { sessionId: string; threadId?: number }) => {
      if (data.sessionId === sessionId) {
        const session = this.sessions.get(sessionId);
        if (session) {
          session.info.state = 'running';
        }
        forwardEvent('continued', { threadId: data.threadId || 1 });
      }
    });

    containerAdapter.on('exited', (data: { sessionId: string; exitCode: number }) => {
      if (data.sessionId === sessionId) {
        log.info('Container debug session exited', { sessionId, exitCode: data.exitCode });
        forwardEvent('exited', { exitCode: data.exitCode });
      }
    });

    containerAdapter.on('terminated', (data: { sessionId: string }) => {
      if (data.sessionId === sessionId) {
        const session = this.sessions.get(sessionId);
        if (session) {
          session.info.state = 'stopped';
        }
        log.info('Container debug session terminated', { sessionId });
        forwardEvent('terminated', {});
        this.sessions.delete(sessionId);
      }
    });

    containerAdapter.on(
      'output',
      (data: { sessionId: string; category: string; output: string }) => {
        if (data.sessionId === sessionId) {
          forwardEvent('output', { category: data.category, output: data.output });
        }
      }
    );

    containerAdapter.on('connected', (data: { sessionId: string }) => {
      if (data.sessionId === sessionId) {
        log.info('Container debugger connected', { sessionId });
        forwardEvent('connected', {});
      }
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
