// @ts-nocheck - Test file with extensive mocking
/** @vitest-environment node */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemorySystem, memorySystem } from '../MemorySystem';
import type {
  UserProfile,
  CodingPreferences,
  ProjectHistory,
  LearnedPattern,
  UserFeedback,
  ContextMemory,
} from '../MemorySystem';
import type { CodeIntent, ProjectPlan, GeneratedFile } from '../../../core/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockIntent(overrides: Partial<CodeIntent> = {}): CodeIntent {
  return {
    originalRequest: 'Build a TODO app',
    refinedDescription: 'Build a React TODO application with CRUD',
    projectType: 'web_app',
    requirements: {
      functional: ['Add todos', 'Delete todos'],
      technical: ['React', 'TypeScript'],
      constraints: [],
    },
    complexity: 'moderate',
    estimatedFiles: 5,
    technologies: {
      primary: 'TypeScript React',
      secondary: ['Tailwind', 'Zustand'],
      runtime: 'node',
      packageManager: 'npm',
    },
    contextClues: {},
    ...overrides,
  };
}

function createMockPlan(overrides: Partial<ProjectPlan> = {}): ProjectPlan {
  return {
    id: 'plan-1',
    name: 'TODO App',
    description: 'A simple TODO application',
    architecture: {
      pattern: 'modular',
      layers: [{ name: 'ui', purpose: 'User interface', files: ['App.tsx'] }],
      rationale: 'Simple and effective',
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

function createMockFiles(paths: string[] = ['src/App.tsx', 'src/index.ts']): GeneratedFile[] {
  return paths.map((p) => ({
    path: p,
    content: '// generated',
    language: 'typescript',
    purpose: 'source',
    linesOfCode: 10,
    generatedAt: Date.now(),
    version: 1,
  }));
}

function createMockPattern(overrides: Partial<LearnedPattern> = {}): LearnedPattern {
  return {
    id: 'pattern-1',
    type: 'success',
    pattern: 'modular',
    context: 'web_app with moderate complexity',
    frequency: 3,
    lastUsed: new Date(),
    effectiveness: 0.9,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// MemorySystem — constructor / singleton
// ---------------------------------------------------------------------------

describe('MemorySystem', () => {
  let memory: MemorySystem;

  beforeEach(() => {
    vi.clearAllMocks();
    memory = new MemorySystem();
  });

  // -----------------------------------------------------------------------
  // Singleton export
  // -----------------------------------------------------------------------

  describe('module-level singleton', () => {
    it('should export a singleton memorySystem instance', () => {
      expect(memorySystem).toBeInstanceOf(MemorySystem);
    });
  });

  // -----------------------------------------------------------------------
  // getProfile
  // -----------------------------------------------------------------------

  describe('getProfile', () => {
    it('should create a new profile for an unknown user', () => {
      const profile = memory.getProfile('user-1');
      expect(profile).toBeDefined();
      expect(profile.userId).toBe('user-1');
    });

    it('should return the same profile on subsequent calls', () => {
      const first = memory.getProfile('user-1');
      const second = memory.getProfile('user-1');
      expect(first).toBe(second);
    });

    it('should create distinct profiles for different users', () => {
      const p1 = memory.getProfile('user-1');
      const p2 = memory.getProfile('user-2');
      expect(p1.userId).toBe('user-1');
      expect(p2.userId).toBe('user-2');
      expect(p1).not.toBe(p2);
    });

    it('should initialize profile with default preferences', () => {
      const profile = memory.getProfile('user-1');
      expect(profile.preferences.preferredLanguages).toContain('TypeScript');
      expect(profile.preferences.preferredFrameworks).toContain('React');
      expect(profile.preferences.preferredRuntime).toBe('node');
      expect(profile.preferences.packageManager).toBe('npm');
    });

    it('should initialize profile with empty arrays for history, patterns, feedback', () => {
      const profile = memory.getProfile('user-1');
      expect(profile.history).toEqual([]);
      expect(profile.patterns).toEqual([]);
      expect(profile.feedback).toEqual([]);
    });

    it('should set createdAt and updatedAt dates', () => {
      const profile = memory.getProfile('user-1');
      expect(profile.createdAt).toBeInstanceOf(Date);
      expect(profile.updatedAt).toBeInstanceOf(Date);
    });

    it('should set default coding style preferences', () => {
      const profile = memory.getProfile('user-1');
      const style = profile.preferences.codingStyle;
      expect(style.quotes).toBe('single');
      expect(style.semicolons).toBe(true);
      expect(style.indentation).toBe('spaces');
      expect(style.indentSize).toBe(2);
      expect(style.trailingComma).toBe(true);
      expect(style.maxLineLength).toBe(100);
    });

    it('should set default communication preferences', () => {
      const profile = memory.getProfile('user-1');
      expect(profile.preferences.verboseExplanations).toBe(true);
      expect(profile.preferences.askClarifyingQuestions).toBe(true);
      expect(profile.preferences.showThinkingProcess).toBe(true);
    });

    it('should set default git preferences', () => {
      const profile = memory.getProfile('user-1');
      expect(profile.preferences.defaultBranch).toBe('main');
      expect(profile.preferences.commitStyle).toBe('conventional');
      expect(profile.preferences.privateRepos).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // learnFromProject
  // -----------------------------------------------------------------------

  describe('learnFromProject', () => {
    it('should add a history entry for a successful project', () => {
      const intent = createMockIntent();
      const plan = createMockPlan();
      const files = createMockFiles();

      memory.learnFromProject('user-1', intent, plan, files, true);

      const profile = memory.getProfile('user-1');
      expect(profile.history).toHaveLength(1);
      expect(profile.history[0].success).toBe(true);
      expect(profile.history[0].files).toEqual(['src/App.tsx', 'src/index.ts']);
    });

    it('should add a history entry for a failed project', () => {
      const intent = createMockIntent();
      const plan = createMockPlan();
      const files = createMockFiles();

      memory.learnFromProject('user-1', intent, plan, files, false);

      const profile = memory.getProfile('user-1');
      expect(profile.history).toHaveLength(1);
      expect(profile.history[0].success).toBe(false);
    });

    it('should learn preferences from a successful project', () => {
      const intent = createMockIntent({
        technologies: {
          primary: 'Python Flask',
          secondary: ['SQLAlchemy', 'Marshmallow'],
          runtime: 'python',
          packageManager: 'pip',
        },
      });
      const plan = createMockPlan();
      const files = createMockFiles();

      memory.learnFromProject('user-1', intent, plan, files, true);

      const profile = memory.getProfile('user-1');
      expect(profile.preferences.preferredLanguages[0]).toBe('Python');
      expect(profile.preferences.preferredFrameworks).toContain('SQLAlchemy');
      expect(profile.preferences.preferredFrameworks).toContain('Marshmallow');
      expect(profile.preferences.preferredRuntime).toBe('python');
      expect(profile.preferences.packageManager).toBe('pip');
    });

    it('should NOT learn preferences from a failed project', () => {
      const intent = createMockIntent({
        technologies: {
          primary: 'Rust Actix',
          secondary: ['Diesel'],
          runtime: 'node',
          packageManager: 'npm',
        },
      });

      memory.learnFromProject('user-1', intent, createMockPlan(), createMockFiles(), false);

      const profile = memory.getProfile('user-1');
      // Rust should NOT appear in preferences — learning is skipped for failures
      expect(profile.preferences.preferredLanguages).not.toContain('Rust');
      // Runtime should remain at the default, not changed to 'node' from the failed intent
      // (it was already 'node' by default, but packageManager was 'npm' too —
      //  the key point is the language wasn't added)
      expect(profile.preferences.preferredFrameworks).not.toContain('Diesel');
    });

    it('should learn patterns from a successful project', () => {
      memory.learnFromProject(
        'user-1',
        createMockIntent(),
        createMockPlan({ architecture: { pattern: 'clean-arch', layers: [], rationale: 'test' } }),
        createMockFiles(),
        true
      );

      const profile = memory.getProfile('user-1');
      expect(profile.patterns.length).toBeGreaterThanOrEqual(1);
      expect(profile.patterns.some((p) => p.pattern === 'clean-arch')).toBe(true);
    });

    it('should NOT learn patterns from a failed project', () => {
      memory.learnFromProject(
        'user-1',
        createMockIntent(),
        createMockPlan({ architecture: { pattern: 'bad-arch', layers: [], rationale: 'test' } }),
        createMockFiles(),
        false
      );

      const profile = memory.getProfile('user-1');
      expect(profile.patterns.some((p) => p.pattern === 'bad-arch')).toBe(false);
    });

    it('should increment frequency on duplicate patterns', () => {
      const intent = createMockIntent();
      const plan = createMockPlan();
      const files = createMockFiles();

      memory.learnFromProject('user-1', intent, plan, files, true);
      memory.learnFromProject('user-1', intent, plan, files, true);

      const profile = memory.getProfile('user-1');
      const pattern = profile.patterns.find((p) => p.pattern === 'modular');
      expect(pattern).toBeDefined();
      expect(pattern!.frequency).toBe(2);
    });

    it('should cap effectiveness at 1.0 when incrementing duplicate patterns', () => {
      const intent = createMockIntent();
      const plan = createMockPlan();
      const files = createMockFiles();

      // Run many times to push effectiveness toward ceiling
      for (let i = 0; i < 20; i++) {
        memory.learnFromProject('user-1', intent, plan, files, true);
      }

      const profile = memory.getProfile('user-1');
      const pattern = profile.patterns.find((p) => p.pattern === 'modular');
      expect(pattern!.effectiveness).toBeLessThanOrEqual(1);
    });

    it('should limit history to 50 entries', () => {
      const intent = createMockIntent();
      const plan = createMockPlan();
      const files = createMockFiles();

      for (let i = 0; i < 55; i++) {
        memory.learnFromProject('user-1', intent, plan, files, true);
      }

      const profile = memory.getProfile('user-1');
      expect(profile.history.length).toBeLessThanOrEqual(50);
    });

    it('should limit patterns to 100 entries', () => {
      // Create 105 unique patterns by varying projectType and architecture
      for (let i = 0; i < 105; i++) {
        const intent = createMockIntent({
          projectType: `type-${i}` as any,
          complexity: 'moderate',
        });
        const plan = createMockPlan({
          architecture: { pattern: `pattern-${i}`, layers: [], rationale: `r-${i}` },
        });
        memory.learnFromProject('user-1', intent, plan, createMockFiles(), true);
      }

      const profile = memory.getProfile('user-1');
      expect(profile.patterns.length).toBeLessThanOrEqual(100);
    });

    it('should keep most effective patterns when trimming to 100', () => {
      // Manually add a highly effective pattern first
      const profile = memory.getProfile('user-1');
      profile.patterns.push(
        createMockPattern({ id: 'best', pattern: 'best-pattern', effectiveness: 1, frequency: 100 })
      );

      // Fill with lower-effectiveness patterns
      for (let i = 0; i < 105; i++) {
        const intent = createMockIntent({
          projectType: `type-${i}` as any,
          complexity: 'moderate',
        });
        const plan = createMockPlan({
          architecture: { pattern: `filler-${i}`, layers: [], rationale: `r-${i}` },
        });
        memory.learnFromProject('user-1', intent, plan, createMockFiles(), true);
      }

      const updatedProfile = memory.getProfile('user-1');
      expect(updatedProfile.patterns.some((p) => p.pattern === 'best-pattern')).toBe(true);
    });

    it('should not duplicate languages already in preferred list', () => {
      // TypeScript is already in the default preferences
      const intent = createMockIntent({
        technologies: {
          primary: 'TypeScript',
          secondary: [],
          runtime: 'node',
          packageManager: 'npm',
        },
      });

      memory.learnFromProject('user-1', intent, createMockPlan(), createMockFiles(), true);

      const profile = memory.getProfile('user-1');
      const tsCount = profile.preferences.preferredLanguages.filter(
        (l) => l === 'TypeScript'
      ).length;
      expect(tsCount).toBe(1);
    });

    it('should limit preferred languages to 5', () => {
      const languages = ['Go', 'Rust', 'Python', 'Java', 'C#', 'Elixir'];
      for (const lang of languages) {
        const intent = createMockIntent({
          technologies: { primary: lang, secondary: [], runtime: 'node', packageManager: 'npm' },
        });
        memory.learnFromProject('user-1', intent, createMockPlan(), createMockFiles(), true);
      }

      const profile = memory.getProfile('user-1');
      expect(profile.preferences.preferredLanguages.length).toBeLessThanOrEqual(5);
    });

    it('should limit preferred frameworks to 10', () => {
      const frameworks = Array.from({ length: 15 }, (_, i) => `Framework-${i}`);
      const intent = createMockIntent({
        technologies: {
          primary: 'TS',
          secondary: frameworks,
          runtime: 'node',
          packageManager: 'npm',
        },
      });

      memory.learnFromProject('user-1', intent, createMockPlan(), createMockFiles(), true);

      const profile = memory.getProfile('user-1');
      expect(profile.preferences.preferredFrameworks.length).toBeLessThanOrEqual(10);
    });

    it('should update the updatedAt timestamp', () => {
      const profile = memory.getProfile('user-1');
      const originalUpdatedAt = profile.updatedAt;

      // Small delay to guarantee different timestamp
      vi.useFakeTimers();
      vi.advanceTimersByTime(1000);

      memory.learnFromProject(
        'user-1',
        createMockIntent(),
        createMockPlan(),
        createMockFiles(),
        true
      );

      const updated = memory.getProfile('user-1');
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(originalUpdatedAt.getTime());

      vi.useRealTimers();
    });

    it('should set initial metrics to zero', () => {
      memory.learnFromProject(
        'user-1',
        createMockIntent(),
        createMockPlan(),
        createMockFiles(),
        true
      );

      const profile = memory.getProfile('user-1');
      const entry = profile.history[0];
      expect(entry.metrics.executionTime).toBe(0);
      expect(entry.metrics.iterations).toBe(0);
      expect(entry.metrics.errorsFixed).toBe(0);
    });

    it('should use the first word of primary technology as language name', () => {
      const intent = createMockIntent({
        technologies: {
          primary: 'JavaScript ES2023',
          secondary: [],
          runtime: 'node',
          packageManager: 'npm',
        },
      });

      memory.learnFromProject('user-1', intent, createMockPlan(), createMockFiles(), true);

      const profile = memory.getProfile('user-1');
      expect(profile.preferences.preferredLanguages).toContain('JavaScript');
    });
  });

  // -----------------------------------------------------------------------
  // recordFeedback
  // -----------------------------------------------------------------------

  describe('recordFeedback', () => {
    it('should record feedback for a user', () => {
      memory.recordFeedback('user-1', 'proj-1', { rating: 5 });

      const profile = memory.getProfile('user-1');
      expect(profile.feedback).toHaveLength(1);
      expect(profile.feedback[0].rating).toBe(5);
      expect(profile.feedback[0].projectId).toBe('proj-1');
    });

    it('should record feedback with optional comment', () => {
      memory.recordFeedback('user-1', 'proj-1', { rating: 4, comment: 'Great work!' });

      const profile = memory.getProfile('user-1');
      expect(profile.feedback[0].comment).toBe('Great work!');
    });

    it('should record feedback with specific sub-scores', () => {
      memory.recordFeedback('user-1', 'proj-1', {
        rating: 3,
        specificFeedback: { codeQuality: 4, correctness: 3, style: 5, documentation: 2 },
      });

      const profile = memory.getProfile('user-1');
      expect(profile.feedback[0].specificFeedback?.codeQuality).toBe(4);
    });

    it('should set timestamp on feedback', () => {
      memory.recordFeedback('user-1', 'proj-1', { rating: 5 });

      const profile = memory.getProfile('user-1');
      expect(profile.feedback[0].timestamp).toBeInstanceOf(Date);
    });

    it('should update pattern effectiveness based on rating', () => {
      // Create a project first
      const intent = createMockIntent();
      const plan = createMockPlan();
      memory.learnFromProject('user-1', intent, plan, createMockFiles(), true);

      const profile = memory.getProfile('user-1');
      const projectId = profile.history[0].id;

      // The pattern was just created, so lastUsed should be within the 60s window
      const originalEffectiveness = profile.patterns[0]?.effectiveness;

      memory.recordFeedback('user-1', projectId, { rating: 2 });

      // Pattern effectiveness should be updated (averaged with rating/5)
      const updatedProfile = memory.getProfile('user-1');
      if (updatedProfile.patterns.length > 0 && originalEffectiveness !== undefined) {
        // Effectiveness should change from original toward rating/5
        const expected = (originalEffectiveness + 2 / 5) / 2;
        expect(updatedProfile.patterns[0].effectiveness).toBeCloseTo(expected, 1);
      }
    });

    it('should not crash when project is not found', () => {
      // Recording feedback for a nonexistent project should not throw
      expect(() => {
        memory.recordFeedback('user-1', 'nonexistent-project', { rating: 3 });
      }).not.toThrow();

      const profile = memory.getProfile('user-1');
      expect(profile.feedback).toHaveLength(1);
    });

    it('should update updatedAt', () => {
      const profile = memory.getProfile('user-1');
      const before = profile.updatedAt;

      vi.useFakeTimers();
      vi.advanceTimersByTime(1000);

      memory.recordFeedback('user-1', 'proj-1', { rating: 5 });

      expect(memory.getProfile('user-1').updatedAt.getTime()).toBeGreaterThanOrEqual(
        before.getTime()
      );

      vi.useRealTimers();
    });

    it('should accumulate multiple feedback entries', () => {
      memory.recordFeedback('user-1', 'proj-1', { rating: 5 });
      memory.recordFeedback('user-1', 'proj-2', { rating: 3 });
      memory.recordFeedback('user-1', 'proj-3', { rating: 1 });

      const profile = memory.getProfile('user-1');
      expect(profile.feedback).toHaveLength(3);
    });
  });

  // -----------------------------------------------------------------------
  // getContextMemory
  // -----------------------------------------------------------------------

  describe('getContextMemory', () => {
    it('should return context memory for a new intent', () => {
      const ctx = memory.getContextMemory('user-1', createMockIntent());
      expect(ctx).toBeDefined();
      expect(ctx.userPreferences).toBeDefined();
      expect(ctx.recentProjects).toBeDefined();
      expect(ctx.relevantPatterns).toBeDefined();
      expect(ctx.suggestions).toBeDefined();
    });

    it('should return matching projects by projectType', () => {
      const intent = createMockIntent({ projectType: 'api' });
      memory.learnFromProject('user-1', intent, createMockPlan(), createMockFiles(), true);

      const ctx = memory.getContextMemory('user-1', createMockIntent({ projectType: 'api' }));
      expect(ctx.recentProjects.length).toBeGreaterThanOrEqual(1);
    });

    it('should return matching projects by primary technology', () => {
      const intent = createMockIntent({
        technologies: {
          primary: 'Python',
          secondary: [],
          runtime: 'python',
          packageManager: 'pip',
        },
        projectType: 'script',
      });
      memory.learnFromProject('user-1', intent, createMockPlan(), createMockFiles(), true);

      const query = createMockIntent({
        technologies: {
          primary: 'Python',
          secondary: [],
          runtime: 'python',
          packageManager: 'pip',
        },
        projectType: 'cli',
      });
      const ctx = memory.getContextMemory('user-1', query);
      expect(ctx.recentProjects.length).toBeGreaterThanOrEqual(1);
    });

    it('should only return successful projects', () => {
      const intent = createMockIntent();
      memory.learnFromProject('user-1', intent, createMockPlan(), createMockFiles(), false);

      const ctx = memory.getContextMemory('user-1', createMockIntent());
      expect(ctx.recentProjects).toHaveLength(0);
    });

    it('should limit recent projects to 5', () => {
      for (let i = 0; i < 10; i++) {
        memory.learnFromProject(
          'user-1',
          createMockIntent(),
          createMockPlan(),
          createMockFiles(),
          true
        );
      }

      const ctx = memory.getContextMemory('user-1', createMockIntent());
      expect(ctx.recentProjects.length).toBeLessThanOrEqual(5);
    });

    it('should return patterns matching projectType in context', () => {
      const profile = memory.getProfile('user-1');
      profile.patterns.push(
        createMockPattern({ context: 'web_app with moderate complexity', effectiveness: 0.95 })
      );

      const ctx = memory.getContextMemory('user-1', createMockIntent({ projectType: 'web_app' }));
      expect(ctx.relevantPatterns.length).toBeGreaterThanOrEqual(1);
    });

    it('should return patterns matching complexity in context', () => {
      const profile = memory.getProfile('user-1');
      profile.patterns.push(
        createMockPattern({ context: 'something with complex complexity', effectiveness: 0.85 })
      );

      const ctx = memory.getContextMemory('user-1', createMockIntent({ complexity: 'complex' }));
      expect(ctx.relevantPatterns.length).toBeGreaterThanOrEqual(1);
    });

    it('should sort relevant patterns by effectiveness descending', () => {
      const profile = memory.getProfile('user-1');
      profile.patterns.push(
        createMockPattern({ id: 'p1', context: 'web_app stuff', effectiveness: 0.5 }),
        createMockPattern({ id: 'p2', context: 'web_app stuff', effectiveness: 0.9 }),
        createMockPattern({ id: 'p3', context: 'web_app stuff', effectiveness: 0.7 })
      );

      const ctx = memory.getContextMemory('user-1', createMockIntent({ projectType: 'web_app' }));
      for (let i = 1; i < ctx.relevantPatterns.length; i++) {
        expect(ctx.relevantPatterns[i - 1].effectiveness).toBeGreaterThanOrEqual(
          ctx.relevantPatterns[i].effectiveness
        );
      }
    });

    it('should limit relevant patterns to 10', () => {
      const profile = memory.getProfile('user-1');
      for (let i = 0; i < 15; i++) {
        profile.patterns.push(createMockPattern({ id: `p-${i}`, context: 'web_app' }));
      }

      const ctx = memory.getContextMemory('user-1', createMockIntent({ projectType: 'web_app' }));
      expect(ctx.relevantPatterns.length).toBeLessThanOrEqual(10);
    });
  });

  // -----------------------------------------------------------------------
  // generateSuggestions (tested via getContextMemory)
  // -----------------------------------------------------------------------

  describe('generateSuggestions (via getContextMemory)', () => {
    it('should suggest tests when user prefers tests and complexity is not simple', () => {
      const ctx = memory.getContextMemory('user-1', createMockIntent({ complexity: 'moderate' }));
      expect(ctx.suggestions.some((s) => s.includes('tests'))).toBe(true);
    });

    it('should NOT suggest tests when complexity is simple', () => {
      const ctx = memory.getContextMemory('user-1', createMockIntent({ complexity: 'simple' }));
      expect(ctx.suggestions.some((s) => s.includes('comprehensive tests'))).toBe(false);
    });

    it('should suggest documentation when user prefers docs', () => {
      const ctx = memory.getContextMemory('user-1', createMockIntent());
      expect(ctx.suggestions.some((s) => s.includes('documentation'))).toBe(true);
    });

    it('should NOT suggest documentation when preferDocs is false', () => {
      memory.updatePreferences('user-1', { preferDocs: false });

      const ctx = memory.getContextMemory('user-1', createMockIntent());
      expect(ctx.suggestions.some((s) => s.includes('documentation'))).toBe(false);
    });

    it('should suggest a high-effectiveness pattern for the matching project type', () => {
      const profile = memory.getProfile('user-1');
      profile.patterns.push(
        createMockPattern({
          type: 'success',
          effectiveness: 0.9,
          pattern: 'clean-arch',
          context: 'web_app',
        })
      );

      const ctx = memory.getContextMemory('user-1', createMockIntent({ projectType: 'web_app' }));
      expect(ctx.suggestions.some((s) => s.includes('clean-arch'))).toBe(true);
    });

    it('should NOT suggest patterns with effectiveness <= 0.8', () => {
      const profile = memory.getProfile('user-1');
      profile.patterns.push(
        createMockPattern({
          type: 'success',
          effectiveness: 0.7,
          pattern: 'low-eff-pattern',
          context: 'web_app',
        })
      );

      const ctx = memory.getContextMemory('user-1', createMockIntent({ projectType: 'web_app' }));
      expect(ctx.suggestions.some((s) => s.includes('low-eff-pattern'))).toBe(false);
    });

    it('should warn about failed patterns that match the project type', () => {
      const profile = memory.getProfile('user-1');
      profile.patterns.push(
        createMockPattern({
          type: 'failure',
          pattern: 'monolith',
          context: 'web',
        })
      );

      const ctx = memory.getContextMemory('user-1', createMockIntent({ projectType: 'web_app' }));
      expect(ctx.suggestions.some((s) => s.includes('Avoiding') && s.includes('monolith'))).toBe(
        true
      );
    });

    it('should NOT warn about failed patterns for unrelated project types', () => {
      const profile = memory.getProfile('user-1');
      profile.patterns.push(
        createMockPattern({
          type: 'failure',
          pattern: 'bad-mobile-arch',
          context: 'mobile',
        })
      );

      const ctx = memory.getContextMemory('user-1', createMockIntent({ projectType: 'web_app' }));
      expect(ctx.suggestions.some((s) => s.includes('bad-mobile-arch'))).toBe(false);
    });

    it('should NOT suggest tests when preferTests is false', () => {
      memory.updatePreferences('user-1', { preferTests: false });

      const ctx = memory.getContextMemory('user-1', createMockIntent({ complexity: 'complex' }));
      expect(ctx.suggestions.some((s) => s.includes('comprehensive tests'))).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // getCodingStyleConfig
  // -----------------------------------------------------------------------

  describe('getCodingStyleConfig', () => {
    it('should return a Prettier-compatible config with default preferences', () => {
      const config = memory.getCodingStyleConfig('user-1');
      expect(config.semi).toBe(true);
      expect(config.singleQuote).toBe(true);
      expect(config.tabWidth).toBe(2);
      expect(config.useTabs).toBe(false);
      expect(config.trailingComma).toBe('all');
      expect(config.printWidth).toBe(100);
    });

    it('should reflect updated coding style preferences', () => {
      memory.updatePreferences('user-1', {
        codingStyle: {
          quotes: 'double',
          semicolons: false,
          indentation: 'tabs',
          indentSize: 4,
          trailingComma: false,
          maxLineLength: 80,
        },
      });

      const config = memory.getCodingStyleConfig('user-1');
      expect(config.semi).toBe(false);
      expect(config.singleQuote).toBe(false);
      expect(config.tabWidth).toBe(4);
      expect(config.useTabs).toBe(true);
      expect(config.trailingComma).toBe('none');
      expect(config.printWidth).toBe(80);
    });
  });

  // -----------------------------------------------------------------------
  // updatePreferences
  // -----------------------------------------------------------------------

  describe('updatePreferences', () => {
    it('should update a single preference field', () => {
      memory.updatePreferences('user-1', { packageManager: 'yarn' });

      const profile = memory.getProfile('user-1');
      expect(profile.preferences.packageManager).toBe('yarn');
    });

    it('should preserve other preferences when updating one', () => {
      memory.updatePreferences('user-1', { packageManager: 'pnpm' });

      const profile = memory.getProfile('user-1');
      expect(profile.preferences.preferredRuntime).toBe('node'); // unchanged
      expect(profile.preferences.preferTests).toBe(true); // unchanged
    });

    it('should update multiple preference fields at once', () => {
      memory.updatePreferences('user-1', {
        preferTests: false,
        preferDocs: false,
        defaultBranch: 'develop',
      });

      const profile = memory.getProfile('user-1');
      expect(profile.preferences.preferTests).toBe(false);
      expect(profile.preferences.preferDocs).toBe(false);
      expect(profile.preferences.defaultBranch).toBe('develop');
    });

    it('should update updatedAt timestamp', () => {
      const profile = memory.getProfile('user-1');
      const before = profile.updatedAt;

      vi.useFakeTimers();
      vi.advanceTimersByTime(1000);

      memory.updatePreferences('user-1', { packageManager: 'bun' });

      expect(memory.getProfile('user-1').updatedAt.getTime()).toBeGreaterThanOrEqual(
        before.getTime()
      );

      vi.useRealTimers();
    });
  });

  // -----------------------------------------------------------------------
  // getStats
  // -----------------------------------------------------------------------

  describe('getStats', () => {
    it('should return zeroed stats for a new user', () => {
      const stats = memory.getStats('user-1');
      expect(stats.totalProjects).toBe(0);
      expect(stats.successRate).toBe(0);
      expect(stats.averageRating).toBe(0);
      expect(stats.topLanguages).toEqual([]);
      expect(stats.topPatterns).toEqual([]);
    });

    it('should compute correct totalProjects', () => {
      memory.learnFromProject(
        'user-1',
        createMockIntent(),
        createMockPlan(),
        createMockFiles(),
        true
      );
      memory.learnFromProject(
        'user-1',
        createMockIntent(),
        createMockPlan(),
        createMockFiles(),
        false
      );

      const stats = memory.getStats('user-1');
      expect(stats.totalProjects).toBe(2);
    });

    it('should compute correct successRate', () => {
      memory.learnFromProject(
        'user-1',
        createMockIntent(),
        createMockPlan(),
        createMockFiles(),
        true
      );
      memory.learnFromProject(
        'user-1',
        createMockIntent(),
        createMockPlan(),
        createMockFiles(),
        true
      );
      memory.learnFromProject(
        'user-1',
        createMockIntent(),
        createMockPlan(),
        createMockFiles(),
        false
      );

      const stats = memory.getStats('user-1');
      expect(stats.successRate).toBeCloseTo(2 / 3, 2);
    });

    it('should compute correct averageRating', () => {
      memory.recordFeedback('user-1', 'p1', { rating: 5 });
      memory.recordFeedback('user-1', 'p2', { rating: 3 });
      memory.recordFeedback('user-1', 'p3', { rating: 4 });

      const stats = memory.getStats('user-1');
      expect(stats.averageRating).toBe(4);
    });

    it('should return top 3 languages by usage', () => {
      const langs = ['Go', 'Go', 'Go', 'Rust', 'Rust', 'Python'];
      for (const lang of langs) {
        const intent = createMockIntent({
          technologies: { primary: lang, secondary: [], runtime: 'node', packageManager: 'npm' },
        });
        memory.learnFromProject('user-1', intent, createMockPlan(), createMockFiles(), true);
      }

      const stats = memory.getStats('user-1');
      expect(stats.topLanguages[0]).toBe('Go');
      expect(stats.topLanguages[1]).toBe('Rust');
      expect(stats.topLanguages.length).toBeLessThanOrEqual(3);
    });

    it('should return top 3 success patterns by effectiveness * frequency', () => {
      const profile = memory.getProfile('user-1');
      profile.patterns.push(
        createMockPattern({ type: 'success', pattern: 'best', effectiveness: 1, frequency: 10 }),
        createMockPattern({ type: 'success', pattern: 'good', effectiveness: 0.9, frequency: 5 }),
        createMockPattern({ type: 'success', pattern: 'ok', effectiveness: 0.5, frequency: 3 }),
        createMockPattern({ type: 'success', pattern: 'meh', effectiveness: 0.1, frequency: 1 }),
        createMockPattern({
          type: 'failure',
          pattern: 'fail-pattern',
          effectiveness: 0.9,
          frequency: 10,
        })
      );

      const stats = memory.getStats('user-1');
      expect(stats.topPatterns).toEqual(['best', 'good', 'ok']);
    });

    it('should exclude failure patterns from topPatterns', () => {
      const profile = memory.getProfile('user-1');
      profile.patterns.push(
        createMockPattern({ type: 'failure', pattern: 'bad-one', effectiveness: 1, frequency: 100 })
      );

      const stats = memory.getStats('user-1');
      expect(stats.topPatterns).not.toContain('bad-one');
    });
  });

  // -----------------------------------------------------------------------
  // exportProfile / importProfile
  // -----------------------------------------------------------------------

  describe('exportProfile', () => {
    it('should export a valid JSON string', () => {
      memory.learnFromProject(
        'user-1',
        createMockIntent(),
        createMockPlan(),
        createMockFiles(),
        true
      );

      const exported = memory.exportProfile('user-1');
      expect(() => JSON.parse(exported)).not.toThrow();
    });

    it('should contain user profile data', () => {
      memory.learnFromProject(
        'user-1',
        createMockIntent(),
        createMockPlan(),
        createMockFiles(),
        true
      );

      const exported = memory.exportProfile('user-1');
      const parsed = JSON.parse(exported);
      expect(parsed.userId).toBe('user-1');
      expect(parsed.preferences).toBeDefined();
      expect(parsed.history).toBeDefined();
    });

    it('should export a new profile if user does not exist', () => {
      const exported = memory.exportProfile('new-user');
      const parsed = JSON.parse(exported);
      expect(parsed.userId).toBe('new-user');
    });
  });

  describe('importProfile', () => {
    it('should import a previously exported profile', () => {
      memory.learnFromProject(
        'user-1',
        createMockIntent(),
        createMockPlan(),
        createMockFiles(),
        true
      );
      const exported = memory.exportProfile('user-1');

      const newMemory = new MemorySystem();
      newMemory.importProfile(exported);

      const imported = newMemory.getProfile('user-1');
      expect(imported.userId).toBe('user-1');
      expect(imported.history.length).toBeGreaterThanOrEqual(1);
    });

    it('should overwrite existing profile on import', () => {
      memory.updatePreferences('user-1', { packageManager: 'yarn' });

      const otherProfile: UserProfile = {
        userId: 'user-1',
        preferences: {
          ...memory.getProfile('user-1').preferences,
          packageManager: 'pnpm',
        },
        history: [],
        patterns: [],
        feedback: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      memory.importProfile(JSON.stringify(otherProfile));

      const profile = memory.getProfile('user-1');
      expect(profile.preferences.packageManager).toBe('pnpm');
    });

    it('should update updatedAt on import', () => {
      const data: UserProfile = {
        userId: 'user-import',
        preferences: memory.getProfile('temp').preferences,
        history: [],
        patterns: [],
        feedback: [],
        createdAt: new Date('2020-01-01'),
        updatedAt: new Date('2020-01-01'),
      };

      memory.importProfile(JSON.stringify(data));

      const profile = memory.getProfile('user-import');
      // updatedAt is reset to "now" during import, so it should be newer than 2020
      expect(profile.updatedAt.getTime()).toBeGreaterThan(new Date('2020-06-01').getTime());
    });

    it('should handle invalid JSON gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => memory.importProfile('not valid json')).not.toThrow();

      consoleSpy.mockRestore();
    });

    it('should handle empty string gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => memory.importProfile('')).not.toThrow();

      consoleSpy.mockRestore();
    });
  });

  // -----------------------------------------------------------------------
  // clearProfile
  // -----------------------------------------------------------------------

  describe('clearProfile', () => {
    it('should remove a profile so a fresh one is created on next access', () => {
      memory.updatePreferences('user-1', { packageManager: 'yarn' });
      memory.clearProfile('user-1');

      const profile = memory.getProfile('user-1');
      // Should be a fresh profile with default preferences
      expect(profile.preferences.packageManager).toBe('npm');
    });

    it('should not throw when clearing a non-existent profile', () => {
      expect(() => memory.clearProfile('nonexistent')).not.toThrow();
    });

    it('should not affect other profiles', () => {
      memory.updatePreferences('user-1', { packageManager: 'yarn' });
      memory.updatePreferences('user-2', { packageManager: 'pnpm' });

      memory.clearProfile('user-1');

      const p2 = memory.getProfile('user-2');
      expect(p2.preferences.packageManager).toBe('pnpm');
    });
  });
});
