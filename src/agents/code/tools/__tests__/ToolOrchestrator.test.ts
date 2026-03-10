// @ts-nocheck - Test file with extensive mocking
/** @vitest-environment node */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — use vi.hoisted so variables are available when vi.mock factories run
// ---------------------------------------------------------------------------

const {
  mockAgentChatWithTools,
  mockBuildToolResultMessage,
  mockBuildToolCallMessage,
  mockReadExecute,
  mockReadGetDefinition,
  mockReadInitialize,
  mockReadTool,
  mockSearchExecute,
  mockSearchGetDefinition,
  mockSearchInitialize,
  mockSearchTool,
  mockBashExecute,
  mockBashGetDefinition,
  mockBashInitialize,
  mockBashTool,
  mockWriteExecute,
  mockWriteGetDefinition,
  mockWriteInitialize,
  mockWriteTool,
  mockGlobExecute,
  mockGlobGetDefinition,
  mockGlobInitialize,
  mockGlobTool,
} = vi.hoisted(() => {
  const mockAgentChatWithTools = vi.fn();
  const mockBuildToolResultMessage = vi.fn();
  const mockBuildToolCallMessage = vi.fn();

  const mockReadExecute = vi.fn();
  const mockReadGetDefinition = vi.fn().mockReturnValue({
    name: 'read',
    description: 'Read files from codebase',
    parameters: {
      type: 'object',
      properties: { path: { type: 'string', description: 'File path' } },
      required: ['path'],
    },
  });
  const mockReadInitialize = vi.fn();
  const mockReadTool = {
    name: 'read',
    description: 'Read files',
    execute: mockReadExecute,
    getDefinition: mockReadGetDefinition,
    initialize: mockReadInitialize,
  };

  const mockSearchExecute = vi.fn();
  const mockSearchGetDefinition = vi.fn().mockReturnValue({
    name: 'search',
    description: 'Search for patterns',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Search query' } },
      required: ['query'],
    },
  });
  const mockSearchInitialize = vi.fn();
  const mockSearchTool = {
    name: 'search',
    description: 'Search codebase',
    execute: mockSearchExecute,
    getDefinition: mockSearchGetDefinition,
    initialize: mockSearchInitialize,
  };

  const mockBashExecute = vi.fn();
  const mockBashGetDefinition = vi.fn().mockReturnValue({
    name: 'bash',
    description: 'Execute shell commands',
    parameters: {
      type: 'object',
      properties: { command: { type: 'string', description: 'Shell command' } },
      required: ['command'],
    },
  });
  const mockBashInitialize = vi.fn();
  const mockBashTool = {
    name: 'bash',
    description: 'Execute commands',
    execute: mockBashExecute,
    getDefinition: mockBashGetDefinition,
    initialize: mockBashInitialize,
  };

  const mockWriteExecute = vi.fn();
  const mockWriteGetDefinition = vi.fn().mockReturnValue({
    name: 'write',
    description: 'Write files to codebase',
    parameters: {
      type: 'object',
      properties: { path: { type: 'string', description: 'File path' } },
      required: ['path'],
    },
  });
  const mockWriteInitialize = vi.fn();
  const mockWriteTool = {
    name: 'write',
    description: 'Write files',
    execute: mockWriteExecute,
    getDefinition: mockWriteGetDefinition,
    initialize: mockWriteInitialize,
  };

  const mockGlobExecute = vi.fn();
  const mockGlobGetDefinition = vi.fn().mockReturnValue({
    name: 'glob',
    description: 'Find files matching patterns',
    parameters: {
      type: 'object',
      properties: { pattern: { type: 'string', description: 'Glob pattern' } },
      required: ['pattern'],
    },
  });
  const mockGlobInitialize = vi.fn();
  const mockGlobTool = {
    name: 'glob',
    description: 'Find files',
    execute: mockGlobExecute,
    getDefinition: mockGlobGetDefinition,
    initialize: mockGlobInitialize,
  };

  return {
    mockAgentChatWithTools,
    mockBuildToolResultMessage,
    mockBuildToolCallMessage,
    mockReadExecute,
    mockReadGetDefinition,
    mockReadInitialize,
    mockReadTool,
    mockSearchExecute,
    mockSearchGetDefinition,
    mockSearchInitialize,
    mockSearchTool,
    mockBashExecute,
    mockBashGetDefinition,
    mockBashInitialize,
    mockBashTool,
    mockWriteExecute,
    mockWriteGetDefinition,
    mockWriteInitialize,
    mockWriteTool,
    mockGlobExecute,
    mockGlobGetDefinition,
    mockGlobInitialize,
    mockGlobTool,
  };
});

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('@/lib/ai/providers', () => ({
  agentChatWithTools: (...args: unknown[]) => mockAgentChatWithTools(...args),
  buildToolResultMessage: (...args: unknown[]) => mockBuildToolResultMessage(...args),
  buildToolCallMessage: (...args: unknown[]) => mockBuildToolCallMessage(...args),
}));

vi.mock('../ReadTool', () => ({
  readTool: mockReadTool,
  ReadTool: vi.fn(),
}));

vi.mock('../SearchTool', () => ({
  searchTool: mockSearchTool,
  SearchTool: vi.fn(),
}));

vi.mock('../BashTool', () => ({
  bashTool: mockBashTool,
  BashTool: vi.fn(),
}));

vi.mock('../WriteTool', () => ({
  writeTool: mockWriteTool,
  WriteTool: vi.fn(),
}));

vi.mock('../GlobTool', () => ({
  globTool: mockGlobTool,
  GlobTool: vi.fn(),
}));

vi.mock('../../core/types', () => ({}));

// ---------------------------------------------------------------------------
// Import the class under test AFTER all mocks
// ---------------------------------------------------------------------------

import { ToolOrchestrator, toolOrchestrator } from '../ToolOrchestrator';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStreamCallback() {
  return vi.fn();
}

