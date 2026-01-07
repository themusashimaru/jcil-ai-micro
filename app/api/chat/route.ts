/**
 * CHAT API ROUTE - Clean & Minimal
 *
 * PURPOSE:
 * - Handle chat messages with streaming responses
 * - Route research requests to Perplexity-powered Research Agent
 * - Use Claude Haiku 4.5 for simple queries, Sonnet 4.5 for complex
 *
 * ROUTING:
 * - Research requests → Research Agent (Perplexity searches)
 * - Simple queries → Claude Haiku 4.5 (fast, cost-optimized)
 * - Complex queries → Claude Sonnet 4.5 (deep reasoning)
 */

import { NextRequest } from 'next/server';
import { CoreMessage } from 'ai';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createClaudeStreamingChat, createClaudeChat } from '@/lib/anthropic/client';
import { shouldUseResearchAgent, executeResearchAgent, isResearchAgentEnabled } from '@/agents/research';
import { perplexitySearch, isPerplexityConfigured } from '@/lib/perplexity/client';
import { acquireSlot, releaseSlot, generateRequestId } from '@/lib/queue';

// Rate limits per hour
const RATE_LIMIT_AUTHENTICATED = parseInt(process.env.RATE_LIMIT_AUTH || '120', 10);
const RATE_LIMIT_ANONYMOUS = parseInt(process.env.RATE_LIMIT_ANON || '30', 10);

// Token limits
const MAX_RESPONSE_TOKENS = 4096;
const DEFAULT_RESPONSE_TOKENS = 2048;
const MAX_CONTEXT_MESSAGES = 40;

interface ChatRequestBody {
  messages: CoreMessage[];
  temperature?: number;
  max_tokens?: number;
  searchMode?: 'none' | 'search' | 'factcheck';
}

// ============================================================================
// RATE LIMITING
// ============================================================================

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) return null;
  return createClient(supabaseUrl, supabaseServiceKey);
}

// In-memory fallback rate limiter
const memoryRateLimits = new Map<string, { count: number; resetAt: number }>();
const MEMORY_RATE_LIMIT = 10;
const MEMORY_WINDOW_MS = 60 * 60 * 1000;

function checkMemoryRateLimit(identifier: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = memoryRateLimits.get(identifier);

  if (!entry || entry.resetAt < now) {
    memoryRateLimits.set(identifier, { count: 1, resetAt: now + MEMORY_WINDOW_MS });
    return { allowed: true, remaining: MEMORY_RATE_LIMIT - 1 };
  }

  if (entry.count >= MEMORY_RATE_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: MEMORY_RATE_LIMIT - entry.count };
}

