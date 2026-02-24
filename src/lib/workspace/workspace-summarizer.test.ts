import { describe, it, expect, vi } from 'vitest';
import {
  WorkspaceSummarizer,
  getWorkspaceSummarizer,
  getWorkspaceSummarizationTools,
  isWorkspaceSummarizationTool,
} from './workspace-summarizer';

// Mock dependencies
vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

const mockCreate = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: (...args: unknown[]) => mockCreate(...args) };
  },
}));

// -------------------------------------------------------------------
// WorkspaceSummarizer
// -------------------------------------------------------------------
describe('WorkspaceSummarizer', () => {
  describe('getContext', () => {
    it('should create empty context for new workspace', () => {
      const summarizer = new WorkspaceSummarizer();
      const ctx = summarizer.getContext('ws1');
      expect(ctx.projectSummary).toBeNull();
      expect(ctx.fileSummaries.size).toBe(0);
      expect(ctx.recentChanges).toHaveLength(0);
      expect(ctx.topics.size).toBe(0);
    });

    it('should return same context for same workspace', () => {
      const summarizer = new WorkspaceSummarizer();
      const ctx1 = summarizer.getContext('ws1');
      const ctx2 = summarizer.getContext('ws1');
      expect(ctx1).toBe(ctx2);
    });
  });

  describe('summarizeFile', () => {
    it('should return a file summary from API', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              summary: 'A utility file',
              topics: ['utils', 'helpers'],
              exports: ['formatDate'],
              dependencies: ['dayjs'],
              complexity: 'low',
            }),
          },
        ],
      });

      const summarizer = new WorkspaceSummarizer();
      const result = await summarizer.summarizeFile(
        'ws1',
        'utils.ts',
        'export function formatDate() {}'
      );

      expect(result.path).toBe('utils.ts');
      expect(result.summary).toBe('A utility file');
      expect(result.topics).toContain('utils');
      expect(result.exports).toContain('formatDate');
    });

    it('should handle parse error gracefully', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'not valid json at all' }],
      });

      const summarizer = new WorkspaceSummarizer();
      const result = await summarizer.summarizeFile('ws1', 'bad.ts', 'content');

      expect(result.summary).toBe('No summary available');
      expect(result.topics).toHaveLength(0);
    });

    it('should update topic index', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              summary: 'Auth module',
              topics: ['auth', 'security'],
              exports: [],
              dependencies: [],
              complexity: 'high',
            }),
          },
        ],
      });

      const summarizer = new WorkspaceSummarizer();
      await summarizer.summarizeFile('ws1', 'auth.ts', 'code');

      const ctx = summarizer.getContext('ws1');
      expect(ctx.topics.get('auth')).toContain('auth.ts');
      expect(ctx.topics.get('security')).toContain('auth.ts');
    });
  });

  describe('summarizeProject', () => {
    it('should return a project summary from API', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              name: 'Test Project',
              description: 'A test project',
              techStack: ['TypeScript', 'React'],
              mainComponents: ['App', 'Router'],
              architecture: 'Modular',
              keyFeatures: ['Auth', 'Dashboard'],
            }),
          },
        ],
      });

      const summarizer = new WorkspaceSummarizer();
      const result = await summarizer.summarizeProject('ws1', [
        { path: 'index.ts', content: 'import React from "react";' },
      ]);

      expect(result.name).toBe('Test Project');
      expect(result.techStack).toContain('TypeScript');
    });

    it('should handle parse error gracefully', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'invalid' }],
      });

      const summarizer = new WorkspaceSummarizer();
      const result = await summarizer.summarizeProject('ws1', []);

      expect(result.name).toBe('Unknown Project');
    });
  });

  describe('summarizeChanges', () => {
    it('should return a change summary from API', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              summary: 'Added auth feature',
              impact: 'high',
              breakingChanges: false,
              topics: ['auth'],
            }),
          },
        ],
      });

      const summarizer = new WorkspaceSummarizer();
      const result = await summarizer.summarizeChanges('ws1', [
        { path: 'auth.ts', diff: '+new code', changeType: 'modified' },
      ]);

      expect(result.summary).toBe('Added auth feature');
      expect(result.impact).toBe('high');
      expect(result.files).toContain('auth.ts');
    });

    it('should track recent changes in context', async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              summary: 'Change 1',
              impact: 'low',
              breakingChanges: false,
              topics: [],
            }),
          },
        ],
      });

      const summarizer = new WorkspaceSummarizer();
      await summarizer.summarizeChanges('ws1', [{ path: 'a.ts', diff: '+x', changeType: 'added' }]);

      const ctx = summarizer.getContext('ws1');
      expect(ctx.recentChanges).toHaveLength(1);
    });
  });

  describe('searchByTopic', () => {
    it('should find files by exact topic', async () => {
      const summarizer = new WorkspaceSummarizer();
      const ctx = summarizer.getContext('ws1');
      ctx.topics.set('auth', ['auth.ts', 'login.ts']);

      const files = summarizer.searchByTopic('ws1', 'auth');
      expect(files).toContain('auth.ts');
      expect(files).toContain('login.ts');
    });

    it('should find files by related topic', async () => {
      const summarizer = new WorkspaceSummarizer();
      const ctx = summarizer.getContext('ws1');
      ctx.topics.set('authentication', ['auth.ts']);

      const files = summarizer.searchByTopic('ws1', 'auth');
      expect(files).toContain('auth.ts');
    });

    it('should return empty for unknown topic', () => {
      const summarizer = new WorkspaceSummarizer();
      expect(summarizer.searchByTopic('ws1', 'nonexistent')).toHaveLength(0);
    });
  });

  describe('generateContextForAssistant', () => {
    it('should include project summary', async () => {
      const summarizer = new WorkspaceSummarizer();
      const ctx = summarizer.getContext('ws1');
      ctx.projectSummary = {
        name: 'My Project',
        description: 'A test project',
        techStack: ['TS'],
        mainComponents: [],
        architecture: 'Modular',
        keyFeatures: ['Auth'],
        generatedAt: Date.now(),
      };

      const result = await summarizer.generateContextForAssistant('ws1', 'test query');
      expect(result).toContain('My Project');
      expect(result).toContain('test project');
    });

    it('should include relevant file summaries', async () => {
      const summarizer = new WorkspaceSummarizer();
      const ctx = summarizer.getContext('ws1');
      ctx.fileSummaries.set('auth.ts', {
        path: 'auth.ts',
        summary: 'Authentication module',
        topics: ['auth'],
        exports: ['login'],
        dependencies: [],
        complexity: 'high',
        lastUpdated: Date.now(),
      });

      const result = await summarizer.generateContextForAssistant('ws1', 'query', {
        relevantFiles: ['auth.ts'],
      });
      expect(result).toContain('Authentication module');
    });

    it('should include recent changes', async () => {
      const summarizer = new WorkspaceSummarizer();
      const ctx = summarizer.getContext('ws1');
      ctx.recentChanges.push({
        files: ['a.ts'],
        summary: 'Updated auth',
        impact: 'medium',
        breakingChanges: false,
        topics: [],
        timestamp: Date.now(),
      });

      const result = await summarizer.generateContextForAssistant('ws1', 'query');
      expect(result).toContain('Updated auth');
    });
  });

  describe('clearContext', () => {
    it('should clear workspace context', () => {
      const summarizer = new WorkspaceSummarizer();
      const ctx = summarizer.getContext('ws1');
      ctx.topics.set('test', ['f.ts']);
      summarizer.clearContext('ws1');
      const freshCtx = summarizer.getContext('ws1');
      expect(freshCtx.topics.size).toBe(0);
    });
  });

  describe('getAllTopics', () => {
    it('should return all topics', () => {
      const summarizer = new WorkspaceSummarizer();
      const ctx = summarizer.getContext('ws1');
      ctx.topics.set('auth', ['a.ts']);
      ctx.topics.set('db', ['b.ts']);
      expect(summarizer.getAllTopics('ws1')).toEqual(['auth', 'db']);
    });

    it('should return empty for fresh workspace', () => {
      const summarizer = new WorkspaceSummarizer();
      expect(summarizer.getAllTopics('ws-new')).toHaveLength(0);
    });
  });
});

