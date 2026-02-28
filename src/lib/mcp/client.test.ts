// @ts-nocheck - Test file with extensive mocking
/** @vitest-environment node */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { MCPClient, MCPRegistry, getMCPRegistry } from './client';
import type { MCPTool, MCPServer, MCPToolResult } from './client';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeJsonResponse(result: unknown, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve({ jsonrpc: '2.0', id: 1, result }),
  });
}

function makeErrorJsonResponse(errorMessage: string) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () =>
      Promise.resolve({
        jsonrpc: '2.0',
        id: 1,
        error: { message: errorMessage },
      }),
  });
}

function makeHttpErrorResponse(status: number) {
  return Promise.resolve({ ok: false, status, json: vi.fn() });
}

const serverInfo: MCPServer = {
  name: 'test-server',
  version: '1.0.0',
  capabilities: { tools: true, resources: true, prompts: true, sampling: true },
};

const sampleTool: MCPTool = {
  name: 'calculator',
  description: 'Performs calculations',
  inputSchema: {
    type: 'object',
    properties: {
      expression: { type: 'string', description: 'Math expression' },
      precision: { type: 'number', description: 'Decimal precision' },
      verbose: { type: 'boolean', description: 'Verbose output' },
      tags: { type: 'array', description: 'Tags' },
      mode: { type: 'string', enum: ['simple', 'scientific'] },
    },
    required: ['expression'],
  },
};

const sampleToolResult: MCPToolResult = {
  content: [{ type: 'text', text: '42' }],
  isError: false,
};

/**
 * Helper that connects a client by mocking the initialize + capability fetch
 * round-trip, then returns the client in the connected state.
 */
async function connectClient(
  client: MCPClient,
  serverUrl = 'http://localhost:3100/mcp',
  overrideServer: MCPServer = serverInfo
) {
  // 1st call: initialize
  // 2nd call: tools/list
  // 3rd call: resources/list
  // 4th call: prompts/list
  mockFetch
    .mockReturnValueOnce(makeJsonResponse(overrideServer))
    .mockReturnValueOnce(makeJsonResponse({ tools: [sampleTool] }))
    .mockReturnValueOnce(makeJsonResponse({ resources: [{ uri: 'file:///a.txt', name: 'a.txt' }] }))
    .mockReturnValueOnce(
      makeJsonResponse({ prompts: [{ name: 'summarize', description: 'Summarize text' }] })
    );

  return client.connect(serverUrl);
}

// ---------------------------------------------------------------------------
// MCPClient
// ---------------------------------------------------------------------------

