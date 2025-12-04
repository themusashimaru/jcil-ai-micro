/**
 * Large Document Chunking & Context Management
 *
 * Implements:
 * - Document profiling with synopsis generation
 * - Section detection and chunking
 * - Relevance-based chunk selection within token budget
 * - Redis caching for document profiles
 */

import { createHash } from 'crypto';
import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

// Redis client (optional - graceful fallback if not configured)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let redis: any = null;

async function getRedis() {
  if (redis) return redis;

  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      const { Redis } = await import('@upstash/redis');
      redis = Redis.fromEnv();
      return redis;
    } catch {
      console.warn('[Chunking] Redis not available, using in-memory fallback');
    }
  }

  // In-memory fallback
  const memoryCache = new Map<string, { value: string; expiry: number }>();
  redis = {
    set: async (key: string, value: string, options?: { ex?: number }) => {
      const expiry = options?.ex ? Date.now() + options.ex * 1000 : Date.now() + 86400_000;
      memoryCache.set(key, { value, expiry });
      return 'OK';
    },
    get: async (key: string) => {
      const entry = memoryCache.get(key);
      if (!entry || entry.expiry < Date.now()) {
        memoryCache.delete(key);
        return null;
      }
      return entry.value;
    },
  };
  return redis;
}

function sha1(s: string): string {
  return createHash('sha1').update(s).digest('hex');
}

export interface DocSection {
  i: number;
  h: string;    // heading
  start: number;
  end: number;
}

export interface DocProfile {
  id: string;
  version: string;      // sha1 of raw text
  synopsis: string;     // ~300-500 tokens summary
  sections: DocSection[];
  totalLines: number;
  totalChars: number;
}

/**
 * Create a document profile with synopsis and section map
 */
export async function makeDocProfile(id: string, rawText: string): Promise<DocProfile> {
  const version = sha1(rawText);
  const cacheKey = `docp:${id}:${version}`;

  // Check cache
  try {
    const r = await getRedis();
    if (r) {
      const hit = await r.get(cacheKey);
      if (hit) {
        console.log('[Chunking] Cache hit for doc profile:', id);
        return typeof hit === 'string' ? JSON.parse(hit) : hit;
      }
    }
  } catch (error) {
    console.error('[Chunking] Cache read error:', error);
  }

  // Parse sections by heading detection
  const lines = rawText.split(/\r?\n/);
  const sections: DocSection[] = [];
  let idx = 0;
  let start = 0;
  let header = 'Introduction';

  for (let i = 0; i < lines.length; i++) {
    // Detect markdown headings or large gaps (120+ lines)
    const isHeading = /^\s*#{1,6}\s+/.test(lines[i]);
    const isLargeGap = /^\s*$/.test(lines[i]) && i - start > 120;

    if (isHeading || isLargeGap) {
      if (i > start) {
        sections.push({ i: idx++, h: header, start, end: i });
      }
      start = i + (isHeading ? 1 : 0);
      header = isHeading
        ? lines[i].replace(/^\s*#+\s*/, '').slice(0, 80) || `Section ${idx + 1}`
        : `Section ${idx + 1}`;
    }
  }

  // Add final section
  if (start < lines.length) {
    sections.push({ i: idx, h: header, start, end: lines.length });
  }

  // Generate synopsis using mini model (cost-efficient)
  const snippet = lines.slice(0, 300).join('\n');
  let synopsis = 'Synopsis unavailable.';

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      const openai = createOpenAI({ apiKey });
      const result = await generateText({
        model: openai('gpt-5-mini'),
        prompt: `Summarize the following document for retrieval.
Return ~350 tokens, include key entities, sections and terms:

${snippet}

If needed, add "...(more sections not shown)".`,
        maxOutputTokens: 600,
        temperature: 0.2,
      });
      synopsis = result.text || 'Synopsis unavailable.';
    }
  } catch (error) {
    console.error('[Chunking] Synopsis generation error:', error);
  }

  const profile: DocProfile = {
    id,
    version,
    synopsis,
    sections,
    totalLines: lines.length,
    totalChars: rawText.length,
  };

  // Cache profile (24 hours)
  try {
    const r = await getRedis();
    if (r) {
      await r.set(cacheKey, JSON.stringify(profile), { ex: 60 * 60 * 24 });
    }
  } catch (error) {
    console.error('[Chunking] Cache write error:', error);
  }

  console.log('[Chunking] Created profile for doc:', id, 'sections:', sections.length);
  return profile;
}

