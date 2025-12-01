/**
 * ZAPIER ACTION EXECUTION API
 * Execute Zapier webhook and NLA (Natural Language Actions) API actions
 * POST: Execute a specific Zapier action
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

    const connection = await getUserConnection(user.id, 'zapier');
    if (!connection) {
      return NextResponse.json({ error: 'Zapier not connected' }, { status: 400 });
    }

    const { action, params }: ExecuteRequest = await request.json();

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    // Token format: NLA_API_KEY (for Natural Language Actions)
    // Or: WEBHOOK_URL for simple webhook triggers
    const token = connection.token;

    let result: unknown;

    switch (action) {
      case 'trigger_webhook': {
        // Trigger a Zapier webhook
        const webhookUrl = params.webhookUrl as string || token;
        const data = params.data as Record<string, unknown> || {};

        if (!webhookUrl || !webhookUrl.startsWith('https://hooks.zapier.com/')) {
          return NextResponse.json({ error: 'Valid Zapier webhook URL is required' }, { status: 400 });
        }

        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          const errorText = await response.text();
          return NextResponse.json({ error: errorText || 'Failed to trigger webhook' }, { status: response.status });
        }

        result = await response.json().catch(() => ({ success: true, message: 'Webhook triggered' }));
        break;
      }

      case 'list_actions': {
        // List available NLA actions
        if (!token.startsWith('sk-')) {
          return NextResponse.json({ error: 'NLA API key required for this action' }, { status: 400 });
        }

        const response = await fetch('https://nla.zapier.com/api/v1/exposed/', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json({ error: error.message || 'Failed to list actions' }, { status: response.status });
        }

        result = await response.json();
        break;
      }

      case 'execute_action': {
        // Execute a specific NLA action
        if (!token.startsWith('sk-')) {
          return NextResponse.json({ error: 'NLA API key required for this action' }, { status: 400 });
        }

        const actionId = params.actionId as string;
        const instructions = params.instructions as string;

        if (!actionId || !instructions) {
          return NextResponse.json({ error: 'actionId and instructions are required' }, { status: 400 });
        }

        const response = await fetch(`https://nla.zapier.com/api/v1/exposed/${actionId}/execute/`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            instructions,
            ...(params.additionalParams as Record<string, unknown> || {}),
          }),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json({ error: error.message || 'Failed to execute action' }, { status: response.status });
        }

        result = await response.json();
        break;
      }

      case 'preview_action': {
        // Preview an NLA action without executing
        if (!token.startsWith('sk-')) {
          return NextResponse.json({ error: 'NLA API key required for this action' }, { status: 400 });
        }

        const actionId = params.actionId as string;
        const instructions = params.instructions as string;

        if (!actionId || !instructions) {
          return NextResponse.json({ error: 'actionId and instructions are required' }, { status: 400 });
        }

        const response = await fetch(`https://nla.zapier.com/api/v1/exposed/${actionId}/execute/`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            instructions,
            preview_only: true,
          }),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json({ error: error.message || 'Failed to preview action' }, { status: response.status });
        }

        result = await response.json();
        break;
      }

      case 'get_action': {
        // Get details of a specific action
        if (!token.startsWith('sk-')) {
          return NextResponse.json({ error: 'NLA API key required for this action' }, { status: 400 });
        }

        const actionId = params.actionId as string;
        if (!actionId) {
          return NextResponse.json({ error: 'actionId is required' }, { status: 400 });
        }

        const response = await fetch(`https://nla.zapier.com/api/v1/exposed/${actionId}/`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json({ error: error.message || 'Failed to get action' }, { status: response.status });
        }

        result = await response.json();
        break;
      }

      case 'get_execution_log': {
        // Get execution log for an action
        if (!token.startsWith('sk-')) {
          return NextResponse.json({ error: 'NLA API key required for this action' }, { status: 400 });
        }

        const executionId = params.executionId as string;
        if (!executionId) {
          return NextResponse.json({ error: 'executionId is required' }, { status: 400 });
        }

        const response = await fetch(`https://nla.zapier.com/api/v1/execution-log/${executionId}/`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          return NextResponse.json({ error: error.message || 'Failed to get execution log' }, { status: response.status });
        }

        result = await response.json();
        break;
      }

      case 'send_to_email': {
        // Trigger webhook to send an email (common use case)
        const webhookUrl = params.webhookUrl as string;
        if (!webhookUrl) {
          return NextResponse.json({ error: 'webhookUrl is required' }, { status: 400 });
        }

        const emailData = {
          to: params.to,
          subject: params.subject,
          body: params.body,
          ...(params.additionalData as Record<string, unknown> || {}),
        };

        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(emailData),
        });

        if (!response.ok) {
          const errorText = await response.text();
          return NextResponse.json({ error: errorText || 'Failed to send email' }, { status: response.status });
        }

        result = { success: true, message: 'Email request sent to Zapier' };
        break;
      }

      case 'send_to_slack': {
        // Trigger webhook to send a Slack message (common use case)
        const webhookUrl = params.webhookUrl as string;
        if (!webhookUrl) {
          return NextResponse.json({ error: 'webhookUrl is required' }, { status: 400 });
        }

        const slackData = {
          channel: params.channel,
          message: params.message,
          ...(params.additionalData as Record<string, unknown> || {}),
        };

        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(slackData),
        });

        if (!response.ok) {
          const errorText = await response.text();
          return NextResponse.json({ error: errorText || 'Failed to send to Slack' }, { status: response.status });
        }

        result = { success: true, message: 'Slack message sent via Zapier' };
        break;
      }

      case 'create_task': {
        // Trigger webhook to create a task (common use case)
        const webhookUrl = params.webhookUrl as string;
        if (!webhookUrl) {
          return NextResponse.json({ error: 'webhookUrl is required' }, { status: 400 });
        }

        const taskData = {
          title: params.title,
          description: params.description,
          dueDate: params.dueDate,
          priority: params.priority,
          ...(params.additionalData as Record<string, unknown> || {}),
        };

        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(taskData),
        });

        if (!response.ok) {
          const errorText = await response.text();
          return NextResponse.json({ error: errorText || 'Failed to create task' }, { status: response.status });
        }

        result = { success: true, message: 'Task creation triggered via Zapier' };
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('[Zapier Execute API] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
