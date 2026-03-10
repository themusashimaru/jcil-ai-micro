import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeRefactor, refactorTool, isRefactorAvailable } from './refactor-tool';

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock agentChat
const mockAgentChat = vi.fn();
vi.mock('@/lib/ai/providers', () => ({
  agentChat: (...args: unknown[]) => mockAgentChat(...args),
}));

function makeCall(args: Record<string, unknown>) {
  return { id: 'ref-1', name: 'refactor_code', arguments: args };
}

beforeEach(() => {
  mockAgentChat.mockReset();
});

// -------------------------------------------------------------------
// Metadata
// -------------------------------------------------------------------
describe('refactorTool metadata', () => {
  it('should have correct name', () => {
    expect(refactorTool.name).toBe('refactor_code');
  });

  it('should require code', () => {
    expect(refactorTool.parameters.required).toContain('code');
  });

  it('should have goals, constraints, language properties', () => {
    const props = refactorTool.parameters.properties as Record<string, unknown>;
    expect(props).toHaveProperty('goals');
    expect(props).toHaveProperty('constraints');
    expect(props).toHaveProperty('language');
  });
});

// -------------------------------------------------------------------
// Validation
// -------------------------------------------------------------------
describe('executeRefactor - validation', () => {
  it('should error when code is empty', async () => {
    const res = await executeRefactor(makeCall({ code: '' }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('required');
  });

  it('should error when code is whitespace only', async () => {
    const res = await executeRefactor(makeCall({ code: '   ' }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('required');
  });

  it('should error when code is missing', async () => {
    const res = await executeRefactor(makeCall({}));
    expect(res.isError).toBe(true);
  });

  it('should return toolCallId', async () => {
    const res = await executeRefactor({
      id: 'ref-99',
      name: 'refactor_code',
      arguments: { code: '' },
    });
    expect(res.toolCallId).toBe('ref-99');
  });
});

// -------------------------------------------------------------------
// Successful refactoring
// -------------------------------------------------------------------
describe('executeRefactor - success', () => {
  it('should refactor code and return JSON result', async () => {
    mockAgentChat.mockResolvedValueOnce({
      text: JSON.stringify({
        refactoredCode: 'const add = (a: number, b: number) => a + b;',
        changes: [{ type: 'simplify', description: 'Arrow function' }],
        metrics: { linesOfCodeBefore: 5, linesOfCodeAfter: 1 },
      }),
    });

    const res = await executeRefactor(makeCall({ code: 'function add(a, b) { return a + b; }' }));
    expect(res.isError).toBeUndefined();
    expect(res.content).toContain('refactoredCode');
    expect(res.content).toContain('Arrow function');
  });

  it('should handle non-JSON response', async () => {
    mockAgentChat.mockResolvedValueOnce({
      text: 'Here is the refactored code: const x = 1;',
    });

    const res = await executeRefactor(makeCall({ code: 'var x = 1;' }));
    expect(res.isError).toBeUndefined();
    expect(res.content).toContain('refactoredCode');
  });

  it('should truncate very long code', async () => {
    const longCode = 'x = 1;\n'.repeat(10000);
    mockAgentChat.mockResolvedValueOnce({
      text: '{"refactoredCode": "short"}',
    });

    const res = await executeRefactor(makeCall({ code: longCode }));
    expect(res.isError).toBeUndefined();
    // agentChat should have been called with truncated code
    const callArgs = mockAgentChat.mock.calls[0][0][0].content as string;
    expect(callArgs).toContain('truncated');
  });

  it('should pass goals to prompt', async () => {
    mockAgentChat.mockResolvedValueOnce({ text: '{"refactoredCode":"ok"}' });

    await executeRefactor(makeCall({ code: 'let x = 1', goals: ['add types', 'use const'] }));
    const callArgs = mockAgentChat.mock.calls[0][0][0].content as string;
    expect(callArgs).toContain('add types');
    expect(callArgs).toContain('use const');
  });

  it('should pass constraints to prompt', async () => {
    mockAgentChat.mockResolvedValueOnce({ text: '{"refactoredCode":"ok"}' });

    await executeRefactor(makeCall({ code: 'let x = 1', constraints: 'maintain API compat' }));
    const callArgs = mockAgentChat.mock.calls[0][0][0].content as string;
    expect(callArgs).toContain('maintain API compat');
  });

  it('should use specified language in prompt', async () => {
    mockAgentChat.mockResolvedValueOnce({ text: '{"refactoredCode":"ok"}' });

    await executeRefactor(makeCall({ code: 'x = 1', language: 'python' }));
    const callArgs = mockAgentChat.mock.calls[0][0][0].content as string;
    expect(callArgs).toContain('python');
  });
});

// -------------------------------------------------------------------
// Error handling
// -------------------------------------------------------------------
describe('executeRefactor - errors', () => {
  it('should handle agentChat error', async () => {
    mockAgentChat.mockRejectedValueOnce(new Error('API unavailable'));

    const res = await executeRefactor(makeCall({ code: 'let x = 1' }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('API unavailable');
  });

  it('should handle string arguments', async () => {
    mockAgentChat.mockResolvedValueOnce({ text: '{"refactoredCode":"ok"}' });

    const res = await executeRefactor({
      id: 'ref-1',
      name: 'refactor_code',
      arguments: JSON.stringify({ code: 'let x = 1' }),
    });
    expect(res.isError).toBeUndefined();
  });
});

// -------------------------------------------------------------------
// Availability
// -------------------------------------------------------------------
describe('isRefactorAvailable', () => {
  it('should return true', () => {
    expect(isRefactorAvailable()).toBe(true);
  });
});
