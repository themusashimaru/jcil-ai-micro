/**
 * CODE COMMAND API ROUTE
 *
 * Premium coding assistant powered by Claude Opus 4
 * Admin-only access for now
 *
 * Features:
 * - Claude Opus 4 model for complex engineering tasks
 * - Software engineering optimized system prompt
 * - Streaming responses
 * - Admin authentication required
 */

import { NextRequest } from 'next/server';
import { streamText } from 'ai';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { buildFullCodeCommandPrompt } from '@/lib/prompts/codeCommandPrompt';
import { createAnthropic } from '@ai-sdk/anthropic';

// Initialize Anthropic provider
const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Claude Opus 4 model for Code Command (best for complex engineering tasks)
const CODE_COMMAND_MODEL = 'claude-opus-4-5-20251101';

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { messages, conversationId } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Messages are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client for auth check
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
              // Ignore errors in read-only contexts
            }
          },
        },
      }
    );

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin (using admin_users table, same as is-admin endpoint)
    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!adminUser) {
      return new Response(
        JSON.stringify({ error: 'Admin access required for Code Command' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Build system prompt for Code Command
    const systemPrompt = buildFullCodeCommandPrompt();

    // Prepare messages with system prompt
    const messagesWithSystem = [
      { role: 'system' as const, content: systemPrompt },
      ...messages.map((msg: { role: string; content: string }) => ({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
      })),
    ];

    console.log('[Code Command] Processing request with Claude Opus 4');
    console.log('[Code Command] User:', user.email);
    console.log('[Code Command] Message count:', messages.length);

    // Stream response using Claude Opus 4
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const requestConfig: any = {
      model: anthropic(CODE_COMMAND_MODEL),
      messages: messagesWithSystem,
      maxTokens: 8192, // Allow longer responses for code (Claude supports more)
      onFinish: async ({ text, usage }: { text?: string; usage?: { promptTokens?: number; completionTokens?: number } }) => {
        // Log usage for admin tracking
        console.log('[Code Command] Response complete');
        console.log('[Code Command] Usage:', usage);

        // Save to database if conversationId provided
        if (conversationId && text) {
          try {
            await supabase.from('messages').insert({
              conversation_id: conversationId,
              role: 'assistant',
              content: text,
              user_id: user.id,
            });
            console.log('[Code Command] Message saved to conversation:', conversationId);
          } catch (saveError) {
            console.error('[Code Command] Failed to save message:', saveError);
          }
        }
      },
    };
    const result = streamText(requestConfig);

    // Return streaming response (AI SDK v5 uses toTextStreamResponse)
    return result.toTextStreamResponse();

  } catch (error) {
    console.error('[Code Command] Error:', error);

    // Check for specific Anthropic errors
    if (error instanceof Error) {
      if (error.message.includes('API key') || error.message.includes('api_key')) {
        return new Response(
          JSON.stringify({ error: 'API configuration error' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (error.message.includes('model') || error.message.includes('rate_limit')) {
        return new Response(
          JSON.stringify({ error: 'Model not available or rate limited. Please try again.' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: 'Failed to process Code Command request' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// Use Node.js runtime for streaming support
export const runtime = 'nodejs';
export const maxDuration = 120; // Allow longer for complex code tasks
