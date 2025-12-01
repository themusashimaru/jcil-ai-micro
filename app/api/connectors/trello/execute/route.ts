/**
 * TRELLO CONNECTOR
 * Manage Trello boards, lists, and cards
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

    const connection = await getUserConnection(user.id, 'trello');
    if (!connection) {
      return NextResponse.json({ error: 'Trello not connected' }, { status: 400 });
    }

    // Token format: API_KEY|TOKEN (or API_KEY:TOKEN)
    const separator = connection.token.includes('|') ? '|' : ':';
    const parts = connection.token.split(separator);
    if (parts.length !== 2) {
      return NextResponse.json({ error: 'Invalid token format. Expected API_KEY|TOKEN' }, { status: 400 });
    }

    const [apiKey, token] = parts.map(p => p.trim());
    const baseUrl = 'https://api.trello.com/1';
    const authParams = `key=${apiKey}&token=${token}`;

    let result: unknown;

    switch (action) {
      case 'get_me': {
        // Get current member info
        const response = await fetch(`${baseUrl}/members/me?${authParams}`);
        if (!response.ok) {
          const error = await response.text();
          return NextResponse.json({ error: error || 'Failed to get user' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'list_boards': {
        // List all boards for the member
        const response = await fetch(`${baseUrl}/members/me/boards?${authParams}&fields=name,desc,url,closed`);
        if (!response.ok) {
          const error = await response.text();
          return NextResponse.json({ error: error || 'Failed to list boards' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_board': {
        // Get a specific board
        const boardId = params.boardId;
        if (!boardId) {
          return NextResponse.json({ error: 'boardId is required' }, { status: 400 });
        }

        const response = await fetch(`${baseUrl}/boards/${boardId}?${authParams}&fields=name,desc,url,closed&lists=all&cards=all`);
        if (!response.ok) {
          const error = await response.text();
          return NextResponse.json({ error: error || 'Failed to get board' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'list_lists': {
        // List all lists on a board
        const boardId = params.boardId;
        if (!boardId) {
          return NextResponse.json({ error: 'boardId is required' }, { status: 400 });
        }

        const response = await fetch(`${baseUrl}/boards/${boardId}/lists?${authParams}&fields=name,closed,pos`);
        if (!response.ok) {
          const error = await response.text();
          return NextResponse.json({ error: error || 'Failed to list lists' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'list_cards': {
        // List cards on a board or in a list
        const boardId = params.boardId;
        const listId = params.listId;

        let url: string;
        if (listId) {
          url = `${baseUrl}/lists/${listId}/cards?${authParams}`;
        } else if (boardId) {
          url = `${baseUrl}/boards/${boardId}/cards?${authParams}`;
        } else {
          return NextResponse.json({ error: 'boardId or listId is required' }, { status: 400 });
        }

        const response = await fetch(url);
        if (!response.ok) {
          const error = await response.text();
          return NextResponse.json({ error: error || 'Failed to list cards' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_card': {
        // Get a specific card
        const cardId = params.cardId;
        if (!cardId) {
          return NextResponse.json({ error: 'cardId is required' }, { status: 400 });
        }

        const response = await fetch(`${baseUrl}/cards/${cardId}?${authParams}&members=true&attachments=true`);
        if (!response.ok) {
          const error = await response.text();
          return NextResponse.json({ error: error || 'Failed to get card' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'create_card': {
        // Create a new card
        const listId = params.listId;
        const name = params.name;
        if (!listId || !name) {
          return NextResponse.json({ error: 'listId and name are required' }, { status: 400 });
        }

        const cardParams = new URLSearchParams({
          key: apiKey,
          token,
          idList: listId,
          name,
          ...(params.desc && { desc: params.desc }),
          ...(params.due && { due: params.due }),
          ...(params.pos && { pos: params.pos }),
        });

        const response = await fetch(`${baseUrl}/cards?${cardParams}`, {
          method: 'POST',
        });

        if (!response.ok) {
          const error = await response.text();
          return NextResponse.json({ error: error || 'Failed to create card' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'update_card': {
        // Update a card
        const cardId = params.cardId;
        if (!cardId) {
          return NextResponse.json({ error: 'cardId is required' }, { status: 400 });
        }

        const updateParams = new URLSearchParams({
          key: apiKey,
          token,
          ...(params.name && { name: params.name }),
          ...(params.desc !== undefined && { desc: params.desc }),
          ...(params.due !== undefined && { due: params.due || 'null' }),
          ...(params.closed !== undefined && { closed: String(params.closed) }),
          ...(params.idList && { idList: params.idList }),
        });

        const response = await fetch(`${baseUrl}/cards/${cardId}?${updateParams}`, {
          method: 'PUT',
        });

        if (!response.ok) {
          const error = await response.text();
          return NextResponse.json({ error: error || 'Failed to update card' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'move_card': {
        // Move a card to a different list
        const cardId = params.cardId;
        const listId = params.listId;
        if (!cardId || !listId) {
          return NextResponse.json({ error: 'cardId and listId are required' }, { status: 400 });
        }

        const response = await fetch(`${baseUrl}/cards/${cardId}?${authParams}&idList=${listId}`, {
          method: 'PUT',
        });

        if (!response.ok) {
          const error = await response.text();
          return NextResponse.json({ error: error || 'Failed to move card' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'archive_card': {
        // Archive a card
        const cardId = params.cardId;
        if (!cardId) {
          return NextResponse.json({ error: 'cardId is required' }, { status: 400 });
        }

        const response = await fetch(`${baseUrl}/cards/${cardId}?${authParams}&closed=true`, {
          method: 'PUT',
        });

        if (!response.ok) {
          const error = await response.text();
          return NextResponse.json({ error: error || 'Failed to archive card' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'delete_card': {
        // Delete a card
        const cardId = params.cardId;
        if (!cardId) {
          return NextResponse.json({ error: 'cardId is required' }, { status: 400 });
        }

        const response = await fetch(`${baseUrl}/cards/${cardId}?${authParams}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          const error = await response.text();
          return NextResponse.json({ error: error || 'Failed to delete card' }, { status: response.status });
        }
        result = { success: true, message: 'Card deleted' };
        break;
      }

      case 'add_comment': {
        // Add a comment to a card
        const cardId = params.cardId;
        const text = params.text;
        if (!cardId || !text) {
          return NextResponse.json({ error: 'cardId and text are required' }, { status: 400 });
        }

        const response = await fetch(`${baseUrl}/cards/${cardId}/actions/comments?${authParams}&text=${encodeURIComponent(text)}`, {
          method: 'POST',
        });

        if (!response.ok) {
          const error = await response.text();
          return NextResponse.json({ error: error || 'Failed to add comment' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'create_list': {
        // Create a new list on a board
        const boardId = params.boardId;
        const name = params.name;
        if (!boardId || !name) {
          return NextResponse.json({ error: 'boardId and name are required' }, { status: 400 });
        }

        const response = await fetch(`${baseUrl}/lists?${authParams}&idBoard=${boardId}&name=${encodeURIComponent(name)}`, {
          method: 'POST',
        });

        if (!response.ok) {
          const error = await response.text();
          return NextResponse.json({ error: error || 'Failed to create list' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'add_label': {
        // Add a label to a card
        const cardId = params.cardId;
        const labelId = params.labelId;
        if (!cardId || !labelId) {
          return NextResponse.json({ error: 'cardId and labelId are required' }, { status: 400 });
        }

        const response = await fetch(`${baseUrl}/cards/${cardId}/idLabels?${authParams}&value=${labelId}`, {
          method: 'POST',
        });

        if (!response.ok) {
          const error = await response.text();
          return NextResponse.json({ error: error || 'Failed to add label' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'list_labels': {
        // List labels on a board
        const boardId = params.boardId;
        if (!boardId) {
          return NextResponse.json({ error: 'boardId is required' }, { status: 400 });
        }

        const response = await fetch(`${baseUrl}/boards/${boardId}/labels?${authParams}`);
        if (!response.ok) {
          const error = await response.text();
          return NextResponse.json({ error: error || 'Failed to list labels' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('[Trello Connector] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
