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

const RATE_LIMIT = 5; // 5 tickets per hour

// Input validation constants
const MAX_NAME_LENGTH = 100;
const MAX_SUBJECT_LENGTH = 200;
const MAX_MESSAGE_LENGTH = 5000;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Sanitize input - strip potential script tags as defense in depth
 * (React escapes on display, but this adds server-side protection)
 */
function sanitizeInput(input: string): string {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '') // Strip all HTML tags
    .trim();
}

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

async function checkRateLimit(supabase: ReturnType<typeof getSupabaseAdmin>, identifier: string): Promise<boolean> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  // Count recent tickets from this identifier
  const { count } = await supabase
    .from('rate_limits')
    .select('*', { count: 'exact', head: true })
    .eq('identifier', identifier)
    .eq('action', 'support_ticket')
    .gte('created_at', oneHourAgo);

  if ((count || 0) >= RATE_LIMIT) {
    return false;
  }

  // Record this attempt
  await supabase.from('rate_limits').insert({
    identifier,
    action: 'support_ticket',
  });

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

    // Validate input lengths
    if (subject.length > MAX_SUBJECT_LENGTH) {
      return NextResponse.json(
        { error: `Subject must be ${MAX_SUBJECT_LENGTH} characters or less` },
        { status: 400 }
      );
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        { error: `Message must be ${MAX_MESSAGE_LENGTH} characters or less` },
        { status: 400 }
      );
    }

    if (senderName && senderName.length > MAX_NAME_LENGTH) {
      return NextResponse.json(
        { error: `Name must be ${MAX_NAME_LENGTH} characters or less` },
        { status: 400 }
      );
    }

    // Validate email format if provided
    if (senderEmail && !EMAIL_REGEX.test(senderEmail)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Sanitize inputs (defense in depth)
    const sanitizedSubject = sanitizeInput(subject);
    const sanitizedMessage = sanitizeInput(message);
    const sanitizedName = senderName ? sanitizeInput(senderName) : null;

    // Get IP for rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ||
               request.headers.get('x-real-ip') ||
               'unknown';
    const userAgent = request.headers.get('user-agent') || '';

    const supabase = getSupabaseAdmin();

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
      name = sanitizedName;
      rateLimitKey = ip;
    }

    // Check rate limit (database-backed, persists across restarts)
    const withinLimit = await checkRateLimit(supabase, rateLimitKey);
    if (!withinLimit) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      );
    }

    // Create the ticket with sanitized inputs
    const { data: ticket, error } = await supabase
      .from('support_tickets')
      .insert({
        source,
        user_id: userId,
        sender_email: email,
        sender_name: name,
        category,
        subject: sanitizedSubject,
        message: sanitizedMessage,
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
