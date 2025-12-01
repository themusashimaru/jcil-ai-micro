/**
 * N8N ACTION EXECUTION API
 * Execute n8n workflow automation API actions
 * POST: Execute a specific n8n action
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server-auth';
import { getUserConnection } from '@/lib/connectors/helpers';

export const runtime = 'nodejs';

interface ExecuteRequest {
  action: string;
  params: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const connection = await getUserConnection(user.id, 'n8n');
    if (!connection) {
      return NextResponse.json({ error: 'n8n not connected' }, { status: 400 });
    }

    const { action, params }: ExecuteRequest = await request.json();

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    // Token format: N8N_HOST_URL|N8N_API_KEY
    const [hostUrl, apiKey] = connection.token.split('|');
    if (!hostUrl || !apiKey) {
      return NextResponse.json({ error: 'Invalid n8n credentials format' }, { status: 400 });
    }

    // Helper for n8n API requests
    async function n8nFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
      const baseUrl = hostUrl.endsWith('/') ? hostUrl.slice(0, -1) : hostUrl;
      return fetch(`${baseUrl}/api/v1${endpoint}`, {
        ...options,
        headers: {
          'X-N8N-API-KEY': apiKey,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });
    }

    let result: unknown;

    switch (action) {
      case 'list_workflows': {
        // List all workflows
        const active = params.active !== undefined ? `?active=${params.active}` : '';
        const response = await n8nFetch(`/workflows${active}`);
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to list workflows' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_workflow': {
        // Get a specific workflow
        const workflowId = params.workflowId as string;
        if (!workflowId) {
          return NextResponse.json({ error: 'workflowId is required' }, { status: 400 });
        }
        const response = await n8nFetch(`/workflows/${workflowId}`);
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to get workflow' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'activate_workflow': {
        // Activate a workflow
        const workflowId = params.workflowId as string;
        if (!workflowId) {
          return NextResponse.json({ error: 'workflowId is required' }, { status: 400 });
        }
        const response = await n8nFetch(`/workflows/${workflowId}/activate`, {
          method: 'POST',
        });
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to activate workflow' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'deactivate_workflow': {
        // Deactivate a workflow
        const workflowId = params.workflowId as string;
        if (!workflowId) {
          return NextResponse.json({ error: 'workflowId is required' }, { status: 400 });
        }
        const response = await n8nFetch(`/workflows/${workflowId}/deactivate`, {
          method: 'POST',
        });
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to deactivate workflow' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'execute_workflow': {
        // Execute a workflow manually
        const workflowId = params.workflowId as string;
        if (!workflowId) {
          return NextResponse.json({ error: 'workflowId is required' }, { status: 400 });
        }
        const response = await n8nFetch(`/workflows/${workflowId}/run`, {
          method: 'POST',
          body: JSON.stringify({
            data: params.data || {},
          }),
        });
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to execute workflow' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'list_executions': {
        // List workflow executions
        const workflowId = params.workflowId as string;
        const limit = params.limit || 20;
        let endpoint = `/executions?limit=${limit}`;
        if (workflowId) {
          endpoint += `&workflowId=${workflowId}`;
        }
        if (params.status) {
          endpoint += `&status=${params.status}`;
        }
        const response = await n8nFetch(endpoint);
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to list executions' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'get_execution': {
        // Get a specific execution
        const executionId = params.executionId as string;
        if (!executionId) {
          return NextResponse.json({ error: 'executionId is required' }, { status: 400 });
        }
        const response = await n8nFetch(`/executions/${executionId}`);
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to get execution' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'delete_execution': {
        // Delete an execution
        const executionId = params.executionId as string;
        if (!executionId) {
          return NextResponse.json({ error: 'executionId is required' }, { status: 400 });
        }
        const response = await n8nFetch(`/executions/${executionId}`, {
          method: 'DELETE',
        });
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to delete execution' }, { status: response.status });
        }
        result = { success: true, message: 'Execution deleted' };
        break;
      }

      case 'list_credentials': {
        // List all credentials
        const response = await n8nFetch('/credentials');
        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({ error: error.message || 'Failed to list credentials' }, { status: response.status });
        }
        result = await response.json();
        break;
      }

      case 'trigger_webhook': {
        // Trigger a webhook workflow
        const webhookPath = params.webhookPath as string;
        const webhookData = params.data || {};
        if (!webhookPath) {
          return NextResponse.json({ error: 'webhookPath is required' }, { status: 400 });
        }
        const baseUrl = hostUrl.endsWith('/') ? hostUrl.slice(0, -1) : hostUrl;
        const response = await fetch(`${baseUrl}/webhook/${webhookPath}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(webhookData),
        });
        if (!response.ok) {
          const errorText = await response.text();
          return NextResponse.json({ error: errorText || 'Failed to trigger webhook' }, { status: response.status });
        }
        result = await response.json().catch(() => ({ success: true, message: 'Webhook triggered' }));
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('[n8n Execute API] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
