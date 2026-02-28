/**
 * CODE LAB MEMORY API ROUTE
 *
 * API endpoint for CLAUDE.md memory file management.
 * Stores memory content in session settings/metadata.
 *
 * @version 1.0.0
 */

import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { untypedFrom } from '@/lib/supabase/workspace-client';
import { logger } from '@/lib/logger';
import { validateCSRF } from '@/lib/security/csrf';
import { rateLimiters } from '@/lib/security/rate-limit';
import { successResponse, errors } from '@/lib/api/utils';

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
      return errors.unauthorized();
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return errors.badRequest('sessionId required');
    }

    // Get session with settings
    const { data: session, error } = await untypedFrom(supabase, 'code_lab_sessions')
      .select('id, settings, updated_at')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single();

    if (error || !session) {
      log.warn('Session not found', { sessionId, error });
      return errors.sessionNotFound();
    }

    const typedSession = session as SessionWithSettings;
    const memoryContent = typedSession.settings?.memory_content || '';

    return successResponse({
      path: '/workspace/CLAUDE.md',
      content: memoryContent,
      exists: !!memoryContent,
      lastModified: typedSession.updated_at,
    });
  } catch (error) {
    log.error('Memory GET error', error as Error);
    return errors.serverError('Internal server error');
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
      return errors.unauthorized();
    }

    // SECURITY FIX: Add rate limiting
    const rateLimitResult = await rateLimiters.codeLabEdit(user.id);
    if (!rateLimitResult.allowed) {
      return errors.rateLimited(rateLimitResult.retryAfter);
    }

    const body = await request.json();
    const { sessionId, content } = body;

    if (!sessionId) {
      return errors.badRequest('sessionId required');
    }

    log.info('Saving memory file', { sessionId, userId: user.id, contentLength: content?.length });

    // Get current session settings
    const { data: session, error: getError } = await untypedFrom(supabase, 'code_lab_sessions')
      .select('id, settings')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single();

    if (getError || !session) {
      return errors.sessionNotFound();
    }

    const typedSession = session as SessionWithSettings;
    const currentSettings = typedSession.settings || {};

    // Update settings with memory content
    const newSettings = {
      ...currentSettings,
      memory_content: content || '',
    };

    const { error: updateError } = await untypedFrom(supabase, 'code_lab_sessions')
      .update({
        settings: newSettings,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (updateError) {
      log.error('Failed to save memory', { error: updateError });
      return errors.serverError('Failed to save memory file');
    }

    return successResponse({
      success: true,
      path: '/workspace/CLAUDE.md',
      lastModified: new Date().toISOString(),
    });
  } catch (error) {
    log.error('Memory POST error', error as Error);
    return errors.serverError('Internal server error');
  }
}
