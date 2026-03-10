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

import { buildPerformancePromptContext } from './PerformanceTracker';
import type { PerformanceInsight } from './types';

describe('buildPerformancePromptContext', () => {
  it('should return empty string for empty insights', () => {
    expect(buildPerformancePromptContext([])).toBe('');
  });

  it('should return formatted string for insights', () => {
    const insights: PerformanceInsight[] = [
      {
        toolCombo: ['brave_search', 'web_scrape'],
        avgFindingsCount: 5.2,
        avgConfidenceScore: 0.8,
        avgRelevanceScore: 0.75,
        successRate: 0.9,
        avgExecutionTimeMs: 2500,
        sampleSize: 10,
      },
    ];
    const result = buildPerformancePromptContext(insights);
    expect(result).toContain('PAST PERFORMANCE DATA');
    expect(result).toContain('brave_search');
    expect(result).toContain('web_scrape');
    expect(result).toContain('Samples: 10');
  });

  it('should include effectiveness score', () => {
    const insights: PerformanceInsight[] = [
      {
        toolCombo: ['search'],
        avgFindingsCount: 3,
        avgConfidenceScore: 0.8,
        avgRelevanceScore: 0.7,
        successRate: 0.9,
        avgExecutionTimeMs: 1500,
        sampleSize: 5,
      },
    ];
    const result = buildPerformancePromptContext(insights);
    expect(result).toContain('Effectiveness:');
  });

  it('should limit to top 10 insights', () => {
    const insights: PerformanceInsight[] = Array.from({ length: 15 }, (_, i) => ({
      toolCombo: [`tool_${i}`],
      avgFindingsCount: 3,
      avgConfidenceScore: 0.7,
      avgRelevanceScore: 0.6,
      successRate: 0.8,
      avgExecutionTimeMs: 1000,
      sampleSize: i + 1,
    }));
    const result = buildPerformancePromptContext(insights);
    // Should only include top 10
    expect(result).toContain('tool_0');
    expect(result).toContain('tool_9');
    expect(result).not.toContain('tool_10');
  });

  it('should contain usage guidance', () => {
    const insights: PerformanceInsight[] = [
      {
        toolCombo: ['search'],
        avgFindingsCount: 3,
        avgConfidenceScore: 0.8,
        avgRelevanceScore: 0.7,
        successRate: 0.9,
        avgExecutionTimeMs: 1200,
        sampleSize: 5,
      },
    ];
    const result = buildPerformancePromptContext(insights);
    expect(result).toContain('Favor tool combinations');
    expect(result).toContain('Avoid combinations');
  });
});
