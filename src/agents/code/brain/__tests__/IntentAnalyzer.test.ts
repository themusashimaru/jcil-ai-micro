// @ts-nocheck - Test file with extensive mocking
/**
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================
// MOCKS
// ============================================

const mockAgentChat = vi.fn();
vi.mock('@/lib/ai/providers', () => ({
  agentChat: (...args: unknown[]) => mockAgentChat(...args),
}));

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// ============================================
// IMPORTS
// ============================================

import { CodeIntentAnalyzer, codeIntentAnalyzer } from '../IntentAnalyzer';

// ============================================
// HELPERS
// ============================================

function makeContext(overrides = {}) {
  return {
    previousMessages: [],
    ...overrides,
  };
}

function makeAnalyzeResponse(overrides = {}) {
  return {
    text: JSON.stringify({
      refinedDescription: 'Build a REST API',
      projectType: 'api',
      requirements: {
        functional: ['CRUD endpoints'],
        technical: ['Express', 'TypeScript'],
        constraints: [],
      },
      complexity: 'moderate',
      estimatedFiles: 8,
      technologies: {
        primary: 'TypeScript with Express',
        secondary: ['zod', 'dotenv'],
        runtime: 'node',
        packageManager: 'npm',
        testFramework: 'vitest',
      },
      contextClues: {
        hasExistingCode: false,
        targetPlatform: 'server',
        integrations: [],
      },
      criticalThinking: {
        assumptions: ['No auth needed'],
        risks: ['Schema changes'],
        questions: [],
      },
      ...overrides,
    }),
  };
}

function makeClarificationResponse(overrides = {}) {
  return {
    text: JSON.stringify({
      clarityScore: 45,
      needsClarification: true,
      questions: [
        {
          question: 'What database should be used?',
          reason: 'Affects architecture',
          options: ['PostgreSQL', 'MongoDB', 'SQLite'],
          priority: 'critical',
        },
      ],
      assumptions: ['TypeScript'],
      potentialIssues: ['No db selected'],
      suggestions: ['Use PostgreSQL for relational data'],
      ...overrides,
    }),
  };
}

// ============================================
// TESTS
// ============================================

describe('CodeIntentAnalyzer', () => {
  let analyzer: CodeIntentAnalyzer;

  beforeEach(() => {
    vi.clearAllMocks();
    analyzer = new CodeIntentAnalyzer();
  });

  // -----------------------------------------------------------------------
  // setProvider
  // -----------------------------------------------------------------------

  describe('setProvider', () => {
    it('should not throw', () => {
      expect(() => analyzer.setProvider('openai')).not.toThrow();
    });

    it('should accept any provider ID', () => {
      expect(() => analyzer.setProvider('deepseek')).not.toThrow();
    });
  });

  // -----------------------------------------------------------------------
  // checkClarification
  // -----------------------------------------------------------------------

  describe('checkClarification', () => {
    it('should call agentChat with user request', async () => {
      mockAgentChat.mockResolvedValue(makeClarificationResponse());
      await analyzer.checkClarification('Build an API', makeContext());
      expect(mockAgentChat).toHaveBeenCalledTimes(1);
    });

    it('should return parsed clarification result', async () => {
      mockAgentChat.mockResolvedValue(makeClarificationResponse());
      const result = await analyzer.checkClarification('Build an API', makeContext());

      expect(result.needsClarification).toBe(true);
      expect(result.clarityScore).toBe(45);
      expect(result.questions).toHaveLength(1);
      expect(result.questions[0].question).toBe('What database should be used?');
      expect(result.questions[0].priority).toBe('critical');
    });

    it('should include question options', async () => {
      mockAgentChat.mockResolvedValue(makeClarificationResponse());
      const result = await analyzer.checkClarification('Build an API', makeContext());

      expect(result.questions[0].options).toContain('PostgreSQL');
    });

    it('should return default result if AI fails', async () => {
      mockAgentChat.mockRejectedValue(new Error('API error'));
      const result = await analyzer.checkClarification('Build an API', makeContext());

      expect(result.needsClarification).toBe(false);
      expect(result.clarityScore).toBe(70);
      expect(result.questions).toHaveLength(0);
    });

    it('should return default result if no JSON in response', async () => {
      mockAgentChat.mockResolvedValue({ text: 'No JSON here, just natural language.' });
      const result = await analyzer.checkClarification('Build an API', makeContext());

      expect(result.needsClarification).toBe(false);
      expect(result.clarityScore).toBe(70);
    });

    it('should include conversation context if available', async () => {
      mockAgentChat.mockResolvedValue(makeClarificationResponse());
      await analyzer.checkClarification(
        'Build an API',
        makeContext({
          previousMessages: [
            { role: 'user', content: 'I want a REST API' },
            { role: 'assistant', content: 'Sure, what kind?' },
          ],
        })
      );

      const prompt = mockAgentChat.mock.calls[0][0][0].content;
      expect(prompt).toContain('I want a REST API');
    });

    it('should validate priority values', async () => {
      mockAgentChat.mockResolvedValue(
        makeClarificationResponse({
          questions: [{ question: 'Q?', reason: 'R', priority: 'invalid_priority' }],
        })
      );

      const result = await analyzer.checkClarification('Build an API', makeContext());
      expect(result.questions[0].priority).toBe('important'); // defaults
    });

    it('should handle missing questions array', async () => {
      mockAgentChat.mockResolvedValue({
        text: JSON.stringify({
          clarityScore: 90,
          needsClarification: false,
        }),
      });

      const result = await analyzer.checkClarification('Simple script', makeContext());
      expect(result.questions).toHaveLength(0);
    });

    it('should handle missing assumptions/issues/suggestions', async () => {
      mockAgentChat.mockResolvedValue({
        text: JSON.stringify({
          clarityScore: 80,
          needsClarification: false,
          questions: [],
        }),
      });

      const result = await analyzer.checkClarification('Script', makeContext());
      expect(result.assumptions).toHaveLength(0);
      expect(result.potentialIssues).toHaveLength(0);
      expect(result.suggestions).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // analyze
  // -----------------------------------------------------------------------

  describe('analyze', () => {
    it('should call agentChat and return parsed intent', async () => {
      mockAgentChat.mockResolvedValue(makeAnalyzeResponse());
      const result = await analyzer.analyze('Build a REST API', makeContext());

      expect(result.originalRequest).toBe('Build a REST API');
      expect(result.refinedDescription).toBe('Build a REST API');
      expect(result.projectType).toBe('api');
      expect(result.complexity).toBe('moderate');
    });

    it('should populate technologies', async () => {
      mockAgentChat.mockResolvedValue(makeAnalyzeResponse());
      const result = await analyzer.analyze('Build a REST API', makeContext());

      expect(result.technologies.primary).toBe('TypeScript with Express');
      expect(result.technologies.runtime).toBe('node');
      expect(result.technologies.packageManager).toBe('npm');
    });

    it('should return fallback intent if AI fails', async () => {
      mockAgentChat.mockRejectedValue(new Error('API error'));
      const result = await analyzer.analyze('Build an api backend', makeContext());

      expect(result.originalRequest).toBe('Build an api backend');
      expect(result.projectType).toBe('api');
      expect(result.technologies.primary).toBe('TypeScript');
    });

    it('should return fallback intent if no JSON in response', async () => {
      mockAgentChat.mockResolvedValue({ text: 'I think we should build...' });
      const result = await analyzer.analyze('Build a CLI tool', makeContext());

      expect(result.projectType).toBe('cli');
    });

    it('should validate project type', async () => {
      mockAgentChat.mockResolvedValue(makeAnalyzeResponse({ projectType: 'invalid_type' }));
      const result = await analyzer.analyze('Something', makeContext());

      expect(result.projectType).toBe('unknown');
    });

    it('should validate complexity', async () => {
      mockAgentChat.mockResolvedValue(makeAnalyzeResponse({ complexity: 'super_hard' }));
      const result = await analyzer.analyze('Something', makeContext());

      expect(result.complexity).toBe('moderate');
    });

    it('should validate technology runtime', async () => {
      mockAgentChat.mockResolvedValue(
        makeAnalyzeResponse({
          technologies: { primary: 'Go', runtime: 'go', packageManager: 'go_mod' },
        })
      );
      const result = await analyzer.analyze('Something', makeContext());

      expect(result.technologies.runtime).toBe('node'); // defaults
      expect(result.technologies.packageManager).toBe('npm'); // defaults
    });

    it('should handle null technologies gracefully', async () => {
      mockAgentChat.mockResolvedValue(makeAnalyzeResponse({ technologies: null }));
      const result = await analyzer.analyze('Something', makeContext());

      expect(result.technologies.primary).toBe('TypeScript');
      expect(result.technologies.secondary).toEqual([]);
    });

    it('should default estimatedFiles to 5 if not a number', async () => {
      mockAgentChat.mockResolvedValue(makeAnalyzeResponse({ estimatedFiles: 'many' }));
      const result = await analyzer.analyze('Something', makeContext());

      expect(result.estimatedFiles).toBe(5);
    });

    it('should populate contextClues', async () => {
      mockAgentChat.mockResolvedValue(makeAnalyzeResponse());
      const result = await analyzer.analyze('Something', makeContext());

      expect(result.contextClues.hasExistingCode).toBe(false);
      expect(result.contextClues.targetPlatform).toBe('server');
    });
  });

  // -----------------------------------------------------------------------
  // Fallback intent heuristics
  // -----------------------------------------------------------------------

  describe('fallback intent heuristics', () => {
    beforeEach(() => {
      mockAgentChat.mockRejectedValue(new Error('fail'));
    });

    it('should detect API projects', async () => {
      const result = await analyzer.analyze('Build an API', makeContext());
      expect(result.projectType).toBe('api');
    });

    it('should detect backend projects', async () => {
      const result = await analyzer.analyze('Create a backend server', makeContext());
      expect(result.projectType).toBe('api');
    });

    it('should detect CLI projects', async () => {
      const result = await analyzer.analyze('Make a CLI tool', makeContext());
      expect(result.projectType).toBe('cli');
    });

    it('should detect command line projects', async () => {
      const result = await analyzer.analyze('Build a command line app', makeContext());
      expect(result.projectType).toBe('cli');
    });

    it('should detect web app projects', async () => {
      const result = await analyzer.analyze('Create a website', makeContext());
      expect(result.projectType).toBe('web_app');
    });

    it('should detect frontend projects', async () => {
      const result = await analyzer.analyze('Build a frontend app', makeContext());
      expect(result.projectType).toBe('web_app');
    });

    it('should detect Python projects', async () => {
      const result = await analyzer.analyze('Write a python script', makeContext());
      expect(result.technologies.primary).toBe('Python');
      expect(result.technologies.runtime).toBe('python');
      expect(result.technologies.packageManager).toBe('pip');
    });

    it('should default to TypeScript for non-Python', async () => {
      const result = await analyzer.analyze('Build something', makeContext());
      expect(result.technologies.primary).toBe('TypeScript');
      expect(result.technologies.runtime).toBe('node');
    });

    it('should estimate simple scripts at 3 files', async () => {
      const result = await analyzer.analyze('Write a short script', makeContext());
      expect(result.estimatedFiles).toBe(3);
    });

    it('should estimate non-script API projects at 8 files', async () => {
      // Request must be >= 100 chars to not be classified as "script"
      const longRequest =
        'Build a REST API backend server with authentication, authorization, database connections, and CRUD endpoints for users, posts, and comments';
      const result = await analyzer.analyze(longRequest, makeContext());
      expect(result.estimatedFiles).toBe(8);
    });

    it('should set refinedDescription with prefix', async () => {
      const result = await analyzer.analyze('Something cool', makeContext());
      expect(result.refinedDescription).toBe('Build: Something cool');
    });
  });

  // -----------------------------------------------------------------------
  // isCodeRequest (static)
  // -----------------------------------------------------------------------

  describe('isCodeRequest', () => {
    it('should recognize "build an app"', () => {
      expect(CodeIntentAnalyzer.isCodeRequest('Build an app')).toBe(true);
    });

    it('should recognize "create a website"', () => {
      expect(CodeIntentAnalyzer.isCodeRequest('Create a website')).toBe(true);
    });

    it('should recognize "can you build a tool"', () => {
      expect(CodeIntentAnalyzer.isCodeRequest('Can you build a tool')).toBe(true);
    });

    it('should recognize "please create a function"', () => {
      expect(CodeIntentAnalyzer.isCodeRequest('Please create a function')).toBe(true);
    });

    it('should recognize "generate a project"', () => {
      expect(CodeIntentAnalyzer.isCodeRequest('Generate a project')).toBe(true);
    });

    it('should recognize "fix the code bug"', () => {
      expect(CodeIntentAnalyzer.isCodeRequest('Fix the code bug')).toBe(true);
    });

    it('should recognize "add a feature endpoint"', () => {
      expect(CodeIntentAnalyzer.isCodeRequest('Add a feature endpoint')).toBe(true);
    });

    it('should recognize keyword-dense messages', () => {
      expect(CodeIntentAnalyzer.isCodeRequest('I need code and a function')).toBe(true);
    });

    it('should recognize multiple code keywords', () => {
      expect(CodeIntentAnalyzer.isCodeRequest('typescript react app')).toBe(true);
    });

    it('should reject generic messages', () => {
      expect(CodeIntentAnalyzer.isCodeRequest('Hello, how are you?')).toBe(false);
    });

    it('should reject non-code questions', () => {
      expect(CodeIntentAnalyzer.isCodeRequest('What is the weather today?')).toBe(false);
    });

    it('should reject empty strings', () => {
      expect(CodeIntentAnalyzer.isCodeRequest('')).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Singleton export
  // -----------------------------------------------------------------------

  describe('codeIntentAnalyzer singleton', () => {
    it('should be an instance of CodeIntentAnalyzer', () => {
      expect(codeIntentAnalyzer).toBeInstanceOf(CodeIntentAnalyzer);
    });
  });
});
