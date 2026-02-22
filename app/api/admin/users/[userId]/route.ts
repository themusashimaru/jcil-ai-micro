/**
 * ADMIN SINGLE USER API
 * PURPOSE: Fetch a single user by ID with full details
 * SECURITY: Admin authentication required
 */

import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { requireAdmin, checkPermission } from '@/lib/auth/admin-guard';
import { logger } from '@/lib/logger';
import {
  successResponse,
  errors,
  checkRequestRateLimit,
  rateLimits,
  captureAPIError,
} from '@/lib/api/utils';
import { uuidSchema } from '@/lib/validation/schemas';

const log = logger('AdminUserAPI');

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase configuration');
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

export async function GET(_request: NextRequest, { params }: { params: { userId: string } }) {
  try {
    // Require admin authentication + view users permission
    const auth = await requireAdmin();
    if (!auth.authorized) return auth.response;
    const perm = checkPermission(auth, 'can_view_users');
    if (!perm.allowed) return perm.response;

    // Rate limit by admin
    const rateLimitResult = await checkRequestRateLimit(
      `admin:user:get:${auth.user.id}`,
      rateLimits.admin
    );
    if (!rateLimitResult.allowed) return rateLimitResult.response;

    const { userId } = params;

    // Validate userId format
    const userIdResult = uuidSchema.safeParse(userId);
    if (!userIdResult.success) {
      return errors.badRequest('Invalid user ID format');
    }

    const supabase = getSupabaseAdmin();

    // Fetch single user by ID
    const { data: user, error } = await supabase
      .from('users')
      .select(
        `
        id,
        email,
        full_name,
        subscription_tier,
        subscription_status,
        messages_used_today,
        images_generated_today,
        total_messages,
        total_images,
        last_message_date,
        stripe_customer_id,
        stripe_subscription_id,
        is_banned,
        ban_reason,
        created_at,
        updated_at,
        last_login_at
      `
      )
      .eq('id', userId)
      .single();

    if (error) {
      log.error('Error fetching user', error instanceof Error ? error : { error });

      if (error.code === 'PGRST116') {
        return errors.notFound('User');
      }

      return errors.serverError();
    }

    // Get conversation count for this user
    const { count: conversationCount } = await supabase
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('deleted_at', null);

    // Get actual message count from messages table
    const { count: actualMessageCount } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('deleted_at', null);

    // Log admin access for audit trail
    log.info(`Admin viewed user: ${userId}`);

    return successResponse({
      user: {
        ...user,
        conversation_count: conversationCount || 0,
        actual_message_count: actualMessageCount || 0,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error('Unexpected error', error instanceof Error ? error : { error });
    captureAPIError(error, '/api/admin/users/[userId]');
    return errors.serverError();
  }
}
