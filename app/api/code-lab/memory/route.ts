/**
 * CODE LAB MEMORY API ROUTE
 *
 * API endpoint for CLAUDE.md memory file management.
 * Stores memory content in session settings/metadata.
 *
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import { validateCSRF } from '@/lib/security/csrf';
import { rateLimiters } from '@/lib/security/rate-limit';

const log = logger('API:Memory');

// Type for session with settings
interface SessionWithSettings {
  id: string;
  settings?: {
    memory_content?: string;
    [key: string]: unknown;
  };
  updated_at?: string;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
    }

    // Get session with settings
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: session, error } = await (supabase as any)
      .from('code_lab_sessions')
      .select('id, settings, updated_at')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single();

    if (error || !session) {
      log.warn('Session not found', { sessionId, error });
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const typedSession = session as SessionWithSettings;
    const memoryContent = typedSession.settings?.memory_content || '';

    return NextResponse.json({
      path: '/workspace/CLAUDE.md',
      content: memoryContent,
      exists: !!memoryContent,
      lastModified: typedSession.updated_at,
    });
  } catch (error) {
    log.error('Memory GET error', error as Error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  // SECURITY FIX: Add CSRF protection
  const csrfCheck = validateCSRF(request);
  if (!csrfCheck.valid) return csrfCheck.response!;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // SECURITY FIX: Add rate limiting
    const rateLimitResult = await rateLimiters.codeLabEdit(user.id);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: rateLimitResult.retryAfter,
        },
        { status: 429, headers: { 'Retry-After': String(rateLimitResult.retryAfter) } }
      );
    }

    const body = await request.json();
    const { sessionId, content } = body;

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
    }

    log.info('Saving memory file', { sessionId, userId: user.id, contentLength: content?.length });

    // Get current session settings
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: session, error: getError } = await (supabase as any)
      .from('code_lab_sessions')
      .select('id, settings')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single();

    if (getError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const typedSession = session as SessionWithSettings;
    const currentSettings = typedSession.settings || {};

    // Update settings with memory content
    const newSettings = {
      ...currentSettings,
      memory_content: content || '',
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase as any)
      .from('code_lab_sessions')
      .update({
        settings: newSettings,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (updateError) {
      log.error('Failed to save memory', { error: updateError });
      return NextResponse.json({ error: 'Failed to save memory file' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      path: '/workspace/CLAUDE.md',
      lastModified: new Date().toISOString(),
    });
  } catch (error) {
    log.error('Memory POST error', error as Error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
