// @ts-nocheck - Test file with extensive mocking
/** @vitest-environment node */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================
// HOISTED MOCKS
// ============================================

const mockExecuteSandbox = vi.hoisted(() => vi.fn());
const mockGetSandboxConfig = vi.hoisted(() => vi.fn());
const mockIsSandboxConfigured = vi.hoisted(() => vi.fn());

// ============================================
// MOCKS
// ============================================

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('../../../../lib/connectors/vercel-sandbox', () => ({
  executeSandbox: mockExecuteSandbox,
  getSandboxConfig: mockGetSandboxConfig,
  isSandboxConfigured: mockIsSandboxConfigured,
}));

// ============================================
// IMPORTS (after mocks)
// ============================================

import { SandboxExecutor, sandboxExecutor } from '../SandboxExecutor';

// ============================================
// HELPERS
// ============================================

function makeGeneratedFile(overrides = {}) {
  return {
    path: 'src/index.ts',
    content: 'console.log("hello");',
    language: 'typescript',
    purpose: 'entry point',
    description: 'Main entry file',
    linesOfCode: 1,
    generatedAt: Date.now(),
    version: 1,
    ...overrides,
  };
}

function makeProjectPlan(overrides = {}) {
  return {
    id: 'plan-1',
    name: 'Test Project',
    description: 'A test project',
    architecture: {
      pattern: 'MVC',
      layers: [],
      rationale: 'Simple pattern',
    },
    fileTree: [],
    dependencies: { production: {}, development: {} },
    buildSteps: [],
    testStrategy: { approach: 'unit', testFiles: [] },
    risks: [],
    taskBreakdown: [],
    ...overrides,
  };
}

function makeCodeIntent(overrides = {}) {
  return {
    originalRequest: 'Build a hello world app',
    refinedDescription: 'A simple hello world TypeScript app',
    projectType: 'script',
    requirements: {
      functional: ['Print hello world'],
      technical: ['TypeScript'],
      constraints: [],
    },
    complexity: 'simple',
    estimatedFiles: 1,
    technologies: {
      primary: 'TypeScript',
      secondary: [],
      runtime: 'node',
      packageManager: 'npm',
    },
    contextClues: {},
    ...overrides,
  };
}

function makeSandboxResult(overrides = {}) {
  return {
    success: true,
    outputs: [
      {
        command: 'npm install',
        exitCode: 0,
        stdout: 'added 10 packages',
        stderr: '',
        success: true,
      },
    ],
    executionTime: 5000,
    ...overrides,
  };
}

// ============================================
// TESTS
// ============================================

