// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  executeDynamicTool,
  dynamicToolTool,
  getDynamicToolSessionInfo,
  DYNAMIC_TOOL_LIMITS,
} from './dynamic-tool';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock safety
vi.mock('./safety', () => ({
  getChatSessionCosts: vi.fn().mockReturnValue({ totalCost: 0, toolCalls: 0 }),
  CHAT_COST_LIMITS: {
    maxCostPerSession: Infinity,
    maxCostPerTool: Infinity,
    maxToolCallsPerSession: 1000,
    maxMiniAgents: 5,
  },
}));

// Mock E2B sandbox
const mockRunCode = vi.fn();
const mockKill = vi.fn();
const mockCreate = vi.fn().mockResolvedValue({
  runCode: mockRunCode,
  kill: mockKill,
});

vi.mock('@e2b/code-interpreter', () => ({
  Sandbox: {
    create: (...args: unknown[]) => mockCreate(...args),
  },
}));

function makeCall(args: Record<string, unknown>, sessionId = 'test-session') {
  return {
    id: 'dyn-1',
    name: 'create_and_run_tool',
    arguments: args,
    sessionId,
  };
}

beforeEach(() => {
  mockRunCode.mockReset();
  mockKill.mockReset().mockResolvedValue(undefined);
  mockCreate.mockClear();
  process.env.E2B_API_KEY = 'test-key';
});

// -------------------------------------------------------------------
// Metadata
// -------------------------------------------------------------------
describe('dynamicToolTool metadata', () => {
  it('should have correct name', () => {
    expect(dynamicToolTool.name).toBe('create_and_run_tool');
  });

  it('should require purpose and code', () => {
    expect(dynamicToolTool.parameters.required).toContain('purpose');
    expect(dynamicToolTool.parameters.required).toContain('code');
  });
});

describe('DYNAMIC_TOOL_LIMITS', () => {
  it('should have reasonable limits', () => {
    expect(DYNAMIC_TOOL_LIMITS.maxCostPerExecution).toBeGreaterThan(0);
    expect(DYNAMIC_TOOL_LIMITS.maxDynamicToolsPerSession).toBeGreaterThan(0);
    expect(DYNAMIC_TOOL_LIMITS.executionTimeoutMs).toBeGreaterThan(0);
    expect(DYNAMIC_TOOL_LIMITS.maxCodeLength).toBeGreaterThan(0);
    expect(DYNAMIC_TOOL_LIMITS.maxOutputLength).toBeGreaterThan(0);
  });
});

describe('getDynamicToolSessionInfo', () => {
  it('should return session info for new session', () => {
    const info = getDynamicToolSessionInfo('fresh-session-123');
    expect(info.toolsCreated).toBe(0);
    expect(info.remaining).toBe(DYNAMIC_TOOL_LIMITS.maxDynamicToolsPerSession);
    expect(info.totalCost).toBe(0);
  });
});

