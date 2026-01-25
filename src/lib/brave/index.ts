/**
 * BRAVE SEARCH MODULE
 *
 * Comprehensive web search using Brave Search API.
 * Replaces Perplexity with a more powerful, cost-effective solution.
 *
 * Features:
 * - Web search with extra snippets
 * - Rich data (weather, stocks, sports, crypto)
 * - Local POI enrichment
 * - AI synthesis with Claude/xAI fallback
 */

// Client exports
export {
  isBraveConfigured,
  braveWebSearch,
  intelligentSearch,
  searchRecentNews,
  searchWithRealTimeData,
  searchLocal,
  enrichLocationResults,
  formatResultsForSynthesis,
  type BraveSearchOptions,
  type BraveSearchResponse,
  type BraveWebResult,
  type BraveLocationResult,
  type BraveRichData,
  type BravePOIDetails,
} from './client';

// Service exports
export {
  search,
  factCheck,
  searchNews,
  searchLocalBusinesses,
  type SearchRequest,
  type SearchResult,
} from './search-service';

// Default export
export { default as braveClient } from './client';
export { default as braveSearchService } from './search-service';
