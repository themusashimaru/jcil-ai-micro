/**
 * USER MCP SERVERS API
 *
 * GET  /api/user/mcp-servers — List user's saved MCP server configs
 * PUT  /api/user/mcp-servers — Upsert a server config (enable/disable, update settings)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';

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
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('user_mcp_servers')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (error) {
      log.error('Failed to fetch user MCP servers', { error: error.message });
      return NextResponse.json({ error: 'Failed to fetch servers' }, { status: 500 });
    }

    return NextResponse.json({ servers: data || [] });
  } catch (error) {
    log.error('MCP servers GET error', { error: (error as Error).message });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
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
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { server_id, name, description, command, args, env, enabled, timeout_ms } = body;

    if (!server_id || !name || !command) {
      return NextResponse.json(
        { error: 'server_id, name, and command are required' },
        { status: 400 }
      );
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
      return NextResponse.json({ error: 'Failed to save server config' }, { status: 500 });
    }

    log.info('MCP server config saved', { userId: user.id, serverId: server_id, enabled });
    return NextResponse.json({ server: data });
  } catch (error) {
    log.error('MCP servers PUT error', { error: (error as Error).message });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
