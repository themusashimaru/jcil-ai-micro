/**
 * AUDIT LOGGING UTILITY
 *
 * Centralized audit trail for SOC2/GDPR compliance.
 * Records all significant user and admin actions.
 *
 * Usage:
 * await auditLog({
 *   userId: user.id,
 *   action: 'conversation.delete',
 *   resourceType: 'conversation',
 *   resourceId: conversationId,
 *   requestId: correlationId,
 * });
 */

import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

const log = logger('Audit');

// Audit log action types for type safety
export type AuditAction =
  // Authentication
  | 'auth.login'
  | 'auth.logout'
  | 'auth.register'
  | 'auth.password_change'
  | 'auth.mfa_enable'
  | 'auth.mfa_disable'
  | 'auth.passkey_register'
  | 'auth.passkey_authenticate'
  // User actions
  | 'user.update_profile'
  | 'user.delete_account'
  | 'user.export_data'
  | 'user.connect_github'
  | 'user.disconnect_github'
  // Conversations
  | 'conversation.create'
  | 'conversation.delete'
  | 'conversation.export'
  | 'conversation.share'
  // Messages
  | 'message.send'
  | 'message.delete'
  | 'message.edit'
  // Subscription
  | 'subscription.upgrade'
  | 'subscription.downgrade'
  | 'subscription.cancel'
  | 'subscription.payment_failed'
  // Admin actions
  | 'admin.impersonate'
  | 'admin.access_user_data'
  | 'admin.modify_user'
  | 'admin.delete_user'
  | 'admin.view_audit_logs'
  // Security events
  | 'security.csrf_blocked'
  | 'security.rate_limited'
  | 'security.quota_exceeded'
  | 'security.suspicious_activity'
  | 'security.token_revoked'
  // API events
  | 'api.key_created'
  | 'api.key_revoked';

export type AuditResourceType =
  | 'user'
  | 'conversation'
  | 'message'
  | 'subscription'
  | 'passkey'
  | 'token'
  | 'api_key'
  | 'session';

export type AuditStatus = 'success' | 'failure' | 'blocked';

export interface AuditLogEntry {
  userId?: string;
  actorId?: string; // For admin impersonation - who performed the action
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  status?: AuditStatus;
  errorMessage?: string;
}

// Get Supabase admin client (lazy init)
let supabaseAdmin: ReturnType<typeof createClient> | null = null;

function getSupabaseAdmin() {
  if (supabaseAdmin) return supabaseAdmin;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    log.warn('Supabase not configured, audit logging disabled');
    return null;
  }

  supabaseAdmin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return supabaseAdmin;
}

/**
 * Write an audit log entry
 *
 * @param entry - The audit log entry to record
 * @returns true if logged successfully, false otherwise
 */
export async function auditLog(entry: AuditLogEntry): Promise<boolean> {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    // Log to console as fallback
    log.info('AUDIT (no db)', {
      action: entry.action,
      userId: entry.userId,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      status: entry.status || 'success',
    });
    return false;
  }

  try {
    // Note: audit_logs table schema not in generated types yet - using type assertion
    const { error } = await (
      supabase.from('audit_logs') as ReturnType<typeof supabase.from>
    ).insert({
      user_id: entry.userId || null,
      actor_id: entry.actorId || entry.userId || null,
      action: entry.action,
      resource_type: entry.resourceType,
      resource_id: entry.resourceId || null,
      ip_address: entry.ipAddress || null,
      user_agent: entry.userAgent || null,
      request_id: entry.requestId || null,
      metadata: entry.metadata || {},
      old_values: entry.oldValues || null,
      new_values: entry.newValues || null,
      status: entry.status || 'success',
      error_message: entry.errorMessage || null,
    } as Record<string, unknown>);

    if (error) {
      log.error('Failed to write audit log', { error, action: entry.action });
      return false;
    }

    log.debug('Audit logged', { action: entry.action, userId: entry.userId });
    return true;
  } catch (error) {
    log.error('Audit logging error', error as Error);
    return false;
  }
}

/**
 * Helper to extract request context for audit logging
 */
export function getAuditContext(request: Request): {
  ipAddress: string;
  userAgent: string;
} {
  const ipAddress =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  const userAgent = request.headers.get('user-agent') || 'unknown';

  return { ipAddress, userAgent };
}

/**
 * Log a security event
 */
export async function auditSecurityEvent(
  action:
    | 'security.csrf_blocked'
    | 'security.rate_limited'
    | 'security.quota_exceeded'
    | 'security.suspicious_activity',
  context: {
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
    requestId?: string;
    details?: Record<string, unknown>;
  }
): Promise<void> {
  await auditLog({
    action,
    resourceType: 'session',
    userId: context.userId,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    requestId: context.requestId,
    metadata: context.details,
    status: 'blocked',
  });
}

/**
 * Log an admin action (with actor tracking)
 */
export async function auditAdminAction(
  action:
    | 'admin.impersonate'
    | 'admin.access_user_data'
    | 'admin.modify_user'
    | 'admin.delete_user'
    | 'admin.view_audit_logs',
  adminId: string,
  targetUserId: string,
  context: {
    ipAddress?: string;
    userAgent?: string;
    requestId?: string;
    details?: Record<string, unknown>;
  }
): Promise<void> {
  await auditLog({
    action,
    resourceType: 'user',
    resourceId: targetUserId,
    userId: targetUserId, // The affected user
    actorId: adminId, // The admin who performed the action
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    requestId: context.requestId,
    metadata: context.details,
    status: 'success',
  });
}
