/**
 * SUPPORT TICKETS API
 * POST - Create a new support ticket (authenticated users or external contact)
 * GET - Get user's own tickets (authenticated users only)
 */

import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Rate limiting store (in production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5; // 5 tickets per hour
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour

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

function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  const record = rateLimitStore.get(identifier);

  if (!record || record.resetAt < now) {
    rateLimitStore.set(identifier, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (record.count >= RATE_LIMIT) {
    return false;
  }

  record.count++;
  return true;
}

const VALID_CATEGORIES = [
  'general',
  'technical_support',
  'bug_report',
  'feature_request',
  'billing',
  'content_moderation',
  'account_issue',
  'partnership',
  'feedback',
  'other',
];

/**
 * POST - Create a new support ticket
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      category,
      subject,
      message,
      senderEmail,
      senderName,
      honeypot, // Spam protection field
    } = body;

    // Honeypot check - if filled, it's a bot
    if (honeypot) {
      // Pretend success but don't create ticket
      return NextResponse.json({ success: true, ticketId: 'fake' });
    }

    // Validate required fields
    if (!category || !subject || !message) {
      return NextResponse.json(
        { error: 'Category, subject, and message are required' },
        { status: 400 }
      );
    }

    if (!VALID_CATEGORIES.includes(category)) {
      return NextResponse.json(
        { error: 'Invalid category' },
        { status: 400 }
      );
    }

    // Get IP for rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ||
               request.headers.get('x-real-ip') ||
               'unknown';
    const userAgent = request.headers.get('user-agent') || '';

    // Check if user is authenticated
    const authClient = await getAuthenticatedClient();
    const { data: { user } } = await authClient.auth.getUser();

    let source: 'internal' | 'external';
    let userId: string | null = null;
    let email: string;
    let name: string | null = null;
    let rateLimitKey: string;

    if (user) {
      // Authenticated user - internal ticket
      source = 'internal';
      userId = user.id;
      email = user.email || senderEmail;
      rateLimitKey = user.id;

      // Get user's name from database
      const supabase = getSupabaseAdmin();
      const { data: userData } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', user.id)
        .single();

      name = userData?.full_name || senderName || null;
    } else {
      // External contact form
      source = 'external';

      if (!senderEmail) {
        return NextResponse.json(
          { error: 'Email is required for contact form' },
          { status: 400 }
        );
      }

      email = senderEmail;
      name = senderName || null;
      rateLimitKey = ip;
    }

    // Check rate limit
    if (!checkRateLimit(rateLimitKey)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    // Create the ticket
    const supabase = getSupabaseAdmin();
    const { data: ticket, error } = await supabase
      .from('support_tickets')
      .insert({
        source,
        user_id: userId,
        sender_email: email,
        sender_name: name,
        category,
        subject: subject.trim(),
        message: message.trim(),
        ip_address: ip,
        user_agent: userAgent,
      })
      .select('id, created_at')
      .single();

    if (error) {
      console.error('[Support API] Error creating ticket:', error);
      return NextResponse.json(
        { error: 'Failed to create support ticket' },
        { status: 500 }
      );
    }

    console.log(`[Support API] Ticket created: ${ticket.id} (${source})`);

    return NextResponse.json({
      success: true,
      ticketId: ticket.id,
      message: 'Your message has been received. We will respond within 24-48 hours.',
    });
  } catch (error) {
    console.error('[Support API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET - Get user's own support tickets
 */
export async function GET() {
  try {
    const authClient = await getAuthenticatedClient();
    const { data: { user }, error: authError } = await authClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    const { data: tickets, error } = await supabase
      .from('support_tickets')
      .select(`
        id,
        category,
        subject,
        message,
        status,
        is_read,
        created_at,
        updated_at,
        resolved_at
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Support API] Error fetching tickets:', error);
      return NextResponse.json(
        { error: 'Failed to fetch tickets' },
        { status: 500 }
      );
    }

    // Get reply counts for each ticket
    const ticketIds = tickets?.map(t => t.id) || [];
    let replyCounts: Record<string, number> = {};

    if (ticketIds.length > 0) {
      const { data: replies } = await supabase
        .from('support_replies')
        .select('ticket_id')
        .in('ticket_id', ticketIds)
        .eq('is_internal_note', false);

      if (replies) {
        replyCounts = replies.reduce((acc, r) => {
          acc[r.ticket_id] = (acc[r.ticket_id] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
      }
    }

    const ticketsWithCounts = tickets?.map(t => ({
      ...t,
      reply_count: replyCounts[t.id] || 0,
    }));

    return NextResponse.json({ tickets: ticketsWithCounts || [] });
  } catch (error) {
    console.error('[Support API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
