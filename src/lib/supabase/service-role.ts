/**
 * SUPABASE SERVICE ROLE CLIENT
 *
 * Creates a Supabase client with service role privileges.
 * This does NOT depend on next/headers and can be used anywhere.
 *
 * ⚠️  SECURITY WARNING - CRITICAL-008 ⚠️
 * The service role key BYPASSES ALL Row Level Security (RLS) policies.
 * This client should only be used for:
 * 1. Background jobs without user context
 * 2. System-level operations (health checks, migrations)
 * 3. Legacy code being migrated to SecureServiceRoleClient
 *
 * For user-scoped operations, use SecureServiceRoleClient instead:
 * ```typescript
 * import { createSecureServiceClient } from '@/lib/supabase/secure-service-role';
 *
 * const secureClient = createSecureServiceClient(
 *   { id: user.id, email: user.email },
 *   { endpoint: '/api/endpoint' }
 * );
 * const data = await secureClient.getUserData(userId);
 * ```
 *
 * @deprecated For user-facing operations, use SecureServiceRoleClient
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { logger, auditLog } from '@/lib/logger';

const log = logger('ServiceRole');

let serviceRoleClient: SupabaseClient<Database> | null = null;

/**
 * Get or create a Supabase client with service role privileges.
 * This client bypasses RLS and should only be used on the server.
 *
 * @deprecated For user-facing operations, use createSecureServiceClient() instead
 */
export function createServiceRoleClient(): SupabaseClient<Database> {
  // Log usage for audit trail (helps track migration progress)
  if (process.env.NODE_ENV === 'development') {
    log.warn(
      'createServiceRoleClient() called - consider using SecureServiceRoleClient for user operations'
    );
  }

  // Return cached client if available
  if (serviceRoleClient) {
    return serviceRoleClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
  }

  if (!serviceRoleKey) {
    log.warn('SUPABASE_SERVICE_ROLE_KEY not set, using anon key (limited access)');
  }

  // Log service role client creation for security audit
  auditLog.log({
    type: 'security.service_role_access',
    userId: null,
    outcome: 'success',
    resource: {
      type: 'service_role',
      id: 'legacy_client',
    },
    details: {
      clientType: 'legacy_singleton',
      warning: 'Consider migrating to SecureServiceRoleClient',
    },
  });

  serviceRoleClient = createClient<Database>(
    supabaseUrl,
    serviceRoleKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  return serviceRoleClient;
}

/**
 * Reset the cached service role client.
 * Useful for testing or when credentials change.
 */
export function resetServiceRoleClient(): void {
  serviceRoleClient = null;
}
