/**
 * USER MESSAGE DETAIL API
 * GET - Get single message
 * PATCH - Update message status (read, starred)
 * DELETE - Soft delete message for user
 */

import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';
import { validateCSRF } from '@/lib/security/csrf';

const log = logger('MessageDetailAPI');

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase configuration');
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

async function getAuthenticatedClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Silently handle cookie errors
          }
        },
      },
    }
  );
}

interface RouteParams {
  params: Promise<{ messageId: string }>;
}

/**
 * GET - Get single message details
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { messageId } = await params;

    const authClient = await getAuthenticatedClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    // Get user's tier
    const { data: userData } = await supabase
      .from('users')
      .select('subscription_tier')
      .eq('id', user.id)
      .single();

    const userTier = userData?.subscription_tier || 'free';

    // Get the message
    const { data: message, error: messageError } = await supabase
      .from('user_messages')
      .select('*')
      .eq('id', messageId)
      .single();

    if (messageError || !message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    // Verify user can access this message
    const isDirectMessage = message.recipient_user_id === user.id;
    const isBroadcast = message.is_broadcast &&
      (message.recipient_tier === 'all' || message.recipient_tier === userTier);

    if (!isDirectMessage && !isBroadcast) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get status
    const { data: status } = await supabase
      .from('user_message_status')
      .select('is_read, is_starred, is_deleted, read_at')
      .eq('message_id', messageId)
      .eq('user_id', user.id)
      .single();

    // Check if deleted
    if (status?.is_deleted) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    // Auto-mark as read when viewing
    if (!status?.is_read) {
      await supabase
        .from('user_message_status')
        .upsert({
          message_id: messageId,
          user_id: user.id,
          is_read: true,
          read_at: new Date().toISOString(),
        }, {
          onConflict: 'message_id,user_id',
        });
    }

    return NextResponse.json({
      message: {
        ...message,
        is_read: true, // Now read
        is_starred: status?.is_starred || false,
      },
    });
  } catch (error) {
    log.error('[Message Detail API] Error:', error instanceof Error ? error : { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Update message status
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  // SECURITY: CSRF protection for state-changing operation
  const csrfCheck = validateCSRF(request);
  if (!csrfCheck.valid) {
    return csrfCheck.response!;
  }

  try {
    const { messageId } = await params;
    const body = await request.json();
    const { is_read, is_starred } = body;

    const authClient = await getAuthenticatedClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    // Build update object
    const updates: Record<string, unknown> = {};
    if (typeof is_read === 'boolean') {
      updates.is_read = is_read;
      if (is_read) {
        updates.read_at = new Date().toISOString();
      }
    }
    if (typeof is_starred === 'boolean') {
      updates.is_starred = is_starred;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid updates provided' }, { status: 400 });
    }

    // Upsert status
    const { error: updateError } = await supabase
      .from('user_message_status')
      .upsert({
        message_id: messageId,
        user_id: user.id,
        ...updates,
      }, {
        onConflict: 'message_id,user_id',
      });

    if (updateError) {
      log.error('[Message Detail API] Update error:', updateError instanceof Error ? updateError : { updateError });
      return NextResponse.json(
        { error: 'Failed to update message' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error('[Message Detail API] Error:', error instanceof Error ? error : { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Soft delete message for user
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  // SECURITY: CSRF protection for state-changing operation
  const csrfCheck = validateCSRF(request);
  if (!csrfCheck.valid) {
    return csrfCheck.response!;
  }

  try {
    const { messageId } = await params;

    const authClient = await getAuthenticatedClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();

    // Soft delete - mark as deleted for this user
    const { error: deleteError } = await supabase
      .from('user_message_status')
      .upsert({
        message_id: messageId,
        user_id: user.id,
        is_deleted: true,
        deleted_at: new Date().toISOString(),
      }, {
        onConflict: 'message_id,user_id',
      });

    if (deleteError) {
      log.error('[Message Detail API] Delete error:', deleteError instanceof Error ? deleteError : { deleteError });
      return NextResponse.json(
        { error: 'Failed to delete message' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error('[Message Detail API] Error:', error instanceof Error ? error : { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
