/**
 * GENERATE CHAT TITLE API
 *
 * PURPOSE:
 * - Generate descriptive chat titles based on conversation content
 * - Called after first message exchange in a chat
 * - Creates concise, meaningful titles (3-6 words)
 */

import { createChatCompletion } from '@/lib/openai/client';
import { NextRequest } from 'next/server';

interface GenerateTitleRequest {
  userMessage: string;
  assistantMessage: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateTitleRequest = await request.json();
    const userMessage = body?.userMessage || '';
    const assistantMessage = body?.assistantMessage || '';

    console.log('[API] Generate title request:', {
      userMessage: userMessage.slice(0, 100),
      assistantMessage: assistantMessage.slice(0, 100),
    });

    if (!userMessage.trim()) {
      console.log('[API] No user message provided, returning fallback title');
      return new Response(
        JSON.stringify({ title: 'New Conversation' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Generate a concise title using AI
    console.log('[API] Calling AI to generate title...');
    let result;
    try {
      result = await createChatCompletion({
        messages: [
          {
            role: 'system',
            content: `You are a chat title generator. Based on the user's message and assistant's response, create a short, descriptive title for this conversation.

Rules:
- Keep it 3-6 words maximum
- Make it descriptive of the main topic
- Use title case (capitalize main words)
- Be specific, not generic
- No quotes, no punctuation at end
- Examples: "Email Writing Help", "Python Code Review", "Daily Devotional", "Bible Study Questions"`,
          },
          {
            role: 'user',
            content: `User: ${userMessage}\n\nAssistant: ${assistantMessage.slice(0, 300)}...\n\nGenerate a short title (3-6 words) for this conversation:`,
          },
        ],
        stream: false,
      });
    } catch (aiError) {
      console.error('[API] AI call failed:', aiError);
      // Return a generated fallback title based on the user message
      const fallbackTitle = userMessage.slice(0, 40).trim() || 'New Conversation';
      return new Response(
        JSON.stringify({ title: fallbackTitle }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Extract the title and clean it up
    // Handle both string and Promise<string> return types
    const textContent = await Promise.resolve(result?.text || '');
    if (!textContent) {
      console.log('[API] No text returned from AI, using fallback title');
      const fallbackTitle = userMessage.slice(0, 40).trim() || 'New Conversation';
      return new Response(
        JSON.stringify({ title: fallbackTitle }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
    let title = textContent.trim();
    console.log('[API] Raw AI-generated title:', title);

    // Remove quotes if present
    title = title.replace(/^["']|["']$/g, '');

    // Remove trailing punctuation
    title = title.replace(/[.!?]$/, '');

    // Limit length to 50 characters
    if (title.length > 50) {
      title = title.slice(0, 47) + '...';
    }

    console.log('[API] Final cleaned title:', title);

    return new Response(
      JSON.stringify({ title }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[API] Title generation error:', error);

    return new Response(
      JSON.stringify({
        error: 'Failed to generate title',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

export const runtime = 'nodejs';
