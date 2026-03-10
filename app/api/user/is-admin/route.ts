/**
 * ADMIN CHECK API
 * PURPOSE: Check if current user is an admin
 */

import { requireUser } from '@/lib/auth/user-guard';
import { logger } from '@/lib/logger';
import { successResponse, errors, checkRequestRateLimit, rateLimits } from '@/lib/api/utils';

const log = logger('IsAdmin');

export async function GET() {
  try {
    const auth = await requireUser();
    if (!auth.authorized) return auth.response;

    // Rate limit by user
    const rateLimitResult = await checkRequestRateLimit(
      `admin:check:${auth.user.id}`,
      rateLimits.standard
    );
    if (!rateLimitResult.allowed) return rateLimitResult.response;

    // Check if user is in admin_users table
    const { data: adminUser, error: adminError } = await auth.supabase
      .from('admin_users')
      .select('id')
      .eq('user_id', auth.user.id)
      .single();

    if (adminError && adminError.code !== 'PGRST116') {
      // PGRST116 is "not found" error, which is expected for non-admins
      log.error(
        '[API] Error checking admin status:',
        adminError instanceof Error ? adminError : { adminError }
      );
    }

    return successResponse({
      isAdmin: !!adminUser,
      userId: auth.user.id,
      email: auth.user.email,
    });
  } catch (error) {
    log.error('[API] Admin check error:', error instanceof Error ? error : { error });
    return errors.serverError();
  }
}

// Mark this route as dynamic
export const dynamic = 'force-dynamic';
