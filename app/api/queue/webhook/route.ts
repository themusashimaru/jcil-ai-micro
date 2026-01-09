/**
 * QSTASH WEBHOOK ENDPOINT
 *
 * This endpoint receives jobs from QStash and processes them.
 * QStash will automatically retry failed jobs with exponential backoff.
 *
 * Security: Verifies QStash signature to prevent unauthorized access.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  JobPayload,
  ChatJobPayload,
  CodeLabJobPayload,
  verifyWebhookSignature,
} from '@/lib/queue/qstash';
import {
  createAnthropicCompletion,
  createAnthropicCompletionWithSearch,
} from '@/lib/anthropic/client';
import { createServerClient } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';

const log = logger('QStashWebhook');

/**
 * Process incoming QStash jobs
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Get signature for verification
    const signature = request.headers.get('upstash-signature') || '';
    const body = await request.text();

    // Verify signature in production
    if (process.env.NODE_ENV === 'production') {
      const isValid = await verifyWebhookSignature(signature, body);
      if (!isValid) {
        log.warn('Invalid QStash signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    // Parse job payload
    const payload: JobPayload = JSON.parse(body);

    log.info('Processing QStash job', { type: payload.type });

    // Route to appropriate handler
    let result;
    switch (payload.type) {
      case 'chat':
        result = await processChatJob(payload);
        break;
      case 'codelab':
        result = await processCodeLabJob(payload);
        break;
      default:
        log.error('Unknown job type', new Error(`Unknown type: ${(payload as JobPayload).type}`));
        return NextResponse.json({ error: 'Unknown job type' }, { status: 400 });
    }

    const duration = Date.now() - startTime;
    log.info('QStash job completed', { type: payload.type, duration });

    return NextResponse.json({
      success: true,
      result,
      duration,
    });
  } catch (error) {
    const err = error as Error;
    log.error('QStash job failed', err);

    // Return 500 to trigger QStash retry
    return NextResponse.json(
      { error: err.message, stack: process.env.NODE_ENV === 'development' ? err.stack : undefined },
      { status: 500 }
    );
  }
}

/**
 * Process chat job
 */
async function processChatJob(payload: ChatJobPayload): Promise<{ textLength: number }> {
  const { conversationId, userId, messages, model, systemPrompt, webSearchEnabled } = payload;

  log.debug('Processing chat job', { conversationId, messageCount: messages.length });

  // Convert messages to CoreMessage format
  const coreMessages = messages.map((m) => ({
    role: m.role as 'user' | 'assistant' | 'system',
    content: m.content,
  }));

  // Process with or without web search
  let result;
  if (webSearchEnabled) {
    const { searchWeb } = await import('@/lib/perplexity/client');
    result = await createAnthropicCompletionWithSearch({
      messages: coreMessages,
      model,
      systemPrompt,
      webSearchFn: async (query: string) => {
        const searchResult = await searchWeb(query);
        return {
          query,
          results: searchResult.sources.map(
            (s: { title: string; url: string; snippet?: string }) => ({
              title: s.title,
              url: s.url,
              description: s.snippet || '',
              content: s.snippet,
            })
          ),
        };
      },
    });
  } else {
    result = await createAnthropicCompletion({
      messages: coreMessages,
      model,
      systemPrompt,
    });
  }

  // Save response to database
  const supabase = createServerClient();
  const { error: insertError } = await supabase.from('messages').insert({
    conversation_id: conversationId,
    user_id: userId,
    role: 'assistant' as const,
    content: result.text,
    model_used: result.model,
  } as never);

  if (insertError) {
    log.error('Failed to save message', new Error(insertError.message));
    // Don't throw - message was generated successfully
  }

  log.info('Chat job processed', {
    conversationId,
    textLength: result.text.length,
  });

  return { textLength: result.text.length };
}

/**
 * Process code lab job
 */
async function processCodeLabJob(payload: CodeLabJobPayload): Promise<{ processed: boolean }> {
  const { sessionId } = payload;

  log.debug('Processing code lab job', { sessionId });

  // Code lab processing would go here
  // This is a placeholder for actual implementation

  log.info('Code lab job processed', { sessionId });

  return { processed: true };
}
