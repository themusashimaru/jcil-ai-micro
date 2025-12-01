/**
 * MONDAY.COM CONNECTOR
 * Manage boards and items in Monday.com
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server-auth';
import { getUserConnection } from '@/lib/connectors/helpers';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { action, params = {} } = body;

    const connection = await getUserConnection(user.id, 'monday');
    if (!connection) {
      return NextResponse.json({ error: 'Monday.com not connected' }, { status: 400 });
    }

    const token = connection.token;
    const apiUrl = 'https://api.monday.com/v2';

    const headers: Record<string, string> = {
      'Authorization': token,
      'Content-Type': 'application/json',
      'API-Version': '2024-01',
    };

    // Helper function to execute GraphQL queries
    async function executeQuery(query: string, variables?: Record<string, unknown>) {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query, variables }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'API request failed');
      }

      const data = await response.json();
      if (data.errors) {
        throw new Error(data.errors[0]?.message || 'GraphQL error');
      }
      return data.data;
    }

    let result: unknown;

    switch (action) {
      case 'get_me': {
        // Get current user info
        const query = `query { me { id name email } }`;
        result = await executeQuery(query);
        break;
      }

      case 'list_workspaces': {
        // List all workspaces
        const query = `query { workspaces { id name kind description } }`;
        result = await executeQuery(query);
        break;
      }

      case 'list_boards': {
        // List all boards
        const limit = params.limit || 25;
        const workspaceId = params.workspaceId;

        let query: string;
        if (workspaceId) {
          query = `query { boards(limit: ${limit}, workspace_ids: [${workspaceId}]) { id name state board_kind workspace_id } }`;
        } else {
          query = `query { boards(limit: ${limit}) { id name state board_kind workspace_id } }`;
        }
        result = await executeQuery(query);
        break;
      }

      case 'get_board': {
        // Get a specific board with columns and groups
        const boardId = params.boardId;
        if (!boardId) {
          return NextResponse.json({ error: 'boardId is required' }, { status: 400 });
        }

        const query = `query {
          boards(ids: [${boardId}]) {
            id name description state
            columns { id title type }
            groups { id title color }
          }
        }`;
        result = await executeQuery(query);
        break;
      }

      case 'list_items': {
        // List items in a board
        const boardId = params.boardId;
        const limit = params.limit || 50;
        if (!boardId) {
          return NextResponse.json({ error: 'boardId is required' }, { status: 400 });
        }

        const query = `query {
          boards(ids: [${boardId}]) {
            items_page(limit: ${limit}) {
              items {
                id name state created_at updated_at
                group { id title }
                column_values { id text value }
              }
            }
          }
        }`;
        result = await executeQuery(query);
        break;
      }

      case 'get_item': {
        // Get a specific item
        const itemId = params.itemId;
        if (!itemId) {
          return NextResponse.json({ error: 'itemId is required' }, { status: 400 });
        }

        const query = `query {
          items(ids: [${itemId}]) {
            id name state created_at updated_at
            board { id name }
            group { id title }
            column_values { id title text value type }
            subitems { id name }
          }
        }`;
        result = await executeQuery(query);
        break;
      }

      case 'create_item': {
        // Create a new item
        const boardId = params.boardId;
        const itemName = params.name;
        const groupId = params.groupId;
        if (!boardId || !itemName) {
          return NextResponse.json({ error: 'boardId and name are required' }, { status: 400 });
        }

        const columnValues = params.columnValues ? JSON.stringify(JSON.stringify(params.columnValues)) : '"{}"';

        let query: string;
        if (groupId) {
          query = `mutation { create_item(board_id: ${boardId}, group_id: "${groupId}", item_name: "${itemName}", column_values: ${columnValues}) { id name } }`;
        } else {
          query = `mutation { create_item(board_id: ${boardId}, item_name: "${itemName}", column_values: ${columnValues}) { id name } }`;
        }
        result = await executeQuery(query);
        break;
      }

      case 'update_item': {
        // Update an item's column values
        const boardId = params.boardId;
        const itemId = params.itemId;
        const columnValues = params.columnValues;
        if (!boardId || !itemId || !columnValues) {
          return NextResponse.json({ error: 'boardId, itemId, and columnValues are required' }, { status: 400 });
        }

        const valuesStr = JSON.stringify(JSON.stringify(columnValues));
        const query = `mutation { change_multiple_column_values(board_id: ${boardId}, item_id: ${itemId}, column_values: ${valuesStr}) { id name } }`;
        result = await executeQuery(query);
        break;
      }

      case 'update_item_name': {
        // Update an item's name
        const itemId = params.itemId;
        const name = params.name;
        if (!itemId || !name) {
          return NextResponse.json({ error: 'itemId and name are required' }, { status: 400 });
        }

        const query = `mutation { change_simple_column_value(item_id: ${itemId}, board_id: ${params.boardId || 0}, column_id: "name", value: "${name}") { id name } }`;
        result = await executeQuery(query);
        break;
      }

      case 'move_item_to_group': {
        // Move an item to a different group
        const itemId = params.itemId;
        const groupId = params.groupId;
        if (!itemId || !groupId) {
          return NextResponse.json({ error: 'itemId and groupId are required' }, { status: 400 });
        }

        const query = `mutation { move_item_to_group(item_id: ${itemId}, group_id: "${groupId}") { id } }`;
        result = await executeQuery(query);
        break;
      }

      case 'archive_item': {
        // Archive an item
        const itemId = params.itemId;
        if (!itemId) {
          return NextResponse.json({ error: 'itemId is required' }, { status: 400 });
        }

        const query = `mutation { archive_item(item_id: ${itemId}) { id } }`;
        result = await executeQuery(query);
        break;
      }

      case 'delete_item': {
        // Delete an item
        const itemId = params.itemId;
        if (!itemId) {
          return NextResponse.json({ error: 'itemId is required' }, { status: 400 });
        }

        const query = `mutation { delete_item(item_id: ${itemId}) { id } }`;
        result = await executeQuery(query);
        break;
      }

      case 'create_group': {
        // Create a new group on a board
        const boardId = params.boardId;
        const groupName = params.name;
        if (!boardId || !groupName) {
          return NextResponse.json({ error: 'boardId and name are required' }, { status: 400 });
        }

        const query = `mutation { create_group(board_id: ${boardId}, group_name: "${groupName}") { id title } }`;
        result = await executeQuery(query);
        break;
      }

      case 'add_update': {
        // Add an update (comment) to an item
        const itemId = params.itemId;
        const body = params.body;
        if (!itemId || !body) {
          return NextResponse.json({ error: 'itemId and body are required' }, { status: 400 });
        }

        const escapedBody = body.replace(/"/g, '\\"').replace(/\n/g, '\\n');
        const query = `mutation { create_update(item_id: ${itemId}, body: "${escapedBody}") { id body } }`;
        result = await executeQuery(query);
        break;
      }

      case 'list_updates': {
        // List updates for an item
        const itemId = params.itemId;
        const limit = params.limit || 25;
        if (!itemId) {
          return NextResponse.json({ error: 'itemId is required' }, { status: 400 });
        }

        const query = `query { items(ids: [${itemId}]) { updates(limit: ${limit}) { id body created_at creator { id name } } } }`;
        result = await executeQuery(query);
        break;
      }

      case 'search_items': {
        // Search for items across boards
        const query_text = params.query;
        const limit = params.limit || 25;
        if (!query_text) {
          return NextResponse.json({ error: 'query is required' }, { status: 400 });
        }

        const query = `query { items_page_by_column_values(limit: ${limit}, board_id: ${params.boardId || 0}, columns: [{column_id: "name", column_values: ["${query_text}"]}]) { items { id name board { id name } } } }`;
        result = await executeQuery(query);
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('[Monday Connector] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
