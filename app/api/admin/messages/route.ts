/**
 * ADMIN MESSAGES API
 * GET - List all sent messages
 * POST - Send new message to users
 */

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin-guard';
import { logger } from '@/lib/logger';

const log = logger('AdminMessages');

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

const VALID_MESSAGE_TYPES = [
  'general',
  'account',
  'feature',
  'maintenance',
  'promotion',
  'support_response',
  'welcome',
  'warning',
];

const VALID_PRIORITIES = ['low', 'normal', 'high', 'urgent'];
const VALID_TIERS = ['free', 'basic', 'pro', 'executive', 'all'];

/**
 * GET - List sent messages
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.authorized) return auth.response;

    const supabase = getSupabaseAdmin();
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    // Get messages
    const { data: messages, error, count } = await supabase
      .from('user_messages')
      .select(`
        id,
        recipient_user_id,
        recipient_tier,
        sender_admin_email,
        subject,
        message,
        message_type,
        priority,
        is_broadcast,
        broadcast_sent_count,
        created_at,
        expires_at
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      log.error('[Admin Messages API] Error:', error instanceof Error ? error : { error });
      return NextResponse.json(
        { error: 'Failed to fetch messages' },
        { status: 500 }
      );
    }

    // For individual messages, get recipient info
    const individualMessages = messages?.filter(m => m.recipient_user_id) || [];
    const userIds = individualMessages.map(m => m.recipient_user_id);

    let usersMap: Record<string, { email: string; full_name: string | null }> = {};
    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, email, full_name')
        .in('id', userIds);

      if (users) {
        usersMap = users.reduce((acc, u) => {
          acc[u.id] = { email: u.email, full_name: u.full_name };
          return acc;
        }, {} as typeof usersMap);
      }
    }

    const messagesWithRecipients = messages?.map(m => ({
      ...m,
      recipient: m.recipient_user_id
        ? usersMap[m.recipient_user_id]
        : { tier: m.recipient_tier },
    }));

    return NextResponse.json({
      messages: messagesWithRecipients || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    log.error('[Admin Messages API] Error:', error instanceof Error ? error : { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST - Send new message
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.authorized) return auth.response;

    const supabase = getSupabaseAdmin();

    // Get admin details for sender info
    const { data: adminData } = await supabase
      .from('admin_users')
      .select('id, email')
      .eq('id', auth.adminUser.id)
      .single();

    const adminEmail = adminData?.email || auth.user.email || 'admin@jcil.ai';
    const adminId = auth.adminUser.id;

    const body = await request.json();
    const {
      recipient_type, // 'individual' or 'broadcast'
      recipient_user_id, // For individual messages
      recipient_email, // Alternative way to specify individual
      recipient_tier, // For broadcasts: 'free', 'basic', 'pro', 'executive', 'all'
      subject,
      message,
      message_type = 'general',
      priority = 'normal',
      expires_at,
    } = body;

    // Validate required fields
    if (!subject?.trim() || !message?.trim()) {
      return NextResponse.json(
        { error: 'Subject and message are required' },
        { status: 400 }
      );
    }

    if (!VALID_MESSAGE_TYPES.includes(message_type)) {
      return NextResponse.json(
        { error: 'Invalid message type' },
        { status: 400 }
      );
    }

    if (!VALID_PRIORITIES.includes(priority)) {
      return NextResponse.json(
        { error: 'Invalid priority' },
        { status: 400 }
      );
    }

    let finalRecipientUserId: string | null = null;
    let finalRecipientTier: string | null = null;
    let isBroadcast = false;
    let broadcastSentCount = 0;

    if (recipient_type === 'individual') {
      // Individual message
      if (recipient_user_id) {
        // Verify user exists
        const { data: targetUser } = await supabase
          .from('users')
          .select('id')
          .eq('id', recipient_user_id)
          .single();

        if (!targetUser) {
          return NextResponse.json(
            { error: 'User not found' },
            { status: 404 }
          );
        }
        finalRecipientUserId = recipient_user_id;
      } else if (recipient_email) {
        // Look up user by email
        const { data: targetUser } = await supabase
          .from('users')
          .select('id')
          .eq('email', recipient_email.toLowerCase().trim())
          .single();

        if (!targetUser) {
          return NextResponse.json(
            { error: 'User not found with that email' },
            { status: 404 }
          );
        }
        finalRecipientUserId = targetUser.id;
      } else {
        return NextResponse.json(
          { error: 'Recipient user ID or email required for individual messages' },
          { status: 400 }
        );
      }
    } else if (recipient_type === 'broadcast') {
      // Broadcast message
      if (!recipient_tier || !VALID_TIERS.includes(recipient_tier)) {
        return NextResponse.json(
          { error: 'Valid recipient tier required for broadcasts' },
          { status: 400 }
        );
      }

      isBroadcast = true;
      finalRecipientTier = recipient_tier;

      // Count how many users will receive this
      let countQuery = supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true)
        .eq('is_banned', false);

      if (recipient_tier !== 'all') {
        countQuery = countQuery.eq('subscription_tier', recipient_tier);
      }

      const { count } = await countQuery;
      broadcastSentCount = count || 0;

      if (broadcastSentCount === 0) {
        return NextResponse.json(
          { error: 'No users found matching the selected tier' },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { error: 'Invalid recipient type. Use "individual" or "broadcast"' },
        { status: 400 }
      );
    }

    // Create the message
    const { data: newMessage, error: insertError } = await supabase
      .from('user_messages')
      .insert({
        recipient_user_id: finalRecipientUserId,
        recipient_tier: finalRecipientTier,
        sender_admin_id: adminId,
        sender_admin_email: adminEmail,
        subject: subject.trim(),
        message: message.trim(),
        message_type,
        priority,
        is_broadcast: isBroadcast,
        broadcast_sent_count: broadcastSentCount,
        expires_at: expires_at || null,
      })
      .select('id, created_at')
      .single();

    if (insertError) {
      log.error('[Admin Messages API] Insert error:', { error: insertError ?? 'Unknown error' });
      return NextResponse.json(
        { error: 'Failed to send message' },
        { status: 500 }
      );
    }

    const recipientDescription = isBroadcast
      ? `${broadcastSentCount} users (${recipient_tier})`
      : `1 user`;

    log.info(`[Admin Messages API] Message sent by ${adminEmail} to ${recipientDescription}`);

    return NextResponse.json({
      success: true,
      message: newMessage,
      recipientCount: isBroadcast ? broadcastSentCount : 1,
    });
  } catch (error) {
    log.error('[Admin Messages API] Error:', error instanceof Error ? error : { error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
