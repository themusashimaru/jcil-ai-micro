/**
 * OpenAI Client
 * Wrapper for OpenAI API using Vercel AI SDK
 *
 * Implements (GPT-5 Edition):
 * - gpt-5-nano: Basic chat, greetings, simple Q&A (cost-optimized)
 * - gpt-5-mini: Search, files, complex reasoning, code, AND fallback for nano
 * - DALL-E 3 for image GENERATION only
 * - Web search via OpenAI Responses API
 * - Streaming support
 * - Retry logic with exponential backoff
 * - Auto-escalation: nano errors → retry with mini
 * - Timeouts (30s request, 5s connect)
 * - Structured logging with telemetry
 * - Web search caching (30 min TTL)
 * - Prompt caching optimization (50% cost savings on cached prefixes)
 * - Dual-pool round-robin API key system (same as Anthropic/Perplexity)
 * - Dynamic key detection (OPENAI_API_KEY_1, _2, _3, ... unlimited)
 * - Fallback pool (OPENAI_API_KEY_FALLBACK_1, _2, ... unlimited)
 * - Rate limit handling with automatic key rotation
 */

import { createOpenAI } from '@ai-sdk/openai';
import { streamText, generateText } from 'ai';
import {
  getModelForTool,
  getRecommendedTemperature,
  getMaxTokens,
  shouldEscalateToMini,
  supportsTemperature,
} from './models';
import { getSystemPromptForTool } from './tools';
import type { ToolType, OpenAIModel } from './types';
import { httpWithTimeout } from '../http';
import { logEvent, logImageGeneration } from '../log';
import { cachedWebSearch } from '../cache';
import { logCacheMetrics, willBenefitFromCaching } from './promptCache';
import { trackTokenUsage, saveAssistantMessage } from './usage';
import { completePendingRequest } from '../pending-requests';

// Retry configuration
const RETRY_DELAYS = [250, 1000, 3000]; // Exponential backoff
const RETRYABLE_STATUS_CODES = [429, 500, 502, 503, 504];

// Timeout configuration (per directive §0)
const REQUEST_TIMEOUT_MS = 45_000; // 45 seconds (increased for Pro plan's 120s limit)
const CONNECT_TIMEOUT_MS = 5_000;  // 5 seconds

// Tools that should always use web search
const WEB_SEARCH_TOOLS: ToolType[] = ['research', 'shopper', 'data'];

