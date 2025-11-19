/**
 * ADMIN NOTIFICATIONS API
 * PURPOSE: Send notifications to users by tier, all users, or individuals
 * SECURITY: Requires admin authentication
 */

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin-guard';
import { validateRequestSize, SIZE_LIMITS } from '@/lib/security/request-size';

// Use service role key for admin operations
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase configuration. Please check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

// Mark this route as dynamic to prevent static generation
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface SendNotificationRequest {
  title: string;
  body: string;
  type: 'system' | 'admin' | 'billing' | 'feature';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  actionUrl?: string;
  actionLabel?: string;
  // Target selection
  targetType: 'all' | 'tier' | 'individual';
  targetTier?: 'free' | 'basic' | 'pro' | 'executive';
  targetUserIds?: string[];
}

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Require admin authentication + CSRF protection
    const auth = await requireAdmin(request);
    if (!auth.authorized) return auth.response;

    const body: SendNotificationRequest = await request.json();

    // SECURITY: Validate request size to prevent DoS attacks
    const sizeCheck = validateRequestSize(body, SIZE_LIMITS.SMALL);
    if (!sizeCheck.valid) return sizeCheck.response;
    const {
      title,
      body: notificationBody,
      type,
      priority,
      actionUrl,
      actionLabel,
      targetType,
      targetTier,
      targetUserIds,
    } = body;

    // Validate required fields
    if (!title || !notificationBody || !type || !priority || !targetType) {
      return NextResponse.json(
        {
          error: 'Missing required fields',
          message: 'Please provide title, body, type, priority, and targetType.',
          code: 'VALIDATION_ERROR'
        },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Determine target users
    let targetUsers: string[] = [];

    if (targetType === 'all') {
      // Get all user IDs
      const { data: users, error } = await supabase
        .from('users')
        .select('id');

      if (error) {
        console.error('[Admin API] Error fetching all users:', error);
        return NextResponse.json(
          {
            error: 'Failed to fetch users',
            message: 'Unable to retrieve user list.',
            code: 'DATABASE_ERROR'
          },
          { status: 500 }
        );
      }

      targetUsers = users.map(u => u.id);
    } else if (targetType === 'tier') {
      // Get users by subscription tier
      if (!targetTier) {
        return NextResponse.json(
          {
            error: 'Missing tier',
            message: 'Please specify targetTier when using tier targetType.',
            code: 'VALIDATION_ERROR'
          },
          { status: 400 }
        );
      }

      const { data: users, error } = await supabase
        .from('users')
        .select('id')
        .eq('subscription_tier', targetTier);

      if (error) {
        console.error('[Admin API] Error fetching users by tier:', error);
        return NextResponse.json(
          {
            error: 'Failed to fetch users',
            message: 'Unable to retrieve users for the specified tier.',
            code: 'DATABASE_ERROR'
          },
          { status: 500 }
        );
      }

      targetUsers = users.map(u => u.id);
    } else if (targetType === 'individual') {
      // Use provided user IDs
      if (!targetUserIds || targetUserIds.length === 0) {
        return NextResponse.json(
          {
            error: 'Missing user IDs',
            message: 'Please specify targetUserIds when using individual targetType.',
            code: 'VALIDATION_ERROR'
          },
          { status: 400 }
        );
      }

      targetUsers = targetUserIds;
    }

    if (targetUsers.length === 0) {
      return NextResponse.json(
        {
          error: 'No recipients',
          message: 'No users found matching the specified criteria.',
          code: 'NO_RECIPIENTS'
        },
        { status: 400 }
      );
    }

    // Create notifications for all target users
    const notifications = targetUsers.map(userId => ({
      user_id: userId,
      type,
      priority,
      title,
      body: notificationBody,
      action_url: actionUrl || null,
      action_label: actionLabel || null,
      is_read: false,
      created_at: new Date().toISOString(),
    }));

    const { error: insertError, data: insertedNotifications } = await supabase
      .from('notifications')
      .insert(notifications)
      .select();

    if (insertError) {
      console.error('[Admin API] Error creating notifications:', insertError);
      return NextResponse.json(
        {
          error: 'Failed to send notifications',
          message: 'An error occurred while creating notifications. Please try again.',
          code: 'DATABASE_ERROR'
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Successfully sent ${targetUsers.length} notification(s)`,
      count: targetUsers.length,
      notificationIds: insertedNotifications?.map(n => n.id) || [],
    });
  } catch (error) {
    console.error('[Admin API] Error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'An unexpected error occurred. Please try again.',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}

// GET endpoint to fetch notification history
export async function GET() {
  try {
    // TODO: Add admin authentication check here

    const supabase = getSupabaseAdmin();

    // Fetch recent notifications with user count
    const { data: notifications, error } = await supabase
      .from('notifications')
      .select(`
        id,
        type,
        priority,
        title,
        body,
        action_url,
        action_label,
        created_at,
        user_id
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('[Admin API] Error fetching notifications:', error);
      return NextResponse.json(
        {
          error: 'Failed to fetch notifications',
          message: 'Unable to load notification history.',
          code: 'DATABASE_ERROR'
        },
        { status: 500 }
      );
    }

    // Define interface for grouped notifications
    interface GroupedNotification {
      id: string;
      type: string;
      priority: string;
      title: string;
      body: string;
      action_url: string | null;
      action_label: string | null;
      created_at: string;
      user_id: string;
      recipientCount: number;
      userIds: string[];
    }

    // Group notifications by unique title+body+type to show broadcast stats
    const grouped = notifications.reduce((acc, notif) => {
      const key = `${notif.title}-${notif.body}-${notif.type}`;
      if (!acc[key]) {
        acc[key] = {
          ...notif,
          recipientCount: 1,
          userIds: [notif.user_id],
        };
      } else {
        acc[key].recipientCount++;
        acc[key].userIds.push(notif.user_id);
      }
      return acc;
    }, {} as Record<string, GroupedNotification>);

    const history = Object.values(grouped).sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return NextResponse.json({
      notifications: history,
      total: history.length,
    });
  } catch (error) {
    console.error('[Admin API] Error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'An unexpected error occurred. Please try again.',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}
