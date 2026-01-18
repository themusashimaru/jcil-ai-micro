/**
 * GENERATE CHAT TITLE API
 *
 * PURPOSE:
 * - Generate descriptive chat titles based on conversation content
 * - Called after first message exchange in a chat
 * - Creates concise, meaningful titles (3-6 words)
 *
 * PROVIDER: Claude (Anthropic) - Haiku for fast title generation
 */

import { createClaudeChat } from '@/lib/anthropic/client';
import { NextRequest } from 'next/server';
import { logger } from '@/lib/logger';
import { generateTitleSchema } from '@/lib/validation/schemas';
import { validateCSRF } from '@/lib/security/csrf';
import { checkRequestRateLimit, rateLimits, errors } from '@/lib/api/utils';

const log = logger('GenerateTitleAPI');

export async function POST(request: NextRequest) {
  try {
    // CSRF Protection
    const csrfCheck = validateCSRF(request);
    if (!csrfCheck.valid) return csrfCheck.response!;

    // Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
    const rateLimitResult = await checkRequestRateLimit(
      `generate-title:${ip}`,
      rateLimits.standard
    );
    if (!rateLimitResult.allowed) return rateLimitResult.response;

    // Parse and validate body
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return errors.badRequest('Invalid JSON body');
    }

    const validation = generateTitleSchema.safeParse(rawBody);
    if (!validation.success) {
      return errors.validationError(
        validation.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message }))
      );
    }

    const { userMessage, assistantMessage = '' } = validation.data;

    log.info('[API] Generate title request:', {
      userMessage: userMessage.slice(0, 100),
      assistantMessage: assistantMessage?.slice(0, 100) || '',
    });

    if (!userMessage.trim()) {
      log.info('[API] No user message provided, returning fallback title');
      return new Response(JSON.stringify({ title: 'New Conversation' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    log.info('[API] Calling Claude to generate title');

    const systemPrompt = `You are a chat title generator. Based on the user's message and assistant's response, create a short, descriptive title for this conversation.

Rules:
- Keep it 3-6 words maximum
- Make it descriptive of the main topic
- Use title case (capitalize main words)
- Be specific, not generic
- No quotes, no punctuation at end
- Examples: "Email Writing Help", "Python Code Review", "Daily Devotional", "Bible Study Questions"`;

    const userPrompt = `User: ${userMessage}\n\nAssistant: ${assistantMessage.slice(0, 300)}...\n\nGenerate a short title (3-6 words) for this conversation:`;

    let titleText = '';
    try {
      // Use Claude Haiku for fast title generation
      const result = await createClaudeChat({
        messages: [{ role: 'user', content: userPrompt }],
        systemPrompt,
        maxTokens: 50, // Titles are short
        temperature: 0.5,
        forceModel: 'haiku', // Fast model for quick titles
      });
      titleText = result.text || '';
    } catch (aiError) {
      log.error(
        '[API] Claude call failed',
        aiError instanceof Error ? aiError : { error: aiError }
      );
      // Return a generated fallback title based on the user message
      const fallbackTitle = userMessage.slice(0, 40).trim() || 'New Conversation';
      return new Response(JSON.stringify({ title: fallbackTitle }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Extract the title and clean it up
    if (!titleText) {
      log.info('[API] No text returned from AI, using fallback title');
      const fallbackTitle = userMessage.slice(0, 40).trim() || 'New Conversation';
      return new Response(JSON.stringify({ title: fallbackTitle }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    let title = titleText.trim();
    log.info('[API] Raw AI-generated title', { title });

    // Remove quotes if present
    title = title.replace(/^["']|["']$/g, '');

    // Remove trailing punctuation
    title = title.replace(/[.!?]$/, '');

    // Limit length to 50 characters
    if (title.length > 50) {
      title = title.slice(0, 47) + '...';
    }

    log.info('[API] Final cleaned title', { title });

    return new Response(JSON.stringify({ title }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    log.error('[API] Title generation error:', error instanceof Error ? error : { error });

    return new Response(JSON.stringify({ error: 'Failed to generate title' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export const runtime = 'nodejs';
export const maxDuration = 30;
