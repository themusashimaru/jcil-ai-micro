/**
 * CHAT API ROUTE - xAI Streaming Integration
 *
 * PURPOSE:
 * - Handle chat message requests with streaming responses
 * - Integrate with xAI API (Grok models)
 * - Support agentic tool calling (web search, code execution, etc.)
 * - Route to appropriate models based on tool type
 *
 * PUBLIC ROUTES:
 * - POST /api/chat
 *
 * SECURITY/RLS NOTES:
 * - Input sanitization for prompts
 * - Rate limiting (TODO)
 * - Content moderation (TODO)
 *
 * DEPENDENCIES/ENVS:
 * - XAI_API_KEY (required)
 * - NEXT_PUBLIC_SUPABASE_URL (optional, for future auth)
 *
 * FEATURES:
 * - ✅ Streaming responses with SSE
 * - ✅ Model routing (chat/code/image)
 * - ✅ Agentic tool calling (web_search, x_search, code_execution)
 * - ✅ Tool-specific system prompts
 * - ✅ Temperature and token optimization per tool
 *
 * TODO:
 * - [ ] Add authentication
 * - [✓] Implement rate limiting (60/hr auth, 20/hr anon)
 * - [ ] Store messages in database
 * - [✓] Add content moderation (OpenAI omni-moderation-latest)
 * - [ ] Implement usage tracking
 */

import { createChatCompletion, generateImage } from '@/lib/xai/client';
import { getModelForTool } from '@/lib/xai/models';
import { moderateContent } from '@/lib/openai/moderation';
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

    // Check rate limit
    const rateLimit = await checkChatRateLimit(rateLimitIdentifier, isAuthenticated);

    if (!rateLimit.allowed) {
      console.log(`[Chat API] Rate limit exceeded for ${isAuthenticated ? 'user' : 'IP'}: ${rateLimitIdentifier}`);
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          message: `You've sent too many messages. Please wait ${Math.ceil(rateLimit.resetIn / 60)} minutes before trying again.`,
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

    // Moderate user messages before forwarding to xAI
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

    // Check if this is an image generation request
    if (tool === 'image' || tool === 'video') {
      // Extract prompt from last message
      const lastMessage = messages[messages.length - 1];
      const prompt = typeof lastMessage.content === 'string'
        ? lastMessage.content
        : '';

      try {
        const imageUrl = await generateImage(prompt);

        return new Response(
          JSON.stringify({
            type: 'image',
            url: imageUrl,
            model: 'grok-2-image-1212',
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      } catch (error) {
        console.error('Image generation error:', error);
        return new Response(
          JSON.stringify({
            error: 'Image generation failed',
            details: error instanceof Error ? error.message : 'Unknown error',
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
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
    });

    // Get the model being used
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const model = getModelForTool(tool as any);

    // Use non-streaming for image analysis (images need special handling)
    if (hasImages) {
      console.log('[Chat API] Using non-streaming mode for image analysis');
      const result = await createChatCompletion({
        messages: messagesWithContext,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tool: tool as any,
        temperature,
        maxTokens: max_tokens,
        stream: false,
      });

      // Extract citations if available
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const citations = (result as any).citations || [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const numSourcesUsed = (result as any).numSourcesUsed || 0;

      return new Response(
        JSON.stringify({
          type: 'text',
          content: result.text,
          model,
          citations: citations,
          sourcesUsed: numSourcesUsed,
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-Model-Used': model,
            'X-Tool-Type': tool || 'default',
          },
        }
      );
    }

    // Use streaming for regular text chat
    console.log('[Chat API] Using streaming mode');

    try {
      const result = await createChatCompletion({
        messages: messagesWithContext,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tool: tool as any,
        temperature,
        maxTokens: max_tokens,
        stream: true,
      });

      // Return streaming response using Vercel AI SDK's data stream format
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (result as any).toDataStreamResponse({
        headers: {
          'X-Model-Used': model,
          'X-Tool-Type': tool || 'default',
        },
      });
    } catch (streamError) {
      // If streaming fails, fall back to non-streaming
      console.error('[Chat API] Streaming failed, falling back to non-streaming:', streamError);

      const result = await createChatCompletion({
        messages: messagesWithContext,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tool: tool as any,
        temperature,
        maxTokens: max_tokens,
        stream: false,
      });

      // Extract citations if available
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const citations = (result as any).citations || [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const numSourcesUsed = (result as any).numSourcesUsed || 0;

      return new Response(
        JSON.stringify({
          type: 'text',
          content: result.text,
          model,
          citations: citations,
          sourcesUsed: numSourcesUsed,
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'X-Model-Used': model,
            'X-Tool-Type': tool || 'default',
          },
        }
      );
    }
  } catch (error) {
    console.error('Chat API error:', error);

    // Log detailed error info
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      // Log the full error object for debugging
      console.error('Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    }

    // Check for specific error types
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return new Response(
          JSON.stringify({
            error: 'API configuration error',
            details: 'XAI_API_KEY is not configured',
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // Return generic error to client (detailed info already logged server-side)
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: 'An unexpected error occurred. Please try again.',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

export const runtime = 'edge';