// Patterns that indicate need for real-time web information
const WEB_SEARCH_PATTERNS = [
  // Weather - simple location patterns
  /\b(weather|forecast)\s+(in|for|at)\s+\w+/i,
  /\bweather\s+\w+/i,  // "weather LA", "weather london"
  /\b(what'?s|what is|how'?s|how is)\s+(the\s+)?(weather|temp)/i,
  /\b(weather|forecast|temperature|rain|snow|humid|sunny|cloudy)\b.*(today|tomorrow|this week|now|current)/i,

  // News and current events
  /\b(latest|recent|current|today'?s|breaking|new)\s+(news|headlines|updates|events|stories)/i,
  /\b(latest|breaking)\b.*\b(news|headlines|updates)\b/i,  // "latest breaking news" with words between
  /\b(news|headlines)\s+(in|from|about|out\s+of|for)\s+/i,  // "news in LA", "news out of Los Angeles"
  /\b(what'?s|what is)\s+(happening|going on|new)\s+(in|with|at|today)/i,
  /\b(did|has|have)\s+.{0,30}\s+(happen|announce|release|launch)/i,

  // Prices and stocks
  /\b(stock|share|ticker)\s+(price|value)/i,
  /\b(price|cost|how much)\s+(of|is|does|for)\b/i,
  /\b(bitcoin|btc|ethereum|eth|crypto)\s+(price|value)/i,
  /\$[A-Z]{1,5}\b/,  // Stock tickers like $AAPL

  // Sports scores and results
  /\b(score|result|won|lost|win|lose)\s+.{0,20}\s+(game|match|today|yesterday|last night)/i,
  /\b(who won|who'?s winning|final score)/i,

  // Time-sensitive lookups
  /\b(hours|open|closed|schedule|when does|what time)\b.*(today|now|currently)/i,
  /\b(is|are)\s+(?!you\b|i\b|we\b|they\s+going).{0,20}\s+(open|closed|available)\s*(today|now|right now)?/i,

  // Search intent patterns
  /\b(search|look up|find|google)\s+(for|about)?\s+/i,
  /\b(what'?s|what is|who is|where is)\s+the\s+(latest|newest|current|recent)/i,

  // Real-time data
  /\b(live|real.?time|up.?to.?date|current)\s+(data|info|information|status)/i,
  /\b(exchange rate|currency|convert)\b/i,
  /\b(traffic|delays|road conditions)\b/i,

  // Explicit research requests
  /\b(research|investigate|find out|look into)\b/i,

  // LOCAL BUSINESS & PLACES SEARCHES
  // Business types - these words alone trigger search (don't require "in/near")
  /\b(barbershop|barber\s*shop|hair\s*salon|nail\s*salon|spa|laundromat|dry\s*cleaner)\b/i,
  /\b(movie\s*theater|movie\s*theatre|cinema|multiplex)\b/i,

  // "X in [location]" patterns - theaters, restaurants, stores, etc.
  /\b(theater|theatre|restaurant|cafe|coffee\s*shop|bar|pub|hotel|motel|store|shop|gym|hospital|pharmacy|bank|atm|gas\s*station|grocery|supermarket|mall|salon|barber|dentist|doctor|clinic|school|library|park|museum|church)\s+(in|near|around|at)\s+\w+/i,

  // Location patterns - "in [City]" or "near [City]"
  /\b(in|near|around)\s+[A-Z][a-z]+(\s+[A-Z][a-z]+)?\s*(,\s*[A-Z]{2})?\b/i, // "in Chelsea", "near Boston, MA"

  // "near me", "nearby", "closest to me" patterns
  /\b(near\s*me|nearby|close\s*by|around\s*here|in\s*my\s*area|closest\s+to\s+me|nearest\s+to\s+me)\b/i,

  // "where is/are" patterns for places
  /\b(where\s+(is|are|can\s+i\s+find))\s+(the|a|an)?\s*\w+/i,

  // Location + business type patterns
  /\b\w+\s+(theater|theatre|cinema|restaurant|cafe|store|shop|mall)\b/i,

  // Showtimes and movie-specific patterns
  /\b(showtime|show\s*time|movie\s*time|playing|screening)\b/i,
  /\b(what'?s|what\s+is)\s+playing\b/i,

  // Address and contact lookups
  /\b(address|phone\s*number|contact|location|directions)\s+(for|of|to)\b/i,

  // "Give me info" patterns
  /\b(give\s+me|get\s+me|show\s+me|tell\s+me)\s+(info|information|details|the)\s+(on|about|for)\b/i,

  // Regal, AMC, and other theater chains
  /\b(regal|amc|cinemark|imax|alamo\s*drafthouse)\b/i,

  // PEOPLE & ORGANIZATIONS
  // Celebrity, politician, public figure lookups
  /\b(who\s+is|who'?s|tell\s+me\s+about)\s+[A-Z][a-z]+\s+[A-Z][a-z]+/i,
  /\b(ceo|founder|owner|president|cfo|cto)\s+(of|at)\b/i,

  // Celebrity news and gossip - "what's going on with [person]", "[person] news"
  /\b(what'?s|what\s+is)\s+(going\s+on|happening|up)\s+(with|to)\s+/i,
  /\b(check|checking)\s+(on|up\s+on|into)\s+/i,  // "check on this", "checking up on"
  /\b(latest|recent|new|current)\s+(on|about|with|news\s+on)\s+/i, // "latest on Elon Musk"
  /\b[A-Z][a-z]+\s+[A-Z][a-z]+\s+(news|update|latest|scandal|drama|controversy)/i, // "Trump news", "Kanye update"

  // FACT CHECKING & VERIFICATION
  // Explicit fact-check requests
  /\b(fact[\s-]?check|fact[\s-]?checking|factcheck)\b/i,
  /\b(is\s+(it|that|this)\s+true\s+that|is\s+it\s+true)\b/i,
  /\b(verify|verification|debunk|confirm)\s+(this|that|if|whether)?\b/i,
  /\b(true\s+or\s+false|real\s+or\s+fake|legit\s+or\s+not)\b/i,
  /\b(is\s+.{1,40}\s+(true|real|accurate|legit|fake|false|misinformation|a\s+hoax))\b/i,
  /\b(did\s+.{1,40}\s+really|really\s+happen|actually\s+happen)\b/i,
  /\b(rumor|hoax|myth|conspiracy)\s+(about|that|is)\b/i,
  /\b(can\s+you\s+)?(check|verify|confirm|look\s+up)\s+(if|whether|that|this)\b/i,

  // Company and organization info
  /\b(company|corporation|organization|startup|business)\s+(info|information|details|about)\b/i,
  /\b(what\s+is|what'?s)\s+[A-Z][a-z]+\s*(inc|corp|llc|ltd|co)?\b/i,

  // EVENTS & ENTERTAINMENT
  // Concerts, shows, sports events
  /\b(concert|show|event|game|match|festival|tour)\s+(in|at|near|tickets)\b/i,
  /\b(tickets|seats)\s+(for|to)\b/i,
  /\b(when\s+is|when'?s)\s+(the|next)\b/i,

  // TV shows and streaming
  /\b(watch|stream|streaming|netflix|hulu|disney\+?|hbo|prime\s*video|youtube)\b/i,
  /\b(new\s+episode|season\s+\d|release\s+date)\b/i,

  // PRODUCTS & SHOPPING
  // Product lookups and reviews
  /\b(review|reviews|rating|ratings)\s+(for|of|on)\b/i,
  /\b(is\s+.{1,30}\s+worth|should\s+i\s+buy|best\s+.{1,20}\s+(for|under|to))\b/i,
  /\b(compare|comparison|vs\.?|versus)\b/i,
  /\b(buy|purchase|order|get)\s+.{1,30}\s+(online|from|at)\b/i,

  // Specific product categories
  /\b(iphone|android|samsung|pixel|macbook|laptop|tablet|headphones|airpods|tv|camera)\b/i,

  // TRAVEL & TRANSPORTATION
  /\b(flight|flights|airline|airport|train|bus|uber|lyft)\s+(to|from|at|in)\b/i,
  /\b(book|booking|reservation|reserve)\s+(a|hotel|flight|table|ticket)\b/i,
  /\b(travel\s+to|visiting|trip\s+to|vacation\s+in)\b/i,

  // LOCAL SERVICES
  /\b(plumber|electrician|mechanic|contractor|locksmith|tow\s*truck|delivery|repair)\s+(in|near|around)\b/i,
  /\b(best|top|recommended)\s+.{1,30}\s+(in|near|around)\b/i,

  // FOOD & DINING
  /\b(menu|reservation|order\s+food|delivery|takeout|uber\s*eats|doordash|grubhub)\b/i,
  /\b(best\s+(food|restaurant|pizza|sushi|chinese|mexican|italian))\b/i,

  // HEALTH (general, non-medical advice)
  /\b(pharmacy|urgent\s*care|emergency\s*room|er)\s+(near|in|open)\b/i,
  /\b(doctor|dentist|optometrist|therapist)\s+(near|in|accepting)\b/i,

  // FACTS & STATISTICS (things that change)
  /\b(population|gdp|unemployment|inflation|rate)\s+(of|in)\b/i,
  /\b(record|world\s*record|longest|tallest|fastest|biggest|richest)\b/i,
  /\b(how\s+many|how\s+much)\s+.{1,30}\s+(in|are\s+there|does)\b/i,

  // TECHNOLOGY & SOFTWARE
  /\b(latest\s+version|update|download|install)\b/i,
  /\b(ios|android|windows|macos|linux)\s+(version|\d+)\b/i,
  /\b(app|application|software|program)\s+(for|to|that)\b/i,

  // GENERAL LOOKUP INTENT
  // "What happened" patterns
  /\b(what\s+happened|what'?s\s+going\s+on|what'?s\s+new)\s+(with|to|at)\b/i,

  // Explicit info requests
  /\b(info|information|details|facts)\s+(about|on|for)\b/i,
  /\b(can\s+you|could\s+you)\s+(find|look\s+up|search|check)\b/i,

  // Question words with specific entities
  /\b(when|where|how)\s+(does|do|is|are|can|will)\s+.{3,}/i,

  // ============================================
  // EXPANDED PATTERNS FOR BETTER DETECTION
  // ============================================

  // CASUAL/SLANG PHRASING
  /\b(what'?s\s+poppin|what'?s\s+good|what'?s\s+up)\s+(in|with|at)\b/i,
  /\b(gimme|give\s+me)\s+(the\s+)?(scoop|lowdown|tea|deets|info)\s+(on|about)\b/i,
  /\b(what'?s\s+the\s+(deal|story|situation|status))\s+(with|on|about)\b/i,
  /\b(any\s+(news|updates|info|word))\s+(on|about|from)\b/i,
  /\b(fill\s+me\s+in|catch\s+me\s+up|bring\s+me\s+up\s+to\s+speed)\b/i,

  // SIMPLE TIME-SENSITIVE QUESTIONS
  /\b(did|does|do|has|have|will|is|are)\s+(the\s+)?(lakers|celtics|warriors|yankees|dodgers|patriots|chiefs|cowboys|eagles|49ers|giants|knicks|nets|heat|bulls|mets|red\s*sox|cubs|braves)\s+(win|lose|play|beat)/i,
  /\b(did|has)\s+[A-Z][a-z]+\s+(win|lose|beat|score|play)/i,  // "Did Boston win"
  /\b(is\s+it\s+(gonna|going\s+to)|will\s+it)\s+(rain|snow|storm|be\s+hot|be\s+cold)/i,
  /\b(what\s+time)\s+(does|do|is|will)\s+/i,  // "what time does Target close"
  /\b(is|are)\s+.{1,30}\s+(open|closed)\s*(right\s+now|today|tonight|now)?\s*\??$/i,

  // RECENT EVENTS WITHOUT "NEWS" KEYWORD
  /\b(what\s+happened|what'?s\s+happened)\s*(today|yesterday|this\s+week|last\s+night|recently)?\s*\??$/i,
  /\b(did\s+they|have\s+they|has\s+.{1,20})\s+(announce|release|launch|drop|reveal|confirm)/i,
  /\b(is\s+the\s+new|when\s+(does|is|will)\s+the\s+new)\s+/i,  // "is the new iPhone out"
  /\b(when\s+(does|is|will))\s+.{1,30}\s+(come\s+out|release|premiere|drop|launch|start|return|come\s+back)/i,
  /\b(any\s+updates?\s+on|status\s+of|update\s+on)\b/i,

  // PEOPLE AGE/STATUS QUERIES
  /\b(is|are)\s+[A-Z][a-z]+(\s+[A-Z][a-z]+)?\s+(still\s+alive|dead|alive|married|divorced|single|dating|pregnant)/i,
  /\b(how\s+old\s+is|what'?s?\s+.{1,20}\s+age|when\s+was\s+.{1,20}\s+born)\b/i,
  /\b(what\s+did|what\s+does|what\s+has)\s+[A-Z][a-z]+\s+/i,  // "what did Biden say"
  /\b(who\s+is\s+dating|who\s+is\s+married\s+to|who\s+is\s+.{1,20}\s+(husband|wife|girlfriend|boyfriend|partner))\b/i,
  /\b(net\s+worth|how\s+much\s+(is|does)\s+.{1,20}\s+(worth|make|earn))\b/i,

  // VERIFICATION/FACT-CHECK QUESTIONS
  /\b(is\s+it\s+true|is\s+that\s+true|is\s+this\s+true)\b/i,
  /\b(did\s+.{1,30}\s+really|is\s+it\s+real\s+that|is\s+.{1,30}\s+real)\b/i,
  /\b(fact\s+check|verify|confirm|true\s+or\s+false)\b/i,
  /\b(did\s+that\s+(happen|actually\s+happen)|was\s+that\s+real)\b/i,

  // VAGUE LOCATION/ACTIVITY QUERIES
  /\b(where\s+can\s+i|where\s+should\s+i|where\s+to)\s+(eat|go|find|get|buy|see)/i,
  /\b(what'?s\s+good\s+to\s+(do|eat|see|visit))\s+(in|around|near)\b/i,
  /\b(anything\s+(fun|good|interesting|cool))\s+(to\s+do|happening)\s*(in|around|near|tonight|today)?\b/i,
  /\b(things\s+to\s+do|what\s+to\s+do|stuff\s+to\s+do)\s+(in|around|near)\b/i,
  /\b(recommend|suggestion|recommendations|suggestions)\s+(for|in|around)\b/i,

  // SPORTS WITHOUT EXPLICIT SCORE KEYWORDS
  /\b(who'?s\s+playing|what\s+games?\s+(are|is))\s+(tonight|today|tomorrow|this\s+weekend)/i,
  /\b(did|does|do)\s+.{1,20}\s+(make|win|lose|get\s+into)\s+(the\s+)?(playoffs|finals|championship|tournament|series)/i,
  /\b(when'?s\s+the\s+next|next\s+.{1,20}\s+game|when\s+do\s+.{1,20}\s+play)\b/i,
  /\b(standings|rankings|playoff|draft|trade|free\s+agent|roster|lineup)\b/i,
  /\b(super\s*bowl|world\s*series|nba\s+finals|stanley\s+cup|world\s+cup|olympics|march\s+madness)\b/i,

  // GENERAL "DID" QUESTIONS (strong search signal)
  /\b(did\s+.{1,30}\s+die|did\s+.{1,30}\s+get\s+(fired|arrested|married|divorced|elected|appointed))\b/i,
  /\b(did\s+.{1,30}\s+(pass|fail|win|lose|happen|change|update|release|announce))\b/i,

  // PRODUCT/TECH RELEASES
  /\b(is\s+.{1,20}\s+(out\s+yet|available\s+yet|released\s+yet|coming\s+out))\b/i,
  /\b(when\s+(is|does|will)\s+.{1,20}\s+(come\s+out|release|drop|launch|available))\b/i,
  /\b(new\s+(iphone|ipad|macbook|samsung|pixel|playstation|xbox|switch|model|version))\b/i,

  // CURRENT STATUS/AVAILABILITY
  /\b(is\s+.{1,20}\s+(available|in\s+stock|sold\s+out|back\s+in\s+stock|on\s+sale|discontinued))\b/i,
  /\b(can\s+i\s+(still|currently)|do\s+they\s+still)\s+(buy|get|order|find)\b/i,

  // TRENDING/VIRAL CONTENT
  /\b(trending|viral|popular|famous)\s+(right\s+now|today|this\s+week)?\b/i,
  /\b(what'?s\s+trending|what'?s\s+viral|what'?s\s+popular)\b/i,
  /\b(why\s+is\s+.{1,30}\s+trending|why\s+is\s+everyone\s+talking\s+about)\b/i,

  // PRICE/COST CASUAL PATTERNS
  /\b(how\s+much\s+(is|does|are|do))\s+/i,  // "how much is gas"
  /\b(what'?s\s+.{1,20}\s+(cost|price|worth|going\s+for))\b/i,
  /\b(current\s+price|price\s+of|cost\s+of)\b/i,

  // WEATHER CASUAL
  /\b(is\s+it\s+(hot|cold|raining|snowing|nice|warm|cool))\s+(outside|today|right\s+now|in)?\b/i,
  /\b(do\s+i\s+need\s+(an?\s+)?(umbrella|jacket|coat|sunscreen))\b/i,

  // GENERIC LOOKUP BOOSTERS (short queries that likely need search)
  /\b(hours|address|phone|menu|price|cost|location)\s+for\b/i,
  /\b(how\s+to\s+get\s+to|directions\s+to|distance\s+to)\b/i,

  // SEARCH CONTINUATION PATTERNS (responses to "which type do you want?" etc.)
  // These catch affirmative responses that should continue a search
  /^(all|all\s+of\s+(them|it|the\s+above)|everything|anything|whatever)\s*(please|thanks)?\.?$/i,
  /^(all\s+)?(events?|types?|options?|categories?|kinds?)\s*(please|thanks)?\.?$/i,
  /^(yes|yeah|yep|sure|ok|okay|yup|go\s+ahead|do\s+it)\s*(please|thanks)?[,.]?\s*(all|everything)?\.?$/i,
  /^(show\s+me|give\s+me|list|find)\s+(all|everything|them\s+all)\.?$/i,
  /^(just|please)?\s*(search|look|find|show)(\s+it)?(\s+up)?\.?$/i,
];

/**
 * Patterns that should NOT trigger web search (greetings, casual chat)
 */
const WEB_SEARCH_EXCLUSIONS = [
  // Greetings and casual conversation
  /^(hi|hello|hey|howdy|greetings|good\s+(morning|afternoon|evening|night))\b/i,
  /\b(how\s+are\s+you|how'?s\s+it\s+going|how\s+you\s+doing|what'?s\s+up)\b/i,
  /\b(are\s+you\s+(available|there|free|busy|ready|around))\b/i,
  /\b(nice\s+to\s+(meet|see|talk))\b/i,
  /\b(thank\s+you|thanks|appreciate)\b/i,
  /\b(good\s+to\s+(see|hear|talk|meet))\b/i,
  /\b(can\s+you\s+help\s+me)\b/i,
  /\b(i\s+need\s+(help|assistance|your\s+help))\b/i,
];

/**
 * Check if content requires web search based on patterns
 */
function contentNeedsWebSearch(content: string): boolean {
  if (!content || content.length < 5) return false;

  // First check exclusions - if it matches, don't trigger web search
  if (WEB_SEARCH_EXCLUSIONS.some(pattern => pattern.test(content))) {
    return false;
  }

  return WEB_SEARCH_PATTERNS.some(pattern => pattern.test(content));
}

/**
 * Check if tool type or content should use web search
 */
function shouldUseWebSearch(tool?: ToolType, messageContent?: string): boolean {
  // Tool-based check (explicit tool selection)
  if (tool && WEB_SEARCH_TOOLS.includes(tool)) {
    return true;
  }

  // Content-based check (auto-detection for general queries)
  if (messageContent && contentNeedsWebSearch(messageContent)) {
    console.log('[OpenAI] Web search triggered by content pattern');
    return true;
  }

  return false;
}

interface ChatOptions {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  messages: any[];
  tool?: ToolType;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  userId?: string; // For logging and usage tracking
  conversationId?: string; // For saving messages to DB on completion
  pendingRequestId?: string; // For background processing - delete on completion
  modelOverride?: string; // Override model from provider settings
  planKey?: string; // User's subscription tier for usage limits
}

// ========================================
// DUAL-POOL API KEY SYSTEM (DYNAMIC)
// ========================================
// Primary Pool: Round-robin load distribution (OPENAI_API_KEY_1, _2, _3, ... unlimited)
// Fallback Pool: Emergency reserve (OPENAI_API_KEY_FALLBACK_1, _2, _3, ... unlimited)
// Backward Compatible: Single OPENAI_API_KEY still works
// NO HARDCODED LIMITS - just add keys and they're automatically detected!

interface OpenAIKeyState {
  key: string;
  rateLimitedUntil: number; // Timestamp when rate limit expires (0 = not limited)
  pool: 'primary' | 'fallback';
  index: number; // Position within its pool
}

// Separate pools for better management
const openaiPrimaryPool: OpenAIKeyState[] = [];
const openaiFallbackPool: OpenAIKeyState[] = [];
let openaiPrimaryKeyIndex = 0; // Round-robin index for primary pool
let openaiFallbackKeyIndex = 0; // Round-robin index for fallback pool
let openaiInitialized = false;

/**
 * Initialize all available OpenAI API keys into their pools
 * FULLY DYNAMIC: Automatically detects ALL configured keys - no limits!
 */
function initializeOpenAIApiKeys(): void {
  if (openaiInitialized) return;
  openaiInitialized = true;

  // Dynamically detect ALL numbered primary keys (no limit!)
  let i = 1;
  while (true) {
    const key = process.env[`OPENAI_API_KEY_${i}`];
    if (!key) break; // Stop when we hit a gap

    openaiPrimaryPool.push({
      key,
      rateLimitedUntil: 0,
      pool: 'primary',
      index: i,
    });
    i++;
  }

  // If no numbered keys found, fall back to single OPENAI_API_KEY
  if (openaiPrimaryPool.length === 0) {
    const singleKey = process.env.OPENAI_API_KEY;
    if (singleKey) {
      openaiPrimaryPool.push({
        key: singleKey,
        rateLimitedUntil: 0,
        pool: 'primary',
        index: 0,
      });
    }
  }

  // Dynamically detect ALL fallback keys (no limit!)
  let j = 1;
  while (true) {
    const key = process.env[`OPENAI_API_KEY_FALLBACK_${j}`];
    if (!key) break; // Stop when we hit a gap

    openaiFallbackPool.push({
      key,
      rateLimitedUntil: 0,
      pool: 'fallback',
      index: j,
    });
    j++;
  }

  // Log the detected configuration
  const totalKeys = openaiPrimaryPool.length + openaiFallbackPool.length;
  if (totalKeys > 0) {
    console.log(`[OpenAI] Initialized dual-pool system (dynamic detection):`);
    console.log(`[OpenAI]   Primary pool: ${openaiPrimaryPool.length} key(s) (round-robin load distribution)`);
    console.log(`[OpenAI]   Fallback pool: ${openaiFallbackPool.length} key(s) (emergency reserve)`);
  }
}

/**
 * Get an available key state from the primary pool (round-robin)
 */
function getOpenAIPrimaryKeyState(): OpenAIKeyState | null {
  const now = Date.now();

  for (let i = 0; i < openaiPrimaryPool.length; i++) {
    const keyIndex = (openaiPrimaryKeyIndex + i) % openaiPrimaryPool.length;
    const keyState = openaiPrimaryPool[keyIndex];

    if (keyState.rateLimitedUntil <= now) {
      openaiPrimaryKeyIndex = (keyIndex + 1) % openaiPrimaryPool.length;
      return keyState;
    }
  }

  return null;
}

/**
 * Get an available key state from the fallback pool
 */
function getOpenAIFallbackKeyState(): OpenAIKeyState | null {
  if (openaiFallbackPool.length === 0) return null;

  const now = Date.now();

  for (let i = 0; i < openaiFallbackPool.length; i++) {
    const keyIndex = (openaiFallbackKeyIndex + i) % openaiFallbackPool.length;
    const keyState = openaiFallbackPool[keyIndex];

    if (keyState.rateLimitedUntil <= now) {
      openaiFallbackKeyIndex = (keyIndex + 1) % openaiFallbackPool.length;
      console.log(`[OpenAI] Using FALLBACK key ${keyState.index} (primary pool exhausted)`);
      return keyState;
    }
  }

  return null;
}

/**
 * Get the next available API key state
 */
function getOpenAIApiKeyState(): OpenAIKeyState | null {
  initializeOpenAIApiKeys();

  if (openaiPrimaryPool.length === 0 && openaiFallbackPool.length === 0) {
    return null;
  }

  const primaryKeyState = getOpenAIPrimaryKeyState();
  if (primaryKeyState) return primaryKeyState;

  const fallbackKeyState = getOpenAIFallbackKeyState();
  if (fallbackKeyState) return fallbackKeyState;

  // All keys rate limited - find soonest available
  const allKeys = [...openaiPrimaryPool, ...openaiFallbackPool];
  let soonestKey = allKeys[0];

  for (const key of allKeys) {
    if (key.rateLimitedUntil < soonestKey.rateLimitedUntil) {
      soonestKey = key;
    }
  }

  const waitTime = Math.ceil((soonestKey.rateLimitedUntil - Date.now()) / 1000);
  console.log(`[OpenAI] All ${allKeys.length} keys rate limited. Using ${soonestKey.pool} key ${soonestKey.index} (available in ${waitTime}s)`);

  return soonestKey;
}

/**
 * Mark a specific API key as rate limited
 */
function markOpenAIKeyRateLimited(apiKey: string, retryAfterSeconds: number = 60): void {
  const allKeys = [...openaiPrimaryPool, ...openaiFallbackPool];
  const keyState = allKeys.find(k => k.key === apiKey);

  if (keyState) {
    keyState.rateLimitedUntil = Date.now() + (retryAfterSeconds * 1000);
    console.log(`[OpenAI] ${keyState.pool.toUpperCase()} key ${keyState.index} rate limited for ${retryAfterSeconds}s`);

    const now = Date.now();
    const availablePrimary = openaiPrimaryPool.filter(k => k.rateLimitedUntil <= now).length;
    const availableFallback = openaiFallbackPool.filter(k => k.rateLimitedUntil <= now).length;
    console.log(`[OpenAI] Pool status: ${availablePrimary}/${openaiPrimaryPool.length} primary, ${availableFallback}/${openaiFallbackPool.length} fallback available`);
  }
}

/**
 * Get total number of API keys configured
 */
function getOpenAITotalKeyCount(): number {
  initializeOpenAIApiKeys();
  return openaiPrimaryPool.length + openaiFallbackPool.length;
}

/**
 * Check if OpenAI is configured
 */
export function isOpenAIConfigured(): boolean {
  initializeOpenAIApiKeys();
  return openaiPrimaryPool.length > 0 || openaiFallbackPool.length > 0;
}

/**
 * Get stats about API key usage
 */
export function getOpenAIKeyStats(): {
  primaryKeys: number;
  primaryAvailable: number;
  fallbackKeys: number;
  fallbackAvailable: number;
  totalKeys: number;
  totalAvailable: number;
} {
  initializeOpenAIApiKeys();
  const now = Date.now();

  const primaryAvailable = openaiPrimaryPool.filter(k => k.rateLimitedUntil <= now).length;
  const fallbackAvailable = openaiFallbackPool.filter(k => k.rateLimitedUntil <= now).length;

  return {
    primaryKeys: openaiPrimaryPool.length,
    primaryAvailable,
    fallbackKeys: openaiFallbackPool.length,
    fallbackAvailable,
    totalKeys: openaiPrimaryPool.length + openaiFallbackPool.length,
    totalAvailable: primaryAvailable + fallbackAvailable,
  };
}

/**
 * Get OpenAI API key (for current round-robin position)
 */
function getOpenAIApiKey(): string {
  const keyState = getOpenAIApiKeyState();

  if (!keyState) {
    throw new Error('OPENAI_API_KEY is not configured. Set OPENAI_API_KEY or OPENAI_API_KEY_1, _2, etc.');
  }

  return keyState.key;
}

/**
 * Get current API key (for rate limit tracking)
 */
function getCurrentOpenAIApiKey(): string | null {
  const keyState = getOpenAIApiKeyState();
  return keyState?.key || null;
}

/**
 * Get configured OpenAI provider
 */
function getOpenAIProvider() {
  const apiKey = getOpenAIApiKey();
  const baseURL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';

  return createOpenAI({
    apiKey,
    baseURL,
  });
}

/**
 * Sleep helper for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get current time context string to inject into system prompt
 */
function getCurrentTimeContext(): string {
  const now = new Date();

  const estTime = now.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short'
  });
  const cstTime = now.toLocaleString('en-US', {
    timeZone: 'America/Chicago',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short'
  });
  const pstTime = now.toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short'
  });
  const utcTime = now.toUTCString();

  return `CURRENT DATE AND TIME (ACCURATE - USE THIS):
Today is ${estTime}
Other US timezones: ${cstTime} | ${pstTime}
UTC: ${utcTime}

IMPORTANT: Use these times as your reference for any time-related questions.`;
}

/**
 * Normalize message format for OpenAI Responses API
 * Responses API expects:
 * - User/System messages: 'input_text', 'input_image'
 * - Assistant messages: 'output_text' (NOT input_text!)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeMessageForResponsesAPI(message: any): any {
  const role = message.role;

  // Handle missing or invalid role
  if (!role || !['user', 'assistant', 'system'].includes(role)) {
    return { role: 'user', content: '' };
  }

  // Determine the correct text type based on role
  // Assistant messages MUST use 'output_text', others use 'input_text'
  const textType = role === 'assistant' ? 'output_text' : 'input_text';

  // If content is a string, return with correct type based on role
  if (typeof message.content === 'string') {
    return {
      role,
      content: [{ type: textType, text: message.content }]
    };
  }

  // If content is null/undefined, return empty
  if (!message.content) {
    return { role, content: [{ type: textType, text: '' }] };
  }

  // If content is not an array, convert to string
  if (!Array.isArray(message.content)) {
    return {
      role,
      content: [{ type: textType, text: String(message.content) }]
    };
  }

  // Convert content parts to Responses API format
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const normalizedContent = message.content.map((part: any) => {
    // Text parts -> correct type based on role
    if (part.type === 'text') {
      return { type: textType, text: part.text || '' };
    }
    // AI SDK image format -> input_image (only for user messages)
    if (part.type === 'image' && part.image && role !== 'assistant') {
      return {
        type: 'input_image',
        image_url: typeof part.image === 'string' ? part.image : part.image.toString(),
      };
    }
    // OpenAI image_url format -> input_image (only for user messages)
    if (part.type === 'image_url' && part.image_url?.url && role !== 'assistant') {
      return {
        type: 'input_image',
        image_url: part.image_url.url,
      };
    }
    // input_text/output_text - convert to correct type for this role
    if (part.type === 'input_text' || part.type === 'output_text') {
      return { type: textType, text: part.text || '' };
    }
    // input_image already in correct format (only for user messages)
    if (part.type === 'input_image' && role !== 'assistant') {
      return part;
    }
    // Try to extract text from unknown parts
    if (part.text) {
      return { type: textType, text: part.text };
    }
    return null;
  }).filter(Boolean);

  if (normalizedContent.length === 0) {
    return { role, content: [{ type: textType, text: '' }] };
  }

  return { role, content: normalizedContent };
}

/**
 * Normalize message format for AI SDK
 * AI SDK expects { type: 'image', image: '...' } - it handles OpenAI conversion internally
 * IMPORTANT: AI SDK is strict - only include role and content, nothing else!
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeMessageForAISDK(message: any): any {
  const role = message.role;

  // Handle missing or invalid role
  if (!role || !['user', 'assistant', 'system'].includes(role)) {
    console.warn('[OpenAI] Invalid message role:', role);
    return { role: 'user', content: '' };
  }

  // If content is a string, return clean message with only role + content
  if (typeof message.content === 'string') {
    return { role, content: message.content };
  }

  // If content is null/undefined, return empty string content
  if (!message.content) {
    return { role, content: '' };
  }

  // If content is not an array, try to convert to string
  if (!Array.isArray(message.content)) {
    return { role, content: String(message.content) };
  }

  // Normalize content parts - ensure images are in AI SDK format
  // AI SDK expects: { type: "image", image: "data:..." or URL or base64 }
  // The SDK will convert to OpenAI format internally
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const normalizedContent = message.content.map((part: any) => {
    // Handle text parts - only include type and text
    if (part.type === 'text') {
      return { type: 'text', text: part.text || '' };
    }
    // AI SDK image format - pass through data URLs, URLs, or base64
    if (part.type === 'image' && part.image) {
      console.log('[OpenAI] Processing image for AI SDK:', {
        imageType: typeof part.image,
        isDataUrl: typeof part.image === 'string' && part.image.startsWith('data:'),
        isHttpUrl: typeof part.image === 'string' && part.image.startsWith('http'),
        imageLength: typeof part.image === 'string' ? part.image.length : 0,
      });
      // AI SDK handles data URLs, http URLs, and base64 strings
      return {
        type: 'image',
        image: part.image,
      };
    }
    // Convert OpenAI image_url format to AI SDK image format
    if (part.type === 'image_url' && part.image_url?.url) {
      console.log('[OpenAI] Converting image_url to AI SDK format:', {
        urlLength: part.image_url.url?.length || 0,
        isDataUrl: part.image_url.url?.startsWith('data:'),
      });
      return {
        type: 'image',
        image: part.image_url.url,
      };
    }
    // Unknown part type - try to extract text
    if (part.text) {
      return { type: 'text', text: part.text };
    }
    // Skip invalid parts
    return null;
  }).filter(Boolean); // Remove null entries

  // If no valid content parts, return empty string
  if (normalizedContent.length === 0) {
    return { role, content: '' };
  }

  // If only one text part, simplify to string content
  if (normalizedContent.length === 1 && normalizedContent[0].type === 'text') {
    return { role, content: normalizedContent[0].text };
  }

  // Return clean message with only role + content array
  return { role, content: normalizedContent };
}

/**
 * Check if messages contain images
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function hasImageContent(messages: any[]): boolean {
  const result = messages.some(msg => {
    if (!Array.isArray(msg.content)) return false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hasImage = msg.content.some((item: any) =>
      item.type === 'image_url' || item.type === 'image'
    );
    if (hasImage) {
      console.log('[OpenAI] Found image in message:', {
        role: msg.role,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        contentTypes: msg.content.map((c: any) => c.type),
      });
    }
    return hasImage;
  });
  return result;
}

/**
 * Extract text content from last user message
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getLastUserMessageText(messages: any[]): string {
  const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
  if (!lastUserMessage) return '';

  if (typeof lastUserMessage.content === 'string') {
    return lastUserMessage.content;
  }

  if (Array.isArray(lastUserMessage.content)) {
    return lastUserMessage.content
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((part: any) => part.type === 'text')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((part: any) => part.text || '')
      .join(' ');
  }

  return '';
}

/**
 * Determine the best model based on content and tool
 * GPT-5 Edition routing:
 * - gpt-5-nano: Basic chat, greetings, simple Q&A
 * - gpt-5-mini: Search, files, images, complex reasoning, code
 * - DALL-E 3: Image generation only
 *
 * Escalation triggers (nano → mini):
 * - Images or files present
 * - Search/lookup intent detected
 * - Complex reasoning required
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function determineModel(messages: any[], tool?: ToolType): OpenAIModel {
  const hasImages = hasImageContent(messages);
  const messageText = getLastUserMessageText(messages);

  // First check tool-based routing (includes message content analysis)
  const toolBasedModel = getModelForTool(tool, messageText);

  // If tool routes to DALL-E 3, use it for image generation
  if (toolBasedModel === 'dall-e-3') {
    return toolBasedModel;
  }

  // Check if we need to escalate to mini
  const needsMini = shouldEscalateToMini(hasImages, false, false, messageText);

  console.log('[OpenAI] determineModel:', {
    tool,
    toolBasedModel,
    hasImages,
    needsMini,
    messageTextLength: messageText.length,
  });

  // Images always need mini (vision capability)
  if (hasImages) {
    console.log('[OpenAI] Image content detected - using gpt-5-mini for vision analysis');
    return 'gpt-5-mini';
  }

  // Use content-aware routing result
  if (needsMini) {
    console.log('[OpenAI] Complex content detected - using gpt-5-mini');
    return 'gpt-5-mini';
  }

  // Return the tool-based model (nano for simple, mini for complex)
  return toolBasedModel;
}

/**
 * Create a chat completion with streaming support
 */
export async function createChatCompletion(options: ChatOptions) {
  const { messages, tool, temperature, maxTokens, stream = true, userId, conversationId, pendingRequestId, modelOverride, planKey } = options;

  // Get the last user message text for routing decisions
  const lastUserText = getLastUserMessageText(messages);

  // Determine the best model - use override if provided (from admin settings)
  const baseModelName = determineModel(messages, tool);
  const modelName = (modelOverride || baseModelName) as OpenAIModel;

  // Check if we should use web search (tool-based OR content-based)
  const useWebSearch = shouldUseWebSearch(tool, lastUserText);

  console.log('[OpenAI] Using model:', modelName, 'override:', !!modelOverride, 'stream:', stream, 'webSearch:', useWebSearch, 'query:', lastUserText?.slice(0, 50));

  // Use Responses API with web search (either tool-based or content-based trigger)
  if (useWebSearch) {
    const triggerReason = tool && WEB_SEARCH_TOOLS.includes(tool) ? `tool: ${tool}` : 'content pattern';
    console.log('[OpenAI] Using Responses API with web search, trigger:', triggerReason);
    return createWebSearchCompletion(options, modelName); // Use configured model for web search
  }

  // Use non-streaming for image analysis or when explicitly requested
  if (!stream || hasImageContent(messages)) {
    console.log('[OpenAI] Using non-streaming mode for images, model:', modelName);
    return createDirectOpenAICompletion(options, modelName);
  }

  // Streaming mode
  const openai = getOpenAIProvider();
  const model = openai(modelName);

  // Get system prompt and settings - CACHE OPTIMIZED ORDER:
  // Static content FIRST (cacheable prefix), dynamic content LAST
  const systemPrompt = getSystemPromptForTool(tool);
  const timeContext = getCurrentTimeContext();

  // Put static system prompt FIRST, time context LAST for optimal caching
  // OpenAI caches prompt prefixes > 1024 tokens, so static content should lead
  const fullSystemPrompt = `${systemPrompt}\n\n---\n\n${timeContext}`;

  const effectiveMaxTokens = maxTokens ?? getMaxTokens(modelName, tool);

  // Convert messages to OpenAI format (handles image URLs)
  const convertedMessages = messages.map(normalizeMessageForAISDK);

  // Log cache efficiency metrics
  if (willBenefitFromCaching([{ content: fullSystemPrompt }, ...convertedMessages])) {
    logCacheMetrics({
      staticPromptLength: systemPrompt.length,
      totalPromptLength: fullSystemPrompt.length + JSON.stringify(convertedMessages).length,
    });
  }

  // Build request config - exclude temperature for reasoning models
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const requestConfig: any = {
    model,
    messages: convertedMessages,
    system: fullSystemPrompt,
    maxTokens: effectiveMaxTokens,
  };

  // Only add temperature for non-reasoning models
  if (supportsTemperature(modelName)) {
    requestConfig.temperature = temperature ?? getRecommendedTemperature(modelName, tool);
  }

  // Add onFinish callback to track token usage and save message after stream completes
  // This fires even if the client disconnects, ensuring the message is saved
  if (userId) {
    requestConfig.onFinish = async ({ text, usage }: { text?: string; usage?: { promptTokens?: number; completionTokens?: number } }) => {
      // Track token usage (updates Redis counter for limits)
      if (usage) {
        trackTokenUsage({
          userId,
          model: modelName,
          route: 'chat',
          tool: 'streamText',
          inputTokens: usage.promptTokens || 0,
          outputTokens: usage.completionTokens || 0,
          planKey: planKey || 'free',
        });
      }

      // Save assistant message to database (backup in case client disconnects)
      if (conversationId && text) {
        saveAssistantMessage({
          conversationId,
          userId,
          content: text,
          model: modelName,
        });
      }

      // Mark the pending request as completed (removes it from background worker queue)
      if (pendingRequestId) {
        console.log('[OpenAI] Completing pending request:', pendingRequestId);
        completePendingRequest(pendingRequestId).catch(err => {
          console.error('[OpenAI] Failed to complete pending request:', err);
        });
      }
    };
  }

  console.log('[OpenAI Streaming] Starting with model:', modelName, 'supportsTemp:', supportsTemperature(modelName));

  return streamText(requestConfig);
}

// Note: Preferred domains for web search are defined in the system prompt
// (see src/lib/openai/tools.ts)
// OpenAI's web_search tool handles domain filtering through system prompts

/**
 * Create completion with web search using OpenAI Responses API
 * Uses gpt-5-mini with web_search tool enabled
 * Includes caching for repeated queries (30 min TTL)
 */
async function createWebSearchCompletion(
  options: ChatOptions,
  modelName: OpenAIModel
) {
  const { messages, tool, temperature, maxTokens, userId, conversationId, planKey } = options;
  const apiKey = getOpenAIApiKey();
  const baseURL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const startTime = Date.now();

  // Get configuration - CACHE OPTIMIZED ORDER:
  // Static content FIRST (cacheable prefix), dynamic content LAST
  const baseSystemPrompt = getSystemPromptForTool(tool);
  const timeContext = getCurrentTimeContext();

  // Put static system prompt FIRST, time context LAST for optimal caching
  const systemPrompt = `${baseSystemPrompt}\n\n---\n\n${timeContext}`;

  const effectiveMaxTokens = maxTokens ?? getMaxTokens(modelName, tool);

  // Convert messages to Responses API format (uses input_text, input_image)
  const convertedMessages = messages.map(normalizeMessageForResponsesAPI);

  // Add system message at the beginning (Responses API format)
  const messagesWithSystem = [
    { role: 'system', content: [{ type: 'input_text', text: systemPrompt }] },
    ...convertedMessages
  ];

  // Extract query for caching (last user message)
  const lastUserMessage = getLastUserMessageText(messages);

  // Build web search tool configuration with preferred domains
  const webSearchTool = {
    type: 'web_search_preview',
    // Note: OpenAI's web_search handles domain preferences through system prompts
    // The domains are included in the system prompt for guidance instead
    // If OpenAI adds domain filtering support, uncomment below:
    // domains: { include: PREFERRED_SEARCH_DOMAINS },
  };

  // Define the fetch function for caching
  const fetchWebSearch = async () => {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
      try {
        console.log('[OpenAI Web Search] Attempt', attempt + 1, 'with model:', modelName, 'supportsTemp:', supportsTemperature(modelName));

        // Build request body - exclude temperature for reasoning models
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const requestBody: any = {
          model: modelName,
          input: messagesWithSystem,
          tools: [webSearchTool],
          max_output_tokens: effectiveMaxTokens,
        };

        // Only add temperature for non-reasoning models
        if (supportsTemperature(modelName)) {
          requestBody.temperature = temperature ?? getRecommendedTemperature(modelName, tool);
        }

        // Use the Responses API with web_search tool (with timeouts)
        const response = await httpWithTimeout(`${baseURL}/responses`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify(requestBody),
          timeoutMs: REQUEST_TIMEOUT_MS,
          connectTimeoutMs: CONNECT_TIMEOUT_MS,
        });

        if (!response.ok) {
          const errorText = await response.text();
          const statusCode = response.status;

          console.error('[OpenAI Web Search] Error response:', statusCode, errorText);

          if (RETRYABLE_STATUS_CODES.includes(statusCode) && attempt < RETRY_DELAYS.length) {
            const delay = RETRY_DELAYS[attempt];
            console.log(`[OpenAI Web Search] Retrying in ${delay}ms...`);
            await sleep(delay);
            continue;
          }

          throw new Error(`OpenAI Responses API error (${statusCode}): ${errorText}`);
        }

        const data = await response.json();

        // Extract text and citations from response
        let responseText = '';
        const citations: Array<{ url: string; title: string }> = [];

        // Parse the response output
        if (data.output) {
          for (const item of data.output) {
            if (item.type === 'message' && item.content) {
              for (const content of item.content) {
                if (content.type === 'output_text') {
                  responseText += content.text;
                }
                // Extract annotations/citations
                if (content.annotations) {
                  for (const annotation of content.annotations) {
                    if (annotation.type === 'url_citation') {
                      citations.push({
                        url: annotation.url,
                        title: annotation.title || annotation.url,
                      });
                    }
                  }
                }
              }
            }
          }
        }

        // Check if we got empty content - if so, throw to trigger fallback
        if (!responseText || responseText.trim().length === 0) {
          console.log('[OpenAI Web Search] Empty response received, falling back to regular completion');
          throw new Error('EMPTY_RESPONSE: Web search returned no content');
        }

        console.log('[OpenAI Web Search] Success, citations found:', citations.length);

        return {
          text: responseText,
          finishReason: 'stop',
          usage: data.usage || {},
          citations: citations,
          numSourcesUsed: citations.length,
          model: modelName, // Track actual model used
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error('[OpenAI Web Search] Error:', lastError.message);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const statusCode = (error as any)?.status || (error as any)?.statusCode;

        if (statusCode && RETRYABLE_STATUS_CODES.includes(statusCode) && attempt < RETRY_DELAYS.length) {
          const delay = RETRY_DELAYS[attempt];
          console.log(`[OpenAI Web Search] Retrying in ${delay}ms...`);
          await sleep(delay);
          continue;
        }

        throw lastError;
      }
    }

    throw lastError || new Error('Max retries exceeded');
  };

  try {
    // Try to get cached result first (30 min TTL)
    const { data: result, cached } = await cachedWebSearch(lastUserMessage, fetchWebSearch, 1800);

    // Log the request
    logEvent({
      user_id: userId,
      model: modelName,
      tool_name: tool,
      tokens_in: result.usage?.prompt_tokens,
      tokens_out: result.usage?.completion_tokens,
      latency_ms: Date.now() - startTime,
      ok: true,
      web_search: true,
      cached,
    });

    // Track token usage to database (if userId provided and not cached)
    if (userId && !cached) {
      trackTokenUsage({
        userId,
        model: modelName,
        route: 'search',
        tool: 'responses',
        inputTokens: result.usage?.prompt_tokens || 0,
        outputTokens: result.usage?.completion_tokens || 0,
        planKey: planKey || 'free',
      });
    }

    // Save assistant message to database (backup in case client disconnects)
    // Only save if not cached (cached responses are already saved)
    if (conversationId && userId && result.text && !cached) {
      saveAssistantMessage({
        conversationId,
        userId,
        content: result.text,
        model: modelName,
      });
    }

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Log the error
    logEvent({
      user_id: userId,
      model: modelName,
      tool_name: tool,
      latency_ms: Date.now() - startTime,
      ok: false,
      err_code: 'WEB_SEARCH_FAILED',
      err_message: errorMessage,
      web_search: true,
    });

    // Check if this is a timeout error
    const isTimeout = errorMessage.includes('timeout') || errorMessage.includes('timed out');

    if (isTimeout) {
      // Don't fall back to regular completion for timeout errors
      // The user asked for search results, and a non-search response won't help
      // Also, falling back would likely hit Vercel's 60s timeout anyway
      console.log('[OpenAI Web Search] Timeout - returning error instead of fallback to avoid Vercel timeout');
      throw new Error('Search request timed out. Please try again.');
    }

    // Fall back to regular completion without web search for non-timeout errors
    console.log('[OpenAI Web Search] Falling back to regular completion');
    return createDirectOpenAICompletion(options, modelName);
  }
}

/**
 * Direct OpenAI API call for non-streaming requests
 * Includes retry logic with exponential backoff
 */
async function createDirectOpenAICompletion(
  options: ChatOptions,
  modelName: OpenAIModel
) {
  const { messages, tool, temperature, maxTokens, userId, conversationId, planKey } = options;

  // Log detailed info about the request for debugging
  const messagesSummary = messages.map((m, i) => ({
    index: i,
    role: m.role,
    hasArrayContent: Array.isArray(m.content),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    contentTypes: Array.isArray(m.content) ? m.content.map((c: any) => c.type) : ['string'],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    imageDataLength: Array.isArray(m.content) ? m.content.filter((c: any) => c.type === 'image').map((c: any) => c.image?.length || 0) : [],
  }));
  console.log('[OpenAI Direct] Creating completion:', {
    model: modelName,
    tool,
    messageCount: messages.length,
    messagesSummary,
  });

  const openai = getOpenAIProvider();
  const model = openai(modelName);

  // Get configuration - CACHE OPTIMIZED ORDER:
  // Static content FIRST (cacheable prefix), dynamic content LAST
  const baseSystemPrompt = getSystemPromptForTool(tool);
  const timeContext = getCurrentTimeContext();

  // Put static system prompt FIRST, time context LAST for optimal caching
  const systemPrompt = `${baseSystemPrompt}\n\n---\n\n${timeContext}`;

  const effectiveMaxTokens = maxTokens ?? getMaxTokens(modelName, tool);

  // Convert messages to OpenAI format (handles image URLs)
  const convertedMessages = messages.map(normalizeMessageForAISDK);

  // Log converted messages to verify images are preserved
  const convertedSummary = convertedMessages.map((m, i) => ({
    index: i,
    role: m.role,
    hasArrayContent: Array.isArray(m.content),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    contentTypes: Array.isArray(m.content) ? m.content.map((c: any) => c.type) : 'string',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    imageDataLength: Array.isArray(m.content) ? m.content.filter((c: any) => c.type === 'image').map((c: any) => c.image?.length || 0) : [],
  }));
  console.log('[OpenAI Direct] Converted messages:', convertedSummary);

  // Retry loop
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      console.log('[OpenAI API] Attempt', attempt + 1, 'with model:', modelName, 'supportsTemp:', supportsTemperature(modelName));

      // Build request config - exclude temperature for reasoning models
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const generateConfig: any = {
        model,
        messages: convertedMessages,
        system: systemPrompt,
        maxOutputTokens: effectiveMaxTokens,
      };

      // Only add temperature for non-reasoning models
      if (supportsTemperature(modelName)) {
        generateConfig.temperature = temperature ?? getRecommendedTemperature(modelName, tool);
      }

      const result = await generateText(generateConfig);

      // Track token usage to database (if userId provided)
      if (userId && result.usage) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const usage = result.usage as any;
        trackTokenUsage({
          userId,
          model: modelName,
          route: 'chat',
          tool: 'generateText',
          inputTokens: usage.promptTokens || usage.inputTokens || 0,
          outputTokens: usage.completionTokens || usage.outputTokens || 0,
          planKey: planKey || 'free',
        });
      }

      // Save assistant message to database (backup in case client disconnects)
      if (conversationId && userId && result.text) {
        saveAssistantMessage({
          conversationId,
          userId,
          content: result.text,
          model: modelName,
        });
      }

      return {
        text: result.text,
        finishReason: result.finishReason,
        usage: result.usage,
        citations: [], // OpenAI doesn't have built-in citations
        numSourcesUsed: 0,
        model: modelName, // Track actual model used
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error('[OpenAI API] Error:', lastError.message);

      // Check if we should retry
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const statusCode = (error as any)?.status || (error as any)?.statusCode;

      if (statusCode && RETRYABLE_STATUS_CODES.includes(statusCode) && attempt < RETRY_DELAYS.length) {
        const delay = RETRY_DELAYS[attempt];
        console.log(`[OpenAI API] Retrying in ${delay}ms...`);
        await sleep(delay);
        continue;
      }

      // If it's a gpt-5-nano error, escalate to gpt-5-mini (our fallback model)
      if (modelName === 'gpt-5-nano') {
        console.log('[OpenAI API] Nano failed - escalating to gpt-5-mini');
        return createDirectOpenAICompletion(
          options,
          'gpt-5-mini'
        );
      }

      throw lastError;
    }
  }

  throw lastError || new Error('Max retries exceeded');
}

/**
 * Generate an image using DALL-E 3
 * Logs image generation separately for billing
 */
export async function generateImage(
  prompt: string,
  size: '1024x1024' | '512x512' | '256x256' = '1024x1024',
  userId?: string
): Promise<string> {
  const apiKey = getOpenAIApiKey();
  const baseURL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const startTime = Date.now();

  // Image costs (approximate)
  const imageCosts: Record<string, number> = {
    '1024x1024': 0.04,
    '512x512': 0.018,
    '256x256': 0.016,
  };

  // Retry loop
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      const response = await httpWithTimeout(`${baseURL}/images/generations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'dall-e-3',
          prompt,
          n: 1,
          size,
        }),
        timeoutMs: 60_000, // 60s for image generation
        connectTimeoutMs: CONNECT_TIMEOUT_MS,
      });

      if (!response.ok) {
        const error = await response.text();
        const statusCode = response.status;

        if (RETRYABLE_STATUS_CODES.includes(statusCode) && attempt < RETRY_DELAYS.length) {
          const delay = RETRY_DELAYS[attempt];
          console.log(`[DALL-E 3] Retrying in ${delay}ms... (status: ${statusCode})`);
          await sleep(delay);
          continue;
        }

        throw new Error(`DALL-E 3 error (${statusCode}): ${error}`);
      }

      const data = await response.json();
      const imageUrl = data.data[0]?.url || null;

      // Log successful image generation
      logImageGeneration(
        userId || 'anonymous',
        'dall-e-3',
        size,
        imageCosts[size] || 0.04,
        true,
        Date.now() - startTime
      );

      return imageUrl;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error('[DALL-E 3] Error:', lastError.message);

      if (attempt < RETRY_DELAYS.length) {
        const delay = RETRY_DELAYS[attempt];
        await sleep(delay);
        continue;
      }
    }
  }

  // Log failed image generation
  logImageGeneration(
    userId || 'anonymous',
    'dall-e-3',
    size,
    0,
    false,
    Date.now() - startTime
  );

  throw lastError || new Error('Image generation failed after retries');
}

/**
 * Analyze an image using gpt-5-mini vision
 * Per directive: ALL chat tasks use gpt-5-mini, including image analysis
 */
export async function analyzeImage(imageUrl: string, question: string) {
  const openai = getOpenAIProvider();
  const model = openai('gpt-5-mini');

  const result = await generateText({
    model,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            image: imageUrl,
          },
          {
            type: 'text',
            text: question,
          },
        ],
      },
    ],
  });

  return result.text;
}

// Re-export helper functions
export { isImageGenerationRequest } from './models';

// Export routing helpers for accurate model tracking in API routes
export { shouldUseWebSearch, getLastUserMessageText };