async function checkChatRateLimit(
  identifier: string,
  isAuthenticated: boolean
): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return { allowed: true, remaining: -1, resetIn: 0 };

  const limit = isAuthenticated ? RATE_LIMIT_AUTHENTICATED : RATE_LIMIT_ANONYMOUS;
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  try {
    const { count, error } = await supabase
      .from('rate_limits')
      .select('*', { count: 'exact', head: true })
      .eq('identifier', identifier)
      .eq('action', 'chat_message')
      .gte('created_at', oneHourAgo);

    if (error) {
      const memoryCheck = checkMemoryRateLimit(identifier);
      return { allowed: memoryCheck.allowed, remaining: memoryCheck.remaining, resetIn: 3600 };
    }

    const currentCount = count || 0;
    const remaining = Math.max(0, limit - currentCount - 1);

    if (currentCount >= limit) {
      return { allowed: false, remaining: 0, resetIn: 3600 };
    }

    await supabase.from('rate_limits').insert({ identifier, action: 'chat_message' });
    return { allowed: true, remaining, resetIn: 0 };
  } catch {
    const memoryCheck = checkMemoryRateLimit(identifier);
    return { allowed: memoryCheck.allowed, remaining: memoryCheck.remaining, resetIn: 3600 };
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function truncateMessages(messages: CoreMessage[], maxMessages: number = MAX_CONTEXT_MESSAGES): CoreMessage[] {
  if (messages.length <= maxMessages) return messages;
  const keepFirst = messages[0];
  const keepLast = messages.slice(-(maxMessages - 1));
  return [keepFirst, ...keepLast];
}

function clampMaxTokens(requestedTokens?: number): number {
  if (!requestedTokens) return DEFAULT_RESPONSE_TOKENS;
  return Math.min(Math.max(requestedTokens, 256), MAX_RESPONSE_TOKENS);
}

function getLastUserContent(messages: CoreMessage[]): string {
  const lastUserMessage = messages[messages.length - 1];
  if (typeof lastUserMessage?.content === 'string') {
    return lastUserMessage.content;
  }
  if (Array.isArray(lastUserMessage?.content)) {
    return lastUserMessage.content
      .filter((part: { type: string }) => part.type === 'text')
      .map((part: { type: string; text?: string }) => part.text || '')
      .join(' ');
  }
  return '';
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
  const requestId = generateRequestId();
  let slotAcquired = false;
  let isStreamingResponse = false; // Track if we're returning a stream

  try {
    // Acquire queue slot
    slotAcquired = await acquireSlot(requestId);
    if (!slotAcquired) {
      return new Response(
        JSON.stringify({ error: 'Server busy', message: 'Please try again in a few seconds.', retryAfter: 5 }),
        { status: 503, headers: { 'Content-Type': 'application/json', 'Retry-After': '5' } }
      );
    }

    // Parse request
    const body: ChatRequestBody = await request.json();
    const { messages, temperature, max_tokens, searchMode } = body;

    if (!messages || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Messages are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get user auth
    let rateLimitIdentifier: string;
    let isAuthenticated = false;
    let isAdmin = false;

    try {
      const cookieStore = await cookies();
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() { return cookieStore.getAll(); },
            setAll(cookiesToSet) {
              try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
              catch { /* ignore */ }
            },
          },
        }
      );

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        rateLimitIdentifier = user.id;
        isAuthenticated = true;
        const { data: userData } = await supabase.from('users').select('is_admin').eq('id', user.id).single();
        isAdmin = userData?.is_admin === true;
      } else {
        rateLimitIdentifier = request.headers.get('x-forwarded-for')?.split(',')[0] ||
                              request.headers.get('x-real-ip') || 'anonymous';
      }
    } catch {
      rateLimitIdentifier = request.headers.get('x-forwarded-for')?.split(',')[0] ||
                            request.headers.get('x-real-ip') || 'anonymous';
    }

    // Check rate limit (skip for admins)
    if (!isAdmin) {
      const rateLimit = await checkChatRateLimit(rateLimitIdentifier, isAuthenticated);
      if (!rateLimit.allowed) {
        return new Response(
          JSON.stringify({
            error: 'Rate limit exceeded',
            message: `Please wait ${Math.ceil(rateLimit.resetIn / 60)} minutes before continuing.`,
            retryAfter: rateLimit.resetIn,
          }),
          { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': String(rateLimit.resetIn) } }
        );
      }
    }

    const lastUserContent = getLastUserContent(messages);
    console.log('[Chat] Processing:', lastUserContent.substring(0, 100));

    // ========================================
    // ROUTE 1: PERPLEXITY SEARCH (Search/Fact-check buttons)
    // ========================================
    if (searchMode && searchMode !== 'none' && isPerplexityConfigured()) {
      console.log(`[Chat] Search mode: ${searchMode}`);

      try {
        const systemPrompt = searchMode === 'factcheck'
          ? 'Verify the claim. Return TRUE, FALSE, PARTIALLY TRUE, or UNVERIFIABLE with evidence.'
          : 'Search the web and provide accurate, up-to-date information with sources.';

        const query = searchMode === 'factcheck'
          ? `Fact check: ${lastUserContent}`
          : lastUserContent;

        const result = await perplexitySearch({ query, systemPrompt });

        // Post-process through Claude for consistent voice
        const synthesis = await createClaudeChat({
          messages: [{ role: 'user', content: `Summarize: ${result.answer}` }],
          maxTokens: 2048,
          forceModel: 'sonnet',
        });

        return new Response(
          JSON.stringify({ type: 'text', content: synthesis.text, model: synthesis.model }),
          { status: 200, headers: { 'Content-Type': 'application/json', 'X-Search-Mode': searchMode } }
        );
      } catch (error) {
        console.error('[Chat] Search error:', error);
        // Fall through to regular chat
      }
    }

    // ========================================
    // ROUTE 2: RESEARCH AGENT (Deep research requests)
    // ========================================
    if (isResearchAgentEnabled() && shouldUseResearchAgent(lastUserContent)) {
      console.log('[Chat] Routing to Research Agent');

      const researchStream = await executeResearchAgent(lastUserContent, {
        userId: isAuthenticated ? rateLimitIdentifier : undefined,
        depth: 'standard',
        previousMessages: messages.slice(-5).map(m => ({
          role: String(m.role),
          content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
        })),
      });

      // Wrap stream to release slot when done
      const wrappedResearchStream = new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          controller.enqueue(chunk);
        },
        flush() {
          if (slotAcquired) {
            releaseSlot(requestId).catch(err => console.error('[Chat] Error releasing slot:', err));
            slotAcquired = false;
          }
        },
      });

      isStreamingResponse = true;

      return new Response(researchStream.pipeThrough(wrappedResearchStream), {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Transfer-Encoding': 'chunked',
          'X-Provider': 'anthropic',
          'X-Agent': 'research',
        },
      });
    }

    // ========================================
    // ROUTE 3: CLAUDE CHAT (Haiku/Sonnet auto-routing)
    // ========================================
    const truncatedMessages = truncateMessages(messages);
    const clampedMaxTokens = clampMaxTokens(max_tokens);

    const systemPrompt = 'You are a helpful AI assistant. Be concise, accurate, and helpful.';

    const streamResult = await createClaudeStreamingChat({
      messages: truncatedMessages,
      systemPrompt,
      maxTokens: clampedMaxTokens,
      temperature,
    });

    console.log(`[Chat] Using model: ${streamResult.model}`);

    // Wrap the stream to release the slot when streaming completes
    // This fixes the bug where slot was released immediately after Response creation
    const wrappedStream = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        controller.enqueue(chunk);
      },
      flush() {
        // Release slot when stream is fully consumed
        if (slotAcquired) {
          releaseSlot(requestId).catch(err => console.error('[Chat] Error releasing slot:', err));
          slotAcquired = false; // Mark as released
        }
      },
    });

    // Pipe through the wrapper - slot released when stream ends
    const finalStream = streamResult.stream.pipeThrough(wrappedStream);

    // Mark as streaming so finally block doesn't double-release
    isStreamingResponse = true;

    return new Response(finalStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'X-Model-Used': streamResult.model,
        'X-Provider': 'claude',
      },
    });

  } finally {
    // Only release here for non-streaming responses (search/error paths)
    // For streaming, the TransformStream.flush() handles release when stream ends
    if (slotAcquired && !isStreamingResponse) {
      releaseSlot(requestId).catch(err => console.error('[Chat] Error releasing slot:', err));
    }
  }
}

export const runtime = 'nodejs';
export const maxDuration = 300;
