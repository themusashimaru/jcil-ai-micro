// @ts-nocheck - Test file with extensive mocking
/** @vitest-environment node */

/**
 * COMPREHENSIVE TESTS FOR CodeAgentV2
 *
 * Tests:
 * 1.  Constructor / instantiation / class properties
 * 2.  canHandle — valid and invalid inputs
 * 3.  execute — mode routing (generate, analyze, review, fix, test, document, default)
 * 4.  executeGenerate — full pipeline phases
 * 5.  executeGenerate — options flags toggling phases on/off
 * 6.  executeAnalyze — success and failure paths
 * 7.  executeReview — delegates to tool orchestrator
 * 8.  executeFix / executeTest / executeDocument — stub modes return failure
 * 9.  Error handling — top-level catch, emit error event
 * 10. Heartbeat start/stop behaviour
 * 11. Memory system integration
 * 12. GitHub push — available vs unavailable
 * 13. generateNextSteps — various scenarios
 * 14. Sandbox build loop — success on first try, success after fix, no sandbox
 * 15. Security auto-fix when vulnerabilities found
 * 16. Stream event emissions at each phase
 * 17. Singleton export (codeAgentV2)
 * 18. Result metadata structure
 * 19. Edge cases
 * 20. Multiple executions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================================================
// HOISTED MOCKS — vi.hoisted runs before vi.mock factories
// ============================================================================

const {
  mockIntentAnalyzer,
  mockProjectPlanner,
  mockCodeGenerator,
  mockReasoner,
  mockCodebaseAnalyzer,
  mockSecurityScanner,
  mockPerformanceAnalyzer,
  mockTestGenerator,
  mockAutoFixer,
  mockDocGenerator,
  mockMemorySystem,
  mockToolOrchestrator,
  mockSandboxExecutor,
  mockGithubExecutor,
} = vi.hoisted(() => ({
  mockIntentAnalyzer: { analyze: vi.fn() },
  mockProjectPlanner: { plan: vi.fn() },
  mockCodeGenerator: { generateAll: vi.fn() },
  mockReasoner: { reason: vi.fn(), reflect: vi.fn() },
  mockCodebaseAnalyzer: { analyze: vi.fn() },
  mockSecurityScanner: { scan: vi.fn() },
  mockPerformanceAnalyzer: { analyze: vi.fn() },
  mockTestGenerator: { generateTests: vi.fn() },
  mockAutoFixer: { fix: vi.fn(), fixSecurityIssues: vi.fn(), parseTypeScriptErrors: vi.fn() },
  mockDocGenerator: { generate: vi.fn() },
  mockMemorySystem: { getContextMemory: vi.fn(), learnFromProject: vi.fn() },
  mockToolOrchestrator: { initialize: vi.fn(), quickSearch: vi.fn(), execute: vi.fn() },
  mockSandboxExecutor: { isAvailable: vi.fn(), execute: vi.fn() },
  mockGithubExecutor: { isAvailable: vi.fn(), suggestRepoName: vi.fn(), push: vi.fn() },
}));

// ============================================================================
// MODULE MOCKS
// ============================================================================

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('@/lib/ai/providers', () => ({
  agentChat: vi.fn().mockResolvedValue({ text: '{}' }),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: vi.fn() })),
}));

vi.mock('../brain', () => ({
  codeIntentAnalyzer: mockIntentAnalyzer,
  projectPlanner: mockProjectPlanner,
  codeGenerator: mockCodeGenerator,
  reasoner: mockReasoner,
  codebaseAnalyzer: mockCodebaseAnalyzer,
  securityScanner: mockSecurityScanner,
  performanceAnalyzer: mockPerformanceAnalyzer,
  testGenerator: mockTestGenerator,
  autoFixer: mockAutoFixer,
  docGenerator: mockDocGenerator,
  memorySystem: mockMemorySystem,
}));

vi.mock('../tools', () => ({
  toolOrchestrator: mockToolOrchestrator,
}));

vi.mock('../executors/SandboxExecutor', () => ({
  sandboxExecutor: mockSandboxExecutor,
}));

vi.mock('../executors/GitHubExecutor', () => ({
  githubExecutor: mockGithubExecutor,
}));

// ============================================================================
// IMPORTS (after mocks)
// ============================================================================

import { CodeAgentV2, codeAgentV2 } from '../CodeAgentV2';
import type { CodeAgentV2Input, CodeAgentV2Output } from '../CodeAgentV2';
import type { AgentContext, AgentStreamEvent } from '../../core/types';

// ============================================================================
// HELPERS
// ============================================================================

function makeContext(overrides: Partial<AgentContext> = {}): AgentContext {
  return {
    userId: 'user-123',
    conversationId: 'conv-456',
    previousMessages: [],
    ...overrides,
  };
}

function makeInput(overrides: Partial<CodeAgentV2Input> = {}): CodeAgentV2Input {
  return {
    request: 'Build a todo app with React',
    mode: 'generate',
    options: {},
    ...overrides,
  };
}

function makeIntent(overrides = {}) {
  return {
    originalRequest: 'Build a todo app',
    refinedDescription: 'A React-based todo application',
    projectType: 'web_app',
    requirements: {
      functional: ['Add todos', 'Delete todos'],
      technical: ['React', 'TypeScript'],
      constraints: [],
    },
    complexity: 'moderate',
    estimatedFiles: 10,
    technologies: {
      primary: 'React',
      secondary: ['TypeScript'],
      runtime: 'node',
      packageManager: 'npm',
    },
    contextClues: {},
    ...overrides,
  };
}

function makePlan(overrides = {}) {
  return {
    id: 'plan-1',
    name: 'todo-app',
    description: 'A React todo application',
    architecture: {
      pattern: 'MVC',
      layers: [],
      rationale: 'Simple and clean',
    },
    fileTree: [
      {
        path: 'src/App.tsx',
        purpose: 'Main app',
        dependencies: [],
        priority: 1,
        estimatedLines: 50,
      },
      {
        path: 'src/index.tsx',
        purpose: 'Entry',
        dependencies: [],
        priority: 1,
        estimatedLines: 10,
      },
    ],
    dependencies: { production: {}, development: {} },
    buildSteps: [],
    testStrategy: { approach: 'unit', testFiles: [] },
    risks: [],
    taskBreakdown: [],
    ...overrides,
  };
}

function makeFile(path: string, content = 'const x = 1;') {
  return {
    path,
    content,
    language: 'typescript',
    purpose: 'source',
    linesOfCode: content.split('\n').length,
    generatedAt: Date.now(),
    version: 1,
  };
}

function collectEvents(onStream: ReturnType<typeof vi.fn>) {
  return onStream.mock.calls.map((call: unknown[]) => call[0] as AgentStreamEvent);
}

// ============================================================================
// DEFAULT MOCK RETURNS
// ============================================================================

function setupDefaultMocks() {
  const intent = makeIntent();
  const plan = makePlan();
  const files = [makeFile('src/App.tsx'), makeFile('src/index.tsx')];

  mockIntentAnalyzer.analyze.mockResolvedValue(intent);
  mockProjectPlanner.plan.mockResolvedValue(plan);
  mockCodeGenerator.generateAll.mockResolvedValue(files);
  mockReasoner.reason.mockResolvedValue({
    selectedPath: { description: 'MVC approach' },
    confidence: 0.92,
    alternativePaths: [{ description: 'MVVM approach' }],
  });
  mockReasoner.reflect.mockResolvedValue({
    overallQuality: 85,
    strengths: ['Clean code'],
    weaknesses: [],
    suggestions: [],
  });
  mockSecurityScanner.scan.mockResolvedValue({
    overallScore: 95,
    grade: 'A',
    vulnerabilities: [],
    summary: { critical: 0, high: 0, medium: 0, low: 0 },
  });
  mockPerformanceAnalyzer.analyze.mockResolvedValue({
    overallScore: 88,
    grade: 'B+',
    optimizations: [{ title: 'Use memoization' }],
  });
  mockTestGenerator.generateTests.mockResolvedValue({
    testFiles: [makeFile('src/App.test.tsx', 'test("works", () => {})')],
    totalTests: 5,
    coverageEstimate: { lines: 80, branches: 70, functions: 90 },
  });
  mockDocGenerator.generate.mockResolvedValue({
    files: [makeFile('README.md', '# Todo App')],
    apiDocs: null,
  });
  mockAutoFixer.fix.mockResolvedValue({
    fixedFiles: files,
    summary: { total: 0, fixed: 0, skipped: 0 },
  });
  mockAutoFixer.fixSecurityIssues.mockResolvedValue({
    fixedFiles: files,
    summary: { total: 0, fixed: 0, skipped: 0 },
  });
  mockAutoFixer.parseTypeScriptErrors.mockReturnValue([]);
  mockMemorySystem.getContextMemory.mockReturnValue({
    userPreferences: {
      preferredLanguages: [],
      testFramework: null,
      packageManager: 'npm',
    },
    projectHistory: [],
    patterns: [],
  });
  mockMemorySystem.learnFromProject.mockReturnValue(undefined);

  mockSandboxExecutor.isAvailable.mockReturnValue(false);
  mockSandboxExecutor.execute.mockResolvedValue({
    success: true,
    phase: 'build',
    outputs: [],
    errors: [],
    executionTime: 100,
  });

  mockGithubExecutor.isAvailable.mockReturnValue(false);
  mockGithubExecutor.suggestRepoName.mockResolvedValue('todo-app');
  mockGithubExecutor.push.mockResolvedValue({
    success: true,
    repoUrl: 'https://github.com/user/todo-app',
    commitSha: 'abc123',
  });

  mockToolOrchestrator.initialize.mockReturnValue(undefined);
  mockToolOrchestrator.quickSearch.mockResolvedValue([]);
  mockToolOrchestrator.execute.mockResolvedValue({
    conclusion: 'Code looks good',
    executionTime: 500,
  });

  mockCodebaseAnalyzer.analyze.mockResolvedValue({
    name: 'my-project',
    description: 'A project',
    framework: { name: 'React', confidence: 0.9 },
    languages: [{ language: 'TypeScript' }],
    architecture: { pattern: 'MVC' },
    suggestedImprovements: ['Add tests'],
  });
}

// ============================================================================
// TESTS
// ============================================================================

describe('CodeAgentV2', () => {
  let agent: CodeAgentV2;
  let onStream: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    agent = new CodeAgentV2();
    onStream = vi.fn();
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setupDefaultMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ==========================================================================
  // 1. Constructor / class properties
  // ==========================================================================

  describe('constructor and class properties', () => {
    it('should have correct name', () => {
      expect(agent.name).toBe('CodeAgentV2');
    });

    it('should have correct description', () => {
      expect(agent.description).toBe(
        'The Ultimate Autonomous Coding Agent - Built by Claude Opus 4.6'
      );
    });

    it('should have correct version', () => {
      expect(agent.version).toBe('2.0.0');
    });
  });

  // ==========================================================================
  // 2. canHandle
  // ==========================================================================

  describe('canHandle', () => {
    it('should return true for valid input with non-empty request string', () => {
      expect(agent.canHandle({ request: 'Build a web app' })).toBe(true);
    });

    it('should return false for null input', () => {
      expect(agent.canHandle(null)).toBe(false);
    });

    it('should return false for undefined input', () => {
      expect(agent.canHandle(undefined)).toBe(false);
    });

    it('should return false for non-object input (string)', () => {
      expect(agent.canHandle('not an object')).toBe(false);
    });

    it('should return false for non-object input (number)', () => {
      expect(agent.canHandle(42)).toBe(false);
    });

    it('should return false for empty request string', () => {
      expect(agent.canHandle({ request: '' })).toBe(false);
    });

    it('should return false when request is not a string', () => {
      expect(agent.canHandle({ request: 123 })).toBe(false);
    });

    it('should return false when request field is missing', () => {
      expect(agent.canHandle({ mode: 'generate' })).toBe(false);
    });

    it('should return true even with extra properties', () => {
      expect(agent.canHandle({ request: 'test', extra: true })).toBe(true);
    });

    it('should return false for an empty object', () => {
      expect(agent.canHandle({})).toBe(false);
    });
  });

  // ==========================================================================
  // 3. execute — mode routing
  // ==========================================================================

  describe('execute — mode routing', () => {
    it('should route to generate mode by default when no mode specified', async () => {
      const input = makeInput({ mode: undefined });
      const result = await agent.execute(input, makeContext(), onStream);
      expect(result.success).toBe(true);
      expect(mockIntentAnalyzer.analyze).toHaveBeenCalled();
      expect(mockProjectPlanner.plan).toHaveBeenCalled();
    });

    it('should route to generate mode explicitly', async () => {
      const input = makeInput({ mode: 'generate' });
      const result = await agent.execute(input, makeContext(), onStream);
      expect(result.success).toBe(true);
      expect(mockCodeGenerator.generateAll).toHaveBeenCalled();
    });

    it('should route to analyze mode', async () => {
      mockToolOrchestrator.quickSearch.mockResolvedValue(['file1.ts', 'file2.ts']);
      const input = makeInput({ mode: 'analyze' });
      const result = await agent.execute(input, makeContext(), onStream);
      expect(mockToolOrchestrator.quickSearch).toHaveBeenCalled();
      expect(mockCodebaseAnalyzer.analyze).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should route to review mode', async () => {
      const input = makeInput({ mode: 'review' });
      const result = await agent.execute(input, makeContext(), onStream);
      expect(result.success).toBe(true);
      expect(mockToolOrchestrator.execute).toHaveBeenCalled();
    });

    it('should route to fix mode and return failure', async () => {
      const input = makeInput({ mode: 'fix' });
      const result = await agent.execute(input, makeContext(), onStream);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Fix mode requires existing files context');
    });

    it('should route to test mode and return failure', async () => {
      const input = makeInput({ mode: 'test' });
      const result = await agent.execute(input, makeContext(), onStream);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Test mode requires existing files context');
    });

    it('should route to document mode and return failure', async () => {
      const input = makeInput({ mode: 'document' });
      const result = await agent.execute(input, makeContext(), onStream);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Document mode requires existing files context');
    });

    it('should default to generate for unknown mode', async () => {
      const input = makeInput({ mode: 'unknown_mode' as any });
      const result = await agent.execute(input, makeContext(), onStream);
      expect(result.success).toBe(true);
      expect(mockCodeGenerator.generateAll).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // 4. executeGenerate — full pipeline
  // ==========================================================================

  describe('executeGenerate — full pipeline', () => {
    it('should run full pipeline and return success', async () => {
      const input = makeInput();
      const result = await agent.execute(input, makeContext(), onStream);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.projectName).toBe('todo-app');
      expect(result.data!.files.length).toBeGreaterThan(0);
    });

    it('should call intent analyzer', async () => {
      await agent.execute(makeInput(), makeContext(), onStream);
      expect(mockIntentAnalyzer.analyze).toHaveBeenCalledWith(
        'Build a todo app with React',
        expect.any(Object)
      );
    });

    it('should call project planner with intent', async () => {
      await agent.execute(makeInput(), makeContext(), onStream);
      expect(mockProjectPlanner.plan).toHaveBeenCalledWith(
        expect.objectContaining({
          refinedDescription: 'A React-based todo application',
        })
      );
    });

    it('should call code generator with intent and plan', async () => {
      await agent.execute(makeInput(), makeContext(), onStream);
      expect(mockCodeGenerator.generateAll).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('should call reasoner when reasoning is enabled', async () => {
      await agent.execute(makeInput(), makeContext(), onStream);
      expect(mockReasoner.reason).toHaveBeenCalled();
    });

    it('should call self-reflection', async () => {
      await agent.execute(makeInput(), makeContext(), onStream);
      expect(mockReasoner.reflect).toHaveBeenCalled();
    });

    it('should include security results when enabled', async () => {
      const result = await agent.execute(makeInput(), makeContext(), onStream);
      expect(result.data!.security).toBeDefined();
      expect(result.data!.security!.score).toBe(95);
      expect(result.data!.security!.grade).toBe('A');
    });

    it('should include performance results when enabled', async () => {
      const result = await agent.execute(makeInput(), makeContext(), onStream);
      expect(result.data!.performance).toBeDefined();
      expect(result.data!.performance!.score).toBe(88);
      expect(result.data!.performance!.grade).toBe('B+');
    });

    it('should include test results when enabled and complexity is not simple', async () => {
      const result = await agent.execute(makeInput(), makeContext(), onStream);
      expect(result.data!.tests).toBeDefined();
      expect(result.data!.tests!.totalTests).toBeGreaterThan(0);
    });

    it('should include documentation results', async () => {
      const result = await agent.execute(makeInput(), makeContext(), onStream);
      expect(result.data!.documentation).toBeDefined();
      expect(result.data!.documentation!.readme).toBe(true);
    });

    it('should set metadata with execution time and confidence', async () => {
      const result = await agent.execute(makeInput(), makeContext(), onStream);
      expect(result.data!.metadata).toBeDefined();
      expect(result.data!.metadata.confidenceScore).toBe(0.85);
      expect(result.data!.metadata.executionTime).toBeGreaterThanOrEqual(0);
    });

    it('should calculate total lines from generated files', async () => {
      const result = await agent.execute(makeInput(), makeContext(), onStream);
      expect(result.data!.summary.totalLines).toBeGreaterThan(0);
    });

    it('should include technologies in summary', async () => {
      const result = await agent.execute(makeInput(), makeContext(), onStream);
      expect(result.data!.summary.technologies).toContain('React');
    });

    it('should emit complete event at the end', async () => {
      await agent.execute(makeInput(), makeContext(), onStream);
      const events = collectEvents(onStream);
      const completeEvents = events.filter((e) => e.type === 'complete');
      expect(completeEvents.length).toBeGreaterThan(0);
    });

    it('should emit progress events ending at 100', async () => {
      await agent.execute(makeInput(), makeContext(), onStream);
      const events = collectEvents(onStream);
      const progressValues = events.filter((e) => e.progress !== undefined).map((e) => e.progress!);
      expect(progressValues[progressValues.length - 1]).toBe(100);
    });
  });

  // ==========================================================================
  // 5. executeGenerate — options toggles
  // ==========================================================================

  describe('executeGenerate — option flags', () => {
    it('should skip reasoning when enableReasoning is false', async () => {
      const input = makeInput({ options: { enableReasoning: false } });
      await agent.execute(input, makeContext(), onStream);
      expect(mockReasoner.reason).not.toHaveBeenCalled();
      expect(mockIntentAnalyzer.analyze).toHaveBeenCalled();
    });

    it('should skip security scan when enableSecurity is false', async () => {
      const input = makeInput({ options: { enableSecurity: false } });
      const result = await agent.execute(input, makeContext(), onStream);
      expect(mockSecurityScanner.scan).not.toHaveBeenCalled();
      expect(result.data!.security).toBeUndefined();
    });

    it('should skip performance analysis when enablePerformance is false', async () => {
      const input = makeInput({ options: { enablePerformance: false } });
      const result = await agent.execute(input, makeContext(), onStream);
      expect(mockPerformanceAnalyzer.analyze).not.toHaveBeenCalled();
      expect(result.data!.performance).toBeUndefined();
    });

    it('should skip test generation when enableTests is false', async () => {
      const input = makeInput({ options: { enableTests: false } });
      const result = await agent.execute(input, makeContext(), onStream);
      expect(mockTestGenerator.generateTests).not.toHaveBeenCalled();
      expect(result.data!.tests).toBeUndefined();
    });

    it('should skip test generation when complexity is simple', async () => {
      mockIntentAnalyzer.analyze.mockResolvedValue(makeIntent({ complexity: 'simple' }));
      await agent.execute(makeInput(), makeContext(), onStream);
      expect(mockTestGenerator.generateTests).not.toHaveBeenCalled();
    });

    it('should skip documentation when enableDocs is false', async () => {
      const input = makeInput({ options: { enableDocs: false } });
      const result = await agent.execute(input, makeContext(), onStream);
      expect(mockDocGenerator.generate).not.toHaveBeenCalled();
      expect(result.data!.documentation).toBeUndefined();
    });
  });

  // ==========================================================================
  // 6. Tool orchestrator initialization with GitHub context
  // ==========================================================================

  describe('tool orchestrator initialization', () => {
    it('should initialize tool orchestrator when existingRepo and github token present', async () => {
      const input = makeInput({
        options: {
          existingRepo: { owner: 'testuser', repo: 'testrepo', branch: 'main' },
        },
      });
      const context = makeContext({
        previousMessages: [{ role: 'system', content: 'github_token:ghp_abc123' }],
      });

      await agent.execute(input, context, onStream);
      expect(mockToolOrchestrator.initialize).toHaveBeenCalledWith({
        githubToken: 'ghp_abc123',
        owner: 'testuser',
        repo: 'testrepo',
        branch: 'main',
      });
    });

    it('should not initialize tool orchestrator when no github token in messages', async () => {
      const input = makeInput({
        options: {
          existingRepo: { owner: 'testuser', repo: 'testrepo' },
        },
      });
      const context = makeContext({
        previousMessages: [{ role: 'user', content: 'hello' }],
      });

      await agent.execute(input, context, onStream);
      expect(mockToolOrchestrator.initialize).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // 7. Memory system
  // ==========================================================================

  describe('memory system integration', () => {
    it('should fetch memory context when userId is present', async () => {
      await agent.execute(makeInput(), makeContext({ userId: 'user-abc' }), onStream);
      expect(mockMemorySystem.getContextMemory).toHaveBeenCalledWith(
        'user-abc',
        expect.any(Object)
      );
    });

    it('should not fetch memory context when userId is empty string', async () => {
      await agent.execute(makeInput(), makeContext({ userId: '' }), onStream);
      expect(mockMemorySystem.getContextMemory).not.toHaveBeenCalled();
    });

    it('should learn from project after completion when userId is present', async () => {
      await agent.execute(makeInput(), makeContext({ userId: 'user-xyz' }), onStream);
      expect(mockMemorySystem.learnFromProject).toHaveBeenCalledWith(
        'user-xyz',
        expect.any(Object),
        expect.any(Object),
        expect.any(Array),
        expect.any(Boolean)
      );
    });

    it('should not learn from project when userId is empty string', async () => {
      await agent.execute(makeInput(), makeContext({ userId: '' }), onStream);
      expect(mockMemorySystem.learnFromProject).not.toHaveBeenCalled();
    });

    it('should apply preferred language from memory when intent has no primary tech', async () => {
      mockIntentAnalyzer.analyze.mockResolvedValue(
        makeIntent({
          technologies: { primary: '', secondary: [], runtime: 'node', packageManager: 'npm' },
        })
      );
      mockMemorySystem.getContextMemory.mockReturnValue({
        userPreferences: {
          preferredLanguages: ['Python'],
          testFramework: 'pytest',
          packageManager: 'pip',
        },
      });

      const result = await agent.execute(makeInput(), makeContext({ userId: 'user-1' }), onStream);
      expect(result.success).toBe(true);
    });
  });

  // ==========================================================================
  // 8. Sandbox build loop
  // ==========================================================================

  describe('sandbox build loop', () => {
    it('should skip sandbox when not available and assume success', async () => {
      mockSandboxExecutor.isAvailable.mockReturnValue(false);
      const result = await agent.execute(makeInput(), makeContext(), onStream);
      expect(result.data!.buildResult.success).toBe(true);
      expect(mockSandboxExecutor.execute).not.toHaveBeenCalled();
    });

    it('should use sandbox when available and pass on first try', async () => {
      mockSandboxExecutor.isAvailable.mockReturnValue(true);
      mockSandboxExecutor.execute.mockResolvedValue({
        success: true,
        phase: 'build',
        outputs: [],
        errors: [],
        executionTime: 200,
      });

      const result = await agent.execute(makeInput(), makeContext(), onStream);
      expect(mockSandboxExecutor.execute).toHaveBeenCalledTimes(1);
      expect(result.data!.buildResult.success).toBe(true);
    });

    it('should retry and auto-fix when sandbox build fails', async () => {
      mockSandboxExecutor.isAvailable.mockReturnValue(true);
      mockAutoFixer.parseTypeScriptErrors.mockReturnValue([
        {
          id: 'err-1',
          type: 'typescript',
          severity: 'error',
          message: 'Missing semicolon',
          file: 'app.ts',
          autoFixable: true,
        },
      ]);

      // First call fails, second succeeds
      mockSandboxExecutor.execute
        .mockResolvedValueOnce({
          success: false,
          phase: 'build',
          outputs: [],
          errors: [
            {
              file: 'app.ts',
              line: 5,
              message: 'Missing semicolon',
              type: 'syntax',
              severity: 'error',
            },
          ],
          executionTime: 100,
        })
        .mockResolvedValueOnce({
          success: true,
          phase: 'build',
          outputs: [],
          errors: [],
          executionTime: 150,
        });

      const fixedFiles = [makeFile('src/App.tsx', 'const fixed = true;')];
      mockAutoFixer.fix.mockResolvedValue({
        fixedFiles,
        summary: { total: 1, fixed: 1, skipped: 0 },
      });

      const result = await agent.execute(makeInput(), makeContext(), onStream);
      expect(mockSandboxExecutor.execute).toHaveBeenCalledTimes(2);
      expect(mockAutoFixer.fix).toHaveBeenCalled();
      expect(result.data!.metadata.errorsFixed).toBeGreaterThanOrEqual(1);
    });

    it('should stop retrying after MAX_ITERATIONS', async () => {
      mockSandboxExecutor.isAvailable.mockReturnValue(true);
      mockAutoFixer.parseTypeScriptErrors.mockReturnValue([]);
      mockSandboxExecutor.execute.mockResolvedValue({
        success: false,
        phase: 'build',
        outputs: [],
        errors: [{ file: 'x.ts', line: 1, message: 'error', type: 'build', severity: 'error' }],
        executionTime: 50,
      });

      const result = await agent.execute(makeInput(), makeContext(), onStream);
      // MAX_ITERATIONS is 5
      expect(mockSandboxExecutor.execute).toHaveBeenCalledTimes(5);
      expect(result.success).toBe(true); // still returns success with the output
    });
  });

  // ==========================================================================
  // 9. Security auto-fix
  // ==========================================================================

  describe('security auto-fix', () => {
    it('should auto-fix security vulnerabilities when found', async () => {
      mockSecurityScanner.scan.mockResolvedValue({
        overallScore: 60,
        grade: 'D',
        vulnerabilities: [
          { id: 'vuln-1', title: 'XSS', severity: 'critical', description: 'XSS vulnerability' },
        ],
        summary: { critical: 1, high: 0, medium: 0, low: 0 },
      });

      const fixedFiles = [makeFile('src/App.tsx', 'sanitized code')];
      mockAutoFixer.fixSecurityIssues.mockResolvedValue({
        fixedFiles,
        summary: { total: 1, fixed: 1, skipped: 0 },
      });

      const result = await agent.execute(makeInput(), makeContext(), onStream);
      expect(mockAutoFixer.fixSecurityIssues).toHaveBeenCalled();
      expect(result.data!.security!.criticalIssues).toBe(1);
      expect(result.data!.metadata.errorsFixed).toBeGreaterThanOrEqual(1);
    });

    it('should not call fixSecurityIssues when no vulnerabilities', async () => {
      mockSecurityScanner.scan.mockResolvedValue({
        overallScore: 100,
        grade: 'A+',
        vulnerabilities: [],
        summary: { critical: 0, high: 0, medium: 0, low: 0 },
      });

      await agent.execute(makeInput(), makeContext(), onStream);
      expect(mockAutoFixer.fixSecurityIssues).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // 10. GitHub push
  // ==========================================================================

  describe('GitHub push', () => {
    it('should push to GitHub when pushToGitHub is true and executor is available', async () => {
      mockGithubExecutor.isAvailable.mockReturnValue(true);
      const input = makeInput({
        options: { pushToGitHub: true, repoName: 'my-repo', privateRepo: true },
      });

      const result = await agent.execute(input, makeContext(), onStream);
      expect(mockGithubExecutor.push).toHaveBeenCalled();
      expect(result.data!.github).toBeDefined();
      expect(result.data!.github!.pushed).toBe(true);
      expect(result.data!.github!.repoUrl).toBe('https://github.com/user/todo-app');
    });

    it('should suggest repo name when repoName not provided', async () => {
      mockGithubExecutor.isAvailable.mockReturnValue(true);
      const input = makeInput({ options: { pushToGitHub: true } });

      await agent.execute(input, makeContext(), onStream);
      expect(mockGithubExecutor.suggestRepoName).toHaveBeenCalledWith('todo-app');
    });

    it('should use provided repoName instead of suggesting', async () => {
      mockGithubExecutor.isAvailable.mockReturnValue(true);
      const input = makeInput({ options: { pushToGitHub: true, repoName: 'custom-name' } });

      await agent.execute(input, makeContext(), onStream);
      expect(mockGithubExecutor.suggestRepoName).not.toHaveBeenCalled();
    });

    it('should return error when GitHub executor is not available', async () => {
      mockGithubExecutor.isAvailable.mockReturnValue(false);
      const input = makeInput({ options: { pushToGitHub: true } });

      const result = await agent.execute(input, makeContext(), onStream);
      expect(result.data!.github).toBeDefined();
      expect(result.data!.github!.pushed).toBe(false);
      expect(result.data!.github!.error).toBe('GitHub not connected');
    });

    it('should not push to GitHub when pushToGitHub is not set', async () => {
      const result = await agent.execute(makeInput(), makeContext(), onStream);
      expect(mockGithubExecutor.push).not.toHaveBeenCalled();
      expect(result.data!.github).toBeUndefined();
    });
  });

  // ==========================================================================
  // 11. Error handling
  // ==========================================================================

  describe('error handling', () => {
    it('should catch errors and return failure result', async () => {
      mockIntentAnalyzer.analyze.mockRejectedValue(new Error('AI service down'));

      const result = await agent.execute(makeInput(), makeContext(), onStream);
      expect(result.success).toBe(false);
      expect(result.error).toBe('AI service down');
    });

    it('should emit error event when an exception occurs', async () => {
      mockIntentAnalyzer.analyze.mockRejectedValue(new Error('Boom'));

      await agent.execute(makeInput(), makeContext(), onStream);
      const events = collectEvents(onStream);
      const errorEvents = events.filter((e) => e.type === 'error');
      expect(errorEvents.length).toBeGreaterThan(0);
      expect(errorEvents[0].message).toContain('Boom');
    });

    it('should handle non-Error thrown values', async () => {
      mockIntentAnalyzer.analyze.mockRejectedValue('string error');

      const result = await agent.execute(makeInput(), makeContext(), onStream);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error');
    });

    it('should fail when intent analysis returns null and reasoning enabled', async () => {
      mockIntentAnalyzer.analyze.mockResolvedValue(null);
      mockReasoner.reason.mockResolvedValue({
        selectedPath: { description: 'test' },
        confidence: 0.5,
        alternativePaths: [],
      });

      const result = await agent.execute(makeInput(), makeContext(), onStream);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to analyze code intent');
    });

    it('should fail when intent analysis returns null with reasoning disabled', async () => {
      mockIntentAnalyzer.analyze.mockResolvedValue(null);
      const input = makeInput({ options: { enableReasoning: false } });

      const result = await agent.execute(input, makeContext(), onStream);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to analyze code intent');
    });
  });

  // ==========================================================================
  // 12. executeAnalyze
  // ==========================================================================

  describe('executeAnalyze', () => {
    it('should return failure when no files found in repo', async () => {
      mockToolOrchestrator.quickSearch.mockResolvedValue([]);
      const input = makeInput({ mode: 'analyze' });

      const result = await agent.execute(input, makeContext(), onStream);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Could not access repository files');
    });

    it('should return success with codebase profile when files are found', async () => {
      mockToolOrchestrator.quickSearch.mockResolvedValue(['file1.ts', 'file2.ts', 'file3.ts']);

      const input = makeInput({ mode: 'analyze' });
      const result = await agent.execute(input, makeContext(), onStream);

      expect(result.success).toBe(true);
      expect(result.data!.projectName).toBe('my-project');
      expect(result.data!.summary.totalFiles).toBe(3);
      expect(result.data!.summary.architecture).toBe('MVC');
    });

    it('should include suggested improvements as next steps', async () => {
      mockToolOrchestrator.quickSearch.mockResolvedValue(['a.ts']);
      mockCodebaseAnalyzer.analyze.mockResolvedValue({
        name: 'proj',
        description: 'desc',
        framework: { name: 'Next.js', confidence: 0.95 },
        languages: [{ language: 'TypeScript' }],
        architecture: { pattern: 'Modular' },
        suggestedImprovements: ['Add logging', 'Improve error handling'],
      });

      const input = makeInput({ mode: 'analyze' });
      const result = await agent.execute(input, makeContext(), onStream);

      expect(result.data!.nextSteps).toEqual(['Add logging', 'Improve error handling']);
    });
  });

  // ==========================================================================
  // 13. executeReview
  // ==========================================================================

  describe('executeReview', () => {
    it('should delegate to tool orchestrator with review prompt', async () => {
      const input = makeInput({ mode: 'review', request: 'Review my auth module' });
      const result = await agent.execute(input, makeContext(), onStream);

      expect(result.success).toBe(true);
      expect(result.data!.projectName).toBe('Code Review');
      expect(mockToolOrchestrator.execute).toHaveBeenCalledWith(
        expect.stringContaining('Review my auth module'),
        expect.any(String),
        expect.any(Function)
      );
    });

    it('should include fixed next steps for review', async () => {
      const input = makeInput({ mode: 'review' });
      const result = await agent.execute(input, makeContext(), onStream);
      expect(result.data!.nextSteps).toContain('Address the identified issues');
      expect(result.data!.nextSteps).toContain('Re-run review after fixes');
    });
  });

  // ==========================================================================
  // 14. generateNextSteps — various scenarios
  // ==========================================================================

  describe('generateNextSteps — various scenarios', () => {
    it('should include GitHub repo URL when push was successful', async () => {
      mockGithubExecutor.isAvailable.mockReturnValue(true);
      const input = makeInput({ options: { pushToGitHub: true } });
      const result = await agent.execute(input, makeContext(), onStream);

      expect(result.data!.nextSteps.some((s) => s.includes('github.com'))).toBe(true);
      expect(result.data!.nextSteps.some((s) => s.includes('git clone'))).toBe(true);
    });

    it('should include copy files step when not pushed to GitHub', async () => {
      const result = await agent.execute(makeInput(), makeContext(), onStream);
      expect(result.data!.nextSteps.some((s) => s.includes('Copy files'))).toBe(true);
      expect(result.data!.nextSteps.some((s) => s.includes('npm install'))).toBe(true);
    });

    it('should include dev and test steps on build success', async () => {
      const result = await agent.execute(makeInput(), makeContext(), onStream);
      expect(result.data!.nextSteps.some((s) => s.includes('npm run dev'))).toBe(true);
      expect(result.data!.nextSteps.some((s) => s.includes('npm test'))).toBe(true);
    });

    it('should include fix step on build failure', async () => {
      mockSandboxExecutor.isAvailable.mockReturnValue(true);
      mockAutoFixer.parseTypeScriptErrors.mockReturnValue([]);
      mockSandboxExecutor.execute.mockResolvedValue({
        success: false,
        phase: 'build',
        outputs: [],
        errors: [{ file: 'x.ts', line: 1, message: 'err', type: 'build', severity: 'error' }],
        executionTime: 50,
      });

      const result = await agent.execute(makeInput(), makeContext(), onStream);
      expect(result.data!.nextSteps.some((s) => s.includes('build errors'))).toBe(true);
    });

    it('should always include customize step', async () => {
      const result = await agent.execute(makeInput(), makeContext(), onStream);
      expect(result.data!.nextSteps.some((s) => s.includes('Customize'))).toBe(true);
    });
  });

  // ==========================================================================
  // 15. Stream events
  // ==========================================================================

  describe('stream event emissions', () => {
    it('should emit thinking events during reasoning phase', async () => {
      await agent.execute(makeInput(), makeContext(), onStream);
      const events = collectEvents(onStream);
      expect(events.some((e) => e.type === 'thinking' && e.phase === 'Reasoning')).toBe(true);
    });

    it('should emit searching event during code generation', async () => {
      await agent.execute(makeInput(), makeContext(), onStream);
      const events = collectEvents(onStream);
      expect(events.some((e) => e.type === 'searching' && e.phase === 'Code Generation')).toBe(
        true
      );
    });

    it('should emit evaluating event during security scan', async () => {
      await agent.execute(makeInput(), makeContext(), onStream);
      const events = collectEvents(onStream);
      expect(events.some((e) => e.type === 'evaluating' && e.phase === 'Security Scan')).toBe(true);
    });

    it('should emit synthesizing event during documentation', async () => {
      await agent.execute(makeInput(), makeContext(), onStream);
      const events = collectEvents(onStream);
      expect(events.some((e) => e.type === 'synthesizing' && e.phase === 'Documentation')).toBe(
        true
      );
    });

    it('should emit evaluating event during self-reflection', async () => {
      await agent.execute(makeInput(), makeContext(), onStream);
      const events = collectEvents(onStream);
      expect(events.some((e) => e.type === 'evaluating' && e.phase === 'Self-Reflection')).toBe(
        true
      );
    });

    it('should emit pivoting event when security vulnerabilities found', async () => {
      mockSecurityScanner.scan.mockResolvedValue({
        overallScore: 50,
        grade: 'F',
        vulnerabilities: [{ id: 'v1', title: 'SQL Injection' }],
        summary: { critical: 1, high: 0, medium: 0, low: 0 },
      });
      mockAutoFixer.fixSecurityIssues.mockResolvedValue({
        fixedFiles: [makeFile('src/App.tsx')],
        summary: { total: 1, fixed: 1, skipped: 0 },
      });

      await agent.execute(makeInput(), makeContext(), onStream);
      const events = collectEvents(onStream);
      expect(events.some((e) => e.type === 'pivoting' && e.phase === 'Security Fix')).toBe(true);
    });

    it('should emit intent analysis phase event', async () => {
      await agent.execute(makeInput(), makeContext(), onStream);
      const events = collectEvents(onStream);
      expect(events.some((e) => e.phase === 'Intent Analysis')).toBe(true);
    });

    it('should emit planning phase event', async () => {
      await agent.execute(makeInput(), makeContext(), onStream);
      const events = collectEvents(onStream);
      expect(events.some((e) => e.phase === 'Planning')).toBe(true);
    });
  });

  // ==========================================================================
  // 16. Heartbeat behaviour
  // ==========================================================================

  describe('heartbeat', () => {
    it('should start and stop heartbeat during code generation phase', async () => {
      await agent.execute(makeInput(), makeContext(), onStream);
      // After execution, heartbeat should be stopped (no lingering intervals)
      const eventsBeforeDelay = collectEvents(onStream).length;
      vi.advanceTimersByTime(10000);
      const eventsAfterDelay = collectEvents(onStream).length;
      expect(eventsAfterDelay).toBe(eventsBeforeDelay);
    });
  });

  // ==========================================================================
  // 17. Singleton export
  // ==========================================================================

  describe('singleton export', () => {
    it('should export codeAgentV2 as a CodeAgentV2 instance', () => {
      expect(codeAgentV2).toBeInstanceOf(CodeAgentV2);
    });

    it('should have the correct name on the singleton', () => {
      expect(codeAgentV2.name).toBe('CodeAgentV2');
    });
  });

  // ==========================================================================
  // 18. Result metadata structure
  // ==========================================================================

  describe('result metadata structure', () => {
    it('should include executionTime in top-level metadata', async () => {
      const result = await agent.execute(makeInput(), makeContext(), onStream);
      expect(result.metadata).toBeDefined();
      expect(typeof result.metadata.executionTime).toBe('number');
    });

    it('should include iterations count', async () => {
      const result = await agent.execute(makeInput(), makeContext(), onStream);
      expect(typeof result.metadata.iterations).toBe('number');
    });

    it('should include confidenceScore between 0 and 1', async () => {
      const result = await agent.execute(makeInput(), makeContext(), onStream);
      expect(result.metadata.confidenceScore).toBeGreaterThanOrEqual(0);
      expect(result.metadata.confidenceScore).toBeLessThanOrEqual(1);
    });

    it('should have confidenceScore of 0 on failure', async () => {
      mockIntentAnalyzer.analyze.mockRejectedValue(new Error('fail'));
      const result = await agent.execute(makeInput(), makeContext(), onStream);
      expect(result.metadata.confidenceScore).toBe(0);
    });
  });

  // ==========================================================================
  // 19. Edge cases
  // ==========================================================================

  describe('edge cases', () => {
    it('should handle empty options gracefully', async () => {
      const input: CodeAgentV2Input = { request: 'test' };
      const result = await agent.execute(input, makeContext(), onStream);
      expect(result.success).toBe(true);
    });

    it('should handle context with no previousMessages', async () => {
      const context = makeContext({ previousMessages: undefined });
      const input = makeInput({
        options: { existingRepo: { owner: 'x', repo: 'y' } },
      });
      const result = await agent.execute(input, context, onStream);
      expect(result.success).toBe(true);
    });

    it('should handle empty test files from test generator', async () => {
      mockTestGenerator.generateTests.mockResolvedValue({
        testFiles: [],
        totalTests: 0,
        coverageEstimate: { lines: 0, branches: 0, functions: 0 },
      });
      const result = await agent.execute(makeInput(), makeContext(), onStream);
      expect(result.success).toBe(true);
    });

    it('should handle empty doc files from doc generator', async () => {
      mockDocGenerator.generate.mockResolvedValue({
        files: [],
        apiDocs: null,
      });
      const result = await agent.execute(makeInput(), makeContext(), onStream);
      expect(result.success).toBe(true);
    });

    it('should handle doc generator with apiDocs present', async () => {
      mockDocGenerator.generate.mockResolvedValue({
        files: [makeFile('docs/api.md')],
        apiDocs: { endpoints: [] },
      });
      const result = await agent.execute(makeInput(), makeContext(), onStream);
      expect(result.data!.documentation!.apiDocs).toBe(true);
    });

    it('should handle GitHub push failure result', async () => {
      mockGithubExecutor.isAvailable.mockReturnValue(true);
      mockGithubExecutor.push.mockResolvedValue({
        success: false,
        error: 'Rate limited',
      });
      const input = makeInput({ options: { pushToGitHub: true } });
      const result = await agent.execute(input, makeContext(), onStream);
      expect(result.data!.github!.pushed).toBe(false);
      expect(result.data!.github!.error).toBe('Rate limited');
    });

    it('should handle code generator returning empty files array', async () => {
      mockCodeGenerator.generateAll.mockResolvedValue([]);
      const result = await agent.execute(makeInput(), makeContext(), onStream);
      expect(result.success).toBe(true);
      expect(result.data!.summary.totalFiles).toBeGreaterThanOrEqual(0);
    });

    it('should handle reasoning result with low confidence', async () => {
      mockReasoner.reason.mockResolvedValue({
        selectedPath: { description: 'Uncertain approach' },
        confidence: 0.1,
        alternativePaths: [],
      });
      const result = await agent.execute(makeInput(), makeContext(), onStream);
      expect(result.success).toBe(true);
    });
  });

  // ==========================================================================
  // 20. Multiple execute calls
  // ==========================================================================

  describe('multiple executions', () => {
    it('should reset state between executions', async () => {
      const result1 = await agent.execute(makeInput(), makeContext(), onStream);
      expect(result1.success).toBe(true);

      vi.clearAllMocks();
      setupDefaultMocks();

      const result2 = await agent.execute(makeInput(), makeContext(), onStream);
      expect(result2.success).toBe(true);
      expect(result2.data!.metadata.errorsFixed).toBe(0);
    });
  });
});
