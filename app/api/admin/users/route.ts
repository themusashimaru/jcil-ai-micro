/**
 * ADMIN USERS API
 * PURPOSE: Fetch users with usage metrics for admin dashboard (paginated)
 * SECURITY: Requires admin authentication
 * QUERY PARAMS:
 * - page (optional): Page number, default 1
 * - limit (optional): Items per page, default 50, max 100
 */

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin-guard';

// Use service role key for admin operations (bypasses RLS)
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase configuration. Please check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

export async function GET(request: NextRequest) {
  try {
    // Require admin authentication
    const auth = await requireAdmin();
    if (!auth.authorized) return auth.response;

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
      .select(`
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
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[Admin API] Error fetching users:', error);
      return NextResponse.json(
        {
          error: 'Failed to fetch users',
          message: 'Unable to load user data. Please try again.',
          code: 'DATABASE_ERROR',
          details: error.message
        },
        { status: 500 }
      );
    }

    // Return empty array if no users
    if (!users || users.length === 0) {
      return NextResponse.json({
        users: [],
        stats: {
          totalUsers: 0,
          usersByTier: { free: 0, basic: 0, pro: 0, executive: 0 },
          usersByStatus: { active: 0, trialing: 0, past_due: 0, canceled: 0 },
          usage: { totalMessagesToday: 0, totalMessagesAllTime: 0, totalImagesToday: 0, totalImagesAllTime: 0 },
          activeUsers: { today: 0, last7Days: 0, last30Days: 0 },
        },
        pagination: {
          page,
          limit,
          totalCount: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
        timestamp: new Date().toISOString(),
      });
    }

    // Calculate aggregate statistics
    const stats = {
      totalUsers: users.length,
      usersByTier: {
        free: users.filter(u => (u.subscription_tier || 'free') === 'free').length,
        basic: users.filter(u => u.subscription_tier === 'basic').length,
        pro: users.filter(u => u.subscription_tier === 'pro').length,
        executive: users.filter(u => u.subscription_tier === 'executive').length,
      },
      usersByStatus: {
        active: users.filter(u => u.subscription_status === 'active').length,
        trialing: users.filter(u => u.subscription_status === 'trialing').length,
        past_due: users.filter(u => u.subscription_status === 'past_due').length,
        canceled: users.filter(u => u.subscription_status === 'canceled').length,
      },
      usage: {
        totalMessagesToday: users.reduce((sum, u) => sum + (u.messages_used_today || 0), 0),
        totalMessagesAllTime: users.reduce((sum, u) => sum + (u.total_messages || 0), 0),
        totalImagesToday: users.reduce((sum, u) => sum + (u.images_generated_today || 0), 0),
        totalImagesAllTime: users.reduce((sum, u) => sum + (u.total_images || 0), 0),
      },
      activeUsers: {
        today: users.filter(u => u.last_message_date === new Date().toISOString().split('T')[0]).length,
        last7Days: users.filter(u => {
          if (!u.last_message_date) return false;
          const lastActive = new Date(u.last_message_date);
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          return lastActive >= sevenDaysAgo;
        }).length,
        last30Days: users.filter(u => {
          if (!u.last_message_date) return false;
          const lastActive = new Date(u.last_message_date);
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          return lastActive >= thirtyDaysAgo;
        }).length,
      },
    };

    return NextResponse.json({
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
    console.error('[Admin API] Error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}

// Mark this route as dynamic to prevent static generation
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
