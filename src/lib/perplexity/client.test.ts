/**
 * Tests for Perplexity API client
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock AbortController
vi.stubGlobal(
  'AbortController',
  vi.fn(() => ({
    signal: {},
    abort: vi.fn(),
  }))
);

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: vi.fn(() => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

describe('Perplexity client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  describe('isPerplexityConfigured', () => {
    it('should return false when no keys configured', async () => {
      // Don't set any keys
      const { isPerplexityConfigured } = await import('./client');
      expect(isPerplexityConfigured()).toBe(false);
    });

    it('should return true with single key', async () => {
      vi.stubEnv('PERPLEXITY_API_KEY', 'pplx-test-key');

      const { isPerplexityConfigured } = await import('./client');
      expect(isPerplexityConfigured()).toBe(true);
    });

    it('should return true with numbered keys', async () => {
      vi.stubEnv('PERPLEXITY_API_KEY_1', 'pplx-key-1');
      vi.stubEnv('PERPLEXITY_API_KEY_2', 'pplx-key-2');

      const { isPerplexityConfigured } = await import('./client');
      expect(isPerplexityConfigured()).toBe(true);
    });
  });

  describe('getPerplexityKeyStats', () => {
    it('should return zero counts when unconfigured', async () => {
      const { getPerplexityKeyStats } = await import('./client');
      const stats = getPerplexityKeyStats();

      expect(stats.primaryKeys).toBe(0);
      expect(stats.fallbackKeys).toBe(0);
      expect(stats.totalKeys).toBe(0);
    });

    it('should count primary and fallback keys', async () => {
      vi.stubEnv('PERPLEXITY_API_KEY_1', 'pplx-key-1');
      vi.stubEnv('PERPLEXITY_API_KEY_2', 'pplx-key-2');
      vi.stubEnv('PERPLEXITY_API_KEY_FALLBACK_1', 'pplx-fb-1');

      const { getPerplexityKeyStats } = await import('./client');
      const stats = getPerplexityKeyStats();

      expect(stats.primaryKeys).toBe(2);
      expect(stats.fallbackKeys).toBe(1);
      expect(stats.totalKeys).toBe(3);
      expect(stats.totalAvailable).toBe(3);
    });
  });

  describe('perplexitySearch', () => {
    it('should throw when no keys configured', async () => {
      const { perplexitySearch } = await import('./client');
      await expect(perplexitySearch({ query: 'test' })).rejects.toThrow('not configured');
    });

    it('should call fetch with correct URL and headers', async () => {
      vi.stubEnv('PERPLEXITY_API_KEY', 'pplx-test');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: 'Answer text' } }],
          citations: [],
        }),
      });

      const { perplexitySearch } = await import('./client');
      await perplexitySearch({ query: 'what is typescript' });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.perplexity.ai/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Authorization: 'Bearer pplx-test',
          }),
        })
      );
    });

    it('should return answer and sources', async () => {
      vi.stubEnv('PERPLEXITY_API_KEY', 'pplx-test');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: 'TypeScript is a typed superset of JavaScript.' } }],
          citations: [{ url: 'https://typescriptlang.org', title: 'TypeScript Docs' }],
        }),
      });

      const { perplexitySearch } = await import('./client');
      const result = await perplexitySearch({ query: 'what is typescript' });

      expect(result.answer).toContain('TypeScript');
      expect(result.sources).toHaveLength(1);
      expect(result.sources[0].url).toBe('https://typescriptlang.org');
      expect(result.model).toBe('sonar-pro');
    });

    it('should extract URLs from answer when no citations array', async () => {
      vi.stubEnv('PERPLEXITY_API_KEY', 'pplx-test');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: 'Check https://example.com for details.' } }],
        }),
      });

      const { perplexitySearch } = await import('./client');
      const result = await perplexitySearch({ query: 'test' });

      expect(result.sources.length).toBeGreaterThan(0);
      expect(result.sources[0].url).toContain('example.com');
    });

    it('should throw on non-ok response', async () => {
      vi.stubEnv('PERPLEXITY_API_KEY', 'pplx-test');

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Bad Request',
      });

      const { perplexitySearch } = await import('./client');
      await expect(perplexitySearch({ query: 'bad' })).rejects.toThrow('Perplexity API error: 400');
    });
  });

  describe('searchWeb', () => {
    it('should delegate to perplexitySearch', async () => {
      vi.stubEnv('PERPLEXITY_API_KEY', 'pplx-test');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: 'Web result' } }],
          citations: [],
        }),
      });

      const { searchWeb } = await import('./client');
      const result = await searchWeb('test query');

      expect(result.answer).toBe('Web result');
    });
  });

  describe('searchCurrentTime', () => {
    it('should search for time with location', async () => {
      vi.stubEnv('PERPLEXITY_API_KEY', 'pplx-test');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: '3:45 PM EST' } }],
          citations: [],
        }),
      });

      const { searchCurrentTime } = await import('./client');
      const result = await searchCurrentTime('New York');

      expect(result.answer).toContain('3:45 PM');
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.messages[1].content).toContain('New York');
    });
  });

  describe('PerplexitySearchResult type', () => {
    it('should have answer, sources, and model fields', async () => {
      vi.stubEnv('PERPLEXITY_API_KEY', 'pplx-test');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: 'Answer' } }],
          citations: [],
        }),
      });

      const { perplexitySearch } = await import('./client');
      const result = await perplexitySearch({ query: 'test' });

      expect(typeof result.answer).toBe('string');
      expect(Array.isArray(result.sources)).toBe(true);
      expect(typeof result.model).toBe('string');
    });
  });
});
