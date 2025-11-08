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
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { userId, role, value } = body;

    // Validate inputs
    if (!userId || !role || value === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, role, value' },
        { status: 400 }
      );
    }

    // Validate role type
    const validRoles = ['is_admin', 'is_moderator', 'is_cyber_analyst'];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: `Invalid role. Must be one of: ${validRoles.join(', ')}` },
        { status: 400 }
      );
    }

    // Prevent self-demotion from admin
    if (userId === session.user.id && role === 'is_admin' && !value) {
      return NextResponse.json(
        { error: 'Cannot remove your own admin privileges' },
        { status: 400 }
      );
    }

    // Update the role
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({ [role]: value })
      .eq('id', userId);

    if (updateError) {
      console.error('[IAM] Update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update role', details: updateError.message },
        { status: 500 }
      );
    }

    // Get updated user for response
    const { data: updatedUser } = await supabase
      .from('user_profiles')
      .select('id, email, subscription_tier, is_admin, is_moderator, is_cyber_analyst')
      .eq('id', userId)
      .single();

    const roleNames = {
      is_admin: 'Admin',
      is_moderator: 'Moderator',
      is_cyber_analyst: 'Cyber Analyst'
    };

    return NextResponse.json({
      success: true,
      message: value
        ? `${roleNames[role as keyof typeof roleNames]} role granted to ${updatedUser?.email}`
        : `${roleNames[role as keyof typeof roleNames]} role removed from ${updatedUser?.email}`,
      user: updatedUser,
    });

  } catch (error: any) {
    console.error('[IAM] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
