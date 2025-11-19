/**
 * USER NOTIFICATIONS API
 * PURPOSE: Fetch, mark as read, and delete user notifications
 */

import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Get authenticated Supabase client
async function getSupabaseClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Silently handle cookie errors
          }
        },
      },
    }
  );
}

// GET - Fetch user notifications
export async function GET() {
  try {
    const supabase = await getSupabaseClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({
        error: 'Authentication required',
        message: 'Please sign in to view your notifications.',
        code: 'AUTH_REQUIRED'
      }, { status: 401 });
    }

    // Fetch user's notifications
    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[API] Error fetching notifications:', error);
      return NextResponse.json(
        {
          error: 'Unable to load notifications',
          message: 'We encountered an issue loading your notifications. Please try again later.',
          code: 'DATABASE_ERROR'
        },
        { status: 500 }
      );
    }

    // Transform to match frontend interface
    const transformedNotifications = notifications.map(n => ({
      id: n.id,
      type: n.type,
      priority: n.priority,
      title: n.title,
      body: n.body,
      actionUrl: n.action_url,
      actionLabel: n.action_label,
      isRead: n.is_read,
      createdAt: new Date(n.created_at),
      readAt: n.read_at ? new Date(n.read_at) : undefined,
    }));

    const unreadCount = transformedNotifications.filter(n => !n.isRead).length;

    return NextResponse.json({
      notifications: transformedNotifications,
      unreadCount,
      total: transformedNotifications.length,
    });
  } catch (error) {
    console.error('[API] Error:', error);
    return NextResponse.json(
      {
        error: 'Service temporarily unavailable',
        message: 'We are having trouble loading your notifications. Please try again in a moment.',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}

// PATCH - Mark notification as read/unread
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await getSupabaseClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({
        error: 'Authentication required',
        message: 'Please sign in to update notifications.',
        code: 'AUTH_REQUIRED'
      }, { status: 401 });
    }

    const { notificationId, isRead } = await request.json();

    if (!notificationId) {
      return NextResponse.json(
        {
          error: 'Missing notification ID',
          message: 'Please provide a notification ID.',
          code: 'VALIDATION_ERROR'
        },
        { status: 400 }
      );
    }

    // Update notification
    const { error } = await supabase
      .from('notifications')
      .update({
        is_read: isRead,
        read_at: isRead ? new Date().toISOString() : null,
      })
      .eq('id', notificationId)
      .eq('user_id', user.id); // Ensure user owns this notification

    if (error) {
      console.error('[API] Error updating notification:', error);
      return NextResponse.json(
        {
          error: 'Failed to update notification',
          message: 'Unable to update notification status.',
          code: 'DATABASE_ERROR'
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Error:', error);
    return NextResponse.json(
      {
        error: 'Service temporarily unavailable',
        message: 'We are having trouble updating your notification. Please try again in a moment.',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}

// DELETE - Delete notification
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await getSupabaseClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({
        error: 'Authentication required',
        message: 'Please sign in to delete notifications.',
        code: 'AUTH_REQUIRED'
      }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const notificationId = searchParams.get('id');

    if (!notificationId) {
      return NextResponse.json(
        {
          error: 'Missing notification ID',
          message: 'Please provide a notification ID.',
          code: 'VALIDATION_ERROR'
        },
        { status: 400 }
      );
    }

    // Delete notification
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId)
      .eq('user_id', user.id); // Ensure user owns this notification

    if (error) {
      console.error('[API] Error deleting notification:', error);
      return NextResponse.json(
        {
          error: 'Failed to delete notification',
          message: 'Unable to delete notification.',
          code: 'DATABASE_ERROR'
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Error:', error);
    return NextResponse.json(
      {
        error: 'Service temporarily unavailable',
        message: 'We are having trouble deleting your notification. Please try again in a moment.',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}
