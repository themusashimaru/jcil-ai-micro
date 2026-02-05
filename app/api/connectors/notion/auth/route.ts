/**
 * NOTION AUTH - Initiate OAuth Flow
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';
import { getNotionAuthUrl, isNotionConfigured } from '@/lib/connectors/notion';
import { randomBytes } from 'crypto';

const log = logger('NotionAuth');

export const runtime = 'nodejs';

async function getUser() {
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
            // Ignore
          }
        },
      },
    }
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  return { user, error };
}

export async function GET(request: NextRequest) {
  try {
    // Check if Notion is configured
    if (!isNotionConfigured()) {
      log.error('Notion not configured');
      return NextResponse.redirect(
        new URL('/settings?tab=connectors&error=notion_not_configured', request.url)
      );
    }

    // Verify user is authenticated
    const { user, error } = await getUser();
    if (error || !user) {
      log.error('User not authenticated');
      return NextResponse.redirect(
        new URL('/login?redirect=/settings?tab=connectors', request.url)
      );
    }

    // Generate state for CSRF protection
    const state = randomBytes(32).toString('hex');

    // Store state in cookie
    const cookieStore = await cookies();
    cookieStore.set('notion_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600,
      path: '/',
    });

    cookieStore.set('notion_oauth_user', user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600,
      path: '/',
    });

    // Redirect to Notion OAuth
    const authUrl = getNotionAuthUrl(state);
    log.info('Redirecting to Notion auth', { userId: user.id });

    return NextResponse.redirect(authUrl);
  } catch (error) {
    log.error('Failed to initiate Notion auth', { error });
    return NextResponse.redirect(
      new URL('/settings?tab=connectors&error=auth_failed', request.url)
    );
  }
}
