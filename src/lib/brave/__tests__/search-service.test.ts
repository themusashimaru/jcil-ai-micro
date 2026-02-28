// @ts-nocheck - Test file with extensive mocking
/** @vitest-environment node */
/**
 * BRAVE SEARCH SERVICE — Tests
 * =============================
 *
 * Comprehensive tests for the Brave Search Service layer that performs
 * intelligent search with AI synthesis, query intent detection, and
 * synthesis prompt generation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — declared BEFORE any import that touches the module under test
// ---------------------------------------------------------------------------

vi.mock('@/lib/logger', () => ({
  logger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

// Mock the brave client module
const mockIntelligentSearch = vi.fn();
const mockFormatResultsForSynthesis = vi.fn();
const mockIsBraveConfigured = vi.fn();

vi.mock('../client', () => ({
  intelligentSearch: (...args: unknown[]) => mockIntelligentSearch(...args),
  formatResultsForSynthesis: (...args: unknown[]) => mockFormatResultsForSynthesis(...args),
  isBraveConfigured: (...args: unknown[]) => mockIsBraveConfigured(...args),
}));

// Mock the chat router
const mockCompleteChat = vi.fn();

vi.mock('@/lib/ai/chat-router', () => ({
  completeChat: (...args: unknown[]) => mockCompleteChat(...args),
}));

// ---------------------------------------------------------------------------
// Import the module under test AFTER mocks are set up
// ---------------------------------------------------------------------------

import {
  search,
  factCheck,
  searchNews,
  searchLocalBusinesses,
  isBraveConfigured,
  detectQueryIntent,
  getSynthesisPrompt,
} from '../search-service';
// Type re-exports are tested via runtime behavior, not direct type usage.

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockSearchResponse(overrides: Record<string, unknown> = {}) {
  return {
    query: 'test query',
    webResults: [
      { title: 'Result 1', url: 'https://example.com/1', description: 'Desc 1' },
      { title: 'Result 2', url: 'https://example.com/2', description: 'Desc 2' },
      { title: 'Result 3', url: 'https://example.com/3', description: 'Desc 3' },
    ],
    locationResults: [],
    moreResultsAvailable: false,
    ...overrides,
  };
}

function makeMockChatResult(overrides: Record<string, unknown> = {}) {
  return {
    text: 'Synthesized answer from AI',
    providerId: 'claude',
    model: 'claude-sonnet-4-6',
    usedFallback: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test Suites
// ---------------------------------------------------------------------------

describe('BraveSearchService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsBraveConfigured.mockReturnValue(true);
    mockIntelligentSearch.mockResolvedValue(makeMockSearchResponse());
    mockFormatResultsForSynthesis.mockReturnValue('Formatted results text');
    mockCompleteChat.mockResolvedValue(makeMockChatResult());
  });

  // =========================================================================
  // detectQueryIntent
  // =========================================================================

  describe('detectQueryIntent', () => {
    it('should detect weather queries', () => {
      const result = detectQueryIntent('weather in New York today');
      expect(result.type).toBe('weather');
      expect(result.enableRichData).toBe(true);
      expect(result.needsLocation).toBe(false);
    });

    it('should detect weather with "forecast" keyword', () => {
      const result = detectQueryIntent('forecast for London this week');
      expect(result.type).toBe('weather');
    });

    it('should detect weather with "temperature" keyword', () => {
      const result = detectQueryIntent('temperature in Tokyo today');
      expect(result.type).toBe('weather');
    });

    it('should detect weather with "rain" keyword', () => {
      const result = detectQueryIntent('will it rain tomorrow');
      expect(result.type).toBe('weather');
    });

    it('should detect weather with "snow" keyword', () => {
      const result = detectQueryIntent('snow forecast for Denver today');
      expect(result.type).toBe('weather');
    });

    it('should NOT detect weather without location/time modifiers', () => {
      const result = detectQueryIntent('weather');
      expect(result.type).not.toBe('weather');
    });

    it('should detect stock queries with "stock" keyword', () => {
      const result = detectQueryIntent('Apple stock price');
      expect(result.type).toBe('stock');
      expect(result.enableRichData).toBe(true);
    });

    it('should detect stock queries with ticker symbols', () => {
      const result = detectQueryIntent('AAPL stock performance');
      expect(result.type).toBe('stock');
    });

    it('should detect stock queries with "share price"', () => {
      const result = detectQueryIntent('Google share price today');
      expect(result.type).toBe('stock');
    });

    it('should detect stock queries with "market cap"', () => {
      const result = detectQueryIntent('MSFT market cap');
      expect(result.type).toBe('stock');
    });

    it('should detect stock queries with "nasdaq" keyword', () => {
      const result = detectQueryIntent('nasdaq composite today');
      expect(result.type).toBe('stock');
    });

    it('should detect crypto queries', () => {
      const result = detectQueryIntent('bitcoin price today');
      expect(result.type).toBe('crypto');
      expect(result.enableRichData).toBe(true);
    });

    it('should detect crypto with "ethereum" keyword', () => {
      const result = detectQueryIntent('ethereum value now');
      expect(result.type).toBe('crypto');
    });

    it('should detect crypto with "cryptocurrency" keyword', () => {
      const result = detectQueryIntent('cryptocurrency price comparison');
      expect(result.type).toBe('crypto');
    });

    it('should NOT detect crypto without price-related keywords', () => {
      const result = detectQueryIntent('bitcoin whitepaper explained');
      expect(result.type).not.toBe('crypto');
    });

    it('should detect sports queries', () => {
      const result = detectQueryIntent('NBA scores today');
      expect(result.type).toBe('sports');
      expect(result.freshness).toBe('pd');
      expect(result.enableRichData).toBe(true);
    });

    it('should detect sports with "football" and "yesterday"', () => {
      const result = detectQueryIntent('football game scores yesterday');
      expect(result.type).toBe('sports');
    });

    it('should detect sports with "schedule"', () => {
      const result = detectQueryIntent('nfl schedule this week');
      expect(result.type).toBe('sports');
    });

    it('should NOT detect sports without time modifiers', () => {
      const result = detectQueryIntent('basketball rules and regulations');
      expect(result.type).not.toBe('sports');
    });

    it('should detect news queries with "news" keyword', () => {
      const result = detectQueryIntent('latest news about AI');
      expect(result.type).toBe('news');
      expect(result.freshness).toBe('pw');
      expect(result.enableRichData).toBe(false);
    });

    it('should detect news with "breaking" keyword', () => {
      const result = detectQueryIntent('breaking news tech industry');
      expect(result.type).toBe('news');
    });

    it('should detect news with "recent" keyword', () => {
      const result = detectQueryIntent('recent updates on climate change');
      expect(result.type).toBe('news');
    });

    it('should detect news with "today" keyword', () => {
      const result = detectQueryIntent('what happened today');
      expect(result.type).toBe('news');
    });

    it('should detect local queries with "near me"', () => {
      const result = detectQueryIntent('coffee shops near me');
      expect(result.type).toBe('local');
      expect(result.needsLocation).toBe(true);
      expect(result.enableRichData).toBe(false);
    });

    it('should detect local queries with "restaurant"', () => {
      const result = detectQueryIntent('best restaurant downtown');
      expect(result.type).toBe('local');
    });

    it('should detect local queries with "nearby"', () => {
      const result = detectQueryIntent('nearby gym options');
      expect(result.type).toBe('local');
    });

    it('should detect local queries with "hotel"', () => {
      const result = detectQueryIntent('hotel options in the area');
      expect(result.type).toBe('local');
    });

    it('should detect fact-check queries', () => {
      const result = detectQueryIntent('is it true that water boils at 100C');
      expect(result.type).toBe('factcheck');
      expect(result.enableRichData).toBe(false);
    });

    it('should detect fact-check with "verify" keyword', () => {
      const result = detectQueryIntent('verify this claim about the moon landing');
      expect(result.type).toBe('factcheck');
    });

    it('should detect fact-check with "debunk" keyword', () => {
      const result = detectQueryIntent('debunk flat earth theory');
      expect(result.type).toBe('factcheck');
    });

    it('should return general for non-specific queries', () => {
      const result = detectQueryIntent('how do computers work');
      expect(result.type).toBe('general');
      expect(result.enableRichData).toBe(true);
      expect(result.needsLocation).toBe(false);
    });

    it('should return general for empty-like queries', () => {
      const result = detectQueryIntent('explain quantum physics');
      expect(result.type).toBe('general');
    });

    it('should be case insensitive', () => {
      const result = detectQueryIntent('WEATHER IN PARIS TODAY');
      expect(result.type).toBe('weather');
    });
  });

  // =========================================================================
  // getSynthesisPrompt
  // =========================================================================

  describe('getSynthesisPrompt', () => {
    it('should return factcheck prompt with VERDICT format', () => {
      const prompt = getSynthesisPrompt('factcheck', 'Earth is flat');
      expect(prompt).toContain('fact-checker');
      expect(prompt).toContain('VERDICT');
      expect(prompt).toContain('Earth is flat');
    });

    it('should return news prompt with headlines format', () => {
      const prompt = getSynthesisPrompt('news', 'AI developments');
      expect(prompt).toContain('news analyst');
      expect(prompt).toContain('Key Headlines');
      expect(prompt).toContain('AI developments');
    });

    it('should return local prompt with recommendations format', () => {
      const prompt = getSynthesisPrompt('local', 'coffee shops');
      expect(prompt).toContain('local guide');
      expect(prompt).toContain('Top Recommendations');
      expect(prompt).toContain('coffee shops');
    });

    it('should return weather prompt with conditions format', () => {
      const prompt = getSynthesisPrompt('weather', 'weather in NYC');
      expect(prompt).toContain('weather');
      expect(prompt).toContain('Current conditions');
      expect(prompt).toContain('weather in NYC');
    });

    it('should return stock prompt for stock mode', () => {
      const prompt = getSynthesisPrompt('stock', 'AAPL price');
      expect(prompt).toContain('market data');
      expect(prompt).toContain('Current price');
      expect(prompt).toContain('AAPL price');
    });

    it('should return crypto prompt for crypto mode', () => {
      const prompt = getSynthesisPrompt('crypto', 'bitcoin price');
      expect(prompt).toContain('market data');
      expect(prompt).toContain('bitcoin price');
    });

    it('should return generic prompt for default mode', () => {
      const prompt = getSynthesisPrompt('general', 'how does DNS work');
      expect(prompt).toContain('comprehensive and accurate answer');
      expect(prompt).toContain('how does DNS work');
    });

    it('should return generic prompt for unknown mode', () => {
      const prompt = getSynthesisPrompt('unknown_mode', 'some query');
      expect(prompt).toContain('comprehensive and accurate answer');
      expect(prompt).toContain('some query');
    });

    it('should embed the query in the prompt', () => {
      const prompt = getSynthesisPrompt('factcheck', 'The sky is green');
      expect(prompt).toContain('The sky is green');
    });

    it('should include source citation instructions', () => {
      const prompt = getSynthesisPrompt('factcheck', 'test');
      expect(prompt).toContain('sources');
    });
  });

  // =========================================================================
  // search (main function)
  // =========================================================================

  describe('search', () => {
    it('should throw if Brave is not configured', async () => {
      mockIsBraveConfigured.mockReturnValue(false);
      await expect(search({ query: 'test' })).rejects.toThrow('Brave Search is not configured');
    });

    it('should perform a basic search and return synthesized answer', async () => {
      const result = await search({ query: 'what is TypeScript' });

      expect(result.answer).toBe('Synthesized answer from AI');
      expect(result.model).toBe('claude-sonnet-4-6');
      expect(result.provider).toBe('claude');
      expect(result.usedFallback).toBe(false);
      expect(result.sources).toHaveLength(3);
    });

    it('should call intelligentSearch with correct options', async () => {
      await search({ query: 'test query', country: 'gb', freshness: 'pd' });

      expect(mockIntelligentSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'test query',
          country: 'gb',
          freshness: 'pd',
          extraSnippets: true,
        })
      );
    });

    it('should use default country "us" when not specified', async () => {
      await search({ query: 'test query' });

      expect(mockIntelligentSearch).toHaveBeenCalledWith(
        expect.objectContaining({ country: 'us' })
      );
    });

    it('should pass enrichLocations for local intent queries', async () => {
      await search({ query: 'restaurants near me' });

      expect(mockIntelligentSearch).toHaveBeenCalledWith(
        expect.objectContaining({ enrichLocations: true })
      );
    });

    it('should NOT pass enrichLocations for general queries', async () => {
      await search({ query: 'what is TypeScript' });

      expect(mockIntelligentSearch).toHaveBeenCalledWith(
        expect.objectContaining({ enrichLocations: false })
      );
    });

    it('should set count to 5 for weather queries', async () => {
      await search({ query: 'weather in NYC today' });

      expect(mockIntelligentSearch).toHaveBeenCalledWith(expect.objectContaining({ count: 5 }));
    });

    it('should set count to 5 for stock queries', async () => {
      await search({ query: 'AAPL stock price' });

      expect(mockIntelligentSearch).toHaveBeenCalledWith(expect.objectContaining({ count: 5 }));
    });

    it('should set count to 10 for general queries', async () => {
      await search({ query: 'what is TypeScript' });

      expect(mockIntelligentSearch).toHaveBeenCalledWith(expect.objectContaining({ count: 10 }));
    });

    it('should return raw results when rawResults is true', async () => {
      mockFormatResultsForSynthesis.mockReturnValue('Raw formatted text');
      const mockResponse = makeMockSearchResponse();
      mockIntelligentSearch.mockResolvedValue(mockResponse);

      const result = await search({ query: 'test', rawResults: true });

      expect(result.answer).toBe('Raw formatted text');
      expect(result.model).toBe('none');
      expect(result.provider).toBe('brave');
      expect(result.usedFallback).toBe(false);
      expect(result.rawResponse).toBeDefined();
      expect(mockCompleteChat).not.toHaveBeenCalled();
    });

    it('should include rawResponse when rawResults is true', async () => {
      const mockResponse = makeMockSearchResponse();
      mockIntelligentSearch.mockResolvedValue(mockResponse);

      const result = await search({ query: 'test', rawResults: true });

      expect(result.rawResponse).toEqual(mockResponse);
    });

    it('should NOT include rawResponse when rawResults is false', async () => {
      const result = await search({ query: 'test', rawResults: false });

      expect(result.rawResponse).toBeUndefined();
    });

    it('should include richData when search response has richData', async () => {
      const richResponse = makeMockSearchResponse({
        richData: {
          type: 'rich',
          subtype: 'weather',
          data: { temp: 72 },
        },
      });
      mockIntelligentSearch.mockResolvedValue(richResponse);

      const result = await search({ query: 'weather in NYC today' });

      expect(result.richData).toEqual({
        type: 'weather',
        data: { temp: 72 },
      });
    });

    it('should NOT include richData when search response lacks it', async () => {
      const result = await search({ query: 'what is TypeScript' });

      expect(result.richData).toBeUndefined();
    });

    it('should include richData in raw results mode', async () => {
      const richResponse = makeMockSearchResponse({
        richData: {
          type: 'rich',
          subtype: 'stock',
          data: { price: 150 },
        },
      });
      mockIntelligentSearch.mockResolvedValue(richResponse);

      const result = await search({ query: 'AAPL stock', rawResults: true });

      expect(result.richData).toEqual({
        type: 'stock',
        data: { price: 150 },
      });
    });

    it('should call completeChat with correct messages for synthesis', async () => {
      mockFormatResultsForSynthesis.mockReturnValue('Search results text');

      await search({ query: 'what is TypeScript' });

      expect(mockCompleteChat).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: expect.stringContaining('Search results text'),
          }),
        ]),
        expect.objectContaining({
          model: 'claude-sonnet-4-6',
          maxTokens: 2048,
          temperature: 0.3,
        })
      );
    });

    it('should use custom systemPrompt when provided', async () => {
      await search({ query: 'test', systemPrompt: 'Custom prompt here' });

      expect(mockCompleteChat).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            content: expect.stringContaining('Custom prompt here'),
          }),
        ]),
        expect.anything()
      );
    });

    it('should use factcheck synthesis mode when mode is factcheck', async () => {
      await search({ query: 'is it true earth is round', mode: 'factcheck' });

      expect(mockCompleteChat).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            content: expect.stringContaining('fact-checker'),
          }),
        ]),
        expect.anything()
      );
    });

    it('should limit sources to first 5 web results', async () => {
      const manyResults = makeMockSearchResponse({
        webResults: Array.from({ length: 10 }, (_, i) => ({
          title: `Result ${i + 1}`,
          url: `https://example.com/${i + 1}`,
          description: `Description ${i + 1}`,
        })),
      });
      mockIntelligentSearch.mockResolvedValue(manyResults);

      const result = await search({ query: 'test' });

      expect(result.sources).toHaveLength(5);
      expect(result.sources[0].title).toBe('Result 1');
      expect(result.sources[4].title).toBe('Result 5');
    });

    it('should pass location to search options when provided and needed', async () => {
      await search({
        query: 'restaurants near me',
        location: { latitude: 40.7128, longitude: -74.006 },
      });

      expect(mockIntelligentSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          latitude: 40.7128,
          longitude: -74.006,
        })
      );
    });

    it('should NOT pass location for non-local queries', async () => {
      await search({
        query: 'what is TypeScript',
        location: { latitude: 40.7128, longitude: -74.006 },
      });

      const calledWith = mockIntelligentSearch.mock.calls[0][0];
      expect(calledWith.latitude).toBeUndefined();
      expect(calledWith.longitude).toBeUndefined();
    });

    it('should use freshness from request over intent freshness', async () => {
      await search({ query: 'NBA scores today', freshness: 'pm' });

      expect(mockIntelligentSearch).toHaveBeenCalledWith(
        expect.objectContaining({ freshness: 'pm' })
      );
    });

    it('should use intent freshness when request freshness is not set', async () => {
      await search({ query: 'NBA scores today' });

      expect(mockIntelligentSearch).toHaveBeenCalledWith(
        expect.objectContaining({ freshness: 'pd' })
      );
    });

    it('should handle usedFallback from synthesis result', async () => {
      mockCompleteChat.mockResolvedValue(
        makeMockChatResult({ usedFallback: true, providerId: 'xai', model: 'grok-2' })
      );

      const result = await search({ query: 'test' });

      expect(result.usedFallback).toBe(true);
      expect(result.provider).toBe('xai');
      expect(result.model).toBe('grok-2');
    });

    it('should propagate errors from intelligentSearch', async () => {
      mockIntelligentSearch.mockRejectedValue(new Error('Search API failed'));

      await expect(search({ query: 'test' })).rejects.toThrow('Search API failed');
    });

    it('should propagate errors from completeChat', async () => {
      mockCompleteChat.mockRejectedValue(new Error('AI synthesis failed'));

      await expect(search({ query: 'test' })).rejects.toThrow('AI synthesis failed');
    });

    it('should return empty sources when webResults is empty', async () => {
      mockIntelligentSearch.mockResolvedValue(makeMockSearchResponse({ webResults: [] }));

      const result = await search({ query: 'test' });

      expect(result.sources).toHaveLength(0);
    });

    it('should enable enableRichData based on intent', async () => {
      await search({ query: 'what is TypeScript' });

      expect(mockIntelligentSearch).toHaveBeenCalledWith(
        expect.objectContaining({ enableRichData: true })
      );
    });

    it('should use intent type for synthesis mode when not factcheck', async () => {
      await search({ query: 'latest news about AI', mode: 'news' });

      expect(mockCompleteChat).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            content: expect.stringContaining('news analyst'),
          }),
        ]),
        expect.anything()
      );
    });

    it('should map all source titles and urls correctly', async () => {
      const result = await search({ query: 'test' });

      expect(result.sources[0]).toEqual({ title: 'Result 1', url: 'https://example.com/1' });
      expect(result.sources[1]).toEqual({ title: 'Result 2', url: 'https://example.com/2' });
    });

    it('should map rawResults sources from all webResults (not limited to 5)', async () => {
      const manyResults = makeMockSearchResponse({
        webResults: Array.from({ length: 8 }, (_, i) => ({
          title: `Result ${i + 1}`,
          url: `https://example.com/${i + 1}`,
          description: `Desc ${i + 1}`,
        })),
      });
      mockIntelligentSearch.mockResolvedValue(manyResults);

      const result = await search({ query: 'test', rawResults: true });

      expect(result.sources).toHaveLength(8);
    });
  });

  // =========================================================================
  // factCheck
  // =========================================================================

  describe('factCheck', () => {
    it('should call search with factcheck mode', async () => {
      await factCheck('The Earth is round');

      expect(mockIntelligentSearch).toHaveBeenCalled();
      const calledQuery = mockIntelligentSearch.mock.calls[0][0].query;
      expect(calledQuery).toBe('Fact check: The Earth is round');
    });

    it('should prepend "Fact check:" to the claim', async () => {
      await factCheck('Water boils at 100C');

      const calledQuery = mockIntelligentSearch.mock.calls[0][0].query;
      expect(calledQuery).toContain('Fact check:');
      expect(calledQuery).toContain('Water boils at 100C');
    });

    it('should return a SearchResult', async () => {
      const result = await factCheck('some claim');

      expect(result).toHaveProperty('answer');
      expect(result).toHaveProperty('model');
      expect(result).toHaveProperty('provider');
      expect(result).toHaveProperty('sources');
    });

    it('should throw when Brave is not configured', async () => {
      mockIsBraveConfigured.mockReturnValue(false);

      await expect(factCheck('test')).rejects.toThrow('Brave Search is not configured');
    });

    it('should use factcheck synthesis prompt', async () => {
      await factCheck('The moon is made of cheese');

      expect(mockCompleteChat).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            content: expect.stringContaining('fact-checker'),
          }),
        ]),
        expect.anything()
      );
    });
  });

  // =========================================================================
  // searchNews
  // =========================================================================

  describe('searchNews', () => {
    it('should call search with news mode', async () => {
      await searchNews('AI developments');

      expect(mockIntelligentSearch).toHaveBeenCalled();
    });

    it('should use default freshness of "pw" (past week)', async () => {
      await searchNews('tech news');

      expect(mockIntelligentSearch).toHaveBeenCalledWith(
        expect.objectContaining({ freshness: 'pw' })
      );
    });

    it('should accept custom freshness parameter', async () => {
      await searchNews('tech news', 'pd');

      expect(mockIntelligentSearch).toHaveBeenCalledWith(
        expect.objectContaining({ freshness: 'pd' })
      );
    });

    it('should accept "pm" freshness for monthly news', async () => {
      await searchNews('quarterly reports', 'pm');

      expect(mockIntelligentSearch).toHaveBeenCalledWith(
        expect.objectContaining({ freshness: 'pm' })
      );
    });

    it('should return a SearchResult', async () => {
      const result = await searchNews('some topic');

      expect(result).toHaveProperty('answer');
      expect(result).toHaveProperty('sources');
    });

    it('should throw when Brave is not configured', async () => {
      mockIsBraveConfigured.mockReturnValue(false);

      await expect(searchNews('test')).rejects.toThrow('Brave Search is not configured');
    });
  });

  // =========================================================================
  // searchLocalBusinesses
  // =========================================================================

  describe('searchLocalBusinesses', () => {
    it('should call search with local mode and location', async () => {
      await searchLocalBusinesses('coffee shops', 40.7128, -74.006);

      expect(mockIntelligentSearch).toHaveBeenCalled();
    });

    it('should pass latitude and longitude', async () => {
      await searchLocalBusinesses('restaurants', 34.0522, -118.2437);

      expect(mockIntelligentSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          latitude: 34.0522,
          longitude: -118.2437,
        })
      );
    });

    it('should use local mode', async () => {
      await searchLocalBusinesses('gyms', 40.0, -74.0);

      // Local mode should trigger local intent detection via the query
      expect(mockIntelligentSearch).toHaveBeenCalled();
    });

    it('should return a SearchResult', async () => {
      const result = await searchLocalBusinesses('pizza', 40.0, -74.0);

      expect(result).toHaveProperty('answer');
      expect(result).toHaveProperty('sources');
    });

    it('should throw when Brave is not configured', async () => {
      mockIsBraveConfigured.mockReturnValue(false);

      await expect(searchLocalBusinesses('test', 0, 0)).rejects.toThrow(
        'Brave Search is not configured'
      );
    });
  });

  // =========================================================================
  // isBraveConfigured (re-exported)
  // =========================================================================

  describe('isBraveConfigured', () => {
    it('should return true when configured', () => {
      mockIsBraveConfigured.mockReturnValue(true);
      expect(isBraveConfigured()).toBe(true);
    });

    it('should return false when not configured', () => {
      mockIsBraveConfigured.mockReturnValue(false);
      expect(isBraveConfigured()).toBe(false);
    });

    it('should delegate to the client module', () => {
      isBraveConfigured();
      expect(mockIsBraveConfigured).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // search — edge cases and modes
  // =========================================================================

  describe('search — mode handling', () => {
    it('should default mode to "search"', async () => {
      await search({ query: 'test' });

      // Default mode is 'search', which should use intent-based synthesis
      expect(mockCompleteChat).toHaveBeenCalled();
    });

    it('should handle realtime mode', async () => {
      const result = await search({ query: 'test', mode: 'realtime' });

      expect(result).toHaveProperty('answer');
    });

    it('should handle news mode with news synthesis prompt', async () => {
      await search({ query: 'latest tech updates', mode: 'news' });

      expect(mockCompleteChat).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            content: expect.stringContaining('news analyst'),
          }),
        ]),
        expect.anything()
      );
    });

    it('should handle local mode', async () => {
      const result = await search({
        query: 'restaurants',
        mode: 'local',
        location: { latitude: 40.0, longitude: -74.0 },
      });

      expect(result).toHaveProperty('answer');
    });
  });

  // =========================================================================
  // search — synthesis and response construction
  // =========================================================================

  describe('search — response construction', () => {
    it('should format sources as title/url pairs', async () => {
      const result = await search({ query: 'test' });

      result.sources.forEach((source) => {
        expect(source).toHaveProperty('title');
        expect(source).toHaveProperty('url');
        expect(typeof source.title).toBe('string');
        expect(typeof source.url).toBe('string');
      });
    });

    it('should pass formatted results to the synthesis prompt', async () => {
      mockFormatResultsForSynthesis.mockReturnValue('Formatted web results here');

      await search({ query: 'test' });

      expect(mockCompleteChat).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            content: expect.stringContaining('Formatted web results here'),
          }),
        ]),
        expect.anything()
      );
    });

    it('should construct messages with user role for synthesis', async () => {
      await search({ query: 'test' });

      const messages = mockCompleteChat.mock.calls[0][0];
      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe('user');
    });

    it('should include separator between prompt and results', async () => {
      mockFormatResultsForSynthesis.mockReturnValue('results');

      await search({ query: 'test' });

      const messageContent = mockCompleteChat.mock.calls[0][0][0].content;
      expect(messageContent).toContain('---');
      expect(messageContent).toContain('SEARCH RESULTS:');
    });

    it('should set temperature to 0.3 for factual responses', async () => {
      await search({ query: 'test' });

      expect(mockCompleteChat).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ temperature: 0.3 })
      );
    });

    it('should set maxTokens to 2048', async () => {
      await search({ query: 'test' });

      expect(mockCompleteChat).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ maxTokens: 2048 })
      );
    });
  });

  // =========================================================================
  // default export
  // =========================================================================

  describe('default export', () => {
    it('should export search function', async () => {
      const mod = await import('../search-service');
      expect(mod.default.search).toBeDefined();
    });

    it('should export factCheck function', async () => {
      const mod = await import('../search-service');
      expect(mod.default.factCheck).toBeDefined();
    });

    it('should export searchNews function', async () => {
      const mod = await import('../search-service');
      expect(mod.default.searchNews).toBeDefined();
    });

    it('should export searchLocalBusinesses function', async () => {
      const mod = await import('../search-service');
      expect(mod.default.searchLocalBusinesses).toBeDefined();
    });

    it('should export isBraveConfigured function', async () => {
      const mod = await import('../search-service');
      expect(mod.default.isBraveConfigured).toBeDefined();
    });
  });
});
