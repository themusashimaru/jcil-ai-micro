import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================================================
// HOISTED MOCKS — declared with vi.hoisted so vi.mock factories can reference
// ============================================================================

const {
  mockAdapter,
  mockContainerAdapter,
  mockBroadcaster,
  mockCreateDebugAdapter,
  mockGetContainerDebugAdapter,
  mockGetDebugEventBroadcaster,
} = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { EventEmitter } = require('events');

  // Create a mock DebugAdapter (extends EventEmitter so events work)
  const mockAdapter = Object.assign(new EventEmitter(), {
    initialize: vi.fn().mockResolvedValue(undefined),
    launch: vi.fn().mockResolvedValue(undefined),
    attach: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    setBreakpoints: vi.fn().mockResolvedValue([]),
    continue: vi.fn().mockResolvedValue(undefined),
    stepOver: vi.fn().mockResolvedValue(undefined),
    stepInto: vi.fn().mockResolvedValue(undefined),
    stepOut: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn().mockResolvedValue(undefined),
    getThreads: vi.fn().mockResolvedValue([{ id: 1, name: 'Main Thread' }]),
    getStackTrace: vi.fn().mockResolvedValue([]),
    getScopes: vi.fn().mockResolvedValue([]),
    getVariables: vi.fn().mockResolvedValue([]),
    evaluate: vi.fn().mockResolvedValue({ result: '42', type: 'number', variablesReference: 0 }),
    getSession: vi.fn().mockReturnValue(null),
  });

  // Create a mock ContainerDebugAdapter (extends EventEmitter)
  const mockContainerAdapter = Object.assign(new EventEmitter(), {
    startSession: vi.fn().mockResolvedValue({
      id: 'container-debug-123',
      workspaceId: 'ws-1',
      config: { type: 'node', program: 'test.js' },
      state: 'running',
      debugPort: 9229,
    }),
    stopSession: vi.fn().mockResolvedValue(undefined),
    setBreakpoints: vi.fn().mockResolvedValue([]),
    continue: vi.fn().mockResolvedValue(undefined),
    stepOver: vi.fn().mockResolvedValue(undefined),
    stepInto: vi.fn().mockResolvedValue(undefined),
    stepOut: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn().mockResolvedValue(undefined),
    getThreads: vi.fn().mockResolvedValue([{ id: 1, name: 'Main Thread' }]),
    getStackTrace: vi.fn().mockResolvedValue([]),
    getScopes: vi.fn().mockResolvedValue([]),
    getVariables: vi.fn().mockResolvedValue([]),
    evaluate: vi.fn().mockResolvedValue({ result: '42', type: 'number', variablesReference: 0 }),
  });

  const mockBroadcaster = {
    registerSession: vi.fn(),
    unregisterSession: vi.fn(),
    initialized: vi.fn(),
    connected: vi.fn(),
    stopped: vi.fn(),
    continued: vi.fn(),
    exited: vi.fn(),
    terminated: vi.fn(),
    output: vi.fn(),
    broadcast: vi.fn(),
  };

  const mockCreateDebugAdapter = vi.fn(() => mockAdapter);
  const mockGetContainerDebugAdapter = vi.fn(() => mockContainerAdapter);
  const mockGetDebugEventBroadcaster = vi.fn(() => mockBroadcaster);

  return {
    mockAdapter,
    mockContainerAdapter,
    mockBroadcaster,
    mockCreateDebugAdapter,
    mockGetContainerDebugAdapter,
    mockGetDebugEventBroadcaster,
  };
});

// ============================================================================
// MODULE MOCKS
// ============================================================================

vi.mock('./debug-adapter', () => ({
  createDebugAdapter: mockCreateDebugAdapter,
}));

vi.mock('./container-debug-adapter', () => ({
  getContainerDebugAdapter: mockGetContainerDebugAdapter,
}));

vi.mock('./debug-event-broadcaster', () => ({
  getDebugEventBroadcaster: mockGetDebugEventBroadcaster,
}));

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// ============================================================================
// IMPORT UNDER TEST (must come after vi.mock)
// ============================================================================

import { DebugManager, getDebugManager } from './debug-manager';
import type { DebugConfiguration, Source } from './debug-adapter';

// ============================================================================
// HELPERS
// ============================================================================

