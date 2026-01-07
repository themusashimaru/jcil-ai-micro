/**
 * WEBSITE LEADS SUBMISSION API
 *
 * Receives contact form submissions from generated websites.
 * Generated websites POST here to save leads for the website owner.
 *
 * POST /api/leads/submit
 * Body: { sessionId, name, email, phone?, message, source? }
 *
 * CORS: Enabled for generated websites on vercel.app and netlify.app
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// SECURITY FIX: Allowed origins for generated websites
// Wildcard CORS exposes this endpoint to any website
const ALLOWED_ORIGIN_PATTERNS = [
  /\.vercel\.app$/,
  /\.netlify\.app$/,
  /\.pages\.dev$/,  // Cloudflare Pages
  /\.github\.io$/,
  /localhost(:\d+)?$/,
];

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    return ALLOWED_ORIGIN_PATTERNS.some(pattern => pattern.test(url.hostname));
  } catch {
    return false;
  }
}

// Get CORS headers dynamically based on origin
function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = isAllowedOrigin(origin) ? origin! : 'null';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

// Service role client for database operations
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  });
}

// Handle CORS preflight
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin');
  return new NextResponse(null, { status: 200, headers: getCorsHeaders(origin) });
}

// Rate limiting for lead submissions (prevent spam)
const leadRateLimits = new Map<string, { count: number; resetAt: number }>();
const LEAD_RATE_LIMIT = 5; // 5 submissions per hour per IP
const LEAD_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkLeadRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = leadRateLimits.get(ip);

  // Cleanup old entries occasionally
  if (Math.random() < 0.01) {
    for (const [key, value] of leadRateLimits.entries()) {
      if (value.resetAt < now) {
        leadRateLimits.delete(key);
      }
    }
  }

  if (!entry || entry.resetAt < now) {
    leadRateLimits.set(ip, { count: 1, resetAt: now + LEAD_WINDOW_MS });
    return true;
  }

  if (entry.count >= LEAD_RATE_LIMIT) {
    return false;
  }

  entry.count++;
  return true;
}

// Simple email validation
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Sanitize input to prevent XSS
function sanitize(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim()
    .slice(0, 5000); // Max length
}

export async function POST(request: NextRequest) {
  // Get origin for CORS - computed once for all responses
  const origin = request.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  try {
    // Get client IP for rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ||
               request.headers.get('x-real-ip') ||
               'unknown';

    // Check rate limit
    if (!checkLeadRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Too many submissions. Please try again later.' },
        { status: 429, headers: corsHeaders }
      );
    }

    // Parse request body
    const body = await request.json();
    const { sessionId, name, email, phone, message, source } = body;

    // Validate required fields
    if (!sessionId) {
      return NextResponse.json(
        { error: 'Website session ID is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!name || name.trim().length < 2) {
      return NextResponse.json(
        { error: 'Please provide your name' },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { error: 'Please provide a valid email address' },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!message || message.trim().length < 10) {
      return NextResponse.json(
        { error: 'Please provide a message (at least 10 characters)' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Get Supabase admin client
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      console.error('[Leads API] Supabase not configured');
      return NextResponse.json(
        { error: 'Service temporarily unavailable' },
        { status: 503, headers: corsHeaders }
      );
    }

    // Verify the session exists and get owner info
    const { data: session, error: sessionError } = await supabase
      .from('website_sessions')
      .select('id, user_id, business_name')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      console.error('[Leads API] Session not found:', sessionId, sessionError);
      return NextResponse.json(
        { error: 'Invalid website reference' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Insert the lead
    const { data: lead, error: insertError } = await supabase
      .from('website_leads')
      .insert({
        session_id: sessionId,
        user_id: session.user_id, // Website owner
        business_name: session.business_name,
        lead_name: sanitize(name),
        lead_email: sanitize(email),
        lead_phone: phone ? sanitize(phone) : null,
        message: sanitize(message),
        source: source ? sanitize(source) : 'contact_form',
        ip_address: ip,
        status: 'new',
      })
      .select()
      .single();

    if (insertError) {
      console.error('[Leads API] Insert error:', insertError);

      // If table doesn't exist, create it (first-time setup)
      if (insertError.code === '42P01') { // Table doesn't exist
        console.log('[Leads API] Creating website_leads table...');

        // Create the table
        const { error: createError } = await supabase.rpc('exec_sql', {
          sql: `
            CREATE TABLE IF NOT EXISTS website_leads (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              session_id UUID NOT NULL REFERENCES website_sessions(id) ON DELETE CASCADE,
              user_id UUID NOT NULL,
              business_name TEXT,
              lead_name TEXT NOT NULL,
              lead_email TEXT NOT NULL,
              lead_phone TEXT,
              message TEXT NOT NULL,
              source TEXT DEFAULT 'contact_form',
              ip_address TEXT,
              status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'converted', 'archived')),
              notes TEXT,
              created_at TIMESTAMPTZ DEFAULT NOW(),
              updated_at TIMESTAMPTZ DEFAULT NOW()
            );

            CREATE INDEX IF NOT EXISTS idx_website_leads_user ON website_leads(user_id);
            CREATE INDEX IF NOT EXISTS idx_website_leads_session ON website_leads(session_id);
            CREATE INDEX IF NOT EXISTS idx_website_leads_status ON website_leads(status);

            -- RLS: Users can only see their own leads
            ALTER TABLE website_leads ENABLE ROW LEVEL SECURITY;

            CREATE POLICY IF NOT EXISTS "Users can view own leads"
              ON website_leads FOR SELECT
              USING (auth.uid() = user_id);

            CREATE POLICY IF NOT EXISTS "Service role can insert leads"
              ON website_leads FOR INSERT
              WITH CHECK (true);
          `
        });

        if (createError) {
          console.error('[Leads API] Failed to create table:', createError);
          // Fall back to storing in a simple way
        }

        // Retry insert
        const { error: retryError } = await supabase
          .from('website_leads')
          .insert({
            session_id: sessionId,
            user_id: session.user_id,
            business_name: session.business_name,
            lead_name: sanitize(name),
            lead_email: sanitize(email),
            lead_phone: phone ? sanitize(phone) : null,
            message: sanitize(message),
            source: source ? sanitize(source) : 'contact_form',
            ip_address: ip,
            status: 'new',
          });

        if (retryError) {
          console.error('[Leads API] Retry insert failed:', retryError);
          return NextResponse.json(
            { error: 'Failed to save your message. Please try again.' },
            { status: 500, headers: corsHeaders }
          );
        }
      } else {
        return NextResponse.json(
          { error: 'Failed to save your message. Please try again.' },
          { status: 500, headers: corsHeaders }
        );
      }
    }

    console.log(`[Leads API] Lead saved for ${session.business_name}: ${sanitize(name)} <${sanitize(email)}>`);

    // Return success
    return NextResponse.json(
      {
        success: true,
        message: 'Thank you! We\'ll be in touch soon.',
        leadId: lead?.id
      },
      { status: 201, headers: corsHeaders }
    );

  } catch (error) {
    console.error('[Leads API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500, headers: corsHeaders }
    );
  }
}
