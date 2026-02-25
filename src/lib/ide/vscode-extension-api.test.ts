/**
 * VS CODE EXTENSION API TESTS
 *
 * Tests for IDE integration types and utilities:
 * - createMessageId
 * - buildMessage
 * - buildFileOpen / buildFileChange / buildFileSave
 * - buildSelectionChange / buildCommandExecute / buildChatSend
 * - buildError
 * - parseMessage
 * - isValidMessageType
 * - IDEClient class
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================================================
// TESTS — Pure functions (no external deps to mock)
// ============================================================================

describe('createMessageId', () => {
  let createMessageId: typeof import('./vscode-extension-api').createMessageId;

  beforeEach(async () => {
    const mod = await import('./vscode-extension-api');
    createMessageId = mod.createMessageId;
  });

  it('should return a string starting with "msg_"', () => {
    const id = createMessageId();
    expect(id).toMatch(/^msg_/);
  });

  it('should generate unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => createMessageId()));
    expect(ids.size).toBe(100);
  });

  it('should contain a timestamp component', () => {
    const id = createMessageId();
    const parts = id.split('_');
    expect(parts.length).toBe(3);
    const timestamp = parseInt(parts[1], 10);
    expect(timestamp).toBeGreaterThan(0);
    expect(timestamp).toBeLessThanOrEqual(Date.now());
  });
});

describe('buildMessage', () => {
  let buildMessage: typeof import('./vscode-extension-api').buildMessage;

  beforeEach(async () => {
    const mod = await import('./vscode-extension-api');
    buildMessage = mod.buildMessage;
  });

  it('should create a message with correct type and payload', () => {
    const msg = buildMessage('ping', { data: 'test' });
    expect(msg.type).toBe('ping');
    expect(msg.payload).toEqual({ data: 'test' });
  });

  it('should include an id and timestamp', () => {
    const msg = buildMessage('pong', {});
    expect(msg.id).toMatch(/^msg_/);
    expect(typeof msg.timestamp).toBe('number');
    expect(msg.timestamp).toBeGreaterThan(0);
  });
});

describe('buildFileOpen', () => {
  let buildFileOpen: typeof import('./vscode-extension-api').buildFileOpen;

  beforeEach(async () => {
    const mod = await import('./vscode-extension-api');
    buildFileOpen = mod.buildFileOpen;
  });

  it('should create file.open message', () => {
    const msg = buildFileOpen('/src/index.ts', 'const x = 1;', 'typescript');
    expect(msg.type).toBe('file.open');
    expect(msg.payload).toEqual({
      path: '/src/index.ts',
      content: 'const x = 1;',
      language: 'typescript',
    });
  });
});

describe('buildFileChange', () => {
  let buildFileChange: typeof import('./vscode-extension-api').buildFileChange;

  beforeEach(async () => {
    const mod = await import('./vscode-extension-api');
    buildFileChange = mod.buildFileChange;
  });

  it('should create file.change message with changes', () => {
    const changes = [
      {
        range: {
          start: { line: 1, column: 0 },
          end: { line: 1, column: 5 },
        },
        text: 'hello',
      },
    ];
    const msg = buildFileChange('/src/app.ts', changes);
    expect(msg.type).toBe('file.change');
    expect((msg.payload as { changes: unknown[] }).changes).toHaveLength(1);
  });
});

describe('buildFileSave', () => {
  let buildFileSave: typeof import('./vscode-extension-api').buildFileSave;

  beforeEach(async () => {
    const mod = await import('./vscode-extension-api');
    buildFileSave = mod.buildFileSave;
  });

  it('should create file.save message', () => {
    const msg = buildFileSave('/src/index.ts', 'updated content');
    expect(msg.type).toBe('file.save');
    expect(msg.payload).toEqual({
      path: '/src/index.ts',
      content: 'updated content',
    });
  });
});

describe('buildSelectionChange', () => {
  let buildSelectionChange: typeof import('./vscode-extension-api').buildSelectionChange;

  beforeEach(async () => {
    const mod = await import('./vscode-extension-api');
    buildSelectionChange = mod.buildSelectionChange;
  });

  it('should create selection.change message', () => {
    const selections = [
      {
        start: { line: 5, column: 0 },
        end: { line: 10, column: 20 },
      },
    ];
    const msg = buildSelectionChange('/src/app.ts', selections, 'selected text');
    expect(msg.type).toBe('selection.change');
    const payload = msg.payload as { selectedText?: string };
    expect(payload.selectedText).toBe('selected text');
  });

  it('should work without selectedText', () => {
    const msg = buildSelectionChange('/src/app.ts', []);
    expect(msg.type).toBe('selection.change');
  });
});

describe('buildCommandExecute', () => {
  let buildCommandExecute: typeof import('./vscode-extension-api').buildCommandExecute;

  beforeEach(async () => {
    const mod = await import('./vscode-extension-api');
    buildCommandExecute = mod.buildCommandExecute;
  });

  it('should create command.execute message', () => {
    const msg = buildCommandExecute('format', '--fix', { file: '/src/app.ts' });
    expect(msg.type).toBe('command.execute');
    expect(msg.payload).toEqual({
      command: 'format',
      args: '--fix',
      context: { file: '/src/app.ts' },
    });
  });

  it('should work without optional args and context', () => {
    const msg = buildCommandExecute('lint');
    expect(msg.type).toBe('command.execute');
    const payload = msg.payload as { command: string; args?: string };
    expect(payload.command).toBe('lint');
    expect(payload.args).toBeUndefined();
  });
});

describe('buildChatSend', () => {
  let buildChatSend: typeof import('./vscode-extension-api').buildChatSend;

  beforeEach(async () => {
    const mod = await import('./vscode-extension-api');
    buildChatSend = mod.buildChatSend;
  });

  it('should create chat.send message', () => {
    const msg = buildChatSend('Hello AI');
    expect(msg.type).toBe('chat.send');
    expect((msg.payload as { message: string }).message).toBe('Hello AI');
  });

  it('should include attachments', () => {
    const attachments = [
      { type: 'code' as const, content: 'const x = 1;', language: 'typescript' },
    ];
    const msg = buildChatSend('Explain this', attachments);
    const payload = msg.payload as { attachments: unknown[] };
    expect(payload.attachments).toHaveLength(1);
  });
});

describe('buildError', () => {
  let buildError: typeof import('./vscode-extension-api').buildError;

  beforeEach(async () => {
    const mod = await import('./vscode-extension-api');
    buildError = mod.buildError;
  });

  it('should create error message', () => {
    const msg = buildError('AUTH_FAILED', 'Token expired');
    expect(msg.type).toBe('error');
    expect(msg.payload).toEqual({
      code: 'AUTH_FAILED',
      message: 'Token expired',
      details: undefined,
    });
  });

  it('should include optional details', () => {
    const msg = buildError('RATE_LIMITED', 'Too many requests', { retryAfter: 60 });
    const payload = msg.payload as { details: Record<string, unknown> };
    expect(payload.details).toEqual({ retryAfter: 60 });
  });
});

describe('parseMessage', () => {
  let parseMessage: typeof import('./vscode-extension-api').parseMessage;

  beforeEach(async () => {
    const mod = await import('./vscode-extension-api');
    parseMessage = mod.parseMessage;
  });

  it('should parse valid JSON message', () => {
    const data = JSON.stringify({
      id: 'msg_123',
      type: 'ping',
      payload: {},
      timestamp: Date.now(),
    });
    const result = parseMessage(data);
    expect(result).not.toBeNull();
    expect(result!.type).toBe('ping');
  });

  it('should return null for invalid JSON', () => {
    const result = parseMessage('not valid json');
    expect(result).toBeNull();
  });

  it('should return null when id is missing', () => {
    const data = JSON.stringify({ type: 'ping', payload: {} });
    const result = parseMessage(data);
    expect(result).toBeNull();
  });

  it('should return null when type is missing', () => {
    const data = JSON.stringify({ id: 'msg_123', payload: {} });
    const result = parseMessage(data);
    expect(result).toBeNull();
  });

  it('should return null when payload is undefined', () => {
    const data = JSON.stringify({ id: 'msg_123', type: 'ping' });
    const result = parseMessage(data);
    expect(result).toBeNull();
  });

  it('should accept payload of null', () => {
    const data = JSON.stringify({ id: 'msg_123', type: 'ping', payload: null });
    const result = parseMessage(data);
    expect(result).not.toBeNull();
  });

  it('should accept payload of 0', () => {
    const data = JSON.stringify({ id: 'msg_123', type: 'ping', payload: 0 });
    const result = parseMessage(data);
    expect(result).not.toBeNull();
  });

  it('should accept payload of empty string', () => {
    const data = JSON.stringify({ id: 'msg_123', type: 'ping', payload: '' });
    const result = parseMessage(data);
    expect(result).not.toBeNull();
  });
});

describe('isValidMessageType', () => {
  let isValidMessageType: typeof import('./vscode-extension-api').isValidMessageType;

  beforeEach(async () => {
    const mod = await import('./vscode-extension-api');
    isValidMessageType = mod.isValidMessageType;
  });

  it('should return true for all client-to-server types', () => {
    expect(isValidMessageType('file.open')).toBe(true);
    expect(isValidMessageType('file.change')).toBe(true);
    expect(isValidMessageType('file.save')).toBe(true);
    expect(isValidMessageType('file.close')).toBe(true);
    expect(isValidMessageType('selection.change')).toBe(true);
    expect(isValidMessageType('command.execute')).toBe(true);
    expect(isValidMessageType('chat.send')).toBe(true);
    expect(isValidMessageType('ping')).toBe(true);
  });

  it('should return true for all server-to-client types', () => {
    expect(isValidMessageType('file.update')).toBe(true);
    expect(isValidMessageType('file.create')).toBe(true);
    expect(isValidMessageType('file.delete')).toBe(true);
    expect(isValidMessageType('chat.response')).toBe(true);
    expect(isValidMessageType('chat.stream')).toBe(true);
    expect(isValidMessageType('status.update')).toBe(true);
    expect(isValidMessageType('error')).toBe(true);
    expect(isValidMessageType('pong')).toBe(true);
  });

  it('should return false for invalid types', () => {
    expect(isValidMessageType('unknown')).toBe(false);
    expect(isValidMessageType('')).toBe(false);
    expect(isValidMessageType('file.rename')).toBe(false);
  });
});

// ============================================================================
// IDEClient class
// ============================================================================

describe('IDEClient', () => {
  let IDEClient: typeof import('./vscode-extension-api').IDEClient;
  let mockWs: {
    onopen: (() => void) | null;
    onclose: (() => void) | null;
    onerror: (() => void) | null;
    onmessage: ((event: { data: string }) => void) | null;
    close: ReturnType<typeof vi.fn>;
    send: ReturnType<typeof vi.fn>;
    readyState: number;
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    mockWs = {
      onopen: null,
      onclose: null,
      onerror: null,
      onmessage: null,
      close: vi.fn(),
      send: vi.fn(),
      readyState: 1, // WebSocket.OPEN
    };

    // Mock WebSocket constructor
    vi.stubGlobal(
      'WebSocket',
      vi.fn(() => mockWs)
    );

    // WebSocket.OPEN constant
    (globalThis as unknown as Record<string, Record<string, unknown>>).WebSocket.OPEN = 1;

    const mod = await import('./vscode-extension-api');
    IDEClient = mod.IDEClient;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('should create an IDEClient instance', () => {
    const client = new IDEClient({
      serverUrl: 'ws://localhost:3000',
      token: 'test-token',
    });
    expect(client).toBeInstanceOf(IDEClient);
  });

  it('should construct WebSocket URL with token on connect', async () => {
    const client = new IDEClient({
      serverUrl: 'ws://localhost:3000',
      token: 'my-token',
    });

    const connectPromise = client.connect();
    // Trigger onopen
    mockWs.onopen?.();
    await connectPromise;

    expect(WebSocket).toHaveBeenCalledWith('ws://localhost:3000/api/ide/ws?token=my-token');
  });

  it('should call onConnect callback when connected', async () => {
    const onConnect = vi.fn();
    const client = new IDEClient({
      serverUrl: 'ws://localhost:3000',
      token: 'token',
      onConnect,
    });

    const connectPromise = client.connect();
    mockWs.onopen?.();
    await connectPromise;

    expect(onConnect).toHaveBeenCalled();
  });

  it('should report isConnected correctly', async () => {
    const client = new IDEClient({
      serverUrl: 'ws://localhost:3000',
      token: 'token',
    });

    expect(client.isConnected()).toBe(false);

    const connectPromise = client.connect();
    mockWs.onopen?.();
    await connectPromise;

    expect(client.isConnected()).toBe(true);
  });

  it('should send messages as JSON', async () => {
    const client = new IDEClient({
      serverUrl: 'ws://localhost:3000',
      token: 'token',
    });

    const connectPromise = client.connect();
    mockWs.onopen?.();
    await connectPromise;

    const msg = {
      id: 'test-id',
      type: 'ping' as const,
      payload: {},
      timestamp: Date.now(),
    };
    client.send(msg);

    expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify(msg));
  });

  it('should not send when not connected', () => {
    const client = new IDEClient({
      serverUrl: 'ws://localhost:3000',
      token: 'token',
    });

    client.send({
      id: 'test-id',
      type: 'ping',
      payload: {},
      timestamp: Date.now(),
    });

    expect(mockWs.send).not.toHaveBeenCalled();
  });

  it('should call onDisconnect when connection closes', async () => {
    const onDisconnect = vi.fn();
    const client = new IDEClient({
      serverUrl: 'ws://localhost:3000',
      token: 'token',
      onDisconnect,
      maxReconnectAttempts: 0,
    });

    const connectPromise = client.connect();
    mockWs.onopen?.();
    await connectPromise;

    mockWs.onclose?.();
    expect(onDisconnect).toHaveBeenCalled();
  });

  it('should call onError when connection fails', async () => {
    const onError = vi.fn();
    const client = new IDEClient({
      serverUrl: 'ws://localhost:3000',
      token: 'token',
      onError,
    });

    const connectPromise = client.connect().catch(() => {});
    mockWs.onerror?.();
    await connectPromise;

    expect(onError).toHaveBeenCalled();
  });

  it('should dispatch incoming messages to onMessage', async () => {
    const onMessage = vi.fn();
    const client = new IDEClient({
      serverUrl: 'ws://localhost:3000',
      token: 'token',
      onMessage,
    });

    const connectPromise = client.connect();
    mockWs.onopen?.();
    await connectPromise;

    const incomingMsg = JSON.stringify({
      id: 'resp-1',
      type: 'pong',
      payload: {},
      timestamp: Date.now(),
    });
    mockWs.onmessage?.({ data: incomingMsg });

    expect(onMessage).toHaveBeenCalled();
    expect(onMessage.mock.calls[0][0].type).toBe('pong');
  });

  it('should disconnect and clean up', async () => {
    const client = new IDEClient({
      serverUrl: 'ws://localhost:3000',
      token: 'token',
    });

    const connectPromise = client.connect();
    mockWs.onopen?.();
    await connectPromise;

    client.disconnect();
    expect(mockWs.close).toHaveBeenCalled();
    expect(client.isConnected()).toBe(false);
  });

  it('should use convenience method sendFileOpen', async () => {
    const client = new IDEClient({
      serverUrl: 'ws://localhost:3000',
      token: 'token',
    });

    const connectPromise = client.connect();
    mockWs.onopen?.();
    await connectPromise;

    client.sendFileOpen('/file.ts', 'content', 'typescript');
    expect(mockWs.send).toHaveBeenCalled();
    const sent = JSON.parse(mockWs.send.mock.calls[0][0]);
    expect(sent.type).toBe('file.open');
  });

  it('should use convenience method sendFileChange', async () => {
    const client = new IDEClient({
      serverUrl: 'ws://localhost:3000',
      token: 'token',
    });

    const connectPromise = client.connect();
    mockWs.onopen?.();
    await connectPromise;

    client.sendFileChange('/file.ts', []);
    const sent = JSON.parse(mockWs.send.mock.calls[0][0]);
    expect(sent.type).toBe('file.change');
  });

  it('should use convenience method sendFileSave', async () => {
    const client = new IDEClient({
      serverUrl: 'ws://localhost:3000',
      token: 'token',
    });

    const connectPromise = client.connect();
    mockWs.onopen?.();
    await connectPromise;

    client.sendFileSave('/file.ts', 'saved content');
    const sent = JSON.parse(mockWs.send.mock.calls[0][0]);
    expect(sent.type).toBe('file.save');
  });

  it('should use convenience method sendSelectionChange', async () => {
    const client = new IDEClient({
      serverUrl: 'ws://localhost:3000',
      token: 'token',
    });

    const connectPromise = client.connect();
    mockWs.onopen?.();
    await connectPromise;

    client.sendSelectionChange('/file.ts', []);
    const sent = JSON.parse(mockWs.send.mock.calls[0][0]);
    expect(sent.type).toBe('selection.change');
  });

  it('sendAndWait should reject on timeout', async () => {
    const client = new IDEClient({
      serverUrl: 'ws://localhost:3000',
      token: 'token',
    });

    const connectPromise = client.connect();
    mockWs.onopen?.();
    await connectPromise;

    const msg = {
      id: 'timeout-msg',
      type: 'chat.send' as const,
      payload: { message: 'test' },
      timestamp: Date.now(),
    };

    const promise = client.sendAndWait(msg, 5000);
    vi.advanceTimersByTime(5001);

    await expect(promise).rejects.toThrow('Request timeout');
  });

  it('should apply default config values', () => {
    const client = new IDEClient({
      serverUrl: 'ws://localhost:3000',
      token: 'token',
    });
    // Verify client was created without error (default config applied)
    expect(client).toBeInstanceOf(IDEClient);
  });
});

// ============================================================================
// Type exports
// ============================================================================

describe('IDE type exports', () => {
  it('should export IDEMessage type', () => {
    const msg: import('./vscode-extension-api').IDEMessage = {
      id: 'test',
      type: 'ping',
      payload: {},
      timestamp: Date.now(),
    };
    expect(msg.type).toBe('ping');
  });

  it('should export Position type', () => {
    const pos: import('./vscode-extension-api').Position = { line: 1, column: 5 };
    expect(pos.line).toBe(1);
  });

  it('should export Range type', () => {
    const range: import('./vscode-extension-api').Range = {
      start: { line: 1, column: 0 },
      end: { line: 5, column: 10 },
    };
    expect(range.start.line).toBe(1);
  });

  it('should export TextChange type', () => {
    const change: import('./vscode-extension-api').TextChange = {
      range: {
        start: { line: 1, column: 0 },
        end: { line: 1, column: 5 },
      },
      text: 'replaced',
    };
    expect(change.text).toBe('replaced');
  });

  it('should export IDEErrorCode type', () => {
    const codes: import('./vscode-extension-api').IDEErrorCode[] = [
      'AUTH_FAILED',
      'PERMISSION_DENIED',
      'FILE_NOT_FOUND',
      'INVALID_MESSAGE',
      'RATE_LIMITED',
      'SESSION_EXPIRED',
      'SERVER_ERROR',
    ];
    expect(codes).toHaveLength(7);
  });

  it('should export IDEClientConfig type', () => {
    const config: import('./vscode-extension-api').IDEClientConfig = {
      serverUrl: 'ws://localhost',
      token: 'token',
      reconnectInterval: 3000,
      maxReconnectAttempts: 5,
    };
    expect(config.serverUrl).toBe('ws://localhost');
  });

  it('should export FileOpenPayload type', () => {
    const payload: import('./vscode-extension-api').FileOpenPayload = {
      path: '/file.ts',
      content: 'code',
      language: 'typescript',
    };
    expect(payload.language).toBe('typescript');
  });

  it('should export StatusUpdatePayload type', () => {
    const payload: import('./vscode-extension-api').StatusUpdatePayload = {
      connected: true,
      sessionId: 'session-1',
      model: 'gpt-5',
      tokensUsed: 1000,
    };
    expect(payload.connected).toBe(true);
  });
});