function makeConfig(overrides: Partial<DebugConfiguration> = {}): DebugConfiguration {
  return {
    type: 'node',
    name: 'Test Debug',
    request: 'launch',
    program: 'test.js',
    ...overrides,
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('DebugManager', () => {
  let manager: DebugManager;

  // Store original env values
  const origVercel = process.env.VERCEL;
  const origLambda = process.env.AWS_LAMBDA_FUNCTION_NAME;
  const origE2B = process.env.E2B_API_KEY;

  beforeEach(() => {
    manager = new DebugManager();
    // Ensure env vars are cleared so we default to local debugging
    delete process.env.VERCEL;
    delete process.env.AWS_LAMBDA_FUNCTION_NAME;
    delete process.env.E2B_API_KEY;
    // Reset all mocks
    vi.clearAllMocks();
    // Remove all listeners from shared event emitter mocks
    mockAdapter.removeAllListeners();
    mockContainerAdapter.removeAllListeners();
  });

  afterEach(() => {
    // Restore original env values
    if (origVercel !== undefined) process.env.VERCEL = origVercel;
    else delete process.env.VERCEL;
    if (origLambda !== undefined) process.env.AWS_LAMBDA_FUNCTION_NAME = origLambda;
    else delete process.env.AWS_LAMBDA_FUNCTION_NAME;
    if (origE2B !== undefined) process.env.E2B_API_KEY = origE2B;
    else delete process.env.E2B_API_KEY;
  });

  // --------------------------------------------------------------------------
  // 1. SESSION MANAGEMENT — CREATE / START (LOCAL)
  // --------------------------------------------------------------------------

  describe('startSession (local)', () => {
    it('should create a local debug session with launch request', async () => {
      const config = makeConfig();
      const info = await manager.startSession('user-1', 'ws-1', config);

      expect(info.id).toMatch(/^debug-/);
      expect(info.type).toBe('node');
      expect(info.state).toBe('running');
      expect(info.userId).toBe('user-1');
      expect(info.workspaceId).toBe('ws-1');
      expect(info.isContainer).toBe(false);
      expect(info.startedAt).toBeInstanceOf(Date);
      expect(mockCreateDebugAdapter).toHaveBeenCalledWith('node');
      expect(mockAdapter.initialize).toHaveBeenCalled();
      expect(mockAdapter.launch).toHaveBeenCalledWith(config);
      expect(mockAdapter.attach).not.toHaveBeenCalled();
    });

    it('should create a local debug session with attach request', async () => {
      const config = makeConfig({ request: 'attach', port: 9229, host: 'localhost' });
      const info = await manager.startSession('user-1', 'ws-1', config);

      expect(info.state).toBe('running');
      expect(mockAdapter.attach).toHaveBeenCalledWith(config);
      expect(mockAdapter.launch).not.toHaveBeenCalled();
    });

    it('should register the session with the event broadcaster', async () => {
      await manager.startSession('user-1', 'ws-1', makeConfig());

      expect(mockBroadcaster.registerSession).toHaveBeenCalled();
    });

    it('should support python debug type', async () => {
      const config = makeConfig({ type: 'python', program: 'main.py' });
      await manager.startSession('user-1', 'ws-1', config);

      expect(mockCreateDebugAdapter).toHaveBeenCalledWith('python');
    });
  });

  // --------------------------------------------------------------------------
  // 2. SESSION MANAGEMENT — CONTAINER MODE
  // --------------------------------------------------------------------------

  describe('startSession (container)', () => {
    it('should use container mode when VERCEL env is set', async () => {
      process.env.VERCEL = '1';
      const config = makeConfig();
      const info = await manager.startSession('user-1', 'ws-1', config);

      expect(info.isContainer).toBe(true);
      expect(info.id).toBe('container-debug-123');
      expect(mockGetContainerDebugAdapter).toHaveBeenCalled();
      expect(mockContainerAdapter.startSession).toHaveBeenCalled();
    });

    it('should use container mode when AWS_LAMBDA_FUNCTION_NAME env is set', async () => {
      process.env.AWS_LAMBDA_FUNCTION_NAME = 'my-function';
      const info = await manager.startSession('user-1', 'ws-1', makeConfig());

      expect(info.isContainer).toBe(true);
    });

    it('should use container mode when E2B_API_KEY env is set', async () => {
      process.env.E2B_API_KEY = 'test-key';
      const info = await manager.startSession('user-1', 'ws-1', makeConfig());

      expect(info.isContainer).toBe(true);
    });

    it('should use container mode when useContainer flag is set in config', async () => {
      const config = { ...makeConfig(), useContainer: true };
      const info = await manager.startSession('user-1', 'ws-1', config);

      expect(info.isContainer).toBe(true);
    });

    it('should map container running state correctly', async () => {
      mockContainerAdapter.startSession.mockResolvedValueOnce({
        id: 'container-debug-run',
        state: 'running',
        debugPort: 9229,
      });
      const config = { ...makeConfig(), useContainer: true };
      const info = await manager.startSession('user-1', 'ws-1', config);
      expect(info.state).toBe('running');
    });

    it('should map container paused state correctly', async () => {
      mockContainerAdapter.startSession.mockResolvedValueOnce({
        id: 'container-debug-paused',
        state: 'paused',
        debugPort: 9229,
      });
      const config = { ...makeConfig(), useContainer: true };
      const info = await manager.startSession('user-1', 'ws-1', config);
      expect(info.state).toBe('paused');
    });

    it('should map container error state to stopped', async () => {
      mockContainerAdapter.startSession.mockResolvedValueOnce({
        id: 'container-debug-err',
        state: 'error',
        debugPort: 9229,
      });
      const config = { ...makeConfig(), useContainer: true };
      const info = await manager.startSession('user-1', 'ws-1', config);
      expect(info.state).toBe('stopped');
    });

    it('should register container session with language metadata', async () => {
      const config = { ...makeConfig(), useContainer: true };
      await manager.startSession('user-1', 'ws-1', config);

      expect(mockBroadcaster.registerSession).toHaveBeenCalledWith('container-debug-123', {
        language: 'container',
      });
    });
  });

  // --------------------------------------------------------------------------
  // 3. SESSION MANAGEMENT — STOP
  // --------------------------------------------------------------------------

  describe('stopSession', () => {
    it('should stop a local session and remove it', async () => {
      const info = await manager.startSession('user-1', 'ws-1', makeConfig());
      await manager.stopSession(info.id);

      expect(mockAdapter.disconnect).toHaveBeenCalled();
      expect(manager.getSession(info.id)).toBeNull();
    });

    it('should stop a container session and remove it', async () => {
      const config = { ...makeConfig(), useContainer: true };
      const info = await manager.startSession('user-1', 'ws-1', config);
      await manager.stopSession(info.id);

      expect(mockContainerAdapter.stopSession).toHaveBeenCalledWith(info.id);
      expect(manager.getSession(info.id)).toBeNull();
    });

    it('should throw when stopping a non-existent session', async () => {
      await expect(manager.stopSession('nonexistent')).rejects.toThrow(
        'Debug session not found: nonexistent'
      );
    });
  });

  // --------------------------------------------------------------------------
  // 4. BREAKPOINT MANAGEMENT
  // --------------------------------------------------------------------------

  describe('setBreakpoints', () => {
    const source: Source = { path: '/app/test.js', name: 'test.js' };
    const breakpoints = [{ line: 10 }, { line: 20, column: 5 }, { line: 30, condition: 'x > 10' }];

    it('should set breakpoints on a local session via adapter', async () => {
      const expectedBps = [
        { id: 1, verified: true, line: 10, source },
        { id: 2, verified: true, line: 20, column: 5, source },
        { id: 3, verified: true, line: 30, source, message: 'condition: x > 10' },
      ];
      mockAdapter.setBreakpoints.mockResolvedValueOnce(expectedBps);

      const info = await manager.startSession('user-1', 'ws-1', makeConfig());
      const result = await manager.setBreakpoints(info.id, source, breakpoints);

      expect(mockAdapter.setBreakpoints).toHaveBeenCalledWith(source, breakpoints);
      expect(result).toEqual(expectedBps);
    });

    it('should set breakpoints on a container session', async () => {
      const containerBps = [
        { id: 1, verified: true, line: 10, source: { path: '/app/test.js' } },
        {
          id: 2,
          verified: false,
          line: 20,
          column: 5,
          source: { path: '/app/test.js' },
          message: 'pending',
        },
      ];
      mockContainerAdapter.setBreakpoints.mockResolvedValueOnce(containerBps);

      const config = { ...makeConfig(), useContainer: true };
      const info = await manager.startSession('user-1', 'ws-1', config);
      const result = await manager.setBreakpoints(info.id, source, breakpoints);

      expect(mockContainerAdapter.setBreakpoints).toHaveBeenCalledWith(
        info.id,
        source,
        breakpoints
      );
      expect(result).toHaveLength(2);
      expect(result[0].verified).toBe(true);
      expect(result[1].verified).toBe(false);
    });

    it('should throw when setting breakpoints on non-existent session', async () => {
      await expect(manager.setBreakpoints('bad-id', source, breakpoints)).rejects.toThrow(
        'Debug session not found: bad-id'
      );
    });

    it('should set conditional breakpoints', async () => {
      const conditionalBps = [{ line: 15, condition: 'count === 5' }];
      const expectedBps = [{ id: 1, verified: true, line: 15, source, message: 'condition met' }];
      mockAdapter.setBreakpoints.mockResolvedValueOnce(expectedBps);

      const info = await manager.startSession('user-1', 'ws-1', makeConfig());
      const result = await manager.setBreakpoints(info.id, source, conditionalBps);

      expect(mockAdapter.setBreakpoints).toHaveBeenCalledWith(source, conditionalBps);
      expect(result).toEqual(expectedBps);
    });
  });

  // --------------------------------------------------------------------------
  // 5. STEP OPERATIONS
  // --------------------------------------------------------------------------

  describe('step operations', () => {
    it('should step over on a local session', async () => {
      const info = await manager.startSession('user-1', 'ws-1', makeConfig());
      await manager.stepOver(info.id, 1);

      expect(mockAdapter.stepOver).toHaveBeenCalledWith(1);
    });

    it('should step into on a local session', async () => {
      const info = await manager.startSession('user-1', 'ws-1', makeConfig());
      await manager.stepInto(info.id, 1);

      expect(mockAdapter.stepInto).toHaveBeenCalledWith(1);
    });

    it('should step out on a local session', async () => {
      const info = await manager.startSession('user-1', 'ws-1', makeConfig());
      await manager.stepOut(info.id, 1);

      expect(mockAdapter.stepOut).toHaveBeenCalledWith(1);
    });

    it('should step over on a container session', async () => {
      const config = { ...makeConfig(), useContainer: true };
      const info = await manager.startSession('user-1', 'ws-1', config);
      await manager.stepOver(info.id, 2);

      expect(mockContainerAdapter.stepOver).toHaveBeenCalledWith(info.id, 2);
    });

    it('should step into on a container session', async () => {
      const config = { ...makeConfig(), useContainer: true };
      const info = await manager.startSession('user-1', 'ws-1', config);
      await manager.stepInto(info.id, 2);

      expect(mockContainerAdapter.stepInto).toHaveBeenCalledWith(info.id, 2);
    });

    it('should step out on a container session', async () => {
      const config = { ...makeConfig(), useContainer: true };
      const info = await manager.startSession('user-1', 'ws-1', config);
      await manager.stepOut(info.id, 2);

      expect(mockContainerAdapter.stepOut).toHaveBeenCalledWith(info.id, 2);
    });

    it('should throw for step over on non-existent session', async () => {
      await expect(manager.stepOver('nope')).rejects.toThrow('Debug session not found: nope');
    });

    it('should throw for step into on non-existent session', async () => {
      await expect(manager.stepInto('nope')).rejects.toThrow('Debug session not found: nope');
    });

    it('should throw for step out on non-existent session', async () => {
      await expect(manager.stepOut('nope')).rejects.toThrow('Debug session not found: nope');
    });

    it('should use default threadId=1 when not specified', async () => {
      const info = await manager.startSession('user-1', 'ws-1', makeConfig());
      await manager.stepOver(info.id);

      expect(mockAdapter.stepOver).toHaveBeenCalledWith(1);
    });
  });

  // --------------------------------------------------------------------------
  // 6. CONTINUE / PAUSE
  // --------------------------------------------------------------------------

  describe('continue', () => {
    it('should continue execution on a local session and set state to running', async () => {
      const info = await manager.startSession('user-1', 'ws-1', makeConfig());

      await manager.continue(info.id, 1);

      expect(mockAdapter.continue).toHaveBeenCalledWith(1);
      expect(manager.getSession(info.id)?.state).toBe('running');
    });

    it('should continue execution on a container session', async () => {
      const config = { ...makeConfig(), useContainer: true };
      const info = await manager.startSession('user-1', 'ws-1', config);
      await manager.continue(info.id, 1);

      expect(mockContainerAdapter.continue).toHaveBeenCalledWith(info.id, 1);
      expect(manager.getSession(info.id)?.state).toBe('running');
    });

    it('should throw for continue on non-existent session', async () => {
      await expect(manager.continue('nope')).rejects.toThrow('Debug session not found: nope');
    });
  });

  describe('pause', () => {
    it('should pause execution on a local session and set state to paused', async () => {
      const info = await manager.startSession('user-1', 'ws-1', makeConfig());
      await manager.pause(info.id, 1);

      expect(mockAdapter.pause).toHaveBeenCalledWith(1);
      expect(manager.getSession(info.id)?.state).toBe('paused');
    });

    it('should pause execution on a container session', async () => {
      const config = { ...makeConfig(), useContainer: true };
      const info = await manager.startSession('user-1', 'ws-1', config);
      await manager.pause(info.id, 1);

      expect(mockContainerAdapter.pause).toHaveBeenCalledWith(info.id, 1);
      expect(manager.getSession(info.id)?.state).toBe('paused');
    });

    it('should throw for pause on non-existent session', async () => {
      await expect(manager.pause('nope')).rejects.toThrow('Debug session not found: nope');
    });
  });

  // --------------------------------------------------------------------------
  // 7. VARIABLE INSPECTION
  // --------------------------------------------------------------------------

  describe('getVariables', () => {
    it('should get variables from a local session', async () => {
      const vars = [
        { name: 'x', value: '42', type: 'number', variablesReference: 0 },
        { name: 'arr', value: 'Array(3)', type: 'object', variablesReference: 5 },
      ];
      mockAdapter.getVariables.mockResolvedValueOnce(vars);

      const info = await manager.startSession('user-1', 'ws-1', makeConfig());
      const result = await manager.getVariables(info.id, 1);

      expect(mockAdapter.getVariables).toHaveBeenCalledWith(1);
      expect(result).toEqual(vars);
    });

    it('should get variables from a container session', async () => {
      const vars = [{ name: 'y', value: '"hello"', type: 'string', variablesReference: 0 }];
      mockContainerAdapter.getVariables.mockResolvedValueOnce(vars);

      const config = { ...makeConfig(), useContainer: true };
      const info = await manager.startSession('user-1', 'ws-1', config);
      const result = await manager.getVariables(info.id, 3);

      expect(mockContainerAdapter.getVariables).toHaveBeenCalledWith(info.id, 3);
      expect(result).toEqual(vars);
    });

    it('should throw for getVariables on non-existent session', async () => {
      await expect(manager.getVariables('nope', 1)).rejects.toThrow(
        'Debug session not found: nope'
      );
    });
  });

  // --------------------------------------------------------------------------
  // 8. STACK TRACE HANDLING
  // --------------------------------------------------------------------------

  describe('getStackTrace', () => {
    it('should get stack trace from a local session', async () => {
      const frames = [
        { id: 0, name: 'main', source: { path: '/test.js' }, line: 10, column: 1 },
        { id: 1, name: 'helper', source: { path: '/util.js' }, line: 5, column: 3 },
      ];
      mockAdapter.getStackTrace.mockResolvedValueOnce(frames);

      const info = await manager.startSession('user-1', 'ws-1', makeConfig());
      const result = await manager.getStackTrace(info.id, 1, 0, 20);

      expect(mockAdapter.getStackTrace).toHaveBeenCalledWith(1, 0, 20);
      expect(result).toEqual(frames);
    });

    it('should get stack trace from a container session and map to StackFrame format', async () => {
      const containerFrames = [
        {
          id: 0,
          name: 'main',
          source: { path: '/test.js', name: 'test.js' },
          line: 10,
          column: 1,
          endLine: 10,
          endColumn: 20,
        },
      ];
      mockContainerAdapter.getStackTrace.mockResolvedValueOnce(containerFrames);

      const config = { ...makeConfig(), useContainer: true };
      const info = await manager.startSession('user-1', 'ws-1', config);
      const result = await manager.getStackTrace(info.id, 1, 0, 10);

      expect(mockContainerAdapter.getStackTrace).toHaveBeenCalledWith(info.id, 1, 0, 10);
      expect(result[0]).toEqual({
        id: 0,
        name: 'main',
        source: { path: '/test.js', name: 'test.js' },
        line: 10,
        column: 1,
        endLine: 10,
        endColumn: 20,
      });
    });

    it('should throw for getStackTrace on non-existent session', async () => {
      await expect(manager.getStackTrace('nope')).rejects.toThrow('Debug session not found: nope');
    });
  });

  // --------------------------------------------------------------------------
  // 9. SCOPES
  // --------------------------------------------------------------------------

  describe('getScopes', () => {
    it('should get scopes from a local session', async () => {
      const scopes = [
        { name: 'Local', variablesReference: 1, expensive: false },
        { name: 'Global', variablesReference: 2, expensive: true },
      ];
      mockAdapter.getScopes.mockResolvedValueOnce(scopes);

      const info = await manager.startSession('user-1', 'ws-1', makeConfig());
      const result = await manager.getScopes(info.id, 0);

      expect(mockAdapter.getScopes).toHaveBeenCalledWith(0);
      expect(result).toEqual(scopes);
    });

    it('should get scopes from a container session', async () => {
      const scopes = [{ name: 'Locals', variablesReference: 10, expensive: false }];
      mockContainerAdapter.getScopes.mockResolvedValueOnce(scopes);

      const config = { ...makeConfig(), useContainer: true };
      const info = await manager.startSession('user-1', 'ws-1', config);
      const result = await manager.getScopes(info.id, 0);

      expect(mockContainerAdapter.getScopes).toHaveBeenCalledWith(info.id, 0);
      expect(result).toEqual(scopes);
    });

    it('should throw for getScopes on non-existent session', async () => {
      await expect(manager.getScopes('nope', 0)).rejects.toThrow('Debug session not found: nope');
    });
  });

  // --------------------------------------------------------------------------
  // 10. THREADS
  // --------------------------------------------------------------------------

  describe('getThreads', () => {
    it('should get threads from a local session', async () => {
      const threads = [
        { id: 1, name: 'Main Thread' },
        { id: 2, name: 'Worker Thread' },
      ];
      mockAdapter.getThreads.mockResolvedValueOnce(threads);

      const info = await manager.startSession('user-1', 'ws-1', makeConfig());
      const result = await manager.getThreads(info.id);

      expect(mockAdapter.getThreads).toHaveBeenCalled();
      expect(result).toEqual(threads);
    });

    it('should get threads from a container session', async () => {
      const threads = [{ id: 1, name: 'Main Thread' }];
      mockContainerAdapter.getThreads.mockResolvedValueOnce(threads);

      const config = { ...makeConfig(), useContainer: true };
      const info = await manager.startSession('user-1', 'ws-1', config);
      const result = await manager.getThreads(info.id);

      expect(mockContainerAdapter.getThreads).toHaveBeenCalledWith(info.id);
      expect(result).toEqual(threads);
    });

    it('should throw for getThreads on non-existent session', async () => {
      await expect(manager.getThreads('nope')).rejects.toThrow('Debug session not found: nope');
    });
  });

  // --------------------------------------------------------------------------
  // 11. EVALUATE EXPRESSION
  // --------------------------------------------------------------------------

  describe('evaluate', () => {
    it('should evaluate expression on a local session', async () => {
      mockAdapter.evaluate.mockResolvedValueOnce({
        result: '"hello world"',
        type: 'string',
        variablesReference: 0,
      });

      const info = await manager.startSession('user-1', 'ws-1', makeConfig());
      const result = await manager.evaluate(info.id, '1 + 1', 0, 'repl');

      expect(mockAdapter.evaluate).toHaveBeenCalledWith('1 + 1', 0, 'repl');
      expect(result.result).toBe('"hello world"');
    });

    it('should evaluate expression on a container session', async () => {
      mockContainerAdapter.evaluate.mockResolvedValueOnce({
        result: '100',
        type: 'number',
        variablesReference: 0,
      });

      const config = { ...makeConfig(), useContainer: true };
      const info = await manager.startSession('user-1', 'ws-1', config);
      const result = await manager.evaluate(info.id, 'x * 10', 0, 'watch');

      expect(mockContainerAdapter.evaluate).toHaveBeenCalledWith(info.id, 'x * 10', 0, 'watch');
      expect(result.result).toBe('100');
    });

    it('should throw for evaluate on non-existent session', async () => {
      await expect(manager.evaluate('nope', 'x')).rejects.toThrow('Debug session not found: nope');
    });
  });

  // --------------------------------------------------------------------------
  // 12. SESSION QUERIES
  // --------------------------------------------------------------------------

  describe('getSession / getUserSessions / getWorkspaceSessions', () => {
    it('should return session info by id', async () => {
      const info = await manager.startSession('user-1', 'ws-1', makeConfig());
      const retrieved = manager.getSession(info.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(info.id);
      expect(retrieved?.userId).toBe('user-1');
    });

    it('should return null for non-existent session', () => {
      expect(manager.getSession('no-such-id')).toBeNull();
    });

    it('should return sessions filtered by userId', async () => {
      await manager.startSession('user-1', 'ws-1', makeConfig());
      await manager.startSession('user-1', 'ws-2', makeConfig());
      await manager.startSession('user-2', 'ws-3', makeConfig());

      const user1Sessions = manager.getUserSessions('user-1');
      const user2Sessions = manager.getUserSessions('user-2');
      const user3Sessions = manager.getUserSessions('user-3');

      expect(user1Sessions).toHaveLength(2);
      expect(user2Sessions).toHaveLength(1);
      expect(user3Sessions).toHaveLength(0);
    });

    it('should return sessions filtered by workspaceId', async () => {
      await manager.startSession('user-1', 'ws-1', makeConfig());
      await manager.startSession('user-2', 'ws-1', makeConfig());
      await manager.startSession('user-1', 'ws-2', makeConfig());

      const ws1Sessions = manager.getWorkspaceSessions('ws-1');
      const ws2Sessions = manager.getWorkspaceSessions('ws-2');
      const ws3Sessions = manager.getWorkspaceSessions('ws-99');

      expect(ws1Sessions).toHaveLength(2);
      expect(ws2Sessions).toHaveLength(1);
      expect(ws3Sessions).toHaveLength(0);
    });
  });

  // --------------------------------------------------------------------------
  // 13. EVENT FORWARDING (local adapter)
  // --------------------------------------------------------------------------

  describe('event forwarding (local)', () => {
    it('should forward "stopped" event and set state to paused', async () => {
      const info = await manager.startSession('user-1', 'ws-1', makeConfig());
      const stoppedHandler = vi.fn();
      manager.on('stopped', stoppedHandler);

      mockAdapter.emit('stopped', { reason: 'breakpoint', threadId: 1 });

      expect(stoppedHandler).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: info.id, reason: 'breakpoint', threadId: 1 })
      );
      expect(manager.getSession(info.id)?.state).toBe('paused');
      expect(mockBroadcaster.stopped).toHaveBeenCalled();
    });

    it('should forward "continued" event and set state to running', async () => {
      const info = await manager.startSession('user-1', 'ws-1', makeConfig());
      const continuedHandler = vi.fn();
      manager.on('continued', continuedHandler);

      mockAdapter.emit('continued', { threadId: 1 });

      expect(continuedHandler).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: info.id, threadId: 1 })
      );
      expect(manager.getSession(info.id)?.state).toBe('running');
    });

    it('should forward "terminated" event and remove session', async () => {
      const info = await manager.startSession('user-1', 'ws-1', makeConfig());
      const terminatedHandler = vi.fn();
      manager.on('terminated', terminatedHandler);

      mockAdapter.emit('terminated');

      expect(terminatedHandler).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: info.id })
      );
      expect(manager.getSession(info.id)).toBeNull();
      expect(mockBroadcaster.terminated).toHaveBeenCalledWith(info.id);
    });

    it('should forward "exited" event', async () => {
      const info = await manager.startSession('user-1', 'ws-1', makeConfig());
      const exitedHandler = vi.fn();
      manager.on('exited', exitedHandler);

      mockAdapter.emit('exited', { exitCode: 0 });

      expect(exitedHandler).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: info.id, exitCode: 0 })
      );
      expect(mockBroadcaster.exited).toHaveBeenCalled();
    });

    it('should forward "output" event', async () => {
      const info = await manager.startSession('user-1', 'ws-1', makeConfig());
      const outputHandler = vi.fn();
      manager.on('output', outputHandler);

      mockAdapter.emit('output', { category: 'stdout', output: 'Hello World\n' });

      expect(outputHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: info.id,
          category: 'stdout',
          output: 'Hello World\n',
        })
      );
      expect(mockBroadcaster.output).toHaveBeenCalled();
    });

    it('should forward "initialized" event', async () => {
      const info = await manager.startSession('user-1', 'ws-1', makeConfig());
      const initHandler = vi.fn();
      manager.on('initialized', initHandler);

      mockAdapter.emit('initialized');

      expect(initHandler).toHaveBeenCalledWith(expect.objectContaining({ sessionId: info.id }));
      expect(mockBroadcaster.initialized).toHaveBeenCalledWith(info.id);
    });

    it('should forward "breakpoint" event via broadcast', async () => {
      const info = await manager.startSession('user-1', 'ws-1', makeConfig());
      const bpHandler = vi.fn();
      manager.on('breakpoint', bpHandler);

      mockAdapter.emit('breakpoint', {
        reason: 'changed',
        breakpoint: { id: 1, verified: true },
      });

      expect(bpHandler).toHaveBeenCalled();
      expect(mockBroadcaster.broadcast).toHaveBeenCalledWith(
        'debug:breakpoint',
        info.id,
        expect.objectContaining({ reason: 'changed' })
      );
    });
  });

  // --------------------------------------------------------------------------
  // 14. EVENT FORWARDING (container adapter)
  // --------------------------------------------------------------------------

  describe('event forwarding (container)', () => {
    it('should forward container "stopped" event for matching session', async () => {
      const config = { ...makeConfig(), useContainer: true };
      const info = await manager.startSession('user-1', 'ws-1', config);
      const stoppedHandler = vi.fn();
      manager.on('stopped', stoppedHandler);

      mockContainerAdapter.emit('stopped', {
        sessionId: info.id,
        reason: 'breakpoint',
        threadId: 1,
      });

      expect(stoppedHandler).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: info.id, reason: 'breakpoint', threadId: 1 })
      );
      expect(manager.getSession(info.id)?.state).toBe('paused');
    });

    it('should ignore container events for non-matching session ids', async () => {
      const config = { ...makeConfig(), useContainer: true };
      await manager.startSession('user-1', 'ws-1', config);
      const stoppedHandler = vi.fn();
      manager.on('stopped', stoppedHandler);

      // Emit with a different session id
      mockContainerAdapter.emit('stopped', {
        sessionId: 'other-session',
        reason: 'breakpoint',
        threadId: 1,
      });

      expect(stoppedHandler).not.toHaveBeenCalled();
    });

    it('should forward container "terminated" event and remove session', async () => {
      const config = { ...makeConfig(), useContainer: true };
      const info = await manager.startSession('user-1', 'ws-1', config);
      const terminatedHandler = vi.fn();
      manager.on('terminated', terminatedHandler);

      mockContainerAdapter.emit('terminated', { sessionId: info.id });

      expect(terminatedHandler).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: info.id })
      );
      expect(manager.getSession(info.id)).toBeNull();
    });

    it('should forward container "output" event', async () => {
      const config = { ...makeConfig(), useContainer: true };
      const info = await manager.startSession('user-1', 'ws-1', config);
      const outputHandler = vi.fn();
      manager.on('output', outputHandler);

      mockContainerAdapter.emit('output', {
        sessionId: info.id,
        category: 'stderr',
        output: 'Error: test\n',
      });

      expect(outputHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: info.id,
          category: 'stderr',
          output: 'Error: test\n',
        })
      );
    });

    it('should forward container "connected" event', async () => {
      const config = { ...makeConfig(), useContainer: true };
      const info = await manager.startSession('user-1', 'ws-1', config);
      const connectedHandler = vi.fn();
      manager.on('connected', connectedHandler);

      mockContainerAdapter.emit('connected', { sessionId: info.id });

      expect(connectedHandler).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: info.id })
      );
      expect(mockBroadcaster.connected).toHaveBeenCalledWith(info.id);
    });

    it('should forward container "continued" event and set state to running', async () => {
      const config = { ...makeConfig(), useContainer: true };
      const info = await manager.startSession('user-1', 'ws-1', config);

      mockContainerAdapter.emit('continued', { sessionId: info.id, threadId: 1 });

      expect(manager.getSession(info.id)?.state).toBe('running');
    });

    it('should forward container "exited" event', async () => {
      const config = { ...makeConfig(), useContainer: true };
      const info = await manager.startSession('user-1', 'ws-1', config);
      const exitedHandler = vi.fn();
      manager.on('exited', exitedHandler);

      mockContainerAdapter.emit('exited', { sessionId: info.id, exitCode: 1 });

      expect(exitedHandler).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: info.id, exitCode: 1 })
      );
    });
  });

  // --------------------------------------------------------------------------
  // 15. SINGLETON
  // --------------------------------------------------------------------------

  describe('getDebugManager singleton', () => {
    it('should return the same instance on subsequent calls', () => {
      const a = getDebugManager();
      const b = getDebugManager();
      expect(a).toBe(b);
    });

    it('should return an instance of DebugManager', () => {
      const mgr = getDebugManager();
      expect(mgr).toBeInstanceOf(DebugManager);
    });
  });

  // --------------------------------------------------------------------------
  // 16. EDGE CASES / ERROR HANDLING
  // --------------------------------------------------------------------------

  describe('error handling and edge cases', () => {
    it('should return default evaluate result when no adapter is active', async () => {
      const config = makeConfig();
      const info = await manager.startSession('user-1', 'ws-1', config);
      const result = await manager.evaluate(info.id, '1+1');
      expect(result).toHaveProperty('result');
      expect(result).toHaveProperty('variablesReference');
    });

    it('should return empty array for getStackTrace from adapter', async () => {
      const info = await manager.startSession('user-1', 'ws-1', makeConfig());
      const frames = await manager.getStackTrace(info.id);
      expect(Array.isArray(frames)).toBe(true);
    });

    it('should return empty array for getScopes from adapter', async () => {
      const info = await manager.startSession('user-1', 'ws-1', makeConfig());
      const scopes = await manager.getScopes(info.id, 0);
      expect(Array.isArray(scopes)).toBe(true);
    });

    it('should return empty array for getVariables from adapter', async () => {
      const info = await manager.startSession('user-1', 'ws-1', makeConfig());
      const vars = await manager.getVariables(info.id, 0);
      expect(Array.isArray(vars)).toBe(true);
    });

    it('should store correct configuration in session info', async () => {
      const config = makeConfig({
        program: 'app.js',
        args: ['--port', '3000'],
        cwd: '/workspace',
        env: { NODE_ENV: 'development' },
      });
      const info = await manager.startSession('user-1', 'ws-1', config);

      expect(info.configuration).toEqual(config);
      expect(info.configuration.program).toBe('app.js');
      expect(info.configuration.args).toEqual(['--port', '3000']);
    });
  });
});
