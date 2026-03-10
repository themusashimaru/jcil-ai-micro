/**
 * BRAVE SEARCH CLIENT
 *
 * Comprehensive integration with Brave Search API for intelligent web search.
 * Replaces Perplexity with a more powerful, cost-effective solution.
 *
 * Features:
 * - Web search with extra snippets
 * - Rich data (weather, stocks, sports, crypto)
 * - Local POI enrichment
 * - Freshness filtering
 * - Search operators support
 */

import { logger } from '@/lib/logger';

const log = logger('BraveSearch');

// ============================================================================
// CONFIGURATION
// ============================================================================

const BRAVE_API_BASE = 'https://api.search.brave.com/res/v1';

function getBraveApiKey(): string | null {
  return process.env.BRAVE_SEARCH_API_KEY || null;
}

export function isBraveConfigured(): boolean {
  return !!getBraveApiKey();
}

// ============================================================================
// TYPES
// ============================================================================

export interface BraveSearchOptions {
  /** Search query */
  query: string;
  /** Number of results (max 20) */
  count?: number;
  /** Pagination offset (0-9) */
  offset?: number;
  /** Freshness filter: pd (24h), pw (week), pm (month), py (year), or date range */
  freshness?: 'pd' | 'pw' | 'pm' | 'py' | string;
  /** Country code (e.g., 'US', 'GB', 'DE') */
  country?: string;
  /** Search language (e.g., 'en', 'de', 'fr') */
  searchLang?: string;
  /** Safe search level */
  safeSearch?: 'off' | 'moderate' | 'strict';
  /** Enable extra snippets (up to 5 per result) */
  extraSnippets?: boolean;
  /** Enable rich data callbacks (weather, stocks, sports) */
  enableRichData?: boolean;
  /** User's latitude for local results */
  latitude?: number;
  /** User's longitude for local results */
  longitude?: number;
}

export interface BraveWebResult {
  title: string;
  url: string;
  description: string;
  extraSnippets?: string[];
  age?: string;
  language?: string;
  familyFriendly?: boolean;
  /** Forum data if available */
  forum?: {
    forumName?: string;
    numAnswers?: number;
    score?: string;
    question?: string;
    topComment?: string;
  };
  /** Article data if available */
  article?: {
    author?: string;
    date?: string;
    publisher?: string;
  };
}

export interface BraveLocationResult {
  id: string;
  title: string;
  address?: string;
  phone?: string;
  rating?: number;
  reviewCount?: number;
  priceRange?: string;
  category?: string;
  distance?: string;
}

export interface BraveRichHint {
  vertical: string;
  callbackKey: string;
}

export interface BraveRichData {
  type: string;
  subtype: string;
  data: Record<string, unknown>;
}

export interface BravePOIDetails {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  website?: string;
  rating?: number;
  reviewCount?: number;
  priceRange?: string;
  hours?: string[];
  images?: string[];
  description?: string;
}

export interface BraveSearchResponse {
  /** Original query */
  query: string;
  /** Web search results */
  webResults: BraveWebResult[];
  /** Location results (if any) */
  locationResults: BraveLocationResult[];
  /** Rich data hint for follow-up (weather, stocks, etc.) */
  richHint?: BraveRichHint;
  /** Fetched rich data (if enableRichData was true) */
  richData?: BraveRichData;
  /** Enriched POI details (if locations were found and enriched) */
  poiDetails?: BravePOIDetails[];
  /** FAQ extractions */
  faq?: Array<{ question: string; answer: string; url: string }>;
  /** Discussion/forum results */
  discussions?: Array<{ title: string; url: string; description: string }>;
  /** More results available for pagination */
  moreResultsAvailable: boolean;
  /** Total result count estimate */
  totalCount?: number;
}

// ============================================================================
// API HELPERS
// ============================================================================

