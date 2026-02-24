import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================================================
// HOISTED MOCKS
// ============================================================================

const { mockCreateConnection, mockSocketInstance } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { EventEmitter } = require('events') as typeof import('events');

  const mockSocketInstance = Object.assign(new EventEmitter(), {
    write: vi.fn(),
    destroy: vi.fn(),
    destroyed: false,
  });

  const mockCreateConnection = vi.fn((_opts: Record<string, unknown>, connectCb?: () => void) => {
    // Schedule the connect callback for next tick so callers can attach listeners first
    if (connectCb) {
      process.nextTick(connectCb);
    }
    return mockSocketInstance;
  });

  return { mockCreateConnection, mockSocketInstance };
});

// ============================================================================
// MODULE MOCKS
// ============================================================================

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('net', () => ({
  createConnection: mockCreateConnection,
}));

// ============================================================================
// IMPORTS (after mocks)
// ============================================================================

import { EventEmitter } from 'events';
import { DAPClient, dapClient } from './dap-client';

import type {
  DAPSource,
  DAPBreakpoint,
  DAPStackFrame,
  DAPScope,
  DAPVariable,
  DAPThread,
  DAPCapabilities,
  DAPClientEvents,
} from './dap-client';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Build a DAP-protocol-framed message (Content-Length header + JSON body)
 */
function buildDAPMessage(obj: Record<string, unknown>): Buffer {
  const body = JSON.stringify(obj);
  const header = `Content-Length: ${Buffer.byteLength(body, 'utf-8')}\r\n\r\n`;
  return Buffer.from(header + body, 'utf-8');
}

/**
 * Build a DAP response message
 */
function buildResponse(
  requestSeq: number,
  command: string,
  body?: Record<string, unknown>,
  success = true,
  message?: string
): Buffer {
  return buildDAPMessage({
    seq: 0,
    type: 'response',
    request_seq: requestSeq,
    success,
    command,
    body,
    message,
  });
}

/**
 * Build a DAP event message
 */
function buildEvent(event: string, body?: Record<string, unknown>): Buffer {
  return buildDAPMessage({
    seq: 0,
    type: 'event',
    event,
    body,
  });
}

// ============================================================================
// TYPE EXPORT TESTS
// ============================================================================

