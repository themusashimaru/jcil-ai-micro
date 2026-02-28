// @ts-nocheck - Test file with extensive mocking
/** @vitest-environment node */

/**
 * Comprehensive tests for dynamicTools.ts (943 lines)
 *
 * Covers every exported function and edge case:
 * - validateToolPurpose (purpose/intent validation)
 * - validateToolCode (code safety validation – general, Python, JavaScript)
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

  it('should reject purpose containing crack keyword', () => {
    const result = validateToolPurpose(makeSafeRequest({ purpose: 'crack a password hash' }));
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_intent');
  });

  it('should reject purpose containing exploit keyword', () => {
    const result = validateToolPurpose(makeSafeRequest({ purpose: 'exploit a vulnerability' }));
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_intent');
  });

  it('should reject purpose containing bypass keyword', () => {
    const result = validateToolPurpose(makeSafeRequest({ purpose: 'bypass security checks' }));
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_intent');
  });

  it('should reject purpose containing phish keyword', () => {
    const result = validateToolPurpose(makeSafeRequest({ purpose: 'create a phishing page' }));
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_intent');
  });

  it('should reject purpose containing scam keyword', () => {
    const result = validateToolPurpose(makeSafeRequest({ purpose: 'run a scam operation' }));
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_intent');
  });

  it('should reject purpose containing violence keywords', () => {
    const result = validateToolPurpose(makeSafeRequest({ purpose: 'build a weapon simulator' }));
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_intent');
  });

  it('should reject purpose containing bomb keyword', () => {
    const result = validateToolPurpose(makeSafeRequest({ purpose: 'find bomb instructions' }));
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_intent');
  });

  it('should reject purpose containing terror keyword', () => {
    const result = validateToolPurpose(makeSafeRequest({ purpose: 'spread terror propaganda' }));
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_intent');
  });

  it('should reject purpose containing drug keywords', () => {
    const result = validateToolPurpose(makeSafeRequest({ purpose: 'find cocaine suppliers' }));
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_intent');
  });

  it('should reject purpose containing fentanyl keyword', () => {
    const result = validateToolPurpose(makeSafeRequest({ purpose: 'synthesize fentanyl' }));
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_intent');
  });

  it('should reject purpose containing adult keywords', () => {
    const result = validateToolPurpose(makeSafeRequest({ purpose: 'search for porn content' }));
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_intent');
  });

  it('should reject purpose containing xxx keyword', () => {
    const result = validateToolPurpose(makeSafeRequest({ purpose: 'find xxx videos' }));
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_intent');
  });

  it('should reject purpose containing nsfw keyword', () => {
    const result = validateToolPurpose(makeSafeRequest({ purpose: 'generate nsfw images' }));
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_intent');
  });

  it('should reject purpose containing surveillance keywords', () => {
    const result = validateToolPurpose(makeSafeRequest({ purpose: 'stalk a person online' }));
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_intent');
  });

  it('should reject purpose containing spy keyword', () => {
    const result = validateToolPurpose(makeSafeRequest({ purpose: 'spy on a competitor' }));
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_intent');
  });

  it('should reject purpose containing doxx keyword', () => {
    const result = validateToolPurpose(makeSafeRequest({ purpose: 'doxx someone online' }));
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

  it('should reject purpose containing launder keyword', () => {
    const result = validateToolPurpose(makeSafeRequest({ purpose: 'launder money' }));
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_intent');
  });

  it('should reject purpose containing counterfeit keyword', () => {
    const result = validateToolPurpose(
      makeSafeRequest({ purpose: 'create counterfeit documents' })
    );
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_intent');
  });

  it('should reject purpose with trafficking keyword', () => {
    const result = validateToolPurpose(makeSafeRequest({ purpose: 'organize trafficking ring' }));
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_intent');
  });

  it('should reject purpose containing misinformation keywords', () => {
    const result = validateToolPurpose(
      makeSafeRequest({ purpose: 'create disinformation campaign' })
    );
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_intent');
  });

  it('should reject purpose containing propaganda keyword', () => {
    const result = validateToolPurpose(makeSafeRequest({ purpose: 'spread propaganda' }));
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_intent');
  });

  it('should reject purpose containing child exploitation keywords', () => {
    const result = validateToolPurpose(makeSafeRequest({ purpose: 'find csam material' }));
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

  it('should detect dangerous keywords case-insensitively', () => {
    const result = validateToolPurpose(makeSafeRequest({ purpose: 'HACK INTO A SERVER' }));
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

  it('should combine purpose and justification for checking', () => {
    const result = validateToolPurpose(
      makeSafeRequest({
        purpose: 'data analysis tool',
        justification: 'steal credentials from users',
      })
    );
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_intent');
  });
});

// =============================================================================
// validateToolCode
// =============================================================================

describe('validateToolCode', () => {
  // --- General safe code ---
  it('should approve safe Python code', () => {
    const result = validateToolCode('def main(x): return x * 2', 'python');
    expect(result.safe).toBe(true);
  });

  it('should approve safe JavaScript code', () => {
    const result = validateToolCode('function main(x) { return x * 2; }', 'javascript');
    expect(result.safe).toBe(true);
  });

  it('should handle code with no URLs gracefully', () => {
    const result = validateToolCode('x = 1 + 2', 'python');
    expect(result.safe).toBe(true);
    expect(mockIsUrlSafe).not.toHaveBeenCalled();
  });

  // --- General dangerous code patterns ---
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

  it('should reject code containing os.system', () => {
    const result = validateToolCode('os.system("rm -rf /")', 'python');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_code');
  });

  it('should reject code containing spawn()', () => {
    const result = validateToolCode('spawn("/bin/sh")', 'javascript');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_code');
  });

  it('should reject code containing fork()', () => {
    const result = validateToolCode('fork() to create child process', 'python');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_code');
  });

  it('should reject code containing execSync', () => {
    const result = validateToolCode('execSync("ls -la")', 'javascript');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_code');
  });

  it('should reject code containing spawnSync', () => {
    const result = validateToolCode('spawnSync("ls")', 'javascript');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_code');
  });

  it('should reject code containing process.env', () => {
    const result = validateToolCode('const key = process.env.SECRET_KEY', 'javascript');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_code');
  });

  it('should reject code containing os.environ', () => {
    const result = validateToolCode('key = os.environ["SECRET"]', 'python');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_code');
  });

  it('should reject code containing child_process', () => {
    const result = validateToolCode("require('child_process')", 'javascript');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_code');
  });

  it('should reject code containing api_key pattern', () => {
    const result = validateToolCode('api_key = "sk-12345"', 'python');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_code');
  });

  it('should reject code containing auth_token pattern', () => {
    const result = validateToolCode('auth_token = "bearer xyz"', 'python');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_code');
  });

  it('should reject code containing socket operations', () => {
    const result = validateToolCode('socket.connect(("1.2.3.4", 8080))', 'python');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_code');
  });

  it('should reject code containing DDOS references', () => {
    const result = validateToolCode('launch_DDOS_attack()', 'python');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_code');
  });

  it('should reject code containing brute_force pattern', () => {
    const result = validateToolCode('brute_force_login()', 'python');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_code');
  });

  it('should reject code containing keylog pattern', () => {
    const result = validateToolCode('start_keylogger()', 'python');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_code');
  });

  it('should reject code containing clipboard access', () => {
    const result = validateToolCode('get_clipboard_data()', 'python');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_code');
  });

  it('should reject code containing crypto mining references', () => {
    const result = validateToolCode('start_mining_monero()', 'python');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_code');
  });

  it('should reject code referencing xmr (Monero)', () => {
    const result = validateToolCode('send_xmr_to_wallet()', 'python');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_code');
  });

  it('should reject code containing reverse shell patterns', () => {
    const result = validateToolCode('connect_reverse_shell("attacker.com")', 'python');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_code');
  });

  it('should reject code containing netcat reference', () => {
    const result = validateToolCode('run netcat listener', 'python');
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

  it('should reject code containing DROP TABLE', () => {
    const result = validateToolCode('DROP TABLE users;', 'python');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_code');
  });

  it('should reject code containing DELETE FROM', () => {
    const result = validateToolCode('DELETE FROM accounts WHERE 1=1', 'python');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_code');
  });

  it('should reject code with <script> tags', () => {
    const result = validateToolCode('<script>alert("xss")</script>', 'javascript');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_code');
  });

  it('should reject code with document.cookie access', () => {
    const result = validateToolCode('steal = document.cookie', 'javascript');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_code');
  });

  it('should reject code with innerHTML assignment', () => {
    const result = validateToolCode('el.innerHTML = userInput', 'javascript');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_code');
  });

  it('should reject code accessing /etc/passwd', () => {
    const result = validateToolCode('open("/etc/passwd")', 'python');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_code');
  });

  it('should reject code accessing /etc/shadow', () => {
    const result = validateToolCode('open("/etc/shadow")', 'python');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_code');
  });

  it('should reject code accessing .ssh directory', () => {
    const result = validateToolCode('open(".ssh/id_rsa")', 'python');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_code');
  });

  it('should reject code accessing .aws directory', () => {
    const result = validateToolCode('read(".aws/credentials")', 'python');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_code');
  });

  it('should reject code with powershell reference', () => {
    const result = validateToolCode('run powershell command', 'javascript');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_code');
  });

  it('should reject code with cmd.exe reference', () => {
    const result = validateToolCode('launch cmd.exe /c dir', 'javascript');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_code');
  });

  it('should reject code importing pickle', () => {
    const result = validateToolCode('import pickle', 'python');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_code');
  });

  it('should reject code importing ctypes', () => {
    const result = validateToolCode('import ctypes', 'python');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_code');
  });

  it('should reject code with from ctypes import', () => {
    const result = validateToolCode('from ctypes import cdll', 'python');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_code');
  });

  it('should reject code with data exfiltration pattern (base64 + http)', () => {
    const result = validateToolCode('base64_encode(data) then http_post()', 'python');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_code');
  });

  it('should reject code with upload credential pattern', () => {
    const result = validateToolCode('upload_credentials_to_server()', 'python');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_code');
  });

  it('should reject code containing getenv()', () => {
    const result = validateToolCode('os.getenv("SECRET")', 'python');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_code');
  });

  it('should reject code referencing .env file', () => {
    const result = validateToolCode('load_dotenv(".env")', 'python');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_code');
  });

  it('should reject code referencing credentials', () => {
    const result = validateToolCode('credentials.get("password")', 'python');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_code');
  });

  // --- URL safety checks in code ---
  it('should reject code with blocked URLs', () => {
    mockIsUrlSafe.mockReturnValue({ safe: false, reason: 'Blocked domain' });
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

  it('should check all URLs found in the code', () => {
    mockIsUrlSafe
      .mockReturnValueOnce({ safe: true })
      .mockReturnValueOnce({ safe: false, reason: 'Blocked' });
    const code = 'fetch("https://safe.com/api"); fetch("https://blocked.com/api")';
    const result = validateToolCode(code, 'javascript');
    expect(result.safe).toBe(false);
    expect(mockIsUrlSafe).toHaveBeenCalledTimes(2);
  });

  // --- Python-specific patterns ---
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

  it('should reject Python code with builtins access', () => {
    const result = validateToolCode('__builtins__.__import__("os")', 'python');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('dangerous_python');
  });

  it('should reject Python code with globals()', () => {
    const result = validateToolCode('g = globals()', 'python');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('dangerous_python');
  });

  it('should reject Python code with locals()', () => {
    const result = validateToolCode('l = locals()', 'python');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('dangerous_python');
  });

  it('should reject Python code with compile()', () => {
    const result = validateToolCode('compile("code", "file", "exec")', 'python');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('dangerous_python');
  });

  it('should reject Python code with open() on sensitive paths', () => {
    const result = validateToolCode('open("/etc/data")', 'python');
    expect(result.safe).toBe(false);
  });

  it('should reject Python code with open() on /var paths', () => {
    const result = validateToolCode('open("/var/log/syslog")', 'python');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('dangerous_python');
  });

  it('should reject Python code with open() on /root paths', () => {
    const result = validateToolCode('open("/root/.bashrc")', 'python');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('dangerous_python');
  });

  it('should reject Python code with open() on /home paths', () => {
    const result = validateToolCode('open("/home/user/.config")', 'python');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('dangerous_python');
  });

  // --- JavaScript-specific patterns ---
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

  it('should reject JavaScript code with require(http)', () => {
    const result = validateToolCode("require('http')", 'javascript');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('dangerous_javascript');
  });

  it('should reject JavaScript code with require(https)', () => {
    const result = validateToolCode("require('https')", 'javascript');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('dangerous_javascript');
  });

  it('should reject JavaScript code with dynamic import of child_process', () => {
    const result = validateToolCode("import('child_process')", 'javascript');
    expect(result.safe).toBe(false);
    // Caught by general DANGEROUS_CODE_PATTERNS (child_process) before JS-specific checks
    expect(result.category).toBe('malicious_code');
  });

  it('should reject JavaScript code with global. access', () => {
    const result = validateToolCode('global.something = true', 'javascript');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('dangerous_javascript');
  });

  it('should reject JavaScript code with process. access', () => {
    const result = validateToolCode('process.exit(1)', 'javascript');
    expect(result.safe).toBe(false);
  });

  it('should reject JavaScript code with Buffer.from', () => {
    const result = validateToolCode('Buffer.from("data")', 'javascript');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('dangerous_javascript');
  });

  // --- Cross-language checks ---
  it('should not apply Python-specific checks to JavaScript code', () => {
    const safeJs = 'function main(input) { return input.length; }';
    const result = validateToolCode(safeJs, 'javascript');
    expect(result.safe).toBe(true);
  });

  it('should not apply JavaScript-specific checks to Python code', () => {
    const safePython = 'def main(x): return x + 1';
    const result = validateToolCode(safePython, 'python');
    expect(result.safe).toBe(true);
  });

  it('should apply general patterns regardless of language', () => {
    const result = validateToolCode('eval("code")', 'javascript');
    expect(result.safe).toBe(false);
    expect(result.category).toBe('malicious_code');
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

  it('should set createdAt to current timestamp', async () => {
    const before = Date.now();
    const tool = await generateDynamicTool(makeSafeRequest());
    const after = Date.now();

    expect(tool).not.toBeNull();
    expect(tool!.createdAt).toBeGreaterThanOrEqual(before);
    expect(tool!.createdAt).toBeLessThanOrEqual(after);
  });

  it('should set approvalReason for auto-approved tools', async () => {
    const tool = await generateDynamicTool(makeSafeRequest());

    expect(tool).not.toBeNull();
    expect(tool!.approvalReason).toBe('Passed automated safety checks');
  });

  it('should return null for a dangerous purpose', async () => {
    const tool = await generateDynamicTool(makeSafeRequest({ purpose: 'hack into a database' }));
    expect(tool).toBeNull();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('should call logBlockedAction when purpose is dangerous', async () => {
    await generateDynamicTool(makeSafeRequest({ purpose: 'hack into a database' }));
    expect(mockLogBlockedAction).toHaveBeenCalledWith(
      'test-session-123',
      'dynamic_tool_creation',
      expect.objectContaining({ safe: false }),
      expect.objectContaining({ purpose: 'hack into a database' })
    );
  });

  it('should return null when Claude response has no JSON', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Sorry, I cannot generate that tool.' }],
    });

    const tool = await generateDynamicTool(makeSafeRequest());
    expect(tool).toBeNull();
  });

  it('should return null when response JSON is malformed', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '{ broken json without closing' }],
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

  it('should return null when API call throws an Error', async () => {
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
    // Only principal and rate are required (years has no required: true)
    expect(schema.required).toEqual(['principal', 'rate']);
  });

  it('should build inputSchema with empty required array when no inputs are required', async () => {
    const tool = await generateDynamicTool(
      makeSafeRequest({
        inputs: [
          { name: 'x', type: 'number', description: 'Optional x' },
          { name: 'y', type: 'string', description: 'Optional y' },
        ],
      })
    );

    expect(tool).not.toBeNull();
    const schema = tool!.inputSchema as { required: string[] };
    expect(schema.required).toEqual([]);
  });

  it('should build inputSchema with empty properties when no inputs provided', async () => {
    const tool = await generateDynamicTool(makeSafeRequest({ inputs: [] }));

    expect(tool).not.toBeNull();
    const schema = tool!.inputSchema as { properties: Record<string, unknown>; required: string[] };
    expect(Object.keys(schema.properties)).toHaveLength(0);
    expect(schema.required).toEqual([]);
  });

  it('should include approach in user prompt when provided', async () => {
    await generateDynamicTool(makeSafeRequest({ approach: 'Use the formula A = P(1 + r/n)^(nt)' }));

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const callArgs = mockCreate.mock.calls[0][0];
    const userMessage = callArgs.messages[0].content;
    expect(userMessage).toContain('Use the formula');
  });

  it('should not include approach section when approach is not provided', async () => {
    await generateDynamicTool(makeSafeRequest({ approach: undefined }));

    const callArgs = mockCreate.mock.calls[0][0];
    const userMessage = callArgs.messages[0].content;
    expect(userMessage).not.toContain('SUGGESTED APPROACH:');
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

  it('should call Claude API with correct model and parameters', async () => {
    await generateDynamicTool(makeSafeRequest());

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        temperature: 0.3,
      })
    );
  });

  it('should include safety prompt in system message', async () => {
    await generateDynamicTool(makeSafeRequest());

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.system).toContain('MOCK_AI_SAFETY_PROMPT');
  });

  it('should include purpose and justification in user message', async () => {
    await generateDynamicTool(
      makeSafeRequest({
        purpose: 'Calculate prime numbers',
        justification: 'Need mathematical computation',
      })
    );

    const callArgs = mockCreate.mock.calls[0][0];
    const userMessage = callArgs.messages[0].content;
    expect(userMessage).toContain('Calculate prime numbers');
    expect(userMessage).toContain('Need mathematical computation');
  });

  it('should include input descriptions in user message', async () => {
    await generateDynamicTool(makeSafeRequest());

    const callArgs = mockCreate.mock.calls[0][0];
    const userMessage = callArgs.messages[0].content;
    expect(userMessage).toContain('principal');
    expect(userMessage).toContain('Starting amount');
    expect(userMessage).toContain('required');
  });

  it('should store purpose from the request in the tool definition', async () => {
    const tool = await generateDynamicTool(
      makeSafeRequest({ purpose: 'Special calculation tool' })
    );

    expect(tool).not.toBeNull();
    expect(tool!.purpose).toBe('Special calculation tool');
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

  it('should pass language option for JavaScript execution', async () => {
    mockRunCode.mockResolvedValue({
      logs: {
        stdout: ['{"success": true, "result": 1}'],
        stderr: [],
      },
    });

    const tool = makeToolDef({ language: 'javascript' });
    await executeDynamicTool(tool, {}, sessionId);

    expect(mockRunCode).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ language: 'javascript' })
    );
  });

  it('should not pass language option for Python execution', async () => {
    mockRunCode.mockResolvedValue({
      logs: {
        stdout: ['{"success": true, "result": 1}'],
        stderr: [],
      },
    });

    const tool = makeToolDef({ language: 'python' });
    await executeDynamicTool(tool, {}, sessionId);

    expect(mockRunCode).toHaveBeenCalledWith(expect.any(String));
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

  it('should not sanitize non-string output (object)', async () => {
    mockRunCode.mockResolvedValue({
      logs: {
        stdout: ['{"success": true, "result": {"key": "value"}}'],
        stderr: [],
      },
    });

    const tool = makeToolDef();
    const result = await executeDynamicTool(tool, {}, sessionId);

    expect(result.output).toEqual({ key: 'value' });
    expect(result.sanitized).toBe(false);
    expect(mockSanitizeOutput).not.toHaveBeenCalled();
  });

  it('should not sanitize non-string output (array)', async () => {
    mockRunCode.mockResolvedValue({
      logs: {
        stdout: ['{"success": true, "result": [1, 2, 3]}'],
        stderr: [],
      },
    });

    const tool = makeToolDef();
    const result = await executeDynamicTool(tool, {}, sessionId);

    expect(result.output).toEqual([1, 2, 3]);
    expect(result.sanitized).toBe(false);
  });

  it('should not sanitize non-string output (boolean)', async () => {
    mockRunCode.mockResolvedValue({
      logs: {
        stdout: ['{"success": true, "result": true}'],
        stderr: [],
      },
    });

    const tool = makeToolDef();
    const result = await executeDynamicTool(tool, {}, sessionId);

    expect(result.output).toBe(true);
    expect(result.sanitized).toBe(false);
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

  it('should block inputs containing subprocess reference', async () => {
    const tool = makeToolDef();
    const result = await executeDynamicTool(tool, { cmd: 'subprocess.run(["ls"])' }, sessionId);

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

  it('should handle empty stdout gracefully', async () => {
    mockRunCode.mockResolvedValue({
      logs: {
        stdout: [],
        stderr: [],
      },
    });
    mockSanitizeOutput.mockReturnValue('');

    const tool = makeToolDef();
    const result = await executeDynamicTool(tool, {}, sessionId);

    expect(result.success).toBe(true);
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
    const result = await executeDynamicTool(tool, {}, sessionId);

    expect(result.success).toBe(true);
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

  it('should increment usage count on each execution', async () => {
    mockRunCode.mockResolvedValue({
      logs: {
        stdout: ['{"success": true, "result": 1}'],
        stderr: [],
      },
    });

    const tool = makeToolDef();
    await executeDynamicTool(tool, {}, sessionId);
    await executeDynamicTool(tool, {}, sessionId);
    await executeDynamicTool(tool, {}, sessionId);

    expect(tool.usageCount).toBe(3);
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

    expect(mockSandboxCreate).toHaveBeenCalledTimes(1);
  });

  it('should create separate sandboxes for different sessions', async () => {
    mockRunCode.mockResolvedValue({
      logs: {
        stdout: ['{"success": true, "result": 1}'],
        stderr: [],
      },
    });
    const sb1 = { runCode: mockRunCode, kill: vi.fn().mockResolvedValue(undefined) };
    const sb2 = { runCode: mockRunCode, kill: vi.fn().mockResolvedValue(undefined) };
    mockSandboxCreate.mockResolvedValueOnce(sb1).mockResolvedValueOnce(sb2);

    const tool = makeToolDef();
    await executeDynamicTool(tool, {}, 'session-x');
    await executeDynamicTool(tool, {}, 'session-y');

    expect(mockSandboxCreate).toHaveBeenCalledTimes(2);

    await cleanupDynamicSandbox('session-x');
    await cleanupDynamicSandbox('session-y');
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

  it('should create sandbox with 30s timeout', async () => {
    mockRunCode.mockResolvedValue({
      logs: { stdout: ['{"success": true, "result": 1}'], stderr: [] },
    });

    const tool = makeToolDef();
    await executeDynamicTool(tool, {}, sessionId);

    expect(mockSandboxCreate).toHaveBeenCalledWith({ timeoutMs: 30000 });
  });

  it('should embed inputs as JSON in execution code', async () => {
    mockRunCode.mockResolvedValue({
      logs: { stdout: ['{"success": true, "result": 1}'], stderr: [] },
    });

    const tool = makeToolDef({ language: 'python' });
    const inputs = { name: 'test', value: 42 };
    await executeDynamicTool(tool, inputs, sessionId);

    const executedCode = mockRunCode.mock.calls[0][0];
    expect(executedCode).toContain(JSON.stringify(inputs));
  });

  it('should include tool code in execution payload', async () => {
    mockRunCode.mockResolvedValue({
      logs: { stdout: ['{"success": true, "result": 1}'], stderr: [] },
    });

    const toolCode = 'def main(**kwargs): return {"result": 42}';
    const tool = makeToolDef({ code: toolCode, language: 'python' });
    await executeDynamicTool(tool, {}, sessionId);

    const executedCode = mockRunCode.mock.calls[0][0];
    expect(executedCode).toContain(toolCode);
  });
});

// =============================================================================
// cleanupDynamicSandbox
// =============================================================================

describe('cleanupDynamicSandbox', () => {
  it('should cleanup a specific session sandbox', async () => {
    const sid = 'cleanup-session-1';
    mockRunCode.mockResolvedValue({
      logs: { stdout: ['{"success": true, "result": 1}'], stderr: [] },
    });
    mockSandboxCreate.mockResolvedValue({ runCode: mockRunCode, kill: mockKill });

    const tool = makeToolDef();
    await executeDynamicTool(tool, {}, sid);

    await cleanupDynamicSandbox(sid);
    expect(mockKill).toHaveBeenCalled();
  });

  it('should handle cleanup when session does not exist', async () => {
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

    await cleanupDynamicSandbox();
    expect(failingSandbox.kill).toHaveBeenCalled();
  });

  it('should remove session from map after cleanup', async () => {
    const sid = 'remove-from-map';
    mockRunCode.mockResolvedValue({
      logs: { stdout: ['{"success": true, "result": 1}'], stderr: [] },
    });
    mockSandboxCreate.mockResolvedValue({ runCode: mockRunCode, kill: mockKill });

    const tool = makeToolDef();
    await executeDynamicTool(tool, {}, sid);
    await cleanupDynamicSandbox(sid);

    // Executing again should create a new sandbox
    mockSandboxCreate.mockResolvedValue({
      runCode: mockRunCode,
      kill: vi.fn().mockResolvedValue(undefined),
    });
    await executeDynamicTool(tool, {}, sid);

    expect(mockSandboxCreate).toHaveBeenCalledTimes(2);

    await cleanupDynamicSandbox(sid);
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

  it('should preserve tool properties after registration', () => {
    const tool = makeToolDef({
      id: 'preserve-test',
      name: 'special_tool',
      description: 'A special tool',
      safetyScore: 90,
    });
    registerDynamicTool('session-a', tool);

    const registered = getDynamicTools('session-a')[0];
    expect(registered.name).toBe('special_tool');
    expect(registered.description).toBe('A special tool');
    expect(registered.safetyScore).toBe(90);
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

  it('should return tools in registration order', () => {
    registerDynamicTool('session-a', makeToolDef({ id: 'first' }));
    registerDynamicTool('session-a', makeToolDef({ id: 'second' }));
    registerDynamicTool('session-a', makeToolDef({ id: 'third' }));

    const tools = getDynamicTools('session-a');
    expect(tools[0].id).toBe('first');
    expect(tools[1].id).toBe('second');
    expect(tools[2].id).toBe('third');
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

  it('should find the correct tool among many', () => {
    for (let i = 0; i < 10; i++) {
      registerDynamicTool('session-a', makeToolDef({ id: `tool-${i}`, name: `tool_${i}` }));
    }

    const found = getDynamicToolById('session-a', 'tool-7');
    expect(found).toBeDefined();
    expect(found!.name).toBe('tool_7');
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

  it('should allow re-registering tools after clearing', () => {
    registerDynamicTool('session-a', makeToolDef({ id: 'old' }));
    clearDynamicTools('session-a');
    registerDynamicTool('session-a', makeToolDef({ id: 'new' }));

    const tools = getDynamicTools('session-a');
    expect(tools).toHaveLength(1);
    expect(tools[0].id).toBe('new');
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

  it('should have input items with required name, type, and description', () => {
    const def = getDynamicToolCreationDefinition();
    const schema = def.input_schema as {
      properties: {
        inputs: {
          items: {
            required: string[];
          };
        };
      };
    };

    expect(schema.properties.inputs.items.required).toContain('name');
    expect(schema.properties.inputs.items.required).toContain('type');
    expect(schema.properties.inputs.items.required).toContain('description');
  });

  it('should mention limitations in description', () => {
    const def = getDynamicToolCreationDefinition();

    expect(def.description).toContain('sandboxed');
    expect(def.description).toContain('No direct internet access');
    expect(def.description).toContain('No file system access');
    expect(def.description).toContain('No system commands');
  });

  it('should return consistent results on multiple calls', () => {
    const def1 = getDynamicToolCreationDefinition();
    const def2 = getDynamicToolCreationDefinition();

    expect(def1.name).toBe(def2.name);
    expect(def1.description).toBe(def2.description);
    expect(JSON.stringify(def1.input_schema)).toBe(JSON.stringify(def2.input_schema));
  });
});
