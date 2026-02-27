// @ts-nocheck - Test file with extensive mocking
/** @vitest-environment node */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================================================
// HOISTED MOCKS
// ============================================================================

const { mockWsInstance, MockWebSocket } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { EventEmitter } = require('events') as typeof import('events');

  const mockWsInstance = Object.assign(new EventEmitter(), {
    send: vi.fn(),
    close: vi.fn(),
    readyState: 1,
  });

  const MockWebSocket = vi.fn(() => mockWsInstance);
  MockWebSocket.OPEN = 1;
  MockWebSocket.CLOSED = 3;

  return { mockWsInstance, MockWebSocket };
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

vi.mock('ws', () => ({
  default: MockWebSocket,
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ============================================================================
// IMPORTS (after mocks)
// ============================================================================

import { EventEmitter } from 'events';
import { CDPClient, cdpClient } from './cdp-client';

import type {
  CDPLocation,
  CDPBreakpoint,
  CDPCallFrame,
  CDPScope,
  CDPRemoteObject,
  CDPObjectPreview,
  CDPPropertyPreview,
  CDPPropertyDescriptor,
  CDPScript,
} from './cdp-client';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Create a mock inspector response for fetch
 */
function createInspectorResponse(wsUrl = 'ws://127.0.0.1:9229/ws/debugger-id') {
  return [
    {
      webSocketDebuggerUrl: wsUrl,
      id: 'debugger-id-1',
      title: 'Node.js Inspector',
    },
  ];
}

/**
 * Simulate a CDP response arriving over the WebSocket
 */
function simulateResponse(
  id: number,
  result?: Record<string, unknown>,
  error?: { code: number; message: string }
) {
  const message = error
    ? JSON.stringify({ id, error })
    : JSON.stringify({ id, result: result || {} });
  mockWsInstance.emit('message', message);
}

/**
 * Simulate a CDP event arriving over the WebSocket
 */
function simulateEvent(method: string, params: Record<string, unknown> = {}) {
  const message = JSON.stringify({ method, params });
  mockWsInstance.emit('message', message);
}

/**
 * Set up fetch mock and trigger WS open + respond to enableDomains.
 * Auto-responds to requests 1 (Debugger.enable), 2 (Runtime.enable), 3 (setPauseOnExceptions).
 */
function setupConnectMock() {
  mockFetch.mockResolvedValueOnce({
    json: () => Promise.resolve(createInspectorResponse()),
  });

  // Intercept send to auto-respond to enableDomains messages
  let sendCallCount = 0;
  mockWsInstance.send.mockImplementation((data: string) => {
    sendCallCount++;
    const parsed = JSON.parse(data);
    // Auto-respond to the 3 enableDomains calls
    if (sendCallCount <= 3) {
      process.nextTick(() => simulateResponse(parsed.id, {}));
    }
  });
}

/**
 * Create a fully connected CDPClient.
 */
async function createConnectedClient(): Promise<CDPClient> {
  const client = new CDPClient();
  setupConnectMock();

  const connectPromise = client.connect();

  // Wait for fetch to resolve, then trigger WS open
  await new Promise((r) => process.nextTick(r));
  await new Promise((r) => process.nextTick(r));
  mockWsInstance.emit('open');

  await connectPromise;

  // Reset send mock after connection
  mockWsInstance.send.mockReset();

  return client;
}

// ============================================================================
// TYPE EXPORT TESTS
// ============================================================================

describe('Type exports', () => {
  it('should export CDPLocation type', () => {
    const location: CDPLocation = {
      scriptId: 'script-1',
      lineNumber: 10,
      columnNumber: 5,
    };
    expect(location.scriptId).toBe('script-1');
    expect(location.lineNumber).toBe(10);
  });

  it('should export CDPLocation without optional columnNumber', () => {
    const location: CDPLocation = {
      scriptId: 'script-2',
      lineNumber: 20,
    };
    expect(location.columnNumber).toBeUndefined();
  });

  it('should export CDPBreakpoint type', () => {
    const bp: CDPBreakpoint = {
      breakpointId: 'bp-1',
      locations: [{ scriptId: 'script-1', lineNumber: 5 }],
    };
    expect(bp.breakpointId).toBe('bp-1');
    expect(bp.locations).toHaveLength(1);
  });

  it('should export CDPCallFrame type', () => {
    const remoteObj: CDPRemoteObject = { type: 'object' };
    const scope: CDPScope = { type: 'local', object: remoteObj };
    const frame: CDPCallFrame = {
      callFrameId: 'frame-1',
      functionName: 'testFn',
      location: { scriptId: 's1', lineNumber: 1 },
      url: 'file:///test.js',
      scopeChain: [scope],
      this: remoteObj,
    };
    expect(frame.functionName).toBe('testFn');
    expect(frame.scopeChain).toHaveLength(1);
  });

  it('should export CDPScope type with all scope types', () => {
    const scopeTypes: CDPScope['type'][] = [
      'global',
      'local',
      'with',
      'closure',
      'catch',
      'block',
      'script',
      'eval',
      'module',
    ];
    for (const type of scopeTypes) {
      const scope: CDPScope = { type, object: { type: 'object' } };
      expect(scope.type).toBe(type);
    }
  });

  it('should export CDPRemoteObject type with various subtypes', () => {
    const obj: CDPRemoteObject = {
      type: 'object',
      subtype: 'array',
      className: 'Array',
      description: 'Array(3)',
      objectId: 'obj-1',
    };
    expect(obj.subtype).toBe('array');
    expect(obj.objectId).toBe('obj-1');
  });

  it('should export CDPRemoteObject with unserializableValue', () => {
    const obj: CDPRemoteObject = {
      type: 'number',
      unserializableValue: 'Infinity',
      description: 'Infinity',
    };
    expect(obj.unserializableValue).toBe('Infinity');
  });

  it('should export CDPObjectPreview type', () => {
    const preview: CDPObjectPreview = {
      type: 'object',
      description: '{a: 1}',
      overflow: false,
      properties: [{ name: 'a', type: 'number', value: '1' }],
    };
    expect(preview.overflow).toBe(false);
    expect(preview.properties).toHaveLength(1);
  });

  it('should export CDPPropertyPreview with valuePreview', () => {
    const prop: CDPPropertyPreview = {
      name: 'nested',
      type: 'object',
      valuePreview: {
        type: 'object',
        overflow: true,
        properties: [],
      },
    };
    expect(prop.valuePreview?.overflow).toBe(true);
  });

  it('should export CDPPropertyDescriptor type', () => {
    const desc: CDPPropertyDescriptor = {
      name: 'length',
      value: { type: 'number', value: 3 },
      writable: true,
      configurable: false,
      enumerable: true,
      isOwn: true,
    };
    expect(desc.name).toBe('length');
    expect(desc.writable).toBe(true);
  });

  it('should export CDPPropertyDescriptor with getter/setter', () => {
    const desc: CDPPropertyDescriptor = {
      name: 'value',
      get: { type: 'function' },
      set: { type: 'function' },
      configurable: true,
      enumerable: true,
      wasThrown: false,
    };
    expect(desc.get?.type).toBe('function');
    expect(desc.set?.type).toBe('function');
  });

  it('should export CDPScript type', () => {
    const script: CDPScript = {
      scriptId: 'script-1',
      url: 'file:///test.js',
      startLine: 0,
      startColumn: 0,
      endLine: 100,
      endColumn: 0,
      executionContextId: 1,
      hash: 'abc123',
      sourceMapURL: 'test.js.map',
    };
    expect(script.scriptId).toBe('script-1');
    expect(script.sourceMapURL).toBe('test.js.map');
  });

  it('should export CDPScript without optional sourceMapURL', () => {
    const script: CDPScript = {
      scriptId: 'script-2',
      url: '',
      startLine: 0,
      startColumn: 0,
      endLine: 50,
      endColumn: 0,
      executionContextId: 1,
      hash: 'def456',
    };
    expect(script.sourceMapURL).toBeUndefined();
  });
});

// ============================================================================
// SINGLETON EXPORT TESTS
// ============================================================================

describe('Singleton export', () => {
  it('should export cdpClient singleton', () => {
    expect(cdpClient).toBeInstanceOf(CDPClient);
  });

  it('should export cdpClient as an EventEmitter', () => {
    expect(cdpClient).toBeInstanceOf(EventEmitter);
  });
});

// ============================================================================
// CDP CLIENT CLASS TESTS
// ============================================================================

describe('CDPClient', () => {
  let client: CDPClient;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset the mock WebSocket instance
    mockWsInstance.removeAllListeners();
    mockWsInstance.send.mockReset();
    mockWsInstance.close.mockReset();
    mockWsInstance.readyState = 1; // WebSocket.OPEN
    MockWebSocket.mockClear();
    mockFetch.mockReset();

    client = new CDPClient();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --------------------------------------------------------------------------
  // Constructor
  // --------------------------------------------------------------------------

  describe('constructor', () => {
    it('should create a new CDPClient instance', () => {
      expect(client).toBeInstanceOf(CDPClient);
    });

    it('should extend EventEmitter', () => {
      expect(client).toBeInstanceOf(EventEmitter);
    });

    it('should not be connected initially', () => {
      expect(client.connected).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // connect()
  // --------------------------------------------------------------------------

  describe('connect()', () => {
    it('should fetch inspector metadata from default host and port', async () => {
      setupConnectMock();

      const connectPromise = client.connect();

      await new Promise((r) => process.nextTick(r));
      await new Promise((r) => process.nextTick(r));
      mockWsInstance.emit('open');

      await connectPromise;

      expect(mockFetch).toHaveBeenCalledWith('http://127.0.0.1:9229/json');
    });

    it('should use custom host and port', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve(createInspectorResponse()),
      });

      mockWsInstance.send.mockImplementation((data: string) => {
        const parsed = JSON.parse(data);
        process.nextTick(() => simulateResponse(parsed.id, {}));
      });

      const connectPromise = client.connect('192.168.1.1', 9999);

      await new Promise((r) => process.nextTick(r));
      await new Promise((r) => process.nextTick(r));
      mockWsInstance.emit('open');

      await connectPromise;

      expect(mockFetch).toHaveBeenCalledWith('http://192.168.1.1:9999/json');
    });

    it('should create WebSocket with debugger URL from inspector response', async () => {
      const wsUrl = 'ws://127.0.0.1:9229/ws/custom-id';
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve(createInspectorResponse(wsUrl)),
      });

      mockWsInstance.send.mockImplementation((data: string) => {
        const parsed = JSON.parse(data);
        process.nextTick(() => simulateResponse(parsed.id, {}));
      });

      const connectPromise = client.connect();

      await new Promise((r) => process.nextTick(r));
      await new Promise((r) => process.nextTick(r));
      mockWsInstance.emit('open');

      await connectPromise;

      expect(MockWebSocket).toHaveBeenCalledWith(wsUrl);
    });

    it('should reject when no debug targets found', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve([]),
      });

      await expect(client.connect()).rejects.toThrow('Failed to connect to inspector');
    });

    it('should reject when targets is null', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve(null),
      });

      await expect(client.connect()).rejects.toThrow('Failed to connect to inspector');
    });

    it('should reject when fetch fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      await expect(client.connect()).rejects.toThrow(
        'Failed to connect to inspector: Connection refused'
      );
    });

    it('should emit connected event after successful connection', async () => {
      setupConnectMock();

      const connectedHandler = vi.fn();
      client.on('connected', connectedHandler);

      const connectPromise = client.connect();

      await new Promise((r) => process.nextTick(r));
      await new Promise((r) => process.nextTick(r));
      mockWsInstance.emit('open');

      await connectPromise;

      expect(connectedHandler).toHaveBeenCalled();
    });

    it('should enable Debugger and Runtime domains on connect', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve(createInspectorResponse()),
      });

      const sentRequests: Record<string, unknown>[] = [];
      mockWsInstance.send.mockImplementation((data: string) => {
        const parsed = JSON.parse(data);
        sentRequests.push(parsed);
        process.nextTick(() => simulateResponse(parsed.id, {}));
      });

      const connectPromise = client.connect();

      await new Promise((r) => process.nextTick(r));
      await new Promise((r) => process.nextTick(r));
      mockWsInstance.emit('open');

      await connectPromise;

      expect(sentRequests[0].method).toBe('Debugger.enable');
      expect(sentRequests[0].params).toEqual({ maxScriptsCacheSize: 10000000 });
      expect(sentRequests[1].method).toBe('Runtime.enable');
      expect(sentRequests[2].method).toBe('Debugger.setPauseOnExceptions');
      expect(sentRequests[2].params).toEqual({ state: 'uncaught' });
    });

    it('should reject if enableDomains fails', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve(createInspectorResponse()),
      });

      mockWsInstance.send.mockImplementation((data: string) => {
        const parsed = JSON.parse(data);
        process.nextTick(() =>
          simulateResponse(parsed.id, undefined, {
            code: -32000,
            message: 'Domain already enabled',
          })
        );
      });

      const connectPromise = client.connect();

      await new Promise((r) => process.nextTick(r));
      await new Promise((r) => process.nextTick(r));
      mockWsInstance.emit('open');

      await expect(connectPromise).rejects.toThrow(
        'Debugger.enable failed: Domain already enabled'
      );
    });

    it('should emit error event on WebSocket error', async () => {
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve(createInspectorResponse()),
      });

      const errorHandler = vi.fn();
      client.on('error', errorHandler);

      const connectPromise = client.connect();

      await new Promise((r) => process.nextTick(r));
      await new Promise((r) => process.nextTick(r));

      const wsError = new Error('WebSocket connection failed');
      mockWsInstance.emit('error', wsError);

      await expect(connectPromise).rejects.toThrow('WebSocket connection failed');
      expect(errorHandler).toHaveBeenCalledWith({ error: wsError });
    });

    it('should handle WebSocket close event and emit disconnected', async () => {
      setupConnectMock();

      const disconnectedHandler = vi.fn();
      client.on('disconnected', disconnectedHandler);

      const connectPromise = client.connect();

      await new Promise((r) => process.nextTick(r));
      await new Promise((r) => process.nextTick(r));
      mockWsInstance.emit('open');

      await connectPromise;

      // Now close the websocket
      mockWsInstance.readyState = 3;
      mockWsInstance.emit('close', 1000, Buffer.from('Normal closure'));

      expect(disconnectedHandler).toHaveBeenCalledWith(
        expect.objectContaining({ reason: expect.any(String) })
      );
    });
  });

  // --------------------------------------------------------------------------
  // disconnect()
  // --------------------------------------------------------------------------

  describe('disconnect()', () => {
    it('should close WebSocket and clear state', async () => {
      const connectedClient = await createConnectedClient();

      await connectedClient.disconnect();

      expect(mockWsInstance.close).toHaveBeenCalled();
      expect(connectedClient.connected).toBe(false);
    });

    it('should be safe to call when not connected', async () => {
      await expect(client.disconnect()).resolves.toBeUndefined();
    });

    it('should clear scripts on disconnect', async () => {
      const connectedClient = await createConnectedClient();

      // Add a script via event
      simulateEvent('Debugger.scriptParsed', {
        scriptId: 'script-1',
        url: 'file:///test.js',
        startLine: 0,
        startColumn: 0,
        endLine: 100,
        endColumn: 0,
        executionContextId: 1,
        hash: 'abc',
      });

      expect(connectedClient.getScript('script-1')).toBeDefined();

      await connectedClient.disconnect();

      expect(connectedClient.getScript('script-1')).toBeUndefined();
    });

    it('should report not connected after disconnect', async () => {
      const connectedClient = await createConnectedClient();

      expect(connectedClient.connected).toBe(true);

      await connectedClient.disconnect();

      expect(connectedClient.connected).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // connected getter
  // --------------------------------------------------------------------------

  describe('connected getter', () => {
    it('should return false when WebSocket is null', () => {
      expect(client.connected).toBe(false);
    });

    it('should return true when connected and WebSocket is OPEN', async () => {
      const connectedClient = await createConnectedClient();
      expect(connectedClient.connected).toBe(true);
    });

    it('should return false when WebSocket readyState is not OPEN', async () => {
      const connectedClient = await createConnectedClient();

      mockWsInstance.readyState = 3; // CLOSED
      expect(connectedClient.connected).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // send() — private, tested through public methods
  // --------------------------------------------------------------------------

  describe('send() via public methods', () => {
    it('should reject if not connected', async () => {
      await expect(client.resume()).rejects.toThrow('Not connected to debugger');
    });

    it('should increment request IDs', async () => {
      const connectedClient = await createConnectedClient();

      const sentRequests: Record<string, unknown>[] = [];
      mockWsInstance.send.mockImplementation((data: string) => {
        sentRequests.push(JSON.parse(data));
      });

      // Fire two requests (don't await — they'll pend)
      const p1 = connectedClient.resume();
      const p2 = connectedClient.stepOver();

      expect(sentRequests[1].id).toBe((sentRequests[0].id as number) + 1);

      // Resolve both
      simulateResponse(sentRequests[0].id as number, {});
      simulateResponse(sentRequests[1].id as number, {});

      await Promise.all([p1, p2]);
    });

    it('should timeout pending requests after 30 seconds', async () => {
      const connectedClient = await createConnectedClient();

      vi.useFakeTimers({ shouldAdvanceTime: true });

      mockWsInstance.send.mockImplementation(() => {
        // Don't respond — let it timeout
      });
      // Ensure connected getter stays true during the timeout
      mockWsInstance.readyState = 1;

      const resumePromise = connectedClient.resume();

      // Advance past the 30s timeout
      vi.advanceTimersByTime(31000);

      await expect(resumePromise).rejects.toThrow('timed out after 30000ms');

      vi.useRealTimers();
    });
  });

  // --------------------------------------------------------------------------
  // Debugger domain methods
  // --------------------------------------------------------------------------

  describe('Debugger domain methods', () => {
    let connectedClient: CDPClient;
    let sentRequests: Record<string, unknown>[];

    beforeEach(async () => {
      connectedClient = await createConnectedClient();

      sentRequests = [];
      mockWsInstance.send.mockImplementation((data: string) => {
        sentRequests.push(JSON.parse(data));
      });
    });

    describe('setBreakpointByUrl()', () => {
      it('should send Debugger.setBreakpointByUrl request', async () => {
        const promise = connectedClient.setBreakpointByUrl('file:///test.js', 10, 0, 'x > 5');

        expect(sentRequests[0].method).toBe('Debugger.setBreakpointByUrl');
        expect(sentRequests[0].params).toEqual({
          url: 'file:///test.js',
          lineNumber: 10,
          columnNumber: 0,
          condition: 'x > 5',
        });

        simulateResponse(sentRequests[0].id as number, {
          breakpointId: 'bp-1',
          locations: [{ scriptId: 's1', lineNumber: 10, columnNumber: 0 }],
        });

        const result = await promise;
        expect(result.breakpointId).toBe('bp-1');
        expect(result.locations).toHaveLength(1);
      });

      it('should store breakpoint internally after setting', async () => {
        const promise = connectedClient.setBreakpointByUrl('file:///test.js', 10);

        simulateResponse(sentRequests[0].id as number, {
          breakpointId: 'bp-stored',
          locations: [{ scriptId: 's1', lineNumber: 10 }],
        });

        const bp = await promise;
        expect(bp.breakpointId).toBe('bp-stored');
      });
    });

    describe('setBreakpoint()', () => {
      it('should send Debugger.setBreakpoint request with location and condition', async () => {
        const location: CDPLocation = { scriptId: 's1', lineNumber: 15, columnNumber: 3 };
        const promise = connectedClient.setBreakpoint(location, 'i === 0');

        expect(sentRequests[0].method).toBe('Debugger.setBreakpoint');
        expect(sentRequests[0].params).toEqual({ location, condition: 'i === 0' });

        simulateResponse(sentRequests[0].id as number, {
          breakpointId: 'bp-2',
          actualLocation: { scriptId: 's1', lineNumber: 15, columnNumber: 3 },
        });

        const result = await promise;
        expect(result.breakpointId).toBe('bp-2');
        expect(result.actualLocation.lineNumber).toBe(15);
      });
    });

    describe('removeBreakpoint()', () => {
      it('should send Debugger.removeBreakpoint and remove from internal store', async () => {
        // First set a breakpoint
        const setPromise = connectedClient.setBreakpointByUrl('file:///test.js', 10);
        simulateResponse(sentRequests[0].id as number, {
          breakpointId: 'bp-remove',
          locations: [{ scriptId: 's1', lineNumber: 10 }],
        });
        await setPromise;

        // Now remove it
        const removePromise = connectedClient.removeBreakpoint('bp-remove');
        expect(sentRequests[1].method).toBe('Debugger.removeBreakpoint');
        expect(sentRequests[1].params).toEqual({ breakpointId: 'bp-remove' });

        simulateResponse(sentRequests[1].id as number, {});
        await removePromise;
      });
    });

    describe('resume()', () => {
      it('should send Debugger.resume request', async () => {
        const promise = connectedClient.resume();

        expect(sentRequests[0].method).toBe('Debugger.resume');

        simulateResponse(sentRequests[0].id as number, {});
        await promise;
      });
    });

    describe('stepOver()', () => {
      it('should send Debugger.stepOver request', async () => {
        const promise = connectedClient.stepOver();

        expect(sentRequests[0].method).toBe('Debugger.stepOver');

        simulateResponse(sentRequests[0].id as number, {});
        await promise;
      });
    });

    describe('stepInto()', () => {
      it('should send Debugger.stepInto request', async () => {
        const promise = connectedClient.stepInto();

        expect(sentRequests[0].method).toBe('Debugger.stepInto');

        simulateResponse(sentRequests[0].id as number, {});
        await promise;
      });
    });

    describe('stepOut()', () => {
      it('should send Debugger.stepOut request', async () => {
        const promise = connectedClient.stepOut();

        expect(sentRequests[0].method).toBe('Debugger.stepOut');

        simulateResponse(sentRequests[0].id as number, {});
        await promise;
      });
    });

    describe('pause()', () => {
      it('should send Debugger.pause request', async () => {
        const promise = connectedClient.pause();

        expect(sentRequests[0].method).toBe('Debugger.pause');

        simulateResponse(sentRequests[0].id as number, {});
        await promise;
      });
    });

    describe('getScriptSource()', () => {
      it('should send Debugger.getScriptSource and return script source', async () => {
        const promise = connectedClient.getScriptSource('script-1');

        expect(sentRequests[0].method).toBe('Debugger.getScriptSource');
        expect(sentRequests[0].params).toEqual({ scriptId: 'script-1' });

        simulateResponse(sentRequests[0].id as number, { scriptSource: 'console.log("hello");' });

        const result = await promise;
        expect(result).toBe('console.log("hello");');
      });
    });

    describe('setPauseOnExceptions()', () => {
      it('should send Debugger.setPauseOnExceptions with "none"', async () => {
        const promise = connectedClient.setPauseOnExceptions('none');

        expect(sentRequests[0].method).toBe('Debugger.setPauseOnExceptions');
        expect(sentRequests[0].params).toEqual({ state: 'none' });

        simulateResponse(sentRequests[0].id as number, {});
        await promise;
      });

      it('should send Debugger.setPauseOnExceptions with "all"', async () => {
        const promise = connectedClient.setPauseOnExceptions('all');

        expect(sentRequests[0].params).toEqual({ state: 'all' });

        simulateResponse(sentRequests[0].id as number, {});
        await promise;
      });

      it('should send Debugger.setPauseOnExceptions with "uncaught"', async () => {
        const promise = connectedClient.setPauseOnExceptions('uncaught');

        expect(sentRequests[0].params).toEqual({ state: 'uncaught' });

        simulateResponse(sentRequests[0].id as number, {});
        await promise;
      });
    });

    describe('evaluateOnCallFrame()', () => {
      it('should send Debugger.evaluateOnCallFrame with all params', async () => {
        const promise = connectedClient.evaluateOnCallFrame('frame-1', '1 + 2', 'myGroup', true);

        expect(sentRequests[0].method).toBe('Debugger.evaluateOnCallFrame');
        expect(sentRequests[0].params).toEqual({
          callFrameId: 'frame-1',
          expression: '1 + 2',
          objectGroup: 'myGroup',
          includeCommandLineAPI: true,
          silent: false,
          returnByValue: true,
          generatePreview: true,
        });

        simulateResponse(sentRequests[0].id as number, { result: { type: 'number', value: 3 } });

        const result = await promise;
        expect(result.result.type).toBe('number');
        expect(result.result.value).toBe(3);
      });

      it('should use default objectGroup and returnByValue', async () => {
        const promise = connectedClient.evaluateOnCallFrame('frame-1', 'x');

        expect(sentRequests[0].params).toEqual(
          expect.objectContaining({
            objectGroup: 'console',
            returnByValue: false,
          })
        );

        simulateResponse(sentRequests[0].id as number, { result: { type: 'undefined' } });
        await promise;
      });

      it('should return exceptionDetails when evaluation throws', async () => {
        const promise = connectedClient.evaluateOnCallFrame('frame-1', 'throw new Error("boom")');

        simulateResponse(sentRequests[0].id as number, {
          result: { type: 'object', subtype: 'error' },
          exceptionDetails: { text: 'Uncaught Error: boom' },
        });

        const result = await promise;
        expect(result.exceptionDetails?.text).toBe('Uncaught Error: boom');
      });
    });
  });

  // --------------------------------------------------------------------------
  // Runtime domain methods
  // --------------------------------------------------------------------------

  describe('Runtime domain methods', () => {
    let connectedClient: CDPClient;
    let sentRequests: Record<string, unknown>[];

    beforeEach(async () => {
      connectedClient = await createConnectedClient();

      sentRequests = [];
      mockWsInstance.send.mockImplementation((data: string) => {
        sentRequests.push(JSON.parse(data));
      });
    });

    describe('evaluate()', () => {
      it('should send Runtime.evaluate with all params', async () => {
        const promise = connectedClient.evaluate('2 + 2', 'testGroup', true);

        expect(sentRequests[0].method).toBe('Runtime.evaluate');
        expect(sentRequests[0].params).toEqual({
          expression: '2 + 2',
          objectGroup: 'testGroup',
          includeCommandLineAPI: true,
          silent: false,
          returnByValue: true,
          generatePreview: true,
          awaitPromise: true,
        });

        simulateResponse(sentRequests[0].id as number, { result: { type: 'number', value: 4 } });

        const result = await promise;
        expect(result.result.value).toBe(4);
      });

      it('should use default objectGroup and returnByValue', async () => {
        const promise = connectedClient.evaluate('process.version');

        expect(sentRequests[0].params).toEqual(
          expect.objectContaining({
            objectGroup: 'console',
            returnByValue: false,
          })
        );

        simulateResponse(sentRequests[0].id as number, {
          result: { type: 'string', value: 'v20.0.0' },
        });
        await promise;
      });
    });

    describe('getProperties()', () => {
      it('should send Runtime.getProperties request with defaults', async () => {
        const promise = connectedClient.getProperties('obj-1');

        expect(sentRequests[0].method).toBe('Runtime.getProperties');
        expect(sentRequests[0].params).toEqual({
          objectId: 'obj-1',
          ownProperties: true,
          accessorPropertiesOnly: false,
          generatePreview: true,
        });

        simulateResponse(sentRequests[0].id as number, {
          result: [
            {
              name: 'a',
              value: { type: 'number', value: 1 },
              configurable: true,
              enumerable: true,
            },
          ],
        });

        const result = await promise;
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('a');
      });

      it('should pass custom ownProperties and generatePreview', async () => {
        const promise = connectedClient.getProperties('obj-2', false, false);

        expect(sentRequests[0].params).toEqual({
          objectId: 'obj-2',
          ownProperties: false,
          accessorPropertiesOnly: false,
          generatePreview: false,
        });

        simulateResponse(sentRequests[0].id as number, { result: [] });
        const result = await promise;
        expect(result).toEqual([]);
      });
    });

    describe('releaseObject()', () => {
      it('should send Runtime.releaseObject request', async () => {
        const promise = connectedClient.releaseObject('obj-1');

        expect(sentRequests[0].method).toBe('Runtime.releaseObject');
        expect(sentRequests[0].params).toEqual({ objectId: 'obj-1' });

        simulateResponse(sentRequests[0].id as number, {});
        await promise;
      });
    });

    describe('releaseObjectGroup()', () => {
      it('should send Runtime.releaseObjectGroup request', async () => {
        const promise = connectedClient.releaseObjectGroup('console');

        expect(sentRequests[0].method).toBe('Runtime.releaseObjectGroup');
        expect(sentRequests[0].params).toEqual({ objectGroup: 'console' });

        simulateResponse(sentRequests[0].id as number, {});
        await promise;
      });
    });
  });

  // --------------------------------------------------------------------------
  // Script management
  // --------------------------------------------------------------------------

  describe('Script management', () => {
    let connectedClient: CDPClient;

    beforeEach(async () => {
      connectedClient = await createConnectedClient();
      mockWsInstance.send.mockImplementation(() => {});
    });

    it('should return undefined for unknown script ID', () => {
      expect(connectedClient.getScript('nonexistent')).toBeUndefined();
    });

    it('should return undefined for unknown script URL', () => {
      expect(connectedClient.getScriptByUrl('file:///nonexistent.js')).toBeUndefined();
    });

    it('should return empty array when no scripts are loaded', () => {
      expect(connectedClient.getAllScripts()).toEqual([]);
    });

    it('should track scripts from Debugger.scriptParsed events', () => {
      simulateEvent('Debugger.scriptParsed', {
        scriptId: 'script-1',
        url: 'file:///app.js',
        startLine: 0,
        startColumn: 0,
        endLine: 200,
        endColumn: 0,
        executionContextId: 1,
        hash: 'hash123',
      });

      const script = connectedClient.getScript('script-1');
      expect(script).toBeDefined();
      expect(script?.url).toBe('file:///app.js');
    });

    it('should find scripts by URL', () => {
      simulateEvent('Debugger.scriptParsed', {
        scriptId: 'script-2',
        url: 'file:///utils.js',
        startLine: 0,
        startColumn: 0,
        endLine: 50,
        endColumn: 0,
        executionContextId: 1,
        hash: 'hash456',
      });

      const script = connectedClient.getScriptByUrl('file:///utils.js');
      expect(script).toBeDefined();
      expect(script?.scriptId).toBe('script-2');
    });

    it('should not add script to URL map if URL is empty', () => {
      simulateEvent('Debugger.scriptParsed', {
        scriptId: 'script-3',
        url: '',
        startLine: 0,
        startColumn: 0,
        endLine: 10,
        endColumn: 0,
        executionContextId: 1,
        hash: 'hash789',
      });

      expect(connectedClient.getScript('script-3')).toBeDefined();
      expect(connectedClient.getScriptByUrl('')).toBeUndefined();
    });

    it('should return all scripts', () => {
      simulateEvent('Debugger.scriptParsed', {
        scriptId: 'a',
        url: 'a.js',
        startLine: 0,
        startColumn: 0,
        endLine: 10,
        endColumn: 0,
        executionContextId: 1,
        hash: 'ha',
      });

      simulateEvent('Debugger.scriptParsed', {
        scriptId: 'b',
        url: 'b.js',
        startLine: 0,
        startColumn: 0,
        endLine: 20,
        endColumn: 0,
        executionContextId: 1,
        hash: 'hb',
      });

      const scripts = connectedClient.getAllScripts();
      expect(scripts).toHaveLength(2);
      expect(scripts.map((s) => s.scriptId)).toContain('a');
      expect(scripts.map((s) => s.scriptId)).toContain('b');
    });
  });

  // --------------------------------------------------------------------------
  // Message handling
  // --------------------------------------------------------------------------

  describe('handleMessage()', () => {
    let connectedClient: CDPClient;

    beforeEach(async () => {
      connectedClient = await createConnectedClient();
      mockWsInstance.send.mockImplementation(() => {});
    });

    it('should handle malformed JSON gracefully', () => {
      expect(() => {
        mockWsInstance.emit('message', 'not valid json{{{');
      }).not.toThrow();
    });

    it('should handle response with error', async () => {
      const promise = connectedClient.resume();

      const sentData = JSON.parse(mockWsInstance.send.mock.calls[0][0]);
      simulateResponse(sentData.id, undefined, { code: -32601, message: 'Method not found' });

      await expect(promise).rejects.toThrow('Debugger.resume failed: Method not found');
    });

    it('should warn on response for unknown request ID', () => {
      // Should not throw — just logs a warning
      expect(() => {
        simulateResponse(99999, { data: 'orphan' });
      }).not.toThrow();
    });

    it('should emit CDP events with params', () => {
      const handler = vi.fn();
      connectedClient.on('Debugger.paused', handler);

      simulateEvent('Debugger.paused', {
        callFrames: [],
        reason: 'breakpoint',
        hitBreakpoints: ['bp-1'],
      });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: 'breakpoint',
          hitBreakpoints: ['bp-1'],
        })
      );
    });

    it('should emit Runtime.consoleAPICalled events', () => {
      const handler = vi.fn();
      connectedClient.on('Runtime.consoleAPICalled', handler);

      simulateEvent('Runtime.consoleAPICalled', {
        type: 'log',
        args: [{ type: 'string', value: 'hello' }],
        executionContextId: 1,
        timestamp: Date.now(),
      });

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ type: 'log' }));
    });

    it('should emit Runtime.exceptionThrown events', () => {
      const handler = vi.fn();
      connectedClient.on('Runtime.exceptionThrown', handler);

      simulateEvent('Runtime.exceptionThrown', {
        timestamp: Date.now(),
        exceptionDetails: {
          exceptionId: 1,
          text: 'Uncaught TypeError',
          lineNumber: 5,
          columnNumber: 10,
        },
      });

      expect(handler).toHaveBeenCalled();
    });

    it('should emit Debugger.resumed event', () => {
      const handler = vi.fn();
      connectedClient.on('Debugger.resumed', handler);

      simulateEvent('Debugger.resumed', {});

      expect(handler).toHaveBeenCalled();
    });

    it('should emit Debugger.breakpointResolved event', () => {
      const handler = vi.fn();
      connectedClient.on('Debugger.breakpointResolved', handler);

      simulateEvent('Debugger.breakpointResolved', {
        breakpointId: 'bp-1',
        location: { scriptId: 's1', lineNumber: 10, columnNumber: 0 },
      });

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ breakpointId: 'bp-1' }));
    });

    it('should emit Debugger.scriptFailedToParse event', () => {
      const handler = vi.fn();
      connectedClient.on('Debugger.scriptFailedToParse', handler);

      simulateEvent('Debugger.scriptFailedToParse', {
        scriptId: 'fail-1',
        url: 'file:///bad.js',
        startLine: 0,
        startColumn: 0,
        endLine: 0,
        endColumn: 0,
        executionContextId: 1,
        hash: 'xxx',
        errorLine: 5,
        errorMessage: 'SyntaxError',
      });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ errorMessage: 'SyntaxError' })
      );
    });

    it('should handle response with empty result', async () => {
      const sentRequests: Record<string, unknown>[] = [];
      mockWsInstance.send.mockImplementation((data: string) => {
        sentRequests.push(JSON.parse(data));
      });

      const promise = connectedClient.resume();
      // Send response with no result field — should default to {}
      mockWsInstance.emit('message', JSON.stringify({ id: sentRequests[0].id }));

      await promise; // Should resolve without error
    });
  });

  // --------------------------------------------------------------------------
  // rejectAllPending
  // --------------------------------------------------------------------------

  describe('rejectAllPending()', () => {
    it('should reject all pending requests on disconnect', async () => {
      const connectedClient = await createConnectedClient();

      mockWsInstance.send.mockImplementation(() => {});

      // Fire multiple requests without responding
      const p1 = connectedClient.resume();
      const p2 = connectedClient.stepOver();
      const p3 = connectedClient.pause();

      // Disconnect — should reject all
      await connectedClient.disconnect();

      await expect(p1).rejects.toThrow('Client disconnecting');
      await expect(p2).rejects.toThrow('Client disconnecting');
      await expect(p3).rejects.toThrow('Client disconnecting');
    });

    it('should reject all pending on WebSocket close', async () => {
      const connectedClient = await createConnectedClient();

      mockWsInstance.send.mockImplementation(() => {});

      const p1 = connectedClient.resume();

      // Simulate WebSocket close
      mockWsInstance.readyState = 3;
      mockWsInstance.emit('close', 1006, Buffer.from('Abnormal'));

      await expect(p1).rejects.toThrow('WebSocket closed');
    });
  });
});
