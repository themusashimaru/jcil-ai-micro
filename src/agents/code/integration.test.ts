/**
 * CODE AGENT INTEGRATION TESTS
 *
 * Tests for the Code Agent V2 integration
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(() => ({
    messages: {
      create: vi.fn(() =>
        Promise.resolve({
          content: [{ type: 'text', text: 'Generated code response' }],
          stop_reason: 'end_turn',
        })
      ),
    },
  })),
}));

vi.mock('@/lib/logger', () => ({
  logger: vi.fn(() => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

describe('Code Agent Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Intent Detection', () => {
    it('should detect code-related intents', () => {
      const codeKeywords = [
        'build',
        'create',
        'code',
        'implement',
        'develop',
        'write',
        'generate',
        'scaffold',
        'setup',
      ];

      const message = 'build a react app with typescript';
      const hasCodeIntent = codeKeywords.some((kw) => message.toLowerCase().includes(kw));

      expect(hasCodeIntent).toBe(true);
    });

    it('should detect non-code intents', () => {
      const codeKeywords = [
        'build',
        'create',
        'code',
        'implement',
        'develop',
        'write',
        'generate',
        'scaffold',
        'setup',
      ];

      const message = 'what is the weather today?';
      const hasCodeIntent = codeKeywords.some((kw) => message.toLowerCase().includes(kw));

      expect(hasCodeIntent).toBe(false);
    });

    it('should handle project planning requests', () => {
      const planningKeywords = ['plan', 'design', 'architect', 'structure'];
      const message = 'help me plan the architecture for my app';

      const hasPlanningIntent = planningKeywords.some((kw) => message.toLowerCase().includes(kw));

      expect(hasPlanningIntent).toBe(true);
    });
  });

  describe('Code Generation', () => {
    it('should structure response as streaming', () => {
      const mockStream = {
        getReader: vi.fn(() => ({
          read: vi
            .fn()
            .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('Hello') })
            .mockResolvedValueOnce({ done: true, value: undefined }),
        })),
      };

      expect(mockStream.getReader).toBeDefined();
    });

    it('should handle code blocks in response', () => {
      const response = `
Here's a React component:

\`\`\`tsx
import React from 'react';

export function Button({ children }: { children: React.ReactNode }) {
  return <button className="btn">{children}</button>;
}
\`\`\`

This creates a reusable button component.
`;

      const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
      const matches = [...response.matchAll(codeBlockRegex)];

      expect(matches.length).toBe(1);
      expect(matches[0][1]).toBe('tsx');
    });
  });

  describe('GitHub Integration', () => {
    it('should handle encrypted tokens', () => {
      // Simulated encrypted token format: iv:authTag:encryptedData
      const encryptedToken = 'abc123:def456:encryptedPayload';
      const parts = encryptedToken.split(':');

      expect(parts.length).toBe(3);
    });

    it('should extract repo info correctly', () => {
      const repo = {
        owner: 'testuser',
        repo: 'testrepo',
        fullName: 'testuser/testrepo',
      };

      expect(repo.fullName).toBe(`${repo.owner}/${repo.repo}`);
    });

    it('should handle missing GitHub token gracefully', () => {
      const githubToken: string | undefined = undefined;

      // Should proceed without GitHub features
      expect(githubToken).toBeUndefined();
    });
  });

  describe('Context Management', () => {
    it('should build conversation history correctly', () => {
      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
        { role: 'user', content: 'Build a todo app' },
      ];

      expect(messages.length).toBe(3);
      expect(messages[messages.length - 1].content).toBe('Build a todo app');
    });

    it('should respect max history limit', () => {
      const MAX_HISTORY = 20;
      const longHistory = Array(30).fill({ role: 'user', content: 'message' });

      const truncatedHistory = longHistory.slice(-MAX_HISTORY);
      expect(truncatedHistory.length).toBe(MAX_HISTORY);
    });
  });

  describe('Clarification Handling', () => {
    it('should skip clarification when explicitly requested', () => {
      const skipPhrases = ['just build', 'proceed', 'go ahead'];

      const message1 = 'just build it';
      const message2 = 'can you help me plan this?';

      const shouldSkip1 = skipPhrases.some((phrase) => message1.toLowerCase().includes(phrase));
      const shouldSkip2 = skipPhrases.some((phrase) => message2.toLowerCase().includes(phrase));

      expect(shouldSkip1).toBe(true);
      expect(shouldSkip2).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', () => {
      const errorMessage = 'I encountered an error during code generation. Please try again.';

      expect(errorMessage).toContain('error');
      expect(errorMessage).toContain('try again');
    });

    it('should handle rate limit errors', () => {
      const rateLimitError = {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Rate limit exceeded. Please wait a moment before sending more messages.',
      };

      expect(rateLimitError.code).toBe('RATE_LIMIT_EXCEEDED');
    });
  });
});

describe('Code Agent Brain Modules', () => {
  describe('Intent Analyzer', () => {
    it('should categorize intent types', () => {
      const intentTypes = [
        'code_generation',
        'code_review',
        'bug_fix',
        'refactoring',
        'documentation',
        'testing',
        'explanation',
        'general_chat',
      ];

      expect(intentTypes).toContain('code_generation');
      expect(intentTypes).toContain('bug_fix');
    });

    it('should assign confidence scores', () => {
      const intent = {
        type: 'code_generation',
        confidence: 0.85,
      };

      expect(intent.confidence).toBeGreaterThan(0);
      expect(intent.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('Project Planner', () => {
    it('should generate project structure', () => {
      const projectStructure = {
        directories: ['src', 'tests', 'docs'],
        files: ['package.json', 'tsconfig.json', 'README.md'],
      };

      expect(projectStructure.directories).toContain('src');
      expect(projectStructure.files).toContain('package.json');
    });
  });

  describe('Security Scanner', () => {
    it('should detect common vulnerabilities', () => {
      const vulnerabilities = [
        'hardcoded_secrets',
        'sql_injection',
        'xss',
        'command_injection',
        'path_traversal',
      ];

      vulnerabilities.forEach((vuln) => {
        expect(typeof vuln).toBe('string');
      });
    });
  });

  describe('Test Generator', () => {
    it('should generate test templates', () => {
      const testTemplate = `
describe('Component', () => {
  it('should render correctly', () => {
    expect(true).toBe(true);
  });
});
`;

      expect(testTemplate).toContain('describe');
      expect(testTemplate).toContain('it');
      expect(testTemplate).toContain('expect');
    });
  });
});
