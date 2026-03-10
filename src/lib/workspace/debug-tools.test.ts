/**
 * DEBUG TOOLS TESTS
 *
 * Comprehensive tests for workspace debug tools:
 * - getDebugTools / getCognitiveDebugTools / getAllDebugTools
 * - executeDebugTool (all branches)
 * - executeCognitiveDebugTool (all branches)
 * - executeAnyDebugTool (routing)
 * - isDebugTool
 * - getActiveDebugSession
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mock variables — vi.hoisted runs before vi.mock factories
// ---------------------------------------------------------------------------

const {
  mockSupportedLanguages,
  mockLanguageNames,
  mockDebugManager,
  mockCognitiveDebugger,
  mockParseIntent,
} = vi.hoisted(() => {
  const mockSupportedLanguages = ['node', 'python', 'go', 'rust', 'java'];
  const mockLanguageNames: Record<string, string> = {
    node: 'Node.js (JavaScript/TypeScript)',
    python: 'Python',
    go: 'Go',
    rust: 'Rust',
    java: 'Java',
  };

  const mockDebugManager = {
    startSession: vi.fn(),
    stopSession: vi.fn(),
    getSession: vi.fn(),
    setBreakpoints: vi.fn(),
    continue: vi.fn(),
    stepOver: vi.fn(),
    stepInto: vi.fn(),
    stepOut: vi.fn(),
    pause: vi.fn(),
    getStackTrace: vi.fn(),
    getScopes: vi.fn(),
    getVariables: vi.fn(),
    getThreads: vi.fn(),
    evaluate: vi.fn(),
  };

  const mockCognitiveDebugger = {
    startSession: vi.fn(),
    analyzeCode: vi.fn(),
    quickPredict: vi.fn(),
    explainCode: vi.fn(),
    analyzeWithIntent: vi.fn(),
    visualizeCodeFlow: vi.fn(),
  };

  const mockParseIntent = vi.fn();

  return {
    mockSupportedLanguages,
    mockLanguageNames,
    mockDebugManager,
    mockCognitiveDebugger,
    mockParseIntent,
  };
});

// ---------------------------------------------------------------------------
// vi.mock declarations — these are hoisted but now reference vi.hoisted vars
// ---------------------------------------------------------------------------

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({})),
  __esModule: true,
}));

vi.mock('@/lib/debugger/debug-adapter', () => ({
  getSupportedLanguages: () => mockSupportedLanguages,
  getLanguageDisplayNames: () => mockLanguageNames,
}));

vi.mock('@/lib/debugger/debug-manager', () => ({
  getDebugManager: () => mockDebugManager,
}));

vi.mock('@/lib/cognitive-debugger', () => ({
  getCognitiveDebugger: () => mockCognitiveDebugger,
}));

vi.mock('@/lib/cognitive-debugger/intent-failure-mapper', () => ({
  IntentFailureMapper: vi.fn().mockImplementation(() => ({
    parseIntent: mockParseIntent,
  })),
}));

// ---------------------------------------------------------------------------
// Import the module under test AFTER mocks are registered
// ---------------------------------------------------------------------------

import {
  getDebugTools,
  getCognitiveDebugTools,
  getAllDebugTools,
  executeDebugTool,
  executeCognitiveDebugTool,
  executeAnyDebugTool,
  isDebugTool,
  getActiveDebugSession,
} from './debug-tools';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WORKSPACE_ID = 'ws-test-123';
const USER_ID = 'user-test-456';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('debug-tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // getDebugTools
  // =========================================================================

  describe('getDebugTools', () => {
    it('returns an array of Anthropic tool definitions', () => {
      const tools = getDebugTools();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
    });

    it('includes debug_start tool with correct schema', () => {
      const tools = getDebugTools();
      const startTool = tools.find((t) => t.name === 'debug_start');
      expect(startTool).toBeDefined();
      expect(startTool!.input_schema.type).toBe('object');
      expect(startTool!.input_schema.required).toContain('type');
      expect(startTool!.input_schema.required).toContain('program');
    });

    it('includes all seven debug tool names', () => {
      const tools = getDebugTools();
      const names = tools.map((t) => t.name);
      expect(names).toContain('debug_start');
      expect(names).toContain('debug_languages');
      expect(names).toContain('debug_stop');
      expect(names).toContain('debug_breakpoint');
      expect(names).toContain('debug_step');
      expect(names).toContain('debug_inspect');
      expect(names).toContain('debug_evaluate');
    });

    it('uses supported languages as enum in debug_start type property', () => {
      const tools = getDebugTools();
      const startTool = tools.find((t) => t.name === 'debug_start');
      const typeProperty = (
        startTool!.input_schema as { properties: Record<string, { enum?: string[] }> }
      ).properties.type;
      expect(typeProperty.enum).toEqual(mockSupportedLanguages);
    });
  });

  // =========================================================================
  // getCognitiveDebugTools
  // =========================================================================

  describe('getCognitiveDebugTools', () => {
    it('returns an array of cognitive tool definitions', () => {
      const tools = getCognitiveDebugTools();
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBe(5);
    });

    it('includes all cognitive tool names', () => {
      const tools = getCognitiveDebugTools();
      const names = tools.map((t) => t.name);
      expect(names).toContain('cognitive_analyze');
      expect(names).toContain('cognitive_predict');
      expect(names).toContain('cognitive_explain');
      expect(names).toContain('cognitive_intent_analysis');
      expect(names).toContain('cognitive_visualize');
    });

    it('cognitive_analyze requires code and language', () => {
      const tools = getCognitiveDebugTools();
      const tool = tools.find((t) => t.name === 'cognitive_analyze');
      expect(tool!.input_schema.required).toContain('code');
      expect(tool!.input_schema.required).toContain('language');
    });
  });

  // =========================================================================
  // getAllDebugTools
  // =========================================================================

  describe('getAllDebugTools', () => {
    it('returns combined standard and cognitive tools', () => {
      const all = getAllDebugTools();
      const standard = getDebugTools();
      const cognitive = getCognitiveDebugTools();
      expect(all.length).toBe(standard.length + cognitive.length);
    });
  });

  // =========================================================================
  // isDebugTool
  // =========================================================================

  describe('isDebugTool', () => {
    it('returns true for debug_ prefixed names', () => {
      expect(isDebugTool('debug_start')).toBe(true);
      expect(isDebugTool('debug_stop')).toBe(true);
      expect(isDebugTool('debug_breakpoint')).toBe(true);
    });

    it('returns true for cognitive_ prefixed names', () => {
      expect(isDebugTool('cognitive_analyze')).toBe(true);
      expect(isDebugTool('cognitive_predict')).toBe(true);
    });

    it('returns false for non-debug tool names', () => {
      expect(isDebugTool('web_search')).toBe(false);
      expect(isDebugTool('run_code')).toBe(false);
      expect(isDebugTool('other_tool')).toBe(false);
    });
  });

  // =========================================================================
  // getActiveDebugSession
  // =========================================================================

  describe('getActiveDebugSession', () => {
    it('returns undefined when no session is active for workspace', () => {
      expect(getActiveDebugSession('non-existent-ws')).toBeUndefined();
    });

    it('returns the session id after a debug_start', async () => {
      mockDebugManager.startSession.mockResolvedValueOnce({
        id: 'session-abc',
        type: 'node',
        state: 'running',
        configuration: { program: 'index.js' },
        startedAt: new Date(),
        userId: USER_ID,
        workspaceId: 'ws-active-test',
      });

      await executeDebugTool(
        'debug_start',
        { type: 'node', program: 'index.js' },
        'ws-active-test',
        USER_ID
      );

      expect(getActiveDebugSession('ws-active-test')).toBe('session-abc');
    });
  });

  // =========================================================================
  // executeDebugTool — debug_start
  // =========================================================================

  describe('executeDebugTool — debug_start', () => {
    it('starts a new session and returns session info', async () => {
      mockDebugManager.startSession.mockResolvedValueOnce({
        id: 'sess-1',
        type: 'python',
        state: 'running',
        configuration: { program: 'main.py' },
        startedAt: new Date(),
        userId: USER_ID,
        workspaceId: WORKSPACE_ID,
      });

      const result = await executeDebugTool(
        'debug_start',
        { type: 'python', program: 'main.py' },
        WORKSPACE_ID,
        USER_ID
      );

      expect(result).toContain('Debug session started');
      expect(result).toContain('sess-1');
      expect(result).toContain('Python');
      expect(mockDebugManager.startSession).toHaveBeenCalledWith(
        USER_ID,
        WORKSPACE_ID,
        expect.objectContaining({ type: 'python', program: 'main.py' })
      );
    });

    it('stops existing session before starting a new one', async () => {
      // First, create an existing session
      mockDebugManager.startSession.mockResolvedValueOnce({
        id: 'old-sess',
        type: 'node',
        state: 'running',
        configuration: { program: 'a.js' },
        startedAt: new Date(),
        userId: USER_ID,
        workspaceId: 'ws-replace',
      });
      await executeDebugTool(
        'debug_start',
        { type: 'node', program: 'a.js' },
        'ws-replace',
        USER_ID
      );

      // Now start another session for same workspace
      mockDebugManager.stopSession.mockResolvedValueOnce(undefined);
      mockDebugManager.startSession.mockResolvedValueOnce({
        id: 'new-sess',
        type: 'go',
        state: 'running',
        configuration: { program: 'main.go' },
        startedAt: new Date(),
        userId: USER_ID,
        workspaceId: 'ws-replace',
      });

      await executeDebugTool(
        'debug_start',
        { type: 'go', program: 'main.go' },
        'ws-replace',
        USER_ID
      );

      expect(mockDebugManager.stopSession).toHaveBeenCalledWith('old-sess');
      expect(getActiveDebugSession('ws-replace')).toBe('new-sess');
    });

    it('returns error message for unsupported language', async () => {
      const result = await executeDebugTool(
        'debug_start',
        { type: 'brainfuck', program: 'hello.bf' },
        WORKSPACE_ID,
        USER_ID
      );

      expect(result).toContain('Unsupported debug language');
      expect(result).toContain('brainfuck');
    });

    it('handles startSession failure gracefully', async () => {
      mockDebugManager.startSession.mockRejectedValueOnce(new Error('adapter crashed'));

      const result = await executeDebugTool(
        'debug_start',
        { type: 'node', program: 'x.js' },
        'ws-err',
        USER_ID
      );

      expect(result).toContain('Debug error');
      expect(result).toContain('adapter crashed');
    });

    it('ignores errors when stopping old session', async () => {
      // Seed an existing session for this workspace
      mockDebugManager.startSession.mockResolvedValueOnce({
        id: 'existing-err-sess',
        type: 'node',
        state: 'running',
        configuration: { program: 'a.js' },
        startedAt: new Date(),
        userId: USER_ID,
        workspaceId: 'ws-stop-err',
      });
      await executeDebugTool(
        'debug_start',
        { type: 'node', program: 'a.js' },
        'ws-stop-err',
        USER_ID
      );

      // Stopping the old one fails, but we proceed anyway
      mockDebugManager.stopSession.mockRejectedValueOnce(new Error('already stopped'));
      mockDebugManager.startSession.mockResolvedValueOnce({
        id: 'new-after-err',
        type: 'python',
        state: 'running',
        configuration: { program: 'b.py' },
        startedAt: new Date(),
        userId: USER_ID,
        workspaceId: 'ws-stop-err',
      });

      const result = await executeDebugTool(
        'debug_start',
        { type: 'python', program: 'b.py' },
        'ws-stop-err',
        USER_ID
      );

      expect(result).toContain('Debug session started');
      expect(result).toContain('new-after-err');
    });
  });

  // =========================================================================
  // executeDebugTool — debug_languages
  // =========================================================================

  describe('executeDebugTool — debug_languages', () => {
    it('returns formatted language list', async () => {
      const result = await executeDebugTool('debug_languages', {}, WORKSPACE_ID, USER_ID);

      expect(result).toContain('Code Lab Debugger');
      expect(result).toContain('debug_start');
    });
  });

  // =========================================================================
  // executeDebugTool — debug_stop
  // =========================================================================

  describe('executeDebugTool — debug_stop', () => {
    it('returns message when no active session', async () => {
      const result = await executeDebugTool('debug_stop', {}, 'ws-no-session', USER_ID);
      expect(result).toBe('No active debug session.');
    });

    it('stops an active session and clears tracking', async () => {
      // Set up an active session first
      mockDebugManager.startSession.mockResolvedValueOnce({
        id: 'stop-me',
        type: 'node',
        state: 'running',
        configuration: { program: 'x.js' },
        startedAt: new Date(),
        userId: USER_ID,
        workspaceId: 'ws-stop',
      });
      await executeDebugTool('debug_start', { type: 'node', program: 'x.js' }, 'ws-stop', USER_ID);

      mockDebugManager.stopSession.mockResolvedValueOnce(undefined);

      const result = await executeDebugTool('debug_stop', {}, 'ws-stop', USER_ID);
      expect(result).toBe('Debug session stopped.');
      expect(getActiveDebugSession('ws-stop')).toBeUndefined();
    });
  });

  // =========================================================================
  // executeDebugTool — debug_breakpoint
  // =========================================================================

  describe('executeDebugTool — debug_breakpoint', () => {
    const WS = 'ws-bp-test';

    beforeEach(async () => {
      mockDebugManager.startSession.mockResolvedValueOnce({
        id: 'bp-sess',
        type: 'node',
        state: 'paused',
        configuration: { program: 'app.js' },
        startedAt: new Date(),
        userId: USER_ID,
        workspaceId: WS,
      });
      await executeDebugTool('debug_start', { type: 'node', program: 'app.js' }, WS, USER_ID);
    });

    it('returns message when no active session', async () => {
      const result = await executeDebugTool(
        'debug_breakpoint',
        { action: 'set' },
        'ws-none',
        USER_ID
      );
      expect(result).toContain('No active debug session');
    });

    it('returns not-implemented message for list action', async () => {
      mockDebugManager.getSession.mockReturnValueOnce({ id: 'bp-sess' });

      const result = await executeDebugTool('debug_breakpoint', { action: 'list' }, WS, USER_ID);
      expect(result).toContain('not yet implemented');
    });

    it('returns session not found for list if getSession returns null', async () => {
      mockDebugManager.getSession.mockReturnValueOnce(null);

      const result = await executeDebugTool('debug_breakpoint', { action: 'list' }, WS, USER_ID);
      expect(result).toBe('Session not found.');
    });

    it('requires file and lines for set/remove', async () => {
      const result = await executeDebugTool('debug_breakpoint', { action: 'set' }, WS, USER_ID);
      expect(result).toContain('File and lines are required');
    });

    it('sets breakpoints and returns formatted output', async () => {
      mockDebugManager.setBreakpoints.mockResolvedValueOnce([
        { id: 1, line: 10, verified: true },
        { id: 2, line: 20, verified: false },
      ]);

      const result = await executeDebugTool(
        'debug_breakpoint',
        { action: 'set', file: 'app.js', lines: [10, 20] },
        WS,
        USER_ID
      );

      expect(result).toContain('Breakpoints in app.js');
      expect(result).toContain('Line 10');
      expect(result).toContain('Line 20');
    });

    it('returns cleared message when no breakpoints returned', async () => {
      mockDebugManager.setBreakpoints.mockResolvedValueOnce([]);

      const result = await executeDebugTool(
        'debug_breakpoint',
        { action: 'remove', file: 'app.js', lines: [] },
        WS,
        USER_ID
      );

      expect(result).toContain('All breakpoints cleared');
    });

    it('passes condition to setBreakpoints', async () => {
      mockDebugManager.setBreakpoints.mockResolvedValueOnce([{ id: 1, line: 5, verified: true }]);

      await executeDebugTool(
        'debug_breakpoint',
        { action: 'set', file: 'app.js', lines: [5], condition: 'x > 10' },
        WS,
        USER_ID
      );

      expect(mockDebugManager.setBreakpoints).toHaveBeenCalledWith('bp-sess', { path: 'app.js' }, [
        { line: 5, condition: 'x > 10' },
      ]);
    });
  });

  // =========================================================================
  // executeDebugTool — debug_step
  // =========================================================================

  describe('executeDebugTool — debug_step', () => {
    const WS = 'ws-step-test';

    beforeEach(async () => {
      mockDebugManager.startSession.mockResolvedValueOnce({
        id: 'step-sess',
        type: 'node',
        state: 'paused',
        configuration: { program: 'app.js' },
        startedAt: new Date(),
        userId: USER_ID,
        workspaceId: WS,
      });
      await executeDebugTool('debug_start', { type: 'node', program: 'app.js' }, WS, USER_ID);
    });

    it('returns message when no active session', async () => {
      const result = await executeDebugTool(
        'debug_step',
        { action: 'continue' },
        'ws-none',
        USER_ID
      );
      expect(result).toContain('No active debug session');
    });

    it.each([
      ['continue', 'Continuing execution...', 'continue'],
      ['stepOver', 'Stepped over (F10)', 'stepOver'],
      ['stepInto', 'Stepped into (F11)', 'stepInto'],
      ['stepOut', 'Stepped out (Shift+F11)', 'stepOut'],
      ['pause', 'Pausing execution...', 'pause'],
    ])('handles %s action correctly', async (action, expectedMessage, methodName) => {
      (mockDebugManager as Record<string, ReturnType<typeof vi.fn>>)[
        methodName
      ].mockResolvedValueOnce(undefined);

      const result = await executeDebugTool('debug_step', { action }, WS, USER_ID);
      expect(result).toBe(expectedMessage);
    });

    it('returns unknown action message for invalid action', async () => {
      const result = await executeDebugTool('debug_step', { action: 'invalid' }, WS, USER_ID);
      expect(result).toContain('Unknown step action');
      expect(result).toContain('invalid');
    });
  });

  // =========================================================================
  // executeDebugTool — debug_inspect
  // =========================================================================

  describe('executeDebugTool — debug_inspect', () => {
    const WS = 'ws-inspect-test';

    beforeEach(async () => {
      mockDebugManager.startSession.mockResolvedValueOnce({
        id: 'inspect-sess',
        type: 'node',
        state: 'paused',
        configuration: { program: 'app.js' },
        startedAt: new Date(),
        userId: USER_ID,
        workspaceId: WS,
      });
      await executeDebugTool('debug_start', { type: 'node', program: 'app.js' }, WS, USER_ID);
    });

    it('returns message when no active session', async () => {
      const result = await executeDebugTool(
        'debug_inspect',
        { what: 'stackTrace' },
        'ws-none',
        USER_ID
      );
      expect(result).toContain('No active debug session');
    });

    it('returns formatted stack trace', async () => {
      mockDebugManager.getStackTrace.mockResolvedValueOnce([
        { id: 0, name: 'main', source: { path: 'app.js' }, line: 10, column: 1 },
        { id: 1, name: 'helper', source: { path: 'util.js' }, line: 5, column: 3 },
      ]);

      const result = await executeDebugTool('debug_inspect', { what: 'stackTrace' }, WS, USER_ID);
      expect(result).toContain('Call Stack');
      expect(result).toContain('main');
      expect(result).toContain('app.js:10:1');
    });

    it('returns empty stack trace message', async () => {
      mockDebugManager.getStackTrace.mockResolvedValueOnce([]);

      const result = await executeDebugTool('debug_inspect', { what: 'stackTrace' }, WS, USER_ID);
      expect(result).toContain('No stack frames available');
    });

    it('returns formatted variables', async () => {
      mockDebugManager.getScopes.mockResolvedValueOnce([
        { name: 'Local', variablesReference: 1, expensive: false },
      ]);
      mockDebugManager.getVariables.mockResolvedValueOnce([
        { name: 'x', value: '42', type: 'number' },
        { name: 'name', value: 'hello', type: 'string' },
      ]);

      const result = await executeDebugTool('debug_inspect', { what: 'variables' }, WS, USER_ID);
      expect(result).toContain('Variables');
      expect(result).toContain('x');
      expect(result).toContain('42');
      expect(result).toContain('(number)');
    });

    it('handles empty variable scopes', async () => {
      mockDebugManager.getScopes.mockResolvedValueOnce([
        { name: 'Closure', variablesReference: 2, expensive: false },
      ]);
      mockDebugManager.getVariables.mockResolvedValueOnce([]);

      const result = await executeDebugTool('debug_inspect', { what: 'variables' }, WS, USER_ID);
      expect(result).toContain('(empty)');
    });

    it('returns formatted scopes', async () => {
      mockDebugManager.getScopes.mockResolvedValueOnce([
        { name: 'Local', variablesReference: 1, expensive: false },
        { name: 'Global', variablesReference: 2, expensive: true },
      ]);

      const result = await executeDebugTool('debug_inspect', { what: 'scopes' }, WS, USER_ID);
      expect(result).toContain('Scopes');
      expect(result).toContain('Local');
      expect(result).toContain('expensive to evaluate');
    });

    it('returns formatted threads', async () => {
      mockDebugManager.getThreads.mockResolvedValueOnce([
        { id: 1, name: 'main' },
        { id: 2, name: 'worker-1' },
      ]);

      const result = await executeDebugTool('debug_inspect', { what: 'threads' }, WS, USER_ID);
      expect(result).toContain('Threads');
      expect(result).toContain('[1] main');
      expect(result).toContain('[2] worker-1');
    });

    it('returns unknown inspection target for invalid what', async () => {
      const result = await executeDebugTool('debug_inspect', { what: 'memory' }, WS, USER_ID);
      expect(result).toContain('Unknown inspection target');
      expect(result).toContain('memory');
    });
  });

  // =========================================================================
  // executeDebugTool — debug_evaluate
  // =========================================================================

  describe('executeDebugTool — debug_evaluate', () => {
    const WS = 'ws-eval-test';

    beforeEach(async () => {
      mockDebugManager.startSession.mockResolvedValueOnce({
        id: 'eval-sess',
        type: 'node',
        state: 'paused',
        configuration: { program: 'app.js' },
        startedAt: new Date(),
        userId: USER_ID,
        workspaceId: WS,
      });
      await executeDebugTool('debug_start', { type: 'node', program: 'app.js' }, WS, USER_ID);
    });

    it('returns message when no active session', async () => {
      const result = await executeDebugTool(
        'debug_evaluate',
        { expression: '1+1' },
        'ws-none',
        USER_ID
      );
      expect(result).toContain('No active debug session');
    });

    it('evaluates expression and returns formatted result', async () => {
      mockDebugManager.evaluate.mockResolvedValueOnce({
        result: '42',
        type: 'number',
      });

      const result = await executeDebugTool('debug_evaluate', { expression: 'x * 2' }, WS, USER_ID);

      expect(result).toBe('x * 2 (number) = 42');
      expect(mockDebugManager.evaluate).toHaveBeenCalledWith(
        'eval-sess',
        'x * 2',
        undefined,
        'watch'
      );
    });

    it('passes frameId and context when provided', async () => {
      mockDebugManager.evaluate.mockResolvedValueOnce({
        result: '"hello"',
        type: 'string',
      });

      await executeDebugTool(
        'debug_evaluate',
        { expression: 'msg', frameId: 3, context: 'repl' },
        WS,
        USER_ID
      );

      expect(mockDebugManager.evaluate).toHaveBeenCalledWith('eval-sess', 'msg', 3, 'repl');
    });

    it('formats result without type when type is undefined', async () => {
      mockDebugManager.evaluate.mockResolvedValueOnce({
        result: '[object Object]',
      });

      const result = await executeDebugTool('debug_evaluate', { expression: 'obj' }, WS, USER_ID);

      expect(result).toBe('obj = [object Object]');
    });
  });

  // =========================================================================
  // executeDebugTool — unknown tool
  // =========================================================================

  describe('executeDebugTool — unknown tool', () => {
    it('returns unknown tool message', async () => {
      const result = await executeDebugTool('debug_nonexistent', {}, WORKSPACE_ID, USER_ID);
      expect(result).toContain('Unknown debug tool');
      expect(result).toContain('debug_nonexistent');
    });
  });

  // =========================================================================
  // executeCognitiveDebugTool — cognitive_analyze
  // =========================================================================

  describe('executeCognitiveDebugTool — cognitive_analyze', () => {
    beforeEach(() => {
      mockCognitiveDebugger.startSession.mockReturnValue({ id: 'cog-sess-1' });
    });

    it('creates a session and returns formatted analysis', async () => {
      mockCognitiveDebugger.analyzeCode.mockResolvedValueOnce({
        predictions: [
          {
            type: 'logic_error',
            description: 'Off by one',
            location: { line: 5 },
            severity: 'high',
            confidence: 'high',
          },
        ],
        patterns: [],
        recommendations: [],
        fixes: [],
      });

      const result = await executeCognitiveDebugTool(
        'cognitive_analyze',
        { code: 'const x = arr[arr.length]', language: 'javascript' },
        WORKSPACE_ID,
        USER_ID
      );

      expect(result).toContain('Cognitive Analysis Report');
      expect(result).toContain('Off by one');
      expect(mockCognitiveDebugger.startSession).toHaveBeenCalledWith(WORKSPACE_ID, USER_ID);
    });

    it('reuses existing session on subsequent calls', async () => {
      mockCognitiveDebugger.analyzeCode.mockResolvedValue({
        predictions: [],
        patterns: [],
        recommendations: [],
        fixes: [],
      });

      await executeCognitiveDebugTool(
        'cognitive_analyze',
        { code: 'a', language: 'python' },
        'ws-reuse',
        USER_ID
      );
      await executeCognitiveDebugTool(
        'cognitive_analyze',
        { code: 'b', language: 'python' },
        'ws-reuse',
        USER_ID
      );

      // startSession called once for this workspace
      expect(mockCognitiveDebugger.startSession).toHaveBeenCalledTimes(1);
    });

    it('includes multi-dimensional scores when present', async () => {
      mockCognitiveDebugger.analyzeCode.mockResolvedValueOnce({
        predictions: [],
        patterns: [],
        multiDimensional: {
          overallScore: 80,
          security: { score: 90 },
          performance: { score: 70 },
          logic: { score: 85 },
        },
        recommendations: [
          { title: 'Use const', description: 'Prefer const over let', priority: 'low' },
        ],
        fixes: [{ location: { line: 3 }, newCode: 'const x = 1;', explanation: 'Use const' }],
      });

      const result = await executeCognitiveDebugTool(
        'cognitive_analyze',
        { code: 'let x = 1', language: 'typescript' },
        'ws-scores',
        USER_ID
      );

      expect(result).toContain('Overall Scores');
      expect(result).toContain('80/100');
      expect(result).toContain('Prioritized Recommendations');
      expect(result).toContain('Suggested Fixes');
    });

    it('includes known bug patterns when detected', async () => {
      mockCognitiveDebugger.analyzeCode.mockResolvedValueOnce({
        predictions: [],
        patterns: [
          {
            pattern: { name: 'Null Deref', description: 'Potential null dereference' },
            location: { line: 7 },
          },
        ],
        recommendations: [],
        fixes: [],
      });

      const result = await executeCognitiveDebugTool(
        'cognitive_analyze',
        { code: 'obj.prop', language: 'javascript' },
        'ws-patterns',
        USER_ID
      );

      expect(result).toContain('Known Bug Patterns Detected');
      expect(result).toContain('Null Deref');
    });
  });

  // =========================================================================
  // executeCognitiveDebugTool — cognitive_predict
  // =========================================================================

  describe('executeCognitiveDebugTool — cognitive_predict', () => {
    beforeEach(() => {
      mockCognitiveDebugger.startSession.mockReturnValue({ id: 'cog-pred' });
    });

    it('returns no-issues message for empty predictions', async () => {
      mockCognitiveDebugger.quickPredict.mockResolvedValueOnce([]);

      const result = await executeCognitiveDebugTool(
        'cognitive_predict',
        { code: 'console.log("hi")', language: 'javascript' },
        'ws-pred-1',
        USER_ID
      );

      expect(result).toContain('No issues predicted');
    });

    it('returns formatted predictions with probability', async () => {
      mockCognitiveDebugger.quickPredict.mockResolvedValueOnce([
        {
          type: 'runtime_error',
          description: 'TypeError possible',
          location: { line: 3 },
          severity: 'high',
          probability: 0.85,
          preventionStrategy: 'Add null check',
        },
      ]);

      const result = await executeCognitiveDebugTool(
        'cognitive_predict',
        { code: 'x.y', language: 'javascript' },
        'ws-pred-2',
        USER_ID
      );

      expect(result).toContain('Quick Predictions');
      expect(result).toContain('85% likely');
      expect(result).toContain('Add null check');
    });

    it('passes cursorLine when provided', async () => {
      mockCognitiveDebugger.quickPredict.mockResolvedValueOnce([]);

      await executeCognitiveDebugTool(
        'cognitive_predict',
        { code: 'x', language: 'python', cursorLine: 7 },
        'ws-pred-3',
        USER_ID
      );

      expect(mockCognitiveDebugger.quickPredict).toHaveBeenCalledWith('x', 'python', {
        line: 7,
        column: 0,
      });
    });
  });

  // =========================================================================
  // executeCognitiveDebugTool — cognitive_explain
  // =========================================================================

  describe('executeCognitiveDebugTool — cognitive_explain', () => {
    beforeEach(() => {
      mockCognitiveDebugger.startSession.mockReturnValue({ id: 'cog-explain' });
    });

    it('returns formatted explanation', async () => {
      mockCognitiveDebugger.explainCode.mockResolvedValueOnce({
        explanation: 'This code sorts an array using quicksort.',
        executionFlow: 'Partition then recurse.',
        dataTransformations: 'Array is partitioned in-place.',
        potentialIssues: ['Stack overflow on large arrays'],
        suggestions: ['Use iterative approach for large data'],
      });

      const result = await executeCognitiveDebugTool(
        'cognitive_explain',
        { code: 'function sort(arr) { ... }', language: 'javascript' },
        'ws-explain',
        USER_ID
      );

      expect(result).toContain('Code Explanation');
      expect(result).toContain('quicksort');
      expect(result).toContain('Execution Flow');
      expect(result).toContain('Data Transformations');
      expect(result).toContain('Potential Issues');
      expect(result).toContain('Suggestions');
    });

    it('handles explanation without optional fields', async () => {
      mockCognitiveDebugger.explainCode.mockResolvedValueOnce({
        explanation: 'Simple print statement.',
        executionFlow: '',
        dataTransformations: '',
        potentialIssues: [],
        suggestions: [],
      });

      const result = await executeCognitiveDebugTool(
        'cognitive_explain',
        { code: 'print("hi")', language: 'python' },
        'ws-explain-2',
        USER_ID
      );

      expect(result).toContain('Simple print statement');
      expect(result).not.toContain('Execution Flow');
      expect(result).not.toContain('Potential Issues');
    });
  });

  // =========================================================================
  // executeCognitiveDebugTool — cognitive_intent_analysis
  // =========================================================================

  describe('executeCognitiveDebugTool — cognitive_intent_analysis', () => {
    beforeEach(() => {
      mockCognitiveDebugger.startSession.mockReturnValue({ id: 'cog-intent' });
    });

    it('returns formatted intent analysis', async () => {
      mockParseIntent.mockResolvedValueOnce({ description: 'Process payments' });
      mockCognitiveDebugger.analyzeWithIntent.mockResolvedValueOnce({
        intent: { description: 'Process payments', goals: ['secure', 'fast'] },
        possibleFailures: [
          {
            description: 'Payment timeout',
            severity: 'high',
            likelihood: 0.3,
            mitigations: [{ strategy: 'Add retry logic' }],
          },
        ],
        criticalPaths: [],
        assumptionRisks: [
          {
            assumption: 'API is always available',
            validity: 'questionable',
            consequence: 'Payment fails silently',
          },
        ],
        edgeCases: [
          { description: 'Zero-amount payment', handled: false },
          { description: 'Duplicate charge', handled: true },
        ],
        successProbability: 0.75,
      });

      const result = await executeCognitiveDebugTool(
        'cognitive_intent_analysis',
        { code: 'charge(user, amount)', language: 'javascript', intent: 'Process payments' },
        'ws-intent',
        USER_ID
      );

      expect(result).toContain('Intent-to-Failure Analysis');
      expect(result).toContain('75%');
      expect(result).toContain('Payment timeout');
      expect(result).toContain('Risky Assumptions');
      expect(result).toContain('Edge Cases to Test');
    });
  });

  // =========================================================================
  // executeCognitiveDebugTool — cognitive_visualize
  // =========================================================================

  describe('executeCognitiveDebugTool — cognitive_visualize', () => {
    beforeEach(() => {
      mockCognitiveDebugger.startSession.mockReturnValue({ id: 'cog-viz' });
    });

    it('returns formatted visualization', async () => {
      mockCognitiveDebugger.visualizeCodeFlow.mockResolvedValueOnce({
        mermaid: 'graph TD; A-->B;',
        ascii: 'A -> B',
        hotspots: [{ line: 5, severity: 'high', reason: 'Complex branch' }],
      });

      const result = await executeCognitiveDebugTool(
        'cognitive_visualize',
        { code: 'if (x) { a(); } else { b(); }', language: 'javascript' },
        'ws-viz',
        USER_ID
      );

      expect(result).toContain('Code Flow Visualization');
      expect(result).toContain('A -> B');
      expect(result).toContain('Hotspots');
      expect(result).toContain('Complex branch');
      expect(result).toContain('mermaid');
      expect(result).toContain('graph TD');
    });

    it('returns visualization without hotspots', async () => {
      mockCognitiveDebugger.visualizeCodeFlow.mockResolvedValueOnce({
        mermaid: 'graph LR; Start-->End;',
        ascii: 'Start -> End',
        hotspots: [],
      });

      const result = await executeCognitiveDebugTool(
        'cognitive_visualize',
        { code: 'return 1;', language: 'python' },
        'ws-viz-2',
        USER_ID
      );

      expect(result).toContain('Start -> End');
      expect(result).not.toContain('Hotspots');
    });
  });

  // =========================================================================
  // executeCognitiveDebugTool — unknown tool
  // =========================================================================

  describe('executeCognitiveDebugTool — unknown tool', () => {
    beforeEach(() => {
      mockCognitiveDebugger.startSession.mockReturnValue({ id: 'cog-unk' });
    });

    it('returns unknown tool message', async () => {
      const result = await executeCognitiveDebugTool(
        'cognitive_nonexistent',
        { code: 'x', language: 'python' },
        WORKSPACE_ID,
        USER_ID
      );
      expect(result).toContain('Unknown cognitive debug tool');
    });
  });

  // =========================================================================
  // executeCognitiveDebugTool — error handling
  // =========================================================================

  describe('executeCognitiveDebugTool — error handling', () => {
    beforeEach(() => {
      mockCognitiveDebugger.startSession.mockReturnValue({ id: 'cog-err' });
    });

    it('catches errors and returns formatted error message', async () => {
      mockCognitiveDebugger.analyzeCode.mockRejectedValueOnce(new Error('API limit reached'));

      const result = await executeCognitiveDebugTool(
        'cognitive_analyze',
        { code: 'x', language: 'javascript' },
        'ws-cog-err',
        USER_ID
      );

      expect(result).toContain('Cognitive debug error');
      expect(result).toContain('API limit reached');
    });

    it('handles non-Error exceptions', async () => {
      mockCognitiveDebugger.analyzeCode.mockRejectedValueOnce('string error');

      const result = await executeCognitiveDebugTool(
        'cognitive_analyze',
        { code: 'x', language: 'javascript' },
        'ws-cog-err-2',
        USER_ID
      );

      expect(result).toContain('Cognitive debug error');
      expect(result).toContain('Unknown error');
    });
  });

  // =========================================================================
  // executeAnyDebugTool — routing
  // =========================================================================

  describe('executeAnyDebugTool', () => {
    it('routes cognitive_ tools to executeCognitiveDebugTool', async () => {
      mockCognitiveDebugger.startSession.mockReturnValue({ id: 'any-cog' });
      mockCognitiveDebugger.quickPredict.mockResolvedValueOnce([]);

      const result = await executeAnyDebugTool(
        'cognitive_predict',
        { code: 'x', language: 'python' },
        'ws-any-cog',
        USER_ID
      );

      expect(result).toContain('No issues predicted');
    });

    it('routes debug_ tools to executeDebugTool', async () => {
      const result = await executeAnyDebugTool('debug_languages', {}, WORKSPACE_ID, USER_ID);
      expect(result).toContain('Code Lab Debugger');
    });

    it('routes unknown debug_ tool and returns appropriate message', async () => {
      const result = await executeAnyDebugTool('debug_unknown', {}, WORKSPACE_ID, USER_ID);
      expect(result).toContain('Unknown debug tool');
    });
  });
});
