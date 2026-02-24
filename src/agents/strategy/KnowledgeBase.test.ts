import { describe, it, expect, vi } from 'vitest';

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: vi.fn(() => ({ select: vi.fn(() => ({ data: [], error: null })) })),
      select: vi.fn(() => ({ data: [], error: null })),
    })),
  })),
}));

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { buildKnowledgePromptContext } from './KnowledgeBase';
import type { KnowledgeContext } from './types';

describe('buildKnowledgePromptContext', () => {
  it('should return empty string when no findings', () => {
    const context: KnowledgeContext = {
      entries: [],
      domains: [],
      totalFindings: 0,
    };
    expect(buildKnowledgePromptContext(context)).toBe('');
  });

  it('should return formatted string for context with entries', () => {
    const context: KnowledgeContext = {
      entries: [
        {
          id: '1',
          userId: 'u1',
          sessionId: 's1',
          agentMode: 'strategy',
          findingType: 'data_point',
          title: 'Housing costs rising',
          content: 'Average home price increased 10% YoY in the metro area.',
          confidence: 'high',
          relevanceScore: 0.9,
          sources: [],
          dataPoints: [],
          domain: 'housing',
          topicTags: ['housing', 'prices'],
          searchQueries: [],
          createdAt: new Date().toISOString(),
        },
      ],
      domains: ['housing'],
      totalFindings: 1,
    };
    const result = buildKnowledgePromptContext(context);
    expect(result).toContain('PRIOR RESEARCH');
    expect(result).toContain('housing');
    expect(result).toContain('Housing costs rising');
    expect(result).toContain('[high]');
  });

  it('should group entries by domain', () => {
    const context: KnowledgeContext = {
      entries: [
        {
          id: '1',
          userId: 'u1',
          sessionId: 's1',
          agentMode: 'strategy',
          findingType: 'data_point',
          title: 'Housing data',
          content: 'Price data',
          confidence: 'high',
          relevanceScore: 0.9,
          sources: [],
          dataPoints: [],
          domain: 'housing',
          topicTags: [],
          searchQueries: [],
          createdAt: '',
        },
        {
          id: '2',
          userId: 'u1',
          sessionId: 's1',
          agentMode: 'strategy',
          findingType: 'insight',
          title: 'Job data',
          content: 'Employment rates',
          confidence: 'medium',
          relevanceScore: 0.7,
          sources: [],
          dataPoints: [],
          domain: 'jobs',
          topicTags: [],
          searchQueries: [],
          createdAt: '',
        },
      ],
      domains: ['housing', 'jobs'],
      totalFindings: 2,
    };
    const result = buildKnowledgePromptContext(context);
    expect(result).toContain('## housing');
    expect(result).toContain('## jobs');
  });

  it('should truncate long content', () => {
    const longContent = 'x'.repeat(500);
    const context: KnowledgeContext = {
      entries: [
        {
          id: '1',
          userId: 'u1',
          sessionId: 's1',
          agentMode: 'strategy',
          findingType: 'data_point',
          title: 'Long entry',
          content: longContent,
          confidence: 'medium',
          relevanceScore: 0.5,
          sources: [],
          dataPoints: [],
          domain: 'test',
          topicTags: [],
          searchQueries: [],
          createdAt: '',
        },
      ],
      domains: ['test'],
      totalFindings: 1,
    };
    const result = buildKnowledgePromptContext(context);
    expect(result).toContain('...');
    // Content should be truncated at 200 chars
    expect(result.length).toBeLessThan(longContent.length + 200);
  });

  it('should include leverage guidance', () => {
    const context: KnowledgeContext = {
      entries: [
        {
          id: '1',
          userId: 'u1',
          sessionId: 's1',
          agentMode: 'strategy',
          findingType: 'data_point',
          title: 'Test',
          content: 'Content',
          confidence: 'low',
          relevanceScore: 0.3,
          sources: [],
          dataPoints: [],
          domain: 'test',
          topicTags: [],
          searchQueries: [],
          createdAt: '',
        },
      ],
      domains: ['test'],
      totalFindings: 1,
    };
    const result = buildKnowledgePromptContext(context);
    expect(result).toContain('Leverage these prior findings');
    expect(result).toContain('Do NOT re-research');
  });

  it('should limit entries per domain to 10', () => {
    const entries = Array.from({ length: 15 }, (_, i) => ({
      id: `${i}`,
      userId: 'u1',
      sessionId: 's1',
      agentMode: 'strategy' as const,
      findingType: 'data_point',
      title: `Entry ${i}`,
      content: `Content ${i}`,
      confidence: 'medium' as const,
      relevanceScore: 0.5,
      sources: [] as never[],
      dataPoints: [] as never[],
      domain: 'housing',
      topicTags: [] as string[],
      searchQueries: [] as string[],
      createdAt: '',
    }));
    const context: KnowledgeContext = {
      entries,
      domains: ['housing'],
      totalFindings: 15,
    };
    const result = buildKnowledgePromptContext(context);
    expect(result).toContain('Entry 0');
    expect(result).toContain('Entry 9');
    expect(result).not.toContain('Entry 10');
  });
});
