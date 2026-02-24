import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the logger before importing the module under test
vi.mock('@/lib/logger', () => ({
  logger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import {
  isBraveConfigured,
  braveWebSearch,
  intelligentSearch,
  searchRecentNews,
  searchWithRealTimeData,
  searchLocal,
  enrichLocationResults,
  formatResultsForSynthesis,
} from './client';
import type {
  BraveSearchOptions,
  BraveWebResult,
  BraveLocationResult,
  BraveRichHint,
  BraveRichData,
  BravePOIDetails,
  BraveSearchResponse,
  IntelligentSearchOptions,
} from './client';
import braveClient from './client';

// Helper to create a mock fetch response
function createFetchResponse(body: unknown, ok = true, status = 200, statusText = 'OK') {
  return {
    ok,
    status,
    statusText,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  };
}

describe('Brave Search Client', () => {
  const mockFetch = global.fetch as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    // Default: API key is set
    vi.stubEnv('BRAVE_SEARCH_API_KEY', 'test-api-key');
  });

  // ==========================================================================
  // TYPE EXPORT VALIDATION
  // ==========================================================================

  describe('type exports', () => {
    it('should export BraveSearchOptions interface', () => {
      const options: BraveSearchOptions = {
        query: 'test',
        count: 10,
        offset: 0,
        freshness: 'pd',
        country: 'US',
        searchLang: 'en',
        safeSearch: 'moderate',
        extraSnippets: true,
        enableRichData: true,
        latitude: 40.7,
        longitude: -74.0,
      };
      expect(options.query).toBe('test');
    });

    it('should export BraveWebResult interface', () => {
      const result: BraveWebResult = {
        title: 'Title',
        url: 'https://example.com',
        description: 'Desc',
        extraSnippets: ['s1'],
        age: '2h',
        language: 'en',
        familyFriendly: true,
        forum: {
          forumName: 'Reddit',
          numAnswers: 5,
          score: '100',
          question: 'Q?',
          topComment: 'Comment',
        },
        article: {
          author: 'Author',
          date: '2026-01-01',
          publisher: 'Pub',
        },
      };
      expect(result.title).toBe('Title');
    });

    it('should export BraveLocationResult interface', () => {
      const loc: BraveLocationResult = {
        id: 'loc1',
        title: 'Cafe',
        address: '123 Main St',
        phone: '555-1234',
        rating: 4.5,
        reviewCount: 100,
        priceRange: '$$',
        category: 'restaurant',
        distance: '0.5 mi',
      };
      expect(loc.id).toBe('loc1');
    });

    it('should export BraveRichHint interface', () => {
      const hint: BraveRichHint = {
        vertical: 'weather',
        callbackKey: 'abc123',
      };
      expect(hint.vertical).toBe('weather');
    });

    it('should export BraveRichData interface', () => {
      const data: BraveRichData = {
        type: 'rich',
        subtype: 'weather',
        data: { temp: 72 },
      };
      expect(data.type).toBe('rich');
    });

    it('should export BravePOIDetails interface', () => {
      const poi: BravePOIDetails = {
        id: 'poi1',
        name: 'Coffee Shop',
        address: '456 Oak Ave',
        phone: '555-5678',
        website: 'https://coffee.example.com',
        rating: 4.2,
        reviewCount: 50,
        priceRange: '$',
        hours: ['Mon-Fri 7am-5pm'],
        images: ['https://img.example.com/1.jpg'],
        description: 'Great coffee',
      };
      expect(poi.name).toBe('Coffee Shop');
    });

    it('should export BraveSearchResponse interface', () => {
      const response: BraveSearchResponse = {
        query: 'test',
        webResults: [],
        locationResults: [],
        moreResultsAvailable: false,
      };
      expect(response.query).toBe('test');
    });

    it('should export IntelligentSearchOptions interface', () => {
      const opts: IntelligentSearchOptions = {
        query: 'test',
        enrichLocations: true,
        includeFaq: true,
        includeDiscussions: true,
      };
      expect(opts.enrichLocations).toBe(true);
    });
  });

  // ==========================================================================
  // DEFAULT EXPORT
  // ==========================================================================

  describe('default export (braveClient)', () => {
    it('should export braveClient with all public functions', () => {
      expect(braveClient).toBeDefined();
      expect(braveClient.isBraveConfigured).toBe(isBraveConfigured);
      expect(braveClient.braveWebSearch).toBe(braveWebSearch);
      expect(braveClient.intelligentSearch).toBe(intelligentSearch);
      expect(braveClient.searchRecentNews).toBe(searchRecentNews);
      expect(braveClient.searchWithRealTimeData).toBe(searchWithRealTimeData);
      expect(braveClient.searchLocal).toBe(searchLocal);
      expect(braveClient.enrichLocationResults).toBe(enrichLocationResults);
      expect(braveClient.formatResultsForSynthesis).toBe(formatResultsForSynthesis);
    });
  });

  // ==========================================================================
  // isBraveConfigured
  // ==========================================================================

  describe('isBraveConfigured', () => {
    it('should return true when BRAVE_SEARCH_API_KEY is set', () => {
      vi.stubEnv('BRAVE_SEARCH_API_KEY', 'my-key');
      expect(isBraveConfigured()).toBe(true);
    });

    it('should return false when BRAVE_SEARCH_API_KEY is empty', () => {
      vi.stubEnv('BRAVE_SEARCH_API_KEY', '');
      expect(isBraveConfigured()).toBe(false);
    });

    it('should return false when BRAVE_SEARCH_API_KEY is undefined', () => {
      delete process.env.BRAVE_SEARCH_API_KEY;
      expect(isBraveConfigured()).toBe(false);
    });
  });

  // ==========================================================================
  // braveWebSearch
  // ==========================================================================

  describe('braveWebSearch', () => {
    it('should throw when API key is not configured', async () => {
      delete process.env.BRAVE_SEARCH_API_KEY;
      await expect(braveWebSearch({ query: 'test' })).rejects.toThrow(
        'BRAVE_SEARCH_API_KEY is not configured'
      );
    });

    it('should throw on non-OK response', async () => {
      mockFetch.mockResolvedValueOnce(
        createFetchResponse({ error: 'rate limited' }, false, 429, 'Too Many Requests')
      );
      await expect(braveWebSearch({ query: 'test' })).rejects.toThrow(
        'Brave API error: 429 Too Many Requests'
      );
    });

    it('should make a basic search request with default parameters', async () => {
      const rawResponse = {
        query: { original: 'typescript tutorial' },
        web: {
          results: [
            {
              title: 'TypeScript Handbook',
              url: 'https://ts.dev',
              description: 'Official TS docs',
              extra_snippets: ['Snippet 1'],
              age: '3d',
              language: 'en',
              family_friendly: true,
            },
          ],
        },
      };
      mockFetch.mockResolvedValueOnce(createFetchResponse(rawResponse));

      const result = await braveWebSearch({ query: 'typescript tutorial' });

      expect(result.query).toBe('typescript tutorial');
      expect(result.webResults).toHaveLength(1);
      expect(result.webResults[0]).toEqual({
        title: 'TypeScript Handbook',
        url: 'https://ts.dev',
        description: 'Official TS docs',
        extraSnippets: ['Snippet 1'],
        age: '3d',
        language: 'en',
        familyFriendly: true,
      });
      expect(result.locationResults).toEqual([]);
      expect(result.moreResultsAvailable).toBe(false);

      // Verify fetch was called with correct URL params
      const fetchCall = mockFetch.mock.calls[0];
      const calledUrl = new URL(fetchCall[0] as string);
      expect(calledUrl.pathname).toBe('/res/v1/web/search');
      expect(calledUrl.searchParams.get('q')).toBe('typescript tutorial');
      expect(calledUrl.searchParams.get('count')).toBe('10');
      expect(calledUrl.searchParams.get('offset')).toBe('0');
      expect(calledUrl.searchParams.get('country')).toBe('us');
      expect(calledUrl.searchParams.get('search_lang')).toBe('en');
      expect(calledUrl.searchParams.get('safesearch')).toBe('moderate');
      expect(calledUrl.searchParams.get('extra_snippets')).toBe('true');
      expect(calledUrl.searchParams.get('enable_rich_callback')).toBe('1');
    });

    it('should pass custom parameters', async () => {
      mockFetch.mockResolvedValueOnce(createFetchResponse({ query: {}, web: {} }));

      await braveWebSearch({
        query: 'news',
        count: 5,
        offset: 2,
        freshness: 'pd',
        country: 'GB',
        searchLang: 'de',
        safeSearch: 'strict',
        extraSnippets: false,
        enableRichData: false,
      });

      const calledUrl = new URL(mockFetch.mock.calls[0][0] as string);
      expect(calledUrl.searchParams.get('q')).toBe('news');
      expect(calledUrl.searchParams.get('count')).toBe('5');
      expect(calledUrl.searchParams.get('offset')).toBe('2');
      expect(calledUrl.searchParams.get('freshness')).toBe('pd');
      expect(calledUrl.searchParams.get('country')).toBe('GB');
      expect(calledUrl.searchParams.get('search_lang')).toBe('de');
      expect(calledUrl.searchParams.get('safesearch')).toBe('strict');
      // extra_snippets should NOT be set when false
      expect(calledUrl.searchParams.get('extra_snippets')).toBeNull();
      // enable_rich_callback should NOT be set when false
      expect(calledUrl.searchParams.get('enable_rich_callback')).toBeNull();
    });

    it('should send location headers when latitude and longitude are provided', async () => {
      mockFetch.mockResolvedValueOnce(createFetchResponse({ query: {}, web: {} }));

      await braveWebSearch({
        query: 'restaurants near me',
        latitude: 37.7749,
        longitude: -122.4194,
      });

      const fetchOptions = mockFetch.mock.calls[0][1] as RequestInit;
      const headers = fetchOptions.headers as Record<string, string>;
      expect(headers['x-loc-lat']).toBe('37.7749');
      expect(headers['x-loc-long']).toBe('-122.4194');
    });

    it('should parse location results', async () => {
      const rawResponse = {
        query: { original: 'coffee shops' },
        web: { results: [] },
        locations: {
          results: [
            {
              id: 'loc-1',
              title: 'Java Cafe',
              address: {
                streetAddress: '123 Main St',
                addressLocality: 'Springfield',
                addressRegion: 'IL',
              },
              phone: '555-0100',
              rating: { ratingValue: 4.5, ratingCount: 200 },
              price_range: '$$',
              categories: ['cafe', 'bakery'],
              distance: { value: 0.3, unit: 'mi' },
            },
          ],
        },
      };
      mockFetch.mockResolvedValueOnce(createFetchResponse(rawResponse));

      const result = await braveWebSearch({ query: 'coffee shops', enableRichData: false });

      expect(result.locationResults).toHaveLength(1);
      expect(result.locationResults[0]).toEqual({
        id: 'loc-1',
        title: 'Java Cafe',
        address: '123 Main St, Springfield, IL',
        phone: '555-0100',
        rating: 4.5,
        reviewCount: 200,
        priceRange: '$$',
        category: 'cafe',
        distance: '0.3 mi',
      });
    });

    it('should parse rich hint', async () => {
      const rawResponse = {
        query: { original: 'weather nyc' },
        web: { results: [] },
        rich: {
          hint: {
            vertical: 'weather',
            callback_key: 'weather-key-123',
          },
        },
      };
      // First call: web search
      mockFetch.mockResolvedValueOnce(createFetchResponse(rawResponse));
      // Second call: rich data callback
      mockFetch.mockResolvedValueOnce(
        createFetchResponse({
          type: 'rich',
          subtype: 'weather',
          data: { temp: 72, condition: 'sunny' },
        })
      );

      const result = await braveWebSearch({ query: 'weather nyc' });

      expect(result.richHint).toEqual({
        vertical: 'weather',
        callbackKey: 'weather-key-123',
      });
      expect(result.richData).toEqual({
        type: 'rich',
        subtype: 'weather',
        data: { temp: 72, condition: 'sunny' },
      });
      // Verify the rich data callback was made
      expect(mockFetch).toHaveBeenCalledTimes(2);
      const richUrl = new URL(mockFetch.mock.calls[1][0] as string);
      expect(richUrl.pathname).toBe('/res/v1/web/rich');
      expect(richUrl.searchParams.get('callback_key')).toBe('weather-key-123');
    });

    it('should handle rich data fetch failure gracefully', async () => {
      const rawResponse = {
        query: { original: 'weather' },
        web: { results: [] },
        rich: {
          hint: { vertical: 'weather', callback_key: 'bad-key' },
        },
      };
      mockFetch.mockResolvedValueOnce(createFetchResponse(rawResponse));
      // Rich data call fails
      mockFetch.mockResolvedValueOnce(
        createFetchResponse({ error: 'not found' }, false, 404, 'Not Found')
      );

      const result = await braveWebSearch({ query: 'weather' });

      // Should still return results without rich data
      expect(result.richData).toBeUndefined();
      expect(result.richHint).toBeDefined();
    });

    it('should parse FAQ results', async () => {
      const rawResponse = {
        query: { original: 'how to bake bread' },
        web: { results: [] },
        faq: {
          results: [
            {
              question: 'How long does bread take?',
              answer: 'About 3 hours total.',
              url: 'https://bread.example.com/faq',
            },
          ],
        },
      };
      mockFetch.mockResolvedValueOnce(createFetchResponse(rawResponse));

      const result = await braveWebSearch({
        query: 'how to bake bread',
        enableRichData: false,
      });

      expect(result.faq).toHaveLength(1);
      expect(result.faq![0]).toEqual({
        question: 'How long does bread take?',
        answer: 'About 3 hours total.',
        url: 'https://bread.example.com/faq',
      });
    });

    it('should parse discussion results', async () => {
      const rawResponse = {
        query: { original: 'best laptop 2026' },
        web: { results: [] },
        discussions: {
          results: [
            {
              title: 'Best laptops thread',
              url: 'https://reddit.com/r/tech/best-laptop',
              description: 'Community discussion on laptops',
            },
          ],
        },
      };
      mockFetch.mockResolvedValueOnce(createFetchResponse(rawResponse));

      const result = await braveWebSearch({
        query: 'best laptop 2026',
        enableRichData: false,
      });

      expect(result.discussions).toHaveLength(1);
      expect(result.discussions![0]).toEqual({
        title: 'Best laptops thread',
        url: 'https://reddit.com/r/tech/best-laptop',
        description: 'Community discussion on laptops',
      });
    });

    it('should report moreResultsAvailable from query metadata', async () => {
      mockFetch.mockResolvedValueOnce(
        createFetchResponse({
          query: { original: 'test', more_results_available: true },
          web: { results: [] },
        })
      );

      const result = await braveWebSearch({ query: 'test', enableRichData: false });
      expect(result.moreResultsAvailable).toBe(true);
    });

    it('should handle empty / missing fields gracefully', async () => {
      mockFetch.mockResolvedValueOnce(
        createFetchResponse({
          query: {},
          web: {
            results: [
              {
                // All fields missing
              },
            ],
          },
          locations: {
            results: [
              {
                // All fields missing
              },
            ],
          },
        })
      );

      const result = await braveWebSearch({ query: 'sparse data', enableRichData: false });

      expect(result.webResults[0]).toEqual({
        title: '',
        url: '',
        description: '',
        extraSnippets: undefined,
        age: undefined,
        language: undefined,
        familyFriendly: undefined,
      });
      expect(result.locationResults[0].id).toBe('');
      expect(result.locationResults[0].title).toBe('');
    });

    it('should send correct authorization header', async () => {
      vi.stubEnv('BRAVE_SEARCH_API_KEY', 'super-secret-key');
      mockFetch.mockResolvedValueOnce(createFetchResponse({ query: {}, web: {} }));

      await braveWebSearch({ query: 'test', enableRichData: false });

      const fetchOptions = mockFetch.mock.calls[0][1] as RequestInit;
      const headers = fetchOptions.headers as Record<string, string>;
      expect(headers['X-Subscription-Token']).toBe('super-secret-key');
      expect(headers['Accept']).toBe('application/json');
    });
  });

  // ==========================================================================
  // enrichLocationResults
  // ==========================================================================

  describe('enrichLocationResults', () => {
    it('should return empty array for empty location IDs', async () => {
      const result = await enrichLocationResults([]);
      expect(result).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should return empty array when API key is not set', async () => {
      delete process.env.BRAVE_SEARCH_API_KEY;
      const result = await enrichLocationResults(['id1']);
      expect(result).toEqual([]);
    });

    it('should fetch and merge POI details with descriptions', async () => {
      const poisResponse = {
        results: [
          {
            id: 'poi-1',
            name: 'Blue Bottle Coffee',
            address: {
              streetAddress: '450 W 15th St',
              addressLocality: 'New York',
              addressRegion: 'NY',
              postalCode: '10011',
            },
            phone: '212-555-0123',
            website: 'https://bluebottlecoffee.com',
            rating: { ratingValue: 4.6, ratingCount: 350 },
            price_range: '$$',
            opening_hours: ['Mon-Fri 7am-7pm', 'Sat-Sun 8am-6pm'],
            images: [
              { url: 'https://img.example.com/bb1.jpg' },
              { url: 'https://img.example.com/bb2.jpg' },
            ],
          },
        ],
      };
      const descsResponse = {
        results: [{ id: 'poi-1', description: 'Artisanal coffee roasters' }],
      };

      mockFetch.mockResolvedValueOnce(createFetchResponse(poisResponse));
      mockFetch.mockResolvedValueOnce(createFetchResponse(descsResponse));

      const result = await enrichLocationResults(['poi-1']);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'poi-1',
        name: 'Blue Bottle Coffee',
        address: '450 W 15th St, New York, NY, 10011',
        phone: '212-555-0123',
        website: 'https://bluebottlecoffee.com',
        rating: 4.6,
        reviewCount: 350,
        priceRange: '$$',
        hours: ['Mon-Fri 7am-7pm', 'Sat-Sun 8am-6pm'],
        images: ['https://img.example.com/bb1.jpg', 'https://img.example.com/bb2.jpg'],
        description: 'Artisanal coffee roasters',
      });

      // Verify both POI and description endpoints were called
      expect(mockFetch).toHaveBeenCalledTimes(2);
      const poisUrl = new URL(mockFetch.mock.calls[0][0] as string);
      expect(poisUrl.pathname).toBe('/res/v1/local/pois');
      expect(poisUrl.searchParams.getAll('ids')).toEqual(['poi-1']);

      const descsUrl = new URL(mockFetch.mock.calls[1][0] as string);
      expect(descsUrl.pathname).toBe('/res/v1/local/descriptions');
    });

    it('should limit IDs to 20', async () => {
      const ids = Array.from({ length: 25 }, (_, i) => `id-${i}`);

      mockFetch.mockResolvedValueOnce(createFetchResponse({ results: [] }));
      mockFetch.mockResolvedValueOnce(createFetchResponse({ results: [] }));

      await enrichLocationResults(ids);

      const poisUrl = new URL(mockFetch.mock.calls[0][0] as string);
      expect(poisUrl.searchParams.getAll('ids')).toHaveLength(20);
    });

    it('should handle missing description for a POI', async () => {
      mockFetch.mockResolvedValueOnce(
        createFetchResponse({
          results: [{ id: 'poi-2', name: 'No Description Cafe' }],
        })
      );
      mockFetch.mockResolvedValueOnce(createFetchResponse({ results: [] }));

      const result = await enrichLocationResults(['poi-2']);

      expect(result[0].description).toBeUndefined();
    });
  });

  // ==========================================================================
  // intelligentSearch
  // ==========================================================================

  describe('intelligentSearch', () => {
    it('should perform a basic search and return results', async () => {
      mockFetch.mockResolvedValueOnce(
        createFetchResponse({
          query: { original: 'AI news' },
          web: {
            results: [
              {
                title: 'AI Breakthroughs',
                url: 'https://ai.example.com',
                description: 'Latest AI news',
              },
            ],
          },
        })
      );

      const result = await intelligentSearch({
        query: 'AI news',
        enableRichData: false,
        enrichLocations: false,
      });

      expect(result.webResults).toHaveLength(1);
    });

    it('should enrich locations when enrichLocations is true and locations exist', async () => {
      // First call: web search with locations
      mockFetch.mockResolvedValueOnce(
        createFetchResponse({
          query: { original: 'pizza near me' },
          web: { results: [] },
          locations: {
            results: [
              {
                id: 'pizza-1',
                title: 'Pizza Palace',
                address: {
                  streetAddress: '100 Pizza St',
                  addressLocality: 'Town',
                  addressRegion: 'CA',
                },
              },
            ],
          },
        })
      );
      // Second call: POI enrichment
      mockFetch.mockResolvedValueOnce(
        createFetchResponse({
          results: [{ id: 'pizza-1', name: 'Pizza Palace', phone: '555-PIZZA' }],
        })
      );
      // Third call: descriptions
      mockFetch.mockResolvedValueOnce(
        createFetchResponse({
          results: [{ id: 'pizza-1', description: 'Best pizza in town' }],
        })
      );

      const result = await intelligentSearch({
        query: 'pizza near me',
        enableRichData: false,
        enrichLocations: true,
      });

      expect(result.locationResults).toHaveLength(1);
      expect(result.poiDetails).toBeDefined();
      expect(result.poiDetails).toHaveLength(1);
      expect(result.poiDetails![0].description).toBe('Best pizza in town');
    });

    it('should skip enrichment when enrichLocations is false', async () => {
      mockFetch.mockResolvedValueOnce(
        createFetchResponse({
          query: { original: 'pizza near me' },
          web: { results: [] },
          locations: {
            results: [{ id: 'pizza-1', title: 'Pizza Palace' }],
          },
        })
      );

      const result = await intelligentSearch({
        query: 'pizza near me',
        enableRichData: false,
        enrichLocations: false,
      });

      expect(result.locationResults).toHaveLength(1);
      expect(result.poiDetails).toBeUndefined();
      // Only the web search call, no enrichment calls
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should handle enrichment failure gracefully', async () => {
      mockFetch.mockResolvedValueOnce(
        createFetchResponse({
          query: { original: 'restaurants' },
          web: { results: [] },
          locations: {
            results: [{ id: 'r-1', title: 'Restaurant' }],
          },
        })
      );
      // Both POI and descriptions calls need mocks since enrichLocationResults
      // fires them in Promise.all. Both fail in this scenario.
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await intelligentSearch({
        query: 'restaurants',
        enableRichData: false,
        enrichLocations: true,
      });

      // Should still return the base search results
      expect(result.locationResults).toHaveLength(1);
      expect(result.poiDetails).toBeUndefined();
    });
  });

  // ==========================================================================
  // searchRecentNews
  // ==========================================================================

  describe('searchRecentNews', () => {
    it('should default to past week freshness', async () => {
      mockFetch.mockResolvedValueOnce(createFetchResponse({ query: {}, web: { results: [] } }));

      await searchRecentNews('election results');

      const calledUrl = new URL(mockFetch.mock.calls[0][0] as string);
      expect(calledUrl.searchParams.get('freshness')).toBe('pw');
      expect(calledUrl.searchParams.get('q')).toBe('election results');
    });

    it('should allow overriding freshness', async () => {
      mockFetch.mockResolvedValueOnce(createFetchResponse({ query: {}, web: { results: [] } }));

      await searchRecentNews('breaking news', { freshness: 'pd' });

      const calledUrl = new URL(mockFetch.mock.calls[0][0] as string);
      expect(calledUrl.searchParams.get('freshness')).toBe('pd');
    });

    it('should default to count of 10', async () => {
      mockFetch.mockResolvedValueOnce(createFetchResponse({ query: {}, web: { results: [] } }));

      await searchRecentNews('tech news');

      const calledUrl = new URL(mockFetch.mock.calls[0][0] as string);
      expect(calledUrl.searchParams.get('count')).toBe('10');
    });
  });

  // ==========================================================================
  // searchWithRealTimeData
  // ==========================================================================

  describe('searchWithRealTimeData', () => {
    it('should enable rich data and extra snippets', async () => {
      mockFetch.mockResolvedValueOnce(createFetchResponse({ query: {}, web: { results: [] } }));

      await searchWithRealTimeData('AAPL stock price');

      const calledUrl = new URL(mockFetch.mock.calls[0][0] as string);
      expect(calledUrl.searchParams.get('enable_rich_callback')).toBe('1');
      expect(calledUrl.searchParams.get('extra_snippets')).toBe('true');
      expect(calledUrl.searchParams.get('count')).toBe('5');
    });

    it('should allow overriding count', async () => {
      mockFetch.mockResolvedValueOnce(createFetchResponse({ query: {}, web: { results: [] } }));

      await searchWithRealTimeData('BTC price', { count: 3 });

      const calledUrl = new URL(mockFetch.mock.calls[0][0] as string);
      expect(calledUrl.searchParams.get('count')).toBe('3');
    });
  });

  // ==========================================================================
  // searchLocal
  // ==========================================================================

  describe('searchLocal', () => {
    it('should pass latitude and longitude and enable enrichment', async () => {
      // Web search call
      mockFetch.mockResolvedValueOnce(
        createFetchResponse({
          query: { original: 'sushi' },
          web: { results: [] },
          locations: { results: [] },
        })
      );

      const result = await searchLocal('sushi', 34.0522, -118.2437);

      const fetchOptions = mockFetch.mock.calls[0][1] as RequestInit;
      const headers = fetchOptions.headers as Record<string, string>;
      expect(headers['x-loc-lat']).toBe('34.0522');
      expect(headers['x-loc-long']).toBe('-118.2437');

      const calledUrl = new URL(mockFetch.mock.calls[0][0] as string);
      expect(calledUrl.searchParams.get('q')).toBe('sushi');
      expect(calledUrl.searchParams.get('count')).toBe('10');

      expect(result.query).toBe('sushi');
    });
  });

  // ==========================================================================
  // formatResultsForSynthesis
  // ==========================================================================

  describe('formatResultsForSynthesis', () => {
    it('should return empty string for empty response', () => {
      const response: BraveSearchResponse = {
        query: 'test',
        webResults: [],
        locationResults: [],
        moreResultsAvailable: false,
      };
      const result = formatResultsForSynthesis(response);
      expect(result).toBe('');
    });

    it('should format web results', () => {
      const response: BraveSearchResponse = {
        query: 'test',
        webResults: [
          {
            title: 'Test Page',
            url: 'https://test.com',
            description: 'A test page',
            extraSnippets: ['Extra info 1', 'Extra info 2'],
            article: { author: 'John Doe', date: '2026-01-15' },
          },
        ],
        locationResults: [],
        moreResultsAvailable: false,
      };

      const result = formatResultsForSynthesis(response);

      expect(result).toContain('**WEB SEARCH RESULTS:**');
      expect(result).toContain('[1] **Test Page**');
      expect(result).toContain('URL: https://test.com');
      expect(result).toContain('A test page');
      expect(result).toContain('Extra info 1');
      expect(result).toContain('Extra info 2');
      expect(result).toContain('Author: John Doe');
      expect(result).toContain('Date: 2026-01-15');
    });

    it('should format weather rich data', () => {
      const response: BraveSearchResponse = {
        query: 'weather',
        webResults: [],
        locationResults: [],
        moreResultsAvailable: false,
        richData: {
          type: 'rich',
          subtype: 'weather',
          data: {
            location: 'New York',
            current: {
              temp: 72,
              condition: 'Sunny',
              feels_like: 70,
              humidity: 45,
              wind_speed: 10,
              wind_dir: 'NW',
            },
            forecast: [{ date: 'Mon', high: 75, low: 60, condition: 'Cloudy' }],
          },
        },
      };

      const result = formatResultsForSynthesis(response);

      expect(result).toContain('WEATHER FOR NEW YORK');
      expect(result).toContain('Current: 72');
      expect(result).toContain('Sunny');
      expect(result).toContain('Feels like: 70');
      expect(result).toContain('Humidity: 45%');
      expect(result).toContain('Wind: 10 NW');
      expect(result).toContain('Mon');
      expect(result).toContain('75');
    });

    it('should format stock rich data', () => {
      const response: BraveSearchResponse = {
        query: 'AAPL',
        webResults: [],
        locationResults: [],
        moreResultsAvailable: false,
        richData: {
          type: 'rich',
          subtype: 'stock',
          data: {
            symbol: 'AAPL',
            name: 'Apple Inc.',
            price: 178.5,
            change: 2.3,
            change_percent: 1.3,
            volume: '50M',
            market_cap: '2.8T',
          },
        },
      };

      const result = formatResultsForSynthesis(response);

      expect(result).toContain('STOCK: AAPL (Apple Inc.)');
      expect(result).toContain('$178.50');
      expect(result).toContain('+2.30');
      expect(result).toContain('+1.30%');
    });

    it('should format cryptocurrency rich data', () => {
      const response: BraveSearchResponse = {
        query: 'BTC',
        webResults: [],
        locationResults: [],
        moreResultsAvailable: false,
        richData: {
          type: 'rich',
          subtype: 'cryptocurrency',
          data: {
            name: 'Bitcoin',
            symbol: 'BTC',
            price: 65000,
            change_24h: -2.5,
            market_cap: '1.2T',
            volume_24h: '30B',
          },
        },
      };

      const result = formatResultsForSynthesis(response);

      expect(result).toContain('CRYPTOCURRENCY: Bitcoin (BTC)');
      expect(result).toContain('-2.50%');
    });

    it('should format currency rich data', () => {
      const response: BraveSearchResponse = {
        query: 'USD to EUR',
        webResults: [],
        locationResults: [],
        moreResultsAvailable: false,
        richData: {
          type: 'rich',
          subtype: 'currency',
          data: {
            from: 'USD',
            to: 'EUR',
            rate: 0.92,
            amount: 100,
          },
        },
      };

      const result = formatResultsForSynthesis(response);

      expect(result).toContain('CURRENCY CONVERSION');
      expect(result).toContain('100 USD = 92.00 EUR');
      expect(result).toContain('1 USD = 0.9200 EUR');
    });

    it('should format unknown rich data as JSON', () => {
      const response: BraveSearchResponse = {
        query: 'something',
        webResults: [],
        locationResults: [],
        moreResultsAvailable: false,
        richData: {
          type: 'rich',
          subtype: 'sports',
          data: { game: 'Lakers vs Celtics', score: '110-105' },
        },
      };

      const result = formatResultsForSynthesis(response);

      expect(result).toContain('SPORTS DATA');
      expect(result).toContain('Lakers vs Celtics');
    });

    it('should format FAQ results', () => {
      const response: BraveSearchResponse = {
        query: 'how to cook pasta',
        webResults: [],
        locationResults: [],
        moreResultsAvailable: false,
        faq: [
          {
            question: 'How long to boil?',
            answer: '8-10 minutes',
            url: 'https://cook.example.com',
          },
        ],
      };

      const result = formatResultsForSynthesis(response);

      expect(result).toContain('FREQUENTLY ASKED QUESTIONS');
      expect(result).toContain('Q: How long to boil?');
      expect(result).toContain('A: 8-10 minutes');
      expect(result).toContain('Source: https://cook.example.com');
    });

    it('should format location results when no POI details', () => {
      const response: BraveSearchResponse = {
        query: 'coffee shops',
        webResults: [],
        locationResults: [
          {
            id: 'loc1',
            title: 'Best Coffee',
            address: '123 Main St',
            phone: '555-1234',
            rating: 4.5,
            reviewCount: 100,
            priceRange: '$$',
            distance: '0.5 mi',
          },
        ],
        moreResultsAvailable: false,
      };

      const result = formatResultsForSynthesis(response);

      expect(result).toContain('**LOCAL RESULTS:**');
      expect(result).toContain('[1] **Best Coffee**');
      expect(result).toContain('Address: 123 Main St');
      expect(result).toContain('Phone: 555-1234');
      expect(result).toContain('Rating: 4.5/5 (100 reviews)');
      expect(result).toContain('Price: $$');
      expect(result).toContain('Distance: 0.5 mi');
    });

    it('should format POI details instead of location results when both exist', () => {
      const response: BraveSearchResponse = {
        query: 'coffee',
        webResults: [],
        locationResults: [{ id: 'loc1', title: 'Basic Location' }],
        moreResultsAvailable: false,
        poiDetails: [
          {
            id: 'loc1',
            name: 'Detailed Coffee Place',
            address: '456 Oak Ave',
            phone: '555-5678',
            website: 'https://coffee.example.com',
            rating: 4.8,
            reviewCount: 500,
            priceRange: '$$$',
            hours: ['Mon-Fri 6am-8pm', 'Sat 7am-6pm'],
            description: 'Premium artisanal coffee',
          },
        ],
      };

      const result = formatResultsForSynthesis(response);

      expect(result).toContain('**LOCAL BUSINESS DETAILS:**');
      expect(result).toContain('Detailed Coffee Place');
      expect(result).toContain('Website: https://coffee.example.com');
      expect(result).toContain('Hours: Mon-Fri 6am-8pm, Sat 7am-6pm');
      expect(result).toContain('Description: Premium artisanal coffee');
      // Should NOT show the basic location results
      expect(result).not.toContain('**LOCAL RESULTS:**');
      expect(result).not.toContain('Basic Location');
    });

    it('should format discussion results', () => {
      const response: BraveSearchResponse = {
        query: 'best laptop',
        webResults: [],
        locationResults: [],
        moreResultsAvailable: false,
        discussions: [
          {
            title: 'Best laptops 2026',
            url: 'https://reddit.com/r/laptops/123',
            description: 'Community recommends MacBook Pro',
          },
        ],
      };

      const result = formatResultsForSynthesis(response);

      expect(result).toContain('**DISCUSSIONS & FORUMS:**');
      expect(result).toContain('[1] **Best laptops 2026**');
      expect(result).toContain('Community recommends MacBook Pro');
    });

    it('should join multiple sections with separator', () => {
      const response: BraveSearchResponse = {
        query: 'test',
        webResults: [{ title: 'T', url: 'https://t.com', description: 'D' }],
        locationResults: [],
        moreResultsAvailable: false,
        faq: [{ question: 'Q', answer: 'A', url: 'https://q.com' }],
      };

      const result = formatResultsForSynthesis(response);

      expect(result).toContain('---');
    });

    it('should handle negative stock change', () => {
      const response: BraveSearchResponse = {
        query: 'TSLA',
        webResults: [],
        locationResults: [],
        moreResultsAvailable: false,
        richData: {
          type: 'rich',
          subtype: 'stock',
          data: {
            symbol: 'TSLA',
            name: 'Tesla',
            price: 200.0,
            change: -5.5,
            change_percent: -2.7,
          },
        },
      };

      const result = formatResultsForSynthesis(response);

      expect(result).toContain('-5.50');
      expect(result).toContain('-2.70%');
    });

    it('should handle location results with missing optional fields', () => {
      const response: BraveSearchResponse = {
        query: 'place',
        webResults: [],
        locationResults: [{ id: 'loc-minimal', title: 'Minimal Place' }],
        moreResultsAvailable: false,
      };

      const result = formatResultsForSynthesis(response);

      expect(result).toContain('[1] **Minimal Place**');
      // Should NOT contain Address:, Phone:, etc. lines
      expect(result).not.toContain('Address:');
      expect(result).not.toContain('Phone:');
      expect(result).not.toContain('Rating:');
    });

    it('should handle location with zero review count', () => {
      const response: BraveSearchResponse = {
        query: 'place',
        webResults: [],
        locationResults: [{ id: 'loc1', title: 'New Place', rating: 3.0 }],
        moreResultsAvailable: false,
      };

      const result = formatResultsForSynthesis(response);

      expect(result).toContain('Rating: 3/5 (0 reviews)');
    });
  });
});