describe('Type exports', () => {
  it('should export DAPSource type', () => {
    const source: DAPSource = {
      name: 'test.py',
      path: '/test.py',
      sourceReference: 0,
      presentationHint: 'normal',
    };
    expect(source.name).toBe('test.py');
    expect(source.path).toBe('/test.py');
  });

  it('should export DAPSource with optional nested sources', () => {
    const source: DAPSource = {
      name: 'parent.py',
      sources: [{ name: 'child.py' }],
      checksums: [{ algorithm: 'md5', checksum: 'abc123' }],
    };
    expect(source.sources).toHaveLength(1);
    expect(source.checksums![0].algorithm).toBe('md5');
  });

  it('should export DAPBreakpoint type', () => {
    const bp: DAPBreakpoint = {
      id: 1,
      verified: true,
      line: 10,
      column: 1,
      source: { path: '/test.py' },
    };
    expect(bp.id).toBe(1);
    expect(bp.verified).toBe(true);
  });

  it('should export DAPBreakpoint with optional fields', () => {
    const bp: DAPBreakpoint = {
      verified: false,
      message: 'Pending',
      endLine: 20,
      endColumn: 5,
      instructionReference: '0x1234',
      offset: 10,
    };
    expect(bp.verified).toBe(false);
    expect(bp.message).toBe('Pending');
  });

  it('should export DAPStackFrame type', () => {
    const frame: DAPStackFrame = {
      id: 1,
      name: 'main',
      line: 5,
      column: 1,
      source: { path: '/test.py' },
    };
    expect(frame.id).toBe(1);
    expect(frame.name).toBe('main');
  });

  it('should export DAPStackFrame with all optional fields', () => {
    const frame: DAPStackFrame = {
      id: 2,
      name: '<module>',
      line: 1,
      column: 0,
      endLine: 50,
      endColumn: 0,
      canRestart: true,
      instructionPointerReference: '0xABC',
      moduleId: 'mod1',
      presentationHint: 'normal',
    };
    expect(frame.canRestart).toBe(true);
    expect(frame.presentationHint).toBe('normal');
  });

  it('should export DAPScope type', () => {
    const scope: DAPScope = {
      name: 'Locals',
      variablesReference: 1,
      expensive: false,
      presentationHint: 'locals',
    };
    expect(scope.name).toBe('Locals');
    expect(scope.expensive).toBe(false);
  });

  it('should export DAPVariable type', () => {
    const variable: DAPVariable = {
      name: 'x',
      value: '42',
      type: 'int',
      variablesReference: 0,
    };
    expect(variable.name).toBe('x');
    expect(variable.value).toBe('42');
  });

  it('should export DAPVariable with presentationHint', () => {
    const variable: DAPVariable = {
      name: 'secret',
      value: '***',
      variablesReference: 0,
      presentationHint: {
        kind: 'property',
        attributes: ['readOnly'],
        visibility: 'private',
        lazy: true,
      },
      evaluateName: 'self.secret',
      memoryReference: '0xFF',
    };
    expect(variable.presentationHint?.visibility).toBe('private');
    expect(variable.presentationHint?.lazy).toBe(true);
  });

  it('should export DAPThread type', () => {
    const thread: DAPThread = { id: 1, name: 'MainThread' };
    expect(thread.id).toBe(1);
    expect(thread.name).toBe('MainThread');
  });

  it('should export DAPCapabilities type', () => {
    const caps: DAPCapabilities = {
      supportsConfigurationDoneRequest: true,
      supportsConditionalBreakpoints: true,
      supportsEvaluateForHovers: true,
      supportsStepBack: false,
    };
    expect(caps.supportsConfigurationDoneRequest).toBe(true);
    expect(caps.supportsStepBack).toBe(false);
  });

  it('should export DAPCapabilities with all optional fields', () => {
    const caps: DAPCapabilities = {
      supportsConfigurationDoneRequest: true,
      supportsFunctionBreakpoints: true,
      supportsConditionalBreakpoints: true,
      supportsHitConditionalBreakpoints: true,
      supportsEvaluateForHovers: true,
      supportsStepBack: true,
      supportsSetVariable: true,
      supportsRestartFrame: true,
      supportsStepInTargetsRequest: true,
      supportsCompletionsRequest: true,
      supportsModulesRequest: true,
      supportsExceptionOptions: true,
      supportsValueFormattingOptions: true,
      supportsExceptionInfoRequest: true,
      supportTerminateDebuggee: true,
      supportsDelayedStackTraceLoading: true,
      supportsLogPoints: true,
      supportsTerminateThreadsRequest: true,
      supportsSetExpression: true,
      supportsTerminateRequest: true,
      supportsDataBreakpoints: true,
      supportsReadMemoryRequest: true,
      supportsDisassembleRequest: true,
      supportsCancelRequest: true,
      supportsBreakpointLocationsRequest: true,
      supportsClipboardContext: true,
      supportsSteppingGranularity: true,
      supportsInstructionBreakpoints: true,
      supportsExceptionFilterOptions: true,
    };
    expect(caps.supportTerminateDebuggee).toBe(true);
    expect(caps.supportsExceptionFilterOptions).toBe(true);
  });

  it('should export DAPClientEvents interface (compile-time check)', () => {
    const events: Partial<DAPClientEvents> = {
      connected: undefined,
      disconnected: { reason: 'test' },
      error: { error: new Error('test') },
      stopped: { reason: 'breakpoint', threadId: 1 },
      continued: { threadId: 1, allThreadsContinued: true },
      exited: { exitCode: 0 },
      terminated: {},
      thread: { reason: 'started', threadId: 1 },
      output: { output: 'hello', category: 'stdout' },
      breakpoint: { reason: 'new', breakpoint: { verified: true } },
      module: { reason: 'new', module: { id: 1, name: 'mod' } },
      process: { name: 'python', startMethod: 'launch' },
    };
    expect(events.stopped?.reason).toBe('breakpoint');
    expect(events.exited?.exitCode).toBe(0);
  });
});

// ============================================================================
// DAPClient CLASS TESTS
// ============================================================================

