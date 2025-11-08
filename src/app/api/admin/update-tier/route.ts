import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const VALID_TIERS = ['free', 'basic', 'pro', 'executive'];

const TIER_LIMITS: Record<string, number> = {
  free: 10,
  basic: 100,
  pro: 500,
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

  // Create service role client to bypass RLS for admin operations
  const supabaseAdmin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );

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

    // Use service role client to update (bypasses RLS)
    const { data: existingProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .eq('id', userId)
      .single();

    let result;

    if (existingProfile) {
      // Update existing profile
      const { data, error } = await supabaseAdmin
        .from('user_profiles')
        .update({
          subscription_tier: tier,
          daily_message_limit: TIER_LIMITS[tier],
        })
        .eq('id', userId)
        .select();

      if (error) {
        console.error('Error updating user tier:', error);
        throw error;
      }
      result = data;
    } else {
      // Create new profile
      const { data, error } = await supabaseAdmin
        .from('user_profiles')
        .insert({
          id: userId,
          subscription_tier: tier,
          daily_message_limit: TIER_LIMITS[tier],
        })
        .select();

      if (error) {
        console.error('Error creating user profile:', error);
        throw error;
      }
      result = data;
    }

    console.log('✅ User tier updated:', { userId, tier, result });

    return NextResponse.json({
      success: true,
      message: `User tier updated to ${tier}`,
      data: result,
    });
  } catch (error: any) {
    console.error('Admin update tier error:', error);
    return NextResponse.json(
      {
        error: 'Failed to update user tier',
        details: error.message,
        fullError: JSON.stringify(error),
        code: error.code,
        hint: error.hint
      },
      { status: 500 }
    );
  }
}
