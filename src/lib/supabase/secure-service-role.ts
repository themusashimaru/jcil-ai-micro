/**
 * SECURE SERVICE ROLE CLIENT - CRITICAL-008 FIX
 *
 * This module provides a secure wrapper around the Supabase service role client.
 * It addresses the security concern of unguarded service role key usage by:
 *
 * 1. MANDATORY AUTHENTICATION: Every operation requires a validated user context
 * 2. AUDIT LOGGING: All privileged operations are logged for security review
 * 3. SCOPED OPERATIONS: Only specific, whitelisted operations are allowed
 * 4. REQUEST ISOLATION: Each request gets a fresh client context
 *
 * USAGE:
 * ```typescript
 * // Instead of:
 * const adminClient = createClient(url, SERVICE_ROLE_KEY);
 * await adminClient.from('users').select('*');
 *
 * // Use:
 * const secureClient = createSecureServiceClient(authenticatedUser, request);
 * const data = await secureClient.getUserData(userId);
 * ```
 *
 * SECURITY NOTES:
 * - Service role key BYPASSES all Row Level Security (RLS) policies
 * - This wrapper ensures authentication happens BEFORE privileged access
 * - All operations are logged to the audit trail for compliance
 * - Raw client access is intentionally NOT exposed
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { auditLog, logger } from '@/lib/logger';

// Use generic type since database schema may not have all columns
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDatabase = any;

const log = logger('SecureServiceRole');

// ============================================================================
// TYPES
// ============================================================================

/**
 * Authenticated user context required for all service role operations
 */
export interface AuthenticatedUserContext {
  /** User ID from authentication */
  id: string;
  /** User email (for audit logging) */
  email?: string;
  /** Whether user has admin role */
  isAdmin?: boolean;
  /** Session ID if available */
  sessionId?: string;
}

/**
 * Request context for audit logging
 */
export interface RequestContext {
  /** Request IP address */
  ipAddress?: string;
  /** Request user agent */
  userAgent?: string;
  /** Request endpoint */
  endpoint?: string;
  /** Request method */
  method?: string;
}

/**
 * Operations allowed through the secure client
 */
export type SecureOperation =
  | 'user.read'
  | 'user.update'
  | 'user.github_token'
  | 'session.read'
  | 'session.update'
  | 'message.create'
  | 'admin.user_read'
  | 'admin.user_update'
  | 'admin.stats';

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate that user context is properly authenticated
 */
function validateUserContext(user: AuthenticatedUserContext): void {
  if (!user) {
    throw new SecurityError('User context is required for service role operations');
  }
  if (!user.id || typeof user.id !== 'string' || user.id.length < 10) {
    throw new SecurityError('Invalid user ID in context');
  }
}

/**
 * Validate that user can perform admin operations
 */
function validateAdminAccess(user: AuthenticatedUserContext): void {
  if (!user.isAdmin) {
    throw new SecurityError('Admin access required for this operation');
  }
}

/**
 * Validate that user can access another user's data
 */
function validateUserAccess(user: AuthenticatedUserContext, targetUserId: string): void {
  if (user.id !== targetUserId && !user.isAdmin) {
    throw new SecurityError("Cannot access another user's data without admin privileges");
  }
}

// ============================================================================
// CUSTOM ERROR
// ============================================================================

export class SecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecurityError';
  }
}

// ============================================================================
// SECURE CLIENT CLASS
// ============================================================================

/**
 * Secure wrapper for service role operations
 *
 * This class provides a limited, audited interface to the service role client.
 * It enforces authentication and logs all operations.
 */
export class SecureServiceRoleClient {
  private client: SupabaseClient<AnyDatabase>;
  private user: AuthenticatedUserContext;
  private requestContext: RequestContext;

  constructor(user: AuthenticatedUserContext, requestContext: RequestContext = {}) {
    validateUserContext(user);

    this.user = user;
    this.requestContext = requestContext;

    // Create a fresh client for this request (no global singleton)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Supabase configuration is missing');
    }

    this.client = createClient<AnyDatabase>(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Log client creation for audit trail
    this.logOperation('client.created', { reason: 'Secure service client initialized' });
  }

  // ========================================================================
  // AUDIT LOGGING
  // ========================================================================

