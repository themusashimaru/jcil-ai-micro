import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify admin
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { parentMessageId, replyMessage } = body;

    if (!parentMessageId || !replyMessage) {
      return NextResponse.json(
        { error: 'Parent message ID and reply message required' },
        { status: 400 }
      );
    }

    // Get the original message
    const { data: originalMessage, error: fetchError } = await supabase
      .from('admin_messages')
      .select('*')
      .eq('id', parentMessageId)
      .single();

    if (fetchError || !originalMessage) {
      return NextResponse.json({ error: 'Original message not found' }, { status: 404 });
    }

    // Update the original message with reply
    const { error: updateError } = await supabase
      .from('admin_messages')
      .update({
        admin_reply: replyMessage,
        replied_by: user.id,
        replied_at: new Date().toISOString(),
        status: 'replied',
      })
      .eq('id', parentMessageId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // If the original message was from a user, send them a notification
    if (originalMessage.from_user_id) {
      const { error: notifError } = await supabase.from('notifications').insert({
        user_id: originalMessage.from_user_id,
        title: 'Admin Response',
        message: `You have received a response to your inquiry: "${originalMessage.subject}"`,
        tier_filter: null,
      });

      if (notifError) {
        console.error('Error creating notification:', notifError);
      }
    }

    // Create a reply message record for threading
    const { data: replyRecord, error: replyError } = await supabase
      .from('admin_messages')
      .insert({
        message_type: 'user_inquiry',
        category: originalMessage.category,
        from_user_id: user.id, // Admin is now the sender
        subject: `Re: ${originalMessage.subject}`,
        message: replyMessage,
        status: 'read',
        folder: originalMessage.folder,
        parent_message_id: parentMessageId,
        replied_by: user.id,
        replied_at: new Date().toISOString(),
        metadata: {
          is_admin_reply: true,
          original_message_id: parentMessageId,
        },
      })
      .select()
      .single();

    if (replyError) {
      console.error('Error creating reply record:', replyError);
    }

    return NextResponse.json({
      success: true,
      reply: replyRecord,
      notificationSent: !!originalMessage.from_user_id,
    });
  } catch (error: any) {
    console.error('Reply error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
