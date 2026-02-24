import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================================================
// Mocks — MUST come before any module-under-test imports
// ============================================================================

const mockSandboxCreate = vi.fn();
const mockSandboxRunCommand = vi.fn();
const mockSandboxWriteFiles = vi.fn();
const mockSandboxStop = vi.fn();

vi.mock('@vercel/sandbox', () => ({
  Sandbox: {
    create: (...args: unknown[]) => mockSandboxCreate(...args),
  },
}));

vi.mock('ms', () => ({
  default: vi.fn((str: string) => {
    const map: Record<string, number> = {
      '5m': 300000,
      '2m': 120000,
      '10m': 600000,
    };
    return map[str] || 0;
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// ============================================================================
// Module-under-test imports (after mocks)
// ============================================================================

import {
  executeSandbox,
  quickTest,
  buildAndTest,
  isSandboxConfigured,
  getSandboxConfig,
  getMissingSandboxConfig,
} from './vercel-sandbox';

import type {
  SandboxConfig,
  SandboxExecutionOptions,
  SandboxResult,
  CommandOutput,
} from './vercel-sandbox';

// ============================================================================
// Helpers
// ============================================================================

function createMockSandbox() {
  const sandbox = {
    runCommand: mockSandboxRunCommand,
    writeFiles: mockSandboxWriteFiles,
    stop: mockSandboxStop,
  };
  return sandbox;
}

function createMockCommandResult(exitCode: number, stdout: string, stderr: string) {
  return {
    exitCode,
    stdout: vi.fn().mockResolvedValue(stdout),
    stderr: vi.fn().mockResolvedValue(stderr),
  };
}

// ============================================================================
// Saved env
// ============================================================================

const originalEnv = { ...process.env };

// ============================================================================
// Tests
// ============================================================================

describe('vercel-sandbox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clean sandbox-related env vars
    delete process.env.VERCEL_OIDC_TOKEN;
    delete process.env.VERCEL_TEAM_ID;
    delete process.env.VERCEL_PROJECT_ID;
    delete process.env.VERCEL_TOKEN;
  });

  afterEach(() => {
    // Restore env
    process.env = { ...originalEnv };
  });

  // ========================================================================
  // Type exports
  // ========================================================================

  describe('type exports', () => {
    it('should export SandboxConfig type with expected shape', () => {
      const config: SandboxConfig = {
        oidcToken: 'token',
        teamId: 'team',
        projectId: 'proj',
        token: 'tok',
      };
      expect(config.oidcToken).toBe('token');
      expect(config.teamId).toBe('team');
      expect(config.projectId).toBe('proj');
      expect(config.token).toBe('tok');
    });

    it('should export SandboxConfig with all optional fields', () => {
      const config: SandboxConfig = {};
      expect(config.oidcToken).toBeUndefined();
    });

    it('should export SandboxExecutionOptions type with expected shape', () => {
      const opts: SandboxExecutionOptions = {
        files: [{ path: 'test.js', content: 'console.log("hi")' }],
        commands: ['node test.js'],
        runtime: 'node22',
        timeout: 5000,
        vcpus: 4,
      };
      expect(opts.commands).toHaveLength(1);
      expect(opts.runtime).toBe('node22');
    });

    it('should support python3.13 runtime in SandboxExecutionOptions', () => {
      const opts: SandboxExecutionOptions = {
        commands: ['python test.py'],
        runtime: 'python3.13',
      };
      expect(opts.runtime).toBe('python3.13');
    });

    it('should export SandboxResult type with expected shape', () => {
      const result: SandboxResult = {
        success: true,
        outputs: [],
        executionTime: 100,
      };
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should export SandboxResult with optional error', () => {
      const result: SandboxResult = {
        success: false,
        outputs: [],
        error: 'something went wrong',
        executionTime: 50,
      };
      expect(result.error).toBe('something went wrong');
    });

    it('should export CommandOutput type with expected shape', () => {
      const output: CommandOutput = {
        command: 'npm test',
        exitCode: 0,
        stdout: 'all passed',
        stderr: '',
        success: true,
      };
      expect(output.exitCode).toBe(0);
    });
  });

  // ========================================================================
  // isSandboxConfigured
  // ========================================================================

  describe('isSandboxConfigured', () => {
    it('should return true when oidcToken is provided', () => {
      expect(isSandboxConfigured('some-oidc-token')).toBe(true);
    });

    it('should return true when VERCEL_OIDC_TOKEN env var is set', () => {
      process.env.VERCEL_OIDC_TOKEN = 'env-oidc-token';
      expect(isSandboxConfigured()).toBe(true);
    });

    it('should return true when all access token env vars are set', () => {
      process.env.VERCEL_TEAM_ID = 'team-123';
      process.env.VERCEL_PROJECT_ID = 'proj-456';
      process.env.VERCEL_TOKEN = 'tok-789';
      expect(isSandboxConfigured()).toBe(true);
    });

    it('should return false when no config is available', () => {
      expect(isSandboxConfigured()).toBe(false);
    });

    it('should return false when only partial access token env vars are set', () => {
      process.env.VERCEL_TEAM_ID = 'team-123';
      expect(isSandboxConfigured()).toBe(false);
    });

    it('should return false when oidcToken is null', () => {
      expect(isSandboxConfigured(null)).toBe(false);
    });

    it('should return false when oidcToken is empty string', () => {
      // Empty string is falsy
      expect(isSandboxConfigured('')).toBe(false);
    });

    it('should return false when only VERCEL_TEAM_ID and VERCEL_PROJECT_ID are set', () => {
      process.env.VERCEL_TEAM_ID = 'team';
      process.env.VERCEL_PROJECT_ID = 'proj';
      expect(isSandboxConfigured()).toBe(false);
    });
  });

  // ========================================================================
  // getSandboxConfig
  // ========================================================================

  describe('getSandboxConfig', () => {
    it('should return null when not configured', () => {
      expect(getSandboxConfig()).toBeNull();
    });

    it('should return OIDC config when oidcToken is provided', () => {
      const config = getSandboxConfig('my-oidc-token');
      expect(config).toEqual({ oidcToken: 'my-oidc-token' });
    });

    it('should return OIDC config from env when VERCEL_OIDC_TOKEN is set', () => {
      process.env.VERCEL_OIDC_TOKEN = 'env-oidc-token';
      const config = getSandboxConfig();
      expect(config).toEqual({ oidcToken: 'env-oidc-token' });
    });

    it('should prefer provided oidcToken over env var', () => {
      process.env.VERCEL_OIDC_TOKEN = 'env-token';
      const config = getSandboxConfig('param-token');
      expect(config).toEqual({ oidcToken: 'param-token' });
    });

    it('should return access token config when env vars are set', () => {
      process.env.VERCEL_TEAM_ID = 'team-123';
      process.env.VERCEL_PROJECT_ID = 'proj-456';
      process.env.VERCEL_TOKEN = 'tok-789';
      const config = getSandboxConfig();
      expect(config).toEqual({
        teamId: 'team-123',
        projectId: 'proj-456',
        token: 'tok-789',
      });
    });

    it('should return null when oidcToken is null and no env vars', () => {
      expect(getSandboxConfig(null)).toBeNull();
    });
  });

  // ========================================================================
  // getMissingSandboxConfig
  // ========================================================================

  describe('getMissingSandboxConfig', () => {
    it('should return empty array when oidcToken is provided', () => {
      expect(getMissingSandboxConfig('some-token')).toEqual([]);
    });

    it('should return empty array when VERCEL_OIDC_TOKEN env is set', () => {
      process.env.VERCEL_OIDC_TOKEN = 'env-token';
      expect(getMissingSandboxConfig()).toEqual([]);
    });

    it('should return all three missing vars when none are set', () => {
      const missing = getMissingSandboxConfig();
      expect(missing).toEqual(['VERCEL_TEAM_ID', 'VERCEL_PROJECT_ID', 'VERCEL_TOKEN']);
    });

    it('should return only missing vars when some are set', () => {
      process.env.VERCEL_TEAM_ID = 'team-123';
      const missing = getMissingSandboxConfig();
      expect(missing).toEqual(['VERCEL_PROJECT_ID', 'VERCEL_TOKEN']);
    });

    it('should return empty when all access token vars are set', () => {
      process.env.VERCEL_TEAM_ID = 'team';
      process.env.VERCEL_PROJECT_ID = 'proj';
      process.env.VERCEL_TOKEN = 'tok';
      expect(getMissingSandboxConfig()).toEqual([]);
    });

    it('should return missing VERCEL_TOKEN when only team and project set', () => {
      process.env.VERCEL_TEAM_ID = 'team';
      process.env.VERCEL_PROJECT_ID = 'proj';
      expect(getMissingSandboxConfig()).toEqual(['VERCEL_TOKEN']);
    });
  });

  // ========================================================================
  // executeSandbox
  // ========================================================================

  describe('executeSandbox', () => {
    it('should create sandbox with OIDC auth and execute commands', async () => {
      const mockSandbox = createMockSandbox();
      mockSandboxCreate.mockResolvedValue(mockSandbox);
      mockSandboxRunCommand.mockResolvedValue(createMockCommandResult(0, 'hello world', ''));
      mockSandboxStop.mockResolvedValue(undefined);

      const config: SandboxConfig = { oidcToken: 'test-oidc' };
      const options: SandboxExecutionOptions = {
        commands: ['node test.js'],
      };

      const result = await executeSandbox(config, options);

      expect(result.success).toBe(true);
      expect(result.outputs).toHaveLength(1);
      expect(result.outputs[0].stdout).toBe('hello world');
      expect(result.outputs[0].exitCode).toBe(0);
      expect(result.outputs[0].success).toBe(true);
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
      expect(mockSandboxStop).toHaveBeenCalled();
    });

    it('should create sandbox with access token auth', async () => {
      const mockSandbox = createMockSandbox();
      mockSandboxCreate.mockResolvedValue(mockSandbox);
      mockSandboxRunCommand.mockResolvedValue(createMockCommandResult(0, 'ok', ''));
      mockSandboxStop.mockResolvedValue(undefined);

      const config: SandboxConfig = {
        teamId: 'team-1',
        projectId: 'proj-1',
        token: 'tok-1',
      };
      const options: SandboxExecutionOptions = {
        commands: ['echo hi'],
      };

      const result = await executeSandbox(config, options);

      expect(result.success).toBe(true);
      expect(mockSandboxCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          teamId: 'team-1',
          projectId: 'proj-1',
          token: 'tok-1',
        })
      );
    });

    it('should write files to sandbox when provided', async () => {
      const mockSandbox = createMockSandbox();
      mockSandboxCreate.mockResolvedValue(mockSandbox);
      mockSandboxRunCommand.mockResolvedValue(createMockCommandResult(0, '', ''));
      mockSandboxStop.mockResolvedValue(undefined);
      mockSandboxWriteFiles.mockResolvedValue(undefined);

      const config: SandboxConfig = { oidcToken: 'test' };
      const options: SandboxExecutionOptions = {
        files: [
          { path: 'index.js', content: 'console.log("hi")' },
          { path: 'package.json', content: '{}' },
        ],
        commands: ['node index.js'],
      };

      await executeSandbox(config, options);

      expect(mockSandboxWriteFiles).toHaveBeenCalledWith([
        { path: 'index.js', content: Buffer.from('console.log("hi")', 'utf-8') },
        { path: 'package.json', content: Buffer.from('{}', 'utf-8') },
      ]);
    });

    it('should not write files when files array is empty', async () => {
      const mockSandbox = createMockSandbox();
      mockSandboxCreate.mockResolvedValue(mockSandbox);
      mockSandboxRunCommand.mockResolvedValue(createMockCommandResult(0, '', ''));
      mockSandboxStop.mockResolvedValue(undefined);

      const config: SandboxConfig = { oidcToken: 'test' };
      const options: SandboxExecutionOptions = {
        files: [],
        commands: ['echo ok'],
      };

      await executeSandbox(config, options);

      expect(mockSandboxWriteFiles).not.toHaveBeenCalled();
    });

    it('should stop on first failed command (non-test)', async () => {
      const mockSandbox = createMockSandbox();
      mockSandboxCreate.mockResolvedValue(mockSandbox);
      mockSandboxRunCommand
        .mockResolvedValueOnce(createMockCommandResult(1, '', 'error'))
        .mockResolvedValueOnce(createMockCommandResult(0, 'ok', ''));
      mockSandboxStop.mockResolvedValue(undefined);

      const config: SandboxConfig = { oidcToken: 'test' };
      const options: SandboxExecutionOptions = {
        commands: ['npm install', 'npm run build'],
      };

      const result = await executeSandbox(config, options);

      expect(result.success).toBe(false);
      expect(result.outputs).toHaveLength(1);
      // Second command should NOT have run
      expect(mockSandboxRunCommand).toHaveBeenCalledTimes(1);
    });

    it('should continue on failed test command', async () => {
      const mockSandbox = createMockSandbox();
      mockSandboxCreate.mockResolvedValue(mockSandbox);
      mockSandboxRunCommand
        .mockResolvedValueOnce(createMockCommandResult(1, 'test output', 'some tests failed'))
        .mockResolvedValueOnce(createMockCommandResult(0, 'lint ok', ''));
      mockSandboxStop.mockResolvedValue(undefined);

      const config: SandboxConfig = { oidcToken: 'test' };
      const options: SandboxExecutionOptions = {
        commands: ['npm test', 'npm run lint'],
      };

      const result = await executeSandbox(config, options);

      expect(result.success).toBe(false);
      expect(result.outputs).toHaveLength(2);
      expect(mockSandboxRunCommand).toHaveBeenCalledTimes(2);
    });

    it('should handle sandbox creation error', async () => {
      mockSandboxCreate.mockRejectedValue(new Error('Sandbox creation failed'));

      const config: SandboxConfig = { oidcToken: 'test' };
      const options: SandboxExecutionOptions = {
        commands: ['echo hi'],
      };

      const result = await executeSandbox(config, options);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Sandbox creation failed');
      expect(result.outputs).toHaveLength(0);
    });

    it('should handle non-Error thrown objects', async () => {
      mockSandboxCreate.mockRejectedValue('string error');

      const config: SandboxConfig = { oidcToken: 'test' };
      const options: SandboxExecutionOptions = {
        commands: ['echo hi'],
      };

      const result = await executeSandbox(config, options);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error');
    });

    it('should stop sandbox even when error occurs', async () => {
      const mockSandbox = createMockSandbox();
      mockSandboxCreate.mockResolvedValue(mockSandbox);
      mockSandboxRunCommand.mockRejectedValue(new Error('Command execution error'));
      mockSandboxStop.mockResolvedValue(undefined);

      const config: SandboxConfig = { oidcToken: 'test' };
      const options: SandboxExecutionOptions = {
        commands: ['failing-cmd'],
      };

      await executeSandbox(config, options);

      expect(mockSandboxStop).toHaveBeenCalled();
    });

    it('should ignore sandbox stop errors', async () => {
      const mockSandbox = createMockSandbox();
      mockSandboxCreate.mockResolvedValue(mockSandbox);
      mockSandboxRunCommand.mockResolvedValue(createMockCommandResult(0, 'ok', ''));
      mockSandboxStop.mockRejectedValue(new Error('stop failed'));

      const config: SandboxConfig = { oidcToken: 'test' };
      const options: SandboxExecutionOptions = {
        commands: ['echo ok'],
      };

      // Should not throw despite stop failing
      const result = await executeSandbox(config, options);
      expect(result.success).toBe(true);
    });

    it('should use default runtime node22 when not specified', async () => {
      const mockSandbox = createMockSandbox();
      mockSandboxCreate.mockResolvedValue(mockSandbox);
      mockSandboxRunCommand.mockResolvedValue(createMockCommandResult(0, '', ''));
      mockSandboxStop.mockResolvedValue(undefined);

      const config: SandboxConfig = { oidcToken: 'test' };
      const options: SandboxExecutionOptions = {
        commands: ['echo ok'],
      };

      await executeSandbox(config, options);

      expect(mockSandboxCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          runtime: 'node22',
          resources: { vcpus: 2 },
        })
      );
    });

    it('should use specified runtime and vcpus', async () => {
      const mockSandbox = createMockSandbox();
      mockSandboxCreate.mockResolvedValue(mockSandbox);
      mockSandboxRunCommand.mockResolvedValue(createMockCommandResult(0, '', ''));
      mockSandboxStop.mockResolvedValue(undefined);

      const config: SandboxConfig = { oidcToken: 'test' };
      const options: SandboxExecutionOptions = {
        commands: ['python test.py'],
        runtime: 'python3.13',
        vcpus: 8,
        timeout: 60000,
      };

      await executeSandbox(config, options);

      expect(mockSandboxCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          runtime: 'python3.13',
          resources: { vcpus: 8 },
          timeout: 60000,
        })
      );
    });

    it('should handle command that throws an error in runCommand', async () => {
      const mockSandbox = createMockSandbox();
      mockSandboxCreate.mockResolvedValue(mockSandbox);
      // runCommand itself throws (not the command failing with exit code)
      // runCommandWithOutput catches this and returns a CommandOutput with success: false
      mockSandboxRunCommand.mockRejectedValue(new Error('network timeout'));
      mockSandboxStop.mockResolvedValue(undefined);

      const config: SandboxConfig = { oidcToken: 'test' };
      const options: SandboxExecutionOptions = {
        commands: ['some-command'],
      };

      const result = await executeSandbox(config, options);

      expect(result.success).toBe(false);
      expect(result.outputs).toHaveLength(1);
      expect(result.outputs[0].success).toBe(false);
      expect(result.outputs[0].exitCode).toBe(1);
      expect(result.outputs[0].stderr).toBe('network timeout');
      expect(result.outputs[0].stdout).toBe('');
    });

    it('should parse commands with quoted strings', async () => {
      const mockSandbox = createMockSandbox();
      mockSandboxCreate.mockResolvedValue(mockSandbox);
      mockSandboxRunCommand.mockResolvedValue(createMockCommandResult(0, 'hello world', ''));
      mockSandboxStop.mockResolvedValue(undefined);

      const config: SandboxConfig = { oidcToken: 'test' };
      const options: SandboxExecutionOptions = {
        commands: ['echo "hello world"'],
      };

      await executeSandbox(config, options);

      // The command should be parsed: cmd='echo', args=['hello world']
      expect(mockSandboxRunCommand).toHaveBeenCalledWith('echo', ['hello world']);
    });

    it('should handle sudo commands by stripping sudo prefix', async () => {
      const mockSandbox = createMockSandbox();
      mockSandboxCreate.mockResolvedValue(mockSandbox);
      mockSandboxRunCommand.mockResolvedValue(createMockCommandResult(0, '', ''));
      mockSandboxStop.mockResolvedValue(undefined);

      const config: SandboxConfig = { oidcToken: 'test' };
      const options: SandboxExecutionOptions = {
        commands: ['sudo apt-get install -y curl'],
      };

      await executeSandbox(config, options);

      // sudo is stripped: cmd='apt-get', args=['install', '-y', 'curl']
      expect(mockSandboxRunCommand).toHaveBeenCalledWith('apt-get', ['install', '-y', 'curl']);
    });

    it('should handle multiple successful commands', async () => {
      const mockSandbox = createMockSandbox();
      mockSandboxCreate.mockResolvedValue(mockSandbox);
      mockSandboxRunCommand
        .mockResolvedValueOnce(createMockCommandResult(0, 'installed', ''))
        .mockResolvedValueOnce(createMockCommandResult(0, 'built', ''))
        .mockResolvedValueOnce(createMockCommandResult(0, 'tested', ''));
      mockSandboxStop.mockResolvedValue(undefined);

      const config: SandboxConfig = { oidcToken: 'test' };
      const options: SandboxExecutionOptions = {
        commands: ['npm install', 'npm run build', 'npm test'],
      };

      const result = await executeSandbox(config, options);

      expect(result.success).toBe(true);
      expect(result.outputs).toHaveLength(3);
      expect(result.outputs[0].stdout).toBe('installed');
      expect(result.outputs[1].stdout).toBe('built');
      expect(result.outputs[2].stdout).toBe('tested');
    });

    it('should trim stdout and stderr output', async () => {
      const mockSandbox = createMockSandbox();
      mockSandboxCreate.mockResolvedValue(mockSandbox);
      mockSandboxRunCommand.mockResolvedValue(
        createMockCommandResult(0, '  hello  \n', '  warn  \n')
      );
      mockSandboxStop.mockResolvedValue(undefined);

      const config: SandboxConfig = { oidcToken: 'test' };
      const options: SandboxExecutionOptions = {
        commands: ['echo hello'],
      };

      const result = await executeSandbox(config, options);

      expect(result.outputs[0].stdout).toBe('hello');
      expect(result.outputs[0].stderr).toBe('warn');
    });

    it('should restore OIDC token env var after sandbox creation', async () => {
      process.env.VERCEL_OIDC_TOKEN = 'original-token';
      const mockSandbox = createMockSandbox();
      mockSandboxCreate.mockResolvedValue(mockSandbox);
      mockSandboxRunCommand.mockResolvedValue(createMockCommandResult(0, '', ''));
      mockSandboxStop.mockResolvedValue(undefined);

      const config: SandboxConfig = { oidcToken: 'temp-token' };
      const options: SandboxExecutionOptions = {
        commands: ['echo ok'],
      };

      await executeSandbox(config, options);

      // The original token should be restored
      expect(process.env.VERCEL_OIDC_TOKEN).toBe('original-token');
    });

    it('should delete OIDC token env var if it was not set before', async () => {
      delete process.env.VERCEL_OIDC_TOKEN;
      const mockSandbox = createMockSandbox();
      mockSandboxCreate.mockResolvedValue(mockSandbox);
      mockSandboxRunCommand.mockResolvedValue(createMockCommandResult(0, '', ''));
      mockSandboxStop.mockResolvedValue(undefined);

      const config: SandboxConfig = { oidcToken: 'temp-token' };
      const options: SandboxExecutionOptions = {
        commands: ['echo ok'],
      };

      await executeSandbox(config, options);

      expect(process.env.VERCEL_OIDC_TOKEN).toBeUndefined();
    });

    it('should handle command with single quotes', async () => {
      const mockSandbox = createMockSandbox();
      mockSandboxCreate.mockResolvedValue(mockSandbox);
      mockSandboxRunCommand.mockResolvedValue(createMockCommandResult(0, '', ''));
      mockSandboxStop.mockResolvedValue(undefined);

      const config: SandboxConfig = { oidcToken: 'test' };
      const options: SandboxExecutionOptions = {
        commands: ["echo 'hello world'"],
      };

      await executeSandbox(config, options);

      expect(mockSandboxRunCommand).toHaveBeenCalledWith('echo', ['hello world']);
    });
  });

  // ========================================================================
  // quickTest
  // ========================================================================

  describe('quickTest', () => {
    it('should run JavaScript code with node22 runtime', async () => {
      const mockSandbox = createMockSandbox();
      mockSandboxCreate.mockResolvedValue(mockSandbox);
      mockSandboxRunCommand.mockResolvedValue(createMockCommandResult(0, '42', ''));
      mockSandboxStop.mockResolvedValue(undefined);
      mockSandboxWriteFiles.mockResolvedValue(undefined);

      const config: SandboxConfig = { oidcToken: 'test' };
      const result = await quickTest(config, 'console.log(42)');

      expect(result.success).toBe(true);
      expect(mockSandboxWriteFiles).toHaveBeenCalledWith([
        { path: 'test.js', content: Buffer.from('console.log(42)', 'utf-8') },
      ]);
      expect(mockSandboxRunCommand).toHaveBeenCalledWith('node', ['test.js']);
    });

    it('should run TypeScript code with npx tsx', async () => {
      const mockSandbox = createMockSandbox();
      mockSandboxCreate.mockResolvedValue(mockSandbox);
      mockSandboxRunCommand.mockResolvedValue(createMockCommandResult(0, 'typed', ''));
      mockSandboxStop.mockResolvedValue(undefined);
      mockSandboxWriteFiles.mockResolvedValue(undefined);

      const config: SandboxConfig = { oidcToken: 'test' };
      const result = await quickTest(config, 'const x: number = 1;', 'typescript');

      expect(result.success).toBe(true);
      expect(mockSandboxWriteFiles).toHaveBeenCalledWith([
        { path: 'test.ts', content: Buffer.from('const x: number = 1;', 'utf-8') },
      ]);
      expect(mockSandboxRunCommand).toHaveBeenCalledWith('npx', ['tsx', 'test.ts']);
    });

    it('should run Python code with python3.13 runtime', async () => {
      const mockSandbox = createMockSandbox();
      mockSandboxCreate.mockResolvedValue(mockSandbox);
      mockSandboxRunCommand.mockResolvedValue(createMockCommandResult(0, 'hello', ''));
      mockSandboxStop.mockResolvedValue(undefined);
      mockSandboxWriteFiles.mockResolvedValue(undefined);

      const config: SandboxConfig = { oidcToken: 'test' };
      const result = await quickTest(config, 'print("hello")', 'python');

      expect(result.success).toBe(true);
      expect(mockSandboxCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          runtime: 'python3.13',
        })
      );
      expect(mockSandboxWriteFiles).toHaveBeenCalledWith([
        { path: 'test.py', content: Buffer.from('print("hello")', 'utf-8') },
      ]);
      expect(mockSandboxRunCommand).toHaveBeenCalledWith('python', ['test.py']);
    });

    it('should default to javascript when no language specified', async () => {
      const mockSandbox = createMockSandbox();
      mockSandboxCreate.mockResolvedValue(mockSandbox);
      mockSandboxRunCommand.mockResolvedValue(createMockCommandResult(0, '', ''));
      mockSandboxStop.mockResolvedValue(undefined);
      mockSandboxWriteFiles.mockResolvedValue(undefined);

      const config: SandboxConfig = { oidcToken: 'test' };
      await quickTest(config, 'console.log("hi")');

      expect(mockSandboxCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          runtime: 'node22',
        })
      );
    });

    it('should use 2 vcpus for quick tests', async () => {
      const mockSandbox = createMockSandbox();
      mockSandboxCreate.mockResolvedValue(mockSandbox);
      mockSandboxRunCommand.mockResolvedValue(createMockCommandResult(0, '', ''));
      mockSandboxStop.mockResolvedValue(undefined);
      mockSandboxWriteFiles.mockResolvedValue(undefined);

      const config: SandboxConfig = { oidcToken: 'test' };
      await quickTest(config, 'x = 1', 'python');

      expect(mockSandboxCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          resources: { vcpus: 2 },
        })
      );
    });
  });

  // ========================================================================
  // buildAndTest
  // ========================================================================

  describe('buildAndTest', () => {
    it('should install with npm by default', async () => {
      const mockSandbox = createMockSandbox();
      mockSandboxCreate.mockResolvedValue(mockSandbox);
      mockSandboxRunCommand.mockResolvedValue(createMockCommandResult(0, 'installed', ''));
      mockSandboxStop.mockResolvedValue(undefined);
      mockSandboxWriteFiles.mockResolvedValue(undefined);

      const config: SandboxConfig = { oidcToken: 'test' };
      const files = [{ path: 'package.json', content: '{}' }];

      const result = await buildAndTest(config, files);

      expect(result.success).toBe(true);
      // npm install should be the command
      expect(mockSandboxRunCommand).toHaveBeenCalledWith('npm', ['install']);
    });

    it('should use yarn when specified', async () => {
      const mockSandbox = createMockSandbox();
      mockSandboxCreate.mockResolvedValue(mockSandbox);
      mockSandboxRunCommand.mockResolvedValue(createMockCommandResult(0, '', ''));
      mockSandboxStop.mockResolvedValue(undefined);
      mockSandboxWriteFiles.mockResolvedValue(undefined);

      const config: SandboxConfig = { oidcToken: 'test' };
      const files = [{ path: 'package.json', content: '{}' }];

      await buildAndTest(config, files, { packageManager: 'yarn' });

      expect(mockSandboxRunCommand).toHaveBeenCalledWith('yarn', []);
    });

    it('should use pnpm when specified', async () => {
      const mockSandbox = createMockSandbox();
      mockSandboxCreate.mockResolvedValue(mockSandbox);
      mockSandboxRunCommand.mockResolvedValue(createMockCommandResult(0, '', ''));
      mockSandboxStop.mockResolvedValue(undefined);
      mockSandboxWriteFiles.mockResolvedValue(undefined);

      const config: SandboxConfig = { oidcToken: 'test' };
      const files = [{ path: 'package.json', content: '{}' }];

      await buildAndTest(config, files, { packageManager: 'pnpm' });

      expect(mockSandboxRunCommand).toHaveBeenCalledWith('pnpm', ['install']);
    });

    it('should use bun when specified', async () => {
      const mockSandbox = createMockSandbox();
      mockSandboxCreate.mockResolvedValue(mockSandbox);
      mockSandboxRunCommand.mockResolvedValue(createMockCommandResult(0, '', ''));
      mockSandboxStop.mockResolvedValue(undefined);
      mockSandboxWriteFiles.mockResolvedValue(undefined);

      const config: SandboxConfig = { oidcToken: 'test' };
      const files = [{ path: 'package.json', content: '{}' }];

      await buildAndTest(config, files, { packageManager: 'bun' });

      expect(mockSandboxRunCommand).toHaveBeenCalledWith('bun', ['install']);
    });

    it('should run build and test commands when provided', async () => {
      const mockSandbox = createMockSandbox();
      mockSandboxCreate.mockResolvedValue(mockSandbox);
      mockSandboxRunCommand.mockResolvedValue(createMockCommandResult(0, 'ok', ''));
      mockSandboxStop.mockResolvedValue(undefined);
      mockSandboxWriteFiles.mockResolvedValue(undefined);

      const config: SandboxConfig = { oidcToken: 'test' };
      const files = [{ path: 'package.json', content: '{}' }];

      await buildAndTest(config, files, {
        buildCommand: 'npm run build',
        testCommand: 'npm test',
      });

      expect(mockSandboxRunCommand).toHaveBeenCalledTimes(3);
    });

    it('should use node22 runtime and 4 vcpus', async () => {
      const mockSandbox = createMockSandbox();
      mockSandboxCreate.mockResolvedValue(mockSandbox);
      mockSandboxRunCommand.mockResolvedValue(createMockCommandResult(0, '', ''));
      mockSandboxStop.mockResolvedValue(undefined);
      mockSandboxWriteFiles.mockResolvedValue(undefined);

      const config: SandboxConfig = { oidcToken: 'test' };
      const files = [{ path: 'package.json', content: '{}' }];

      await buildAndTest(config, files);

      expect(mockSandboxCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          runtime: 'node22',
          resources: { vcpus: 4 },
        })
      );
    });

    it('should only run install when no build or test commands given', async () => {
      const mockSandbox = createMockSandbox();
      mockSandboxCreate.mockResolvedValue(mockSandbox);
      mockSandboxRunCommand.mockResolvedValue(createMockCommandResult(0, '', ''));
      mockSandboxStop.mockResolvedValue(undefined);
      mockSandboxWriteFiles.mockResolvedValue(undefined);

      const config: SandboxConfig = { oidcToken: 'test' };
      const files = [{ path: 'package.json', content: '{}' }];

      await buildAndTest(config, files);

      expect(mockSandboxRunCommand).toHaveBeenCalledTimes(1);
    });
  });
});
