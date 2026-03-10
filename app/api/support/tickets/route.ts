/**
 * SUPPORT TICKETS API
 * POST - Create a new support ticket (authenticated users or external contact)
 * GET - Get user's own tickets (authenticated users only)
 */

import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { validateCSRF } from '@/lib/security/csrf';
import { requireUser } from '@/lib/auth/user-guard';
import { logger } from '@/lib/logger';
import {
  successResponse,
  errors,
  validateBody,
  checkRequestRateLimit,
  rateLimits,
  getClientIP,
} from '@/lib/api/utils';
import { z } from 'zod';
import { emailSchema } from '@/lib/validation/schemas';

const log = logger('SupportTickets');

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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

// Database-backed rate limit for support tickets
const DB_RATE_LIMIT = 3; // 3 tickets per hour

async function checkRateLimit(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  identifier: string
): Promise<boolean> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  // Count recent tickets from this identifier
  const { count } = await supabase
    .from('rate_limits')
    .select('*', { count: 'exact', head: true })
    .eq('identifier', identifier)
    .eq('action', 'support_ticket')
    .gte('created_at', oneHourAgo);

  if ((count || 0) >= DB_RATE_LIMIT) {
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

// Validation schema for ticket creation (matches actual request structure)
const createTicketRequestSchema = z.object({
  category: z
    .string()
    .max(50)
    .refine((val) => VALID_CATEGORIES.includes(val), {
      message: 'Invalid category',
    }),
  subject: z.string().min(5, 'Subject must be at least 5 characters').max(200),
  message: z.string().min(20, 'Message must be at least 20 characters').max(5000),
  senderEmail: emailSchema.optional(),
  senderName: z.string().max(100).optional(),
  honeypot: z.string().optional(),
});

/**
 * POST - Create a new support ticket
 */
export async function POST(request: NextRequest) {
  // CSRF Protection (validates origin/referer for same-site requests)
  const csrfCheck = validateCSRF(request);
  if (!csrfCheck.valid) return csrfCheck.response!;

  try {
    // Validate request body
    const validation = await validateBody(request, createTicketRequestSchema);
    if (!validation.success) return validation.response;

    const {
      category,
      subject,
      message,
      senderEmail,
      senderName,
      honeypot, // Spam protection field
    } = validation.data;

    // Honeypot check - if filled, it's a bot
    if (honeypot) {
      // Pretend success but don't create ticket
      return successResponse({ success: true, ticketId: 'fake' });
    }

    // Sanitize inputs (defense in depth)
    const sanitizedSubject = sanitizeInput(subject);
    const sanitizedMessage = sanitizeInput(message);
    const sanitizedName = senderName ? sanitizeInput(senderName) : null;

    // Get IP for logging
    const ip = getClientIP(request);
    const userAgent = request.headers.get('user-agent') || '';

    const supabase = getSupabaseAdmin();

    // Check if user is authenticated
    const authClient = await getAuthenticatedClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();

    let source: 'internal' | 'external';
    let userId: string | null = null;
    let email: string;
    let name: string | null = null;

    if (user) {
      // Authenticated user - internal ticket
      // Apply strict rate limiting for authenticated users
      const rateLimitResult = await checkRequestRateLimit(`tickets:${user.id}`, rateLimits.strict);
      if (!rateLimitResult.allowed) return rateLimitResult.response;

      source = 'internal';
      userId = user.id;
      email = user.email || senderEmail || 'unknown@internal.user';

      // Get user's name from database
      const { data: userData } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', user.id)
        .single();

      name = userData?.full_name || senderName || null;
    } else {
      // External contact form
      // Apply strict rate limiting for external users by IP
      const rateLimitResult = await checkRequestRateLimit(`tickets:${ip}`, rateLimits.strict);
      if (!rateLimitResult.allowed) return rateLimitResult.response;

      source = 'external';

      if (!senderEmail) {
        return errors.badRequest('Email is required for contact form');
      }

      email = senderEmail;
      name = sanitizedName;
    }

    // Check database-backed rate limit (legacy, persists across restarts)
    const rateLimitKey = user ? user.id : ip;
    const withinLimit = await checkRateLimit(supabase, rateLimitKey);
    if (!withinLimit) {
      return errors.rateLimited();
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
      log.error('[Support API] Error creating ticket:', error instanceof Error ? error : { error });
      return errors.serverError();
    }

    log.info(`[Support API] Ticket created: ${ticket.id} (${source})`);

    return successResponse({
      ticketId: ticket.id,
      message: 'Your message has been received. We will respond within 24-48 hours.',
    });
  } catch (error) {
    log.error('[Support API] Error:', error instanceof Error ? error : { error });
    return errors.serverError();
  }
}

/**
 * GET - Get user's own support tickets
 */
export async function GET() {
  try {
    const auth = await requireUser();
    if (!auth.authorized) return auth.response;

    // Apply rate limiting for authenticated user
    const rateLimitResult = await checkRequestRateLimit(
      `tickets:get:${auth.user.id}`,
      rateLimits.standard
    );
    if (!rateLimitResult.allowed) return rateLimitResult.response;

    const supabase = getSupabaseAdmin();
    const { data: tickets, error } = await supabase
      .from('support_tickets')
      .select(
        `
        id,
        category,
        subject,
        message,
        status,
        is_read,
        created_at,
        updated_at,
        resolved_at
      `
      )
      .eq('user_id', auth.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      log.error(
        '[Support API] Error fetching tickets:',
        error instanceof Error ? error : { error }
      );
      return errors.serverError();
    }

    // Get reply counts for each ticket
    const ticketIds = tickets?.map((t) => t.id) || [];
    let replyCounts: Record<string, number> = {};

    if (ticketIds.length > 0) {
      const { data: replies } = await supabase
        .from('support_replies')
        .select('ticket_id')
        .in('ticket_id', ticketIds)
        .eq('is_internal_note', false);

      if (replies) {
        replyCounts = replies.reduce(
          (acc, r) => {
            acc[r.ticket_id] = (acc[r.ticket_id] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        );
      }
    }

    const ticketsWithCounts = tickets?.map((t) => ({
      ...t,
      reply_count: replyCounts[t.id] || 0,
    }));

    return successResponse({ tickets: ticketsWithCounts || [] });
  } catch (error) {
    log.error('[Support API] Error:', error instanceof Error ? error : { error });
    return errors.serverError();
  }
}
