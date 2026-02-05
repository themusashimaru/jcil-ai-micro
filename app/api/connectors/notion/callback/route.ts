/**
 * NOTION CALLBACK - Handle OAuth Callback
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';
import { encrypt as encryptToken } from '@/lib/security/crypto';
import { exchangeCodeForTokens } from '@/lib/connectors/notion';

const log = logger('NotionCallback');

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  // Handle OAuth errors
  if (error) {
    log.error('Notion OAuth error', { error });
    return NextResponse.redirect(
      new URL(`/settings?tab=connectors&error=${error}`, request.url)
    );
  }

  if (!code || !state) {
    log.error('Missing code or state');
    return NextResponse.redirect(
      new URL('/settings?tab=connectors&error=missing_params', request.url)
    );
  }

  // Verify state
  const cookieStore = await cookies();
  const storedState = cookieStore.get('notion_oauth_state')?.value;
  const userId = cookieStore.get('notion_oauth_user')?.value;

  if (!storedState || storedState !== state) {
    log.error('State mismatch', { storedState: !!storedState, state: !!state });
    return NextResponse.redirect(
      new URL('/settings?tab=connectors&error=invalid_state', request.url)
    );
  }

  if (!userId) {
    log.error('No user ID in cookie');
    return NextResponse.redirect(
      new URL('/settings?tab=connectors&error=no_user', request.url)
    );
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);
    log.info('Token exchange successful', { workspaceId: tokens.workspace_id });

    // Use service role to update user
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Get user info from token response
    const userName = tokens.owner?.user?.name;
    const userEmail = tokens.owner?.user?.person?.email;

    // Store encrypted token and metadata
    const { error: updateError } = await adminClient
      .from('users')
      .update({
        notion_access_token: encryptToken(tokens.access_token),
        notion_workspace_id: tokens.workspace_id,
        notion_workspace_name: tokens.workspace_name,
        notion_bot_id: tokens.bot_id,
        notion_user_name: userName,
        notion_user_email: userEmail,
        notion_connected_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (updateError) {
      log.error('Failed to store tokens', { error: updateError });
      return NextResponse.redirect(
        new URL('/settings?tab=connectors&error=storage_failed', request.url)
      );
    }

    // Clear OAuth cookies
    cookieStore.delete('notion_oauth_state');
    cookieStore.delete('notion_oauth_user');

    log.info('Notion connected successfully', { userId, workspaceId: tokens.workspace_id });

    return NextResponse.redirect(
      new URL('/settings?tab=connectors&notion=connected', request.url)
    );
  } catch (err) {
    log.error('Callback processing failed', { error: err });
    return NextResponse.redirect(
      new URL('/settings?tab=connectors&error=callback_failed', request.url)
    );
  }
}
