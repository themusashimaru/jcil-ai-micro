import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeErrorFixer, errorFixerTool, isErrorFixerAvailable } from './error-fixer-tool';

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
  return { id: 'fix-1', name: 'fix_error', arguments: args };
}

beforeEach(() => {
  mockAgentChat.mockReset();
});

// -------------------------------------------------------------------
// Metadata
// -------------------------------------------------------------------
describe('errorFixerTool metadata', () => {
  it('should have correct name', () => {
    expect(errorFixerTool.name).toBe('fix_error');
  });

  it('should require error', () => {
    expect(errorFixerTool.parameters.required).toContain('error');
  });

  it('should have code, error, language, context properties', () => {
    const props = errorFixerTool.parameters.properties as Record<string, unknown>;
    expect(props).toHaveProperty('code');
    expect(props).toHaveProperty('error');
    expect(props).toHaveProperty('language');
    expect(props).toHaveProperty('context');
  });
});

// -------------------------------------------------------------------
// Validation
// -------------------------------------------------------------------
describe('executeErrorFixer - validation', () => {
  it('should error when error message is empty', async () => {
    const res = await executeErrorFixer(makeCall({ error: '' }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('required');
  });

  it('should error when error message is whitespace only', async () => {
    const res = await executeErrorFixer(makeCall({ error: '   ' }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('required');
  });

  it('should error when error is missing', async () => {
    const res = await executeErrorFixer(makeCall({}));
    expect(res.isError).toBe(true);
  });

  it('should return toolCallId', async () => {
    const res = await executeErrorFixer({
      id: 'fix-99',
      name: 'fix_error',
      arguments: { error: '' },
    });
    expect(res.toolCallId).toBe('fix-99');
  });
});

// -------------------------------------------------------------------
// Successful fix
// -------------------------------------------------------------------
describe('executeErrorFixer - success', () => {
  it('should analyze error and return JSON result', async () => {
    mockAgentChat.mockResolvedValueOnce({
      text: JSON.stringify({
        rootCause: { summary: 'Missing semicolon', category: 'syntax' },
        fix: { description: 'Add semicolon', fixedCode: 'const x = 1;' },
        prevention: ['Use ESLint'],
        confidence: 'high',
      }),
    });

    const res = await executeErrorFixer(
      makeCall({ error: 'SyntaxError: Unexpected token', code: 'const x = 1' })
    );
    expect(res.isError).toBeUndefined();
    expect(res.content).toContain('rootCause');
    expect(res.content).toContain('Missing semicolon');
  });

  it('should handle non-JSON response', async () => {
    mockAgentChat.mockResolvedValueOnce({
      text: 'The error is caused by a missing import.',
    });

    const res = await executeErrorFixer(makeCall({ error: 'ReferenceError: x is not defined' }));
    expect(res.isError).toBeUndefined();
    expect(res.content).toContain('rawAnalysis');
  });

  it('should include code section in prompt when code provided', async () => {
    mockAgentChat.mockResolvedValueOnce({ text: '{"fix":"ok"}' });

    await executeErrorFixer(
      makeCall({ error: 'TypeError', code: 'const x: number = "hello"', language: 'typescript' })
    );
    const callArgs = mockAgentChat.mock.calls[0][0][0].content as string;
    expect(callArgs).toContain('const x: number = "hello"');
    expect(callArgs).toContain('typescript');
  });

  it('should work without code (error only)', async () => {
    mockAgentChat.mockResolvedValueOnce({ text: '{"fix":"ok"}' });

    const res = await executeErrorFixer(makeCall({ error: 'Build failed: missing module' }));
    expect(res.isError).toBeUndefined();
  });

  it('should include context in prompt when provided', async () => {
    mockAgentChat.mockResolvedValueOnce({ text: '{"fix":"ok"}' });

    await executeErrorFixer(makeCall({ error: 'Error', context: 'This happens during deploy' }));
    const callArgs = mockAgentChat.mock.calls[0][0][0].content as string;
    expect(callArgs).toContain('This happens during deploy');
  });

  it('should truncate very long code', async () => {
    const longCode = 'let x = 1;\n'.repeat(5000);
    mockAgentChat.mockResolvedValueOnce({ text: '{"fix":"ok"}' });

    await executeErrorFixer(makeCall({ error: 'Error', code: longCode }));
    const callArgs = mockAgentChat.mock.calls[0][0][0].content as string;
    expect(callArgs).toContain('truncated');
  });
});

// -------------------------------------------------------------------
// Error handling
// -------------------------------------------------------------------
describe('executeErrorFixer - errors', () => {
  it('should handle agentChat error', async () => {
    mockAgentChat.mockRejectedValueOnce(new Error('Service unavailable'));

    const res = await executeErrorFixer(makeCall({ error: 'TypeError' }));
    expect(res.isError).toBe(true);
    expect(res.content).toContain('Service unavailable');
  });

  it('should handle string arguments', async () => {
    mockAgentChat.mockResolvedValueOnce({ text: '{"fix":"ok"}' });

    const res = await executeErrorFixer({
      id: 'fix-1',
      name: 'fix_error',
      arguments: JSON.stringify({ error: 'TypeError: x is not a function' }),
    });
    expect(res.isError).toBeUndefined();
  });
});

// -------------------------------------------------------------------
// Availability
// -------------------------------------------------------------------
describe('isErrorFixerAvailable', () => {
  it('should return true', () => {
    expect(isErrorFixerAvailable()).toBe(true);
  });
});