describe('SandboxExecutor', () => {
  let executor: SandboxExecutor;

  beforeEach(() => {
    vi.clearAllMocks();
    executor = new SandboxExecutor();
  });

  // ------------------------------------------
  // Constructor & Default State
  // ------------------------------------------

  describe('constructor', () => {
    it('should create an instance', () => {
      expect(executor).toBeInstanceOf(SandboxExecutor);
    });

    it('should not be available by default', () => {
      expect(executor.isAvailable()).toBe(false);
    });
  });

  // ------------------------------------------
  // initialize()
  // ------------------------------------------

  describe('initialize', () => {
    it('should return true when sandbox is configured and config is returned', () => {
      mockIsSandboxConfigured.mockReturnValue(true);
      mockGetSandboxConfig.mockReturnValue({ oidcToken: 'test-token' });

      const result = executor.initialize('test-token');

      expect(result).toBe(true);
      expect(mockIsSandboxConfigured).toHaveBeenCalledWith('test-token');
      expect(mockGetSandboxConfig).toHaveBeenCalledWith('test-token');
    });

    it('should return false when sandbox is not configured', () => {
      mockIsSandboxConfigured.mockReturnValue(false);

      const result = executor.initialize('bad-token');

      expect(result).toBe(false);
      expect(mockGetSandboxConfig).not.toHaveBeenCalled();
    });

    it('should return false when getSandboxConfig returns null', () => {
      mockIsSandboxConfigured.mockReturnValue(true);
      mockGetSandboxConfig.mockReturnValue(null);

      const result = executor.initialize('token');

      expect(result).toBe(false);
    });

    it('should call isSandboxConfigured with undefined when no token provided', () => {
      mockIsSandboxConfigured.mockReturnValue(false);

      executor.initialize();

      expect(mockIsSandboxConfigured).toHaveBeenCalledWith(undefined);
    });

    it('should set config so isAvailable returns true after successful init', () => {
      mockIsSandboxConfigured.mockReturnValue(true);
      mockGetSandboxConfig.mockReturnValue({ oidcToken: 'abc' });

      executor.initialize('abc');

      expect(executor.isAvailable()).toBe(true);
    });

    it('should keep isAvailable false after failed init', () => {
      mockIsSandboxConfigured.mockReturnValue(false);

      executor.initialize();

      expect(executor.isAvailable()).toBe(false);
    });

    it('should handle empty string token', () => {
      mockIsSandboxConfigured.mockReturnValue(false);

      const result = executor.initialize('');

      expect(result).toBe(false);
      expect(mockIsSandboxConfigured).toHaveBeenCalledWith('');
    });
  });

  // ------------------------------------------
  // isAvailable()
  // ------------------------------------------

  describe('isAvailable', () => {
    it('should return false when not initialized', () => {
      expect(executor.isAvailable()).toBe(false);
    });

    it('should return true after successful initialization', () => {
      mockIsSandboxConfigured.mockReturnValue(true);
      mockGetSandboxConfig.mockReturnValue({ oidcToken: 'tk' });
      executor.initialize('tk');

      expect(executor.isAvailable()).toBe(true);
    });

    it('should return false after failed initialization', () => {
      mockIsSandboxConfigured.mockReturnValue(true);
      mockGetSandboxConfig.mockReturnValue(null);
      executor.initialize('tk');

      expect(executor.isAvailable()).toBe(false);
    });
  });

  // ------------------------------------------
  // execute()
  // ------------------------------------------

  describe('execute', () => {
    const files = [makeGeneratedFile()];
    const plan = makeProjectPlan();
    const intent = makeCodeIntent();

    it('should return error result when config is null (not initialized)', async () => {
      const result = await executor.execute(files, plan, intent);

      expect(result.success).toBe(false);
      expect(result.phase).toBe('install');
      expect(result.outputs).toEqual([]);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].file).toBe('system');
      expect(result.errors[0].message).toContain('Sandbox not configured');
      expect(result.errors[0].type).toBe('build');
      expect(result.errors[0].severity).toBe('error');
      expect(result.executionTime).toBe(0);
    });

    it('should not call executeSandbox when config is null', async () => {
      await executor.execute(files, plan, intent);

      expect(mockExecuteSandbox).not.toHaveBeenCalled();
    });

    it('should call executeSandbox with correct parameters for node runtime', async () => {
      mockIsSandboxConfigured.mockReturnValue(true);
      const config = { oidcToken: 'tk' };
      mockGetSandboxConfig.mockReturnValue(config);
      executor.initialize('tk');

      mockExecuteSandbox.mockResolvedValue(makeSandboxResult());

      await executor.execute(files, plan, intent);

      expect(mockExecuteSandbox).toHaveBeenCalledWith(config, {
        files: [{ path: 'src/index.ts', content: 'console.log("hello");' }],
        commands: expect.any(Array),
        runtime: 'node22',
        timeout: 300000,
        vcpus: 4,
      });
    });

    it('should use python3.13 runtime when intent specifies python', async () => {
      mockIsSandboxConfigured.mockReturnValue(true);
      mockGetSandboxConfig.mockReturnValue({ oidcToken: 'tk' });
      executor.initialize('tk');

      const pythonIntent = makeCodeIntent({
        technologies: {
          primary: 'Python',
          secondary: [],
          runtime: 'python',
          packageManager: 'pip',
        },
      });

      mockExecuteSandbox.mockResolvedValue(makeSandboxResult());

      await executor.execute(files, plan, pythonIntent);

      expect(mockExecuteSandbox).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ runtime: 'python3.13' })
      );
    });

    it('should use node22 runtime when intent specifies node', async () => {
      mockIsSandboxConfigured.mockReturnValue(true);
      mockGetSandboxConfig.mockReturnValue({ oidcToken: 'tk' });
      executor.initialize('tk');
      mockExecuteSandbox.mockResolvedValue(makeSandboxResult());

      await executor.execute(files, plan, intent);

      expect(mockExecuteSandbox).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ runtime: 'node22' })
      );
    });

    it('should convert GeneratedFile[] to sandbox file format (path + content only)', async () => {
      mockIsSandboxConfigured.mockReturnValue(true);
      mockGetSandboxConfig.mockReturnValue({ oidcToken: 'tk' });
      executor.initialize('tk');
      mockExecuteSandbox.mockResolvedValue(makeSandboxResult());

      const multiFiles = [
        makeGeneratedFile({ path: 'a.ts', content: 'aaa' }),
        makeGeneratedFile({ path: 'b.ts', content: 'bbb' }),
      ];

      await executor.execute(multiFiles, plan, intent);

      const callArgs = mockExecuteSandbox.mock.calls[0][1];
      expect(callArgs.files).toEqual([
        { path: 'a.ts', content: 'aaa' },
        { path: 'b.ts', content: 'bbb' },
      ]);
    });

    it('should call onStream callback with evaluating event', async () => {
      mockIsSandboxConfigured.mockReturnValue(true);
      mockGetSandboxConfig.mockReturnValue({ oidcToken: 'tk' });
      executor.initialize('tk');
      mockExecuteSandbox.mockResolvedValue(makeSandboxResult());

      const onStream = vi.fn();
      await executor.execute(files, plan, intent, onStream);

      expect(onStream).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'evaluating',
          message: expect.stringContaining('Testing in sandbox'),
          phase: 'Sandbox Execution',
          progress: 60,
          timestamp: expect.any(Number),
        })
      );
    });

    it('should not throw when onStream is undefined', async () => {
      mockIsSandboxConfigured.mockReturnValue(true);
      mockGetSandboxConfig.mockReturnValue({ oidcToken: 'tk' });
      executor.initialize('tk');
      mockExecuteSandbox.mockResolvedValue(makeSandboxResult());

      await expect(executor.execute(files, plan, intent)).resolves.not.toThrow();
    });

    it('should return success result with mapped outputs on success', async () => {
      mockIsSandboxConfigured.mockReturnValue(true);
      mockGetSandboxConfig.mockReturnValue({ oidcToken: 'tk' });
      executor.initialize('tk');

      mockExecuteSandbox.mockResolvedValue({
        success: true,
        outputs: [
          {
            command: 'npm install',
            exitCode: 0,
            stdout: 'added 10 packages',
            stderr: '',
            success: true,
          },
          {
            command: 'npm run build',
            exitCode: 0,
            stdout: 'Build complete',
            stderr: '',
            success: true,
          },
        ],
        executionTime: 3000,
      });

      const result = await executor.execute(files, plan, intent);

      expect(result.success).toBe(true);
      expect(result.outputs).toHaveLength(2);
      expect(result.outputs[0]).toEqual({
        command: 'npm install',
        stdout: 'added 10 packages',
        stderr: '',
        exitCode: 0,
      });
      expect(result.errors).toEqual([]);
      expect(result.executionTime).toBe(3000);
    });

    it('should return failure result with errors when sandbox fails', async () => {
      mockIsSandboxConfigured.mockReturnValue(true);
      mockGetSandboxConfig.mockReturnValue({ oidcToken: 'tk' });
      executor.initialize('tk');

      mockExecuteSandbox.mockResolvedValue({
        success: false,
        outputs: [
          {
            command: 'npm install',
            exitCode: 1,
            stdout: '',
            stderr: 'ENOENT: package.json not found',
            success: false,
          },
        ],
        executionTime: 1000,
      });

      const result = await executor.execute(files, plan, intent);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should catch executeSandbox errors and return error result', async () => {
      mockIsSandboxConfigured.mockReturnValue(true);
      mockGetSandboxConfig.mockReturnValue({ oidcToken: 'tk' });
      executor.initialize('tk');

      mockExecuteSandbox.mockRejectedValue(new Error('Connection refused'));

      const result = await executor.execute(files, plan, intent);

      expect(result.success).toBe(false);
      expect(result.phase).toBe('install');
      expect(result.outputs).toEqual([]);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe('Connection refused');
      expect(result.errors[0].type).toBe('runtime');
      expect(result.errors[0].severity).toBe('error');
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });

    it('should handle non-Error thrown objects', async () => {
      mockIsSandboxConfigured.mockReturnValue(true);
      mockGetSandboxConfig.mockReturnValue({ oidcToken: 'tk' });
      executor.initialize('tk');

      mockExecuteSandbox.mockRejectedValue('string error');

      const result = await executor.execute(files, plan, intent);

      expect(result.success).toBe(false);
      expect(result.errors[0].message).toBe('Sandbox execution failed');
    });

    it('should use plan buildSteps when provided', async () => {
      mockIsSandboxConfigured.mockReturnValue(true);
      mockGetSandboxConfig.mockReturnValue({ oidcToken: 'tk' });
      executor.initialize('tk');
      mockExecuteSandbox.mockResolvedValue(makeSandboxResult());

      const planWithSteps = makeProjectPlan({
        buildSteps: [
          { order: 2, command: 'npm run build', description: 'Build', failureAction: 'stop' },
          { order: 1, command: 'npm install', description: 'Install', failureAction: 'stop' },
          { order: 3, command: 'npm test', description: 'Test', failureAction: 'stop' },
        ],
      });

      await executor.execute(files, planWithSteps, intent);

      const callArgs = mockExecuteSandbox.mock.calls[0][1];
      expect(callArgs.commands).toEqual(['npm install', 'npm run build', 'npm test']);
    });

    it('should sort buildSteps by order', async () => {
      mockIsSandboxConfigured.mockReturnValue(true);
      mockGetSandboxConfig.mockReturnValue({ oidcToken: 'tk' });
      executor.initialize('tk');
      mockExecuteSandbox.mockResolvedValue(makeSandboxResult());

      const planWithSteps = makeProjectPlan({
        buildSteps: [
          { order: 3, command: 'cmd3', description: 'Third', failureAction: 'stop' },
          { order: 1, command: 'cmd1', description: 'First', failureAction: 'stop' },
          { order: 2, command: 'cmd2', description: 'Second', failureAction: 'stop' },
        ],
      });

      await executor.execute(files, planWithSteps, intent);

      const callArgs = mockExecuteSandbox.mock.calls[0][1];
      expect(callArgs.commands).toEqual(['cmd1', 'cmd2', 'cmd3']);
    });

    it('should generate default npm commands for TypeScript when no buildSteps', async () => {
      mockIsSandboxConfigured.mockReturnValue(true);
      mockGetSandboxConfig.mockReturnValue({ oidcToken: 'tk' });
      executor.initialize('tk');
      mockExecuteSandbox.mockResolvedValue(makeSandboxResult());

      const tsIntent = makeCodeIntent({
        technologies: {
          primary: 'TypeScript',
          secondary: [],
          runtime: 'node',
          packageManager: 'npm',
        },
      });

      await executor.execute(files, plan, tsIntent);

      const callArgs = mockExecuteSandbox.mock.calls[0][1];
      expect(callArgs.commands).toContain('npm install');
      expect(callArgs.commands).toContain('npx tsc --noEmit');
      expect(callArgs.commands).toContain('npm run build 2>/dev/null || echo "No build script"');
    });

    it('should generate default commands for plain JavaScript', async () => {
      mockIsSandboxConfigured.mockReturnValue(true);
      mockGetSandboxConfig.mockReturnValue({ oidcToken: 'tk' });
      executor.initialize('tk');
      mockExecuteSandbox.mockResolvedValue(makeSandboxResult());

      const jsIntent = makeCodeIntent({
        technologies: {
          primary: 'JavaScript',
          secondary: [],
          runtime: 'node',
          packageManager: 'npm',
        },
      });

      await executor.execute(files, plan, jsIntent);

      const callArgs = mockExecuteSandbox.mock.calls[0][1];
      expect(callArgs.commands).toContain('npm install');
      expect(callArgs.commands).not.toContain('npx tsc --noEmit');
    });

    it('should use yarn for packageManager yarn', async () => {
      mockIsSandboxConfigured.mockReturnValue(true);
      mockGetSandboxConfig.mockReturnValue({ oidcToken: 'tk' });
      executor.initialize('tk');
      mockExecuteSandbox.mockResolvedValue(makeSandboxResult());

      const yarnIntent = makeCodeIntent({
        technologies: {
          primary: 'JavaScript',
          secondary: [],
          runtime: 'node',
          packageManager: 'yarn',
        },
      });

      await executor.execute(files, plan, yarnIntent);

      const callArgs = mockExecuteSandbox.mock.calls[0][1];
      expect(callArgs.commands[0]).toBe('yarn');
    });

    it('should use pnpm install for packageManager pnpm', async () => {
      mockIsSandboxConfigured.mockReturnValue(true);
      mockGetSandboxConfig.mockReturnValue({ oidcToken: 'tk' });
      executor.initialize('tk');
      mockExecuteSandbox.mockResolvedValue(makeSandboxResult());

      const pnpmIntent = makeCodeIntent({
        technologies: {
          primary: 'JavaScript',
          secondary: [],
          runtime: 'node',
          packageManager: 'pnpm',
        },
      });

      await executor.execute(files, plan, pnpmIntent);

      const callArgs = mockExecuteSandbox.mock.calls[0][1];
      expect(callArgs.commands[0]).toBe('pnpm install');
    });

    it('should use bun install for packageManager bun', async () => {
      mockIsSandboxConfigured.mockReturnValue(true);
      mockGetSandboxConfig.mockReturnValue({ oidcToken: 'tk' });
      executor.initialize('tk');
      mockExecuteSandbox.mockResolvedValue(makeSandboxResult());

      const bunIntent = makeCodeIntent({
        technologies: {
          primary: 'JavaScript',
          secondary: [],
          runtime: 'node',
          packageManager: 'bun',
        },
      });

      await executor.execute(files, plan, bunIntent);

      const callArgs = mockExecuteSandbox.mock.calls[0][1];
      expect(callArgs.commands[0]).toBe('bun install');
    });

    it('should generate Python commands when runtime is python', async () => {
      mockIsSandboxConfigured.mockReturnValue(true);
      mockGetSandboxConfig.mockReturnValue({ oidcToken: 'tk' });
      executor.initialize('tk');
      mockExecuteSandbox.mockResolvedValue(makeSandboxResult());

      const pyIntent = makeCodeIntent({
        technologies: {
          primary: 'Python',
          secondary: [],
          runtime: 'python',
          packageManager: 'pip',
        },
      });

      await executor.execute(files, plan, pyIntent);

      const callArgs = mockExecuteSandbox.mock.calls[0][1];
      expect(callArgs.commands[0]).toContain('pip install');
      expect(callArgs.commands[1]).toContain('py_compile');
    });

    it('should handle empty files array', async () => {
      mockIsSandboxConfigured.mockReturnValue(true);
      mockGetSandboxConfig.mockReturnValue({ oidcToken: 'tk' });
      executor.initialize('tk');
      mockExecuteSandbox.mockResolvedValue(makeSandboxResult());

      const result = await executor.execute([], plan, intent);

      expect(result.success).toBe(true);
      const callArgs = mockExecuteSandbox.mock.calls[0][1];
      expect(callArgs.files).toEqual([]);
    });

    it('should set 5 minute timeout on sandbox execution', async () => {
      mockIsSandboxConfigured.mockReturnValue(true);
      mockGetSandboxConfig.mockReturnValue({ oidcToken: 'tk' });
      executor.initialize('tk');
      mockExecuteSandbox.mockResolvedValue(makeSandboxResult());

      await executor.execute(files, plan, intent);

      const callArgs = mockExecuteSandbox.mock.calls[0][1];
      expect(callArgs.timeout).toBe(5 * 60 * 1000);
    });

    it('should set vcpus to 4', async () => {
      mockIsSandboxConfigured.mockReturnValue(true);
      mockGetSandboxConfig.mockReturnValue({ oidcToken: 'tk' });
      executor.initialize('tk');
      mockExecuteSandbox.mockResolvedValue(makeSandboxResult());

      await executor.execute(files, plan, intent);

      const callArgs = mockExecuteSandbox.mock.calls[0][1];
      expect(callArgs.vcpus).toBe(4);
    });

    it('should include runtime info in onStream message', async () => {
      mockIsSandboxConfigured.mockReturnValue(true);
      mockGetSandboxConfig.mockReturnValue({ oidcToken: 'tk' });
      executor.initialize('tk');
      mockExecuteSandbox.mockResolvedValue(makeSandboxResult());

      const onStream = vi.fn();
      await executor.execute(files, plan, intent, onStream);

      expect(onStream.mock.calls[0][0].message).toContain('node22');
    });

    it('should include python runtime in onStream message for python intent', async () => {
      mockIsSandboxConfigured.mockReturnValue(true);
      mockGetSandboxConfig.mockReturnValue({ oidcToken: 'tk' });
      executor.initialize('tk');
      mockExecuteSandbox.mockResolvedValue(makeSandboxResult());

      const pyIntent = makeCodeIntent({
        technologies: {
          primary: 'Python',
          secondary: [],
          runtime: 'python',
          packageManager: 'pip',
        },
      });

      const onStream = vi.fn();
      await executor.execute(files, plan, pyIntent, onStream);

      expect(onStream.mock.calls[0][0].message).toContain('python3.13');
    });
  });

  // ------------------------------------------
  // execute() - determinePhase (private, tested through execute)
  // ------------------------------------------

  describe('execute - phase determination', () => {
    beforeEach(() => {
      mockIsSandboxConfigured.mockReturnValue(true);
      mockGetSandboxConfig.mockReturnValue({ oidcToken: 'tk' });
      executor.initialize('tk');
    });

    it('should determine phase as "install" when install command fails', async () => {
      mockExecuteSandbox.mockResolvedValue({
        success: false,
        outputs: [
          { command: 'npm install', exitCode: 1, stdout: '', stderr: 'err', success: false },
        ],
        executionTime: 1000,
      });

      const result = await executor.execute(
        [makeGeneratedFile()],
        makeProjectPlan(),
        makeCodeIntent()
      );

      expect(result.phase).toBe('install');
    });

    it('should determine phase as "build" when build command fails', async () => {
      mockExecuteSandbox.mockResolvedValue({
        success: false,
        outputs: [
          { command: 'npm install', exitCode: 0, stdout: '', stderr: '', success: true },
          {
            command: 'npm run build',
            exitCode: 1,
            stdout: '',
            stderr: 'Build error',
            success: false,
          },
        ],
        executionTime: 2000,
      });

      const result = await executor.execute(
        [makeGeneratedFile()],
        makeProjectPlan(),
        makeCodeIntent()
      );

      expect(result.phase).toBe('build');
    });

    it('should determine phase as "build" when tsc command fails', async () => {
      mockExecuteSandbox.mockResolvedValue({
        success: false,
        outputs: [
          { command: 'npm install', exitCode: 0, stdout: '', stderr: '', success: true },
          {
            command: 'npx tsc --noEmit',
            exitCode: 1,
            stdout: '',
            stderr: 'Type error',
            success: false,
          },
        ],
        executionTime: 2000,
      });

      const result = await executor.execute(
        [makeGeneratedFile()],
        makeProjectPlan(),
        makeCodeIntent()
      );

      expect(result.phase).toBe('build');
    });

    it('should determine phase as "test" when test command fails', async () => {
      mockExecuteSandbox.mockResolvedValue({
        success: false,
        outputs: [
          { command: 'npm install', exitCode: 0, stdout: '', stderr: '', success: true },
          { command: 'npm test', exitCode: 1, stdout: '', stderr: 'Test fail', success: false },
        ],
        executionTime: 3000,
      });

      const result = await executor.execute(
        [makeGeneratedFile()],
        makeProjectPlan(),
        makeCodeIntent()
      );

      expect(result.phase).toBe('test');
    });

    it('should determine phase as "run" when unknown command fails', async () => {
      mockExecuteSandbox.mockResolvedValue({
        success: false,
        outputs: [
          {
            command: 'some-other-cmd',
            exitCode: 1,
            stdout: '',
            stderr: 'Error',
            success: false,
          },
        ],
        executionTime: 1000,
      });

      const result = await executor.execute(
        [makeGeneratedFile()],
        makeProjectPlan(),
        makeCodeIntent()
      );

      expect(result.phase).toBe('run');
    });

    it('should determine phase as "run" when all commands succeed', async () => {
      mockExecuteSandbox.mockResolvedValue({
        success: true,
        outputs: [
          { command: 'npm install', exitCode: 0, stdout: 'ok', stderr: '', success: true },
          { command: 'npm run build', exitCode: 0, stdout: 'ok', stderr: '', success: true },
        ],
        executionTime: 2000,
      });

      const result = await executor.execute(
        [makeGeneratedFile()],
        makeProjectPlan(),
        makeCodeIntent()
      );

      expect(result.phase).toBe('run');
    });

    it('should determine phase correctly with empty outputs', async () => {
      mockExecuteSandbox.mockResolvedValue({
        success: true,
        outputs: [],
        executionTime: 100,
      });

      const result = await executor.execute(
        [makeGeneratedFile()],
        makeProjectPlan(),
        makeCodeIntent()
      );

      expect(result.phase).toBe('run');
    });
  });

  // ------------------------------------------
  // execute() - extractErrors (private, tested through execute)
  // ------------------------------------------

  describe('execute - error extraction', () => {
    beforeEach(() => {
      mockIsSandboxConfigured.mockReturnValue(true);
      mockGetSandboxConfig.mockReturnValue({ oidcToken: 'tk' });
      executor.initialize('tk');
    });

    it('should extract errors from stderr', async () => {
      mockExecuteSandbox.mockResolvedValue({
        success: false,
        outputs: [
          {
            command: 'npm install',
            exitCode: 1,
            stdout: '',
            stderr: 'ENOENT: package.json not found',
            success: false,
          },
        ],
        executionTime: 500,
      });

      const result = await executor.execute(
        [makeGeneratedFile()],
        makeProjectPlan(),
        makeCodeIntent()
      );

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('ENOENT');
      expect(result.errors[0].file).toBe('unknown');
      expect(result.errors[0].type).toBe('build');
      expect(result.errors[0].severity).toBe('error');
    });

    it('should extract errors from stdout when stderr is empty', async () => {
      mockExecuteSandbox.mockResolvedValue({
        success: false,
        outputs: [
          {
            command: 'npm run build',
            exitCode: 1,
            stdout: 'Error: Module not found',
            stderr: '',
            success: false,
          },
        ],
        executionTime: 500,
      });

      const result = await executor.execute(
        [makeGeneratedFile()],
        makeProjectPlan(),
        makeCodeIntent()
      );

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toContain('Module not found');
    });

    it('should skip outputs with no stderr and no stdout', async () => {
      mockExecuteSandbox.mockResolvedValue({
        success: false,
        outputs: [{ command: 'npm install', exitCode: 1, stdout: '', stderr: '', success: false }],
        executionTime: 500,
      });

      const result = await executor.execute(
        [makeGeneratedFile()],
        makeProjectPlan(),
        makeCodeIntent()
      );

      expect(result.errors).toEqual([]);
    });

    it('should truncate error messages to 500 characters', async () => {
      const longError = 'E'.repeat(1000);
      mockExecuteSandbox.mockResolvedValue({
        success: false,
        outputs: [
          {
            command: 'npm run build',
            exitCode: 1,
            stdout: '',
            stderr: longError,
            success: false,
          },
        ],
        executionTime: 500,
      });

      const result = await executor.execute(
        [makeGeneratedFile()],
        makeProjectPlan(),
        makeCodeIntent()
      );

      expect(result.errors[0].message.length).toBe(500);
    });

    it('should return empty errors array on success', async () => {
      mockExecuteSandbox.mockResolvedValue({
        success: true,
        outputs: [{ command: 'npm install', exitCode: 0, stdout: 'ok', stderr: '', success: true }],
        executionTime: 500,
      });

      const result = await executor.execute(
        [makeGeneratedFile()],
        makeProjectPlan(),
        makeCodeIntent()
      );

      expect(result.errors).toEqual([]);
    });

    it('should extract errors from multiple failed outputs', async () => {
      mockExecuteSandbox.mockResolvedValue({
        success: false,
        outputs: [
          {
            command: 'npm install',
            exitCode: 1,
            stdout: '',
            stderr: 'install error',
            success: false,
          },
          {
            command: 'npm run build',
            exitCode: 1,
            stdout: 'build error in stdout',
            stderr: 'build error in stderr',
            success: false,
          },
        ],
        executionTime: 1000,
      });

      const result = await executor.execute(
        [makeGeneratedFile()],
        makeProjectPlan(),
        makeCodeIntent()
      );

      expect(result.errors.length).toBe(2);
    });

    it('should prefer stderr over stdout when both exist in error extraction', async () => {
      mockExecuteSandbox.mockResolvedValue({
        success: false,
        outputs: [
          {
            command: 'npm run build',
            exitCode: 1,
            stdout: 'stdout content',
            stderr: 'stderr content',
            success: false,
          },
        ],
        executionTime: 500,
      });

      const result = await executor.execute(
        [makeGeneratedFile()],
        makeProjectPlan(),
        makeCodeIntent()
      );

      expect(result.errors[0].message).toBe('stderr content');
    });
  });

  // ------------------------------------------
  // syntaxCheck()
  // ------------------------------------------

  describe('syntaxCheck', () => {
    const files = [makeGeneratedFile()];

    it('should return error result when config is null', async () => {
      const result = await executor.syntaxCheck(files, makeCodeIntent());

      expect(result.success).toBe(false);
      expect(result.phase).toBe('build');
      expect(result.outputs).toEqual([]);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe('Sandbox not configured');
      expect(result.executionTime).toBe(0);
    });

    it('should use tsc --noEmit for TypeScript files', async () => {
      mockIsSandboxConfigured.mockReturnValue(true);
      mockGetSandboxConfig.mockReturnValue({ oidcToken: 'tk' });
      executor.initialize('tk');
      mockExecuteSandbox.mockResolvedValue(makeSandboxResult());

      const tsIntent = makeCodeIntent({
        technologies: {
          primary: 'TypeScript',
          secondary: [],
          runtime: 'node',
          packageManager: 'npm',
        },
      });

      await executor.syntaxCheck(files, tsIntent);

      const callArgs = mockExecuteSandbox.mock.calls[0][1];
      expect(callArgs.commands).toContain('npm install --ignore-scripts');
      expect(callArgs.commands).toContain('npx tsc --noEmit');
      expect(callArgs.runtime).toBe('node22');
    });

    it('should use py_compile for Python files', async () => {
      mockIsSandboxConfigured.mockReturnValue(true);
      mockGetSandboxConfig.mockReturnValue({ oidcToken: 'tk' });
      executor.initialize('tk');
      mockExecuteSandbox.mockResolvedValue(makeSandboxResult());

      const pyIntent = makeCodeIntent({
        technologies: {
          primary: 'Python',
          secondary: [],
          runtime: 'python',
          packageManager: 'pip',
        },
      });

      await executor.syntaxCheck(files, pyIntent);

      const callArgs = mockExecuteSandbox.mock.calls[0][1];
      expect(callArgs.commands[0]).toContain('py_compile');
      expect(callArgs.runtime).toBe('python3.13');
    });

    it('should use node --check for plain JavaScript', async () => {
      mockIsSandboxConfigured.mockReturnValue(true);
      mockGetSandboxConfig.mockReturnValue({ oidcToken: 'tk' });
      executor.initialize('tk');
      mockExecuteSandbox.mockResolvedValue(makeSandboxResult());

      const jsIntent = makeCodeIntent({
        technologies: {
          primary: 'JavaScript',
          secondary: [],
          runtime: 'node',
          packageManager: 'npm',
        },
      });

      await executor.syntaxCheck(files, jsIntent);

      const callArgs = mockExecuteSandbox.mock.calls[0][1];
      expect(callArgs.commands).toContain('npm install --ignore-scripts');
      expect(callArgs.commands[1]).toContain('node --check');
    });

    it('should use 2 minute timeout for syntax check', async () => {
      mockIsSandboxConfigured.mockReturnValue(true);
      mockGetSandboxConfig.mockReturnValue({ oidcToken: 'tk' });
      executor.initialize('tk');
      mockExecuteSandbox.mockResolvedValue(makeSandboxResult());

      await executor.syntaxCheck(files, makeCodeIntent());

      const callArgs = mockExecuteSandbox.mock.calls[0][1];
      expect(callArgs.timeout).toBe(2 * 60 * 1000);
    });

    it('should use 2 vcpus for syntax check', async () => {
      mockIsSandboxConfigured.mockReturnValue(true);
      mockGetSandboxConfig.mockReturnValue({ oidcToken: 'tk' });
      executor.initialize('tk');
      mockExecuteSandbox.mockResolvedValue(makeSandboxResult());

      await executor.syntaxCheck(files, makeCodeIntent());

      const callArgs = mockExecuteSandbox.mock.calls[0][1];
      expect(callArgs.vcpus).toBe(2);
    });

    it('should return success result on successful syntax check', async () => {
      mockIsSandboxConfigured.mockReturnValue(true);
      mockGetSandboxConfig.mockReturnValue({ oidcToken: 'tk' });
      executor.initialize('tk');

      mockExecuteSandbox.mockResolvedValue({
        success: true,
        outputs: [
          {
            command: 'npx tsc --noEmit',
            exitCode: 0,
            stdout: 'No errors found',
            stderr: '',
            success: true,
          },
        ],
        executionTime: 2000,
      });

      const result = await executor.syntaxCheck(files, makeCodeIntent());

      expect(result.success).toBe(true);
      expect(result.phase).toBe('build');
      expect(result.errors).toEqual([]);
      expect(result.executionTime).toBe(2000);
    });

    it('should return failure result with errors on syntax check failure', async () => {
      mockIsSandboxConfigured.mockReturnValue(true);
      mockGetSandboxConfig.mockReturnValue({ oidcToken: 'tk' });
      executor.initialize('tk');

      mockExecuteSandbox.mockResolvedValue({
        success: false,
        outputs: [
          {
            command: 'npx tsc --noEmit',
            exitCode: 1,
            stdout: '',
            stderr: 'error TS2304: Cannot find name "foo"',
            success: false,
          },
        ],
        executionTime: 1500,
      });

      const result = await executor.syntaxCheck(files, makeCodeIntent());

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should catch thrown errors from executeSandbox in syntaxCheck', async () => {
      mockIsSandboxConfigured.mockReturnValue(true);
      mockGetSandboxConfig.mockReturnValue({ oidcToken: 'tk' });
      executor.initialize('tk');

      mockExecuteSandbox.mockRejectedValue(new Error('Timeout'));

      const result = await executor.syntaxCheck(files, makeCodeIntent());

      expect(result.success).toBe(false);
      expect(result.phase).toBe('build');
      expect(result.outputs).toEqual([]);
      expect(result.errors[0].message).toContain('Timeout');
      expect(result.errors[0].type).toBe('build');
      expect(result.executionTime).toBe(0);
    });

    it('should convert non-Error thrown values to string in syntaxCheck', async () => {
      mockIsSandboxConfigured.mockReturnValue(true);
      mockGetSandboxConfig.mockReturnValue({ oidcToken: 'tk' });
      executor.initialize('tk');

      mockExecuteSandbox.mockRejectedValue(42);

      const result = await executor.syntaxCheck(files, makeCodeIntent());

      expect(result.errors[0].message).toBe('42');
    });

    it('should map output format correctly', async () => {
      mockIsSandboxConfigured.mockReturnValue(true);
      mockGetSandboxConfig.mockReturnValue({ oidcToken: 'tk' });
      executor.initialize('tk');

      mockExecuteSandbox.mockResolvedValue({
        success: true,
        outputs: [
          {
            command: 'npm install --ignore-scripts',
            exitCode: 0,
            stdout: 'installed',
            stderr: 'warnings here',
            success: true,
          },
        ],
        executionTime: 1000,
      });

      const result = await executor.syntaxCheck(files, makeCodeIntent());

      expect(result.outputs[0]).toEqual({
        command: 'npm install --ignore-scripts',
        stdout: 'installed',
        stderr: 'warnings here',
        exitCode: 0,
      });
    });

    it('should detect typescript case-insensitively', async () => {
      mockIsSandboxConfigured.mockReturnValue(true);
      mockGetSandboxConfig.mockReturnValue({ oidcToken: 'tk' });
      executor.initialize('tk');
      mockExecuteSandbox.mockResolvedValue(makeSandboxResult());

      const tsIntent = makeCodeIntent({
        technologies: {
          primary: 'typescript',
          secondary: [],
          runtime: 'node',
          packageManager: 'npm',
        },
      });

      await executor.syntaxCheck(files, tsIntent);

      const callArgs = mockExecuteSandbox.mock.calls[0][1];
      expect(callArgs.commands).toContain('npx tsc --noEmit');
    });

    it('should handle empty files array in syntaxCheck', async () => {
      mockIsSandboxConfigured.mockReturnValue(true);
      mockGetSandboxConfig.mockReturnValue({ oidcToken: 'tk' });
      executor.initialize('tk');
      mockExecuteSandbox.mockResolvedValue(makeSandboxResult());

      const result = await executor.syntaxCheck([], makeCodeIntent());

      expect(result.success).toBe(true);
      const callArgs = mockExecuteSandbox.mock.calls[0][1];
      expect(callArgs.files).toEqual([]);
    });
  });

  // ------------------------------------------
  // buildCommands (private, tested through execute)
  // ------------------------------------------

  describe('buildCommands via execute', () => {
    beforeEach(() => {
      mockIsSandboxConfigured.mockReturnValue(true);
      mockGetSandboxConfig.mockReturnValue({ oidcToken: 'tk' });
      executor.initialize('tk');
      mockExecuteSandbox.mockResolvedValue(makeSandboxResult());
    });

    it('should not include tsc for non-TypeScript projects', async () => {
      const jsIntent = makeCodeIntent({
        technologies: {
          primary: 'JavaScript',
          secondary: [],
          runtime: 'node',
          packageManager: 'npm',
        },
      });

      await executor.execute([makeGeneratedFile()], makeProjectPlan(), jsIntent);

      const callArgs = mockExecuteSandbox.mock.calls[0][1];
      expect(callArgs.commands).not.toContain('npx tsc --noEmit');
      expect(callArgs.commands).toContain('npm install');
      expect(callArgs.commands).toContain('npm run build 2>/dev/null || echo "No build script"');
    });

    it('should include tsc for TypeScript projects', async () => {
      const tsIntent = makeCodeIntent({
        technologies: {
          primary: 'TypeScript',
          secondary: [],
          runtime: 'node',
          packageManager: 'npm',
        },
      });

      await executor.execute([makeGeneratedFile()], makeProjectPlan(), tsIntent);

      const callArgs = mockExecuteSandbox.mock.calls[0][1];
      expect(callArgs.commands).toContain('npx tsc --noEmit');
    });

    it('should use pip install for Python projects', async () => {
      const pyIntent = makeCodeIntent({
        technologies: {
          primary: 'Python',
          secondary: [],
          runtime: 'python',
          packageManager: 'pip',
        },
      });

      await executor.execute([makeGeneratedFile()], makeProjectPlan(), pyIntent);

      const callArgs = mockExecuteSandbox.mock.calls[0][1];
      expect(callArgs.commands[0]).toContain('pip install');
      expect(callArgs.commands[1]).toContain('py_compile');
    });

    it('should always include build command at end for node projects', async () => {
      const jsIntent = makeCodeIntent({
        technologies: {
          primary: 'JavaScript',
          secondary: [],
          runtime: 'node',
          packageManager: 'npm',
        },
      });

      await executor.execute([makeGeneratedFile()], makeProjectPlan(), jsIntent);

      const callArgs = mockExecuteSandbox.mock.calls[0][1];
      const lastCmd = callArgs.commands[callArgs.commands.length - 1];
      expect(lastCmd).toBe('npm run build 2>/dev/null || echo "No build script"');
    });

    it('should prioritize buildSteps over default commands', async () => {
      const planWithSteps = makeProjectPlan({
        buildSteps: [
          { order: 1, command: 'custom-install', description: 'Custom', failureAction: 'stop' },
        ],
      });

      await executor.execute([makeGeneratedFile()], planWithSteps, makeCodeIntent());

      const callArgs = mockExecuteSandbox.mock.calls[0][1];
      expect(callArgs.commands).toEqual(['custom-install']);
    });

    it('should handle buildSteps with single step', async () => {
      const planWithSteps = makeProjectPlan({
        buildSteps: [
          { order: 1, command: 'make build', description: 'Build', failureAction: 'stop' },
        ],
      });

      await executor.execute([makeGeneratedFile()], planWithSteps, makeCodeIntent());

      const callArgs = mockExecuteSandbox.mock.calls[0][1];
      expect(callArgs.commands).toEqual(['make build']);
    });
  });

  // ------------------------------------------
  // sandboxExecutor (exported singleton)
  // ------------------------------------------

  describe('sandboxExecutor singleton', () => {
    it('should be an instance of SandboxExecutor', () => {
      expect(sandboxExecutor).toBeInstanceOf(SandboxExecutor);
    });

    it('should not be available by default', () => {
      expect(sandboxExecutor.isAvailable()).toBe(false);
    });

    it('should have initialize method', () => {
      expect(typeof sandboxExecutor.initialize).toBe('function');
    });

    it('should have execute method', () => {
      expect(typeof sandboxExecutor.execute).toBe('function');
    });

    it('should have syntaxCheck method', () => {
      expect(typeof sandboxExecutor.syntaxCheck).toBe('function');
    });

    it('should have isAvailable method', () => {
      expect(typeof sandboxExecutor.isAvailable).toBe('function');
    });
  });

  // ------------------------------------------
  // Edge cases & integration-like scenarios
  // ------------------------------------------

  describe('edge cases', () => {
    beforeEach(() => {
      mockIsSandboxConfigured.mockReturnValue(true);
      mockGetSandboxConfig.mockReturnValue({ oidcToken: 'tk' });
      executor.initialize('tk');
    });

    it('should handle sandbox returning no outputs', async () => {
      mockExecuteSandbox.mockResolvedValue({
        success: true,
        outputs: [],
        executionTime: 100,
      });

      const result = await executor.execute(
        [makeGeneratedFile()],
        makeProjectPlan(),
        makeCodeIntent()
      );

      expect(result.success).toBe(true);
      expect(result.outputs).toEqual([]);
    });

    it('should handle files with empty content', async () => {
      mockExecuteSandbox.mockResolvedValue(makeSandboxResult());

      const emptyFile = makeGeneratedFile({ content: '' });
      const result = await executor.execute([emptyFile], makeProjectPlan(), makeCodeIntent());

      expect(result.success).toBe(true);
      const callArgs = mockExecuteSandbox.mock.calls[0][1];
      expect(callArgs.files[0].content).toBe('');
    });

    it('should handle files with very long content', async () => {
      mockExecuteSandbox.mockResolvedValue(makeSandboxResult());

      const bigContent = 'x'.repeat(100000);
      const bigFile = makeGeneratedFile({ content: bigContent });
      const result = await executor.execute([bigFile], makeProjectPlan(), makeCodeIntent());

      expect(result.success).toBe(true);
    });

    it('should handle many files', async () => {
      mockExecuteSandbox.mockResolvedValue(makeSandboxResult());

      const manyFiles = Array.from({ length: 50 }, (_, i) =>
        makeGeneratedFile({ path: `src/file-${i}.ts`, content: `// file ${i}` })
      );

      const result = await executor.execute(manyFiles, makeProjectPlan(), makeCodeIntent());

      expect(result.success).toBe(true);
      const callArgs = mockExecuteSandbox.mock.calls[0][1];
      expect(callArgs.files).toHaveLength(50);
    });

    it('should handle technology primary with mixed case containing typescript', async () => {
      mockExecuteSandbox.mockResolvedValue(makeSandboxResult());

      const mixedIntent = makeCodeIntent({
        technologies: {
          primary: 'TypeScript/React',
          secondary: [],
          runtime: 'node',
          packageManager: 'npm',
        },
      });

      await executor.execute([makeGeneratedFile()], makeProjectPlan(), mixedIntent);

      const callArgs = mockExecuteSandbox.mock.calls[0][1];
      expect(callArgs.commands).toContain('npx tsc --noEmit');
    });

    it('should handle executionTime from sandbox result', async () => {
      mockExecuteSandbox.mockResolvedValue({
        success: true,
        outputs: [],
        executionTime: 12345,
      });

      const result = await executor.execute(
        [makeGeneratedFile()],
        makeProjectPlan(),
        makeCodeIntent()
      );

      expect(result.executionTime).toBe(12345);
    });

    it('should handle concurrent calls to different executor instances', async () => {
      const executor2 = new SandboxExecutor();
      mockGetSandboxConfig.mockReturnValue({ oidcToken: 'tk2' });
      executor2.initialize('tk2');

      mockExecuteSandbox.mockResolvedValue(makeSandboxResult());

      const [result1, result2] = await Promise.all([
        executor.execute([makeGeneratedFile()], makeProjectPlan(), makeCodeIntent()),
        executor2.execute([makeGeneratedFile()], makeProjectPlan(), makeCodeIntent()),
      ]);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(mockExecuteSandbox).toHaveBeenCalledTimes(2);
    });

    it('should not mutate the original files array', async () => {
      mockExecuteSandbox.mockResolvedValue(makeSandboxResult());

      const originalFiles = [makeGeneratedFile()];
      const filesCopy = [...originalFiles];

      await executor.execute(originalFiles, makeProjectPlan(), makeCodeIntent());

      expect(originalFiles).toEqual(filesCopy);
    });

    it('should calculate executionTime correctly on error', async () => {
      mockExecuteSandbox.mockImplementation(
        () => new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10))
      );

      const result = await executor.execute(
        [makeGeneratedFile()],
        makeProjectPlan(),
        makeCodeIntent()
      );

      expect(result.success).toBe(false);
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });
  });
});
