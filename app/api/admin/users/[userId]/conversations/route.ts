/**
 * ADMIN USER CONVERSATIONS API
 * PURPOSE: Fetch all conversations for a specific user (admin only)
 * SECURITY: Admin authentication required, uses service role key
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
import {
  uuidSchema,
  adminEarningsQuerySchema,
  validateQuery,
  validationErrorResponse,
} from '@/lib/validation/schemas';

const log = logger('AdminUserConversationsAPI');

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

export async function GET(request: NextRequest, { params }: { params: { userId: string } }) {
  try {
    // Require admin authentication + view conversations permission
    const auth = await requireAdmin();
    if (!auth.authorized) return auth.response;
    const perm = checkPermission(auth, 'can_view_conversations');
    if (!perm.allowed) return perm.response;

    // Rate limit by admin
    const rateLimitResult = await checkRequestRateLimit(
      `admin:user:conversations:${auth.user.id}`,
      rateLimits.admin
    );
    if (!rateLimitResult.allowed) return rateLimitResult.response;

    const { userId } = params;

    // Validate userId format
    const userIdResult = uuidSchema.safeParse(userId);
    if (!userIdResult.success) {
      return errors.badRequest('Invalid user ID format');
    }

    // Validate query params
    const { searchParams } = new URL(request.url);
    const validation = validateQuery(adminEarningsQuerySchema, searchParams);
    if (!validation.success) {
      return errors.badRequest(
        validationErrorResponse(validation.error, validation.details).message
      );
    }
    const { startDate, endDate } = validation.data;

    const supabase = getSupabaseAdmin();

    // Build query
    let query = supabase
      .from('conversations')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('last_message_at', { ascending: false });

    // Apply date filters if provided
    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      // Add one day to include the end date
      const endDateTime = new Date(endDate);
      endDateTime.setDate(endDateTime.getDate() + 1);
      query = query.lt('created_at', endDateTime.toISOString());
    }

    const { data: conversations, error } = await query;

    if (error) {
      log.error('Error fetching user conversations', error instanceof Error ? error : { error });
      return errors.serverError();
    }

    // Log admin access for audit trail
    log.info(`Admin viewed conversations for user: ${userId}`);

    return successResponse({
      conversations: conversations || [],
      count: conversations?.length || 0,
      userId,
      filters: {
        startDate: startDate || null,
        endDate: endDate || null,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error('Unexpected error', error instanceof Error ? error : { error });
    captureAPIError(error, '/api/admin/users/[userId]/conversations');
    return errors.serverError();
  }
}
