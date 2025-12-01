/**
 * CLICKUP CONNECTOR
 * Manage tasks and spaces in ClickUp
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

    const connection = await getUserConnection(user.id, 'clickup');
    if (!connection) {
      return NextResponse.json({ error: 'ClickUp not connected' }, { status: 400 });
    }

    const token = connection.token;
    const baseUrl = 'https://api.clickup.com/api/v2';

    const headers: Record<string, string> = {
      'Authorization': token,
      'Content-Type': 'application/json',
    };

    let result: unknown;

    switch (action) {
      case 'get_user': {
        // Get current user info
        const response = await fetch(`${baseUrl}/user`, { headers });
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json({ error: error.err || 'Failed to get user' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'list_teams': {
        // List all workspaces (teams)
        const response = await fetch(`${baseUrl}/team`, { headers });
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json({ error: error.err || 'Failed to list teams' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'list_spaces': {
        // List spaces in a team
        const teamId = params.teamId;
        if (!teamId) {
          return NextResponse.json({ error: 'teamId is required' }, { status: 400 });
        }

        const response = await fetch(`${baseUrl}/team/${teamId}/space?archived=false`, { headers });
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json({ error: error.err || 'Failed to list spaces' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'list_folders': {
        // List folders in a space
        const spaceId = params.spaceId;
        if (!spaceId) {
          return NextResponse.json({ error: 'spaceId is required' }, { status: 400 });
        }

        const response = await fetch(`${baseUrl}/space/${spaceId}/folder?archived=false`, { headers });
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json({ error: error.err || 'Failed to list folders' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'list_lists': {
        // List lists in a folder or space
        const folderId = params.folderId;
        const spaceId = params.spaceId;

        let url: string;
        if (folderId) {
          url = `${baseUrl}/folder/${folderId}/list?archived=false`;
        } else if (spaceId) {
          url = `${baseUrl}/space/${spaceId}/list?archived=false`;
        } else {
          return NextResponse.json({ error: 'folderId or spaceId is required' }, { status: 400 });
        }

        const response = await fetch(url, { headers });
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json({ error: error.err || 'Failed to list lists' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'list_tasks': {
        // List tasks in a list
        const listId = params.listId;
        if (!listId) {
          return NextResponse.json({ error: 'listId is required' }, { status: 400 });
        }

        const queryParams = new URLSearchParams({
          archived: 'false',
          ...(params.includeSubtasks && { subtasks: 'true' }),
          ...(params.statuses && { statuses: JSON.stringify(params.statuses) }),
        });

        const response = await fetch(`${baseUrl}/list/${listId}/task?${queryParams}`, { headers });
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json({ error: error.err || 'Failed to list tasks' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_task': {
        // Get a specific task
        const taskId = params.taskId;
        if (!taskId) {
          return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
        }

        const response = await fetch(`${baseUrl}/task/${taskId}?include_subtasks=true`, { headers });
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json({ error: error.err || 'Failed to get task' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'create_task': {
        // Create a new task
        const listId = params.listId;
        const name = params.name;
        if (!listId || !name) {
          return NextResponse.json({ error: 'listId and name are required' }, { status: 400 });
        }

        const taskData: Record<string, unknown> = {
          name,
          ...(params.description && { description: params.description }),
          ...(params.status && { status: params.status }),
          ...(params.priority && { priority: params.priority }),
          ...(params.dueDate && { due_date: new Date(params.dueDate).getTime() }),
          ...(params.assignees && { assignees: params.assignees }),
          ...(params.tags && { tags: params.tags }),
        };

        const response = await fetch(`${baseUrl}/list/${listId}/task`, {
          method: 'POST',
          headers,
          body: JSON.stringify(taskData),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json({ error: error.err || 'Failed to create task' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'update_task': {
        // Update a task
        const taskId = params.taskId;
        if (!taskId) {
          return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
        }

        const updateData: Record<string, unknown> = {
          ...(params.name && { name: params.name }),
          ...(params.description !== undefined && { description: params.description }),
          ...(params.status && { status: params.status }),
          ...(params.priority !== undefined && { priority: params.priority }),
          ...(params.dueDate !== undefined && { due_date: params.dueDate ? new Date(params.dueDate).getTime() : null }),
        };

        const response = await fetch(`${baseUrl}/task/${taskId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(updateData),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json({ error: error.err || 'Failed to update task' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'delete_task': {
        // Delete a task
        const taskId = params.taskId;
        if (!taskId) {
          return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
        }

        const response = await fetch(`${baseUrl}/task/${taskId}`, {
          method: 'DELETE',
          headers,
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json({ error: error.err || 'Failed to delete task' }, { status: response.status });
        }
        result = { success: true, message: 'Task deleted' };
        break;
      }

      case 'add_comment': {
        // Add a comment to a task
        const taskId = params.taskId;
        const commentText = params.text;
        if (!taskId || !commentText) {
          return NextResponse.json({ error: 'taskId and text are required' }, { status: 400 });
        }

        const response = await fetch(`${baseUrl}/task/${taskId}/comment`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ comment_text: commentText }),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json({ error: error.err || 'Failed to add comment' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'list_comments': {
        // List comments on a task
        const taskId = params.taskId;
        if (!taskId) {
          return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
        }

        const response = await fetch(`${baseUrl}/task/${taskId}/comment`, { headers });
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json({ error: error.err || 'Failed to list comments' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'list_statuses': {
        // List statuses for a list
        const listId = params.listId;
        if (!listId) {
          return NextResponse.json({ error: 'listId is required' }, { status: 400 });
        }

        const response = await fetch(`${baseUrl}/list/${listId}`, { headers });
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json({ error: error.err || 'Failed to get list' }, { status: response.status });
        }
        const listData = await response.json();
        result = { statuses: listData.statuses };
        break;
      }

      case 'get_time_tracked': {
        // Get time tracked for a task
        const taskId = params.taskId;
        if (!taskId) {
          return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
        }

        const response = await fetch(`${baseUrl}/task/${taskId}/time`, { headers });
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json({ error: error.err || 'Failed to get time' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('[ClickUp Connector] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
