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
import { createChatCompletion } from '@/lib/openai/client';

// This route should only be called by Vercel Cron
// Verify using CRON_SECRET in production
export const runtime = 'nodejs';
export const maxDuration = 60; // 60 seconds max for cron jobs

export async function GET(request: NextRequest) {
  // Verify cron secret in production
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.log('[Cron] Unauthorized request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[Cron] Starting pending requests processing');

  try {
    // Clean up old completed/failed requests first
    const cleaned = await cleanupOldRequests();
    if (cleaned > 0) {
      console.log('[Cron] Cleaned up', cleaned, 'old requests');
    }

    // Get pending requests that need processing
    const pendingRequests = await getPendingRequestsToProcess(3); // Process up to 3 at a time

    if (pendingRequests.length === 0) {
      console.log('[Cron] No pending requests to process');
      return NextResponse.json({ processed: 0 });
    }

    console.log('[Cron] Found', pendingRequests.length, 'pending requests');

    let processed = 0;
    let failed = 0;

    // Process each request
    for (const request of pendingRequests) {
      try {
        // Try to claim this request (prevents race conditions with other workers)
        const claimed = await markRequestProcessing(request.id);
        if (!claimed) {
          console.log('[Cron] Request already being processed:', request.id);
          continue;
        }

        console.log('[Cron] Processing request:', request.id, 'for user:', request.user_id);

        // Call the AI to complete the request
        // Use non-streaming since there's no client to stream to
        const result = await createChatCompletion({
          messages: request.messages as Parameters<typeof createChatCompletion>[0]['messages'],
          tool: request.tool as Parameters<typeof createChatCompletion>[0]['tool'],
          stream: false,
          userId: request.user_id,
          conversationId: request.conversation_id,
          // No pendingRequestId - we'll handle completion manually
        });

        // Extract the response text
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const responseText = (result as any).text || '';

        if (!responseText) {
          console.error('[Cron] Empty response for request:', request.id);
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

        console.log('[Cron] Successfully processed request:', request.id);
        processed++;
      } catch (error) {
        console.error('[Cron] Failed to process request:', request.id, error);
        await failPendingRequest(
          request.id,
          error instanceof Error ? error.message : 'Unknown error'
        );
        failed++;
      }
    }

    console.log('[Cron] Completed. Processed:', processed, 'Failed:', failed);

    return NextResponse.json({
      processed,
      failed,
      total: pendingRequests.length,
    });
  } catch (error) {
    console.error('[Cron] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