// -------------------------------------------------------------------
// Code validation (tested via executor)
// -------------------------------------------------------------------
describe('executeDynamicTool - code validation', () => {
  it('should block code with os.system', async () => {
    const res = await executeDynamicTool(makeCall({ purpose: 'test', code: 'os.system("ls")' }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('blocked pattern');
  });

  it('should block code with subprocess', async () => {
    const res = await executeDynamicTool(
      makeCall({ purpose: 'test', code: 'subprocess.run(["ls"])' })
    );
    expect(res.isError).toBe(true);
    expect(res.content).toContain('blocked pattern');
  });

  it('should block code with exec()', async () => {
    const res = await executeDynamicTool(makeCall({ purpose: 'test', code: 'exec("print(1)")' }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('blocked pattern');
  });

  it('should block code with eval()', async () => {
    const res = await executeDynamicTool(makeCall({ purpose: 'test', code: 'eval("1+1")' }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('blocked pattern');
  });

  it('should block code with process.env', async () => {
    const res = await executeDynamicTool(
      makeCall({ purpose: 'test', code: 'x = process.env["SECRET"]' })
    );
    expect(res.isError).toBe(true);
    expect(res.content).toContain('blocked pattern');
  });

  it('should block code with api_key', async () => {
    const res = await executeDynamicTool(makeCall({ purpose: 'test', code: 'api_key = "sk-..."' }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('blocked pattern');
  });

  it('should block code with password', async () => {
    const res = await executeDynamicTool(
      makeCall({ purpose: 'test', code: 'password = "hunter2"' })
    );
    expect(res.isError).toBe(true);
    expect(res.content).toContain('blocked pattern');
  });

  it('should block code with rm -rf', async () => {
    const res = await executeDynamicTool(makeCall({ purpose: 'test', code: 'rm -rf /' }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('blocked pattern');
  });

  it('should block code with crypto mining', async () => {
    const res = await executeDynamicTool(
      makeCall({ purpose: 'test', code: 'start_monero_miner()' })
    );
    expect(res.isError).toBe(true);
    expect(res.content).toContain('blocked pattern');
  });

  it('should block overly long code', async () => {
    const longCode = 'x = 1\n'.repeat(DYNAMIC_TOOL_LIMITS.maxCodeLength);
    const res = await executeDynamicTool(makeCall({ purpose: 'test', code: longCode }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('Code too long');
  });
});

// -------------------------------------------------------------------
// Successful execution
// -------------------------------------------------------------------
describe('executeDynamicTool - success', () => {
  it('should execute safe code and return result', async () => {
    mockRunCode.mockResolvedValueOnce({
      logs: {
        stdout: ['__RESULT__\n{"sum": 42}'],
        stderr: [],
      },
    });

    const res = await executeDynamicTool(
      makeCall({
        purpose: 'Calculate sum',
        code: 'def main():\n    return {"sum": inputs["a"] + inputs["b"]}',
        inputs: { a: 20, b: 22 },
      })
    );
    expect(res.isError).toBe(false);
    expect(res.content).toContain('Calculate sum');
    expect(res.content).toContain('42');
  });

  it('should handle __ERROR__ in stdout', async () => {
    mockRunCode.mockResolvedValueOnce({
      logs: {
        stdout: ['__ERROR__\nCode must define a main() function'],
        stderr: [],
      },
    });

    const res = await executeDynamicTool(makeCall({ purpose: 'test', code: 'x = 1' }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('main()');
  });

  it('should handle stderr without result', async () => {
    mockRunCode.mockResolvedValueOnce({
      logs: {
        stdout: ['some output'],
        stderr: ['NameError: name "foo" is not defined'],
      },
    });

    const res = await executeDynamicTool(
      makeCall({ purpose: 'test', code: 'def main():\n    return foo' })
    );
    expect(res.isError).toBe(true);
    expect(res.content).toContain('Execution error');
  });

  it('should kill sandbox after execution', async () => {
    mockRunCode.mockResolvedValueOnce({
      logs: { stdout: ['__RESULT__\n"ok"'], stderr: [] },
    });

    await executeDynamicTool(makeCall({ purpose: 'test', code: 'def main():\n    return "ok"' }));
    expect(mockKill).toHaveBeenCalledOnce();
  });

  it('should return toolCallId', async () => {
    mockRunCode.mockResolvedValueOnce({
      logs: { stdout: ['__RESULT__\n"ok"'], stderr: [] },
    });

    const res = await executeDynamicTool(
      makeCall({ purpose: 'test', code: 'def main():\n    return "ok"' })
    );
    expect(res.toolCallId).toBe('dyn-1');
  });
});

// -------------------------------------------------------------------
// E2B errors
// -------------------------------------------------------------------
describe('executeDynamicTool - E2B errors', () => {
  it('should handle E2B not available', async () => {
    delete process.env.E2B_API_KEY;
    // Need to re-import to reset the lazy init state
    // Since E2B was already initialized in previous tests, we test the error path differently
    mockCreate.mockRejectedValueOnce(new Error('E2B connection failed'));

    const res = await executeDynamicTool(
      makeCall({ purpose: 'test', code: 'def main():\n    return 1' })
    );
    expect(res.isError).toBe(true);
  });
});
