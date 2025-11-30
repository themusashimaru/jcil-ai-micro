/**
 * Passkey Management API
 * GET /api/auth/webauthn/passkeys - List user's passkeys
 * DELETE /api/auth/webauthn/passkeys - Remove a passkey
 */

import { NextRequest, NextResponse } from 'next/server';
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

/**
 * GET - List user's registered passkeys
 */
export async function GET() {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const { data: passkeys, error } = await supabase
      .from('user_passkeys')
      .select('id, device_name, created_at, last_used_at')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch passkeys:', error);
      return NextResponse.json(
        { error: 'Failed to fetch passkeys' },
        { status: 500 }
      );
    }

    return NextResponse.json({ passkeys: passkeys || [] });
  } catch (error) {
    console.error('Passkey list error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch passkeys' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Remove a passkey
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const passkeyId = searchParams.get('id');

    if (!passkeyId) {
      return NextResponse.json(
        { error: 'Passkey ID required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    // Delete the passkey (RLS ensures user can only delete their own)
    const { error } = await supabase
      .from('user_passkeys')
      .delete()
      .eq('id', passkeyId)
      .eq('user_id', session.user.id);

    if (error) {
      console.error('Failed to delete passkey:', error);
      return NextResponse.json(
        { error: 'Failed to delete passkey' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Passkey delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete passkey' },
      { status: 500 }
    );
  }
}
