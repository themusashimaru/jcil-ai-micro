/**
 * ADMIN USER CONVERSATIONS API
 * PURPOSE: Fetch all conversations for a specific user (admin only)
 * SECURITY: Admin authentication required, uses service role key
 */

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin-guard';
import { logger } from '@/lib/logger';

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

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    // Require admin authentication
    const auth = await requireAdmin();
    if (!auth.authorized) return auth.response;

    const { userId } = params;
    const { searchParams } = new URL(request.url);

    // Optional date filtering
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

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
      log.error('Error fetching user conversations', error);
      return NextResponse.json(
        { error: 'Failed to fetch conversations' },
        { status: 500 }
      );
    }

    // Log admin access for audit trail
    log.info(`Admin viewed conversations for user: ${userId}`);

    return NextResponse.json({
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
    log.error('Unexpected error', error as Error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
