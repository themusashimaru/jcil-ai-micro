/**
 * USER TICKET DETAIL API
 * GET - Get user's own ticket details with replies
 */

import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';
import { successResponse, errors } from '@/lib/api/utils';

const log = logger('SupportTicketDetail');

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

export async function GET(_request: NextRequest, { params }: { params: { ticketId: string } }) {
  try {
    // Get authenticated user
    const authClient = await getAuthenticatedClient();
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser();

    if (authError || !user) {
      return errors.unauthorized();
    }

    const { ticketId } = params;
    const supabase = getSupabaseAdmin();

    // Get ticket - must belong to user
    const { data: ticket, error: ticketError } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('id', ticketId)
      .eq('user_id', user.id)
      .single();

    if (ticketError || !ticket) {
      return errors.notFound('Ticket');
    }

    // Get replies (excluding internal notes)
    const { data: replies } = await supabase
      .from('support_replies')
      .select('id, admin_email, message, is_internal_note, created_at')
      .eq('ticket_id', ticketId)
      .eq('is_internal_note', false)
      .order('created_at', { ascending: true });

    return successResponse({
      ticket,
      replies: replies || [],
    });
  } catch (error) {
    log.error('[Support API] Error:', error instanceof Error ? error : { error });
    return errors.serverError('Internal server error');
  }
}