describe('DAPClient', () => {
  let client: DAPClient;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    client = new DAPClient();
    // Reset the mock socket state
    mockSocketInstance.destroyed = false;
    mockSocketInstance.removeAllListeners();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // --------------------------------------------------------------------------
  // Constructor & initial state
  // --------------------------------------------------------------------------

  describe('constructor', () => {
    it('should create an instance that extends EventEmitter', () => {
      expect(client).toBeInstanceOf(EventEmitter);
      expect(client).toBeInstanceOf(DAPClient);
    });

    it('should start disconnected', () => {
      expect(client.connected).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // connected getter
  // --------------------------------------------------------------------------

  describe('connected getter', () => {
    it('should return false when no socket exists', () => {
      expect(client.connected).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // Method existence
  // --------------------------------------------------------------------------

  describe('method existence', () => {
    it('should have connect method', () => {
      expect(typeof client.connect).toBe('function');
    });

    it('should have disconnect method', () => {
      expect(typeof client.disconnect).toBe('function');
    });

    it('should have launch method', () => {
      expect(typeof client.launch).toBe('function');
    });

    it('should have attach method', () => {
      expect(typeof client.attach).toBe('function');
    });

    it('should have configurationDone method', () => {
      expect(typeof client.configurationDone).toBe('function');
    });

    it('should have setBreakpoints method', () => {
      expect(typeof client.setBreakpoints).toBe('function');
    });

    it('should have setFunctionBreakpoints method', () => {
      expect(typeof client.setFunctionBreakpoints).toBe('function');
    });

    it('should have continue method', () => {
      expect(typeof client.continue).toBe('function');
    });

    it('should have next method', () => {
      expect(typeof client.next).toBe('function');
    });

    it('should have stepIn method', () => {
      expect(typeof client.stepIn).toBe('function');
    });

    it('should have stepOut method', () => {
      expect(typeof client.stepOut).toBe('function');
    });

    it('should have pause method', () => {
      expect(typeof client.pause).toBe('function');
    });

    it('should have threads method', () => {
      expect(typeof client.threads).toBe('function');
    });

    it('should have stackTrace method', () => {
      expect(typeof client.stackTrace).toBe('function');
    });

    it('should have scopes method', () => {
      expect(typeof client.scopes).toBe('function');
    });

    it('should have variables method', () => {
      expect(typeof client.variables).toBe('function');
    });

    it('should have evaluate method', () => {
      expect(typeof client.evaluate).toBe('function');
    });

    it('should have setExceptionBreakpoints method', () => {
      expect(typeof client.setExceptionBreakpoints).toBe('function');
    });
  });

  // --------------------------------------------------------------------------
  // connect
  // --------------------------------------------------------------------------

  describe('connect', () => {
    it('should call net.createConnection with host and port', () => {
      // Start connect but don't await — we just want to verify the call
      client.connect('127.0.0.1', 5678);

      expect(mockCreateConnection).toHaveBeenCalledWith(
        { host: '127.0.0.1', port: 5678 },
        expect.any(Function)
      );
    });

    it('should use default host and port when not specified', () => {
      client.connect();

      expect(mockCreateConnection).toHaveBeenCalledWith(
        { host: '127.0.0.1', port: 5678 },
        expect.any(Function)
      );
    });

    it('should emit connected event when socket connects', async () => {
      const connectedHandler = vi.fn();
      client.on('connected', connectedHandler);

      const connectPromise = client.connect('127.0.0.1', 5678);

      // The connect callback fires on next tick; advance timers
      await vi.advanceTimersByTimeAsync(0);

      // Emit the 'connect' event on the socket to trigger initialize
      // Provide a response for the initialize request
      const initResponse = buildResponse(1, 'initialize', {
        supportsConfigurationDoneRequest: true,
      });

      // The socket's 'connect' listener fires the initialize request
      mockSocketInstance.emit('connect');

      // Now feed the response back
      await vi.advanceTimersByTimeAsync(0);

      // Get the data handler and feed it the response
      mockSocketInstance.emit('data', initResponse);

      const result = await connectPromise;
      expect(connectedHandler).toHaveBeenCalled();
      expect(result).toEqual({ supportsConfigurationDoneRequest: true });
    });

    it('should reject when socket emits error', async () => {
      // Must add an error listener on the client to prevent EventEmitter from
      // throwing an unhandled 'error' event (Node.js EventEmitter behavior).
      client.on('error', () => {});

      const connectPromise = client.connect('127.0.0.1', 9999);

      // Advance to fire the connect callback from createConnection
      await vi.advanceTimersByTimeAsync(0);

      // Emit an error on the socket
      const testError = new Error('Connection refused');
      mockSocketInstance.emit('error', testError);

      await expect(connectPromise).rejects.toThrow('Connection refused');
    });

    it('should emit error event when socket errors', async () => {
      const errorHandler = vi.fn();
      client.on('error', errorHandler);

      const connectPromise = client.connect();

      await vi.advanceTimersByTimeAsync(0);

      const testError = new Error('Connection refused');
      mockSocketInstance.emit('error', testError);

      // Suppress the rejection
      await connectPromise.catch(() => {});

      expect(errorHandler).toHaveBeenCalledWith({ error: testError });
    });

    it('should emit disconnected event when socket closes', async () => {
      const disconnectedHandler = vi.fn();
      client.on('disconnected', disconnectedHandler);

      client.connect();

      await vi.advanceTimersByTimeAsync(0);

      mockSocketInstance.emit('close');

      expect(disconnectedHandler).toHaveBeenCalledWith({ reason: 'Socket closed' });
    });
  });

  // --------------------------------------------------------------------------
  // disconnect
  // --------------------------------------------------------------------------

  describe('disconnect', () => {
    it('should be callable without error even when not connected', async () => {
      await expect(client.disconnect()).resolves.toBeUndefined();
    });

    it('should destroy the socket when connected', async () => {
      // Set up a connected state
      const connectPromise = client.connect();
      await vi.advanceTimersByTimeAsync(0);

      // Simulate successful connection + initialize
      mockSocketInstance.emit('connect');
      await vi.advanceTimersByTimeAsync(0);
      mockSocketInstance.emit('data', buildResponse(1, 'initialize', {}));
      await connectPromise;

      await client.disconnect();

      expect(mockSocketInstance.destroy).toHaveBeenCalled();
      expect(client.connected).toBe(false);
    });

    it('should send disconnect request if capabilities support terminateDebuggee', async () => {
      // Connect with supportTerminateDebuggee capability
      const connectPromise = client.connect();
      await vi.advanceTimersByTimeAsync(0);

      mockSocketInstance.emit('connect');
      await vi.advanceTimersByTimeAsync(0);
      mockSocketInstance.emit(
        'data',
        buildResponse(1, 'initialize', {
          supportTerminateDebuggee: true,
        })
      );
      await connectPromise;

      // Start disconnect - it will send a request
      const disconnectPromise = client.disconnect(true);

      // Feed back the response to the disconnect request (seq 2)
      await vi.advanceTimersByTimeAsync(0);
      mockSocketInstance.emit('data', buildResponse(2, 'disconnect', {}));

      await disconnectPromise;

      expect(mockSocketInstance.destroy).toHaveBeenCalled();
    });

    it('should still disconnect even if disconnect request fails', async () => {
      const connectPromise = client.connect();
      await vi.advanceTimersByTimeAsync(0);

      mockSocketInstance.emit('connect');
      await vi.advanceTimersByTimeAsync(0);
      mockSocketInstance.emit(
        'data',
        buildResponse(1, 'initialize', {
          supportTerminateDebuggee: true,
        })
      );
      await connectPromise;

      // Start disconnect
      const disconnectPromise = client.disconnect();

      // Feed back a failure response
      await vi.advanceTimersByTimeAsync(0);
      mockSocketInstance.emit(
        'data',
        buildResponse(2, 'disconnect', undefined, false, 'already disconnected')
      );

      await disconnectPromise;

      expect(mockSocketInstance.destroy).toHaveBeenCalled();
      expect(client.connected).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // sendRequest (indirectly through public methods) — not connected errors
  // --------------------------------------------------------------------------

  describe('request methods when not connected', () => {
    it('launch should reject when not connected', async () => {
      await expect(client.launch({ program: '/test.py' })).rejects.toThrow(
        'Not connected to debugger'
      );
    });

    it('attach should reject when not connected', async () => {
      await expect(client.attach({})).rejects.toThrow('Not connected to debugger');
    });

    it('configurationDone should reject when not connected', async () => {
      await expect(client.configurationDone()).rejects.toThrow('Not connected to debugger');
    });

    it('setBreakpoints should reject when not connected', async () => {
      await expect(client.setBreakpoints({ path: '/test.py' }, [{ line: 10 }])).rejects.toThrow(
        'Not connected to debugger'
      );
    });

    it('setFunctionBreakpoints should reject when not connected', async () => {
      await expect(client.setFunctionBreakpoints([{ name: 'main' }])).rejects.toThrow(
        'Not connected to debugger'
      );
    });

    it('continue should reject when not connected', async () => {
      await expect(client.continue(1)).rejects.toThrow('Not connected to debugger');
    });

    it('next should reject when not connected', async () => {
      await expect(client.next(1)).rejects.toThrow('Not connected to debugger');
    });

    it('stepIn should reject when not connected', async () => {
      await expect(client.stepIn(1)).rejects.toThrow('Not connected to debugger');
    });

    it('stepOut should reject when not connected', async () => {
      await expect(client.stepOut(1)).rejects.toThrow('Not connected to debugger');
    });

    it('pause should reject when not connected', async () => {
      await expect(client.pause(1)).rejects.toThrow('Not connected to debugger');
    });

    it('threads should reject when not connected', async () => {
      await expect(client.threads()).rejects.toThrow('Not connected to debugger');
    });

    it('stackTrace should reject when not connected', async () => {
      await expect(client.stackTrace(1)).rejects.toThrow('Not connected to debugger');
    });

    it('scopes should reject when not connected', async () => {
      await expect(client.scopes(1)).rejects.toThrow('Not connected to debugger');
    });

    it('variables should reject when not connected', async () => {
      await expect(client.variables(1)).rejects.toThrow('Not connected to debugger');
    });

    it('evaluate should reject when not connected', async () => {
      await expect(client.evaluate('x')).rejects.toThrow('Not connected to debugger');
    });

    it('setExceptionBreakpoints should reject when not connected', async () => {
      await expect(client.setExceptionBreakpoints(['uncaught'])).rejects.toThrow(
        'Not connected to debugger'
      );
    });
  });

  // --------------------------------------------------------------------------
  // Protocol methods (with a connected client)
  // --------------------------------------------------------------------------

  describe('protocol methods when connected', () => {
    beforeEach(async () => {
      const connectPromise = client.connect();
      await vi.advanceTimersByTimeAsync(0);

      mockSocketInstance.emit('connect');
      await vi.advanceTimersByTimeAsync(0);
      mockSocketInstance.emit(
        'data',
        buildResponse(1, 'initialize', {
          supportsConfigurationDoneRequest: true,
        })
      );
      await connectPromise;
    });

    it('should send launch request and resolve', async () => {
      const launchPromise = client.launch({ program: '/test.py', stopOnEntry: true });

      await vi.advanceTimersByTimeAsync(0);
      mockSocketInstance.emit('data', buildResponse(2, 'launch', {}));

      await vi.advanceTimersByTimeAsync(0);
      // configurationDone request (seq 3) since capability is set
      mockSocketInstance.emit('data', buildResponse(3, 'configurationDone', {}));

      await expect(launchPromise).resolves.toBeUndefined();
    });

    it('should send attach request and resolve', async () => {
      const attachPromise = client.attach({ host: '127.0.0.1', port: 5678 });

      await vi.advanceTimersByTimeAsync(0);
      mockSocketInstance.emit('data', buildResponse(2, 'attach', {}));

      await vi.advanceTimersByTimeAsync(0);
      mockSocketInstance.emit('data', buildResponse(3, 'configurationDone', {}));

      await expect(attachPromise).resolves.toBeUndefined();
    });

    it('should send configurationDone request', async () => {
      const configDonePromise = client.configurationDone();

      await vi.advanceTimersByTimeAsync(0);
      mockSocketInstance.emit('data', buildResponse(2, 'configurationDone', {}));

      await expect(configDonePromise).resolves.toBeUndefined();
    });

    it('should send setBreakpoints and return breakpoints', async () => {
      const bps: DAPBreakpoint[] = [
        { id: 1, verified: true, line: 10 },
        { id: 2, verified: true, line: 20 },
      ];

      const setBpPromise = client.setBreakpoints({ path: '/test.py' }, [
        { line: 10 },
        { line: 20, condition: 'x > 5' },
      ]);

      await vi.advanceTimersByTimeAsync(0);
      mockSocketInstance.emit('data', buildResponse(2, 'setBreakpoints', { breakpoints: bps }));

      const result = await setBpPromise;
      expect(result).toEqual(bps);
    });

    it('should return empty array when setBreakpoints response has no breakpoints', async () => {
      const setBpPromise = client.setBreakpoints({ path: '/test.py' }, [{ line: 10 }]);

      await vi.advanceTimersByTimeAsync(0);
      mockSocketInstance.emit('data', buildResponse(2, 'setBreakpoints', {}));

      const result = await setBpPromise;
      expect(result).toEqual([]);
    });

    it('should send setFunctionBreakpoints and return breakpoints', async () => {
      const bps: DAPBreakpoint[] = [{ id: 3, verified: true }];

      const setBpPromise = client.setFunctionBreakpoints([{ name: 'main' }]);

      await vi.advanceTimersByTimeAsync(0);
      mockSocketInstance.emit(
        'data',
        buildResponse(2, 'setFunctionBreakpoints', { breakpoints: bps })
      );

      const result = await setBpPromise;
      expect(result).toEqual(bps);
    });

    it('should send continue and return result', async () => {
      const continuePromise = client.continue(1);

      await vi.advanceTimersByTimeAsync(0);
      mockSocketInstance.emit('data', buildResponse(2, 'continue', { allThreadsContinued: true }));

      const result = await continuePromise;
      expect(result).toEqual({ allThreadsContinued: true });
    });

    it('should send next request', async () => {
      const nextPromise = client.next(1, 'statement');

      await vi.advanceTimersByTimeAsync(0);
      mockSocketInstance.emit('data', buildResponse(2, 'next', {}));

      await expect(nextPromise).resolves.toBeUndefined();
    });

    it('should send stepIn request', async () => {
      const stepInPromise = client.stepIn(1);

      await vi.advanceTimersByTimeAsync(0);
      mockSocketInstance.emit('data', buildResponse(2, 'stepIn', {}));

      await expect(stepInPromise).resolves.toBeUndefined();
    });

    it('should send stepOut request', async () => {
      const stepOutPromise = client.stepOut(1, 'instruction');

      await vi.advanceTimersByTimeAsync(0);
      mockSocketInstance.emit('data', buildResponse(2, 'stepOut', {}));

      await expect(stepOutPromise).resolves.toBeUndefined();
    });

    it('should send pause request', async () => {
      const pausePromise = client.pause(1);

      await vi.advanceTimersByTimeAsync(0);
      mockSocketInstance.emit('data', buildResponse(2, 'pause', {}));

      await expect(pausePromise).resolves.toBeUndefined();
    });

    it('should send threads request and return threads', async () => {
      const threads: DAPThread[] = [
        { id: 1, name: 'MainThread' },
        { id: 2, name: 'Worker' },
      ];

      const threadsPromise = client.threads();

      await vi.advanceTimersByTimeAsync(0);
      mockSocketInstance.emit('data', buildResponse(2, 'threads', { threads }));

      const result = await threadsPromise;
      expect(result).toEqual(threads);
    });

    it('should return empty threads array when body has no threads', async () => {
      const threadsPromise = client.threads();

      await vi.advanceTimersByTimeAsync(0);
      mockSocketInstance.emit('data', buildResponse(2, 'threads', {}));

      const result = await threadsPromise;
      expect(result).toEqual([]);
    });

    it('should send stackTrace request and return frames', async () => {
      const frames: DAPStackFrame[] = [{ id: 1, name: 'main', line: 5, column: 1 }];

      const stPromise = client.stackTrace(1, 0, 10);

      await vi.advanceTimersByTimeAsync(0);
      mockSocketInstance.emit(
        'data',
        buildResponse(2, 'stackTrace', { stackFrames: frames, totalFrames: 1 })
      );

      const result = await stPromise;
      expect(result.stackFrames).toEqual(frames);
      expect(result.totalFrames).toBe(1);
    });

    it('should return empty stack frames when body has none', async () => {
      const stPromise = client.stackTrace(1);

      await vi.advanceTimersByTimeAsync(0);
      mockSocketInstance.emit('data', buildResponse(2, 'stackTrace', {}));

      const result = await stPromise;
      expect(result.stackFrames).toEqual([]);
      expect(result.totalFrames).toBeUndefined();
    });

    it('should send scopes request and return scopes', async () => {
      const scopes: DAPScope[] = [{ name: 'Locals', variablesReference: 1, expensive: false }];

      const scopesPromise = client.scopes(1);

      await vi.advanceTimersByTimeAsync(0);
      mockSocketInstance.emit('data', buildResponse(2, 'scopes', { scopes }));

      const result = await scopesPromise;
      expect(result).toEqual(scopes);
    });

    it('should send variables request and return variables', async () => {
      const vars: DAPVariable[] = [{ name: 'x', value: '42', type: 'int', variablesReference: 0 }];

      const varsPromise = client.variables(1, 'named', 0, 10);

      await vi.advanceTimersByTimeAsync(0);
      mockSocketInstance.emit('data', buildResponse(2, 'variables', { variables: vars }));

      const result = await varsPromise;
      expect(result).toEqual(vars);
    });

    it('should send evaluate request and return result', async () => {
      const evalBody = {
        result: '42',
        type: 'int',
        variablesReference: 0,
        presentationHint: { kind: 'property' },
        namedVariables: 0,
        indexedVariables: 0,
        memoryReference: '0xFF',
      };

      const evalPromise = client.evaluate('x + 1', 1, 'watch');

      await vi.advanceTimersByTimeAsync(0);
      mockSocketInstance.emit('data', buildResponse(2, 'evaluate', evalBody));

      const result = await evalPromise;
      expect(result.result).toBe('42');
      expect(result.type).toBe('int');
      expect(result.variablesReference).toBe(0);
      expect(result.memoryReference).toBe('0xFF');
    });

    it('should return default values for missing evaluate fields', async () => {
      const evalPromise = client.evaluate('1+1');

      await vi.advanceTimersByTimeAsync(0);
      mockSocketInstance.emit('data', buildResponse(2, 'evaluate', {}));

      const result = await evalPromise;
      expect(result.result).toBe('');
      expect(result.variablesReference).toBe(0);
      expect(result.type).toBeUndefined();
    });

    it('should send setExceptionBreakpoints request', async () => {
      const bps: DAPBreakpoint[] = [{ verified: true }];

      const setBpPromise = client.setExceptionBreakpoints(['uncaught', 'raised']);

      await vi.advanceTimersByTimeAsync(0);
      mockSocketInstance.emit(
        'data',
        buildResponse(2, 'setExceptionBreakpoints', { breakpoints: bps })
      );

      const result = await setBpPromise;
      expect(result).toEqual(bps);
    });
  });

  // --------------------------------------------------------------------------
  // Error handling (failed responses)
  // --------------------------------------------------------------------------

  describe('error handling', () => {
    beforeEach(async () => {
      const connectPromise = client.connect();
      await vi.advanceTimersByTimeAsync(0);

      mockSocketInstance.emit('connect');
      await vi.advanceTimersByTimeAsync(0);
      mockSocketInstance.emit('data', buildResponse(1, 'initialize', {}));
      await connectPromise;
    });

    it('should reject when DAP response indicates failure', async () => {
      const threadsPromise = client.threads();

      await vi.advanceTimersByTimeAsync(0);
      mockSocketInstance.emit(
        'data',
        buildResponse(2, 'threads', undefined, false, 'Session not found')
      );

      await expect(threadsPromise).rejects.toThrow('threads failed: Session not found');
    });

    it('should reject pending request on timeout', async () => {
      const threadsPromise = client.threads();

      // Attach rejection handler before advancing timers to avoid unhandled rejection
      const resultPromise = threadsPromise.catch((err: Error) => err);

      // Advance past the 30s timeout
      await vi.advanceTimersByTimeAsync(30001);

      const err = await resultPromise;
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toMatch('Request threads timed out after 30000ms');
    });
  });

  // --------------------------------------------------------------------------
  // DAP protocol data handling (handleData)
  // --------------------------------------------------------------------------

  describe('data handling', () => {
    beforeEach(async () => {
      const connectPromise = client.connect();
      await vi.advanceTimersByTimeAsync(0);

      mockSocketInstance.emit('connect');
      await vi.advanceTimersByTimeAsync(0);
      mockSocketInstance.emit('data', buildResponse(1, 'initialize', {}));
      await connectPromise;
    });

    it('should handle event messages and emit them', async () => {
      const stoppedHandler = vi.fn();
      client.on('stopped', stoppedHandler);

      const eventData = buildEvent('stopped', {
        reason: 'breakpoint',
        threadId: 1,
        allThreadsStopped: true,
      });

      mockSocketInstance.emit('data', eventData);

      expect(stoppedHandler).toHaveBeenCalledWith({
        reason: 'breakpoint',
        threadId: 1,
        allThreadsStopped: true,
      });
    });

    it('should handle output events', () => {
      const outputHandler = vi.fn();
      client.on('output', outputHandler);

      mockSocketInstance.emit(
        'data',
        buildEvent('output', { category: 'stdout', output: 'Hello, World!\n' })
      );

      expect(outputHandler).toHaveBeenCalledWith({
        category: 'stdout',
        output: 'Hello, World!\n',
      });
    });

    it('should handle partial messages (data split across chunks)', async () => {
      const threadsPromise = client.threads();

      const fullMessage = buildResponse(2, 'threads', {
        threads: [{ id: 1, name: 'Main' }],
      });

      // Split the message into two chunks
      const midpoint = Math.floor(fullMessage.length / 2);
      const chunk1 = fullMessage.subarray(0, midpoint);
      const chunk2 = fullMessage.subarray(midpoint);

      await vi.advanceTimersByTimeAsync(0);

      mockSocketInstance.emit('data', chunk1);
      mockSocketInstance.emit('data', chunk2);

      const result = await threadsPromise;
      expect(result).toEqual([{ id: 1, name: 'Main' }]);
    });

    it('should handle multiple messages in a single data chunk', async () => {
      const threadsPromise = client.threads();
      await vi.advanceTimersByTimeAsync(0);

      const outputHandler = vi.fn();
      client.on('output', outputHandler);

      // Combine a response and an event into a single buffer
      const response = buildResponse(2, 'threads', {
        threads: [{ id: 1, name: 'Main' }],
      });
      const event = buildEvent('output', { output: 'test' });
      const combined = Buffer.concat([response, event]);

      mockSocketInstance.emit('data', combined);

      const result = await threadsPromise;
      expect(result).toEqual([{ id: 1, name: 'Main' }]);
      expect(outputHandler).toHaveBeenCalledWith({ output: 'test' });
    });

    it('should handle invalid header gracefully (skip to next message)', async () => {
      const threadsPromise = client.threads();
      await vi.advanceTimersByTimeAsync(0);

      // Send garbage followed by a valid message
      const invalidHeader = Buffer.from('Invalid-Header: oops\r\n\r\n');
      const validMessage = buildResponse(2, 'threads', {
        threads: [{ id: 1, name: 'Main' }],
      });
      const combined = Buffer.concat([invalidHeader, validMessage]);

      mockSocketInstance.emit('data', combined);

      const result = await threadsPromise;
      expect(result).toEqual([{ id: 1, name: 'Main' }]);
    });

    it('should handle malformed JSON body gracefully', () => {
      // Send a valid header but invalid JSON body
      const header = 'Content-Length: 5\r\n\r\n';
      const body = '{bad}';
      const data = Buffer.from(header + body, 'utf-8');

      // Should not throw — just logs the error
      expect(() => {
        mockSocketInstance.emit('data', data);
      }).not.toThrow();
    });

    it('should handle unknown response seq gracefully', () => {
      // Send a response for a request_seq that does not exist
      const unknownResponse = buildResponse(999, 'threads', {});

      expect(() => {
        mockSocketInstance.emit('data', unknownResponse);
      }).not.toThrow();
    });
  });

  // --------------------------------------------------------------------------
  // Socket close rejects pending requests
  // --------------------------------------------------------------------------

  describe('socket close behavior', () => {
    beforeEach(async () => {
      const connectPromise = client.connect();
      await vi.advanceTimersByTimeAsync(0);

      mockSocketInstance.emit('connect');
      await vi.advanceTimersByTimeAsync(0);
      mockSocketInstance.emit('data', buildResponse(1, 'initialize', {}));
      await connectPromise;
    });

    it('should reject all pending requests when socket closes', async () => {
      const threadsPromise = client.threads();
      const scopesPromise = client.scopes(1);

      await vi.advanceTimersByTimeAsync(0);

      // Close the socket
      mockSocketInstance.emit('close');

      await expect(threadsPromise).rejects.toThrow('Socket closed');
      await expect(scopesPromise).rejects.toThrow('Socket closed');
    });
  });

  // --------------------------------------------------------------------------
  // Event emitter interface
  // --------------------------------------------------------------------------

  describe('EventEmitter interface', () => {
    it('should support on/emit pattern', () => {
      const handler = vi.fn();
      client.on('connected', handler);
      client.emit('connected');
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should support once listener', () => {
      const handler = vi.fn();
      client.once('disconnected', handler);
      client.emit('disconnected', { reason: 'test' });
      client.emit('disconnected', { reason: 'test2' });
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should support removeListener', () => {
      const handler = vi.fn();
      client.on('stopped', handler);
      client.removeListener('stopped', handler);
      client.emit('stopped', { reason: 'breakpoint' });
      expect(handler).not.toHaveBeenCalled();
    });
  });
});

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

describe('dapClient singleton', () => {
  it('should export a singleton DAPClient instance', () => {
    expect(dapClient).toBeInstanceOf(DAPClient);
  });

  it('should be a stable reference (same object on re-import)', async () => {
    const { dapClient: dapClient2 } = await import('./dap-client');
    expect(dapClient).toBe(dapClient2);
  });
});
