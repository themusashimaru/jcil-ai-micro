/**
 * GDPR "RIGHT TO BE FORGOTTEN" ENDPOINT
 *
 * DELETE /api/user/delete-account
 *
 * Allows users to request complete deletion of their account and all associated data.
 * Implements GDPR Article 17 - Right to Erasure.
 *
 * Process:
 * 1. User initiates deletion request
 * 2. All user data is soft-deleted immediately
 * 3. Account is deactivated
 * 4. Data is permanently purged after 30-day grace period (allows recovery)
 * 5. Audit log is maintained for compliance
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';
import { auditLog, getAuditContext } from '@/lib/audit';
import { checkRequestRateLimit } from '@/lib/api/utils';
import { validateCSRF } from '@/lib/security/csrf';

const log = logger('AccountDeletion');

export const runtime = 'nodejs';

async function getUser() {
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
            // Ignore
          }
        },
      },
    }
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  return { user, error, supabase };
}

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase configuration');
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * DELETE - Request account deletion (GDPR Right to Erasure)
 */
export async function DELETE(request: NextRequest) {
  // CSRF Protection - Critical for account deletion
  const csrfCheck = validateCSRF(request);
  if (!csrfCheck.valid) return csrfCheck.response!;

  try {
    const { user, error: authError, supabase } = await getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Strict rate limiting - prevent abuse (3 requests per hour max)
    const rateLimitResult = await checkRequestRateLimit(`delete-account:${user.id}`, {
      limit: 3,
      windowMs: 3600_000,
    });
    if (!rateLimitResult.allowed) {
      return rateLimitResult.response;
    }

    const auditContext = getAuditContext(request);
    const adminClient = getSupabaseAdmin();

    log.info('Account deletion requested', { userId: user.id });

    // Start deletion process
    const deletionTimestamp = new Date().toISOString();
    const scheduledPurgeDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

    // 1. Soft-delete all conversations
    const { error: convError } = await adminClient
      .from('conversations')
      .update({ deleted_at: deletionTimestamp })
      .eq('user_id', user.id)
      .is('deleted_at', null);

    if (convError) {
      log.error('Failed to delete conversations', { error: convError });
    }

    // 2. Soft-delete all messages (in user's conversations)
    const { data: userConversations } = await adminClient
      .from('conversations')
      .select('id')
      .eq('user_id', user.id);

    if (userConversations && userConversations.length > 0) {
      const conversationIds = userConversations.map((c) => c.id);
      const { error: msgError } = await adminClient
        .from('messages')
        .update({ deleted_at: deletionTimestamp })
        .in('conversation_id', conversationIds)
        .is('deleted_at', null);

      if (msgError) {
        log.error('Failed to delete messages', { error: msgError });
      }
    }

    // 3. Delete passkeys (these are personal credentials)
    await adminClient.from('user_passkeys').delete().eq('user_id', user.id);

    // 4. Delete user documents (RAG data)
    await adminClient.from('user_document_chunks').delete().eq('user_id', user.id);

    await adminClient.from('user_documents').delete().eq('user_id', user.id);

    // 5. Clear external tokens (GitHub, Vercel)
    await adminClient
      .from('users')
      .update({
        github_token: null,
        github_username: null,
        vercel_token: null,
        vercel_team_id: null,
      })
      .eq('id', user.id);

    // 6. Mark user for deletion and deactivate
    const { error: userUpdateError } = await adminClient
      .from('users')
      .update({
        deleted_at: deletionTimestamp,
        scheduled_purge_at: scheduledPurgeDate,
        // Anonymize PII immediately
        full_name: '[DELETED]',
        avatar_url: null,
        // Keep email temporarily for recovery period, then purge
      })
      .eq('id', user.id);

    if (userUpdateError) {
      log.error('Failed to mark user as deleted', { error: userUpdateError });
      return NextResponse.json({ error: 'Failed to process deletion request' }, { status: 500 });
    }

    // 7. Sign user out from all sessions
    await supabase.auth.signOut({ scope: 'global' });

    // 8. Audit log the deletion (kept for compliance - audit logs are never deleted)
    await auditLog({
      action: 'user.delete_account',
      resourceType: 'user',
      resourceId: user.id,
      userId: user.id,
      ipAddress: auditContext.ipAddress,
      userAgent: auditContext.userAgent,
      metadata: {
        scheduledPurgeDate,
        email: user.email, // Kept in audit for compliance
        reason: 'user_requested',
      },
      status: 'success',
    });

    log.info('Account deletion completed', {
      userId: user.id,
      scheduledPurge: scheduledPurgeDate,
    });

    return NextResponse.json({
      success: true,
      message: 'Your account has been scheduled for deletion.',
      details: {
        softDeletedAt: deletionTimestamp,
        permanentDeletionAt: scheduledPurgeDate,
        recoveryPeriodDays: 30,
        note: 'Contact support within 30 days if you want to recover your account.',
      },
    });
  } catch (error) {
    log.error('Account deletion error', error as Error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET - Check deletion status
 */
export async function GET() {
  try {
    const { user, error: authError } = await getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminClient = getSupabaseAdmin();

    const { data: userData } = await adminClient
      .from('users')
      .select('deleted_at, scheduled_purge_at')
      .eq('id', user.id)
      .single();

    if (userData?.deleted_at) {
      return NextResponse.json({
        status: 'pending_deletion',
        deletedAt: userData.deleted_at,
        permanentDeletionAt: userData.scheduled_purge_at,
        canRecover: new Date(userData.scheduled_purge_at) > new Date(),
      });
    }

    return NextResponse.json({
      status: 'active',
      deletionScheduled: false,
    });
  } catch (error) {
    log.error('Deletion status check error', error as Error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
