/**
 * WORKSPACE AI AGENT API
 *
 * Run the AI coding agent with real-time streaming updates
 */

import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { StreamingCodingAgent, AutonomousAgent, AgentUpdate } from '@/lib/workspace/agent';
import { validateCSRF } from '@/lib/security/csrf';
import { validateQueryLimit, safeParseJSON } from '@/lib/security/validation';
import { logger } from '@/lib/logger';

const log = logger('AgentAPI');

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for complex tasks

/**
 * POST - Run the AI agent with streaming
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // CSRF Protection
  const csrfCheck = validateCSRF(request);
  if (!csrfCheck.valid) return csrfCheck.response!;

  try {
    const { id: workspaceId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verify workspace ownership
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('id')
      .eq('id', workspaceId)
      .eq('user_id', user.id)
      .single();

    if (!workspace) {
      return new Response(JSON.stringify({ error: 'Workspace not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const jsonResult = await safeParseJSON<{ prompt?: string; mode?: string; model?: string }>(
      request
    );
    if (!jsonResult.success) {
      return new Response(JSON.stringify({ error: jsonResult.error }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const { prompt, mode = 'interactive', model = 'claude-sonnet-4-6' } = jsonResult.data;

    if (!prompt) {
      return new Response(JSON.stringify({ error: 'Prompt is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Create streaming response
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    // Helper to send SSE events
    const sendEvent = async (event: string, data: unknown) => {
      await writer.write(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
    };

    // Start agent in background
    (async () => {
      try {
        const onUpdate = async (update: AgentUpdate) => {
          await sendEvent(update.type, update);
        };

        let response;

        if (mode === 'autonomous') {
          const agent = new AutonomousAgent({
            workspaceId,
            model,
            maxIterations: 50, // More iterations for autonomous mode
          });

          // Wrap with streaming
          await sendEvent('start', { message: 'Autonomous agent started' });

          response = await agent.runAutonomous(prompt);
        } else {
          const agent = new StreamingCodingAgent({ workspaceId, model }, onUpdate);

          response = await agent.runWithStreaming(prompt);
        }

        await sendEvent('complete', response);

        // Log the agent run (table created by workspace schema)
        await (
          supabase as unknown as {
            from: (table: string) => {
              insert: (data: Record<string, unknown>) => Promise<unknown>;
            };
          }
        )
          .from('tool_executions')
          .insert({
            workspace_id: workspaceId,
            user_id: user.id,
            tool_name: 'ai_agent',
            parameters: { prompt, mode, model },
            result: response,
            success: true,
          });
      } catch (error) {
        await sendEvent('error', {
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      } finally {
        await writer.close();
      }
    })();

    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    log.error('Agent error', error as Error);
    return new Response(
      JSON.stringify({
        error: 'Agent execution failed',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * GET - Get agent execution history
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: workspaceId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(request.url);
    // SECURITY: Validate limit parameter
    const limit = validateQueryLimit(url.searchParams.get('limit'), { default: 20, max: 100 });

    const { data: executions, error } = await supabase
      .from('tool_executions')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('tool_name', 'ai_agent')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return new Response(JSON.stringify({ executions }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    log.error('Failed to get agent history', error as Error);
    return new Response(JSON.stringify({ error: 'Failed to get agent history' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
