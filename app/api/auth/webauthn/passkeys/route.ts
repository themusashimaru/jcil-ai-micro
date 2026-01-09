/**
 * Passkey Management API
 * GET /api/auth/webauthn/passkeys - List user's passkeys
 * DELETE /api/auth/webauthn/passkeys - Remove a passkey
 */

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from '@/lib/supabase/server-auth';
import { logger } from '@/lib/logger';
import { successResponse, errors, checkRequestRateLimit, rateLimits } from '@/lib/api/utils';
import { validateCSRF } from '@/lib/security/csrf';

const log = logger('WebAuthnPasskeys');

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Create Supabase client inside functions to avoid build-time initialization
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase configuration');
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * GET - List user's registered passkeys
 */
export async function GET() {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return errors.unauthorized();
    }

    // Rate limit by user
    const rateLimitResult = checkRequestRateLimit(`passkeys:get:${session.user.id}`, rateLimits.standard);
    if (!rateLimitResult.allowed) return rateLimitResult.response;

    const supabase = getSupabaseAdmin();
    const { data: passkeys, error } = await supabase
      .from('user_passkeys')
      .select('id, device_name, created_at, last_used_at')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      log.error('Failed to fetch passkeys:', error instanceof Error ? error : { error });
      return errors.serverError();
    }

    return successResponse({ passkeys: passkeys || [] });
  } catch (error) {
    log.error('Passkey list error:', error instanceof Error ? error : { error });
    return errors.serverError();
  }
}

/**
 * DELETE - Remove a passkey
 */
export async function DELETE(request: NextRequest) {
  // CSRF Protection - Critical for credential deletion
  const csrfCheck = validateCSRF(request);
  if (!csrfCheck.valid) return csrfCheck.response!;

  try {
    const session = await getServerSession();
    if (!session?.user) {
      return errors.unauthorized();
    }

    // Rate limit by user
    const rateLimitResult = checkRequestRateLimit(`passkeys:delete:${session.user.id}`, rateLimits.strict);
    if (!rateLimitResult.allowed) return rateLimitResult.response;

    const { searchParams } = new URL(request.url);
    const passkeyId = searchParams.get('id');

    if (!passkeyId) {
      return errors.badRequest('Passkey ID required');
    }

    const supabase = getSupabaseAdmin();
    // Delete the passkey (RLS ensures user can only delete their own)
    const { error } = await supabase
      .from('user_passkeys')
      .delete()
      .eq('id', passkeyId)
      .eq('user_id', session.user.id);

    if (error) {
      log.error('Failed to delete passkey:', error instanceof Error ? error : { error });
      return errors.serverError();
    }

    return successResponse({ success: true });
  } catch (error) {
    log.error('Passkey delete error:', error instanceof Error ? error : { error });
    return errors.serverError();
  }
}
