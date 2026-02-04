/**
 * CODE LAB CHAT API
 *
 * The unified chat endpoint that handles:
 * - Regular chat with Claude Opus 4.5
 * - Code generation via Code Agent V2
 * - Web search via Perplexity
 *
 * Opus decides which tool to use based on the request.
 */

import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createServerSupabaseClient } from '@/lib/supabase/server-auth';
import {
  executeCodeAgent,
  shouldUseCodeAgent as checkCodeAgentIntent,
} from '@/agents/code/integration';
import { perplexitySearch, isPerplexityConfigured } from '@/lib/perplexity/client';
import { orchestrateStream, shouldUseMultiAgent, getSuggestedAgents } from '@/lib/multi-agent';
import { executeWorkspaceAgent } from '@/lib/workspace/chat-integration';
import {
  processSlashCommand,
  isSlashCommand,
  parseSlashCommand,
} from '@/lib/workspace/slash-commands';
import { detectCodeLabIntent } from '@/lib/workspace/intent-detector';
// CRITICAL-008 FIX: Use secure service role client instead of direct createClient
import {
  createSecureServiceClient,
  extractRequestContext,
} from '@/lib/supabase/secure-service-role';
import crypto from 'crypto';
import { logger } from '@/lib/logger';
import { validateCSRF } from '@/lib/security/csrf';
// SECURITY FIX: Use centralized crypto module which requires dedicated ENCRYPTION_KEY
// (no fallback to SERVICE_ROLE_KEY for separation of concerns)
import { safeDecrypt as decryptToken } from '@/lib/security/crypto';
// Multi-provider support: import registry and adapter factory
import { getProviderForModel, getProviderAndModel } from '@/lib/ai/providers/registry';
import { getAdapter } from '@/lib/ai/providers/adapters/factory';
import type { UnifiedMessage } from '@/lib/ai/providers/types';

const log = logger('CodeLabChat');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

// ========================================
// BYOK (Bring Your Own Key) SUPPORT
// ========================================

/**
 * Map provider IDs to the keys used in user_provider_preferences.provider_api_keys
 * Some providers have different naming in BYOK vs internal (e.g., 'google' vs 'gemini')
 */
const BYOK_PROVIDER_MAP: Record<string, string> = {
  openai: 'openai',
  xai: 'xai',
  deepseek: 'deepseek',
  google: 'gemini', // Users configure 'gemini' in settings, but provider is 'google'
};

/**
 * Get user's BYOK API key for a provider
 * Returns null if not configured or decryption fails
 */
