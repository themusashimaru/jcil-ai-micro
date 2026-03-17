// @ts-nocheck - Test file with extensive mocking
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock logger before imports
vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock the brave client
vi.mock('./client', () => ({
  intelligentSearch: vi.fn(),
  formatResultsForSynthesis: vi.fn(),
  isBraveConfigured: vi.fn(),
}));

// Mock the chat router
vi.mock('@/lib/ai/chat-router', () => ({
  completeChat: vi.fn(),
}));

import {
  search,
  factCheck,
  searchNews,
  searchLocalBusinesses,
  detectQueryIntent,
  getSynthesisPrompt,
  isBraveConfigured,
} from './search-service';
import braveSearchService from './search-service';
import {
  intelligentSearch,
  formatResultsForSynthesis,
  isBraveConfigured as mockIsBraveConfigured,
} from './client';
import { completeChat } from '@/lib/ai/chat-router';

// Cast mocks for type safety
const mockIntelligentSearch = intelligentSearch as ReturnType<typeof vi.fn>;
const mockFormatResults = formatResultsForSynthesis as ReturnType<typeof vi.fn>;
const mockIsBraveConfiguredFn = mockIsBraveConfigured as ReturnType<typeof vi.fn>;
const mockCompleteChat = completeChat as ReturnType<typeof vi.fn>;

// ============================================================================
// HELPERS
// ============================================================================

function createMockSearchResponse(overrides: Record<string, unknown> = {}) {
  return {
    query: 'test query',
    webResults: [
      { title: 'Result 1', url: 'https://example.com/1', description: 'Description 1' },
      { title: 'Result 2', url: 'https://example.com/2', description: 'Description 2' },
      { title: 'Result 3', url: 'https://example.com/3', description: 'Description 3' },
    ],
    locationResults: [],
    moreResultsAvailable: false,
    totalCount: 3,
    ...overrides,
  };
}

