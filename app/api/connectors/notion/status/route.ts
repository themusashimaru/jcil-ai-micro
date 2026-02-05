/**
 * NOTION STATUS - Check Connection Status
 */

import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';
import { successResponse, errors } from '@/lib/api/utils';
import { decrypt as decryptToken } from '@/lib/security/crypto';
import { getCurrentUser, isNotionConfigured } from '@/lib/connectors/notion';

const log = logger('NotionStatus');

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

export async function GET() {
  try {
    // Check if Notion is configured
    if (!isNotionConfigured()) {
      return successResponse({
        configured: false,
        connected: false,
        message: 'Notion integration is not configured',
      });
    }

    const { user, error } = await getUser();
    if (error || !user) {
      return errors.unauthorized();
    }

    // Use service role to read from users table
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: userData, error: fetchError } = await adminClient
      .from('users')
      .select(`
        notion_access_token,
        notion_workspace_id,
        notion_workspace_name,
        notion_bot_id,
        notion_user_name,
        notion_user_email,
        notion_connected_at
      `)
      .eq('id', user.id)
      .single();

    if (fetchError) {
      log.error('Failed to fetch user data', { error: fetchError });
      return errors.serverError();
    }

    // Check if user has Notion connected
    if (!userData?.notion_access_token) {
      return successResponse({
        configured: true,
        connected: false,
      });
    }

    // Try to decrypt and verify token
    let accessToken: string;
    try {
      accessToken = decryptToken(userData.notion_access_token);
    } catch (decryptError) {
      log.warn('Token decryption failed', { error: decryptError });
      await adminClient
        .from('users')
        .update({
          notion_access_token: null,
          notion_workspace_id: null,
          notion_workspace_name: null,
          notion_bot_id: null,
          notion_user_name: null,
          notion_user_email: null,
          notion_connected_at: null,
        })
        .eq('id', user.id);

      return successResponse({
        configured: true,
        connected: false,
        error: 'Token encryption changed, please reconnect',
      });
    }

    // Verify token is still valid
    try {
      await getCurrentUser(accessToken);

      return successResponse({
        configured: true,
        connected: true,
        workspaceId: userData.notion_workspace_id,
        workspaceName: userData.notion_workspace_name,
        userName: userData.notion_user_name,
        userEmail: userData.notion_user_email,
        connectedAt: userData.notion_connected_at,
      });
    } catch (apiError) {
      log.error('Notion API validation failed', { error: apiError });

      // Clear invalid token
      await adminClient
        .from('users')
        .update({
          notion_access_token: null,
          notion_workspace_id: null,
          notion_workspace_name: null,
          notion_bot_id: null,
          notion_user_name: null,
          notion_user_email: null,
          notion_connected_at: null,
        })
        .eq('id', user.id);

      return successResponse({
        configured: true,
        connected: false,
        error: 'Token expired or revoked, please reconnect',
      });
    }
  } catch (err) {
    log.error('Status check failed', { error: err });
    return errors.serverError();
  }
}