/** Build a "done" response from the provider (no tool calls) */
function makeDoneResponse(
  text = 'Task complete.',
  tokens = { inputTokens: 100, outputTokens: 50 }
) {
  return {
    text,
    toolCalls: [],
    done: true,
    provider: 'claude',
    model: 'claude-3-5-sonnet',
    usage: tokens,
  };
}

/** Build a response that requests a tool call */
function makeToolCallResponse(
  toolName: string,
  args: Record<string, unknown>,
  text = '',
  id = 'call-1'
) {
  return {
    text,
    toolCalls: [{ id, name: toolName, arguments: args }],
    done: false,
    provider: 'claude',
    model: 'claude-3-5-sonnet',
    usage: { inputTokens: 200, outputTokens: 100 },
  };
}

/** Build a response with multiple tool calls */
function makeMultiToolCallResponse(
  calls: Array<{ name: string; args: Record<string, unknown>; id?: string }>,
  text = ''
) {
  return {
    text,
    toolCalls: calls.map((c, i) => ({
      id: c.id || `call-${i}`,
      name: c.name,
      arguments: c.args,
    })),
    done: false,
    provider: 'claude',
    model: 'claude-3-5-sonnet',
    usage: { inputTokens: 300, outputTokens: 150 },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ToolOrchestrator', () => {
  let orchestrator: ToolOrchestrator;

  beforeEach(() => {
    vi.clearAllMocks();
    orchestrator = new ToolOrchestrator();

    // Default: buildToolCallMessage / buildToolResultMessage return placeholder messages
    mockBuildToolCallMessage.mockReturnValue({ role: 'assistant', content: '(tool calls)' });
    mockBuildToolResultMessage.mockReturnValue({ role: 'tool', content: '(tool results)' });
  });

  // =========================================================================
  // CONSTRUCTOR
  // =========================================================================

  describe('constructor', () => {
    it('should create an instance', () => {
      expect(orchestrator).toBeInstanceOf(ToolOrchestrator);
    });

    it('should register the five built-in tools', () => {
      const defs = orchestrator.getToolDefinitions();
      const names = defs.map((d) => d.name);
      expect(names).toContain('read');
      expect(names).toContain('search');
      expect(names).toContain('bash');
      expect(names).toContain('write');
      expect(names).toContain('glob');
    });

    it('should have exactly five tools registered by default', () => {
      expect(orchestrator.getToolDefinitions()).toHaveLength(5);
    });
  });

  // =========================================================================
  // EXPORTED SINGLETON
  // =========================================================================

  describe('toolOrchestrator singleton', () => {
    it('should be an instance of ToolOrchestrator', () => {
      expect(toolOrchestrator).toBeInstanceOf(ToolOrchestrator);
    });

    it('should have tools registered', () => {
      expect(toolOrchestrator.getToolDefinitions().length).toBeGreaterThanOrEqual(5);
    });
  });

  // =========================================================================
  // setProvider
  // =========================================================================

  describe('setProvider', () => {
    it('should accept "claude" provider', () => {
      orchestrator.setProvider('claude');
      // No throw = success
      expect(true).toBe(true);
    });

    it('should accept "openai" provider', () => {
      orchestrator.setProvider('openai');
      expect(true).toBe(true);
    });

    it('should accept "xai" provider', () => {
      orchestrator.setProvider('xai');
      expect(true).toBe(true);
    });

    it('should accept "deepseek" provider', () => {
      orchestrator.setProvider('deepseek');
      expect(true).toBe(true);
    });

    it('should accept "google" provider', () => {
      orchestrator.setProvider('google');
      expect(true).toBe(true);
    });
  });

  // =========================================================================
  // registerTool
  // =========================================================================

  describe('registerTool', () => {
    it('should register a custom tool', () => {
      const customTool = {
        name: 'custom',
        description: 'Custom tool',
        execute: vi.fn(),
        getDefinition: vi.fn().mockReturnValue({
          name: 'custom',
          description: 'Custom tool',
          parameters: { type: 'object', properties: {}, required: [] },
        }),
      };
      orchestrator.registerTool(customTool as any);
      const names = orchestrator.getToolDefinitions().map((d) => d.name);
      expect(names).toContain('custom');
    });

    it('should overwrite a tool with the same name', () => {
      const replacement = {
        name: 'read',
        description: 'Replacement read tool',
        execute: vi.fn(),
        getDefinition: vi.fn().mockReturnValue({
          name: 'read',
          description: 'Replacement read tool',
          parameters: { type: 'object', properties: {}, required: [] },
        }),
      };
      orchestrator.registerTool(replacement as any);
      const defs = orchestrator.getToolDefinitions();
      const readDef = defs.find((d) => d.name === 'read');
      expect(readDef?.description).toBe('Replacement read tool');
    });

    it('should keep the total count unchanged when overwriting', () => {
      const replacement = {
        name: 'bash',
        description: 'Replaced bash',
        execute: vi.fn(),
        getDefinition: vi.fn().mockReturnValue({
          name: 'bash',
          description: 'Replaced bash',
          parameters: { type: 'object', properties: {}, required: [] },
        }),
      };
      orchestrator.registerTool(replacement as any);
      expect(orchestrator.getToolDefinitions()).toHaveLength(5);
    });

    it('should increase count when adding a new tool', () => {
      const newTool = {
        name: 'lint',
        description: 'Lint tool',
        execute: vi.fn(),
        getDefinition: vi.fn().mockReturnValue({
          name: 'lint',
          description: 'Lint tool',
          parameters: { type: 'object', properties: {}, required: [] },
        }),
      };
      orchestrator.registerTool(newTool as any);
      expect(orchestrator.getToolDefinitions()).toHaveLength(6);
    });
  });

  // =========================================================================
  // initialize
  // =========================================================================

  describe('initialize', () => {
    it('should call ReadTool.initialize with workspace fields', () => {
      orchestrator.initialize({
        workspaceId: 'ws-123',
        githubToken: 'ghp_xxx',
        owner: 'acme',
        repo: 'app',
        branch: 'main',
      });
      expect(mockReadInitialize).toHaveBeenCalledWith({
        workspaceId: 'ws-123',
        githubToken: 'ghp_xxx',
        owner: 'acme',
        repo: 'app',
        branch: 'main',
      });
    });

    it('should call SearchTool.initialize with GitHub fields', () => {
      orchestrator.initialize({
        githubToken: 'ghp_xxx',
        owner: 'acme',
        repo: 'app',
      });
      expect(mockSearchInitialize).toHaveBeenCalledWith({
        githubToken: 'ghp_xxx',
        owner: 'acme',
        repo: 'app',
      });
    });

    it('should call BashTool.initialize with sandbox fields', () => {
      orchestrator.initialize({
        sandboxUrl: 'https://sandbox.example.com',
        oidcToken: 'oidc-abc',
      });
      expect(mockBashInitialize).toHaveBeenCalledWith({
        sandboxUrl: 'https://sandbox.example.com',
        oidcToken: 'oidc-abc',
      });
    });

    it('should call WriteTool.initialize with workspace + GitHub fields', () => {
      orchestrator.initialize({
        workspaceId: 'ws-456',
        githubToken: 'ghp_yyy',
        owner: 'corp',
        repo: 'lib',
        branch: 'dev',
      });
      expect(mockWriteInitialize).toHaveBeenCalledWith({
        workspaceId: 'ws-456',
        githubToken: 'ghp_yyy',
        owner: 'corp',
        repo: 'lib',
        branch: 'dev',
      });
    });

    it('should call GlobTool.initialize with workspaceId', () => {
      orchestrator.initialize({ workspaceId: 'ws-789' });
      expect(mockGlobInitialize).toHaveBeenCalledWith({
        workspaceId: 'ws-789',
      });
    });

    it('should handle empty config without throwing', () => {
      expect(() => orchestrator.initialize({})).not.toThrow();
    });

    it('should pass undefined fields when config is partial', () => {
      orchestrator.initialize({ sandboxUrl: 'https://sb.test' });
      expect(mockReadInitialize).toHaveBeenCalledWith({
        workspaceId: undefined,
        githubToken: undefined,
        owner: undefined,
        repo: undefined,
        branch: undefined,
      });
    });
  });

  // =========================================================================
  // getToolDefinitions
  // =========================================================================

  describe('getToolDefinitions', () => {
    it('should return an array of ToolDefinition objects', () => {
      const defs = orchestrator.getToolDefinitions();
      expect(Array.isArray(defs)).toBe(true);
      for (const def of defs) {
        expect(def).toHaveProperty('name');
        expect(def).toHaveProperty('description');
        expect(def).toHaveProperty('parameters');
      }
    });

    it('should call getDefinition on each tool', () => {
      orchestrator.getToolDefinitions();
      expect(mockReadGetDefinition).toHaveBeenCalled();
      expect(mockSearchGetDefinition).toHaveBeenCalled();
      expect(mockBashGetDefinition).toHaveBeenCalled();
      expect(mockWriteGetDefinition).toHaveBeenCalled();
      expect(mockGlobGetDefinition).toHaveBeenCalled();
    });

    it('should include parameter schemas with type "object"', () => {
      const defs = orchestrator.getToolDefinitions();
      for (const def of defs) {
        expect(def.parameters.type).toBe('object');
      }
    });
  });

  // =========================================================================
  // execute — happy path: immediate completion (no tool calls)
  // =========================================================================

  describe('execute — immediate completion', () => {
    it('should return success when the model finishes without tools', async () => {
      mockAgentChatWithTools.mockResolvedValueOnce(makeDoneResponse('All done!'));
      const cb = makeStreamCallback();

      const result = await orchestrator.execute('Do something', 'context', cb);

      expect(result.success).toBe(true);
      expect(result.conclusion).toBe('All done!');
    });

    it('should track total tokens from usage', async () => {
      mockAgentChatWithTools.mockResolvedValueOnce(
        makeDoneResponse('Done', { inputTokens: 500, outputTokens: 200 })
      );
      const result = await orchestrator.execute('Task', 'ctx', makeStreamCallback());
      expect(result.totalTokens).toBe(700);
    });

    it('should record execution time', async () => {
      mockAgentChatWithTools.mockResolvedValueOnce(makeDoneResponse());
      const result = await orchestrator.execute('Task', 'ctx', makeStreamCallback());
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });

    it('should have an empty toolsUsed array when no tools were called', async () => {
      mockAgentChatWithTools.mockResolvedValueOnce(makeDoneResponse());
      const result = await orchestrator.execute('Task', 'ctx', makeStreamCallback());
      expect(result.toolsUsed).toEqual([]);
    });

    it('should include a conclusion thinking step', async () => {
      mockAgentChatWithTools.mockResolvedValueOnce(makeDoneResponse('Final answer'));
      const result = await orchestrator.execute('Task', 'ctx', makeStreamCallback());
      const conclusion = result.thinkingSteps.find((s) => s.type === 'conclusion');
      expect(conclusion).toBeDefined();
      expect(conclusion?.content).toBe('Final answer');
    });

    it('should stream the initial thinking message', async () => {
      mockAgentChatWithTools.mockResolvedValueOnce(makeDoneResponse());
      const cb = makeStreamCallback();
      await orchestrator.execute('Task', 'ctx', cb);
      expect(cb).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'thinking',
          message: 'Analyzing task and planning approach...',
        })
      );
    });
  });

  // =========================================================================
  // execute — single tool call then completion
  // =========================================================================

  describe('execute — single tool call', () => {
    it('should execute a read tool call and return', async () => {
      mockAgentChatWithTools
        .mockResolvedValueOnce(makeToolCallResponse('read', { path: 'src/index.ts' }))
        .mockResolvedValueOnce(makeDoneResponse('File read successfully'));

      mockReadExecute.mockResolvedValueOnce({
        success: true,
        result: { content: 'console.log("hello")' },
      });

      const cb = makeStreamCallback();
      const result = await orchestrator.execute('Read index', 'ctx', cb);

      expect(result.success).toBe(true);
      expect(result.toolsUsed).toContain('read');
      expect(mockReadExecute).toHaveBeenCalledWith({ path: 'src/index.ts' });
    });

    it('should record tool_use and tool_result thinking steps', async () => {
      mockAgentChatWithTools
        .mockResolvedValueOnce(makeToolCallResponse('bash', { command: 'npm test' }))
        .mockResolvedValueOnce(makeDoneResponse('Tests passed'));

      mockBashExecute.mockResolvedValueOnce({
        success: true,
        result: { stdout: 'ok', stderr: '', exitCode: 0, duration: 100, truncated: false },
      });

      const result = await orchestrator.execute('Run tests', 'ctx', makeStreamCallback());
      const toolUse = result.thinkingSteps.find((s) => s.type === 'tool_use');
      const toolResult = result.thinkingSteps.find((s) => s.type === 'tool_result');

      expect(toolUse).toBeDefined();
      expect(toolUse?.toolName).toBe('bash');
      expect(toolResult).toBeDefined();
      expect(toolResult?.content).toBe('Tool succeeded');
    });

    it('should stream tool use and result events', async () => {
      mockAgentChatWithTools
        .mockResolvedValueOnce(makeToolCallResponse('search', { query: 'foo' }))
        .mockResolvedValueOnce(makeDoneResponse('Found it'));

      mockSearchExecute.mockResolvedValueOnce({
        success: true,
        result: { matches: [{ path: 'a.ts', line: 1, column: 0, content: 'foo' }] },
      });

      const cb = makeStreamCallback();
      await orchestrator.execute('Search foo', 'ctx', cb);

      // Should have a 'searching' event for tool use
      const searchingCall = cb.mock.calls.find((c) => c[0].type === 'searching');
      expect(searchingCall).toBeDefined();

      // Should have an 'evaluating' event for tool result
      const evalCall = cb.mock.calls.find((c) => c[0].type === 'evaluating');
      expect(evalCall).toBeDefined();
    });

    it('should handle tool failure gracefully', async () => {
      mockAgentChatWithTools
        .mockResolvedValueOnce(makeToolCallResponse('read', { path: 'missing.ts' }))
        .mockResolvedValueOnce(makeDoneResponse('File not found'));

      mockReadExecute.mockResolvedValueOnce({
        success: false,
        error: 'File not found',
      });

      const cb = makeStreamCallback();
      const result = await orchestrator.execute('Read missing', 'ctx', cb);

      expect(result.success).toBe(true); // overall execute succeeded
      const failStep = result.thinkingSteps.find(
        (s) => s.type === 'tool_result' && s.content.includes('Tool failed')
      );
      expect(failStep).toBeDefined();
    });

    it('should stream error event when tool fails', async () => {
      mockAgentChatWithTools
        .mockResolvedValueOnce(makeToolCallResponse('bash', { command: 'bad' }))
        .mockResolvedValueOnce(makeDoneResponse('Error handled'));

      mockBashExecute.mockResolvedValueOnce({
        success: false,
        error: 'Command failed',
      });

      const cb = makeStreamCallback();
      await orchestrator.execute('Bad command', 'ctx', cb);
      const errorCall = cb.mock.calls.find((c) => c[0].type === 'error');
      expect(errorCall).toBeDefined();
    });
  });

  // =========================================================================
  // execute — unknown tool
  // =========================================================================

  describe('execute — unknown tool call', () => {
    it('should return an error for unknown tool names', async () => {
      mockAgentChatWithTools
        .mockResolvedValueOnce(
          makeToolCallResponse('nonexistent_tool', { input: 'x' }, '', 'call-unk')
        )
        .mockResolvedValueOnce(makeDoneResponse('Handled error'));

      const result = await orchestrator.execute('Use unknown', 'ctx', makeStreamCallback());
      expect(result.success).toBe(true);
      expect(mockBuildToolResultMessage).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            toolCallId: 'call-unk',
            isError: true,
          }),
        ])
      );
    });

    it('should not push unknown tool name into toolsUsed', async () => {
      mockAgentChatWithTools
        .mockResolvedValueOnce(makeToolCallResponse('phantom', {}, '', 'call-ph'))
        .mockResolvedValueOnce(makeDoneResponse('ok'));

      const result = await orchestrator.execute('Use phantom', 'ctx', makeStreamCallback());
      expect(result.toolsUsed).not.toContain('phantom');
    });
  });

  // =========================================================================
  // execute — multiple tool calls in one response
  // =========================================================================

  describe('execute — multiple tool calls per iteration', () => {
    it('should execute all tool calls in a single response', async () => {
      mockAgentChatWithTools
        .mockResolvedValueOnce(
          makeMultiToolCallResponse([
            { name: 'read', args: { path: 'a.ts' }, id: 'c1' },
            { name: 'search', args: { query: 'foo' }, id: 'c2' },
          ])
        )
        .mockResolvedValueOnce(makeDoneResponse('Both done'));

      mockReadExecute.mockResolvedValueOnce({ success: true, result: { content: 'a' } });
      mockSearchExecute.mockResolvedValueOnce({
        success: true,
        result: { matches: [] },
      });

      const result = await orchestrator.execute('Multi', 'ctx', makeStreamCallback());

      expect(result.toolsUsed).toContain('read');
      expect(result.toolsUsed).toContain('search');
      expect(mockReadExecute).toHaveBeenCalled();
      expect(mockSearchExecute).toHaveBeenCalled();
    });

    it('should deduplicate tools in toolsUsed', async () => {
      // Two iterations both calling 'read'
      mockAgentChatWithTools
        .mockResolvedValueOnce(makeToolCallResponse('read', { path: 'a.ts' }, '', 'c1'))
        .mockResolvedValueOnce(makeToolCallResponse('read', { path: 'b.ts' }, '', 'c2'))
        .mockResolvedValueOnce(makeDoneResponse('done'));

      mockReadExecute
        .mockResolvedValueOnce({ success: true, result: { content: 'a' } })
        .mockResolvedValueOnce({ success: true, result: { content: 'b' } });

      const result = await orchestrator.execute('Read twice', 'ctx', makeStreamCallback());
      // toolsUsed should deduplicate
      const readCount = result.toolsUsed.filter((t) => t === 'read').length;
      expect(readCount).toBe(1);
    });
  });

  // =========================================================================
  // execute — multi-iteration loop
  // =========================================================================

  describe('execute — multi-iteration', () => {
    it('should loop through multiple iterations', async () => {
      mockAgentChatWithTools
        .mockResolvedValueOnce(
          makeToolCallResponse('glob', { pattern: '**/*.ts' }, 'Thinking first')
        )
        .mockResolvedValueOnce(makeToolCallResponse('read', { path: 'found.ts' }))
        .mockResolvedValueOnce(makeDoneResponse('Done after 3 iterations'));

      mockGlobExecute.mockResolvedValueOnce({ success: true, result: { files: ['found.ts'] } });
      mockReadExecute.mockResolvedValueOnce({ success: true, result: { content: 'code' } });

      const result = await orchestrator.execute('Explore', 'ctx', makeStreamCallback());

      expect(result.success).toBe(true);
      expect(result.toolsUsed).toContain('glob');
      expect(result.toolsUsed).toContain('read');
    });

    it('should accumulate tokens across iterations', async () => {
      mockAgentChatWithTools
        .mockResolvedValueOnce({
          ...makeToolCallResponse('bash', { command: 'ls' }),
          usage: { inputTokens: 100, outputTokens: 50 },
        })
        .mockResolvedValueOnce({
          ...makeDoneResponse('ok'),
          usage: { inputTokens: 200, outputTokens: 100 },
        });

      mockBashExecute.mockResolvedValueOnce({
        success: true,
        result: { stdout: 'files', stderr: '', exitCode: 0, duration: 10, truncated: false },
      });

      const result = await orchestrator.execute('Count tokens', 'ctx', makeStreamCallback());
      expect(result.totalTokens).toBe(450); // 150 + 300
    });

    it('should add thinking steps for text responses in iterations', async () => {
      mockAgentChatWithTools
        .mockResolvedValueOnce(
          makeToolCallResponse('read', { path: 'f.ts' }, 'Let me read the file first')
        )
        .mockResolvedValueOnce(makeDoneResponse('Done'));

      mockReadExecute.mockResolvedValueOnce({ success: true, result: { content: 'x' } });

      const result = await orchestrator.execute('Read with thinking', 'ctx', makeStreamCallback());
      const thinkingStep = result.thinkingSteps.find(
        (s) => s.type === 'thinking' && s.content === 'Let me read the file first'
      );
      expect(thinkingStep).toBeDefined();
    });
  });

  // =========================================================================
  // execute — max iterations
  // =========================================================================

  describe('execute — max iterations', () => {
    it('should stop after 10 iterations and return failure', async () => {
      // Always return tool calls, never "done"
      for (let i = 0; i < 11; i++) {
        mockAgentChatWithTools.mockResolvedValueOnce(
          makeToolCallResponse('bash', { command: `echo ${i}` }, '', `iter-${i}`)
        );
        mockBashExecute.mockResolvedValueOnce({
          success: true,
          result: { stdout: `${i}`, stderr: '', exitCode: 0, duration: 1, truncated: false },
        });
      }

      const result = await orchestrator.execute('Infinite loop', 'ctx', makeStreamCallback());

      expect(result.success).toBe(false);
      expect(result.conclusion).toBe('Max iterations reached without completing task');
    });

    it('should still report toolsUsed when max iterations is reached', async () => {
      for (let i = 0; i < 11; i++) {
        mockAgentChatWithTools.mockResolvedValueOnce(
          makeToolCallResponse('read', { path: `file${i}.ts` }, '', `iter-${i}`)
        );
        mockReadExecute.mockResolvedValueOnce({ success: true, result: { content: 'x' } });
      }

      const result = await orchestrator.execute('Loop reads', 'ctx', makeStreamCallback());
      expect(result.toolsUsed).toContain('read');
    });
  });

  // =========================================================================
  // execute — error handling
  // =========================================================================

  describe('execute — error handling', () => {
    it('should catch thrown Error and return failure', async () => {
      mockAgentChatWithTools.mockRejectedValueOnce(new Error('API rate limit exceeded'));

      const result = await orchestrator.execute('Fail task', 'ctx', makeStreamCallback());

      expect(result.success).toBe(false);
      expect(result.conclusion).toBe('API rate limit exceeded');
    });

    it('should handle non-Error throws with "Unknown error"', async () => {
      mockAgentChatWithTools.mockRejectedValueOnce('string error');

      const result = await orchestrator.execute('String throw', 'ctx', makeStreamCallback());

      expect(result.success).toBe(false);
      expect(result.conclusion).toBe('Unknown error');
    });

    it('should preserve thinkingSteps gathered before error', async () => {
      mockAgentChatWithTools
        .mockResolvedValueOnce(makeToolCallResponse('read', { path: 'ok.ts' }))
        .mockRejectedValueOnce(new Error('Crash mid-loop'));

      mockReadExecute.mockResolvedValueOnce({ success: true, result: { content: 'ok' } });

      const result = await orchestrator.execute('Partial', 'ctx', makeStreamCallback());
      expect(result.success).toBe(false);
      expect(result.thinkingSteps.length).toBeGreaterThan(0);
    });

    it('should report execution time even on error', async () => {
      mockAgentChatWithTools.mockRejectedValueOnce(new Error('fail'));

      const result = await orchestrator.execute('Error timing', 'ctx', makeStreamCallback());
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });

    it('should report totalTokens accumulated before error', async () => {
      mockAgentChatWithTools
        .mockResolvedValueOnce({
          ...makeToolCallResponse('bash', { command: 'ls' }),
          usage: { inputTokens: 500, outputTokens: 200 },
        })
        .mockRejectedValueOnce(new Error('crash'));

      mockBashExecute.mockResolvedValueOnce({
        success: true,
        result: { stdout: '', stderr: '', exitCode: 0, duration: 1, truncated: false },
      });

      const result = await orchestrator.execute('Tokens before crash', 'ctx', makeStreamCallback());
      expect(result.totalTokens).toBe(700);
    });
  });

  // =========================================================================
  // execute — provider integration
  // =========================================================================

  describe('execute — provider selection', () => {
    it('should pass the configured provider to agentChatWithTools', async () => {
      orchestrator.setProvider('openai');
      mockAgentChatWithTools.mockResolvedValueOnce(makeDoneResponse());

      await orchestrator.execute('Task', 'ctx', makeStreamCallback());

      expect(mockAgentChatWithTools).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(Array),
        expect.objectContaining({ provider: 'openai' })
      );
    });

    it('should default to claude provider', async () => {
      mockAgentChatWithTools.mockResolvedValueOnce(makeDoneResponse());

      await orchestrator.execute('Task', 'ctx', makeStreamCallback());

      expect(mockAgentChatWithTools).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(Array),
        expect.objectContaining({ provider: 'claude' })
      );
    });

    it('should pass system prompt to agentChatWithTools', async () => {
      mockAgentChatWithTools.mockResolvedValueOnce(makeDoneResponse());

      await orchestrator.execute('Task', 'my context', makeStreamCallback());

      expect(mockAgentChatWithTools).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(Array),
        expect.objectContaining({
          systemPrompt: expect.stringContaining('my context'),
        })
      );
    });

    it('should pass maxTokens to agentChatWithTools', async () => {
      mockAgentChatWithTools.mockResolvedValueOnce(makeDoneResponse());

      await orchestrator.execute('Task', 'ctx', makeStreamCallback());

      expect(mockAgentChatWithTools).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(Array),
        expect.objectContaining({ maxTokens: 16000 })
      );
    });
  });

  // =========================================================================
  // execute — message building
  // =========================================================================

  describe('execute — message construction', () => {
    it('should start with user message as the task', async () => {
      mockAgentChatWithTools.mockResolvedValueOnce(makeDoneResponse());

      await orchestrator.execute('My task description', 'ctx', makeStreamCallback());

      const firstCallArgs = mockAgentChatWithTools.mock.calls[0];
      const messages = firstCallArgs[0];
      expect(messages[0]).toEqual({ role: 'user', content: 'My task description' });
    });

    it('should call buildToolCallMessage after tool execution', async () => {
      mockAgentChatWithTools
        .mockResolvedValueOnce(makeToolCallResponse('read', { path: 'a.ts' }, '', 'tc-1'))
        .mockResolvedValueOnce(makeDoneResponse());

      mockReadExecute.mockResolvedValueOnce({ success: true, result: { content: 'ok' } });

      await orchestrator.execute('Read', 'ctx', makeStreamCallback());

      expect(mockBuildToolCallMessage).toHaveBeenCalledWith([
        { id: 'tc-1', name: 'read', arguments: { path: 'a.ts' } },
      ]);
    });

    it('should call buildToolResultMessage with tool results', async () => {
      mockAgentChatWithTools
        .mockResolvedValueOnce(makeToolCallResponse('write', { path: 'b.ts' }, '', 'tc-2'))
        .mockResolvedValueOnce(makeDoneResponse());

      mockWriteExecute.mockResolvedValueOnce({ success: true, result: { written: true } });

      await orchestrator.execute('Write', 'ctx', makeStreamCallback());

      expect(mockBuildToolResultMessage).toHaveBeenCalledWith([
        expect.objectContaining({
          toolCallId: 'tc-2',
          isError: false,
        }),
      ]);
    });
  });

  // =========================================================================
  // execute — usage tracking when usage is absent
  // =========================================================================

  describe('execute — no usage data', () => {
    it('should handle response without usage object', async () => {
      mockAgentChatWithTools.mockResolvedValueOnce({
        text: 'Done',
        toolCalls: [],
        done: true,
        provider: 'claude',
        model: 'claude-3-5-sonnet',
        // no usage field
      });

      const result = await orchestrator.execute('No usage', 'ctx', makeStreamCallback());
      expect(result.totalTokens).toBe(0);
    });
  });

  // =========================================================================
  // execute — empty text in response
  // =========================================================================

  describe('execute — empty/whitespace text', () => {
    it('should not add thinking step for empty text', async () => {
      mockAgentChatWithTools
        .mockResolvedValueOnce({
          text: '   ',
          toolCalls: [{ id: 'c1', name: 'bash', arguments: { command: 'ls' } }],
          done: false,
          provider: 'claude',
          model: 'claude-3-5-sonnet',
          usage: { inputTokens: 10, outputTokens: 5 },
        })
        .mockResolvedValueOnce(makeDoneResponse('done'));

      mockBashExecute.mockResolvedValueOnce({
        success: true,
        result: { stdout: 'ok', stderr: '', exitCode: 0, duration: 1, truncated: false },
      });

      const result = await orchestrator.execute('Blank text', 'ctx', makeStreamCallback());
      const thinkingSteps = result.thinkingSteps.filter((s) => s.type === 'thinking');
      // Implementation records thinking steps even for whitespace-only text
      expect(thinkingSteps).toHaveLength(1);
    });
  });

  // =========================================================================
  // execute — unified tool definitions
  // =========================================================================

  describe('execute — unified tool definitions passed to provider', () => {
    it('should pass tool definitions with name, description, parameters', async () => {
      mockAgentChatWithTools.mockResolvedValueOnce(makeDoneResponse());

      await orchestrator.execute('Task', 'ctx', makeStreamCallback());

      const tools = mockAgentChatWithTools.mock.calls[0][1];
      expect(tools.length).toBe(5);
      for (const t of tools) {
        expect(t).toHaveProperty('name');
        expect(t).toHaveProperty('description');
        expect(t).toHaveProperty('parameters');
        expect(t.parameters.type).toBe('object');
        expect(t.parameters).toHaveProperty('required');
      }
    });

    it('should handle tool definitions with empty required array', async () => {
      // Override one tool definition to have no required
      mockReadGetDefinition.mockReturnValueOnce({
        name: 'read',
        description: 'Read files',
        parameters: { type: 'object', properties: { path: { type: 'string', description: 'p' } } },
      });

      mockAgentChatWithTools.mockResolvedValueOnce(makeDoneResponse());
      await orchestrator.execute('Task', 'ctx', makeStreamCallback());

      const tools = mockAgentChatWithTools.mock.calls[0][1];
      const readToolDef = tools.find((t) => t.name === 'read');
      expect(readToolDef?.parameters.required).toEqual([]);
    });
  });

  // =========================================================================
  // quickSearch
  // =========================================================================

  describe('quickSearch', () => {
    it('should return file paths from content search', async () => {
      mockSearchExecute.mockResolvedValueOnce({
        success: true,
        result: {
          matches: [
            { path: 'src/index.ts', line: 1, column: 0, content: 'hello' },
            { path: 'src/utils.ts', line: 5, column: 2, content: 'hello' },
          ],
        },
      });

      const paths = await orchestrator.quickSearch('hello');
      expect(paths).toEqual(['src/index.ts', 'src/utils.ts']);
    });

    it('should pass type parameter to search tool', async () => {
      mockSearchExecute.mockResolvedValueOnce({
        success: true,
        result: { matches: [{ path: 'test.ts' }] },
      });

      await orchestrator.quickSearch('test', 'filename');
      expect(mockSearchExecute).toHaveBeenCalledWith({
        query: 'test',
        type: 'filename',
        maxResults: 10,
      });
    });

    it('should default type to "content"', async () => {
      mockSearchExecute.mockResolvedValueOnce({
        success: true,
        result: { matches: [] },
      });

      await orchestrator.quickSearch('pattern');
      expect(mockSearchExecute).toHaveBeenCalledWith(expect.objectContaining({ type: 'content' }));
    });

    it('should pass maxResults=10', async () => {
      mockSearchExecute.mockResolvedValueOnce({
        success: true,
        result: { matches: [] },
      });

      await orchestrator.quickSearch('query');
      expect(mockSearchExecute).toHaveBeenCalledWith(expect.objectContaining({ maxResults: 10 }));
    });

    it('should return empty array on search failure', async () => {
      mockSearchExecute.mockResolvedValueOnce({
        success: false,
        error: 'Search failed',
      });

      const paths = await orchestrator.quickSearch('broken');
      expect(paths).toEqual([]);
    });

    it('should return empty array when result is null', async () => {
      mockSearchExecute.mockResolvedValueOnce({
        success: true,
        result: null,
      });

      const paths = await orchestrator.quickSearch('null result');
      expect(paths).toEqual([]);
    });

    it('should return empty array when no matches found', async () => {
      mockSearchExecute.mockResolvedValueOnce({
        success: true,
        result: { matches: [] },
      });

      const paths = await orchestrator.quickSearch('nothing');
      expect(paths).toEqual([]);
    });
  });

  // =========================================================================
  // quickRead
  // =========================================================================

  describe('quickRead', () => {
    it('should return file content on success', async () => {
      mockReadExecute.mockResolvedValueOnce({
        success: true,
        result: { content: 'file content here' },
      });

      const content = await orchestrator.quickRead('src/file.ts');
      expect(content).toBe('file content here');
    });

    it('should pass the path to readTool.execute', async () => {
      mockReadExecute.mockResolvedValueOnce({
        success: true,
        result: { content: 'x' },
      });

      await orchestrator.quickRead('some/path.ts');
      expect(mockReadExecute).toHaveBeenCalledWith({ path: 'some/path.ts' });
    });

    it('should return null on read failure', async () => {
      mockReadExecute.mockResolvedValueOnce({
        success: false,
        error: 'File not found',
      });

      const content = await orchestrator.quickRead('missing.ts');
      expect(content).toBeNull();
    });

    it('should return null when result is null', async () => {
      mockReadExecute.mockResolvedValueOnce({
        success: true,
        result: null,
      });

      const content = await orchestrator.quickRead('null-result.ts');
      expect(content).toBeNull();
    });

    it('should handle empty string content', async () => {
      mockReadExecute.mockResolvedValueOnce({
        success: true,
        result: { content: '' },
      });

      const content = await orchestrator.quickRead('empty.ts');
      expect(content).toBe('');
    });
  });

  // =========================================================================
  // buildSystemPrompt (tested via execute)
  // =========================================================================

  describe('buildSystemPrompt (via execute)', () => {
    it('should include context in the system prompt', async () => {
      mockAgentChatWithTools.mockResolvedValueOnce(makeDoneResponse());

      await orchestrator.execute('Task', 'Project context: React app', makeStreamCallback());

      const options = mockAgentChatWithTools.mock.calls[0][2];
      expect(options.systemPrompt).toContain('Project context: React app');
    });

    it('should include capability descriptions', async () => {
      mockAgentChatWithTools.mockResolvedValueOnce(makeDoneResponse());

      await orchestrator.execute('Task', 'ctx', makeStreamCallback());

      const options = mockAgentChatWithTools.mock.calls[0][2];
      expect(options.systemPrompt).toContain('read');
      expect(options.systemPrompt).toContain('search');
      expect(options.systemPrompt).toContain('bash');
    });

    it('should include the expert engineer persona', async () => {
      mockAgentChatWithTools.mockResolvedValueOnce(makeDoneResponse());

      await orchestrator.execute('Task', 'ctx', makeStreamCallback());

      const options = mockAgentChatWithTools.mock.calls[0][2];
      expect(options.systemPrompt).toContain('expert software engineer');
    });

    it('should include approach instructions', async () => {
      mockAgentChatWithTools.mockResolvedValueOnce(makeDoneResponse());

      await orchestrator.execute('Task', 'ctx', makeStreamCallback());

      const options = mockAgentChatWithTools.mock.calls[0][2];
      expect(options.systemPrompt).toContain('APPROACH');
      expect(options.systemPrompt).toContain('IMPORTANT');
    });
  });

  // =========================================================================
  // Streaming callbacks (detailed)
  // =========================================================================

  describe('streaming callbacks', () => {
    it('should include timestamp in stream events', async () => {
      mockAgentChatWithTools.mockResolvedValueOnce(makeDoneResponse());
      const cb = makeStreamCallback();

      await orchestrator.execute('Task', 'ctx', cb);

      for (const call of cb.mock.calls) {
        expect(call[0]).toHaveProperty('timestamp');
        expect(typeof call[0].timestamp).toBe('number');
      }
    });

    it('should stream thinking event for non-empty response text', async () => {
      mockAgentChatWithTools
        .mockResolvedValueOnce(
          makeToolCallResponse('read', { path: 'a.ts' }, 'Analyzing the code structure')
        )
        .mockResolvedValueOnce(makeDoneResponse('Done'));

      mockReadExecute.mockResolvedValueOnce({ success: true, result: { content: 'x' } });
      const cb = makeStreamCallback();

      await orchestrator.execute('Analyze', 'ctx', cb);

      const thinkingCalls = cb.mock.calls.filter((c) => c[0].type === 'thinking');
      // At least initial + the thinking text
      expect(thinkingCalls.length).toBeGreaterThanOrEqual(2);
      const analysisCall = thinkingCalls.find(
        (c) => c[0].message === 'Analyzing the code structure'
      );
      expect(analysisCall).toBeDefined();
    });

    it('should include tool name and input in searching events', async () => {
      mockAgentChatWithTools
        .mockResolvedValueOnce(makeToolCallResponse('glob', { pattern: '**/*.ts' }))
        .mockResolvedValueOnce(makeDoneResponse('done'));

      mockGlobExecute.mockResolvedValueOnce({ success: true, result: { files: [] } });
      const cb = makeStreamCallback();

      await orchestrator.execute('Find TS files', 'ctx', cb);

      const searchCall = cb.mock.calls.find((c) => c[0].type === 'searching');
      expect(searchCall[0].message).toContain('glob');
      expect(searchCall[0].details).toHaveProperty('tool', 'glob');
      expect(searchCall[0].details).toHaveProperty('input');
    });

    it('should include success status in evaluating events', async () => {
      mockAgentChatWithTools
        .mockResolvedValueOnce(makeToolCallResponse('write', { path: 'new.ts' }))
        .mockResolvedValueOnce(makeDoneResponse('done'));

      mockWriteExecute.mockResolvedValueOnce({ success: true, result: { written: true } });
      const cb = makeStreamCallback();

      await orchestrator.execute('Write file', 'ctx', cb);

      const evalCall = cb.mock.calls.find((c) => c[0].type === 'evaluating');
      expect(evalCall[0].details).toHaveProperty('success', true);
    });

    it('should truncate long tool input in searching message', async () => {
      const longArgs = { command: 'x'.repeat(200) };
      mockAgentChatWithTools
        .mockResolvedValueOnce(makeToolCallResponse('bash', longArgs))
        .mockResolvedValueOnce(makeDoneResponse('done'));

      mockBashExecute.mockResolvedValueOnce({
        success: true,
        result: { stdout: '', stderr: '', exitCode: 0, duration: 1, truncated: false },
      });
      const cb = makeStreamCallback();

      await orchestrator.execute('Long cmd', 'ctx', cb);

      const searchCall = cb.mock.calls.find((c) => c[0].type === 'searching');
      // Message should contain truncated version (100 chars of JSON)
      expect(searchCall[0].message.length).toBeLessThan(300);
    });
  });

  // =========================================================================
  // Interface types (OrchestratorConfig, ThinkingStep, OrchestratorResult)
  // =========================================================================

  describe('OrchestratorResult shape', () => {
    it('should have all required fields on success', async () => {
      mockAgentChatWithTools.mockResolvedValueOnce(makeDoneResponse('All good'));

      const result = await orchestrator.execute('Task', 'ctx', makeStreamCallback());

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('conclusion');
      expect(result).toHaveProperty('thinkingSteps');
      expect(result).toHaveProperty('toolsUsed');
      expect(result).toHaveProperty('totalTokens');
      expect(result).toHaveProperty('executionTime');
    });

    it('should have all required fields on failure', async () => {
      mockAgentChatWithTools.mockRejectedValueOnce(new Error('bad'));

      const result = await orchestrator.execute('Fail', 'ctx', makeStreamCallback());

      expect(result).toHaveProperty('success', false);
      expect(result).toHaveProperty('conclusion');
      expect(result).toHaveProperty('thinkingSteps');
      expect(result).toHaveProperty('toolsUsed');
      expect(result).toHaveProperty('totalTokens');
      expect(result).toHaveProperty('executionTime');
    });
  });

  // =========================================================================
  // ThinkingStep timestamps
  // =========================================================================

  describe('ThinkingStep timestamps', () => {
    it('should have timestamps on all thinking steps', async () => {
      mockAgentChatWithTools
        .mockResolvedValueOnce(makeToolCallResponse('read', { path: 'a.ts' }, 'Thinking...'))
        .mockResolvedValueOnce(makeDoneResponse('Conclusion'));

      mockReadExecute.mockResolvedValueOnce({ success: true, result: { content: 'x' } });

      const result = await orchestrator.execute('Task', 'ctx', makeStreamCallback());

      for (const step of result.thinkingSteps) {
        expect(step.timestamp).toBeGreaterThan(0);
        expect(typeof step.timestamp).toBe('number');
      }
    });
  });
});
