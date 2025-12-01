/**
 * CONNECTORS API
 * Manage user connections to external services
 * GET: List user's connections (with masked tokens)
 * POST: Save a new connection (encrypts token)
 * DELETE: Remove a connection
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server-auth';
import { encryptToken, maskToken } from '@/lib/connectors/encryption';
import { getConnectorById } from '@/lib/connectors/config';

export const runtime = 'nodejs';

// Type for database connection record
interface ConnectionRecord {
  id: string;
  service: string;
  display_name: string | null;
  metadata: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// GET - List user's connections
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { data: connections, error } = await supabase
      .from('user_connections')
      .select('id, service, display_name, metadata, is_active, created_at, updated_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Connectors API] Error fetching connections:', error);
      return NextResponse.json({ error: 'Failed to fetch connections' }, { status: 500 });
    }

    // Add connector config info to each connection
    const connectionList = (connections || []) as ConnectionRecord[];
    const enrichedConnections = connectionList.map(conn => {
      const config = getConnectorById(conn.service);
      return {
        ...conn,
        connectorName: config?.name || conn.service,
        connectorIcon: config?.icon || '🔗',
      };
    });

    return NextResponse.json({ connections: enrichedConnections });
  } catch (error) {
    console.error('[Connectors API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Save a new connection
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { service, token, displayName, metadata } = body;

    if (!service || !token) {
      return NextResponse.json({ error: 'Service and token are required' }, { status: 400 });
    }

    // Validate the service exists in our config
    const config = getConnectorById(service);
    if (!config) {
      return NextResponse.json({ error: 'Unknown service' }, { status: 400 });
    }

    // Encrypt the token
    const encryptedToken = encryptToken(token);

    // Upsert the connection (update if exists, insert if new)
    // Using type assertion since user_connections table is new
    const { data, error } = await (supabase
      .from('user_connections') as ReturnType<typeof supabase.from>)
      .upsert(
        {
          user_id: user.id,
          service,
          encrypted_token: encryptedToken,
          display_name: displayName || null,
          metadata: metadata || {},
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,service',
        }
      )
      .select('id, service, display_name, is_active, created_at')
      .single();

    if (error) {
      console.error('[Connectors API] Error saving connection:', error);
      return NextResponse.json({ error: 'Failed to save connection' }, { status: 500 });
    }

    console.log(`[Connectors API] User ${user.id} connected ${service}`);

    return NextResponse.json({
      success: true,
      connection: {
        ...data,
        maskedToken: maskToken(token),
        connectorName: config.name,
        connectorIcon: config.icon,
      },
    });
  } catch (error) {
    console.error('[Connectors API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Remove a connection
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const service = searchParams.get('service');

    if (!service) {
      return NextResponse.json({ error: 'Service is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('user_connections')
      .delete()
      .eq('user_id', user.id)
      .eq('service', service);

    if (error) {
      console.error('[Connectors API] Error deleting connection:', error);
      return NextResponse.json({ error: 'Failed to delete connection' }, { status: 500 });
    }

    console.log(`[Connectors API] User ${user.id} disconnected ${service}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Connectors API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
