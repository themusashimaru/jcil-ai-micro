/**
 * Computer Use API — Runs an Anthropic Computer Use agentic loop on an E2B desktop.
 *
 * POST: Start a computer use task (returns SSE stream of progress)
 *
 * The AI sees the desktop, decides actions, executes them, and reports results.
 * Uses Anthropic's native computer_20250124 tool type for optimal interaction.
 */

import { NextRequest } from 'next/server';
import { requireUser } from '@/lib/auth/user-guard';
import { logger } from '@/lib/logger';

const log = logger('ComputerUseAPI');

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.authorized) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json();
  const { task, sessionId } = body as { task: string; sessionId?: string };

  if (!task || typeof task !== 'string' || task.trim().length === 0) {
    return new Response(JSON.stringify({ error: 'Task description is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (task.length > 2000) {
    return new Response(JSON.stringify({ error: 'Task description too long (max 2000 chars)' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  log.info('Starting computer use task', {
    task: task.slice(0, 100),
    userId: auth.user.id,
    sessionId,
  });

  // Stream progress via SSE
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        // Check E2B availability
        send('status', { message: 'Initializing desktop sandbox...' });

        const { isDesktopSandboxAvailable } = await import('@/lib/ai/tools/desktop-sandbox-tool');
        const available = await isDesktopSandboxAvailable();

        if (!available) {
          send('error', {
            message:
              'Desktop sandbox not available. Ensure E2B_API_KEY is set and @e2b/desktop is installed.',
          });
          controller.close();
          return;
        }

        // Get or create E2B desktop sandbox
        send('status', { message: 'Starting desktop environment...' });

        const desktopModule = await import('@e2b/desktop');
        const sandbox = await desktopModule.Sandbox.create({
          timeoutMs: 600000, // 10 min
          resolution: [1920, 1080],
          dpi: 96,
        });

        send('status', { message: 'Desktop ready. Starting AI agent...' });

        // Create adapter and run the agent
        const { runComputerUseAgent, createE2BDesktopController } = await import(
          '@/lib/ai/computer-use/agent'
        );
        const desktop = createE2BDesktopController(sandbox);

        const result = await runComputerUseAgent(task, desktop, (step, stepNum) => {
          send('step', {
            stepNumber: stepNum + 1,
            action: step.action,
            coordinates: step.coordinates,
            text: step.text,
            reasoning: step.reasoning,
            hasScreenshot: !!step.screenshot,
            // Send screenshot for most recent step only (to reduce bandwidth)
            screenshot: step.screenshot,
          });
        });

        // Send final result
        send('result', {
          success: result.success,
          totalSteps: result.steps.length,
          summary: result.summary,
          finalScreenshot: result.finalScreenshot,
          error: result.error,
        });

        // Clean up sandbox
        try {
          await sandbox.kill();
        } catch {
          // Best effort cleanup
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Computer use task failed';
        log.error('Computer use task failed', { error: errorMsg, userId: auth.user.id });
        send('error', { message: errorMsg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
