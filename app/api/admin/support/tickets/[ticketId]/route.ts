/**
 * ADMIN SINGLE TICKET API
 * GET - Get ticket details with replies
 * PATCH - Update ticket status/properties
 * POST - Add a reply to the ticket
 */

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin-guard';

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

/**
 * GET - Get ticket details with all replies
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { ticketId: string } }
) {
  try {
    const auth = await requireAdmin();
    if (!auth.authorized) return auth.response;

    const { ticketId } = params;
    const supabase = getSupabaseAdmin();

    // Get ticket details
    const { data: ticket, error: ticketError } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('id', ticketId)
      .single();

    if (ticketError || !ticket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      );
    }

    // Mark as read if not already
    if (!ticket.is_read) {
      await supabase
        .from('support_tickets')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', ticketId);
      ticket.is_read = true;
      ticket.read_at = new Date().toISOString();
    }

    // Get user details if internal ticket
    let user = null;
    if (ticket.user_id) {
      const { data: userData } = await supabase
        .from('users')
        .select('id, email, full_name, subscription_tier, total_messages, created_at')
        .eq('id', ticket.user_id)
        .single();
      user = userData;
    }

    // Get all replies
    const { data: replies, error: repliesError } = await supabase
      .from('support_replies')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });

    if (repliesError) {
      console.error('[Admin Support API] Error fetching replies:', repliesError);
    }

    // Log admin access
    console.log(`[Admin Audit] Admin viewed ticket: ${ticketId}`);

    return NextResponse.json({
      ticket: {
        ...ticket,
        user,
      },
      replies: replies || [],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Admin Support API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Update ticket properties
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { ticketId: string } }
) {
  try {
    const auth = await requireAdmin();
    if (!auth.authorized) return auth.response;

    const { ticketId } = params;
    const body = await request.json();

    const allowedFields = ['status', 'priority', 'is_starred', 'is_archived', 'assigned_to'];
    const updates: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    // Set resolved_at when status changes to resolved or closed
    if (body.status === 'resolved' || body.status === 'closed') {
      updates.resolved_at = new Date().toISOString();
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { data: ticket, error } = await supabase
      .from('support_tickets')
      .update(updates)
      .eq('id', ticketId)
      .select()
      .single();

    if (error) {
      console.error('[Admin Support API] Error updating ticket:', error);
      return NextResponse.json(
        { error: 'Failed to update ticket' },
        { status: 500 }
      );
    }

    console.log(`[Admin Audit] Ticket ${ticketId} updated:`, updates);

    return NextResponse.json({ ticket, success: true });
  } catch (error) {
    console.error('[Admin Support API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST - Add a reply to the ticket
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { ticketId: string } }
) {
  try {
    const auth = await requireAdmin();
    if (!auth.authorized) return auth.response;

    const { ticketId } = params;
    const body = await request.json();
    const { message, isInternalNote, deliveryMethod } = body;

    if (!message?.trim()) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Get admin info
    const { data: adminData } = await supabase
      .from('admin_users')
      .select('id, email')
      .eq('email', auth.user.email)
      .single();

    // Create the reply
    const { data: reply, error } = await supabase
      .from('support_replies')
      .insert({
        ticket_id: ticketId,
        admin_id: adminData?.id || null,
        admin_email: auth.user.email,
        message: message.trim(),
        is_internal_note: isInternalNote || false,
        delivery_method: deliveryMethod || (isInternalNote ? null : 'in_app'),
      })
      .select()
      .single();

    if (error) {
      console.error('[Admin Support API] Error creating reply:', error);
      return NextResponse.json(
        { error: 'Failed to create reply' },
        { status: 500 }
      );
    }

    // Update ticket status to awaiting_reply if not an internal note
    if (!isInternalNote) {
      await supabase
        .from('support_tickets')
        .update({ status: 'awaiting_reply' })
        .eq('id', ticketId);
    }

    console.log(`[Admin Audit] Reply added to ticket ${ticketId}`);

    return NextResponse.json({ reply, success: true });
  } catch (error) {
    console.error('[Admin Support API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
