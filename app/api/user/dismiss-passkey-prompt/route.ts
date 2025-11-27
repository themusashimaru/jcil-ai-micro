/**
 * Dismiss Passkey Prompt API
 * POST /api/user/dismiss-passkey-prompt
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from '@/lib/supabase/server-auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST() {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
