/**
 * ADMIN SINGLE TICKET API
 * GET - Get ticket details with replies
 * PATCH - Update ticket status/properties
 * POST - Add a reply to the ticket
 */

import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin-guard';
import { logger } from '@/lib/logger';
import { successResponse, errors, checkRequestRateLimit, rateLimits } from '@/lib/api/utils';

const log = logger('AdminTicketAPI');

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

    // Rate limit by admin
    const rateLimitResult = checkRequestRateLimit(`admin:ticket:get:${auth.user.id}`, rateLimits.admin);
    if (!rateLimitResult.allowed) return rateLimitResult.response;

    const { ticketId } = params;
    const supabase = getSupabaseAdmin();

    // Get ticket details
    const { data: ticket, error: ticketError } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('id', ticketId)
      .single();

    if (ticketError || !ticket) {
      return errors.notFound('Ticket');
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
      log.error('[Admin Support API] Error fetching replies:', repliesError instanceof Error ? repliesError : { repliesError });
    }

    // Log admin access
    log.info(`[Admin Audit] Admin viewed ticket: ${ticketId}`);

    return successResponse({
      ticket: {
        ...ticket,
        user,
      },
      replies: replies || [],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    log.error('[Admin Support API] Error:', error instanceof Error ? error : { error });
    return errors.serverError();
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
    // Include request for CSRF validation on state-changing operation
    const auth = await requireAdmin(request);
    if (!auth.authorized) return auth.response;

    // Rate limit by admin
    const rateLimitResult = checkRequestRateLimit(`admin:ticket:patch:${auth.user.id}`, rateLimits.admin);
    if (!rateLimitResult.allowed) return rateLimitResult.response;

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
      return errors.badRequest('No valid fields to update');
    }

    const supabase = getSupabaseAdmin();
    const { data: ticket, error } = await supabase
      .from('support_tickets')
      .update(updates)
      .eq('id', ticketId)
      .select()
      .single();

    if (error) {
      log.error('[Admin Support API] Error updating ticket:', error instanceof Error ? error : { error });
      return errors.serverError();
    }

    log.info(`[Admin Audit] Ticket ${ticketId} updated:`, updates);

    return successResponse({ ticket, success: true });
  } catch (error) {
    log.error('[Admin Support API] Error:', error instanceof Error ? error : { error });
    return errors.serverError();
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
    // Include request for CSRF validation on state-changing operation
    const auth = await requireAdmin(request);
    if (!auth.authorized) return auth.response;

    // Rate limit by admin
    const rateLimitResult = checkRequestRateLimit(`admin:ticket:reply:${auth.user.id}`, rateLimits.admin);
    if (!rateLimitResult.allowed) return rateLimitResult.response;

    const { ticketId } = params;
    const body = await request.json();
    const { message, isInternalNote, deliveryMethod } = body;

    if (!message?.trim()) {
      return errors.badRequest('Message is required');
    }

    const supabase = getSupabaseAdmin();

    // Get ticket to check if it's internal (from a user)
    const { data: ticket } = await supabase
      .from('support_tickets')
      .select('user_id, source, subject')
      .eq('id', ticketId)
      .single();

    // Get admin info
    const { data: adminData } = await supabase
      .from('admin_users')
      .select('id, email')
      .eq('email', auth.user.email)
      .single();

    // Create the reply in support_replies
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
      log.error('[Admin Support API] Error creating reply:', error instanceof Error ? error : { error });
      return errors.serverError();
    }

    // Update ticket status to awaiting_reply if not an internal note
    if (!isInternalNote) {
      await supabase
        .from('support_tickets')
        .update({ status: 'awaiting_reply' })
        .eq('id', ticketId);

      // For internal tickets (from logged-in users), also send to their inbox
      if (ticket?.user_id && ticket.source === 'internal') {
        const { error: messageError } = await supabase
          .from('user_messages')
          .insert({
            recipient_user_id: ticket.user_id,
            sender_admin_id: adminData?.id || null,
            sender_admin_email: auth.user.email,
            subject: `Re: ${ticket.subject || 'Your Support Request'}`,
            message: message.trim(),
            message_type: 'support_response',
            priority: 'normal',
            is_broadcast: false,
          });

        if (messageError) {
          log.error('[Admin Support API] Error sending to user inbox:', messageError instanceof Error ? messageError : { messageError });
          // Don't fail the request - reply was still saved
        } else {
          log.info(`[Admin Audit] Reply also sent to user inbox: ${ticket.user_id}`);
        }
      }
    }

    log.info(`[Admin Audit] Reply added to ticket ${ticketId}`);

    return successResponse({ reply, success: true });
  } catch (error) {
    log.error('[Admin Support API] Error:', error instanceof Error ? error : { error });
    return errors.serverError();
  }
}
