import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();

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
    const { messageIds } = body;

    if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
      return NextResponse.json(
        { error: 'Message IDs array is required' },
        { status: 400 }
      );
    }

    // Delete messages
    const { error: deleteError } = await supabase
      .from('admin_messages')
      .delete()
      .in('id', messageIds);

    if (deleteError) {
      console.error('Error deleting messages:', deleteError);
      return NextResponse.json({ error: 'Failed to delete messages' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `${messageIds.length} message(s) deleted successfully`,
      deletedCount: messageIds.length,
    });
  } catch (error: any) {
    console.error('Delete messages error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
