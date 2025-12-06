/**
 * CHAT API ROUTE - OpenAI GPT-5 Edition
 *
 * PURPOSE:
 * - Handle chat message requests with streaming responses
 * - Integrate with OpenAI API (GPT-5-nano/mini tiered routing)
 * - Route image generation to DALL-E 3
 *
 * MODEL ROUTING (GPT-5 Edition):
 * - gpt-5-nano: Basic chat, greetings, simple Q&A (cost-optimized)
 * - gpt-5-mini: Search, files, images, complex reasoning, code, AND fallback
 * - DALL-E 3: Image generation only
 *
 * PUBLIC ROUTES:
 * - POST /api/chat
 *
 * SECURITY/RLS NOTES:
 * - Input sanitization for prompts
 * - Rate limiting
 * - Content moderation
 * - Admin bypass for limits
 *
 * DEPENDENCIES/ENVS:
 * - OPENAI_API_KEY (required)
 * - NEXT_PUBLIC_SUPABASE_URL (optional, for auth)
 *
 * FEATURES:
 * - ✅ Streaming responses with SSE
 * - ✅ GPT-5-nano/mini tiered routing with auto-escalation
 * - ✅ Image generation with DALL-E 3
 * - ✅ Tool-specific system prompts
 * - ✅ Temperature and token optimization per tool
 * - ✅ Retry logic with exponential backoff
 * - ✅ Admin bypass for rate/usage limits
 *
 * TODO:
 * - [ ] Add authentication
 * - [✓] Implement rate limiting (60/hr auth, 20/hr anon)
 * - [ ] Store messages in database
 * - [✓] Add content moderation (OpenAI omni-moderation-latest)
 * - [✓] Implement usage tracking (daily limits with 80% warning)
 */

import { createChatCompletion, shouldUseWebSearch, getLastUserMessageText } from '@/lib/openai/client';
import { getModelForTool } from '@/lib/openai/models';
import { moderateContent } from '@/lib/openai/moderation';
import { generateImageWithFallback, ImageSize } from '@/lib/openai/images';
import { buildFullSystemPrompt } from '@/lib/prompts/systemPrompt';
import { incrementUsage, getLimitWarningMessage, incrementImageUsage, getImageLimitWarningMessage } from '@/lib/limits';
import { decideRoute, logRouteDecision, parseSizeFromText } from '@/lib/routing/decideRoute';
import { NextRequest } from 'next/server';
import { CoreMessage } from 'ai';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// Rate limits per hour
const RATE_LIMIT_AUTHENTICATED = 60; // 60 messages/hour for logged-in users
const RATE_LIMIT_ANONYMOUS = 20; // 20 messages/hour for anonymous users

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return null; // Rate limiting disabled if not configured
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

async function checkChatRateLimit(
  identifier: string,
  isAuthenticated: boolean
): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    // If Supabase admin not configured, allow request (graceful degradation)
    return { allowed: true, remaining: -1, resetIn: 0 };
  }

  const limit = isAuthenticated ? RATE_LIMIT_AUTHENTICATED : RATE_LIMIT_ANONYMOUS;
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  try {
    // Count recent chat messages from this identifier
    const { count, error } = await supabase
      .from('rate_limits')
      .select('*', { count: 'exact', head: true })
      .eq('identifier', identifier)
      .eq('action', 'chat_message')
      .gte('created_at', oneHourAgo);

    if (error) {
      console.error('[Chat API] Rate limit check error:', error);
      // Allow request on error (fail open for availability)
      return { allowed: true, remaining: -1, resetIn: 0 };
    }

    const currentCount = count || 0;
    const remaining = Math.max(0, limit - currentCount - 1);

    if (currentCount >= limit) {
      // Get the oldest rate limit entry to calculate reset time
      const { data: oldestEntry } = await supabase
        .from('rate_limits')
        .select('created_at')
        .eq('identifier', identifier)
        .eq('action', 'chat_message')
        .gte('created_at', oneHourAgo)
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

      const resetIn = oldestEntry
        ? Math.ceil((new Date(oldestEntry.created_at).getTime() + 60 * 60 * 1000 - Date.now()) / 1000)
        : 3600;

      return { allowed: false, remaining: 0, resetIn };
    }

    // Record this request
    await supabase.from('rate_limits').insert({
      identifier,
      action: 'chat_message',
    });

    return { allowed: true, remaining, resetIn: 0 };
  } catch (error) {
    console.error('[Chat API] Rate limit error:', error);
    // Allow request on error
    return { allowed: true, remaining: -1, resetIn: 0 };
  }
}

