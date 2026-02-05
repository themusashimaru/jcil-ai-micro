/**
 * NOTION DISCONNECT - Remove Connection
 */

import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';
import { successResponse, errors } from '@/lib/api/utils';

const log = logger('NotionDisconnect');

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

export async function DELETE() {
  try {
    const { user, error } = await getUser();
    if (error || !user) {
      return errors.unauthorized();
    }

    // Use service role to update user
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { error: updateError } = await adminClient
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

    if (updateError) {
      log.error('Failed to disconnect Notion', { error: updateError });
      return errors.serverError();
    }

    log.info('Notion disconnected', { userId: user.id });

    return successResponse({ success: true });
  } catch (err) {
    log.error('Disconnect failed', { error: err });
    return errors.serverError();
  }
}
