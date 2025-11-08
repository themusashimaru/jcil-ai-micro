import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
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

    const body = await request.json();
    const { userId, action, duration, reason } = body;

    if (!userId || !action) {
      return NextResponse.json(
        { error: 'Missing required fields: userId and action' },
        { status: 400 }
      );
    }

    let updateData: any = {};

    switch (action) {
      case 'suspend':
        if (!duration) {
          return NextResponse.json(
            { error: 'Duration required for suspension' },
            { status: 400 }
          );
        }

        // Calculate suspension end time
        const now = new Date();
        let suspendedUntil: Date;

        switch (duration) {
          case '1h':
            suspendedUntil = new Date(now.getTime() + 60 * 60 * 1000);
            break;
          case '1d':
            suspendedUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            break;
          case '1w':
            suspendedUntil = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
            break;
          case '1m':
            suspendedUntil = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
            break;
          case '6m':
            suspendedUntil = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);
            break;
          default:
            return NextResponse.json({ error: 'Invalid duration' }, { status: 400 });
        }

        updateData = {
          is_suspended: true,
          suspended_until: suspendedUntil.toISOString(),
          suspension_reason: reason || `Suspended by admin for ${duration}`,
        };
        break;

      case 'ban':
        updateData = {
          is_banned: true,
          banned_at: new Date().toISOString(),
          ban_reason: reason || 'Banned by admin',
          is_suspended: false, // Clear suspension if user is banned
          suspended_until: null,
        };
        break;

      case 'lift':
        updateData = {
          is_suspended: false,
          suspended_until: null,
          suspension_reason: null,
        };
        break;

      case 'unban':
        updateData = {
          is_banned: false,
          banned_at: null,
          ban_reason: null,
        };
        break;

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Add moderation note
    const moderationNote = `[${new Date().toISOString()}] Admin ${session.user.email}: ${action} ${duration ? `for ${duration}` : ''} - ${reason || 'No reason provided'}`;

    // Get existing notes
    const { data: existingProfile } = await supabase
      .from('user_profiles')
      .select('moderation_notes')
      .eq('id', userId)
      .single();

    const existingNotes = existingProfile?.moderation_notes || '';
    updateData.moderation_notes = existingNotes
      ? `${existingNotes}\n${moderationNote}`
      : moderationNote;

    // Update user profile
    const { data, error } = await supabase
      .from('user_profiles')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('[MODERATE] Database error:', error);
      return NextResponse.json(
        { error: 'Failed to update user', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      action,
      user: data,
      message: `User ${action === 'suspend' ? 'suspended' : action === 'ban' ? 'banned' : action === 'lift' ? 'suspension lifted' : 'unbanned'} successfully`,
    });

  } catch (error: any) {
    console.error('[MODERATE] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