async function braveApiRequest<T>(
  endpoint: string,
  params: Record<string, string | number | boolean> = {},
  headers: Record<string, string> = {}
): Promise<T> {
  const apiKey = getBraveApiKey();
  if (!apiKey) {
    throw new Error('BRAVE_SEARCH_API_KEY is not configured');
  }

  const url = new URL(`${BRAVE_API_BASE}${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.append(key, String(value));
    }
  });

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': apiKey,
      ...headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    log.error('Brave API error', {
      status: response.status,
      statusText: response.statusText,
      error: errorText,
    });
    throw new Error(`Brave API error: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

// ============================================================================
// WEB SEARCH
// ============================================================================

interface BraveWebSearchRaw {
  query?: {
    original?: string;
    more_results_available?: boolean;
  };
  web?: {
    results?: Array<{
      title?: string;
      url?: string;
      description?: string;
      extra_snippets?: string[];
      age?: string;
      language?: string;
      family_friendly?: boolean;
      meta_url?: {
        hostname?: string;
      };
    }>;
    family_friendly?: boolean;
  };
  locations?: {
    results?: Array<{
      id?: string;
      title?: string;
      address?: {
        addressLocality?: string;
        addressRegion?: string;
        streetAddress?: string;
      };
      phone?: string;
      rating?: {
        ratingValue?: number;
        ratingCount?: number;
      };
      price_range?: string;
      categories?: string[];
      distance?: {
        value?: number;
        unit?: string;
      };
    }>;
  };
  rich?: {
    type?: string;
    hint?: {
      vertical?: string;
      callback_key?: string;
    };
  };
  faq?: {
    results?: Array<{
      question?: string;
      answer?: string;
      url?: string;
    }>;
  };
  discussions?: {
    results?: Array<{
      title?: string;
      url?: string;
      description?: string;
    }>;
  };
  mixed?: {
    main?: Array<{
      type?: string;
      index?: number;
    }>;
  };
}

/**
 * Perform a web search with Brave Search API
 */
export async function braveWebSearch(options: BraveSearchOptions): Promise<BraveSearchResponse> {
  const {
    query,
    count = 10,
    offset = 0,
    freshness,
    country = 'us',
    searchLang = 'en',
    safeSearch = 'moderate',
    extraSnippets = true,
    enableRichData = true,
    latitude,
    longitude,
  } = options;

  log.info('Brave web search', { query, count, freshness, country });

  // Build request parameters
  const params: Record<string, string | number | boolean> = {
    q: query,
    count,
    offset,
    country,
    search_lang: searchLang,
    safesearch: safeSearch,
  };

  if (freshness) {
    params.freshness = freshness;
  }

  if (extraSnippets) {
    params.extra_snippets = true;
  }

  if (enableRichData) {
    params.enable_rich_callback = 1;
  }

  // Location headers for local results
  const headers: Record<string, string> = {};
  if (latitude !== undefined && longitude !== undefined) {
    headers['x-loc-lat'] = String(latitude);
    headers['x-loc-long'] = String(longitude);
  }

  // Make the search request
  const raw = await braveApiRequest<BraveWebSearchRaw>('/web/search', params, headers);

  // Parse web results
  const webResults: BraveWebResult[] = (raw.web?.results || []).map((r) => ({
    title: r.title || '',
    url: r.url || '',
    description: r.description || '',
    extraSnippets: r.extra_snippets,
    age: r.age,
    language: r.language,
    familyFriendly: r.family_friendly,
  }));

  // Parse location results
  const locationResults: BraveLocationResult[] = (raw.locations?.results || []).map((l) => ({
    id: l.id || '',
    title: l.title || '',
    address: [l.address?.streetAddress, l.address?.addressLocality, l.address?.addressRegion]
      .filter(Boolean)
      .join(', '),
    phone: l.phone,
    rating: l.rating?.ratingValue,
    reviewCount: l.rating?.ratingCount,
    priceRange: l.price_range,
    category: l.categories?.[0],
    distance: l.distance ? `${l.distance.value} ${l.distance.unit}` : undefined,
  }));

  // Parse rich hint
  const richHint: BraveRichHint | undefined = raw.rich?.hint
    ? {
        vertical: raw.rich.hint.vertical || '',
        callbackKey: raw.rich.hint.callback_key || '',
      }
    : undefined;

  // Parse FAQ
  const faq = raw.faq?.results?.map((f) => ({
    question: f.question || '',
    answer: f.answer || '',
    url: f.url || '',
  }));

  // Parse discussions
  const discussions = raw.discussions?.results?.map((d) => ({
    title: d.title || '',
    url: d.url || '',
    description: d.description || '',
  }));

  const response: BraveSearchResponse = {
    query: raw.query?.original || query,
    webResults,
    locationResults,
    richHint,
    faq,
    discussions,
    moreResultsAvailable: raw.query?.more_results_available || false,
  };

  // Fetch rich data if available and enabled
  if (enableRichData && richHint?.callbackKey) {
    try {
      const richData = await fetchRichData(richHint.callbackKey);
      response.richData = richData;
    } catch (err) {
      log.warn('Failed to fetch rich data', { error: (err as Error).message });
    }
  }

  log.info('Brave search complete', {
    webResults: webResults.length,
    locationResults: locationResults.length,
    hasRichData: !!response.richData,
    hasFaq: !!faq?.length,
  });

  return response;
}

// ============================================================================
// RICH DATA (Weather, Stocks, Sports, Crypto)
// ============================================================================

interface BraveRichRaw {
  type?: string;
  subtype?: string;
  data?: Record<string, unknown>;
}

/**
 * Fetch rich data (weather, stocks, sports, crypto) using callback key
 */
async function fetchRichData(callbackKey: string): Promise<BraveRichData> {
  const raw = await braveApiRequest<BraveRichRaw>('/web/rich', {
    callback_key: callbackKey,
  });

  return {
    type: raw.type || 'rich',
    subtype: raw.subtype || 'unknown',
    data: raw.data || {},
  };
}

// ============================================================================
// LOCAL POI ENRICHMENT
// ============================================================================

interface BravePOIRaw {
  results?: Array<{
    id?: string;
    name?: string;
    address?: {
      streetAddress?: string;
      addressLocality?: string;
      addressRegion?: string;
      postalCode?: string;
    };
    phone?: string;
    website?: string;
    rating?: {
      ratingValue?: number;
      ratingCount?: number;
    };
    price_range?: string;
    opening_hours?: string[];
    images?: Array<{ url?: string }>;
  }>;
}

interface BravePOIDescRaw {
  results?: Array<{
    id?: string;
    description?: string;
  }>;
}

/**
 * Enrich location results with detailed POI information
 */
export async function enrichLocationResults(locationIds: string[]): Promise<BravePOIDetails[]> {
  if (!locationIds.length) return [];

  // Limit to 20 IDs per request
  const ids = locationIds.slice(0, 20);

  log.info('Enriching POI details', { count: ids.length });

  // Build the URL manually since API needs ids as repeated params
  const poiUrl = new URL(`${BRAVE_API_BASE}/local/pois`);
  ids.forEach((id) => poiUrl.searchParams.append('ids', id));

  const descUrl = new URL(`${BRAVE_API_BASE}/local/descriptions`);
  ids.forEach((id) => descUrl.searchParams.append('ids', id));

  const apiKey = getBraveApiKey();
  if (!apiKey) return [];

  const [poisResponse, descsResponse] = await Promise.all([
    fetch(poiUrl.toString(), {
      headers: {
        Accept: 'application/json',
        'X-Subscription-Token': apiKey,
      },
    }).then((r) => r.json() as Promise<BravePOIRaw>),
    fetch(descUrl.toString(), {
      headers: {
        Accept: 'application/json',
        'X-Subscription-Token': apiKey,
      },
    }).then((r) => r.json() as Promise<BravePOIDescRaw>),
  ]);

  // Create description map
  const descMap = new Map((descsResponse.results || []).map((d) => [d.id, d.description]));

  // Build enriched POI details
  const details: BravePOIDetails[] = (poisResponse.results || []).map((p) => ({
    id: p.id || '',
    name: p.name || '',
    address: [
      p.address?.streetAddress,
      p.address?.addressLocality,
      p.address?.addressRegion,
      p.address?.postalCode,
    ]
      .filter(Boolean)
      .join(', '),
    phone: p.phone,
    website: p.website,
    rating: p.rating?.ratingValue,
    reviewCount: p.rating?.ratingCount,
    priceRange: p.price_range,
    hours: p.opening_hours,
    images: p.images?.map((i) => i.url).filter((u): u is string => !!u),
    description: descMap.get(p.id || '') || undefined,
  }));

  log.info('POI enrichment complete', { count: details.length });

  return details;
}

// ============================================================================
// INTELLIGENT SEARCH (with query optimization and full enrichment)
// ============================================================================

export interface IntelligentSearchOptions extends BraveSearchOptions {
  /** Enrich location results with POI details */
  enrichLocations?: boolean;
  /** Include FAQ in response */
  includeFaq?: boolean;
  /** Include discussions in response */
  includeDiscussions?: boolean;
}

/**
 * Perform an intelligent search with automatic enrichment
 */
export async function intelligentSearch(
  options: IntelligentSearchOptions
): Promise<BraveSearchResponse> {
  const { enrichLocations = true, ...searchOptions } = options;

  // Perform the base search
  const response = await braveWebSearch(searchOptions);

  // Enrich location results if requested and available
  if (enrichLocations && response.locationResults.length > 0) {
    try {
      const locationIds = response.locationResults.map((l) => l.id).filter((id) => id);

      if (locationIds.length > 0) {
        const poiDetails = await enrichLocationResults(locationIds);
        response.poiDetails = poiDetails;
      }
    } catch (err) {
      log.warn('Failed to enrich locations', { error: (err as Error).message });
    }
  }

  return response;
}

// ============================================================================
// SPECIALIZED SEARCH FUNCTIONS
// ============================================================================

/**
 * Search for recent news on a topic
 */
export async function searchRecentNews(
  query: string,
  options: Partial<BraveSearchOptions> = {}
): Promise<BraveSearchResponse> {
  return braveWebSearch({
    ...options,
    query,
    freshness: options.freshness || 'pw', // Default to past week
    count: options.count || 10,
  });
}

/**
 * Search with real-time data intent (weather, stocks, sports)
 */
export async function searchWithRealTimeData(
  query: string,
  options: Partial<BraveSearchOptions> = {}
): Promise<BraveSearchResponse> {
  return braveWebSearch({
    ...options,
    query,
    enableRichData: true,
    extraSnippets: true,
    count: options.count || 5, // Fewer web results when rich data is primary
  });
}

/**
 * Search for local businesses/places
 */
export async function searchLocal(
  query: string,
  latitude: number,
  longitude: number,
  options: Partial<BraveSearchOptions> = {}
): Promise<BraveSearchResponse> {
  return intelligentSearch({
    ...options,
    query,
    latitude,
    longitude,
    enrichLocations: true,
    count: options.count || 10,
  });
}

// ============================================================================
// RESULT FORMATTING FOR AI SYNTHESIS
// ============================================================================

/**
 * Format search results for AI synthesis
 * Creates a structured context that Claude/xAI can use to generate an answer
 */
export function formatResultsForSynthesis(response: BraveSearchResponse): string {
  const parts: string[] = [];

  // Rich data (weather, stocks, sports, crypto) - highest priority
  if (response.richData) {
    parts.push(formatRichData(response.richData));
  }

  // Web results with extra snippets
  if (response.webResults.length > 0) {
    parts.push(formatWebResults(response.webResults));
  }

  // FAQ if available
  if (response.faq && response.faq.length > 0) {
    parts.push(formatFaq(response.faq));
  }

  // Location/POI results
  if (response.poiDetails && response.poiDetails.length > 0) {
    parts.push(formatPOIDetails(response.poiDetails));
  } else if (response.locationResults.length > 0) {
    parts.push(formatLocationResults(response.locationResults));
  }

  // Discussions
  if (response.discussions && response.discussions.length > 0) {
    parts.push(formatDiscussions(response.discussions));
  }

  return parts.join('\n\n---\n\n');
}

function formatRichData(richData: BraveRichData): string {
  const { subtype, data } = richData;

  switch (subtype) {
    case 'weather':
      return formatWeatherData(data);
    case 'stock':
      return formatStockData(data);
    case 'cryptocurrency':
      return formatCryptoData(data);
    case 'currency':
      return formatCurrencyData(data);
    default:
      return `**${subtype.toUpperCase()} DATA:**\n${JSON.stringify(data, null, 2)}`;
  }
}

function formatWeatherData(data: Record<string, unknown>): string {
  const location = (data.location as string) || 'Unknown';
  const current = (data.current as Record<string, unknown>) || {};
  const forecast = (data.forecast as Array<Record<string, unknown>>) || [];

  let result = `**WEATHER FOR ${location.toUpperCase()}:**\n\n`;
  result += `Current: ${current.temp || 'N/A'}°, ${current.condition || 'N/A'}\n`;
  result += `Feels like: ${current.feels_like || 'N/A'}°\n`;
  result += `Humidity: ${current.humidity || 'N/A'}%\n`;
  result += `Wind: ${current.wind_speed || 'N/A'} ${current.wind_dir || ''}\n`;

  if (forecast.length > 0) {
    result += '\nForecast:\n';
    forecast.slice(0, 5).forEach((day) => {
      result += `- ${day.date || 'N/A'}: ${day.high || 'N/A'}°/${day.low || 'N/A'}° - ${day.condition || 'N/A'}\n`;
    });
  }

  return result;
}

function formatStockData(data: Record<string, unknown>): string {
  const symbol = (data.symbol as string) || 'N/A';
  const name = (data.name as string) || '';
  const price = (data.price as number) || 0;
  const change = (data.change as number) || 0;
  const changePercent = (data.change_percent as number) || 0;

  return `**STOCK: ${symbol} (${name})**\n
Price: $${price.toFixed(2)}
Change: ${change >= 0 ? '+' : ''}${change.toFixed(2)} (${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%)
Volume: ${data.volume || 'N/A'}
Market Cap: ${data.market_cap || 'N/A'}`;
}

function formatCryptoData(data: Record<string, unknown>): string {
  const name = (data.name as string) || 'N/A';
  const symbol = (data.symbol as string) || '';
  const price = (data.price as number) || 0;
  const change24h = (data.change_24h as number) || 0;

  return `**CRYPTOCURRENCY: ${name} (${symbol})**\n
Price: $${typeof price === 'number' ? price.toLocaleString() : price}
24h Change: ${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}%
Market Cap: ${data.market_cap || 'N/A'}
Volume (24h): ${data.volume_24h || 'N/A'}`;
}

function formatCurrencyData(data: Record<string, unknown>): string {
  const from = (data.from as string) || '';
  const to = (data.to as string) || '';
  const rate = (data.rate as number) || 0;
  const amount = (data.amount as number) || 1;

  return `**CURRENCY CONVERSION:**\n
${amount} ${from} = ${(amount * rate).toFixed(2)} ${to}
Exchange Rate: 1 ${from} = ${rate.toFixed(4)} ${to}`;
}

function formatWebResults(results: BraveWebResult[]): string {
  let output = '**WEB SEARCH RESULTS:**\n\n';

  results.forEach((result, i) => {
    output += `[${i + 1}] **${result.title}**\n`;
    output += `URL: ${result.url}\n`;
    output += `${result.description}\n`;

    if (result.extraSnippets && result.extraSnippets.length > 0) {
      output += 'Additional context:\n';
      result.extraSnippets.forEach((snippet) => {
        output += `  - ${snippet}\n`;
      });
    }

    if (result.article) {
      if (result.article.author) output += `Author: ${result.article.author}\n`;
      if (result.article.date) output += `Date: ${result.article.date}\n`;
    }

    output += '\n';
  });

  return output;
}

function formatFaq(faq: Array<{ question: string; answer: string; url: string }>): string {
  let output = '**FREQUENTLY ASKED QUESTIONS:**\n\n';

  faq.forEach((item) => {
    output += `Q: ${item.question}\n`;
    output += `A: ${item.answer}\n`;
    output += `Source: ${item.url}\n\n`;
  });

  return output;
}

function formatLocationResults(locations: BraveLocationResult[]): string {
  let output = '**LOCAL RESULTS:**\n\n';

  locations.forEach((loc, i) => {
    output += `[${i + 1}] **${loc.title}**\n`;
    if (loc.address) output += `Address: ${loc.address}\n`;
    if (loc.phone) output += `Phone: ${loc.phone}\n`;
    if (loc.rating) output += `Rating: ${loc.rating}/5 (${loc.reviewCount || 0} reviews)\n`;
    if (loc.priceRange) output += `Price: ${loc.priceRange}\n`;
    if (loc.distance) output += `Distance: ${loc.distance}\n`;
    output += '\n';
  });

  return output;
}

function formatPOIDetails(pois: BravePOIDetails[]): string {
  let output = '**LOCAL BUSINESS DETAILS:**\n\n';

  pois.forEach((poi, i) => {
    output += `[${i + 1}] **${poi.name}**\n`;
    if (poi.address) output += `Address: ${poi.address}\n`;
    if (poi.phone) output += `Phone: ${poi.phone}\n`;
    if (poi.website) output += `Website: ${poi.website}\n`;
    if (poi.rating) output += `Rating: ${poi.rating}/5 (${poi.reviewCount || 0} reviews)\n`;
    if (poi.priceRange) output += `Price Range: ${poi.priceRange}\n`;
    if (poi.hours && poi.hours.length > 0) {
      output += `Hours: ${poi.hours.join(', ')}\n`;
    }
    if (poi.description) output += `Description: ${poi.description}\n`;
    output += '\n';
  });

  return output;
}

function formatDiscussions(
  discussions: Array<{ title: string; url: string; description: string }>
): string {
  let output = '**DISCUSSIONS & FORUMS:**\n\n';

  discussions.forEach((disc, i) => {
    output += `[${i + 1}] **${disc.title}**\n`;
    output += `URL: ${disc.url}\n`;
    output += `${disc.description}\n\n`;
  });

  return output;
}

// ============================================================================
// EXPORTS
// ============================================================================

const braveClient = {
  isBraveConfigured,
  braveWebSearch,
  intelligentSearch,
  searchRecentNews,
  searchWithRealTimeData,
  searchLocal,
  enrichLocationResults,
  formatResultsForSynthesis,
};

export default braveClient;