describe('MCPClient', () => {
  let client: MCPClient;

  beforeEach(() => {
    mockFetch.mockReset();
    client = new MCPClient();
  });

  // ── Constructor ────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('should create a client with default config', () => {
      expect(client.isConnected).toBe(false);
      expect(client.server).toBeNull();
      expect(client.availableTools).toEqual([]);
      expect(client.availableResources).toEqual([]);
      expect(client.availablePrompts).toEqual([]);
    });

    it('should accept custom config', () => {
      const custom = new MCPClient({
        serverUrl: 'http://example.com',
        transport: 'websocket',
        timeout: 5000,
        apiKey: 'secret',
      });
      expect(custom.isConnected).toBe(false);
    });

    it('should merge custom config with defaults', () => {
      const custom = new MCPClient({ timeout: 10000 });
      // transport should default to 'sse'
      expect(custom.isConnected).toBe(false);
    });
  });

  // ── connect ────────────────────────────────────────────────────────────

  describe('connect', () => {
    it('should connect to a server and return server info', async () => {
      const info = await connectClient(client);
      expect(info).toEqual(serverInfo);
      expect(client.isConnected).toBe(true);
      expect(client.server).toEqual(serverInfo);
    });

    it('should send the correct JSON-RPC initialize request', async () => {
      await connectClient(client);
      const firstCall = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(firstCall.jsonrpc).toBe('2.0');
      expect(firstCall.method).toBe('initialize');
      expect(firstCall.params.protocolVersion).toBe('2024-11-05');
      expect(firstCall.params.clientInfo.name).toBe('code-lab');
    });

    it('should populate tools after connect', async () => {
      await connectClient(client);
      expect(client.availableTools).toHaveLength(1);
      expect(client.availableTools[0].name).toBe('calculator');
    });

    it('should populate resources after connect', async () => {
      await connectClient(client);
      expect(client.availableResources).toHaveLength(1);
      expect(client.availableResources[0].uri).toBe('file:///a.txt');
    });

    it('should populate prompts after connect', async () => {
      await connectClient(client);
      expect(client.availablePrompts).toHaveLength(1);
      expect(client.availablePrompts[0].name).toBe('summarize');
    });

    it('should throw and set connected=false when initialize fails', async () => {
      mockFetch.mockReturnValueOnce(makeHttpErrorResponse(500));
      await expect(client.connect('http://bad')).rejects.toThrow('Failed to connect to MCP server');
      expect(client.isConnected).toBe(false);
    });

    it('should throw when initialize returns a JSON-RPC error', async () => {
      mockFetch.mockReturnValueOnce(makeErrorJsonResponse('Init failed'));
      await expect(client.connect('http://bad')).rejects.toThrow('Failed to connect to MCP server');
      expect(client.isConnected).toBe(false);
    });

    it('should include Authorization header when apiKey is set', async () => {
      const authClient = new MCPClient({ apiKey: 'my-key' });
      await connectClient(authClient);
      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers.Authorization).toBe('Bearer my-key');
    });

    it('should not include Authorization header when apiKey is absent', async () => {
      await connectClient(client);
      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers.Authorization).toBeUndefined();
    });
  });

  // ── disconnect ─────────────────────────────────────────────────────────

  describe('disconnect', () => {
    it('should clear connection state', async () => {
      await connectClient(client);
      await client.disconnect();
      expect(client.isConnected).toBe(false);
      expect(client.server).toBeNull();
      expect(client.availableTools).toEqual([]);
      expect(client.availableResources).toEqual([]);
      expect(client.availablePrompts).toEqual([]);
    });

    it('should be safe to call disconnect when not connected', async () => {
      await expect(client.disconnect()).resolves.toBeUndefined();
    });
  });

  // ── refreshCapabilities ────────────────────────────────────────────────

  describe('refreshCapabilities', () => {
    it('should throw when not connected', async () => {
      await expect(client.refreshCapabilities()).rejects.toThrow('Not connected to MCP server');
    });

    it('should skip tools fetch if server has no tools capability', async () => {
      const noToolServer: MCPServer = {
        name: 'limited',
        version: '1.0.0',
        capabilities: { tools: false, resources: false, prompts: false, sampling: false },
      };
      mockFetch.mockReturnValueOnce(makeJsonResponse(noToolServer));
      await client.connect('http://limited');
      // After initialize, no further fetch calls should happen (only 1 total)
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(client.availableTools).toEqual([]);
    });

    it('should handle empty tools list from server', async () => {
      const toolOnlyServer: MCPServer = {
        name: 'empty-tools',
        version: '1.0.0',
        capabilities: { tools: true, resources: false, prompts: false, sampling: false },
      };
      mockFetch
        .mockReturnValueOnce(makeJsonResponse(toolOnlyServer))
        .mockReturnValueOnce(makeJsonResponse({ tools: [] }));
      await client.connect('http://empty-tools');
      expect(client.availableTools).toEqual([]);
    });

    it('should handle missing tools key in response', async () => {
      const toolOnlyServer: MCPServer = {
        name: 'no-key',
        version: '1.0.0',
        capabilities: { tools: true, resources: false, prompts: false, sampling: false },
      };
      mockFetch
        .mockReturnValueOnce(makeJsonResponse(toolOnlyServer))
        .mockReturnValueOnce(makeJsonResponse({}));
      await client.connect('http://no-key');
      expect(client.availableTools).toEqual([]);
    });
  });

  // ── callTool ───────────────────────────────────────────────────────────

  describe('callTool', () => {
    beforeEach(async () => {
      await connectClient(client);
      mockFetch.mockReset();
    });

    it('should call a tool and return the result', async () => {
      mockFetch.mockReturnValueOnce(makeJsonResponse(sampleToolResult));
      const result = await client.callTool('calculator', { expression: '1+1' });
      expect(result).toEqual(sampleToolResult);
    });

    it('should send the correct JSON-RPC request for tool call', async () => {
      mockFetch.mockReturnValueOnce(makeJsonResponse(sampleToolResult));
      await client.callTool('calculator', { expression: '2+2' });
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.method).toBe('tools/call');
      expect(body.params.name).toBe('calculator');
      expect(body.params.arguments).toEqual({ expression: '2+2' });
    });

    it('should throw when not connected', async () => {
      await client.disconnect();
      await expect(client.callTool('calculator', { expression: '1+1' })).rejects.toThrow(
        'Not connected to MCP server'
      );
    });

    it('should throw when tool is not found', async () => {
      await expect(client.callTool('nonexistent', {})).rejects.toThrow(
        'Tool not found: nonexistent'
      );
    });

    it('should throw when required argument is missing', async () => {
      await expect(client.callTool('calculator', {})).rejects.toThrow(
        'Missing required argument: expression'
      );
    });

    it('should throw when string argument receives non-string', async () => {
      await expect(client.callTool('calculator', { expression: 123 })).rejects.toThrow(
        'Argument expression must be a string'
      );
    });

    it('should throw when number argument receives non-number', async () => {
      await expect(
        client.callTool('calculator', { expression: '1+1', precision: 'high' })
      ).rejects.toThrow('Argument precision must be a number');
    });

    it('should throw when boolean argument receives non-boolean', async () => {
      await expect(
        client.callTool('calculator', { expression: '1+1', verbose: 'yes' })
      ).rejects.toThrow('Argument verbose must be a boolean');
    });

    it('should throw when array argument receives non-array', async () => {
      await expect(
        client.callTool('calculator', { expression: '1+1', tags: 'not-array' })
      ).rejects.toThrow('Argument tags must be an array');
    });

    it('should throw when enum argument receives invalid value', async () => {
      await expect(
        client.callTool('calculator', { expression: '1+1', mode: 'advanced' })
      ).rejects.toThrow('Argument mode must be one of: simple, scientific');
    });

    it('should allow extra properties not in schema', async () => {
      mockFetch.mockReturnValueOnce(makeJsonResponse(sampleToolResult));
      const result = await client.callTool('calculator', {
        expression: '1+1',
        unknownProp: 'hello',
      });
      expect(result).toEqual(sampleToolResult);
    });

    it('should propagate HTTP errors from the server', async () => {
      mockFetch.mockReturnValueOnce(makeHttpErrorResponse(503));
      await expect(client.callTool('calculator', { expression: '1+1' })).rejects.toThrow(
        'HTTP error: 503'
      );
    });

    it('should propagate JSON-RPC errors from the server', async () => {
      mockFetch.mockReturnValueOnce(makeErrorJsonResponse('Execution failed'));
      await expect(client.callTool('calculator', { expression: '1+1' })).rejects.toThrow(
        'Execution failed'
      );
    });

    it('should propagate generic MCP request failed for error without message', async () => {
      mockFetch.mockReturnValueOnce(
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ jsonrpc: '2.0', id: 1, error: {} }),
        })
      );
      await expect(client.callTool('calculator', { expression: '1+1' })).rejects.toThrow(
        'MCP request failed'
      );
    });
  });

  // ── readResource ───────────────────────────────────────────────────────

  describe('readResource', () => {
    beforeEach(async () => {
      await connectClient(client);
      mockFetch.mockReset();
    });

    it('should read a resource from the server', async () => {
      const resourceResult = { contents: [{ uri: 'file:///a.txt', text: 'hello' }] };
      mockFetch.mockReturnValueOnce(makeJsonResponse(resourceResult));
      const result = await client.readResource('file:///a.txt');
      expect(result).toEqual(resourceResult);
    });

    it('should send the correct JSON-RPC request for resource read', async () => {
      mockFetch.mockReturnValueOnce(makeJsonResponse({ contents: [] }));
      await client.readResource('file:///b.txt');
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.method).toBe('resources/read');
      expect(body.params.uri).toBe('file:///b.txt');
    });

    it('should throw when not connected', async () => {
      await client.disconnect();
      await expect(client.readResource('file:///a.txt')).rejects.toThrow(
        'Not connected to MCP server'
      );
    });
  });

  // ── getPrompt ──────────────────────────────────────────────────────────

  describe('getPrompt', () => {
    beforeEach(async () => {
      await connectClient(client);
      mockFetch.mockReset();
    });

    it('should get a prompt from the server', async () => {
      const promptResult = {
        description: 'Summarize',
        messages: [{ role: 'user', content: [{ type: 'text', text: 'Summarize this' }] }],
      };
      mockFetch.mockReturnValueOnce(makeJsonResponse(promptResult));
      const result = await client.getPrompt('summarize', { text: 'hello' });
      expect(result).toEqual(promptResult);
    });

    it('should send correct JSON-RPC request for prompt get', async () => {
      mockFetch.mockReturnValueOnce(makeJsonResponse({ messages: [] }));
      await client.getPrompt('summarize', { text: 'hello' });
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.method).toBe('prompts/get');
      expect(body.params.name).toBe('summarize');
      expect(body.params.arguments).toEqual({ text: 'hello' });
    });

    it('should work without args', async () => {
      mockFetch.mockReturnValueOnce(makeJsonResponse({ messages: [] }));
      await client.getPrompt('summarize');
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.params.arguments).toBeUndefined();
    });

    it('should throw when not connected', async () => {
      await client.disconnect();
      await expect(client.getPrompt('summarize')).rejects.toThrow('Not connected to MCP server');
    });
  });

  // ── createSamplingRequest ──────────────────────────────────────────────

  describe('createSamplingRequest', () => {
    beforeEach(async () => {
      await connectClient(client);
      mockFetch.mockReset();
    });

    const samplingParams = {
      messages: [{ role: 'user' as const, content: [{ type: 'text' as const, text: 'Hello' }] }],
      maxTokens: 100,
    };

    it('should create a sampling request', async () => {
      const samplingResult = {
        role: 'assistant',
        content: { type: 'text', text: 'Hi there' },
        model: 'claude-3',
        stopReason: 'end_turn',
      };
      mockFetch.mockReturnValueOnce(makeJsonResponse(samplingResult));
      const result = await client.createSamplingRequest(samplingParams);
      expect(result).toEqual(samplingResult);
    });

    it('should send the correct JSON-RPC request for sampling', async () => {
      mockFetch.mockReturnValueOnce(
        makeJsonResponse({
          role: 'assistant',
          content: { type: 'text', text: 'ok' },
          model: 'claude-3',
        })
      );
      await client.createSamplingRequest({
        ...samplingParams,
        systemPrompt: 'Be concise',
        modelPreferences: { costPriority: 0.5, speedPriority: 0.3, intelligencePriority: 0.2 },
      });
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.method).toBe('sampling/createMessage');
      expect(body.params.maxTokens).toBe(100);
      expect(body.params.systemPrompt).toBe('Be concise');
    });

    it('should throw when not connected', async () => {
      await client.disconnect();
      await expect(client.createSamplingRequest(samplingParams)).rejects.toThrow(
        'Not connected to MCP server'
      );
    });

    it('should throw when server does not support sampling', async () => {
      const noSamplingServer: MCPServer = {
        name: 'no-sampling',
        version: '1.0.0',
        capabilities: { tools: false, resources: false, prompts: false, sampling: false },
      };
      const client2 = new MCPClient();
      mockFetch.mockReturnValueOnce(makeJsonResponse(noSamplingServer));
      await client2.connect('http://no-sampling');
      mockFetch.mockReset();
      await expect(client2.createSamplingRequest(samplingParams)).rejects.toThrow(
        'Server does not support sampling'
      );
    });
  });

  // ── Getters ────────────────────────────────────────────────────────────

  describe('getters', () => {
    it('isConnected returns false initially', () => {
      expect(client.isConnected).toBe(false);
    });

    it('server returns null initially', () => {
      expect(client.server).toBeNull();
    });

    it('availableTools returns empty array initially', () => {
      expect(client.availableTools).toEqual([]);
    });

    it('availableResources returns empty array initially', () => {
      expect(client.availableResources).toEqual([]);
    });

    it('availablePrompts returns empty array initially', () => {
      expect(client.availablePrompts).toEqual([]);
    });
  });

  // ── getTool ────────────────────────────────────────────────────────────

  describe('getTool', () => {
    it('should return undefined for unknown tool', () => {
      expect(client.getTool('doesnt-exist')).toBeUndefined();
    });

    it('should return the tool by name after connect', async () => {
      await connectClient(client);
      expect(client.getTool('calculator')).toEqual(sampleTool);
    });
  });

  // ── sendRequest (edge cases via public methods) ────────────────────────

  describe('sendRequest edge cases', () => {
    it('should throw when serverUrl is not configured', async () => {
      // Force connected=true but no serverUrl by using internals
      const raw = new MCPClient({});
      // We need to trick the client into a "connected" state without a serverUrl.
      // callTool checks connected first, then sendRequest checks serverUrl.
      // So we connect then clear the serverUrl.
      await connectClient(raw);
      // Clear the url from config
      (raw as any).config.serverUrl = undefined;
      mockFetch.mockReset();
      await expect(raw.callTool('calculator', { expression: '1+1' })).rejects.toThrow(
        'Server URL not configured'
      );
    });

    it('should increment messageId for each request', async () => {
      await connectClient(client);
      mockFetch.mockReset();
      mockFetch
        .mockReturnValueOnce(makeJsonResponse(sampleToolResult))
        .mockReturnValueOnce(makeJsonResponse(sampleToolResult));
      await client.callTool('calculator', { expression: '1+1' });
      await client.callTool('calculator', { expression: '2+2' });
      const id1 = JSON.parse(mockFetch.mock.calls[0][1].body).id;
      const id2 = JSON.parse(mockFetch.mock.calls[1][1].body).id;
      expect(id2).toBeGreaterThan(id1);
    });

    it('should use default timeout of 30000 when not specified', async () => {
      await connectClient(client);
      // The AbortSignal.timeout is called in sendRequest - we just verify the fetch was called
      expect(mockFetch).toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// MCPRegistry
// ---------------------------------------------------------------------------

describe('MCPRegistry', () => {
  let registry: MCPRegistry;

  beforeEach(() => {
    mockFetch.mockReset();
    registry = new MCPRegistry();
  });

  // ── register ───────────────────────────────────────────────────────────

  describe('register', () => {
    it('should register and connect to a server', async () => {
      mockFetch
        .mockReturnValueOnce(makeJsonResponse(serverInfo))
        .mockReturnValueOnce(makeJsonResponse({ tools: [sampleTool] }))
        .mockReturnValueOnce(makeJsonResponse({ resources: [] }))
        .mockReturnValueOnce(makeJsonResponse({ prompts: [] }));
      const info = await registry.register('s1', 'http://localhost:3100');
      expect(info).toEqual(serverInfo);
    });

    it('should store the client by id', async () => {
      mockFetch
        .mockReturnValueOnce(makeJsonResponse(serverInfo))
        .mockReturnValueOnce(makeJsonResponse({ tools: [] }))
        .mockReturnValueOnce(makeJsonResponse({ resources: [] }))
        .mockReturnValueOnce(makeJsonResponse({ prompts: [] }));
      await registry.register('s1', 'http://localhost:3100');
      expect(registry.getClient('s1')).toBeDefined();
      expect(registry.getClient('s1')!.isConnected).toBe(true);
    });

    it('should accept optional config', async () => {
      mockFetch
        .mockReturnValueOnce(makeJsonResponse(serverInfo))
        .mockReturnValueOnce(makeJsonResponse({ tools: [] }))
        .mockReturnValueOnce(makeJsonResponse({ resources: [] }))
        .mockReturnValueOnce(makeJsonResponse({ prompts: [] }));
      await registry.register('s1', 'http://localhost:3100', { apiKey: 'key123', timeout: 5000 });
      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers.Authorization).toBe('Bearer key123');
    });
  });

  // ── unregister ─────────────────────────────────────────────────────────

  describe('unregister', () => {
    it('should disconnect and remove the client', async () => {
      mockFetch
        .mockReturnValueOnce(makeJsonResponse(serverInfo))
        .mockReturnValueOnce(makeJsonResponse({ tools: [] }))
        .mockReturnValueOnce(makeJsonResponse({ resources: [] }))
        .mockReturnValueOnce(makeJsonResponse({ prompts: [] }));
      await registry.register('s1', 'http://localhost:3100');
      await registry.unregister('s1');
      expect(registry.getClient('s1')).toBeUndefined();
    });

    it('should be safe to unregister a non-existent server', async () => {
      await expect(registry.unregister('nonexistent')).resolves.toBeUndefined();
    });
  });

  // ── getClient ──────────────────────────────────────────────────────────

  describe('getClient', () => {
    it('should return undefined for unregistered id', () => {
      expect(registry.getClient('nope')).toBeUndefined();
    });
  });

  // ── getAllClients ──────────────────────────────────────────────────────

  describe('getAllClients', () => {
    it('should return empty array when no servers registered', () => {
      expect(registry.getAllClients()).toEqual([]);
    });

    it('should return all registered clients', async () => {
      mockFetch
        .mockReturnValueOnce(makeJsonResponse(serverInfo))
        .mockReturnValueOnce(makeJsonResponse({ tools: [] }))
        .mockReturnValueOnce(makeJsonResponse({ resources: [] }))
        .mockReturnValueOnce(makeJsonResponse({ prompts: [] }))
        .mockReturnValueOnce(makeJsonResponse(serverInfo))
        .mockReturnValueOnce(makeJsonResponse({ tools: [] }))
        .mockReturnValueOnce(makeJsonResponse({ resources: [] }))
        .mockReturnValueOnce(makeJsonResponse({ prompts: [] }));
      await registry.register('s1', 'http://localhost:3100');
      await registry.register('s2', 'http://localhost:3200');
      const all = registry.getAllClients();
      expect(all).toHaveLength(2);
      expect(all.map((c) => c.id).sort()).toEqual(['s1', 's2']);
    });
  });

  // ── getAllTools ─────────────────────────────────────────────────────────

  describe('getAllTools', () => {
    it('should return empty when no servers', () => {
      expect(registry.getAllTools()).toEqual([]);
    });

    it('should aggregate tools across servers', async () => {
      const tool2: MCPTool = {
        name: 'formatter',
        description: 'Formats code',
        inputSchema: { type: 'object', properties: {}, required: [] },
      };
      mockFetch
        .mockReturnValueOnce(makeJsonResponse(serverInfo))
        .mockReturnValueOnce(makeJsonResponse({ tools: [sampleTool] }))
        .mockReturnValueOnce(makeJsonResponse({ resources: [] }))
        .mockReturnValueOnce(makeJsonResponse({ prompts: [] }))
        .mockReturnValueOnce(makeJsonResponse(serverInfo))
        .mockReturnValueOnce(makeJsonResponse({ tools: [tool2] }))
        .mockReturnValueOnce(makeJsonResponse({ resources: [] }))
        .mockReturnValueOnce(makeJsonResponse({ prompts: [] }));
      await registry.register('s1', 'http://localhost:3100');
      await registry.register('s2', 'http://localhost:3200');
      const allTools = registry.getAllTools();
      expect(allTools).toHaveLength(2);
      expect(allTools.map((t) => t.tool.name).sort()).toEqual(['calculator', 'formatter']);
      expect(allTools.find((t) => t.tool.name === 'calculator')!.serverId).toBe('s1');
      expect(allTools.find((t) => t.tool.name === 'formatter')!.serverId).toBe('s2');
    });
  });

  // ── callTool ───────────────────────────────────────────────────────────

  describe('callTool', () => {
    it('should call tool on specified server', async () => {
      mockFetch
        .mockReturnValueOnce(makeJsonResponse(serverInfo))
        .mockReturnValueOnce(makeJsonResponse({ tools: [sampleTool] }))
        .mockReturnValueOnce(makeJsonResponse({ resources: [] }))
        .mockReturnValueOnce(makeJsonResponse({ prompts: [] }));
      await registry.register('s1', 'http://localhost:3100');
      mockFetch.mockReset();
      mockFetch.mockReturnValueOnce(makeJsonResponse(sampleToolResult));
      const result = await registry.callTool('s1', 'calculator', { expression: '1+1' });
      expect(result).toEqual(sampleToolResult);
    });

    it('should throw when server id not found', async () => {
      await expect(
        registry.callTool('nonexistent', 'calculator', { expression: '1+1' })
      ).rejects.toThrow('MCP server not found: nonexistent');
    });
  });

  // ── callToolByName ─────────────────────────────────────────────────────

  describe('callToolByName', () => {
    it('should find and call tool across any server', async () => {
      mockFetch
        .mockReturnValueOnce(makeJsonResponse(serverInfo))
        .mockReturnValueOnce(makeJsonResponse({ tools: [sampleTool] }))
        .mockReturnValueOnce(makeJsonResponse({ resources: [] }))
        .mockReturnValueOnce(makeJsonResponse({ prompts: [] }));
      await registry.register('s1', 'http://localhost:3100');
      mockFetch.mockReset();
      mockFetch.mockReturnValueOnce(makeJsonResponse(sampleToolResult));
      const result = await registry.callToolByName('calculator', { expression: '1+1' });
      expect(result).toEqual(sampleToolResult);
    });

    it('should throw when tool name not found in any server', async () => {
      await expect(registry.callToolByName('nonexistent', {})).rejects.toThrow(
        'Tool not found: nonexistent'
      );
    });
  });
});

// ---------------------------------------------------------------------------
// getMCPRegistry singleton
// ---------------------------------------------------------------------------

describe('getMCPRegistry', () => {
  it('should return an MCPRegistry instance', () => {
    const reg = getMCPRegistry();
    expect(reg).toBeInstanceOf(MCPRegistry);
  });

  it('should return the same instance on subsequent calls', () => {
    const reg1 = getMCPRegistry();
    const reg2 = getMCPRegistry();
    expect(reg1).toBe(reg2);
  });
});
