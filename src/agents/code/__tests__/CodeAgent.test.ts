// @ts-nocheck - Test file with extensive mocking
/**
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all brain and executor modules
const mockAnalyze = vi.fn();
const mockPlan = vi.fn();
const mockGenerateAll = vi.fn();
const mockParseErrors = vi.fn();
const mockAnalyzeAllErrors = vi.fn();
const mockShouldReplan = vi.fn();
const mockApplyFix = vi.fn();
const mockSandboxIsAvailable = vi.fn();
const mockSandboxInitialize = vi.fn();
const mockSandboxExecute = vi.fn();
const mockGitHubIsAvailable = vi.fn();
const mockGitHubSuggestRepoName = vi.fn();
const mockGitHubPush = vi.fn();

vi.mock('../brain/IntentAnalyzer', () => ({
  codeIntentAnalyzer: { analyze: (...args: unknown[]) => mockAnalyze(...args) },
}));

vi.mock('../brain/ProjectPlanner', () => ({
  projectPlanner: { plan: (...args: unknown[]) => mockPlan(...args) },
}));

vi.mock('../brain/CodeGenerator', () => ({
  codeGenerator: { generateAll: (...args: unknown[]) => mockGenerateAll(...args) },
}));

vi.mock('../brain/ErrorAnalyzer', () => ({
  errorAnalyzer: {
    parseErrors: (...args: unknown[]) => mockParseErrors(...args),
    analyzeAllErrors: (...args: unknown[]) => mockAnalyzeAllErrors(...args),
    shouldReplan: (...args: unknown[]) => mockShouldReplan(...args),
    applyFix: (...args: unknown[]) => mockApplyFix(...args),
  },
}));

vi.mock('../executors/SandboxExecutor', () => ({
  sandboxExecutor: {
    isAvailable: () => mockSandboxIsAvailable(),
    initialize: () => mockSandboxInitialize(),
    execute: (...args: unknown[]) => mockSandboxExecute(...args),
  },
}));

vi.mock('../executors/GitHubExecutor', () => ({
  githubExecutor: {
    isAvailable: () => mockGitHubIsAvailable(),
    suggestRepoName: (...args: unknown[]) => mockGitHubSuggestRepoName(...args),
    push: (...args: unknown[]) => mockGitHubPush(...args),
  },
}));

import { CodeAgent, codeAgent } from '../CodeAgent';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockIntent() {
  return {
    refinedDescription: 'A todo API',
    projectType: 'api',
    complexity: 'medium',
    estimatedFiles: 5,
    technologies: {
      primary: 'TypeScript',
      secondary: ['Express'],
      packageManager: 'npm',
      runtime: 'node',
    },
    requirements: {
      functional: ['CRUD'],
      technical: ['REST'],
      constraints: [],
    },
  };
}

function createMockPlan() {
  return {
    id: 'plan_123',
    name: 'todo-api',
    description: 'A todo API',
    architecture: { pattern: 'MVC', layers: [], rationale: 'Simple' },
    fileTree: [
      {
        path: 'package.json',
        purpose: 'Config',
        dependencies: [],
        priority: 1,
        estimatedLines: 30,
        isConfig: true,
      },
      { path: 'src/index.ts', purpose: 'Entry', dependencies: [], priority: 2, estimatedLines: 50 },
    ],
    dependencies: { production: {}, development: {} },
    buildSteps: [],
    testStrategy: { approach: 'Unit', testFiles: [] },
    risks: [],
    taskBreakdown: [{ id: 't1', title: 'Task 1', description: '', status: 'pending', files: [] }],
  };
}

function createMockFiles() {
  return [
    {
      path: 'package.json',
      content: '{}',
      language: 'json',
      purpose: 'Config',
      linesOfCode: 10,
      generatedAt: Date.now(),
      version: 1,
    },
    {
      path: 'src/index.ts',
      content: 'console.log("hi")',
      language: 'typescript',
      purpose: 'Entry',
      linesOfCode: 1,
      generatedAt: Date.now(),
      version: 1,
    },
  ];
}

const noopStream = vi.fn();

function setupSuccessfulFlow() {
  mockAnalyze.mockResolvedValue(createMockIntent());
  mockPlan.mockResolvedValue(createMockPlan());
  mockGenerateAll.mockResolvedValue(createMockFiles());
  mockSandboxIsAvailable.mockReturnValue(false);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CodeAgent', () => {
  let agent: CodeAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    agent = new CodeAgent();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // =========================================================================
  // Basic properties
  // =========================================================================

  describe('basic properties', () => {
    it('should have name "CodeAgent"', () => {
      expect(agent.name).toBe('CodeAgent');
    });

    it('should have a description', () => {
      expect(agent.description).toBeTruthy();
    });

    it('should have version', () => {
      expect(agent.version).toBe('1.0.0');
    });
  });

  // =========================================================================
  // canHandle
  // =========================================================================

  describe('canHandle', () => {
    it('should return true for valid input', () => {
      expect(agent.canHandle({ request: 'Build a todo app' })).toBe(true);
    });

    it('should return false for null', () => {
      expect(agent.canHandle(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(agent.canHandle(undefined)).toBe(false);
    });

    it('should return false for string', () => {
      expect(agent.canHandle('not an object')).toBe(false);
    });

    it('should return false for number', () => {
      expect(agent.canHandle(42)).toBe(false);
    });

    it('should return false when request is missing', () => {
      expect(agent.canHandle({})).toBe(false);
    });

    it('should return false when request is not a string', () => {
      expect(agent.canHandle({ request: 123 })).toBe(false);
    });

    it('should return false when request is empty string', () => {
      expect(agent.canHandle({ request: '' })).toBe(false);
    });

    it('should return true with options', () => {
      expect(agent.canHandle({ request: 'Build app', options: { pushToGitHub: true } })).toBe(true);
    });
  });

  // =========================================================================
  // execute — success path (no sandbox)
  // =========================================================================

  describe('execute - success without sandbox', () => {
    beforeEach(() => {
      setupSuccessfulFlow();
    });

    it('should return success result', async () => {
      const result = await agent.execute({ request: 'Build todo app' }, {}, noopStream);
      expect(result.success).toBe(true);
    });

    it('should call intent analyzer', async () => {
      await agent.execute({ request: 'Build todo app' }, {}, noopStream);
      expect(mockAnalyze).toHaveBeenCalledWith('Build todo app', {});
    });

    it('should call project planner', async () => {
      await agent.execute({ request: 'Build todo app' }, {}, noopStream);
      expect(mockPlan).toHaveBeenCalled();
    });

    it('should call code generator', async () => {
      await agent.execute({ request: 'Build todo app' }, {}, noopStream);
      expect(mockGenerateAll).toHaveBeenCalled();
    });

    it('should include project name in output', async () => {
      const result = await agent.execute({ request: 'Build todo app' }, {}, noopStream);
      expect(result.data?.projectName).toBe('todo-api');
    });

    it('should include files in output', async () => {
      const result = await agent.execute({ request: 'Build todo app' }, {}, noopStream);
      expect(result.data?.files).toHaveLength(2);
    });

    it('should include summary in output', async () => {
      const result = await agent.execute({ request: 'Build todo app' }, {}, noopStream);
      expect(result.data?.summary.totalFiles).toBe(2);
      expect(result.data?.summary.architecture).toBe('MVC');
    });

    it('should include next steps', async () => {
      const result = await agent.execute({ request: 'Build todo app' }, {}, noopStream);
      expect(result.data?.nextSteps.length).toBeGreaterThan(0);
    });

    it('should include metadata', async () => {
      const result = await agent.execute({ request: 'Build todo app' }, {}, noopStream);
      expect(result.data?.metadata).toBeDefined();
      expect(result.data?.metadata.confidenceScore).toBeGreaterThan(0);
    });

    it('should emit stream events', async () => {
      await agent.execute({ request: 'Build todo app' }, {}, noopStream);
      expect(noopStream).toHaveBeenCalled();

      // Check first call is thinking about analysis
      const firstCall = noopStream.mock.calls[0][0];
      expect(firstCall.type).toBe('thinking');
      expect(firstCall.phase).toBe('Intent Analysis');
    });

    it('should emit complete event last', async () => {
      await agent.execute({ request: 'Build todo app' }, {}, noopStream);
      const lastCall = noopStream.mock.calls[noopStream.mock.calls.length - 1][0];
      expect(lastCall.type).toBe('complete');
      expect(lastCall.progress).toBe(100);
    });
  });

  // =========================================================================
  // execute — with sandbox testing
  // =========================================================================

  describe('execute - with sandbox', () => {
    it('should test in sandbox when available and return success', async () => {
      setupSuccessfulFlow();
      mockSandboxIsAvailable.mockReturnValue(true);
      mockSandboxExecute.mockResolvedValue({
        success: true,
        phase: 'build',
        outputs: [],
        errors: [],
        executionTime: 100,
      });

      const result = await agent.execute({ request: 'Build app' }, {}, noopStream);
      expect(result.success).toBe(true);
      expect(mockSandboxExecute).toHaveBeenCalled();
    });

    it('should attempt error fix on sandbox failure', async () => {
      setupSuccessfulFlow();
      mockSandboxIsAvailable.mockReturnValue(true);
      mockSandboxExecute
        .mockResolvedValueOnce({
          success: false,
          phase: 'build',
          outputs: [],
          errors: [{ message: 'Type error', file: 'src/index.ts' }],
          executionTime: 100,
        })
        .mockResolvedValueOnce({
          success: true,
          phase: 'build',
          outputs: [],
          errors: [],
          executionTime: 50,
        });

      mockParseErrors.mockReturnValue([
        { message: 'Type error', file: 'src/index.ts', type: 'typescript', severity: 'error' },
      ]);
      mockAnalyzeAllErrors.mockResolvedValue([
        {
          error: { message: 'Type error' },
          confidence: 'high',
          suggestedFix: { file: 'src/index.ts', content: 'fixed code' },
        },
      ]);
      mockShouldReplan.mockReturnValue(false);
      mockApplyFix.mockReturnValue({
        path: 'src/index.ts',
        content: 'fixed code',
        language: 'typescript',
        purpose: 'Entry',
        linesOfCode: 1,
        generatedAt: Date.now(),
        version: 2,
      });

      const result = await agent.execute({ request: 'Build app' }, {}, noopStream);
      expect(result.success).toBe(true);
      expect(mockApplyFix).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // execute — GitHub push
  // =========================================================================

  describe('execute - GitHub push', () => {
    beforeEach(() => {
      setupSuccessfulFlow();
    });

    it('should push to GitHub when requested and available', async () => {
      mockGitHubIsAvailable.mockReturnValue(true);
      mockGitHubSuggestRepoName.mockResolvedValue('todo-api');
      mockGitHubPush.mockResolvedValue({
        success: true,
        repoUrl: 'https://github.com/user/todo-api',
        commitSha: 'abc123',
      });

      const result = await agent.execute(
        { request: 'Build app', options: { pushToGitHub: true } },
        {},
        noopStream
      );

      expect(result.data?.github?.pushed).toBe(true);
      expect(result.data?.github?.repoUrl).toContain('github.com');
    });

    it('should use custom repo name when provided', async () => {
      mockGitHubIsAvailable.mockReturnValue(true);
      mockGitHubPush.mockResolvedValue({
        success: true,
        repoUrl: 'https://github.com/user/my-repo',
      });

      await agent.execute(
        { request: 'Build app', options: { pushToGitHub: true, repoName: 'my-repo' } },
        {},
        noopStream
      );

      const pushCall = mockGitHubPush.mock.calls[0];
      expect(pushCall[2].repoName).toBe('my-repo');
    });

    it('should handle GitHub not available', async () => {
      mockGitHubIsAvailable.mockReturnValue(false);

      const result = await agent.execute(
        { request: 'Build app', options: { pushToGitHub: true } },
        {},
        noopStream
      );

      expect(result.data?.github?.pushed).toBe(false);
      expect(result.data?.github?.error).toContain('not connected');
    });

    it('should not push when not requested', async () => {
      const result = await agent.execute({ request: 'Build app' }, {}, noopStream);
      expect(result.data?.github).toBeUndefined();
      expect(mockGitHubPush).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // execute — error handling
  // =========================================================================

  describe('execute - error handling', () => {
    it('should return failure on intent analysis error', async () => {
      mockAnalyze.mockRejectedValue(new Error('Analysis failed'));

      const result = await agent.execute({ request: 'Build app' }, {}, noopStream);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Analysis failed');
    });

    it('should return failure on planning error', async () => {
      mockAnalyze.mockResolvedValue(createMockIntent());
      mockPlan.mockRejectedValue(new Error('Planning failed'));

      const result = await agent.execute({ request: 'Build app' }, {}, noopStream);
      expect(result.success).toBe(false);
    });

    it('should emit error stream event on failure', async () => {
      mockAnalyze.mockRejectedValue(new Error('Crash'));

      await agent.execute({ request: 'Build app' }, {}, noopStream);

      const errorEvent = noopStream.mock.calls.find((c) => c[0].type === 'error');
      expect(errorEvent).toBeDefined();
    });
  });

  // =========================================================================
  // Next steps generation
  // =========================================================================

  describe('next steps', () => {
    it('should suggest viewing repo when GitHub pushed', async () => {
      setupSuccessfulFlow();
      mockGitHubIsAvailable.mockReturnValue(true);
      mockGitHubPush.mockResolvedValue({
        success: true,
        repoUrl: 'https://github.com/user/app',
        commitSha: 'abc',
      });

      const result = await agent.execute(
        { request: 'Build app', options: { pushToGitHub: true } },
        {},
        noopStream
      );

      const steps = result.data?.nextSteps || [];
      expect(steps.some((s) => s.includes('github.com'))).toBe(true);
    });

    it('should suggest copying files when no GitHub push', async () => {
      setupSuccessfulFlow();
      const result = await agent.execute({ request: 'Build app' }, {}, noopStream);

      const steps = result.data?.nextSteps || [];
      expect(steps.some((s) => s.includes('Copy'))).toBe(true);
    });

    it('should suggest npm run dev on build success', async () => {
      setupSuccessfulFlow();
      const result = await agent.execute({ request: 'Build app' }, {}, noopStream);

      const steps = result.data?.nextSteps || [];
      expect(steps.some((s) => s.includes('npm run dev'))).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

describe('codeAgent singleton', () => {
  it('should be an instance of CodeAgent', () => {
    expect(codeAgent).toBeInstanceOf(CodeAgent);
  });
});
