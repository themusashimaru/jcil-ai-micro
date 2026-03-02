/**
 * USER MCP SERVERS API
 *
 * GET  /api/user/mcp-servers — List user's saved MCP server configs
 * PUT  /api/user/mcp-servers — Upsert a server config (enable/disable, update settings)
 */

import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';
import { successResponse, errors } from '@/lib/api/utils';

const log = logger('user-mcp-servers');

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );
}

export async function GET() {
  try {
    const supabase = await getSupabase();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return errors.unauthorized();
    }

    const { data, error } = await supabase
      .from('user_mcp_servers')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (error) {
      log.error('Failed to fetch user MCP servers', { error: error.message });
      return errors.serverError('Failed to fetch servers');
    }

    return successResponse({ servers: data || [] });
  } catch (error) {
    log.error('MCP servers GET error', { error: (error as Error).message });
    return errors.serverError();
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await getSupabase();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return errors.unauthorized();
    }

    const body = await request.json();
    const { server_id, name, description, command, args, env, enabled, timeout_ms } = body;

    if (!server_id || !name || !command) {
      return errors.badRequest('server_id, name, and command are required');
    }

    const { data, error } = await supabase
      .from('user_mcp_servers')
      .upsert(
        {
          user_id: user.id,
          server_id,
          name,
          description: description || null,
          command,
          args: args || [],
          env: env || {},
          enabled: enabled ?? false,
          timeout_ms: timeout_ms || 30000,
        },
        { onConflict: 'user_id,server_id' }
      )
      .select()
      .single();

    if (error) {
      log.error('Failed to upsert MCP server', { error: error.message });
      return errors.serverError('Failed to save server config');
    }

    log.info('MCP server config saved', { userId: user.id, serverId: server_id, enabled });
    return successResponse({ server: data });
  } catch (error) {
    log.error('MCP servers PUT error', { error: (error as Error).message });
    return errors.serverError();
  }
}
