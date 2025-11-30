/**
 * ADMIN SINGLE USER API
 * PURPOSE: Fetch a single user by ID with full details
 * SECURITY: Admin authentication required
 */

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin-guard';

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

export async function GET(
  _request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    // Require admin authentication
    const auth = await requireAdmin();
    if (!auth.authorized) return auth.response;

    const { userId } = params;
    const supabase = getSupabaseAdmin();

    // Fetch single user by ID
    const { data: user, error } = await supabase
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
        is_banned,
        ban_reason,
        created_at,
        updated_at,
        last_login_at
      `)
      .eq('id', userId)
      .single();

    if (error) {
      console.error('[Admin API] Error fetching user:', error);

      if (error.code === 'PGRST116') {
        return NextResponse.json(
          {
            error: 'User not found',
            message: 'The requested user does not exist',
            code: 'NOT_FOUND'
          },
          { status: 404 }
        );
      }

      return NextResponse.json(
        {
          error: 'Failed to fetch user',
          message: 'Unable to load user data',
          code: 'DATABASE_ERROR',
          details: error.message
        },
        { status: 500 }
      );
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
    console.log(`[Admin Audit] Admin viewed user: ${userId}`);

    return NextResponse.json({
      user: {
        ...user,
        conversation_count: conversationCount || 0,
        actual_message_count: actualMessageCount || 0,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Admin API] Error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'An unexpected error occurred',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}
