// @ts-nocheck - Test file with extensive mocking
/**
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockBraveWebSearch } = vi.hoisted(() => ({
  mockBraveWebSearch: vi.fn(),
}));

vi.mock('@/lib/brave', () => ({
  braveWebSearch: (...args: unknown[]) => mockBraveWebSearch(...args),
}));

vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { searchBrave, formatSearchResults } from '../braveSearch';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeWebResult(overrides = {}) {
  return {
    title: 'Test Result',
    url: 'https://example.com',
    description: 'A test result',
    extraSnippets: ['Snippet text here'],
    ...overrides,
  };
}

function makeSearchResponse(results = [makeWebResult()]) {
  return {
    webResults: results,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('braveSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBraveWebSearch.mockResolvedValue(makeSearchResponse());
  });

  // =========================================================================
  // searchBrave
  // =========================================================================

  describe('searchBrave', () => {
    it('should return success with results', async () => {
      const result = await searchBrave({ query: 'test' });
      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(1);
    });

    it('should pass query to braveWebSearch', async () => {
      await searchBrave({ query: 'my search query' });
      expect(mockBraveWebSearch).toHaveBeenCalledWith(
        expect.objectContaining({ query: 'my search query' })
      );
    });

    it('should default count to 10', async () => {
      await searchBrave({ query: 'test' });
      expect(mockBraveWebSearch).toHaveBeenCalledWith(expect.objectContaining({ count: 10 }));
    });

    it('should use custom count', async () => {
      await searchBrave({ query: 'test', count: 5 });
      expect(mockBraveWebSearch).toHaveBeenCalledWith(expect.objectContaining({ count: 5 }));
    });

    it('should enable extraSnippets', async () => {
      await searchBrave({ query: 'test' });
      expect(mockBraveWebSearch).toHaveBeenCalledWith(
        expect.objectContaining({ extraSnippets: true })
      );
    });

    it('should map result fields correctly', async () => {
      const result = await searchBrave({ query: 'test' });
      expect(result.results[0]).toEqual({
        title: 'Test Result',
        url: 'https://example.com',
        description: 'A test result',
        snippet: 'Snippet text here',
      });
    });

    it('should join multiple extraSnippets', async () => {
      mockBraveWebSearch.mockResolvedValue(
        makeSearchResponse([makeWebResult({ extraSnippets: ['Part 1', 'Part 2'] })])
      );
      const result = await searchBrave({ query: 'test' });
      expect(result.results[0].snippet).toBe('Part 1 Part 2');
    });

    it('should handle missing title', async () => {
      mockBraveWebSearch.mockResolvedValue(
        makeSearchResponse([makeWebResult({ title: undefined })])
      );
      const result = await searchBrave({ query: 'test' });
      expect(result.results[0].title).toBe('');
    });

    it('should handle missing url', async () => {
      mockBraveWebSearch.mockResolvedValue(makeSearchResponse([makeWebResult({ url: undefined })]));
      const result = await searchBrave({ query: 'test' });
      expect(result.results[0].url).toBe('');
    });

    it('should handle missing description', async () => {
      mockBraveWebSearch.mockResolvedValue(
        makeSearchResponse([makeWebResult({ description: undefined })])
      );
      const result = await searchBrave({ query: 'test' });
      expect(result.results[0].description).toBe('');
    });

    it('should handle missing extraSnippets', async () => {
      mockBraveWebSearch.mockResolvedValue(
        makeSearchResponse([makeWebResult({ extraSnippets: undefined })])
      );
      const result = await searchBrave({ query: 'test' });
      expect(result.results[0].snippet).toBe('');
    });

    it('should limit results to count', async () => {
      const manyResults = Array.from({ length: 20 }, (_, i) =>
        makeWebResult({ title: `Result ${i}` })
      );
      mockBraveWebSearch.mockResolvedValue(makeSearchResponse(manyResults));
      const result = await searchBrave({ query: 'test', count: 3 });
      expect(result.results.length).toBeLessThanOrEqual(3);
    });

    it('should return empty results for no webResults', async () => {
      mockBraveWebSearch.mockResolvedValue({ webResults: [] });
      const result = await searchBrave({ query: 'test' });
      expect(result.success).toBe(true);
      expect(result.results).toEqual([]);
    });

    it('should return empty results for null webResults', async () => {
      mockBraveWebSearch.mockResolvedValue({ webResults: null });
      const result = await searchBrave({ query: 'test' });
      expect(result.success).toBe(true);
      expect(result.results).toEqual([]);
    });

    it('should handle API errors gracefully', async () => {
      mockBraveWebSearch.mockRejectedValue(new Error('API error'));
      const result = await searchBrave({ query: 'test' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('API error');
      expect(result.results).toEqual([]);
    });

    it('should handle non-Error throws', async () => {
      mockBraveWebSearch.mockRejectedValue('string error');
      const result = await searchBrave({ query: 'test' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('string error');
    });
  });

  // =========================================================================
  // formatSearchResults
  // =========================================================================

  describe('formatSearchResults', () => {
    it('should format results with numbers', () => {
      const output = {
        success: true,
        results: [
          { title: 'Result 1', url: 'https://r1.com', description: 'Desc 1', snippet: 'Snip 1' },
        ],
      };
      const formatted = formatSearchResults(output);
      expect(formatted).toContain('[1]');
      expect(formatted).toContain('Result 1');
      expect(formatted).toContain('https://r1.com');
    });

    it('should include URL prefix', () => {
      const output = {
        success: true,
        results: [{ title: 'T', url: 'https://x.com', description: 'D', snippet: '' }],
      };
      expect(formatSearchResults(output)).toContain('URL:');
    });

    it('should format multiple results', () => {
      const output = {
        success: true,
        results: [
          { title: 'R1', url: 'u1', description: 'D1', snippet: '' },
          { title: 'R2', url: 'u2', description: 'D2', snippet: '' },
        ],
      };
      const formatted = formatSearchResults(output);
      expect(formatted).toContain('[1]');
      expect(formatted).toContain('[2]');
    });

    it('should return error message for failed search', () => {
      const output = { success: false, results: [], error: 'API limit' };
      expect(formatSearchResults(output)).toBe('API limit');
    });

    it('should return "No results found" for empty results', () => {
      const output = { success: true, results: [] };
      expect(formatSearchResults(output)).toBe('No results found');
    });

    it('should return "No results found" when no error provided', () => {
      const output = { success: false, results: [] };
      expect(formatSearchResults(output)).toBe('No results found');
    });

    it('should include snippet when present', () => {
      const output = {
        success: true,
        results: [{ title: 'T', url: 'u', description: 'D', snippet: 'Extra context' }],
      };
      expect(formatSearchResults(output)).toContain('Extra context');
    });

    it('should handle empty snippet', () => {
      const output = {
        success: true,
        results: [{ title: 'T', url: 'u', description: 'D', snippet: '' }],
      };
      const formatted = formatSearchResults(output);
      expect(formatted).toContain('T');
    });
  });
});
