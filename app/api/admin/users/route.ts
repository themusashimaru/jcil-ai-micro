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

    // Fetch ALL users for accurate stats (separate query without pagination)
    const { data: allUsers, error: allUsersError } = await supabase
      .from('users')
      .select(`
        subscription_tier,
        subscription_status,
        messages_used_today,
        images_generated_today,
        total_messages,
        total_images,
        last_message_date
      `);

    if (allUsersError) {
      console.error('[Admin API] Error fetching all users for stats:', allUsersError);
    }

    const statsUsers = allUsers || users || [];
    const today = new Date().toISOString().split('T')[0];
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Calculate aggregate statistics from ALL users
    const stats = {
      totalUsers: totalCount || statsUsers.length,
      usersByTier: {
        free: statsUsers.filter(u => (u.subscription_tier || 'free') === 'free').length,
        basic: statsUsers.filter(u => u.subscription_tier === 'basic').length,
        pro: statsUsers.filter(u => u.subscription_tier === 'pro').length,
        executive: statsUsers.filter(u => u.subscription_tier === 'executive').length,
      },
      usersByStatus: {
        active: statsUsers.filter(u => u.subscription_status === 'active').length,
        trialing: statsUsers.filter(u => u.subscription_status === 'trialing').length,
        past_due: statsUsers.filter(u => u.subscription_status === 'past_due').length,
        canceled: statsUsers.filter(u => u.subscription_status === 'canceled').length,
      },
      usage: {
        totalMessagesToday: statsUsers.reduce((sum, u) => sum + (u.messages_used_today || 0), 0),
        totalMessagesAllTime: statsUsers.reduce((sum, u) => sum + (u.total_messages || 0), 0),
        totalImagesToday: statsUsers.reduce((sum, u) => sum + (u.images_generated_today || 0), 0),
        totalImagesAllTime: statsUsers.reduce((sum, u) => sum + (u.total_images || 0), 0),
      },
      activeUsers: {
        today: statsUsers.filter(u => u.last_message_date === today).length,
        last7Days: statsUsers.filter(u => {
          if (!u.last_message_date) return false;
          const lastActive = new Date(u.last_message_date);
          return lastActive >= sevenDaysAgo;
        }).length,
        last30Days: statsUsers.filter(u => {
          if (!u.last_message_date) return false;
          const lastActive = new Date(u.last_message_date);
          return lastActive >= thirtyDaysAgo;
        }).length,
      },
    };

    // Return empty array if no users
    if (!users || users.length === 0) {
      return NextResponse.json({
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
