/**
 * COMPOSIO CALLBACK API
 * =====================
 *
 * GET: Handle OAuth callback from Composio
 * Redirects user back to settings with success/error
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Force dynamic for OAuth callback
export const dynamic = 'force-dynamic';
import { createServerClient } from '@supabase/ssr';
import { waitForConnection } from '@/lib/composio';
import { logger } from '@/lib/logger';

const log = logger('ComposioCallbackAPI');

export async function GET(request: NextRequest) {
  try {
    // Get params
    const searchParams = request.nextUrl.searchParams;
    const toolkit = searchParams.get('toolkit');
    const connectionId = searchParams.get('connectionId');
    const error = searchParams.get('error');

    // Base redirect URL
    const settingsUrl = new URL('/settings', process.env.NEXT_PUBLIC_APP_URL);
    settingsUrl.searchParams.set('tab', 'connectors');

    // Handle errors from Composio
    if (error) {
      log.warn('OAuth error from Composio', { error, toolkit });
      settingsUrl.searchParams.set('error', `Connection failed: ${error}`);
      return NextResponse.redirect(settingsUrl.toString());
    }

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
      settingsUrl.searchParams.set('error', 'Not authenticated');
      return NextResponse.redirect(settingsUrl.toString());
    }

    // If we have a connectionId, wait for it to become active
    if (connectionId) {
      const account = await waitForConnection(connectionId, 10000); // 10 second timeout

      if (account && account.status === 'connected') {
        log.info('Connection successful', {
          userId: user.id,
          toolkit,
          connectionId,
        });
        settingsUrl.searchParams.set('success', `Connected to ${toolkit || 'service'}`);
      } else {
        log.warn('Connection pending or failed', { connectionId, toolkit });
        settingsUrl.searchParams.set('pending', toolkit || 'service');
      }
    } else {
      // Just mark as success if no connectionId (Composio handled it)
      settingsUrl.searchParams.set('success', `Connected to ${toolkit || 'service'}`);
    }

    return NextResponse.redirect(settingsUrl.toString());
  } catch (error) {
    log.error('Callback error', { error });
    const settingsUrl = new URL('/settings', process.env.NEXT_PUBLIC_APP_URL);
    settingsUrl.searchParams.set('tab', 'connectors');
    settingsUrl.searchParams.set('error', 'Connection failed');
    return NextResponse.redirect(settingsUrl.toString());
  }
}
