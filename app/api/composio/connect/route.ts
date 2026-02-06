/**
 * COMPOSIO CONNECT API
 * ====================
 *
 * POST: Initiate OAuth connection for a toolkit
 * Returns redirect URL for user to complete auth
 * Stores connectionId in cookie for callback to use
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Force dynamic for auth
export const dynamic = 'force-dynamic';
import { createServerClient } from '@supabase/ssr';
import { initiateConnection, isComposioConfigured, getToolkitById } from '@/lib/composio';
import { logger } from '@/lib/logger';

const log = logger('ComposioConnectAPI');

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

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check Composio configured
    if (!isComposioConfigured()) {
      return NextResponse.json({ error: 'Composio is not configured' }, { status: 503 });
    }

    // Parse request
    const body = await request.json();
    const { toolkit, redirectUrl } = body;

    if (!toolkit) {
      return NextResponse.json({ error: 'Toolkit is required' }, { status: 400 });
    }

    // Validate toolkit exists
    const toolkitConfig = getToolkitById(toolkit.toUpperCase());
    if (!toolkitConfig) {
      log.warn('Unknown toolkit requested', { toolkit });
      // Still allow - Composio may have more than we've configured
    }

    // Use user's ID as the entity ID
    const userId = user.id;

    // Build callback URL - validate it's a proper URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl && !redirectUrl) {
      log.error('NEXT_PUBLIC_APP_URL not configured');
      return NextResponse.json(
        { error: 'Server configuration error - callback URL not available' },
        { status: 500 }
      );
    }

    const callbackUrl = redirectUrl || `${appUrl}/api/composio/callback?toolkit=${toolkit}`;

    // Validate URL format before sending to Composio
    try {
      new URL(callbackUrl);
    } catch {
      log.error('Invalid callback URL', { callbackUrl, appUrl, redirectUrl });
      return NextResponse.json({ error: 'Invalid callback URL configuration' }, { status: 500 });
    }

    log.info('Initiating connection with callback URL', { callbackUrl, toolkit });

    // Initiate connection
    const connectionRequest = await initiateConnection(userId, toolkit, callbackUrl);

    log.info('Connection initiated', {
      userId,
      toolkit,
      connectionId: connectionRequest.id,
    });

    // Store connectionId in cookie so callback can wait for it (reuse cookieStore from above)
    cookieStore.set('composio_connection_id', connectionRequest.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 300, // 5 minutes - should be enough for OAuth flow
      path: '/',
    });
    cookieStore.set('composio_connection_toolkit', toolkit.toUpperCase(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 300,
      path: '/',
    });

    return NextResponse.json({
      success: true,
      connectionId: connectionRequest.id,
      redirectUrl: connectionRequest.redirectUrl,
      toolkit: toolkit.toUpperCase(),
      toolkitName: toolkitConfig?.displayName || toolkit,
    });
  } catch (error) {
    log.error('Failed to initiate connection', { error });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to initiate connection' },
      { status: 500 }
    );
  }
}
