import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

const VALID_TIERS = ['free', 'basic', 'pro', 'premium', 'executive'];

const TIER_LIMITS: Record<string, number> = {
  free: 10,
  basic: 100,
  pro: 100,
  premium: 500,
  executive: 2000,
};

export async function POST(request: Request) {
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
    const body = await request.json();
    const { userId, tier } = body;

    // Validate input
    if (!userId || !tier) {
      return NextResponse.json({ error: 'Missing userId or tier' }, { status: 400 });
    }

    if (!VALID_TIERS.includes(tier)) {
      return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
    }

    // Update user's subscription tier and daily message limit
    // Use upsert to handle both new and existing profiles
    const { data, error } = await supabase
      .from('user_profiles')
      .upsert({
        id: userId,
        subscription_tier: tier,
        daily_message_limit: TIER_LIMITS[tier],
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'id'
      })
      .select();

    if (error) {
      console.error('Error updating user tier:', error);
      throw error;
    }

    console.log('✅ User tier updated:', { userId, tier, data });

    return NextResponse.json({
      success: true,
      message: `User tier updated to ${tier}`,
      data: data,
    });
  } catch (error: any) {
    console.error('Admin update tier error:', error);
    return NextResponse.json(
      { error: 'Failed to update user tier', details: error.message },
      { status: 500 }
    );
  }
}