/**
 * Simple keyword matching score
 */
function simpleScore(query: string, text: string): number {
  const queryWords = query.toLowerCase().split(/\W+/).filter(Boolean);
  const t = text.toLowerCase();
  return queryWords.reduce((score, word) => score + (t.includes(word) ? 1 : 0), 0);
}

/**
 * Estimate token count (rough: 4 chars per token)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export interface ChunkResult {
  synopsis: string;
  chunks: string[];
  totalTokensUsed: number;
  chunksSelected: number;
  chunksTotal: number;
}

/**
 * Get the most relevant chunks within a token budget
 *
 * @param rawText - Full document text
 * @param profile - Document profile with sections
 * @param query - User's query for relevance scoring
 * @param chunkSizeLines - Lines per chunk (default 120)
 * @param hardTokenBudget - Max tokens for chunks (default 800)
 */
export function getRelevantChunks(
  rawText: string,
  profile: DocProfile,
  query: string,
  chunkSizeLines = 120,
  hardTokenBudget = 800
): ChunkResult {
  const lines = rawText.split(/\r?\n/);
  const chunks: { score: number; text: string }[] = [];

  // Split sections into chunks
  for (const sec of profile.sections) {
    let s = sec.start;
    while (s < sec.end) {
      const e = Math.min(s + chunkSizeLines, sec.end);
      const text = lines.slice(s, e).join('\n');
      // Score based on query keyword matches (header gets 2x weight)
      const score = simpleScore(query, text) + simpleScore(query, sec.h) * 2;
      chunks.push({ score, text: `### ${sec.h}\n${text}` });
      s = e;
    }
  }

  // Sort by relevance (highest first)
  chunks.sort((a, b) => b.score - a.score);

  // Select chunks within token budget
  const selected: string[] = [];
  let tokensUsed = 0;

  for (const c of chunks) {
    const chunkTokens = estimateTokens(c.text);
    if (tokensUsed + chunkTokens > hardTokenBudget) break;
    selected.push(c.text);
    tokensUsed += chunkTokens;
  }

  return {
    synopsis: profile.synopsis,
    chunks: selected,
    totalTokensUsed: tokensUsed,
    chunksSelected: selected.length,
    chunksTotal: chunks.length,
  };
}

/**
 * Check if document is "large" and needs chunking
 */
export function needsChunking(text: string, maxDirectTokens = 2000): boolean {
  return estimateTokens(text) > maxDirectTokens;
}

/**
 * Process a document for inclusion in chat context
 * Returns either the full text (if small) or synopsis + relevant chunks (if large)
 */
export async function processDocumentForContext(
  docId: string,
  rawText: string,
  query: string,
  maxTokens = 800
): Promise<{ content: string; wasChunked: boolean; stats?: ChunkResult }> {
  if (!needsChunking(rawText, maxTokens * 2)) {
    // Small document - include directly
    return { content: rawText, wasChunked: false };
  }

  // Large document - chunk it
  const profile = await makeDocProfile(docId, rawText);
  const result = getRelevantChunks(rawText, profile, query, 120, maxTokens);

  const content = `**Document Synopsis:**
${result.synopsis}

**Relevant Sections:**
${result.chunks.join('\n\n---\n\n')}

*(${result.chunksSelected} of ${result.chunksTotal} sections shown based on relevance)*`;

  return { content, wasChunked: true, stats: result };
}
