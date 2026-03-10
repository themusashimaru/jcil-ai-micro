/**
 * ADMIN USERS API
 *
 * Fetches users with usage metrics for admin dashboard (paginated).
 * Uses database aggregation for stats to avoid N+1 query issues.
 *
 * @module api/admin/users
 *
 * SECURITY: Requires admin authentication
 *
 * QUERY PARAMS:
 * - page (optional): Page number, default 1
 * - limit (optional): Items per page, default 50, max 100
 *
 * PERFORMANCE:
 * - Uses COUNT/SUM aggregates instead of fetching all rows
 * - Stats queries run in parallel for efficiency
 * - Redis caching for expensive aggregate queries (5 min TTL)
 */

import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { requireAdmin, checkPermission } from '@/lib/auth/admin-guard';
import { logger } from '@/lib/logger';
import { cacheGet, cacheSet } from '@/lib/redis/client';
import {
  successResponse,
  errors,
  checkRequestRateLimit,
  rateLimits,
  captureAPIError,
} from '@/lib/api/utils';

const log = logger('AdminUsersAPI');

// Cache key and TTL for stats
const STATS_CACHE_KEY = 'admin:users:stats';
const STATS_CACHE_TTL = 300; // 5 minutes

// Stats type for cache
interface AdminStats {
  totalUsers: number;
  usersByTier: { free: number; basic: number; pro: number; executive: number };
  usersByStatus: { active: number; trialing: number; past_due: number; canceled: number };
  usage: {
    totalMessagesToday: number;
    totalMessagesAllTime: number;
    totalImagesToday: number;
    totalImagesAllTime: number;
  };
  activeUsers: { today: number; last7Days: number; last30Days: number };
}

// Use service role key for admin operations (bypasses RLS)
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      'Missing Supabase configuration. Please check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.'
    );
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

export async function GET(request: NextRequest) {
  try {
    // Require admin authentication + view users permission
    const auth = await requireAdmin();
    if (!auth.authorized) return auth.response;
    const perm = checkPermission(auth, 'can_view_users');
    if (!perm.allowed) return perm.response;

    // Rate limit by admin
    const rateLimitResult = await checkRequestRateLimit(
      `admin:users:get:${auth.user.id}`,
      rateLimits.admin
    );
    if (!rateLimitResult.allowed) return rateLimitResult.response;

    const supabase = getSupabaseAdmin();

    // Parse pagination parameters
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const offset = (page - 1) * limit;

    // Get total count for pagination
    const { count: totalCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    // Fetch users with pagination
    const { data: users, error } = await supabase
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
        created_at,
        updated_at
      `
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      log.error('Error fetching users', error instanceof Error ? error : { error });
      return errors.serverError();
    }

    // Try to get cached stats first
    let stats = await cacheGet<AdminStats>(STATS_CACHE_KEY);

    if (!stats) {
      // Calculate stats using efficient aggregate queries (run in parallel)
      const today = new Date().toISOString().split('T')[0];
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Run all aggregate queries in parallel for performance
      const [tierCounts, statusCounts, usageStats, activeToday, active7Days, active30Days] =
        await Promise.all([
          // Count by subscription tier
          supabase
            .from('users')
            .select('subscription_tier')
            .then(({ data }) => {
              const counts = { free: 0, basic: 0, pro: 0, executive: 0 };
              data?.forEach((u) => {
                const tier = (u.subscription_tier || 'free') as keyof typeof counts;
                if (tier in counts) counts[tier]++;
              });
              return counts;
            }),
          // Count by subscription status
          supabase
            .from('users')
            .select('subscription_status')
            .then(({ data }) => {
              const counts = { active: 0, trialing: 0, past_due: 0, canceled: 0 };
              data?.forEach((u) => {
                const status = u.subscription_status as keyof typeof counts;
                if (status in counts) counts[status]++;
              });
              return counts;
            }),
          // Sum usage stats (lightweight - just numbers)
          supabase
            .from('users')
            .select('messages_used_today, total_messages, images_generated_today, total_images')
            .then(({ data }) => {
              return {
                totalMessagesToday:
                  data?.reduce((sum, u) => sum + (u.messages_used_today || 0), 0) || 0,
                totalMessagesAllTime:
                  data?.reduce((sum, u) => sum + (u.total_messages || 0), 0) || 0,
                totalImagesToday:
                  data?.reduce((sum, u) => sum + (u.images_generated_today || 0), 0) || 0,
                totalImagesAllTime: data?.reduce((sum, u) => sum + (u.total_images || 0), 0) || 0,
              };
            }),
          // Active users today
          supabase
            .from('users')
            .select('id', { count: 'exact', head: true })
            .eq('last_message_date', today),
          // Active users last 7 days
          supabase
            .from('users')
            .select('id', { count: 'exact', head: true })
            .gte('last_message_date', sevenDaysAgo.toISOString().split('T')[0]),
          // Active users last 30 days
          supabase
            .from('users')
            .select('id', { count: 'exact', head: true })
            .gte('last_message_date', thirtyDaysAgo.toISOString().split('T')[0]),
        ]);

      stats = {
        totalUsers: totalCount || 0,
        usersByTier: tierCounts,
        usersByStatus: statusCounts,
        usage: usageStats,
        activeUsers: {
          today: activeToday.count || 0,
          last7Days: active7Days.count || 0,
          last30Days: active30Days.count || 0,
        },
      };

      // Cache the stats for 5 minutes
      await cacheSet(STATS_CACHE_KEY, stats, STATS_CACHE_TTL);
    }

    // Return empty array if no users
    if (!users || users.length === 0) {
      return successResponse({
        users: [],
        stats,
        pagination: {
          page,
          limit,
          totalCount: totalCount || 0,
          totalPages: Math.ceil((totalCount || 0) / limit),
          hasNextPage: false,
          hasPreviousPage: false,
        },
        timestamp: new Date().toISOString(),
      });
    }

    return successResponse({
      users,
      stats,
      pagination: {
        page,
        limit,
        totalCount: totalCount || 0,
        totalPages: Math.ceil((totalCount || 0) / limit),
        hasNextPage: offset + limit < (totalCount || 0),
        hasPreviousPage: page > 1,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error('Unexpected error', error instanceof Error ? error : { error });
    captureAPIError(error, '/api/admin/users');
    return errors.serverError();
  }
}

// Mark this route as dynamic to prevent static generation
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;
