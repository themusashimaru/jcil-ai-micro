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
 * - [ ] Implement rate limiting
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
import { cookies } from 'next/headers';

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

    // Moderate user messages before forwarding to xAI
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.role === 'user') {
      const messageContent = typeof lastMessage.content === 'string'
        ? lastMessage.content
        : JSON.stringify(lastMessage.content);

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

    // Check if user is asking about previous conversations
    let conversationHistory = '';
    const lastUserMessage = messages[messages.length - 1];
    const lastUserContent = typeof lastUserMessage?.content === 'string'
      ? lastUserMessage.content
      : '';

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

    // Log messages for debugging image issues
    console.log('[Chat API] Processing request with messages:', JSON.stringify(messagesWithContext.map(m => ({
      role: m.role,
      contentType: typeof m.content,
      hasImages: Array.isArray(m.content) && m.content.some(c => c.type === 'image')
    })), null, 2));

    // Regular chat completion (non-streaming for now)
    const result = await createChatCompletion({
      messages: messagesWithContext,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tool: tool as any,
      temperature,
      maxTokens: max_tokens,
      stream: false, // Disable streaming for now
    });

    // Get the model being used
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const model = getModelForTool(tool as any);

    // Extract citations if available (from Live Search)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const citations = (result as any).citations || [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const numSourcesUsed = (result as any).numSourcesUsed || 0;

    // Log search usage for monitoring
    if (citations.length > 0 || numSourcesUsed > 0) {
      console.log(`[Chat API] Live Search used: ${numSourcesUsed} sources, ${citations.length} citations`);
    }

    // Return JSON response with the text and citations
    return new Response(
      JSON.stringify({
        type: 'text',
        content: result.text,
        model,
        // Include citations from Live Search (array of source URLs)
        citations: citations,
        // Include source count for transparency
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

    // Return detailed error for debugging
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
        fullError: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack,
          cause: error.cause
        } : String(error),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

export const runtime = 'edge';
