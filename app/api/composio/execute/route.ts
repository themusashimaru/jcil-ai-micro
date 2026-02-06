/**
 * COMPOSIO EXECUTE API
 * ====================
 *
 * POST: Execute a Composio tool action
 * Used by AI agents to perform actions on behalf of users
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Force dynamic for auth
export const dynamic = 'force-dynamic';
import { createServerClient } from '@supabase/ssr';
import { executeTool, isComposioConfigured } from '@/lib/composio';
import { logger } from '@/lib/logger';

const log = logger('ComposioExecuteAPI');

export async function POST(request: NextRequest) {
  try {
    // Get user from Supabase auth
    const cookieStore = await cookies();
    const supabase = createServerClient(
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
              /* ignore */
            }
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check Composio configured
    if (!isComposioConfigured()) {
      return NextResponse.json(
        { error: 'Composio is not configured' },
        { status: 503 }
      );
    }

    // Parse request
    const body = await request.json();
    const { action, params } = body;

    if (!action) {
      return NextResponse.json(
        { error: 'action is required' },
        { status: 400 }
      );
    }

    // Execute tool
    const result = await executeTool(user.id, action, params || {});

    if (result.success) {
      log.info('Tool executed', {
        userId: user.id,
        action,
      });
      return NextResponse.json({
        success: true,
        data: result.data,
      });
    } else {
      log.warn('Tool execution failed', {
        userId: user.id,
        action,
        error: result.error,
      });
      return NextResponse.json(
        { error: result.error || 'Execution failed' },
        { status: 500 }
      );
    }
  } catch (error) {
    log.error('Execute API error', { error });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Execution failed' },
      { status: 500 }
    );
  }
}
