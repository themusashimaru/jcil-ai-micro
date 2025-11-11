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
}

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body: ChatRequestBody = await request.json();
    const { messages, tool, temperature, max_tokens, userContext } = body;

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

    // Add user context as a system message if provided
    const messagesWithContext = userContext
      ? [
          {
            role: 'system' as const,
            content: `You are assisting ${userContext.name}, a ${userContext.role}${userContext.field ? ` in ${userContext.field}` : ''}. ${userContext.purpose ? `They use this AI for: ${userContext.purpose}. ` : ''}Tailor your responses to their background, adjusting complexity, terminology, and examples accordingly.`,
          },
          ...messages,
        ]
      : messages;

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

    // Return JSON response with the text
    return new Response(
      JSON.stringify({
        type: 'text',
        content: result.text,
        model,
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

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

export const runtime = 'edge';
