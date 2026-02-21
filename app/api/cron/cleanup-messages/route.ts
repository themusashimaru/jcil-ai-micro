/**
 * MESSAGE RETENTION CLEANUP CRON JOB
 *
 * Runs daily to enforce message retention policies:
 * - Soft-deleted messages older than 90 days are hard-deleted
 * - Soft-deleted conversations older than 90 days are hard-deleted
 * - Orphaned uploads are cleaned up
 *
 * SCHEDULE: 0 3 * * * (daily at 3 AM UTC)
 * SECURITY: Requires CRON_SECRET in Authorization header
 *
 * GDPR/Privacy Compliance:
 * - Ensures data is not retained longer than necessary
 * - Provides audit trail via logging
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';

const log = logger('CronCleanupMessages');

// Retention periods in days
const SOFT_DELETE_RETENTION_DAYS = 90; // 3 months for soft-deleted items
const MAX_BATCH_SIZE = 1000; // Process in batches to avoid timeouts

// Verify cron secret to prevent unauthorized access
function verifyCronSecret(request: Request): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    log.warn('CRON_SECRET not configured — cron jobs will be rejected');
    return false;
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    log.warn('Cron secret mismatch', {
      hasAuthHeader: !!authHeader,
      headerFormat: authHeader ? (authHeader.startsWith('Bearer ') ? 'Bearer' : 'other') : 'none',
      source: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown',
    });
    return false;
  }

  return true;
}

export const maxDuration = 60; // Allow up to 60 seconds for this cron job

export async function GET(request: Request) {
  const startTime = Date.now();

  // Security check
  if (!verifyCronSecret(request)) {
    log.warn('Unauthorized cron access attempt');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createServerClient();
    const stats = {
      messagesDeleted: 0,
      conversationsDeleted: 0,
      uploadsDeleted: 0,
      errors: [] as string[],
    };

    // Calculate cutoff date for hard deletion
    const retentionCutoff = new Date(
      Date.now() - SOFT_DELETE_RETENTION_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();

    log.info('Starting message retention cleanup', {
      retentionDays: SOFT_DELETE_RETENTION_DAYS,
      cutoffDate: retentionCutoff,
    });

    // ========================================
    // 1. DELETE OLD SOFT-DELETED MESSAGES
    // ========================================
    try {
      const { data: deletedMessages, error: messagesError } = await supabase
        .from('messages')
        .delete()
        .not('deleted_at', 'is', null)
        .lt('deleted_at', retentionCutoff)
        .select('id')
        .limit(MAX_BATCH_SIZE);

      if (messagesError) {
        log.error('Failed to delete old messages', messagesError);
        stats.errors.push(`Messages: ${messagesError.message}`);
      } else {
        stats.messagesDeleted = deletedMessages?.length || 0;
        log.debug('Deleted soft-deleted messages', { count: stats.messagesDeleted });
      }
    } catch (err) {
      log.error('Error deleting messages', err as Error);
      stats.errors.push(`Messages: ${(err as Error).message}`);
    }

    // ========================================
    // 2. DELETE OLD SOFT-DELETED CONVERSATIONS
    // ========================================
    try {
      const { data: deletedConversations, error: conversationsError } = await supabase
        .from('conversations')
        .delete()
        .not('deleted_at', 'is', null)
        .lt('deleted_at', retentionCutoff)
        .select('id')
        .limit(MAX_BATCH_SIZE);

      if (conversationsError) {
        log.error('Failed to delete old conversations', conversationsError);
        stats.errors.push(`Conversations: ${conversationsError.message}`);
      } else {
        stats.conversationsDeleted = deletedConversations?.length || 0;
        log.debug('Deleted soft-deleted conversations', { count: stats.conversationsDeleted });
      }
    } catch (err) {
      log.error('Error deleting conversations', err as Error);
      stats.errors.push(`Conversations: ${(err as Error).message}`);
    }

    // ========================================
    // 3. DELETE ORPHANED UPLOADS (no conversation)
    // ========================================
    try {
      // Find uploads with deleted conversations or null conversation_id older than retention
      const { data: deletedUploads, error: uploadsError } = await supabase
        .from('uploads')
        .delete()
        .lt('created_at', retentionCutoff)
        .is('conversation_id', null)
        .select('id')
        .limit(MAX_BATCH_SIZE);

      if (uploadsError) {
        log.error('Failed to delete orphaned uploads', uploadsError);
        stats.errors.push(`Uploads: ${uploadsError.message}`);
      } else {
        stats.uploadsDeleted = deletedUploads?.length || 0;
        log.debug('Deleted orphaned uploads', { count: stats.uploadsDeleted });
      }
    } catch (err) {
      log.error('Error deleting uploads', err as Error);
      stats.errors.push(`Uploads: ${(err as Error).message}`);
    }

    const duration = Date.now() - startTime;
    const hasErrors = stats.errors.length > 0;

    log.info('Message retention cleanup completed', {
      ...stats,
      durationMs: duration,
      success: !hasErrors,
    });

    return NextResponse.json({
      success: !hasErrors,
      stats,
      durationMs: duration,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error('Cleanup cron error', error as Error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// Also support POST for manual triggers
export async function POST(request: Request) {
  return GET(request);
}