function createMockChatResult(overrides: Record<string, unknown> = {}) {
  return {
    text: 'Synthesized answer from AI',
    providerId: 'anthropic',
    model: 'claude-sonnet-4-6',
    usedFallback: false,
    ...overrides,
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('Brave Search Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsBraveConfiguredFn.mockReturnValue(true);
    mockIntelligentSearch.mockResolvedValue(createMockSearchResponse());
    mockFormatResults.mockReturnValue('Formatted search results');
    mockCompleteChat.mockResolvedValue(createMockChatResult());
  });

  // ==========================================================================
  // detectQueryIntent
  // ==========================================================================

  describe('detectQueryIntent', () => {
    it('should detect weather queries', () => {
      expect(detectQueryIntent('weather in New York today')).toEqual({
        type: 'weather',
        enableRichData: true,
        needsLocation: false,
      });
      expect(detectQueryIntent('What is the forecast for tomorrow')).toEqual({
        type: 'weather',
        enableRichData: true,
        needsLocation: false,
      });
      expect(detectQueryIntent('Temperature in London this week')).toEqual({
        type: 'weather',
        enableRichData: true,
        needsLocation: false,
      });
    });

    it('should not detect weather without location/time context', () => {
      // "define weather" has no "in ", "at ", "for ", "today", etc.
      const result = detectQueryIntent('define weather');
      expect(result.type).not.toBe('weather');
    });

    it('should detect stock queries', () => {
      expect(detectQueryIntent('AAPL stock price')).toEqual({
        type: 'stock',
        enableRichData: true,
        needsLocation: false,
      });
      expect(detectQueryIntent('What is the market cap of TSLA')).toEqual({
        type: 'stock',
        enableRichData: true,
        needsLocation: false,
      });
      expect(detectQueryIntent('NVDA share price')).toEqual({
        type: 'stock',
        enableRichData: true,
        needsLocation: false,
      });
      expect(detectQueryIntent('nasdaq index today')).toEqual({
        type: 'stock',
        enableRichData: true,
        needsLocation: false,
      });
    });

    it('should detect crypto queries', () => {
      expect(detectQueryIntent('bitcoin price today')).toEqual({
        type: 'crypto',
        enableRichData: true,
        needsLocation: false,
      });
      expect(detectQueryIntent('what is ethereum worth')).toEqual({
        type: 'crypto',
        enableRichData: true,
        needsLocation: false,
      });
      expect(detectQueryIntent('dogecoin cost now')).toEqual({
        type: 'crypto',
        enableRichData: true,
        needsLocation: false,
      });
    });

    it('should not detect crypto without price context', () => {
      const result = detectQueryIntent('what is bitcoin');
      // Without "price/value/worth/cost", it won't match crypto
      expect(result.type).not.toBe('crypto');
    });

    it('should detect sports queries', () => {
      expect(detectQueryIntent('NFL scores today')).toEqual({
        type: 'sports',
        freshness: 'pd',
        enableRichData: true,
        needsLocation: false,
      });
      expect(detectQueryIntent('NBA game yesterday')).toEqual({
        type: 'sports',
        freshness: 'pd',
        enableRichData: true,
        needsLocation: false,
      });
      expect(detectQueryIntent('soccer match this week')).toEqual({
        type: 'sports',
        freshness: 'pd',
        enableRichData: true,
        needsLocation: false,
      });
    });

    it('should detect news queries', () => {
      expect(detectQueryIntent('latest news about AI')).toEqual({
        type: 'news',
        freshness: 'pw',
        enableRichData: false,
        needsLocation: false,
      });
      expect(detectQueryIntent('breaking news')).toEqual({
        type: 'news',
        freshness: 'pw',
        enableRichData: false,
        needsLocation: false,
      });
      expect(detectQueryIntent('what happened today')).toEqual({
        type: 'news',
        freshness: 'pw',
        enableRichData: false,
        needsLocation: false,
      });
    });

    it('should detect local queries', () => {
      expect(detectQueryIntent('restaurants near me')).toEqual({
        type: 'local',
        enableRichData: false,
        needsLocation: true,
      });
      expect(detectQueryIntent('best cafe in my area')).toEqual({
        type: 'local',
        enableRichData: false,
        needsLocation: true,
      });
      expect(detectQueryIntent('closest gym')).toEqual({
        type: 'local',
        enableRichData: false,
        needsLocation: true,
      });
      expect(detectQueryIntent('hotel nearby')).toEqual({
        type: 'local',
        enableRichData: false,
        needsLocation: true,
      });
    });

    it('should detect fact-check queries', () => {
      expect(detectQueryIntent('is it true that the earth is flat')).toEqual({
        type: 'factcheck',
        enableRichData: false,
        needsLocation: false,
      });
      expect(detectQueryIntent('fact check this claim')).toEqual({
        type: 'factcheck',
        enableRichData: false,
        needsLocation: false,
      });
      expect(detectQueryIntent('verify this information')).toEqual({
        type: 'factcheck',
        enableRichData: false,
        needsLocation: false,
      });
    });

    it('should default to general for unrecognized queries', () => {
      expect(detectQueryIntent('how to learn programming')).toEqual({
        type: 'general',
        enableRichData: true,
        needsLocation: false,
      });
      expect(detectQueryIntent('best programming languages 2026')).toEqual({
        type: 'general',
        enableRichData: true,
        needsLocation: false,
      });
    });
  });

  // ==========================================================================
  // getSynthesisPrompt
  // ==========================================================================

  describe('getSynthesisPrompt', () => {
    it('should return a factcheck prompt containing the query', () => {
      const prompt = getSynthesisPrompt('factcheck', 'Earth is flat');
      expect(prompt).toContain('fact-checker');
      expect(prompt).toContain('Earth is flat');
      expect(prompt).toContain('VERDICT');
    });

    it('should return a news prompt containing the query', () => {
      const prompt = getSynthesisPrompt('news', 'AI developments');
      expect(prompt).toContain('news analyst');
      expect(prompt).toContain('AI developments');
      expect(prompt).toContain('Key Headlines');
    });

    it('should return a local prompt containing the query', () => {
      const prompt = getSynthesisPrompt('local', 'sushi restaurants');
      expect(prompt).toContain('local guide');
      expect(prompt).toContain('sushi restaurants');
      expect(prompt).toContain('Recommendations');
    });

    it('should return a weather prompt containing the query', () => {
      const prompt = getSynthesisPrompt('weather', 'forecast in NYC');
      expect(prompt).toContain('weather');
      expect(prompt).toContain('forecast in NYC');
      expect(prompt).toContain('conditions');
    });

    it('should return a stock/crypto prompt for stock mode', () => {
      const prompt = getSynthesisPrompt('stock', 'AAPL');
      expect(prompt).toContain('market data');
      expect(prompt).toContain('AAPL');
      expect(prompt).toContain('price');
    });

    it('should return a stock/crypto prompt for crypto mode', () => {
      const prompt = getSynthesisPrompt('crypto', 'Bitcoin');
      expect(prompt).toContain('market data');
      expect(prompt).toContain('Bitcoin');
    });

    it('should return a general prompt for unknown modes', () => {
      const prompt = getSynthesisPrompt('unknown', 'some query');
      expect(prompt).toContain('search results');
      expect(prompt).toContain('some query');
      expect(prompt).toContain('accurate');
    });

    it('should return a general prompt for default/search mode', () => {
      const prompt = getSynthesisPrompt('general', 'how to code');
      expect(prompt).toContain('search results');
      expect(prompt).toContain('how to code');
    });
  });

  // ==========================================================================
  // search()
  // ==========================================================================

  describe('search', () => {
    it('should throw if Brave is not configured', async () => {
      mockIsBraveConfiguredFn.mockReturnValue(false);

      await expect(search({ query: 'test' })).rejects.toThrow(
        'Brave Search is not configured. Set BRAVE_SEARCH_API_KEY.'
      );
    });

    it('should perform a basic search with AI synthesis', async () => {
      const result = await search({ query: 'how to learn TypeScript' });

      expect(mockIntelligentSearch).toHaveBeenCalledTimes(1);
      expect(mockFormatResults).toHaveBeenCalledTimes(1);
      expect(mockCompleteChat).toHaveBeenCalledTimes(1);

      expect(result.answer).toBe('Synthesized answer from AI');
      expect(result.model).toBe('claude-opus-4-6');
      expect(result.provider).toBe('anthropic');
      expect(result.usedFallback).toBe(false);
      expect(result.sources).toHaveLength(3);
      expect(result.sources[0]).toEqual({ title: 'Result 1', url: 'https://example.com/1' });
    });

    it('should pass correct search options for general queries', async () => {
      await search({ query: 'how to learn TypeScript' });

      expect(mockIntelligentSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'how to learn TypeScript',
          count: 10,
          country: 'us',
          enableRichData: true,
          extraSnippets: true,
          enrichLocations: false,
        })
      );
    });

    it('should use count=5 for weather queries', async () => {
      await search({ query: 'weather in NYC today' });

      expect(mockIntelligentSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          count: 5,
        })
      );
    });

    it('should use count=5 for stock queries', async () => {
      await search({ query: 'AAPL stock price' });

      expect(mockIntelligentSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          count: 5,
        })
      );
    });

    it('should apply freshness from request over intent detection', async () => {
      await search({ query: 'how to learn TypeScript', freshness: 'pm' });

      expect(mockIntelligentSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          freshness: 'pm',
        })
      );
    });

    it('should use intent-detected freshness if none provided', async () => {
      await search({ query: 'NFL scores today' });

      expect(mockIntelligentSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          freshness: 'pd',
        })
      );
    });

    it('should pass location for local queries when provided', async () => {
      await search({
        query: 'restaurants near me',
        location: { latitude: 40.7128, longitude: -74.006 },
      });

      expect(mockIntelligentSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          latitude: 40.7128,
          longitude: -74.006,
          enrichLocations: true,
        })
      );
    });

    it('should not pass location for non-local queries even if provided', async () => {
      await search({
        query: 'how to learn TypeScript',
        location: { latitude: 40.7128, longitude: -74.006 },
      });

      const callArgs = mockIntelligentSearch.mock.calls[0][0];
      expect(callArgs.latitude).toBeUndefined();
      expect(callArgs.longitude).toBeUndefined();
    });

    it('should use custom country code', async () => {
      await search({ query: 'test', country: 'de' });

      expect(mockIntelligentSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          country: 'de',
        })
      );
    });

    it('should return raw results when rawResults is true', async () => {
      const mockResponse = createMockSearchResponse();
      mockIntelligentSearch.mockResolvedValue(mockResponse);
      mockFormatResults.mockReturnValue('Raw formatted');

      const result = await search({ query: 'test', rawResults: true });

      expect(mockCompleteChat).not.toHaveBeenCalled();
      expect(result.answer).toBe('Raw formatted');
      expect(result.model).toBe('none');
      expect(result.provider).toBe('brave');
      expect(result.usedFallback).toBe(false);
      expect(result.rawResponse).toBe(mockResponse);
      expect(result.sources).toHaveLength(3);
    });

    it('should include rich data in results when available', async () => {
      mockIntelligentSearch.mockResolvedValue(
        createMockSearchResponse({
          richData: {
            subtype: 'weather',
            data: { temperature: 72, condition: 'sunny' },
          },
        })
      );

      const result = await search({ query: 'weather in NYC today' });

      expect(result.richData).toEqual({
        type: 'weather',
        data: { temperature: 72, condition: 'sunny' },
      });
    });

    it('should not include richData when not present in response', async () => {
      const result = await search({ query: 'test' });
      expect(result.richData).toBeUndefined();
    });

    it('should include rich data in raw results', async () => {
      mockIntelligentSearch.mockResolvedValue(
        createMockSearchResponse({
          richData: {
            subtype: 'stocks',
            data: { price: 150.25 },
          },
        })
      );

      const result = await search({ query: 'AAPL stock price', rawResults: true });

      expect(result.richData).toEqual({
        type: 'stocks',
        data: { price: 150.25 },
      });
    });

    it('should use custom system prompt for synthesis', async () => {
      const customPrompt = 'You are a custom assistant. Answer concisely.';
      await search({ query: 'test', systemPrompt: customPrompt });

      const messages = mockCompleteChat.mock.calls[0][0];
      expect(messages[0].content).toContain(customPrompt);
    });

    it('should use factcheck synthesis mode when mode is factcheck', async () => {
      await search({ query: 'the earth is flat', mode: 'factcheck' });

      const messages = mockCompleteChat.mock.calls[0][0];
      expect(messages[0].content).toContain('fact-checker');
      expect(messages[0].content).toContain('VERDICT');
    });

    it('should pass formatted results to synthesis prompt', async () => {
      mockFormatResults.mockReturnValue('--- RESULTS ---');
      await search({ query: 'test' });

      const messages = mockCompleteChat.mock.calls[0][0];
      expect(messages[0].content).toContain('--- RESULTS ---');
    });

    it('should call completeChat with correct options', async () => {
      await search({ query: 'test' });

      expect(mockCompleteChat).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          model: 'claude-sonnet-4-6',
          maxTokens: 2048,
          temperature: 0.3,
        })
      );
    });

    it('should handle fallback from chat provider', async () => {
      mockCompleteChat.mockResolvedValue(
        createMockChatResult({
          providerId: 'xai',
          model: 'grok-2',
          usedFallback: true,
        })
      );

      const result = await search({ query: 'test' });

      expect(result.provider).toBe('xai');
      expect(result.model).toBe('grok-2');
      expect(result.usedFallback).toBe(true);
    });

    it('should limit sources to 5 in synthesized results', async () => {
      const manyResults = Array.from({ length: 10 }, (_, i) => ({
        title: `Result ${i + 1}`,
        url: `https://example.com/${i + 1}`,
        description: `Description ${i + 1}`,
      }));

      mockIntelligentSearch.mockResolvedValue(
        createMockSearchResponse({ webResults: manyResults })
      );

      const result = await search({ query: 'test' });

      expect(result.sources).toHaveLength(5);
      expect(result.sources[0].title).toBe('Result 1');
      expect(result.sources[4].title).toBe('Result 5');
    });

    it('should return all sources in raw results mode', async () => {
      const manyResults = Array.from({ length: 10 }, (_, i) => ({
        title: `Result ${i + 1}`,
        url: `https://example.com/${i + 1}`,
        description: `Description ${i + 1}`,
      }));

      mockIntelligentSearch.mockResolvedValue(
        createMockSearchResponse({ webResults: manyResults })
      );

      const result = await search({ query: 'test', rawResults: true });

      expect(result.sources).toHaveLength(10);
    });

    it('should propagate intelligentSearch errors', async () => {
      mockIntelligentSearch.mockRejectedValue(new Error('API rate limit'));

      await expect(search({ query: 'test' })).rejects.toThrow('API rate limit');
    });

    it('should propagate completeChat errors', async () => {
      mockCompleteChat.mockRejectedValue(new Error('Model unavailable'));

      await expect(search({ query: 'test' })).rejects.toThrow('Model unavailable');
    });

    it('should default country to us', async () => {
      await search({ query: 'test' });

      expect(mockIntelligentSearch).toHaveBeenCalledWith(
        expect.objectContaining({ country: 'us' })
      );
    });

    it('should default mode to search', async () => {
      // With mode=search and a general query, the synthesis mode should be the intent type
      await search({ query: 'how to bake a cake' });

      // Should not use factcheck prompt
      const messages = mockCompleteChat.mock.calls[0][0];
      expect(messages[0].content).not.toContain('fact-checker');
    });
  });

  // ==========================================================================
  // factCheck()
  // ==========================================================================

  describe('factCheck', () => {
    it('should call search with factcheck mode', async () => {
      const result = await factCheck('the earth is round');

      expect(mockIntelligentSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'Fact check: the earth is round',
        })
      );

      expect(result.answer).toBe('Synthesized answer from AI');
    });

    it('should prepend "Fact check:" to the claim', async () => {
      await factCheck('water is wet');

      expect(mockIntelligentSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'Fact check: water is wet',
        })
      );
    });

    it('should use factcheck synthesis prompt', async () => {
      await factCheck('cats can fly');

      const messages = mockCompleteChat.mock.calls[0][0];
      expect(messages[0].content).toContain('fact-checker');
      expect(messages[0].content).toContain('VERDICT');
    });
  });

  // ==========================================================================
  // searchNews()
  // ==========================================================================

  describe('searchNews', () => {
    it('should call search with news mode and default freshness', async () => {
      await searchNews('AI developments');

      expect(mockIntelligentSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'AI developments',
          freshness: 'pw',
        })
      );
    });

    it('should use custom freshness parameter', async () => {
      await searchNews('tech news', 'pd');

      expect(mockIntelligentSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          freshness: 'pd',
        })
      );
    });

    it('should accept pm freshness', async () => {
      await searchNews('monthly recap', 'pm');

      expect(mockIntelligentSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          freshness: 'pm',
        })
      );
    });
  });

  // ==========================================================================
  // searchLocalBusinesses()
  // ==========================================================================

  describe('searchLocalBusinesses', () => {
    it('should call search with local mode and location', async () => {
      await searchLocalBusinesses('pizza restaurants', 40.7128, -74.006);

      expect(mockIntelligentSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'pizza restaurants',
          enrichLocations: true,
        })
      );
    });

    it('should pass coordinates when intent needs location', async () => {
      // "pizza restaurants" matches local intent (has "restaurant")
      await searchLocalBusinesses('pizza restaurant near me', 37.7749, -122.4194);

      expect(mockIntelligentSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          latitude: 37.7749,
          longitude: -122.4194,
        })
      );
    });
  });

  // ==========================================================================
  // Default export
  // ==========================================================================

  describe('default export', () => {
    it('should export search function', () => {
      expect(braveSearchService.search).toBe(search);
    });

    it('should export factCheck function', () => {
      expect(braveSearchService.factCheck).toBe(factCheck);
    });

    it('should export searchNews function', () => {
      expect(braveSearchService.searchNews).toBe(searchNews);
    });

    it('should export searchLocalBusinesses function', () => {
      expect(braveSearchService.searchLocalBusinesses).toBe(searchLocalBusinesses);
    });

    it('should export isBraveConfigured function', () => {
      expect(braveSearchService.isBraveConfigured).toBeDefined();
    });
  });

  // ==========================================================================
  // isBraveConfigured (re-export)
  // ==========================================================================

  describe('isBraveConfigured re-export', () => {
    it('should re-export isBraveConfigured from client', () => {
      mockIsBraveConfiguredFn.mockReturnValue(true);
      expect(isBraveConfigured()).toBe(true);

      mockIsBraveConfiguredFn.mockReturnValue(false);
      expect(isBraveConfigured()).toBe(false);
    });
  });

  // ==========================================================================
  // Edge cases and integration-like scenarios
  // ==========================================================================

  describe('edge cases', () => {
    it('should handle empty web results', async () => {
      mockIntelligentSearch.mockResolvedValue(createMockSearchResponse({ webResults: [] }));

      const result = await search({ query: 'obscure query' });

      expect(result.sources).toHaveLength(0);
      expect(mockCompleteChat).toHaveBeenCalled();
    });

    it('should handle single web result', async () => {
      mockIntelligentSearch.mockResolvedValue(
        createMockSearchResponse({
          webResults: [
            { title: 'Only Result', url: 'https://example.com/only', description: 'Only one' },
          ],
        })
      );

      const result = await search({ query: 'specific query' });

      expect(result.sources).toHaveLength(1);
      expect(result.sources[0].title).toBe('Only Result');
    });

    it('should handle empty query string', async () => {
      // The function doesn't validate empty queries itself; it passes to intelligentSearch
      await search({ query: '' });

      expect(mockIntelligentSearch).toHaveBeenCalledWith(expect.objectContaining({ query: '' }));
    });

    it('should detect intent correctly for mixed-signal queries', () => {
      // Stock ticker takes priority because it matches before news
      const result = detectQueryIntent('AAPL stock price today');
      expect(result.type).toBe('stock');
    });

    it('should detect weather over news for ambiguous queries', () => {
      // "forecast for tomorrow" should match weather, not news
      const result = detectQueryIntent('forecast for tomorrow in Seattle');
      expect(result.type).toBe('weather');
    });
  });
});