// -------------------------------------------------------------------
// getWorkspaceSummarizer (singleton)
// -------------------------------------------------------------------
describe('getWorkspaceSummarizer', () => {
  it('should return same instance', () => {
    expect(getWorkspaceSummarizer()).toBe(getWorkspaceSummarizer());
  });
});

// -------------------------------------------------------------------
// getWorkspaceSummarizationTools
// -------------------------------------------------------------------
describe('getWorkspaceSummarizationTools', () => {
  it('should return 4 tools', () => {
    const tools = getWorkspaceSummarizationTools();
    expect(tools).toHaveLength(4);
    expect(tools.map((t) => t.name)).toEqual([
      'summarize_file',
      'summarize_project',
      'search_by_topic',
      'get_workspace_context',
    ]);
  });
});

// -------------------------------------------------------------------
// isWorkspaceSummarizationTool
// -------------------------------------------------------------------
describe('isWorkspaceSummarizationTool', () => {
  it('should return true for summarization tools', () => {
    expect(isWorkspaceSummarizationTool('summarize_file')).toBe(true);
    expect(isWorkspaceSummarizationTool('search_by_topic')).toBe(true);
  });

  it('should return false for other tools', () => {
    expect(isWorkspaceSummarizationTool('other')).toBe(false);
  });
});
