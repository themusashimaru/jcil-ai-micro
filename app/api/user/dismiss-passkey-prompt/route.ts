/**
 * Dismiss Passkey Prompt API
 * POST /api/user/dismiss-passkey-prompt
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from '@/lib/supabase/server-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Create Supabase client inside functions to avoid build-time initialization
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase configuration');
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

export async function POST() {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    // Update user's passkey prompt dismissed flag
    await supabase
      .from('users')
      .update({ passkey_prompt_dismissed: true })
      .eq('id', session.user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to dismiss passkey prompt:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