async function getUserApiKey(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  providerId: string
): Promise<string | null> {
  // Map provider ID to BYOK key name
  const byokKey = BYOK_PROVIDER_MAP[providerId];
  if (!byokKey) {
    return null; // Provider doesn't support BYOK
  }

  try {
    // Get user's provider preferences
    const { data: prefs } = await supabase
      .from('user_provider_preferences')
      .select('provider_api_keys')
      .eq('user_id', userId)
      .single();

    if (!prefs?.provider_api_keys) {
      return null;
    }

    const encryptedKey = prefs.provider_api_keys[byokKey];
    if (!encryptedKey) {
      return null;
    }

    // Decrypt the key
    const decryptedKey = decryptToken(encryptedKey);
    if (!decryptedKey) {
      log.warn('Failed to decrypt BYOK key', { userId, provider: providerId });
      return null;
    }

    log.info('Using BYOK for provider', { userId, provider: providerId });
    return decryptedKey;
  } catch (error) {
    log.warn('Error fetching BYOK key', {
      userId,
      provider: providerId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

// SECURITY FIX: Use cryptographically secure UUID generation
// Math.random() is NOT secure and IDs could be predicted
function generateId(): string {
  return crypto.randomUUID();
}

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

// ========================================
// AUTO-SUMMARIZATION CONFIG
// ========================================
const SUMMARY_THRESHOLD = 15; // Summarize when message count exceeds this
const RECENT_MESSAGES_AFTER_SUMMARY = 5; // Keep this many recent messages after summary

/**
 * Generate a summary of conversation history
 * Called when message count exceeds threshold
 */
async function generateConversationSummary(
  messages: Array<{ role: string; content: string }>
): Promise<string> {
  const conversationText = messages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join('\n\n');

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514', // Use Sonnet for efficient summarization
    max_tokens: 1024,
    system: `You are summarizing a developer conversation for context continuation.
Create a concise technical summary that captures:
1. Main topics and goals discussed
2. Key decisions made
3. Code/technical context established
4. Current state of any projects
5. Open questions or next steps

Format as bullet points. Be specific about file names, technologies, and code patterns mentioned.
Keep it under 500 words but include all important technical details.`,
    messages: [
      {
        role: 'user',
        content: `Summarize this conversation for context continuation:\n\n${conversationText}`,
      },
    ],
  });

  let summary = '';
  for (const block of response.content) {
    if (block.type === 'text') {
      summary += block.text;
    }
  }
  return summary;
}

// Search detection - enhanced patterns for developer queries
// Especially focused on rapidly-changing AI/ML APIs and developer tools
function shouldUseSearch(message: string): boolean {
  const lower = message.toLowerCase();

  // ========================================
  // DIRECT SEARCH REQUESTS (user explicitly asks for search)
  // ========================================
  const directSearchPatterns = [
    /\b(search|look up|find|google|lookup|research)\b.*\b(web|online|internet)\b/i,
    /\bsearch (for|the|web|online)\b/i,
    /\b(can you|please|could you)\b.*\b(search|look up|find)\b/i,
    /\bsearch.*\b(technical|documentation|docs|api|info)/i,
  ];

  // ========================================
  // AI/ML API DOCUMENTATION (changes VERY fast - always search)
  // ========================================
  const aiApiPatterns = [
    // OpenAI / GPT
    /\b(openai|gpt-?[345o]|chatgpt|gpt|o[1-9]|davinci|turbo)\b.*\b(api|sdk|docs?|documentation|endpoint|model|version|release)/i,
    /\b(api|docs?|documentation)\b.*\b(openai|gpt|chatgpt)/i,
    /\bopenai\b.*\b(latest|current|new|pricing|rate.?limit)/i,

    // Anthropic / Claude
    /\b(anthropic|claude|sonnet|opus|haiku)\b.*\b(api|sdk|docs?|documentation|endpoint|model|version)/i,
    /\b(api|docs?|documentation)\b.*\b(anthropic|claude)/i,
    /\bclaude\b.*\b(latest|current|new|model|version|api)/i,

    // Other AI providers
    /\b(gemini|bard|palm|google.?ai)\b.*\b(api|sdk|docs?|model|version)/i,
    /\b(llama|meta.?ai|mistral|cohere)\b.*\b(api|sdk|docs?|model|version)/i,
    /\b(deepseek|xai|grok)\b.*\b(api|sdk|docs?|model|version)/i,
    /\b(hugging.?face|transformers)\b.*\b(api|model|version|latest)/i,

    // AI SDK / Vercel AI
    /\b(vercel.?ai|ai.?sdk)\b.*\b(docs?|documentation|api|version)/i,
    /\b(langchain|llamaindex|semantic.?kernel)\b.*\b(docs?|api|version)/i,
  ];

  // ========================================
  // FRAMEWORK/LIBRARY VERSIONS (change frequently)
  // ========================================
  const frameworkPatterns = [
    // React ecosystem
    /\b(react|next\.?js|remix|gatsby)\b.*\b(latest|current|new|version|release|[0-9]+\.[0-9]+)/i,
    /\b(latest|current|new)\b.*\b(react|next\.?js|version)/i,

    // Other frontend
    /\b(vue|nuxt|svelte|angular|astro)\b.*\b(latest|current|version|release)/i,

    // Backend
    /\b(node\.?js|deno|bun)\b.*\b(latest|current|version|release|lts)/i,
    /\b(express|fastify|hono|elysia|nest\.?js)\b.*\b(version|docs?|api)/i,

    // Languages
    /\b(typescript|python|rust|go)\b.*\b(latest|current|version|release|what'?s.?new)/i,

    // Package managers
    /\b(npm|yarn|pnpm|bun|pip|cargo)\b.*\b(version|release|latest|update)/i,
  ];

  // ========================================
  // LATEST/CURRENT INFORMATION REQUESTS
  // ========================================
  const latestInfoPatterns = [
    /\bwhat('s| is)\b.*\b(latest|current|newest|recent)\b.*\b(version|release|update)/i,
    /\b(latest|current|newest|recent)\b.*\b(version|release|update|documentation|docs)/i,
    /\bhow to\b.*\b(latest|current|new|updated)\b/i,
    /\bwhat'?s.?new\b.*\b(in|with|for)\b/i,
    /\b(released|updated|changed)\b.*\b(recently|today|this.?(week|month|year))/i,
    /\b(deprecat|breaking.?change|migration|upgrade)\b/i,
  ];

  // ========================================
  // DOCUMENTATION REQUESTS
  // ========================================
  const docPatterns = [
    /\b(official|api|sdk)\b.*\b(documentation|docs|reference|guide)/i,
    /\b(documentation|docs|reference)\b.*\b(for|about|on)\b/i,
    /\bwhere.?(can|do).?(i|we)\b.*\b(find|get)\b.*\b(docs?|documentation)/i,
    /\b(link|url)\b.*\b(docs?|documentation|api|reference)/i,
  ];

  // ========================================
  // PACKAGE/LIBRARY INFORMATION
  // ========================================
  const packagePatterns = [
    /\b(npm|yarn|pip|cargo|composer)\b.*\b(package|library|module|install)/i,
    /\b(install|setup|configure)\b.*\b(guide|instructions|docs|latest)/i,
    /\bpackage\.json\b.*\b(version|dependency|update)/i,
  ];

  // ========================================
  // TROUBLESHOOTING CURRENT ISSUES
  // ========================================
  const troubleshootPatterns = [
    /\b(error|issue|problem|bug)\b.*\b(fix|solve|resolve|solution|workaround)/i,
    /\bwhy (does|is|am|do)\b.*\b(not working|failing|broken|error)/i,
    /\b(known.?issue|bug.?report|github.?issue)/i,
  ];

  // ========================================
  // COMPARISON/EVALUATION
  // ========================================
  const comparisonPatterns = [
    /\b(compare|vs\.?|versus|difference.?between|which is better)\b/i,
    /\b(pros.?and.?cons|advantages|disadvantages|trade.?offs?)\b/i,
    /\b(benchmark|performance|comparison)\b.*\b(latest|current|[0-9]+)/i,
  ];

  // ========================================
  // PRICING/LIMITS (change without notice)
  // ========================================
  const pricingPatterns = [
    /\b(pricing|cost|price|rate.?limit|quota|tier)\b.*\b(api|service|cloud)/i,
    /\bhow much\b.*\b(cost|charge|price)/i,
    /\b(free.?tier|free.?plan|pricing.?table)/i,
  ];

  // ========================================
  // MODEL NAMES/IDs (change with every release - CRITICAL for API setup)
  // Examples: claude-sonnet-4-20250514, gpt-4-turbo-2024-04-09, claude-opus-4-5-20251101
  // ========================================
  const modelNamePatterns = [
    // Direct model name/ID queries
    /\b(model|models?)\b.*\b(name|names?|id|ids?|identifier|string|code)\b/i,
    /\bwhat('s| is)\b.*\b(model|models?)\b.*\b(name|id|call|use|string)\b/i,
    /\bmodel.?(name|id|string|identifier)\b/i,

    // Available/supported models
    /\b(latest|current|newest|available|supported)\b.*\b(model|models)\b/i,
    /\b(model|models)\b.*\b(list|available|supported|options|choices)\b/i,
    /\bwhat.?models?\b.*\b(available|support|can.?i.?use|exist)/i,

    // Model versions/releases
    /\bmodel\b.*\b(version|release|update|date|[0-9]{8})\b/i,
    /\b(claude|gpt|gemini|llama|mistral)\b.*\b(version|release|model.?id)\b/i,

    // API model parameter
    /\b(api|sdk|endpoint)\b.*\bmodel\b.*\b(parameter|argument|value|set)\b/i,
    /\bmodel\b.*\b(parameter|argument)\b.*\b(api|sdk|client)\b/i,

    // Environment variable setup for models
    /\b(env|environment|\.env)\b.*\b(model|models?)\b/i,
    /\bmodel\b.*\b(env|environment|config|variable)\b/i,

    // Specific model ID patterns (dated versions)
    /\b(claude|gpt|gemini)-[\w-]+-[0-9]{8}\b/i,
    /\bmodel.?id\b.*\b(format|example|syntax)\b/i,

    // Model deprecation/migration
    /\bmodel\b.*\b(deprecat|obsolete|retire|sunset|migrat|replac)\b/i,
    /\b(deprecat|sunset|replac)\b.*\bmodel/i,
  ];

  // Check all pattern groups
  const allPatterns = [
    ...directSearchPatterns,
    ...aiApiPatterns,
    ...frameworkPatterns,
    ...latestInfoPatterns,
    ...docPatterns,
    ...packagePatterns,
    ...troubleshootPatterns,
    ...comparisonPatterns,
    ...pricingPatterns,
    ...modelNamePatterns,
  ];

  // Check regex patterns
  if (allPatterns.some((p) => p.test(message))) {
    return true;
  }

  // ========================================
  // KEYWORD-BASED DETECTION
  // High-signal keywords that suggest real-time info needed
  // ========================================
  const highSignalKeywords = [
    'latest version',
    'current version',
    'new release',
    'just released',
    'recently updated',
    'breaking changes',
    'migration guide',
    'upgrade guide',
    'release notes',
    'changelog',
    "what's new",
    'official docs',
    'api reference',
    'rate limits',
    'pricing',
  ];

  if (highSignalKeywords.some((kw) => lower.includes(kw))) {
    return true;
  }

  // ========================================
  // AI-SPECIFIC KEYWORDS (always search - changes too fast)
  // ========================================
  const aiKeywordsWithContext = [
    'openai api',
    'anthropic api',
    'claude api',
    'gpt-4',
    'gpt-5',
    'claude 4',
    'claude opus',
    'claude sonnet',
    'gemini api',
    'ai sdk',
    'langchain',
    'llamaindex',
  ];

  // If AI keyword + version/api/docs context, search
  if (aiKeywordsWithContext.some((kw) => lower.includes(kw))) {
    return true;
  }

  // ========================================
  // MODEL NAME/ID KEYWORDS (critical for API setup)
  // ========================================
  const modelKeywords = [
    'model name',
    'model names',
    'model id',
    'model ids',
    'model identifier',
    'model string',
    'model list',
    'available models',
    'supported models',
    'model parameter',
    'model version',
    'model release',
    'which model',
    'what model',
    'latest model',
    'current model',
    'model deprecated',
    'model sunset',
  ];

  if (modelKeywords.some((kw) => lower.includes(kw))) {
    return true;
  }

  return false;
}

// In-memory rate limit store (per user, resets every minute)
// MEMORY LEAK FIX: Add periodic cleanup of expired entries
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_REQUESTS = 30; // 30 requests per minute
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // Cleanup every 5 minutes
let lastCleanupTime = Date.now();

/**
 * Clean up expired rate limit entries to prevent memory leaks.
 * Called periodically during rate limit checks.
 */
function cleanupExpiredRateLimits(): void {
  const now = Date.now();

  // Only run cleanup every CLEANUP_INTERVAL_MS
  if (now - lastCleanupTime < CLEANUP_INTERVAL_MS) {
    return;
  }

  lastCleanupTime = now;
  let cleanedCount = 0;

  for (const [userId, limit] of rateLimitStore.entries()) {
    if (now > limit.resetTime) {
      rateLimitStore.delete(userId);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    log.debug('Cleaned up expired rate limit entries', {
      count: cleanedCount,
      remaining: rateLimitStore.size,
    });
  }
}

function checkRateLimit(userId: string): { allowed: boolean; remaining: number } {
  const now = Date.now();

  // MEMORY LEAK FIX: Periodically clean up expired entries
  cleanupExpiredRateLimits();

  const userLimit = rateLimitStore.get(userId);

  if (!userLimit || now > userLimit.resetTime) {
    // Reset or initialize
    rateLimitStore.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT_REQUESTS - 1 };
  }

  if (userLimit.count >= RATE_LIMIT_REQUESTS) {
    return { allowed: false, remaining: 0 };
  }

  userLimit.count++;
  return { allowed: true, remaining: RATE_LIMIT_REQUESTS - userLimit.count };
}

export async function POST(request: NextRequest) {
  // CSRF Protection
  const csrfCheck = validateCSRF(request);
  if (!csrfCheck.valid) return csrfCheck.response!;

  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return new Response('Unauthorized', { status: 401 });
    }

    // SECURITY FIX: Rate limiting to prevent abuse
    const { allowed } = checkRateLimit(user.id);
    if (!allowed) {
      log.warn('Rate limit exceeded', { userId: user.id });
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded. Please wait a moment before sending more messages.',
          code: 'RATE_LIMIT_EXCEEDED',
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.ceil(Date.now() / 1000) + 60),
          },
        }
      );
    }

    const body = await request.json();
    const { sessionId, content, repo, attachments, forceSearch, modelId, thinking } = body;

    // P2a: Input validation - max content length to prevent abuse
    const MAX_CONTENT_LENGTH = 100000; // 100KB reasonable limit for chat messages
    if (content && typeof content === 'string' && content.length > MAX_CONTENT_LENGTH) {
      return new Response(
        JSON.stringify({
          error: 'Message too long',
          code: 'CONTENT_TOO_LONG',
          maxLength: MAX_CONTENT_LENGTH,
          actualLength: content.length,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Model selection (Claude Code parity) - default to Opus 4.5
    const selectedModel = modelId || 'claude-opus-4-5-20251101';

    // Extended thinking configuration (Claude Code parity)
    const thinkingEnabled = thinking?.enabled === true;
    const thinkingBudget = thinking?.budgetTokens || 10000;

    if (!sessionId || (!content && (!attachments || attachments.length === 0))) {
      return new Response('Missing sessionId or content', { status: 400 });
    }

    // Process attachments for Claude vision
    interface AttachmentData {
      name: string;
      type: string;
      data: string;
    }
    const imageAttachments = ((attachments as AttachmentData[]) || []).filter((a: AttachmentData) =>
      a.type.startsWith('image/')
    );
    const documentAttachments = ((attachments as AttachmentData[]) || []).filter(
      (a: AttachmentData) => !a.type.startsWith('image/')
    );

    // Build content with document info
    let enhancedContent = content || '';
    if (documentAttachments.length > 0) {
      enhancedContent +=
        '\n\n[Attached documents: ' +
        documentAttachments.map((d: AttachmentData) => d.name).join(', ') +
        ']';
    }

    // Process slash commands - convert /fix, /test, etc. to enhanced prompts
    let slashCommandFailed = false;
    let slashCommandError = '';
    let isActionCommand = false;
    let actionResponse = '';

    if (isSlashCommand(enhancedContent)) {
      const parsed = parseSlashCommand(enhancedContent);
      if (parsed) {
        const processedPrompt = processSlashCommand(enhancedContent, {
          userId: user.id,
          sessionId,
          repo: repo
            ? {
                owner: repo.owner,
                name: repo.name,
                branch: repo.branch || 'main',
              }
            : undefined,
        });
        if (processedPrompt) {
          log.debug('Slash command detected', { command: content?.substring(0, 50) });

          // Handle action commands that require immediate execution
          if (processedPrompt === '[CLEAR_HISTORY]') {
            isActionCommand = true;
            // Delete all messages for this session (will be executed after ownership verification)
            actionResponse = '**History cleared.** Starting fresh conversation.';
          } else if (processedPrompt.startsWith('[RESET_SESSION]')) {
            isActionCommand = true;
            actionResponse = '**Session reset.** All preferences restored to defaults.';
          } else if (processedPrompt.startsWith('[COMPACT_CONTEXT]')) {
            isActionCommand = true;
            // Trigger context compaction
            actionResponse = '**Context compacted.** Older messages summarized to free up space.';
          } else {
            enhancedContent = processedPrompt;
          }
        }
      } else {
        // Unknown slash command - provide helpful feedback
        const commandName = enhancedContent.split(' ')[0];
        slashCommandFailed = true;
        slashCommandError = `Unknown command: ${commandName}. Try /help to see available commands.`;
        log.debug('Unknown slash command', { command: commandName });
      }
    }

    // SECURITY: Get session AND verify ownership BEFORE any operations
    const { data: currentSession, error: sessionFetchError } = await (
      supabase.from('code_lab_sessions') as AnySupabase
    )
      .select('message_count, user_id')
      .eq('id', sessionId)
      .single();

    if (sessionFetchError) {
      log.warn('Failed to get session', { error: sessionFetchError.message });
      return new Response(
        JSON.stringify({ error: 'Session not found', code: 'SESSION_NOT_FOUND' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Verify the authenticated user owns this session
    if (currentSession.user_id !== user.id) {
      log.warn('Session ownership violation attempt', {
        sessionId,
        requestingUser: user.id,
        sessionOwner: currentSession.user_id,
      });
      return new Response(
        JSON.stringify({ error: 'Access denied', code: 'SESSION_ACCESS_DENIED' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Handle action commands that execute immediately (ownership verified)
    if (isActionCommand) {
      const encoder = new TextEncoder();

      // Execute the actual action
      if (actionResponse.includes('History cleared')) {
        // Delete all messages for this session
        await (supabase.from('code_lab_messages') as AnySupabase)
          .delete()
          .eq('session_id', sessionId);
        // Reset message count
        await (supabase.from('code_lab_sessions') as AnySupabase)
          .update({ message_count: 0 })
          .eq('id', sessionId);
        log.info('Session history cleared', { sessionId });
      } else if (actionResponse.includes('Session reset')) {
        // Delete all messages and reset session
        await (supabase.from('code_lab_messages') as AnySupabase)
          .delete()
          .eq('session_id', sessionId);
        await (supabase.from('code_lab_sessions') as AnySupabase)
          .update({
            message_count: 0,
            has_summary: false,
            last_summary_at: null,
          })
          .eq('id', sessionId);
        log.info('Session reset', { sessionId });
      } else if (actionResponse.includes('Context compacted')) {
        // Trigger summarization of older messages
        const { data: allMessages } = await (supabase.from('code_lab_messages') as AnySupabase)
          .select('id, role, content')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: true });

        if (allMessages && allMessages.length > 5) {
          // Summarize older messages (keep last 5)
          const toSummarize = allMessages.slice(0, -5);
          const summary = await generateConversationSummary(
            toSummarize.map((m: { role: string; content: string }) => ({
              role: m.role,
              content: m.content,
            }))
          );

          // SAFETY FIX: Insert summary FIRST, then delete old messages
          // This ensures we never lose data - if insert fails, we keep old messages
          const summaryId = generateId();
          const { error: insertError } = await (
            supabase.from('code_lab_messages') as AnySupabase
          ).insert({
            id: summaryId,
            session_id: sessionId,
            role: 'system',
            content: summary,
            created_at: new Date().toISOString(),
            type: 'summary',
          });

          if (insertError) {
            log.error('Failed to insert summary, keeping original messages', {
              error: insertError.message,
            });
          } else {
            // Only delete old messages if summary was successfully saved
            const idsToDelete = toSummarize.map((m: { id: string }) => m.id);
            const { error: deleteError } = await (supabase.from('code_lab_messages') as AnySupabase)
              .delete()
              .in('id', idsToDelete);

            if (deleteError) {
              log.warn('Failed to delete old messages after summarization', {
                error: deleteError.message,
              });
            }

            await (supabase.from('code_lab_sessions') as AnySupabase)
              .update({ has_summary: true, last_summary_at: new Date().toISOString() })
              .eq('id', sessionId);

            log.info('Context compacted', { sessionId, summarizedCount: toSummarize.length });
          }
        }
      }

      // Return success response
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(actionResponse));
            controller.close();
          },
        }),
        {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'X-Action-Command': 'true',
          },
        }
      );
    }

    // Run intelligent intent detection
    const intentResult = detectCodeLabIntent(enhancedContent);
    log.debug('Intent detected', {
      type: intentResult.type,
      confidence: intentResult.confidence,
      workspace: intentResult.shouldUseWorkspace,
    });

    // Save user message (now safe - ownership verified)
    const userMessageId = generateId();
    const { error: msgError } = await (supabase.from('code_lab_messages') as AnySupabase).insert({
      id: userMessageId,
      session_id: sessionId,
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    });

    if (msgError) {
      log.warn('Failed to save user message', { error: msgError.message });
      // Continue anyway - we can still process the request
    }

    // Update session timestamp and message count (session already fetched and verified above)
    const { error: updateError } = await (supabase.from('code_lab_sessions') as AnySupabase)
      .update({
        updated_at: new Date().toISOString(),
        message_count: (currentSession?.message_count || 0) + 1,
      })
      .eq('id', sessionId);

    if (updateError) {
      log.warn('Failed to update session', { error: updateError.message });
    }

    // Get conversation history with auto-summarization
    const { data: allMessages } = await (supabase.from('code_lab_messages') as AnySupabase)
      .select('id, role, content, type')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    // Check for existing summary
    const existingSummary = (allMessages || []).find((m: { type: string }) => m.type === 'summary');

    // Build effective history for context
    let history: Array<{ role: string; content: string }> = [];
    const messageCount = currentSession?.message_count || 0;

    if (messageCount > SUMMARY_THRESHOLD && !existingSummary) {
      // Need to generate a summary
      log.info('Auto-summarizing conversation', { messageCount });

      const messagesToSummarize = (allMessages || [])
        .filter((m: { type: string }) => m.type !== 'summary')
        .slice(0, -RECENT_MESSAGES_AFTER_SUMMARY);

      if (messagesToSummarize.length > 0) {
        try {
          const summary = await generateConversationSummary(
            messagesToSummarize.map((m: { role: string; content: string }) => ({
              role: m.role,
              content: m.content,
            }))
          );

          // SAFETY FIX: Check insert result before updating session state
          const { error: insertError } = await (
            supabase.from('code_lab_messages') as AnySupabase
          ).insert({
            id: generateId(),
            session_id: sessionId,
            role: 'system',
            content: summary,
            created_at: new Date().toISOString(),
            type: 'summary',
          });

          if (insertError) {
            log.error('Failed to save summary', { error: insertError.message });
            // Fall back to recent messages only
            history = (allMessages || [])
              .slice(-20)
              .map((m: { role: string; content: string }) => ({
                role: m.role,
                content: m.content,
              }));
          } else {
            // Update session has_summary flag only if insert succeeded
            await (supabase.from('code_lab_sessions') as AnySupabase)
              .update({ has_summary: true, last_summary_at: new Date().toISOString() })
              .eq('id', sessionId);

            // Use summary + recent messages
            history = [
              { role: 'system', content: `[Previous conversation summary]\n${summary}` },
              ...(allMessages || [])
                .filter((m: { type: string }) => m.type !== 'summary')
                .slice(-RECENT_MESSAGES_AFTER_SUMMARY)
                .map((m: { role: string; content: string }) => ({
                  role: m.role,
                  content: m.content,
                })),
            ];
          }
        } catch (err) {
          log.error('Summary generation failed', err as Error);
          // Fall back to recent messages only
          history = (allMessages || []).slice(-20).map((m: { role: string; content: string }) => ({
            role: m.role,
            content: m.content,
          }));
        }
      }
    } else if (existingSummary) {
      // Use existing summary + messages after it
      const summaryIndex = (allMessages || []).findIndex(
        (m: { id: string }) => m.id === existingSummary.id
      );
      history = [
        { role: 'system', content: `[Previous conversation summary]\n${existingSummary.content}` },
        ...(allMessages || [])
          .slice(summaryIndex + 1)
          .map((m: { role: string; content: string }) => ({
            role: m.role,
            content: m.content,
          })),
      ];
    } else {
      // No summarization needed, use all messages
      history = (allMessages || []).slice(-20).map((m: { role: string; content: string }) => ({
        role: m.role,
        content: m.content,
      }));
    }

    // Handle slash command failures by returning error response
    if (slashCommandFailed) {
      const errorMessageId = generateId();
      const errorContent = `**${slashCommandError}**\n\nAvailable commands:\n- \`/fix\` - Fix errors in the codebase\n- \`/test\` - Run tests\n- \`/build\` - Run build\n- \`/commit\` - Commit changes\n- \`/push\` - Push to remote\n- \`/review\` - Code review\n- \`/explain\` - Explain code\n- \`/workspace\` - Enable sandbox mode\n- \`/help\` - Show all commands`;

      await (supabase.from('code_lab_messages') as AnySupabase).insert({
        id: errorMessageId,
        session_id: sessionId,
        role: 'assistant',
        content: errorContent,
        created_at: new Date().toISOString(),
      });

      // Return error as stream
      const encoder = new TextEncoder();
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(errorContent));
            controller.close();
          },
        }),
        {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'X-Message-Id': errorMessageId,
          },
        }
      );
    }

    // Detect intent (forceSearch from button overrides auto-detection)
    const useCodeAgent = checkCodeAgentIntent(enhancedContent);
    const useSearch = forceSearch || shouldUseSearch(enhancedContent);
    const useMultiAgent = shouldUseMultiAgent(enhancedContent);
    // Use intelligent intent detector result
    const useWorkspaceAgent = intentResult.shouldUseWorkspace;

    // ========================================
    // WORKSPACE AGENT - E2B Sandbox Execution (Claude Code-like)
    // ========================================
    // Check if user has an active workspace for THIS SESSION (not any session)
    // CRITICAL FIX: Query by session_id to get session-specific workspace
    // SAFETY FIX: Use .maybeSingle() instead of .single() to avoid crash on 0 or multiple rows
    const { data: workspaceData, error: workspaceError } = await (
      supabase.from('code_lab_workspaces') as AnySupabase
    )
      .select('id, sandbox_id, status')
      .eq('session_id', sessionId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    if (workspaceError) {
      log.warn('Failed to query workspace', { error: workspaceError.message, sessionId });
      // Continue without workspace - don't crash the entire chat
    }

    // Use workspace agent if: has active workspace AND request is agentic (high confidence)
    // OR if user explicitly asks for workspace mode with keywords
    const forceWorkspace =
      body.useWorkspace === true ||
      enhancedContent.toLowerCase().includes('/workspace') ||
      enhancedContent.toLowerCase().includes('/sandbox') ||
      enhancedContent.toLowerCase().includes('/execute');

    // Only use workspace for high-confidence agentic requests
    const shouldActivateWorkspace =
      (workspaceData?.id && useWorkspaceAgent && intentResult.confidence >= 50) || forceWorkspace;

    if (shouldActivateWorkspace) {
      log.info('Using Workspace Agent (E2B sandbox mode)');

      // Get or create workspace
      let workspaceId = workspaceData?.id;
      let sandboxId = workspaceData?.sandbox_id;

      if (!workspaceId) {
        // Generate a sandbox ID (will be replaced by real E2B sandbox ID when created)
        sandboxId = `sandbox-${Date.now()}-${Math.random().toString(36).substring(7)}`;

        // Create a new workspace for this user
        const { data: newWorkspace, error: wsError } = await (
          supabase.from('code_lab_workspaces') as AnySupabase
        )
          .insert({
            user_id: user.id,
            session_id: sessionId,
            sandbox_id: sandboxId,
            template: 'nodejs',
            status: 'active',
            created_at: new Date().toISOString(),
            last_activity_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (wsError) {
          log.error('Failed to create workspace', { error: wsError ?? 'Unknown error' });
        }

        workspaceId = newWorkspace?.id;
      }

      if (workspaceId) {
        // Update last activity
        const { error: activityError } = await (supabase.from('code_lab_workspaces') as AnySupabase)
          .update({ last_activity_at: new Date().toISOString() })
          .eq('id', workspaceId);

        if (activityError) {
          log.warn('Failed to update workspace activity', { error: activityError.message });
        }

        // Execute workspace agent with streaming
        // CRITICAL FIX: Pass sessionId as workspaceId since ContainerManager queries by session_id
        // The workspace row ID is only used for DB operations, not for sandbox lookups
        const workspaceStream = await executeWorkspaceAgent(content, {
          workspaceId: sessionId,
          userId: user.id,
          sessionId,
          history: (history || []).map((m: { role: string; content: string }) => ({
            role: m.role,
            content: m.content,
          })),
        });

        // Collect stream and save to database
        const reader = workspaceStream.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const text = decoder.decode(value);
                fullContent += text;
                controller.enqueue(encoder.encode(text));
              }

              // Save assistant message
              await (supabase.from('code_lab_messages') as AnySupabase).insert({
                id: generateId(),
                session_id: sessionId,
                role: 'assistant',
                content: fullContent,
                created_at: new Date().toISOString(),
                type: 'workspace',
              });

              controller.close();
            } catch (error) {
              log.error('Workspace Agent error', error as Error);
              const errorContent =
                '\n\n`✕ Error:` I encountered an error during workspace execution. Please try again.';
              fullContent += errorContent;

              // CRITICAL FIX: Save error message to maintain conversation history
              try {
                await (supabase.from('code_lab_messages') as AnySupabase).insert({
                  id: generateId(),
                  session_id: sessionId,
                  role: 'assistant',
                  content: fullContent || errorContent,
                  created_at: new Date().toISOString(),
                  type: 'error',
                });
              } catch (saveError) {
                log.error('Failed to save workspace error message', saveError as Error);
              }

              controller.enqueue(encoder.encode(errorContent));
              controller.close();
            }
          },
        });

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          },
        });
      }
    }

    // ========================================
    // CODE AGENT V2 - Full Project Generation
    // ========================================
    if (useCodeAgent) {
      // CRITICAL-008 FIX: Use secure service role client with audit logging
      // This ensures all privileged database access is authenticated and logged
      const secureClient = createSecureServiceClient(
        { id: user.id, email: user.email || undefined },
        extractRequestContext(request, '/api/code-lab/chat')
      );

      // Get GitHub token using secure client (enforces user ownership)
      const encryptedToken = await secureClient.getUserGitHubToken(user.id);

      let githubToken: string | undefined;
      if (encryptedToken) {
        const decrypted = decryptToken(encryptedToken);
        if (decrypted) {
          githubToken = decrypted;
        } else {
          log.warn('GitHub token decryption failed - proceeding without GitHub access');
        }
      }

      // Execute Code Agent with streaming
      const codeAgentStream = await executeCodeAgent(content, {
        userId: user.id,
        conversationId: sessionId,
        previousMessages: (history || []).map((m: { role: string; content: string }) => ({
          role: m.role,
          content: m.content,
        })),
        githubToken,
        selectedRepo: repo
          ? {
              owner: repo.owner,
              repo: repo.name,
              fullName: repo.fullName,
            }
          : undefined,
        skipClarification:
          content.toLowerCase().includes('just build') ||
          content.toLowerCase().includes('proceed') ||
          content.toLowerCase().includes('go ahead'),
      });

      // Collect the stream and save to database
      const reader = codeAgentStream.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              const text = decoder.decode(value);
              fullContent += text;
              controller.enqueue(encoder.encode(text));
            }

            // Save assistant message
            await (supabase.from('code_lab_messages') as AnySupabase).insert({
              id: generateId(),
              session_id: sessionId,
              role: 'assistant',
              content: fullContent,
              created_at: new Date().toISOString(),
              type: 'code',
            });

            controller.close();
          } catch (error) {
            log.error('Code Agent error', error as Error);
            const errorContent =
              '\n\nI encountered an error during code generation. Please try again.';
            fullContent += errorContent;

            // CRITICAL FIX: Save error message to maintain conversation history
            try {
              await (supabase.from('code_lab_messages') as AnySupabase).insert({
                id: generateId(),
                session_id: sessionId,
                role: 'assistant',
                content: fullContent || errorContent,
                created_at: new Date().toISOString(),
                type: 'error',
              });
            } catch (saveError) {
              log.error('Failed to save code agent error message', saveError as Error);
            }

            controller.enqueue(encoder.encode(errorContent));
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    }

    // ========================================
    // MULTI-AGENT MODE - Specialized Agents
    // ========================================
    if (useMultiAgent) {
      const suggestedAgents = getSuggestedAgents(enhancedContent);
      log.info('Multi-Agent mode activated', { agents: suggestedAgents });

      const encoder = new TextEncoder();
      let fullContent = ''; // Moved outside try block for error handler access
      const stream = new ReadableStream({
        async start(controller) {
          try {
            // Stream the orchestrated response
            const agentStream = orchestrateStream(enhancedContent, {
              userId: user.id,
              sessionId,
              repo: repo
                ? {
                    owner: repo.owner,
                    name: repo.name,
                    branch: repo.branch || 'main',
                    fullName: repo.fullName,
                  }
                : undefined,
              previousMessages: (history || []).map((m: { role: string; content: string }) => ({
                role: m.role,
                content: m.content,
              })),
            });

            for await (const chunk of agentStream) {
              fullContent += chunk;
              controller.enqueue(encoder.encode(chunk));
            }

            // Save assistant message
            await (supabase.from('code_lab_messages') as AnySupabase).insert({
              id: generateId(),
              session_id: sessionId,
              role: 'assistant',
              content: fullContent,
              created_at: new Date().toISOString(),
              type: 'multi-agent',
            });

            controller.close();
          } catch (error) {
            log.error('Multi-Agent error', error as Error);
            const errorContent =
              '\n\nI encountered an error with the multi-agent system. Please try again.';
            fullContent += errorContent;

            // CRITICAL FIX: Save error message to maintain conversation history
            try {
              await (supabase.from('code_lab_messages') as AnySupabase).insert({
                id: generateId(),
                session_id: sessionId,
                role: 'assistant',
                content: fullContent || errorContent,
                created_at: new Date().toISOString(),
                type: 'error',
              });
            } catch (saveError) {
              log.error('Failed to save multi-agent error message', saveError as Error);
            }

            controller.enqueue(encoder.encode(errorContent));
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    }

    // ========================================
    // PERPLEXITY SEARCH - Real-time Web Search
    // ========================================
    if (useSearch && isPerplexityConfigured()) {
      const encoder = new TextEncoder();
      let fullContent = ''; // Moved outside try block for error handler access
      const stream = new ReadableStream({
        async start(controller) {
          try {
            // Show search indicator
            controller.enqueue(encoder.encode('`🔍 Searching the web...`\n\n'));

            // Perform Perplexity search
            const searchResult = await perplexitySearch({
              query: content,
              systemPrompt: `You are a developer-focused search assistant. Provide accurate, technical information.
Format your response with:
1. Direct answer to the question
2. Code examples if relevant (with language tags)
3. Best practices or tips
Keep it professional and focused on development.`,
            });

            // Format the search result
            fullContent = searchResult.answer;

            // Add sources
            if (searchResult.sources && searchResult.sources.length > 0) {
              fullContent += '\n\n---\n\n**Sources:**\n';
              searchResult.sources.slice(0, 5).forEach((source, i) => {
                fullContent += `${i + 1}. [${source.title || 'Source'}](${source.url})\n`;
              });
            }

            // Stream the response
            controller.enqueue(encoder.encode(fullContent));

            // Save assistant message
            await (supabase.from('code_lab_messages') as AnySupabase).insert({
              id: generateId(),
              session_id: sessionId,
              role: 'assistant',
              content: fullContent,
              created_at: new Date().toISOString(),
              type: 'search',
              search_output: JSON.stringify({
                query: content,
                sources: searchResult.sources,
                model: searchResult.model,
              }),
            });

            controller.close();
          } catch (error) {
            log.error('Perplexity search error', error as Error);
            // Fall back to Claude if Perplexity fails
            controller.enqueue(encoder.encode('`Search unavailable, using knowledge base...`\n\n'));

            try {
              const fallbackResponse = await anthropic.messages.create({
                model: selectedModel, // Use user-selected model (Claude Code parity)
                max_tokens: 4096,
                system: `You are Claude in Code Lab. The user asked a search question but web search failed.
Provide the best answer you can from your training knowledge.
Be honest about knowledge cutoff limitations when relevant.`,
                messages: [{ role: 'user', content }],
              });

              let fallbackContent = '';
              for (const block of fallbackResponse.content) {
                if (block.type === 'text') {
                  fallbackContent += block.text;
                  controller.enqueue(encoder.encode(block.text));
                }
              }

              // Save fallback response
              await (supabase.from('code_lab_messages') as AnySupabase).insert({
                id: generateId(),
                session_id: sessionId,
                role: 'assistant',
                content: fallbackContent,
                created_at: new Date().toISOString(),
                type: 'search',
              });
            } catch (fallbackError) {
              log.error('Fallback error', fallbackError as Error);
              const errorContent = '\n\nI encountered an error. Please try again.';

              // CRITICAL FIX: Save error message to maintain conversation history
              try {
                await (supabase.from('code_lab_messages') as AnySupabase).insert({
                  id: generateId(),
                  session_id: sessionId,
                  role: 'assistant',
                  content: errorContent,
                  created_at: new Date().toISOString(),
                  type: 'error',
                });
              } catch (saveError) {
                log.error('Failed to save search fallback error message', saveError as Error);
              }

              controller.enqueue(encoder.encode(errorContent));
            }

            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    }

    // ========================================
    // REGULAR CHAT - Multi-Provider Support
    // ========================================
    // Supports Claude, OpenAI (GPT-5), xAI (Grok), DeepSeek, and Google (Gemini)

    // Determine which provider to use based on the selected model
    const providerId = getProviderForModel(selectedModel);
    const providerInfo = getProviderAndModel(selectedModel);

    log.info('Chat request', {
      model: selectedModel,
      provider: providerId || 'unknown',
      modelName: providerInfo?.model.name || 'unknown',
    });

    // Build system prompt (shared across all providers)
    // Dynamic context awareness - tell the AI exactly what resources are available
    const hasRepo = repo && repo.fullName;
    const hasImages = imageAttachments.length > 0;

    let systemPrompt = `You are a highly capable AI assistant in Code Lab - a professional developer workspace.

You help developers with:
- Building code and applications
- Debugging and fixing issues
- Searching documentation
- Explaining concepts
- Code review and best practices
${hasImages ? '- Analyzing screenshots and images (you have vision capabilities)' : ''}

## CURRENT SESSION CONTEXT

${
  hasRepo
    ? `**Repository Connected:** ${repo.fullName} (branch: ${repo.branch || 'main'})
You can reference this repository and help with code within it.`
    : `**No Repository Connected**
The user has not connected a repository to this session. Do NOT assume you have access to any codebase or project files. If the user asks about code, ask them to either:
1. Paste the relevant code in the chat
2. Upload files as attachments
3. Connect a repository from the sidebar`
}

${
  hasImages
    ? `**Files Attached:** ${imageAttachments.length} image(s)
Analyze the attached images carefully and provide helpful feedback.`
    : ''
}

## BEHAVIOR GUIDELINES

- **Only work with what you have.** Do not assume access to files, repos, or code that hasn't been explicitly shared with you.
- **Ask clarifying questions** when the user's request is ambiguous or when you need more context.
- **Don't over-analyze.** If the user asks a simple question, give a simple answer. Don't volunteer to analyze non-existent code.
- **Be direct and helpful.** Focus on what the user actually asked for.
- **When the user shares code**, work with that specific code - don't ask to see their whole project unless necessary.

## FORMATTING

- Keep responses clear, professional, and focused
- Use markdown for formatting
- Use code blocks with language tags
- When showing terminal commands, use \`\`\`bash blocks
- Be concise but thorough
- Provide working, tested code
- Explain your reasoning briefly`;

    // Inject CLAUDE.md memory into context
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: sessionWithSettings } = await (supabase as any)
      .from('code_lab_sessions')
      .select('settings')
      .eq('id', sessionId)
      .single();

    const memoryContent = sessionWithSettings?.settings?.memory_content;
    if (memoryContent && memoryContent.trim()) {
      systemPrompt += `

---
# Project Memory

The user has defined the following project-specific context and instructions:

${memoryContent}

---
IMPORTANT: Follow the instructions above. They represent the user's preferences for this project.`;
      log.info('Injected memory context', { length: memoryContent.length });
    }

    // Stream the response with reliability features
    const encoder = new TextEncoder();

    // Configuration for reliability
    const CHUNK_TIMEOUT_MS = 60000; // 60s timeout per chunk
    const KEEPALIVE_INTERVAL_MS = 15000; // Send keepalive every 15s

    // ========================================
    // NON-CLAUDE PROVIDERS (OpenAI, xAI, DeepSeek, Google)
    // ========================================
    if (providerId && providerId !== 'claude') {
      log.info('Using non-Claude provider', { providerId, model: selectedModel });

      const stream = new ReadableStream({
        async start(controller) {
          let keepaliveInterval: NodeJS.Timeout | null = null;
          let lastActivity = Date.now();

          const startKeepalive = () => {
            keepaliveInterval = setInterval(() => {
              const timeSinceActivity = Date.now() - lastActivity;
              if (timeSinceActivity > KEEPALIVE_INTERVAL_MS - 1000) {
                try {
                  controller.enqueue(encoder.encode(' '));
                  log.debug('Sent keepalive heartbeat');
                } catch {
                  // Controller might be closed
                }
              }
            }, KEEPALIVE_INTERVAL_MS);
          };

          const stopKeepalive = () => {
            if (keepaliveInterval) {
              clearInterval(keepaliveInterval);
              keepaliveInterval = null;
            }
          };

          let fullContent = '';

          try {
            // BYOK: Check if user has their own API key for this provider
            const userApiKey = await getUserApiKey(supabase, user.id, providerId);

            // Validate API key is available (either BYOK or platform key)
            // All providers support numbered keys (_1, _2, etc.) for key rotation
            if (!userApiKey) {
              const apiKeyEnvMap: Record<string, string[]> = {
                openai: ['OPENAI_API_KEY', 'OPENAI_API_KEY_1'],
                xai: ['XAI_API_KEY', 'XAI_API_KEY_1'],
                deepseek: ['DEEPSEEK_API_KEY', 'DEEPSEEK_API_KEY_1'],
                google: ['GEMINI_API_KEY', 'GEMINI_API_KEY_1'],
              };
              const requiredEnvVars = apiKeyEnvMap[providerId];
              if (requiredEnvVars) {
                const hasAnyKey = requiredEnvVars.some((envVar) => process.env[envVar]);
                if (!hasAnyKey) {
                  const primaryKey = requiredEnvVars[0];
                  throw new Error(
                    `${primaryKey} is not configured. Add your own API key in Settings, or contact the administrator.`
                  );
                }
              }
            }

            // Get the appropriate adapter for this provider
            const adapter = getAdapter(providerId);

            // Convert history to unified message format
            const unifiedMessages: UnifiedMessage[] = (history || []).map(
              (m: { role: string; content: string }) => ({
                role: m.role as 'user' | 'assistant' | 'system',
                content: m.content,
              })
            );

            // Build the current user message content with vision support
            const userContentBlocks: Array<
              | { type: 'text'; text: string }
              | { type: 'image'; source: { type: 'base64'; mediaType: string; data: string } }
            > = [];

            if (enhancedContent) {
              userContentBlocks.push({ type: 'text', text: enhancedContent });
            }

            // Add images for vision
            for (const img of imageAttachments) {
              const base64Data = img.data.split(',')[1] || img.data;
              userContentBlocks.push({
                type: 'image',
                source: {
                  type: 'base64',
                  mediaType: img.type,
                  data: base64Data,
                },
              });
            }

            // Add the user message
            if (userContentBlocks.length > 0) {
              unifiedMessages.push({
                role: 'user',
                content:
                  userContentBlocks.length === 1 && userContentBlocks[0].type === 'text'
                    ? userContentBlocks[0].text
                    : userContentBlocks,
              });
            }

            // Start keepalive
            startKeepalive();

            // Track token usage
            let inputTokens = 0;
            let outputTokens = 0;

            // Stream from the adapter
            // Pass userApiKey if using BYOK (bypasses pooled keys)
            const chatStream = adapter.chat(unifiedMessages, {
              model: selectedModel,
              maxTokens: providerInfo?.model.maxOutputTokens || 8192,
              temperature: 0.7,
              systemPrompt,
              ...(userApiKey ? { userApiKey } : {}),
            });

            for await (const chunk of chatStream) {
              lastActivity = Date.now();

              if (chunk.type === 'text') {
                fullContent += chunk.text;
                controller.enqueue(encoder.encode(chunk.text));
              } else if (chunk.type === 'error' && chunk.error) {
                log.error('Adapter stream error', {
                  code: chunk.error.code,
                  message: chunk.error.message,
                });
                throw new Error(chunk.error.message);
              } else if (chunk.type === 'message_end' && chunk.usage) {
                inputTokens = chunk.usage.inputTokens || 0;
                outputTokens = chunk.usage.outputTokens || 0;
              }
            }

            // Send token usage marker
            if (inputTokens > 0 || outputTokens > 0) {
              const usageMarker = `\n<!--USAGE:${JSON.stringify({
                input: inputTokens,
                output: outputTokens,
                cacheRead: 0,
                cacheWrite: 0,
                model: selectedModel,
              })}-->`;
              controller.enqueue(encoder.encode(usageMarker));
              log.debug('Token usage', { inputTokens, outputTokens, provider: providerId });
            }

            // Save assistant message
            await (supabase.from('code_lab_messages') as AnySupabase).insert({
              id: generateId(),
              session_id: sessionId,
              role: 'assistant',
              content: fullContent,
              created_at: new Date().toISOString(),
              type: 'chat',
              model_id: selectedModel,
            });

            controller.close();
          } catch (error) {
            log.error('Stream error', error as Error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const lowerError = errorMessage.toLowerCase();

            // Provide specific error messages for common issues
            let userMessage: string;
            if (lowerError.includes('timeout')) {
              userMessage = '\n\n*[Response interrupted: Connection timed out. Please try again.]*';
            } else if (
              lowerError.includes('not configured') ||
              lowerError.includes('is not set') ||
              lowerError.includes('missing api key') ||
              lowerError.includes('no api key')
            ) {
              // Key is genuinely not configured - admin needs to add it
              userMessage = `\n\n**API Configuration Error**\n\nThe ${providerId?.toUpperCase() || 'provider'} API key is not configured. Please contact the administrator to set up the API key.`;
            } else if (
              lowerError.includes('invalid api key') ||
              lowerError.includes('invalid_api_key') ||
              lowerError.includes('incorrect api key') ||
              lowerError.includes('api key') ||
              lowerError.includes('api_key') ||
              lowerError.includes('authentication') ||
              lowerError.includes('unauthorized') ||
              lowerError.includes('401')
            ) {
              // Key exists but is invalid/expired - different message
              userMessage = `\n\n**API Authentication Error**\n\nThe ${providerId?.toUpperCase() || 'provider'} API key authentication failed. The key may be invalid, expired, or lacking permissions. Please contact the administrator.`;
            } else if (lowerError.includes('model') && lowerError.includes('not found')) {
              userMessage = `\n\n**Model Error**\n\nThe model "${selectedModel}" was not found. It may be unavailable or incorrectly configured.`;
            } else if (
              lowerError.includes('429') ||
              lowerError.includes('quota') ||
              lowerError.includes('rate limit') ||
              lowerError.includes('rate_limit') ||
              lowerError.includes('ratelimit') ||
              lowerError.includes('too many requests') ||
              lowerError.includes('resource_exhausted')
            ) {
              // Note: Avoid matching just 'rate' alone - it appears in URLs like "streamGenerateContent"
              userMessage = `\n\n**Rate Limit**\n\nThe ${providerId || 'provider'} API rate limit has been reached. Please wait a moment and try again.`;
            } else if (
              lowerError.includes('400') ||
              lowerError.includes('invalid_argument') ||
              lowerError.includes('invalid argument') ||
              lowerError.includes('invalid value') ||
              lowerError.includes('bad request') ||
              lowerError.includes('malformed')
            ) {
              // Handle 400 Bad Request / Invalid Argument errors (common with preview models)
              userMessage = `\n\n**Request Error**\n\nThe request format is not supported by this model. This can happen with preview models that have different API requirements. Please try a stable model.`;
            } else if (lowerError.includes('safety') || lowerError.includes('blocked')) {
              userMessage =
                '\n\n**Content Filtered**\n\nThe response was blocked by safety filters. Please rephrase your request.';
            } else {
              // Include actual error for debugging (sanitized)
              const sanitizedError = errorMessage
                .substring(0, 200)
                .replace(/api[_-]?key[=:][^\s]*/gi, '[REDACTED]');
              userMessage = `\n\n**Error**\n\nI encountered an error: ${sanitizedError}\n\nPlease try again or select a different model.`;
            }

            fullContent += userMessage;

            try {
              await (supabase.from('code_lab_messages') as AnySupabase).insert({
                id: generateId(),
                session_id: sessionId,
                role: 'assistant',
                content: fullContent || userMessage,
                created_at: new Date().toISOString(),
                type: 'error',
                model_id: selectedModel,
              });
            } catch (saveError) {
              log.error('Failed to save error message', saveError as Error);
            }

            controller.enqueue(encoder.encode(userMessage));
            controller.close();
          } finally {
            stopKeepalive();
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    }

    // ========================================
    // CLAUDE PROVIDER (Anthropic) - Default
    // ========================================
    // Uses native Anthropic SDK for extended thinking support
    const messages: Anthropic.MessageParam[] = (history || []).map(
      (m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })
    );

    // Build the current user message content (with vision support)
    type MessageContent = Anthropic.TextBlockParam | Anthropic.ImageBlockParam;
    const userContent: MessageContent[] = [];

    // Add text content
    if (enhancedContent) {
      userContent.push({ type: 'text', text: enhancedContent });
    }

    // Add images for vision (Claude can process images)
    for (const img of imageAttachments) {
      // Extract base64 data (remove "data:image/...;base64," prefix)
      const base64Data = img.data.split(',')[1] || img.data;
      const mediaType = img.type as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

      userContent.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: mediaType,
          data: base64Data,
        },
      });
    }

    // Add the user message with all content
    if (userContent.length > 0) {
      messages.push({
        role: 'user',
        content: userContent,
      });
    }

    const stream = new ReadableStream({
      async start(controller) {
        let keepaliveInterval: NodeJS.Timeout | null = null;
        let lastActivity = Date.now();

        // Keepalive function to prevent proxy timeouts
        const startKeepalive = () => {
          keepaliveInterval = setInterval(() => {
            const timeSinceActivity = Date.now() - lastActivity;
            if (timeSinceActivity > KEEPALIVE_INTERVAL_MS - 1000) {
              try {
                controller.enqueue(encoder.encode(' ')); // Invisible keepalive
                log.debug('Sent keepalive heartbeat');
              } catch {
                // Controller might be closed
              }
            }
          }, KEEPALIVE_INTERVAL_MS);
        };

        const stopKeepalive = () => {
          if (keepaliveInterval) {
            clearInterval(keepaliveInterval);
            keepaliveInterval = null;
          }
        };

        // Moved outside try block for error handler access
        let fullContent = '';

        try {
          // Build API parameters with optional extended thinking (Claude Code parity)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const apiParams: any = {
            model: selectedModel,
            max_tokens: 8192,
            system: systemPrompt,
            messages,
            stream: true,
          };

          // Add extended thinking if enabled (requires Sonnet or Opus with thinking support)
          if (
            thinkingEnabled &&
            (selectedModel.includes('sonnet') || selectedModel.includes('opus'))
          ) {
            // Extended thinking uses the thinking parameter
            // Note: Haiku doesn't support extended thinking
            apiParams.thinking = {
              type: 'enabled',
              budget_tokens: thinkingBudget,
            };
            // When thinking is enabled, max_tokens must be larger to accommodate thinking
            apiParams.max_tokens = Math.max(16000, thinkingBudget + 8192);
            log.info('Extended thinking enabled', { budget: thinkingBudget, model: selectedModel });
          }

          const response = await anthropic.messages.create(
            apiParams as Anthropic.MessageCreateParamsStreaming
          );

          // Start keepalive once stream is established
          startKeepalive();

          // Stream with timeout per chunk
          const iterator = (response as AsyncIterable<Anthropic.MessageStreamEvent>)[
            Symbol.asyncIterator
          ]();

          // Track real token usage from API
          let inputTokens = 0;
          let outputTokens = 0;
          let cacheReadTokens = 0;
          let cacheWriteTokens = 0;

          while (true) {
            const timeoutPromise = new Promise<{ done: true; value: undefined }>((_, reject) => {
              setTimeout(() => reject(new Error('Stream chunk timeout')), CHUNK_TIMEOUT_MS);
            });

            try {
              const result = await Promise.race([iterator.next(), timeoutPromise]);

              if (result.done) break;

              lastActivity = Date.now();
              const event = result.value;

              // Capture token usage from message events
              if (event.type === 'message_start' && event.message?.usage) {
                inputTokens = event.message.usage.input_tokens || 0;
                cacheReadTokens = event.message.usage.cache_read_input_tokens || 0;
                cacheWriteTokens = event.message.usage.cache_creation_input_tokens || 0;
              }

              if (event.type === 'message_delta' && event.usage) {
                outputTokens = event.usage.output_tokens || 0;
              }

              // Handle content block start to detect thinking blocks
              if (event.type === 'content_block_start') {
                const block = event.content_block;
                if (block && block.type === 'thinking') {
                  // Signal start of thinking block
                  controller.enqueue(encoder.encode('\n<!--THINKING_START-->'));
                }
              }

              // Handle content block stop
              if (event.type === 'content_block_stop') {
                // Check if this was a thinking block by looking at accumulated content
                if (
                  fullContent.includes('<!--THINKING_START-->') &&
                  !fullContent.includes('<!--THINKING_END-->')
                ) {
                  controller.enqueue(encoder.encode('<!--THINKING_END-->\n'));
                }
              }

              if (event.type === 'content_block_delta') {
                const delta = event.delta;
                // Handle regular text
                if ('text' in delta) {
                  fullContent += delta.text;
                  controller.enqueue(encoder.encode(delta.text));
                }
                // Handle thinking text (extended thinking feature)
                if ('thinking' in delta && typeof delta.thinking === 'string') {
                  fullContent += delta.thinking;
                  controller.enqueue(encoder.encode(delta.thinking));
                }
              }
            } catch (error) {
              if (error instanceof Error && error.message === 'Stream chunk timeout') {
                log.error('Stream chunk timeout - no data for 60s');
                controller.enqueue(
                  encoder.encode(
                    '\n\n*[Response interrupted: Connection timed out. Please try again.]*'
                  )
                );
              }
              throw error;
            }
          }

          // Send token usage as special marker at end of stream
          if (inputTokens > 0 || outputTokens > 0) {
            const usageMarker = `\n<!--USAGE:${JSON.stringify({
              input: inputTokens,
              output: outputTokens,
              cacheRead: cacheReadTokens,
              cacheWrite: cacheWriteTokens,
              model: selectedModel,
            })}-->`;
            controller.enqueue(encoder.encode(usageMarker));
            log.debug('Token usage', {
              inputTokens,
              outputTokens,
              cacheReadTokens,
              cacheWriteTokens,
            });
          }

          // Save assistant message
          await (supabase.from('code_lab_messages') as AnySupabase).insert({
            id: generateId(),
            session_id: sessionId,
            role: 'assistant',
            content: fullContent,
            created_at: new Date().toISOString(),
            type: useSearch ? 'search' : 'chat',
            model_id: selectedModel,
          });

          controller.close();
        } catch (error) {
          log.error('Stream error', error as Error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          const isTimeout = errorMessage.includes('timeout');
          const userMessage = isTimeout
            ? '\n\n*[Response interrupted: Connection timed out. Please try again.]*'
            : '\n\nI encountered an error. Please try again.';

          // Append error to accumulated content
          fullContent += userMessage;

          // CRITICAL FIX: Save assistant message even on error to maintain conversation history
          // Without this, history becomes misaligned (user message without assistant response)
          try {
            await (supabase.from('code_lab_messages') as AnySupabase).insert({
              id: generateId(),
              session_id: sessionId,
              role: 'assistant',
              content: fullContent || userMessage,
              created_at: new Date().toISOString(),
              type: 'error',
              model_id: selectedModel,
            });
          } catch (saveError) {
            log.error('Failed to save error message', saveError as Error);
          }

          controller.enqueue(encoder.encode(userMessage));
          controller.close();
        } finally {
          stopKeepalive();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    log.error('Request error', error as Error);
    return new Response('Internal server error', { status: 500 });
  }
}

// Vercel serverless configuration
export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for complex code generation
