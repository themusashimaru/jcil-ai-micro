/**
 * CODE COMMAND API ROUTE
 *
 * Premium coding assistant powered by GPT-5.1
 * Admin-only access for now
 *
 * Features:
 * - GPT-5.1 model for complex engineering tasks
 * - Software engineering optimized system prompt
 * - Streaming responses
 * - Admin authentication required
 */

import { NextRequest } from 'next/server';
import { streamText } from 'ai';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { buildFullCodeCommandPrompt } from '@/lib/prompts/codeCommandPrompt';
import { createOpenAI } from '@ai-sdk/openai';

// Initialize OpenAI provider
const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  compatibility: 'strict',
});

// GPT-5.1 model for Code Command
const CODE_COMMAND_MODEL = 'gpt-5.1';

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

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
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

    console.log('[Code Command] Processing request with GPT-5.1');
    console.log('[Code Command] User:', user.email);
    console.log('[Code Command] Message count:', messages.length);

    // Stream response using GPT-5.1
    const result = streamText({
      model: openai(CODE_COMMAND_MODEL),
      messages: messagesWithSystem,
      maxTokens: 4000, // Allow longer responses for code
      // Note: GPT-5.1 may not support temperature, so we omit it
      onFinish: async ({ text, usage }) => {
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
    });

    // Return streaming response
    return result.toDataStreamResponse();

  } catch (error) {
    console.error('[Code Command] Error:', error);

    // Check for specific OpenAI errors
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return new Response(
          JSON.stringify({ error: 'API configuration error' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }
      if (error.message.includes('model')) {
        return new Response(
          JSON.stringify({ error: 'Model not available. Please check GPT-5.1 access.' }),
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
