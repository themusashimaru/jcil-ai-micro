import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const supabase = await createClient();

  // Check authentication
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check if user is admin
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('is_admin')
    .eq('id', session.user.id)
    .single();

  if (!profile?.is_admin) {
    return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
  }

  try {
    // Get all users with their recent activity
    const { data: users, error: usersError } = await supabase
      .rpc('get_all_users_for_admin');

    if (usersError) {
      console.error('Error fetching users:', usersError);
      throw usersError;
    }

    // Build activity feed from user data
    const activities: any[] = [];

    // Sort users and process them
    const sortedUsers = (users || []).sort((a: any, b: any) => {
      const dateA = new Date(a.last_activity_at || a.created_at || 0).getTime();
      const dateB = new Date(b.last_activity_at || b.created_at || 0).getTime();
      return dateB - dateA; // Most recent first
    });

    // Add recent activity events
    sortedUsers.slice(0, 50).forEach((user: any) => {
      // Recent activity
      if (user.last_activity_at) {
        const activityDate = new Date(user.last_activity_at);
        const now = new Date();
        const hoursDiff = (now.getTime() - activityDate.getTime()) / (1000 * 60 * 60);

        // Only show activity from last 24 hours as "recent"
        if (hoursDiff <= 24) {
          activities.push({
            id: `activity-${user.id}-${activityDate.getTime()}`,
            type: 'activity',
            user: {
              email: user.email,
              tier: user.subscription_tier || 'free',
            },
            timestamp: user.last_activity_at,
            details: {
              messages: user.daily_message_count || 0,
              tokens: user.daily_token_count || 0,
            },
          });
        }
      }

      // User signups
      if (user.created_at) {
        const signupDate = new Date(user.created_at);
        const now = new Date();
        const daysDiff = (now.getTime() - signupDate.getTime()) / (1000 * 60 * 60 * 24);

        // Show signups from last 7 days
        if (daysDiff <= 7) {
          activities.push({
            id: `signup-${user.id}`,
            type: 'signup',
            user: {
              email: user.email,
              tier: user.subscription_tier || 'free',
            },
            timestamp: user.created_at,
          });
        }
      }

      // High usage alerts
      if (user.daily_message_count && user.daily_message_limit) {
        const usagePercent = (user.daily_message_count / user.daily_message_limit) * 100;
        if (usagePercent >= 80 && user.last_activity_at) {
          activities.push({
            id: `usage-${user.id}`,
            type: 'high_usage',
            user: {
              email: user.email,
              tier: user.subscription_tier || 'free',
            },
            timestamp: user.last_activity_at,
            details: {
              usage: user.daily_message_count,
              limit: user.daily_message_limit,
              percent: Math.round(usagePercent),
            },
          });
        }
      }
    });

    // Sort all activities by timestamp
    activities.sort((a, b) => {
      const dateA = new Date(a.timestamp).getTime();
      const dateB = new Date(b.timestamp).getTime();
      return dateB - dateA; // Most recent first
    });

    // Get active users count (active in last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const activeUsers = (users || []).filter((user: any) =>
      user.last_activity_at && new Date(user.last_activity_at) > new Date(oneHourAgo)
    );

    return NextResponse.json({
      activities: activities.slice(0, 100), // Return most recent 100 activities
      stats: {
        activeNow: activeUsers.length,
        totalActivities: activities.length,
      },
    });
  } catch (error: any) {
    console.error('Activity feed error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activity feed', details: error.message },
      { status: 500 }
    );
  }
}