interface UserContext {
  name: string;
  role: 'student' | 'professional';
  field?: string;
  purpose?: string;
}

interface ChatRequestBody {
  messages: CoreMessage[];
  tool?: string;
  temperature?: number;
  max_tokens?: number;
  userContext?: UserContext;
  conversationId?: string; // Current conversation ID to exclude from history
}

// Detect if user is asking about previous conversations
function isAskingAboutHistory(content: string): boolean {
  const lowerContent = content.toLowerCase();

  const historyPatterns = [
    /what (did|have|were) (we|i) (talk|discuss|chat)(ed)? about/i,
    /previous (conversation|chat|discussion)s?/i,
    /earlier (conversation|chat|discussion)s?/i,
    /our (past|last|recent) (conversation|chat|discussion)s?/i,
    /(show|tell|list) (me )?(my |the |our )?(previous|past|recent|earlier|last) (conversation|chat|discussion)s?/i,
    /what (was|were) (we|i) (talking|chatting|discussing) about/i,
    /(summarize|summary of) (my |our )?(previous|past|recent|earlier) (conversation|chat|discussion)s?/i,
    /history of (our|my) (conversation|chat|discussion)s?/i,
    /(remember|recall) (our|my) (previous|past|earlier) (conversation|chat|discussion)/i,
    /in (our|my) (previous|past|last|earlier) (conversation|chat|discussion)/i,
    /last (two|three|few|several) (conversation|chat|discussion)s?/i,
    /past (two|three|few|several) (conversation|chat|discussion)s?/i,
    /(yesterday|last week|last time|before)/i,
  ];

  return historyPatterns.some(pattern => pattern.test(lowerContent));
}

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body: ChatRequestBody = await request.json();
    const { messages, tool, temperature, max_tokens, userContext, conversationId } = body;

    // Validate messages
    if (!messages || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Messages are required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Check rate limiting
    // Get user auth status and identifier for rate limiting
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
            getAll() {
              return cookieStore.getAll();
            },
            setAll(cookiesToSet) {
              try {
                cookiesToSet.forEach(({ name, value, options }) =>
                  cookieStore.set(name, value, options)
                );
              } catch {
                // Silently handle cookie errors
              }
            },
          },
        }
      );

      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        rateLimitIdentifier = user.id;
        isAuthenticated = true;

        // Check if user is admin for bypass
        const { data: userData } = await supabase
          .from('users')
          .select('is_admin')
          .eq('id', user.id)
          .single();

        isAdmin = userData?.is_admin === true;
      } else {
        // Fall back to IP for anonymous users
        rateLimitIdentifier = request.headers.get('x-forwarded-for')?.split(',')[0] ||
                              request.headers.get('x-real-ip') ||
                              'anonymous';
      }
    } catch {
      // If auth check fails, use IP
      rateLimitIdentifier = request.headers.get('x-forwarded-for')?.split(',')[0] ||
                            request.headers.get('x-real-ip') ||
                            'anonymous';
    }

    // Admin bypass: skip rate limiting and usage limits for admins
    if (!isAdmin) {
      // Check rate limit
      const rateLimit = await checkChatRateLimit(rateLimitIdentifier, isAuthenticated);

      if (!rateLimit.allowed) {
        console.log(`[Chat API] Rate limit exceeded for ${isAuthenticated ? 'user' : 'IP'}: ${rateLimitIdentifier}`);
        return new Response(
          JSON.stringify({
            error: 'Rate limit exceeded',
            message: `You've sent a high volume of messages. Please wait ${Math.ceil(rateLimit.resetIn / 60)} minutes before continuing. This helps ensure quality service for all users.`,
            retryAfter: rateLimit.resetIn,
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': String(rateLimit.resetIn),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': String(Math.ceil(Date.now() / 1000) + rateLimit.resetIn),
            },
          }
        );
      }

      // Check daily usage limits (warn at 80%, stop at 100%)
      const usage = await incrementUsage(rateLimitIdentifier, isAuthenticated ? 'basic' : 'free');

      if (usage.stop) {
        console.log(`[Chat API] Daily limit reached for ${isAuthenticated ? 'user' : 'anon'}: ${rateLimitIdentifier}`);
        return new Response(
          JSON.stringify({
            error: 'Daily limit reached',
            message: getLimitWarningMessage(usage),
            usage: { used: usage.used, limit: usage.limit, remaining: 0 },
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'X-Usage-Limit': String(usage.limit),
              'X-Usage-Remaining': '0',
            },
          }
        );
      }
    } else {
      console.log(`[Chat API] Admin bypass for user: ${rateLimitIdentifier}`);
    }

    // Moderate user messages before sending to OpenAI
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.role === 'user') {
      // Extract only text content for moderation (not image data)
      let messageContent: string;
      if (typeof lastMessage.content === 'string') {
        messageContent = lastMessage.content;
      } else if (Array.isArray(lastMessage.content)) {
        // Extract text parts only from multimodal messages
        messageContent = lastMessage.content
          .filter((part: { type: string }) => part.type === 'text')
          .map((part: { type: string; text?: string }) => part.text || '')
          .join(' ');
      } else {
        messageContent = '';
      }

      // Only moderate if there's actual text content
      if (messageContent.trim()) {
        const moderationResult = await moderateContent(messageContent);

        if (moderationResult.flagged) {
          return new Response(
            JSON.stringify({
              type: 'text',
              content: moderationResult.message || 'Your message violates our content policy. Please rephrase your request in a respectful and appropriate manner.',
              moderated: true,
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }
      }
      // If no text content (image-only), skip text moderation
    }

    // Check if user is asking about previous conversations
    let conversationHistory = '';
    const lastUserMessage = messages[messages.length - 1];
    // Extract text content for history detection (handle both string and array formats)
    let lastUserContent = '';
    if (typeof lastUserMessage?.content === 'string') {
      lastUserContent = lastUserMessage.content;
    } else if (Array.isArray(lastUserMessage?.content)) {
      lastUserContent = lastUserMessage.content
        .filter((part: { type: string }) => part.type === 'text')
        .map((part: { type: string; text?: string }) => part.text || '')
        .join(' ');
    }

    if (lastUserContent && isAskingAboutHistory(lastUserContent)) {
      try {
        // Get authenticated Supabase client
        const cookieStore = await cookies();
        const supabase = createServerClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          {
            cookies: {
              getAll() {
                return cookieStore.getAll();
              },
              setAll(cookiesToSet) {
                try {
                  cookiesToSet.forEach(({ name, value, options }) =>
                    cookieStore.set(name, value, options)
                  );
                } catch {
                  // Silently handle cookie errors
                }
              },
            },
          }
        );

        // Get authenticated user
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          // Fetch recent conversations (exclude current conversation)
          let query = supabase
            .from('conversations')
            .select('id, title, tool_context, created_at, last_message_at')
            .eq('user_id', user.id)
            .is('deleted_at', null)
            .order('last_message_at', { ascending: false })
            .limit(10);

          if (conversationId) {
            query = query.neq('id', conversationId);
          }

          const { data: conversations } = await query;

          if (conversations && conversations.length > 0) {
            // Fetch messages for each conversation
            const conversationsWithMessages = await Promise.all(
              conversations.map(async (conv) => {
                const { data: msgs } = await supabase
                  .from('messages')
                  .select('role, content, content_type, created_at')
                  .eq('conversation_id', conv.id)
                  .is('deleted_at', null)
                  .order('created_at', { ascending: true })
                  .limit(10);

                return {
                  title: conv.title,
                  date: new Date(conv.last_message_at).toLocaleDateString(),
                  messages: msgs || [],
                };
              })
            );

            // Format conversation history for AI context
            conversationHistory = '\n\n=== PREVIOUS CONVERSATIONS ===\n\n';
            conversationHistory += conversationsWithMessages
              .map((conv) => {
                const messagesSummary = conv.messages
                  .slice(0, 5) // Limit to first 5 messages per conversation
                  .map((msg) => `${msg.role}: ${msg.content.slice(0, 200)}`)
                  .join('\n');

                return `Conversation: "${conv.title}" (${conv.date})\n${messagesSummary}`;
              })
              .join('\n\n---\n\n');

            conversationHistory += '\n\n=== END OF PREVIOUS CONVERSATIONS ===\n';
          }
        }
      } catch (error) {
        console.error('Error fetching conversation history:', error);
        // Continue without history if there's an error
      }
    }

    // ========================================
    // UNIFIED FILE ROUTING (Chat + Button)
    // ========================================
    // Check if the message contains uploaded images (for analysis)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messageHasUploadedImages = messages.some((msg: any) =>
      Array.isArray(msg.content) &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      msg.content.some((item: any) => item.type === 'image_url' || item.type === 'image')
    );

    // Check if the message contains file attachments (PDFs, Excel, CSV, etc.)
    // These are embedded as text with [File: ...] or [Document: ...] markers
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messageHasFileAttachments = messages.some((msg: any) => {
      const content = typeof msg.content === 'string' ? msg.content : '';
      return content.includes('[File:') ||
             content.includes('[Document:') ||
             content.includes('[Spreadsheet:') ||
             content.includes('data:application/pdf') ||
             content.includes('data:application/vnd');
    });

    // Route to gpt-5-mini for ANY file upload (images, PDFs, Excel, etc.)
    // Mini is smarter and better suited for file analysis tasks
    const hasFileUploads = messageHasUploadedImages || messageHasFileAttachments;

    // Only route to image generation if there are NO uploaded files
    // (uploaded files = user wants analysis, not generation)
    // Files always route to gpt-5-mini for better analysis
    const routeDecision = hasFileUploads
      ? { target: 'mini' as const, reason: messageHasUploadedImages ? 'image-analysis' as const : 'file-analysis' as const, confidence: 1.0 }
      : decideRoute(lastUserContent, tool);

    // Log the routing decision for telemetry
    logRouteDecision(rateLimitIdentifier, routeDecision, lastUserContent);

    if (messageHasUploadedImages) {
      console.log('[Chat API] Detected uploaded image - routing to gpt-5-mini for analysis');
    } else if (messageHasFileAttachments) {
      console.log('[Chat API] Detected file attachment - routing to gpt-5-mini for analysis');
    }

    // Check if we should route to image generation (only if no uploaded images)
    if (routeDecision.target === 'image' && !messageHasUploadedImages) {
      // Check image-specific daily limits (warn at 80%, stop at 100%)
      const imageUsage = await incrementImageUsage(
        rateLimitIdentifier,
        isAuthenticated ? 'basic' : 'free'
      );

      if (imageUsage.stop) {
        console.log('[Chat API] Image limit reached for:', rateLimitIdentifier);
        return new Response(
          JSON.stringify({
            error: 'Daily image limit reached',
            message: getImageLimitWarningMessage(imageUsage),
            usage: { used: imageUsage.used, limit: imageUsage.limit, remaining: 0 },
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'X-Image-Limit': String(imageUsage.limit),
              'X-Image-Remaining': '0',
            },
          }
        );
      }

      // Extract prompt from last message
      const lastMessage = messages[messages.length - 1];
      let prompt = typeof lastMessage.content === 'string'
        ? lastMessage.content
        : '';

      // Clean up prompt if it starts with emoji prefix from button
      if (prompt.startsWith('🎨 Generate image:')) {
        prompt = prompt.replace(/^🎨\s*Generate image:\s*/i, '').trim();
      }

      // Parse size from user text (supports 256, 512, 1024)
      const size: ImageSize = parseSizeFromText(prompt);

      // Log image request with user, model, promptHash, size
      const promptHash = prompt.slice(0, 32).replace(/\s+/g, '_');
      console.log('[Chat API] Image generation request:', {
        user_id: rateLimitIdentifier,
        type: 'image',
        model: 'dall-e-3',
        promptHash,
        size,
        reason: routeDecision.reason,
        confidence: routeDecision.confidence,
        imageUsage: {
          used: imageUsage.used,
          limit: imageUsage.limit,
          warn: imageUsage.warn,
        },
      });

      // Use new fallback-enabled image generation
      const startTime = Date.now();
      const imageResult = await generateImageWithFallback(prompt, size, rateLimitIdentifier);
      const latencyMs = Date.now() - startTime;

      // Log completion
      console.log('[Chat API] Image generation complete:', {
        user_id: rateLimitIdentifier,
        type: 'image',
        model: 'dall-e-3',
        promptHash,
        size,
        ok: imageResult.ok,
        latency_ms: latencyMs,
      });

      if (imageResult.ok) {
        // Include usage warning if at 80%
        const usageWarning = getImageLimitWarningMessage(imageUsage);

        return new Response(
          JSON.stringify({
            type: 'image',
            url: imageResult.image,
            prompt,
            model: imageResult.model,
            size: imageResult.size,
            routeReason: routeDecision.reason,
            ...(usageWarning && { usageWarning }),
            usage: {
              used: imageUsage.used,
              limit: imageUsage.limit,
              remaining: imageUsage.remaining,
            },
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'X-Route-Target': 'image',
              'X-Route-Reason': routeDecision.reason,
              'X-Model-Used': imageResult.model || 'dall-e-3',
              'X-Image-Remaining': String(imageUsage.remaining),
            },
          }
        );
      } else {
        // Return text fallback instead of error
        return new Response(
          JSON.stringify({
            type: 'image_fallback',
            content: imageResult.fallbackText,
            retryHint: imageResult.retryHint,
            suggestedPrompts: imageResult.suggestedPrompts,
            error: imageResult.error,
            routeReason: routeDecision.reason,
          }),
          {
            status: 200, // 200 because we're providing useful fallback content
            headers: {
              'Content-Type': 'application/json',
              'X-Route-Target': 'image',
              'X-Route-Reason': routeDecision.reason,
            },
          }
        );
      }
    }

    // Add user context and conversation history as system messages if provided
    let messagesWithContext = messages;

    // Add conversation history context if available
    if (conversationHistory) {
      const historySystemMessage = {
        role: 'system' as const,
        content: `The user has asked about their previous conversations. Here is their conversation history (only accessible when specifically requested):${conversationHistory}\n\nUse this history to answer their question accurately. If they ask about something not in this history, let them know you can only see the conversations listed above.`,
      };
      messagesWithContext = [historySystemMessage, ...messagesWithContext];
    }

    // Add user context if provided
    if (userContext) {
      const userContextMessage = {
        role: 'system' as const,
        content: `You are assisting ${userContext.name}, a ${userContext.role}${userContext.field ? ` in ${userContext.field}` : ''}. ${userContext.purpose ? `They use this AI for: ${userContext.purpose}. ` : ''}Tailor your responses to their background, adjusting complexity, terminology, and examples accordingly.`,
      };
      messagesWithContext = [userContextMessage, ...messagesWithContext];
    }

    // Add Slingshot 2.0 system prompt for authenticated users
    // This includes routing logic and behavior guidelines
    const effectiveTool = tool;

    if (isAuthenticated) {
      const slingshotPrompt = buildFullSystemPrompt({
        includeImageCapability: true,
      });

      const slingshotSystemMessage = {
        role: 'system' as const,
        content: slingshotPrompt,
      };
      messagesWithContext = [slingshotSystemMessage, ...messagesWithContext];
    }

    // Check if any message contains images (need non-streaming for image analysis)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hasImages = messagesWithContext.some((msg: any) =>
      Array.isArray(msg.content) &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      msg.content.some((item: any) => item.type === 'image_url' || item.type === 'image')
    );

    // Log messages for debugging
    console.log('[Chat API] Processing request:', {
      messageCount: messagesWithContext.length,
      hasImages,
      streaming: !hasImages,
      effectiveTool,
    });

    // Get the initial model (may be overridden by web search routing)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const initialModel = getModelForTool(effectiveTool as any);

    // Check if web search will be triggered - this always uses gpt-5-mini
    const lastUserText = getLastUserMessageText(messagesWithContext);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const willUseWebSearch = shouldUseWebSearch(effectiveTool as any, lastUserText);

    // Determine actual model: web search, images, and file attachments all use mini
    // Mini is the smarter model, better suited for complex analysis tasks
    const actualModel = willUseWebSearch || hasImages || messageHasFileAttachments
      ? 'gpt-5-mini'
      : initialModel;

    // Use non-streaming for image analysis (images need special handling)
    if (hasImages) {
      console.log('[Chat API] Using non-streaming mode for image analysis - routing to gpt-5-mini');
      console.log('[Chat API] Messages being sent:', JSON.stringify(messagesWithContext.slice(-2).map(m => ({
        role: m.role,
        hasArrayContent: Array.isArray(m.content),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        contentTypes: Array.isArray(m.content) ? m.content.map((c: any) => c.type) : 'string',
      }))));
      const result = await createChatCompletion({
        messages: messagesWithContext,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tool: effectiveTool as any,
        temperature,
        maxTokens: max_tokens,
        stream: false,
        userId: isAuthenticated ? rateLimitIdentifier : undefined,
        conversationId: conversationId,
      });

      // Extract citations and actual model used from result
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const citations = (result as any).citations || [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const numSourcesUsed = (result as any).numSourcesUsed || 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const resultModel = (result as any).model || actualModel;

      console.log('[Chat API] Image analysis complete, model used:', resultModel);

      return new Response(
        JSON.stringify({
          type: 'text',
          content: result.text,
          model: resultModel,
          citations: citations,
          sourcesUsed: numSourcesUsed,
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-Model-Used': resultModel,
            'X-Tool-Type': effectiveTool || 'default',
            'X-Has-Images': 'true',
          },
        }
      );
    }

    // Use streaming for regular text chat
    console.log('[Chat API] Using streaming mode with model:', actualModel, 'webSearch:', willUseWebSearch);

    try {
      console.log('[Chat API] Calling createChatCompletion with stream: true');
      const result = await createChatCompletion({
        messages: messagesWithContext,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tool: effectiveTool as any,
        temperature,
        maxTokens: max_tokens,
        stream: true,
        userId: isAuthenticated ? rateLimitIdentifier : undefined,
        conversationId: conversationId,
      });

      console.log('[Chat API] streamText returned, result type:', typeof result);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      console.log('[Chat API] result has toTextStreamResponse:', typeof (result as any).toTextStreamResponse);

      // Check if result is a streaming object (has toTextStreamResponse method)
      // Web search and some other operations return non-streaming results
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (typeof (result as any).toTextStreamResponse === 'function') {
        // Return streaming response using simple text stream
        // AI SDK v5 uses toTextStreamResponse instead of toDataStreamResponse
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const streamResponse = (result as any).toTextStreamResponse({
          headers: {
            'X-Model-Used': actualModel,
            'X-Tool-Type': effectiveTool || 'default',
          },
        });

        console.log('[Chat API] Successfully created stream response with model:', actualModel);
        return streamResponse;
      } else {
        // Non-streaming result (from web search, etc.)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const resultModel = (result as any).model || actualModel;
        console.log('[Chat API] Non-streaming result detected, model used:', resultModel);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const citations = (result as any).citations || [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const numSourcesUsed = (result as any).numSourcesUsed || 0;

        // Convert citation objects to URLs for client compatibility
        const citationUrls = citations.map((c: { url?: string } | string) =>
          typeof c === 'string' ? c : c.url || ''
        ).filter(Boolean);

        return new Response(
          JSON.stringify({
            type: 'text',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            content: (result as any).text || '',
            model: resultModel,
            citations: citationUrls,
            sourcesUsed: numSourcesUsed,
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'X-Model-Used': resultModel,
              'X-Tool-Type': effectiveTool || 'default',
            },
          }
        );
      }
    } catch (streamError) {
      // If streaming fails, fall back to non-streaming
      // Log detailed error info to diagnose streaming issues
      console.error('[Chat API] Streaming failed, falling back to non-streaming');
      if (streamError instanceof Error) {
        console.error('[Chat API] Error name:', streamError.name);
        console.error('[Chat API] Error message:', streamError.message);
        console.error('[Chat API] Error stack:', streamError.stack);
        // Check for API-specific error details
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const anyError = streamError as any;
        if (anyError.cause) console.error('[Chat API] Error cause:', anyError.cause);
        if (anyError.status) console.error('[Chat API] Error status:', anyError.status);
        if (anyError.statusCode) console.error('[Chat API] Error statusCode:', anyError.statusCode);
        if (anyError.response) console.error('[Chat API] Error response:', anyError.response);
      } else {
        console.error('[Chat API] Non-Error thrown:', streamError);
      }

      const result = await createChatCompletion({
        messages: messagesWithContext,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tool: effectiveTool as any,
        temperature,
        maxTokens: max_tokens,
        stream: false,
        userId: isAuthenticated ? rateLimitIdentifier : undefined,
        conversationId: conversationId,
      });

      // Extract citations and actual model used from result
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawCitations = (result as any).citations || [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const numSourcesUsed = (result as any).numSourcesUsed || 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fallbackModel = (result as any).model || actualModel;

      // Convert citation objects to URLs for client compatibility
      const citationUrls = rawCitations.map((c: { url?: string } | string) =>
        typeof c === 'string' ? c : c.url || ''
      ).filter(Boolean);

      return new Response(
        JSON.stringify({
          type: 'text',
          content: result.text,
          model: fallbackModel,
          citations: citationUrls,
          sourcesUsed: numSourcesUsed,
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-Model-Used': fallbackModel,
            'X-Tool-Type': effectiveTool || 'default',
          },
        }
      );
    }
  } catch (error) {
    // Check if this is an abort error (user navigated away)
    const isAbortError = error instanceof Error && (
      error.name === 'AbortError' ||
      error.message.toLowerCase().includes('aborted') ||
      error.message.toLowerCase().includes('socket hang up') ||
      error.message.toLowerCase().includes('client disconnected') ||
      error.message.toLowerCase().includes('connection closed')
    );

    if (isAbortError) {
      // User navigated away - this is not an error condition
      // The onFinish callback will still save the message if OpenAI completed
      console.log('[Chat API] Client disconnected (user navigated away) - response may still be saved via onFinish');
      return new Response(null, { status: 499 }); // 499 = Client Closed Request
    }

    console.error('Chat API error:', error);

    // Log detailed error info
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      // Log the full error object for debugging
      console.error('Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    }

    // Return user-friendly error (keep technical details in server logs only)
    return new Response(
      JSON.stringify({
        error: 'Service temporarily unavailable',
        message: 'Due to high traffic, please try again in a few seconds.',
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

// Use Node.js runtime for better streaming support and logging
// Edge runtime can have issues with streaming responses
export const runtime = 'nodejs';
export const maxDuration = 120; // Allow up to 120 seconds for AI responses (Pro plan supports up to 300s)
