/**
 * Background Worker - Process Pending Requests
 *
 * This Vercel Cron job picks up abandoned chat requests and completes them.
 * When a user leaves mid-request, the pending_requests table still has their request.
 * This worker processes those requests and saves the responses.
 *
 * Runs every minute via Vercel Cron.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getPendingRequestsToProcess,
  markRequestProcessing,
  saveBackgroundResponse,
  failPendingRequest,
  cleanupOldRequests,
} from '@/lib/pending-requests';
import { completeChat } from '@/lib/ai/chat-router';
import { getMainChatSystemPrompt } from '@/lib/prompts/main-chat';
import type { CoreMessage } from 'ai';
import { logger } from '@/lib/logger';

const log = logger('CronProcessPending');

// This route should only be called by Vercel Cron
// Verify using CRON_SECRET in production
export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds max for cron jobs

export async function GET(request: NextRequest) {
  // SECURITY FIX: Verify cron secret - REQUIRE it even if not set
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    log.warn('CRON_SECRET not configured — cron jobs will be rejected');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    log.warn('Cron secret mismatch', {
      hasAuthHeader: !!authHeader,
      headerFormat: authHeader ? (authHeader.startsWith('Bearer ') ? 'Bearer' : 'other') : 'none',
      source: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown',
    });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  log.info('[Cron] Starting pending requests processing');

  try {
    // Clean up old completed/failed requests first
    const cleaned = await cleanupOldRequests();
    if (cleaned > 0) {
      log.info('[Cron] Cleaned up old requests', { count: cleaned });
    }

    // Get pending requests that need processing
    const pendingRequests = await getPendingRequestsToProcess(3); // Process up to 3 at a time

    if (pendingRequests.length === 0) {
      log.info('[Cron] No pending requests to process');
      return NextResponse.json({ processed: 0 });
    }

    log.info('[Cron] Found pending requests', { count: pendingRequests.length });

    let processed = 0;
    let failed = 0;

    // Process each request
    for (const request of pendingRequests) {
      try {
        // Try to claim this request (prevents race conditions with other workers)
        const claimed = await markRequestProcessing(request.id);
        if (!claimed) {
          log.info('[Cron] Request already being processed', { requestId: request.id });
          continue;
        }

        log.info('[Cron] Processing request', { requestId: request.id, userId: request.user_id });

        // Complete the request with multi-provider support (Claude primary, xAI fallback)
        const systemPrompt = getMainChatSystemPrompt();
        const result = await completeChat(request.messages as CoreMessage[], {
          systemPrompt,
          maxTokens: 4096,
        });

        log.info('[Cron] AI response received', {
          requestId: request.id,
          provider: result.providerId,
          model: result.model,
          usedFallback: result.usedFallback,
        });

        // Extract the response text
        const responseText = result.text || '';

        if (!responseText) {
          log.error('[Cron] Empty response for request', { requestId: request.id });
          await failPendingRequest(request.id, 'Empty response from AI');
          failed++;
          continue;
        }

        // Save the response to the database
        await saveBackgroundResponse(
          request.id,
          request.conversation_id,
          request.user_id,
          responseText,
          request.model || undefined
        );

        log.info('[Cron] Successfully processed request', { requestId: request.id });
        processed++;
      } catch (error) {
        log.error('[Cron] Failed to process request', {
          requestId: request.id,
          error: error instanceof Error ? error.message : 'Unknown',
        });
        await failPendingRequest(request.id, 'Processing failed');
        failed++;
      }
    }

    log.info('[Cron] Completed', { processed, failed });

    return NextResponse.json({
      processed,
      failed,
      total: pendingRequests.length,
    });
  } catch (error) {
    log.error('[Cron] Error:', error instanceof Error ? error : { error });
    return NextResponse.json({ error: 'Failed to process pending requests' }, { status: 500 });
  }
}