  private logOperation(operation: string, details: Record<string, unknown> = {}): void {
    auditLog.log({
      type: 'security.service_role_access',
      userId: this.user.id,
      outcome: 'success',
      ipAddress: this.requestContext.ipAddress,
      userAgent: this.requestContext.userAgent,
      resource: {
        type: 'service_role',
        id: operation,
      },
      details: {
        ...details,
        phase: 'initiated',
        userEmail: this.user.email,
        isAdmin: this.user.isAdmin,
        endpoint: this.requestContext.endpoint,
      },
    });
  }

  private logSuccess(operation: string, details: Record<string, unknown> = {}): void {
    log.info(`Service role operation: ${operation}`, {
      userId: this.user.id,
      ...details,
    });
  }

  private logError(operation: string, error: Error): void {
    auditLog.log({
      type: 'security.service_role_access',
      userId: this.user.id,
      outcome: 'failure',
      ipAddress: this.requestContext.ipAddress,
      userAgent: this.requestContext.userAgent,
      resource: {
        type: 'service_role',
        id: operation,
      },
      details: {
        error: error.message,
        endpoint: this.requestContext.endpoint,
      },
    });
    log.error(`Service role operation failed: ${operation}`, error);
  }

  // ========================================================================
  // USER OPERATIONS
  // ========================================================================

  /**
   * Get user's own data (github_token, preferences, etc.)
   * User can only access their own data unless admin
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async getUserData(
    targetUserId: string,
    fields: string[] = ['id', 'email', 'name', 'subscription_tier']
  ): Promise<Record<string, unknown> | null> {
    validateUserAccess(this.user, targetUserId);
    this.logOperation('user.read', { targetUserId, fields });

    try {
      const { data, error } = await this.client
        .from('users')
        .select(fields.join(', '))
        .eq('id', targetUserId)
        .single();

      if (error) throw error;
      this.logSuccess('user.read', { targetUserId });
      return data as unknown as Record<string, unknown> | null;
    } catch (error) {
      this.logError('user.read', error as Error);
      throw error;
    }
  }

  /**
   * Get user's encrypted GitHub token
   * Returns the encrypted token - caller must decrypt
   */
  async getUserGitHubToken(targetUserId: string): Promise<string | null> {
    validateUserAccess(this.user, targetUserId);
    this.logOperation('user.github_token', { targetUserId });

    try {
      const { data, error } = await this.client
        .from('users')
        .select('github_token')
        .eq('id', targetUserId)
        .single();

      if (error) throw error;

      const hasToken = !!data?.github_token;
      this.logSuccess('user.github_token', { targetUserId, hasToken });
      return data?.github_token ?? null;
    } catch (error) {
      this.logError('user.github_token', error as Error);
      throw error;
    }
  }

  /**
   * Update user's own data
   * User can only update their own data unless admin
   */
  async updateUserData(targetUserId: string, updates: Record<string, unknown>): Promise<void> {
    validateUserAccess(this.user, targetUserId);

    // Prevent updating sensitive fields through this method
    const blockedFields = ['id', 'email', 'role', 'subscription_tier', 'stripe_customer_id'];
    const attemptedBlockedFields = Object.keys(updates).filter((f) => blockedFields.includes(f));

    if (attemptedBlockedFields.length > 0 && !this.user.isAdmin) {
      throw new SecurityError(
        `Cannot update protected fields: ${attemptedBlockedFields.join(', ')}`
      );
    }

    this.logOperation('user.update', {
      targetUserId,
      fields: Object.keys(updates),
    });

    try {
      const { error } = await this.client.from('users').update(updates).eq('id', targetUserId);

      if (error) throw error;
      this.logSuccess('user.update', { targetUserId });
    } catch (error) {
      this.logError('user.update', error as Error);
      throw error;
    }
  }

  // ========================================================================
  // SESSION OPERATIONS
  // ========================================================================

