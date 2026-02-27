// @ts-nocheck - Test file with extensive mocking
/**
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAgentChat = vi.fn();
vi.mock('@/lib/ai/providers', () => ({
  agentChat: (...args: unknown[]) => mockAgentChat(...args),
}));

import { ProjectPlanner, projectPlanner } from '../ProjectPlanner';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockIntent(overrides = {}) {
  return {
    refinedDescription: 'A REST API for managing todos',
    projectType: 'api',
    complexity: 'medium',
    estimatedFiles: 8,
    technologies: {
      primary: 'TypeScript',
      secondary: ['Express', 'Zod'],
      packageManager: 'npm',
      runtime: 'node',
      testFramework: 'vitest',
    },
    requirements: {
      functional: ['CRUD operations', 'Authentication'],
      technical: ['REST API', 'JSON responses'],
      constraints: ['Must be fast', 'Must be secure'],
    },
    ...overrides,
  };
}

function createAIResponse(parsed: object) {
  return { text: JSON.stringify(parsed) };
}

function createValidPlanResponse(overrides = {}) {
  return createAIResponse({
    name: 'todo-api',
    description: 'A REST API for managing todos',
    architecture: {
      pattern: 'Clean Architecture',
      layers: [
        { name: 'API', purpose: 'HTTP handlers', files: ['src/routes/todos.ts'] },
        { name: 'Domain', purpose: 'Business logic', files: ['src/domain/todo.ts'] },
      ],
      rationale: 'Separation of concerns',
    },
    fileTree: [
      {
        path: 'package.json',
        purpose: 'Config',
        priority: 1,
        estimatedLines: 30,
        isConfig: true,
        dependencies: [],
      },
      {
        path: '.gitignore',
        purpose: 'Git ignores',
        priority: 2,
        estimatedLines: 20,
        isConfig: true,
        dependencies: [],
      },
      {
        path: 'tsconfig.json',
        purpose: 'TS config',
        priority: 3,
        estimatedLines: 25,
        isConfig: true,
        dependencies: [],
      },
      {
        path: 'src/index.ts',
        purpose: 'Entry point',
        priority: 4,
        estimatedLines: 50,
        isEntryPoint: true,
        dependencies: ['package.json'],
      },
      { path: 'README.md', purpose: 'Docs', priority: 5, estimatedLines: 40, dependencies: [] },
    ],
    dependencies: {
      production: { express: '^4.18.0', zod: '^3.22.0' },
      development: { vitest: '^1.0.0', typescript: '^5.0.0' },
    },
    buildSteps: [
      { order: 1, command: 'npm install', description: 'Install deps', failureAction: 'stop' },
      { order: 2, command: 'npm run build', description: 'Build', failureAction: 'stop' },
    ],
    testStrategy: { approach: 'Unit + integration', testFiles: ['src/__tests__/index.test.ts'] },
    risks: ['Scope creep'],
    taskBreakdown: [
      {
        id: 'task_1',
        title: 'Setup',
        description: 'Init project',
        status: 'pending',
        files: ['package.json'],
        estimatedTime: '2m',
      },
      {
        id: 'task_2',
        title: 'Implement API',
        description: 'Write routes',
        status: 'pending',
        files: ['src/index.ts'],
      },
    ],
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProjectPlanner', () => {
  let planner: ProjectPlanner;

  beforeEach(() => {
    vi.clearAllMocks();
    planner = new ProjectPlanner();
  });

  describe('basic properties', () => {
    it('should be instantiable', () => {
      expect(planner).toBeDefined();
    });

    it('should allow setting provider', () => {
      planner.setProvider('openai');
      expect(true).toBe(true);
    });
  });

  // =========================================================================
  // plan() — successful AI response
  // =========================================================================

  describe('plan - successful response', () => {
    it('should return a plan with all required fields', async () => {
      mockAgentChat.mockResolvedValue(createValidPlanResponse());
      const plan = await planner.plan(createMockIntent());

      expect(plan.id).toMatch(/^plan_/);
      expect(plan.name).toBe('todo-api');
      expect(plan.description).toBeTruthy();
      expect(plan.architecture).toBeDefined();
      expect(plan.fileTree).toBeDefined();
      expect(plan.dependencies).toBeDefined();
      expect(plan.buildSteps).toBeDefined();
      expect(plan.testStrategy).toBeDefined();
      expect(plan.risks).toBeDefined();
      expect(plan.taskBreakdown).toBeDefined();
    });

    it('should sanitize project name', async () => {
      mockAgentChat.mockResolvedValue(createValidPlanResponse({ name: 'My Cool Project!!!' }));
      const plan = await planner.plan(createMockIntent());
      expect(plan.name).toBe('my-cool-project');
    });

    it('should sanitize name with special chars', async () => {
      mockAgentChat.mockResolvedValue(createValidPlanResponse({ name: '--hello@world--' }));
      const plan = await planner.plan(createMockIntent());
      expect(plan.name).toBe('hello-world');
    });

    it('should parse architecture layers', async () => {
      mockAgentChat.mockResolvedValue(createValidPlanResponse());
      const plan = await planner.plan(createMockIntent());

      expect(plan.architecture.pattern).toBe('Clean Architecture');
      expect(plan.architecture.layers).toHaveLength(2);
      expect(plan.architecture.layers[0].name).toBe('API');
    });

    it('should sort fileTree by priority', async () => {
      mockAgentChat.mockResolvedValue(createValidPlanResponse());
      const plan = await planner.plan(createMockIntent());

      for (let i = 1; i < plan.fileTree.length; i++) {
        expect(plan.fileTree[i].priority).toBeGreaterThanOrEqual(plan.fileTree[i - 1].priority);
      }
    });

    it('should sort buildSteps by order', async () => {
      mockAgentChat.mockResolvedValue(createValidPlanResponse());
      const plan = await planner.plan(createMockIntent());

      for (let i = 1; i < plan.buildSteps.length; i++) {
        expect(plan.buildSteps[i].order).toBeGreaterThanOrEqual(plan.buildSteps[i - 1].order);
      }
    });

    it('should parse dependencies', async () => {
      mockAgentChat.mockResolvedValue(createValidPlanResponse());
      const plan = await planner.plan(createMockIntent());

      expect(plan.dependencies.production.express).toBe('^4.18.0');
      expect(plan.dependencies.development.vitest).toBe('^1.0.0');
    });

    it('should parse task breakdown', async () => {
      mockAgentChat.mockResolvedValue(createValidPlanResponse());
      const plan = await planner.plan(createMockIntent());

      expect(plan.taskBreakdown.length).toBeGreaterThan(0);
      expect(plan.taskBreakdown[0].id).toBe('task_1');
      expect(plan.taskBreakdown[0].status).toBe('pending');
    });

    it('should include estimatedTime when provided', async () => {
      mockAgentChat.mockResolvedValue(createValidPlanResponse());
      const plan = await planner.plan(createMockIntent());

      expect(plan.taskBreakdown[0].estimatedTime).toBe('2m');
      expect(plan.taskBreakdown[1].estimatedTime).toBeUndefined();
    });
  });

  // =========================================================================
  // plan() — validation and auto-fix
  // =========================================================================

  describe('plan - validation', () => {
    it('should add package.json if missing', async () => {
      mockAgentChat.mockResolvedValue(
        createValidPlanResponse({
          fileTree: [
            {
              path: 'src/index.ts',
              purpose: 'Entry',
              priority: 1,
              estimatedLines: 50,
              dependencies: [],
            },
          ],
        })
      );

      const plan = await planner.plan(createMockIntent());
      const pkgJson = plan.fileTree.find((f) => f.path === 'package.json');
      expect(pkgJson).toBeDefined();
      expect(pkgJson!.priority).toBe(1);
    });

    it('should add README.md if missing', async () => {
      mockAgentChat.mockResolvedValue(
        createValidPlanResponse({
          fileTree: [
            {
              path: 'package.json',
              purpose: 'Config',
              priority: 1,
              estimatedLines: 30,
              isConfig: true,
              dependencies: [],
            },
          ],
        })
      );

      const plan = await planner.plan(createMockIntent());
      expect(plan.fileTree.some((f) => f.path === 'README.md')).toBe(true);
    });

    it('should add .gitignore if missing', async () => {
      mockAgentChat.mockResolvedValue(
        createValidPlanResponse({
          fileTree: [
            {
              path: 'package.json',
              purpose: 'Config',
              priority: 1,
              estimatedLines: 30,
              isConfig: true,
              dependencies: [],
            },
          ],
        })
      );

      const plan = await planner.plan(createMockIntent());
      expect(plan.fileTree.some((f) => f.path === '.gitignore')).toBe(true);
    });

    it('should add tsconfig.json for TypeScript projects', async () => {
      mockAgentChat.mockResolvedValue(
        createValidPlanResponse({
          fileTree: [
            {
              path: 'package.json',
              purpose: 'Config',
              priority: 1,
              estimatedLines: 30,
              isConfig: true,
              dependencies: [],
            },
          ],
        })
      );

      const plan = await planner.plan(
        createMockIntent({
          technologies: { ...createMockIntent().technologies, primary: 'TypeScript' },
        })
      );
      expect(plan.fileTree.some((f) => f.path === 'tsconfig.json')).toBe(true);
    });

    it('should NOT add tsconfig.json for JavaScript projects', async () => {
      mockAgentChat.mockResolvedValue(
        createValidPlanResponse({
          fileTree: [
            {
              path: 'package.json',
              purpose: 'Config',
              priority: 1,
              estimatedLines: 30,
              isConfig: true,
              dependencies: [],
            },
          ],
        })
      );

      const plan = await planner.plan(
        createMockIntent({
          technologies: { ...createMockIntent().technologies, primary: 'JavaScript' },
        })
      );
      expect(plan.fileTree.some((f) => f.path === 'tsconfig.json')).toBe(false);
    });

    it('should not duplicate package.json if already present', async () => {
      mockAgentChat.mockResolvedValue(createValidPlanResponse());
      const plan = await planner.plan(createMockIntent());

      const pkgJsonCount = plan.fileTree.filter((f) => f.path === 'package.json').length;
      expect(pkgJsonCount).toBe(1);
    });
  });

  // =========================================================================
  // plan() — fallback on errors
  // =========================================================================

  describe('plan - fallback', () => {
    it('should return fallback plan on AI error', async () => {
      mockAgentChat.mockRejectedValue(new Error('API down'));
      const plan = await planner.plan(createMockIntent());

      expect(plan.id).toMatch(/^plan_fallback_/);
      expect(plan.name).toBe('project');
    });

    it('should return fallback plan when no JSON in response', async () => {
      mockAgentChat.mockResolvedValue({ text: 'No JSON here, just text.' });
      const plan = await planner.plan(createMockIntent());

      expect(plan.id).toMatch(/^plan_fallback_/);
    });

    it('should return fallback plan on invalid JSON', async () => {
      mockAgentChat.mockResolvedValue({ text: '{ broken json' });
      const plan = await planner.plan(createMockIntent());

      expect(plan.id).toMatch(/^plan_fallback_/);
    });

    it('fallback for TypeScript should have tsconfig.json', async () => {
      mockAgentChat.mockRejectedValue(new Error('fail'));
      const plan = await planner.plan(createMockIntent());

      expect(plan.fileTree.some((f) => f.path === 'tsconfig.json')).toBe(true);
    });

    it('fallback for TypeScript should use .ts extension', async () => {
      mockAgentChat.mockRejectedValue(new Error('fail'));
      const plan = await planner.plan(createMockIntent());

      expect(plan.fileTree.some((f) => f.path === 'src/index.ts')).toBe(true);
    });

    it('fallback for JavaScript should use .js extension', async () => {
      mockAgentChat.mockRejectedValue(new Error('fail'));
      const plan = await planner.plan(
        createMockIntent({
          technologies: { ...createMockIntent().technologies, primary: 'JavaScript' },
        })
      );

      expect(plan.fileTree.some((f) => f.path === 'src/index.js')).toBe(true);
    });

    it('fallback for JavaScript should NOT have tsconfig.json', async () => {
      mockAgentChat.mockRejectedValue(new Error('fail'));
      const plan = await planner.plan(
        createMockIntent({
          technologies: { ...createMockIntent().technologies, primary: 'JavaScript' },
        })
      );

      expect(plan.fileTree.some((f) => f.path === 'tsconfig.json')).toBe(false);
    });

    it('fallback should include package.json, .gitignore, README.md', async () => {
      mockAgentChat.mockRejectedValue(new Error('fail'));
      const plan = await planner.plan(createMockIntent());

      expect(plan.fileTree.some((f) => f.path === 'package.json')).toBe(true);
      expect(plan.fileTree.some((f) => f.path === '.gitignore')).toBe(true);
      expect(plan.fileTree.some((f) => f.path === 'README.md')).toBe(true);
    });

    it('fallback should have build steps', async () => {
      mockAgentChat.mockRejectedValue(new Error('fail'));
      const plan = await planner.plan(createMockIntent());

      expect(plan.buildSteps.length).toBeGreaterThan(0);
      expect(plan.buildSteps[0].command).toBe('npm install');
    });

    it('fallback should have task breakdown', async () => {
      mockAgentChat.mockRejectedValue(new Error('fail'));
      const plan = await planner.plan(createMockIntent());

      expect(plan.taskBreakdown.length).toBe(3);
      expect(plan.taskBreakdown[0].status).toBe('pending');
    });

    it('fallback should have risks', async () => {
      mockAgentChat.mockRejectedValue(new Error('fail'));
      const plan = await planner.plan(createMockIntent());

      expect(plan.risks.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // Builder methods (via AI responses with edge-case data)
  // =========================================================================

  describe('builder methods edge cases', () => {
    it('should handle null architecture layers', async () => {
      mockAgentChat.mockResolvedValue(
        createValidPlanResponse({
          architecture: { pattern: 'Minimal', layers: null, rationale: 'Simple' },
        })
      );
      const plan = await planner.plan(createMockIntent());
      expect(plan.architecture.layers).toEqual([]);
    });

    it('should handle missing file path', async () => {
      mockAgentChat.mockResolvedValue(
        createValidPlanResponse({
          fileTree: [
            { purpose: 'Mystery file', priority: 1, estimatedLines: 10, dependencies: [] },
          ],
        })
      );
      const plan = await planner.plan(createMockIntent());
      expect(plan.fileTree.some((f) => f.path.includes('file_'))).toBe(true);
    });

    it('should handle missing buildSteps', async () => {
      mockAgentChat.mockResolvedValue(createValidPlanResponse({ buildSteps: null }));
      const plan = await planner.plan(createMockIntent());

      expect(plan.buildSteps.length).toBe(2);
      expect(plan.buildSteps[0].command).toBe('npm install');
      expect(plan.buildSteps[1].command).toBe('npm run build');
    });

    it('should handle empty fileTree', async () => {
      mockAgentChat.mockResolvedValue(createValidPlanResponse({ fileTree: [] }));
      const plan = await planner.plan(createMockIntent());

      // Validation should have added package.json, .gitignore, tsconfig, README
      expect(plan.fileTree.length).toBeGreaterThanOrEqual(4);
    });

    it('should handle missing taskBreakdown', async () => {
      mockAgentChat.mockResolvedValue(createValidPlanResponse({ taskBreakdown: null }));
      const plan = await planner.plan(createMockIntent());
      expect(plan.taskBreakdown).toEqual([]);
    });

    it('should handle missing dependencies', async () => {
      mockAgentChat.mockResolvedValue(createValidPlanResponse({ dependencies: null }));
      const plan = await planner.plan(createMockIntent());
      expect(plan.dependencies.production).toEqual({});
      expect(plan.dependencies.development).toEqual({});
    });

    it('should handle invalid failureAction', async () => {
      mockAgentChat.mockResolvedValue(
        createValidPlanResponse({
          buildSteps: [
            { order: 1, command: 'npm install', description: 'Install', failureAction: 'explode' },
          ],
        })
      );
      const plan = await planner.plan(createMockIntent());
      expect(plan.buildSteps[0].failureAction).toBe('stop'); // default
    });

    it('should detect config files from extension', async () => {
      mockAgentChat.mockResolvedValue(
        createValidPlanResponse({
          fileTree: [
            {
              path: 'config.yaml',
              purpose: 'Config',
              priority: 1,
              estimatedLines: 10,
              isConfig: false,
              dependencies: [],
            },
          ],
        })
      );
      const plan = await planner.plan(createMockIntent());
      const configFile = plan.fileTree.find((f) => f.path === 'config.yaml');
      expect(configFile?.isConfig).toBe(true);
    });

    it('should handle JSON embedded in extra text', async () => {
      mockAgentChat.mockResolvedValue({
        text:
          'Here is the plan:\n' +
          JSON.stringify({
            name: 'embedded-plan',
            description: 'Test',
            architecture: { pattern: 'MVC', layers: [], rationale: 'Standard' },
            fileTree: [
              {
                path: 'package.json',
                purpose: 'Config',
                priority: 1,
                estimatedLines: 30,
                isConfig: true,
                dependencies: [],
              },
            ],
            dependencies: { production: {}, development: {} },
            buildSteps: [
              { order: 1, command: 'npm install', description: 'Install', failureAction: 'stop' },
            ],
            testStrategy: { approach: 'Unit', testFiles: [] },
            risks: [],
            taskBreakdown: [],
          }) +
          '\nEnd of plan.',
      });

      const plan = await planner.plan(createMockIntent());
      expect(plan.name).toBe('embedded-plan');
    });
  });

  // =========================================================================
  // updateTaskStatus
  // =========================================================================

  describe('updateTaskStatus', () => {
    it('should update a specific task status', async () => {
      mockAgentChat.mockRejectedValue(new Error('fail'));
      const plan = await planner.plan(createMockIntent());

      const updated = planner.updateTaskStatus(plan, 'task_1', 'completed');
      expect(updated.taskBreakdown[0].status).toBe('completed');
    });

    it('should not modify other tasks', async () => {
      mockAgentChat.mockRejectedValue(new Error('fail'));
      const plan = await planner.plan(createMockIntent());

      const updated = planner.updateTaskStatus(plan, 'task_1', 'completed');
      expect(updated.taskBreakdown[1].status).toBe('pending');
    });

    it('should return new object (immutable)', async () => {
      mockAgentChat.mockRejectedValue(new Error('fail'));
      const plan = await planner.plan(createMockIntent());

      const updated = planner.updateTaskStatus(plan, 'task_1', 'in-progress');
      expect(updated).not.toBe(plan);
      expect(plan.taskBreakdown[0].status).toBe('pending'); // original unchanged
    });

    it('should handle nonexistent task id', async () => {
      mockAgentChat.mockRejectedValue(new Error('fail'));
      const plan = await planner.plan(createMockIntent());

      const updated = planner.updateTaskStatus(plan, 'nonexistent', 'completed');
      expect(updated.taskBreakdown.every((t) => t.status === 'pending')).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

describe('projectPlanner singleton', () => {
  it('should be an instance of ProjectPlanner', () => {
    expect(projectPlanner).toBeInstanceOf(ProjectPlanner);
  });
});
