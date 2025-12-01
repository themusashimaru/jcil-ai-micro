/**
 * AIRTABLE ACTION EXECUTION API
 * Execute Airtable API actions
 * POST: Execute a specific Airtable action
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server-auth';
import { getUserConnection } from '@/lib/connectors/helpers';

export const runtime = 'nodejs';

const AIRTABLE_API = 'https://api.airtable.com/v0';

interface ExecuteRequest {
  action: string;
  params: Record<string, unknown>;
}

// Helper for Airtable API requests
async function airtableFetch(
  token: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const baseUrl = endpoint.startsWith('/meta') ? 'https://api.airtable.com/v0' : AIRTABLE_API;
  return fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const connection = await getUserConnection(user.id, 'airtable');
    if (!connection) {
      return NextResponse.json({ error: 'Airtable not connected' }, { status: 400 });
    }

    const body: ExecuteRequest = await request.json();
    const { action, params } = body;

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    const token = connection.token;
    let result: unknown;

    switch (action) {
      case 'list_bases': {
        const response = await airtableFetch(token, '/meta/bases');

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json(
            { error: error.error?.message || 'Failed to list bases' },
            { status: response.status }
          );
        }

        const data = await response.json();
        result = {
          bases: data.bases?.map((b: { id: string; name: string; permissionLevel: string }) => ({
            id: b.id,
            name: b.name,
            permissionLevel: b.permissionLevel,
          })) || [],
          count: data.bases?.length || 0,
        };
        break;
      }

      case 'get_base_schema': {
        const { baseId } = params as { baseId: string };
        if (!baseId) {
          return NextResponse.json({ error: 'baseId is required' }, { status: 400 });
        }

        const response = await airtableFetch(token, `/meta/bases/${baseId}/tables`);

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json(
            { error: error.error?.message || 'Failed to get base schema' },
            { status: response.status }
          );
        }

        const data = await response.json();
        result = {
          tables: data.tables?.map((t: {
            id: string;
            name: string;
            primaryFieldId: string;
            fields: Array<{ id: string; name: string; type: string }>;
          }) => ({
            id: t.id,
            name: t.name,
            primaryFieldId: t.primaryFieldId,
            fields: t.fields?.map(f => ({
              id: f.id,
              name: f.name,
              type: f.type,
            })),
          })) || [],
          count: data.tables?.length || 0,
        };
        break;
      }

      case 'list_records': {
        const { baseId, tableId, maxRecords = 100, view, filterByFormula, sort } = params as {
          baseId: string;
          tableId: string;
          maxRecords?: number;
          view?: string;
          filterByFormula?: string;
          sort?: Array<{ field: string; direction: 'asc' | 'desc' }>;
        };

        if (!baseId || !tableId) {
          return NextResponse.json({ error: 'baseId and tableId are required' }, { status: 400 });
        }

        const queryParams = new URLSearchParams();
        queryParams.set('maxRecords', String(maxRecords));
        if (view) queryParams.set('view', view);
        if (filterByFormula) queryParams.set('filterByFormula', filterByFormula);
        if (sort) {
          sort.forEach((s, i) => {
            queryParams.set(`sort[${i}][field]`, s.field);
            queryParams.set(`sort[${i}][direction]`, s.direction);
          });
        }

        const response = await airtableFetch(
          token,
          `/${baseId}/${encodeURIComponent(tableId)}?${queryParams.toString()}`
        );

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json(
            { error: error.error?.message || 'Failed to list records' },
            { status: response.status }
          );
        }

        const data = await response.json();
        result = {
          records: data.records?.map((r: { id: string; fields: Record<string, unknown>; createdTime: string }) => ({
            id: r.id,
            fields: r.fields,
            createdTime: r.createdTime,
          })) || [],
          count: data.records?.length || 0,
          offset: data.offset,
        };
        break;
      }

      case 'get_record': {
        const { baseId, tableId, recordId } = params as {
          baseId: string;
          tableId: string;
          recordId: string;
        };

        if (!baseId || !tableId || !recordId) {
          return NextResponse.json({ error: 'baseId, tableId, and recordId are required' }, { status: 400 });
        }

        const response = await airtableFetch(
          token,
          `/${baseId}/${encodeURIComponent(tableId)}/${recordId}`
        );

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json(
            { error: error.error?.message || 'Failed to get record' },
            { status: response.status }
          );
        }

        const record = await response.json();
        result = {
          id: record.id,
          fields: record.fields,
          createdTime: record.createdTime,
        };
        break;
      }

      case 'create_record': {
        const { baseId, tableId, fields } = params as {
          baseId: string;
          tableId: string;
          fields: Record<string, unknown>;
        };

        if (!baseId || !tableId || !fields) {
          return NextResponse.json({ error: 'baseId, tableId, and fields are required' }, { status: 400 });
        }

        const response = await airtableFetch(
          token,
          `/${baseId}/${encodeURIComponent(tableId)}`,
          {
            method: 'POST',
            body: JSON.stringify({ fields }),
          }
        );

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json(
            { error: error.error?.message || 'Failed to create record' },
            { status: response.status }
          );
        }

        const record = await response.json();
        result = {
          id: record.id,
          fields: record.fields,
          createdTime: record.createdTime,
          message: 'Record created successfully!',
        };
        break;
      }

      case 'update_record': {
        const { baseId, tableId, recordId, fields } = params as {
          baseId: string;
          tableId: string;
          recordId: string;
          fields: Record<string, unknown>;
        };

        if (!baseId || !tableId || !recordId || !fields) {
          return NextResponse.json(
            { error: 'baseId, tableId, recordId, and fields are required' },
            { status: 400 }
          );
        }

        const response = await airtableFetch(
          token,
          `/${baseId}/${encodeURIComponent(tableId)}/${recordId}`,
          {
            method: 'PATCH',
            body: JSON.stringify({ fields }),
          }
        );

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json(
            { error: error.error?.message || 'Failed to update record' },
            { status: response.status }
          );
        }

        const record = await response.json();
        result = {
          id: record.id,
          fields: record.fields,
          message: 'Record updated successfully!',
        };
        break;
      }

      case 'delete_record': {
        const { baseId, tableId, recordId } = params as {
          baseId: string;
          tableId: string;
          recordId: string;
        };

        if (!baseId || !tableId || !recordId) {
          return NextResponse.json(
            { error: 'baseId, tableId, and recordId are required' },
            { status: 400 }
          );
        }

        const response = await airtableFetch(
          token,
          `/${baseId}/${encodeURIComponent(tableId)}/${recordId}`,
          { method: 'DELETE' }
        );

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json(
            { error: error.error?.message || 'Failed to delete record' },
            { status: response.status }
          );
        }

        const data = await response.json();
        result = {
          id: data.id,
          deleted: data.deleted,
          message: 'Record deleted successfully!',
        };
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('[Airtable Execute API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
