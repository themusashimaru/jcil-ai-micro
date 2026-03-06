/**
 * Waitlist / Email Capture API
 *
 * Stores email signups from the landing page.
 * Uses Supabase `waitlist` table if available, falls back to logging.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';

const log = logger('WaitlistAPI');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!email || !EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 });
    }

    // Try to store in Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { error } = await supabase
        .from('waitlist')
        .upsert(
          { email, source: body?.source || 'landing_page', created_at: new Date().toISOString() },
          { onConflict: 'email' }
        );

      if (error) {
        // Table might not exist yet — log and continue
        log.warn('Waitlist insert failed (table may not exist)', { error: error.message });
        // Still log the email so it's not lost
        log.info('Email captured (fallback to log)', { email, source: body?.source });
      } else {
        log.info('Email captured successfully', { email });
      }
    } else {
      // No Supabase — log the email
      log.info('Email captured (no Supabase configured)', { email, source: body?.source });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error('Waitlist API error', { error: (error as Error).message });
    return NextResponse.json(
      { error: 'Failed to process signup. Please try again.' },
      { status: 500 }
    );
  }
}