  /**
   * Get session data
   * User can only access sessions they own
   */
  async getSessionData(sessionId: string): Promise<Record<string, unknown> | null> {
    this.logOperation('session.read', { sessionId });

    try {
      const { data, error } = await this.client
        .from('code_lab_sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('user_id', this.user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
      this.logSuccess('session.read', { sessionId, found: !!data });
      return data as unknown as Record<string, unknown> | null;
    } catch (error) {
      this.logError('session.read', error as Error);
      throw error;
    }
  }

  /**
   * Update session data
   * User can only update sessions they own
   */
  async updateSessionData(sessionId: string, updates: Record<string, unknown>): Promise<void> {
    this.logOperation('session.update', { sessionId, fields: Object.keys(updates) });

    try {
      const { error } = await this.client
        .from('code_lab_sessions')
        .update(updates)
        .eq('id', sessionId)
        .eq('user_id', this.user.id);

      if (error) throw error;
      this.logSuccess('session.update', { sessionId });
    } catch (error) {
      this.logError('session.update', error as Error);
      throw error;
    }
  }

  // ========================================================================
  // MESSAGE OPERATIONS
  // ========================================================================

  /**
   * Create a new message in a conversation
   */
  async createMessage(
    conversationId: string,
    message: {
      role: 'user' | 'assistant';
      content: string;
      model?: string;
    }
  ): Promise<{ id: string }> {
    this.logOperation('message.create', { conversationId, role: message.role });

    try {
      const { data, error } = await this.client
        .from('messages')
        .insert({
          conversation_id: conversationId,
          user_id: this.user.id,
          role: message.role,
          content: message.content,
          model: message.model,
        })
        .select('id')
        .single();

      if (error) throw error;
      this.logSuccess('message.create', { conversationId, messageId: data?.id });
      return { id: data?.id ?? '' };
    } catch (error) {
      this.logError('message.create', error as Error);
      throw error;
    }
  }

  // ========================================================================
  // ADMIN OPERATIONS (require admin role)
  // ========================================================================

  /**
   * Admin: Get any user's data
   */
  async adminGetUser(targetUserId: string): Promise<Record<string, unknown> | null> {
    validateAdminAccess(this.user);
    this.logOperation('admin.user_read', { targetUserId });

    try {
      const { data, error } = await this.client
        .from('users')
        .select('*')
        .eq('id', targetUserId)
        .single();

      if (error) throw error;
      this.logSuccess('admin.user_read', { targetUserId });
      return data as unknown as Record<string, unknown> | null;
    } catch (error) {
      this.logError('admin.user_read', error as Error);
      throw error;
    }
  }

  /**
   * Admin: Update any user's data
   */
  async adminUpdateUser(targetUserId: string, updates: Record<string, unknown>): Promise<void> {
    validateAdminAccess(this.user);
    this.logOperation('admin.user_update', {
      targetUserId,
      fields: Object.keys(updates),
    });

    try {
      const { error } = await this.client.from('users').update(updates).eq('id', targetUserId);

      if (error) throw error;
      this.logSuccess('admin.user_update', { targetUserId });
    } catch (error) {
      this.logError('admin.user_update', error as Error);
      throw error;
    }
  }

  /**
   * Admin: Get platform statistics
   */
  async adminGetStats(): Promise<{
    totalUsers: number;
    activeUsers: number;
    totalSessions: number;
  }> {
    validateAdminAccess(this.user);
    this.logOperation('admin.stats', {});

    try {
      const [usersResult, sessionsResult] = await Promise.all([
        this.client.from('users').select('id', { count: 'exact', head: true }),
        this.client.from('code_lab_sessions').select('id', { count: 'exact', head: true }),
      ]);

      const stats = {
        totalUsers: usersResult.count ?? 0,
        activeUsers: 0, // Would need additional query
        totalSessions: sessionsResult.count ?? 0,
      };

      this.logSuccess('admin.stats', stats);
      return stats;
    } catch (error) {
      this.logError('admin.stats', error as Error);
      throw error;
    }
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

/**
 * Create a secure service role client for the authenticated user
 *
 * @param user - Authenticated user context (from auth middleware)
 * @param request - Optional request context for audit logging
 * @returns SecureServiceRoleClient instance
 *
 * @example
 * ```typescript
 * export async function POST(request: NextRequest) {
 *   const auth = await validateAuth(request);
 *   if (!auth.authenticated) return auth.response;
 *
 *   const secureClient = createSecureServiceClient(
 *     { id: auth.user.id, email: auth.user.email },
 *     { endpoint: '/api/code-lab/chat', ipAddress: getClientIP(request) }
 *   );
 *
 *   const token = await secureClient.getUserGitHubToken(auth.user.id);
 * }
 * ```
 */
export function createSecureServiceClient(
  user: AuthenticatedUserContext,
  requestContext: RequestContext = {}
): SecureServiceRoleClient {
  return new SecureServiceRoleClient(user, requestContext);
}

// ============================================================================
// HELPER: Extract request context from NextRequest
// ============================================================================

/**
 * Extract request context from a NextRequest for audit logging
 */
export function extractRequestContext(request: Request, endpoint: string): RequestContext {
  const headers = request.headers;
  return {
    ipAddress:
      headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      headers.get('x-real-ip') ||
      'unknown',
    userAgent: headers.get('user-agent') || 'unknown',
    endpoint,
    method: request.method,
  };
}
