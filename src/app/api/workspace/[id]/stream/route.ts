/**
 * WORKSPACE STREAMING API
 *
 * Real-time streaming for shell output, builds, and agent updates
 */

import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ContainerManager } from '@/lib/workspace/container';
import { validateCSRF } from '@/lib/security/csrf';
import { logger } from '@/lib/logger';

const log = logger('StreamAPI');

export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * POST - Execute command with streaming output
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // CSRF Protection
  const csrfCheck = validateCSRF(request);
  if (!csrfCheck.valid) return csrfCheck.response!;

  try {
    const { id: workspaceId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

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

    const body = await request.json();
    const { command, cwd, timeout = 300000 } = body;

    if (!command) {
      return new Response(JSON.stringify({ error: 'Command is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Create streaming response
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    // Start command execution in background
    (async () => {
      const container = new ContainerManager();
      const startTime = Date.now();

      try {
        await writer.write(encoder.encode(`event: start\ndata: ${JSON.stringify({ command, cwd })}\n\n`));

        const result = await container.executeCommand(workspaceId, command, {
          cwd: cwd || '/workspace',
          timeout,
          stream: {
            onStdout: async (data) => {
              await writer.write(encoder.encode(`event: stdout\ndata: ${JSON.stringify({ content: data })}\n\n`));
            },
            onStderr: async (data) => {
              await writer.write(encoder.encode(`event: stderr\ndata: ${JSON.stringify({ content: data })}\n\n`));
            },
            onExit: async (code) => {
              await writer.write(encoder.encode(`event: exit\ndata: ${JSON.stringify({ code, duration: Date.now() - startTime })}\n\n`));
            },
          },
        });

        // Final result
        await writer.write(encoder.encode(`event: complete\ndata: ${JSON.stringify({
          exitCode: result.exitCode,
          executionTime: result.executionTime,
        })}\n\n`));

        // Log the command (table created by workspace schema)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('shell_commands').insert({
          workspace_id: workspaceId,
          command,
          output: result.stdout + result.stderr,
          exit_code: result.exitCode,
          duration_ms: result.executionTime,
          completed_at: new Date().toISOString(),
        });

      } catch (error) {
        await writer.write(encoder.encode(`event: error\ndata: ${JSON.stringify({
          message: error instanceof Error ? error.message : 'Unknown error',
        })}\n\n`));
      } finally {
        await writer.close();
      }
    })();

    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    log.error('Streaming error', error as Error);
    return new Response(JSON.stringify({
      error: 'Streaming failed',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * GET - Subscribe to workspace events (file changes, task updates, etc.)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workspaceId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

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

    // Create streaming response for workspace events
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    // Keep connection alive and send periodic updates
    let isOpen = true;

    // MEMORY LEAK FIX: Use AbortController for cleanup
    const abortHandler = () => {
      isOpen = false;
    };

    // Handle client disconnect with proper cleanup
    request.signal.addEventListener('abort', abortHandler);

    const sendHeartbeat = async () => {
      while (isOpen) {
        try {
          await writer.write(encoder.encode(`event: heartbeat\ndata: ${JSON.stringify({ time: Date.now() })}\n\n`));

          // Check for new tasks
          const { data: tasks } = await supabase
            .from('background_tasks')
            .select('*')
            .eq('workspace_id', workspaceId)
            .in('status', ['pending', 'running'])
            .order('created_at', { ascending: false })
            .limit(5);

          if (tasks && tasks.length > 0) {
            await writer.write(encoder.encode(`event: tasks\ndata: ${JSON.stringify({ tasks })}\n\n`));
          }

          await new Promise(resolve => setTimeout(resolve, 5000)); // Every 5 seconds
        } catch {
          isOpen = false;
          break;
        }
      }

      // MEMORY LEAK FIX: Clean up event listener when done
      try {
        request.signal.removeEventListener('abort', abortHandler);
      } catch {
        // Signal may already be aborted, ignore
      }

      // Close the writer
      try {
        await writer.close();
      } catch {
        // Writer may already be closed, ignore
      }
    };

    // Start heartbeat (runs async, cleans up on completion)
    sendHeartbeat();

    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    log.error('Event stream error', error as Error);
    return new Response(JSON.stringify({ error: 'Event stream failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
