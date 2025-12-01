/**
 * ASANA CONNECTOR
 * Manage tasks and projects in Asana
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

    const connection = await getUserConnection(user.id, 'asana');
    if (!connection) {
      return NextResponse.json({ error: 'Asana not connected' }, { status: 400 });
    }

    const token = connection.token;
    const baseUrl = 'https://app.asana.com/api/1.0';

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    let result: unknown;

    switch (action) {
      case 'get_me': {
        // Get current user info
        const response = await fetch(`${baseUrl}/users/me`, { headers });
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json({ error: error.errors?.[0]?.message || 'Failed to get user' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'list_workspaces': {
        // List all workspaces
        const response = await fetch(`${baseUrl}/workspaces`, { headers });
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json({ error: error.errors?.[0]?.message || 'Failed to list workspaces' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'list_projects': {
        // List projects in a workspace
        const workspaceId = params.workspaceId;
        const queryParams = new URLSearchParams({
          ...(workspaceId && { workspace: workspaceId }),
          opt_fields: 'name,notes,color,created_at,current_status,owner,team',
        });

        const response = await fetch(`${baseUrl}/projects?${queryParams}`, { headers });
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json({ error: error.errors?.[0]?.message || 'Failed to list projects' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_project': {
        // Get a specific project
        const projectId = params.projectId;
        if (!projectId) {
          return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
        }

        const response = await fetch(`${baseUrl}/projects/${projectId}?opt_fields=name,notes,color,created_at,current_status,owner,team,members`, { headers });
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json({ error: error.errors?.[0]?.message || 'Failed to get project' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'list_tasks': {
        // List tasks in a project or assigned to user
        const projectId = params.projectId;
        const assignee = params.assignee || 'me';
        const workspaceId = params.workspaceId;

        let url = `${baseUrl}/tasks?opt_fields=name,notes,completed,due_on,assignee,projects,tags`;
        if (projectId) {
          url += `&project=${projectId}`;
        } else if (workspaceId) {
          url += `&workspace=${workspaceId}&assignee=${assignee}`;
        }

        const response = await fetch(url, { headers });
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json({ error: error.errors?.[0]?.message || 'Failed to list tasks' }, { status: response.status });
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

        const response = await fetch(`${baseUrl}/tasks/${taskId}?opt_fields=name,notes,completed,due_on,assignee,projects,tags,subtasks,parent`, { headers });
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json({ error: error.errors?.[0]?.message || 'Failed to get task' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'create_task': {
        // Create a new task
        const name = params.name;
        if (!name) {
          return NextResponse.json({ error: 'name is required' }, { status: 400 });
        }

        const taskData: Record<string, unknown> = {
          name,
          ...(params.notes && { notes: params.notes }),
          ...(params.dueOn && { due_on: params.dueOn }),
          ...(params.projectId && { projects: [params.projectId] }),
          ...(params.assignee && { assignee: params.assignee }),
          ...(params.workspaceId && { workspace: params.workspaceId }),
        };

        const response = await fetch(`${baseUrl}/tasks`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ data: taskData }),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json({ error: error.errors?.[0]?.message || 'Failed to create task' }, { status: response.status });
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
          ...(params.notes !== undefined && { notes: params.notes }),
          ...(params.completed !== undefined && { completed: params.completed }),
          ...(params.dueOn !== undefined && { due_on: params.dueOn }),
          ...(params.assignee && { assignee: params.assignee }),
        };

        const response = await fetch(`${baseUrl}/tasks/${taskId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ data: updateData }),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json({ error: error.errors?.[0]?.message || 'Failed to update task' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'complete_task': {
        // Mark task as complete
        const taskId = params.taskId;
        if (!taskId) {
          return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
        }

        const response = await fetch(`${baseUrl}/tasks/${taskId}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ data: { completed: true } }),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json({ error: error.errors?.[0]?.message || 'Failed to complete task' }, { status: response.status });
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

        const response = await fetch(`${baseUrl}/tasks/${taskId}`, {
          method: 'DELETE',
          headers,
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json({ error: error.errors?.[0]?.message || 'Failed to delete task' }, { status: response.status });
        }
        result = { success: true, message: 'Task deleted' };
        break;
      }

      case 'add_comment': {
        // Add a comment to a task
        const taskId = params.taskId;
        const text = params.text;
        if (!taskId || !text) {
          return NextResponse.json({ error: 'taskId and text are required' }, { status: 400 });
        }

        const response = await fetch(`${baseUrl}/tasks/${taskId}/stories`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ data: { text } }),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json({ error: error.errors?.[0]?.message || 'Failed to add comment' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'search_tasks': {
        // Search tasks in a workspace
        const workspaceId = params.workspaceId;
        const query = params.query;
        if (!workspaceId) {
          return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
        }

        const queryParams = new URLSearchParams({
          ...(query && { text: query }),
          opt_fields: 'name,notes,completed,due_on,assignee',
        });

        const response = await fetch(`${baseUrl}/workspaces/${workspaceId}/tasks/search?${queryParams}`, { headers });
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json({ error: error.errors?.[0]?.message || 'Failed to search tasks' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'list_sections': {
        // List sections in a project
        const projectId = params.projectId;
        if (!projectId) {
          return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
        }

        const response = await fetch(`${baseUrl}/projects/${projectId}/sections`, { headers });
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json({ error: error.errors?.[0]?.message || 'Failed to list sections' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('[Asana Connector] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
