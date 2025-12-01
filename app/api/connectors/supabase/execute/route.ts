/**
 * SUPABASE ACTION EXECUTION API
 * Execute Supabase actions after user confirmation
 * POST: Execute a specific Supabase action
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server-auth';
import { getUserConnection } from '@/lib/connectors/helpers';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

interface ExecuteRequest {
  action: string;
  params: Record<string, unknown>;
}

// Parse the token to get URL and key
function parseSupabaseToken(token: string): { url: string; key: string } | null {
  const parts = token.split('|');
  if (parts.length !== 2) return null;
  return { url: parts[0], key: parts[1] };
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Get user's Supabase connection
    const connection = await getUserConnection(user.id, 'supabase');
    if (!connection) {
      return NextResponse.json({ error: 'Supabase not connected' }, { status: 400 });
    }

    const credentials = parseSupabaseToken(connection.token);
    if (!credentials) {
      return NextResponse.json({ error: 'Invalid Supabase credentials format' }, { status: 400 });
    }

    const body: ExecuteRequest = await request.json();
    const { action, params } = body;

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    // Create Supabase client for the user's project
    const userSupabase = createClient(credentials.url, credentials.key);

    let result: unknown;

    switch (action) {
      case 'list_tables': {
        // Query the information schema to get table names
        // Using raw fetch since Supabase client types don't include information_schema
        try {
          const response = await fetch(
            `${credentials.url}/rest/v1/rpc/get_tables`,
            {
              method: 'POST',
              headers: {
                apikey: credentials.key,
                Authorization: `Bearer ${credentials.key}`,
                'Content-Type': 'application/json',
              },
            }
          );

          if (response.ok) {
            const data = await response.json();
            result = data;
          } else {
            // RPC function doesn't exist, return helpful message
            result = {
              message: 'To list tables, create an RPC function called get_tables, or try querying a specific table.',
              hint: 'Use query_table action with a known table name',
              example: { action: 'query_table', params: { table: 'users', limit: 10 } },
            };
          }
        } catch {
          result = {
            message: 'Could not list tables. Try querying a specific table.',
            hint: 'Use query_table action with a known table name',
          };
        }
        break;
      }

      case 'query_table': {
        const { table, select = '*', filters, limit = 100 } = params as {
          table: string;
          select?: string;
          filters?: Record<string, unknown>;
          limit?: number;
        };

        if (!table) {
          return NextResponse.json({ error: 'table is required' }, { status: 400 });
        }

        let query = userSupabase.from(table).select(select).limit(limit);

        // Apply filters if provided
        if (filters) {
          for (const [key, value] of Object.entries(filters)) {
            query = query.eq(key, value);
          }
        }

        const { data, error } = await query;

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
        result = { rows: data, count: data?.length || 0 };
        break;
      }

      case 'insert_record': {
        const { table, record } = params as { table: string; record: Record<string, unknown> };

        if (!table || !record) {
          return NextResponse.json({ error: 'table and record are required' }, { status: 400 });
        }

        const { data, error } = await userSupabase.from(table).insert(record).select();

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
        result = { inserted: data };
        break;
      }

      case 'update_record': {
        const { table, record, filters } = params as {
          table: string;
          record: Record<string, unknown>;
          filters: Record<string, unknown>;
        };

        if (!table || !record || !filters) {
          return NextResponse.json({ error: 'table, record, and filters are required' }, { status: 400 });
        }

        let query = userSupabase.from(table).update(record);

        for (const [key, value] of Object.entries(filters)) {
          query = query.eq(key, value);
        }

        const { data, error } = await query.select();

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
        result = { updated: data };
        break;
      }

      case 'delete_record': {
        const { table, filters } = params as {
          table: string;
          filters: Record<string, unknown>;
        };

        if (!table || !filters || Object.keys(filters).length === 0) {
          return NextResponse.json(
            { error: 'table and at least one filter are required for safety' },
            { status: 400 }
          );
        }

        let query = userSupabase.from(table).delete();

        for (const [key, value] of Object.entries(filters)) {
          query = query.eq(key, value);
        }

        const { data, error } = await query.select();

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }
        result = { deleted: data };
        break;
      }

      case 'list_users': {
        // List auth users (requires service role key)
        const { data: { users }, error } = await userSupabase.auth.admin.listUsers();

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }

        // Return sanitized user data
        result = {
          users: users?.map(u => ({
            id: u.id,
            email: u.email,
            created_at: u.created_at,
            last_sign_in_at: u.last_sign_in_at,
            email_confirmed_at: u.email_confirmed_at,
          })),
          count: users?.length || 0,
        };
        break;
      }

      case 'get_schema': {
        const { table } = params as { table: string };

        if (!table) {
          return NextResponse.json({ error: 'table is required' }, { status: 400 });
        }

        // Get a single row to infer schema
        const { data, error } = await userSupabase.from(table).select('*').limit(1);

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 400 });
        }

        // Infer column types from the first row
        const columns = data && data[0]
          ? Object.entries(data[0]).map(([name, value]) => ({
              name,
              type: typeof value,
              sample: value,
            }))
          : [];

        result = { table, columns };
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('[Supabase Execute API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
