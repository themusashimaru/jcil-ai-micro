/**
 * Code Lab Desktop API — Proxies desktop sandbox actions for the Live Desktop panel.
 *
 * Actions: start, screenshot, open_url, run_command, click, type_text, press_key, scroll
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/user-guard';
import { logger } from '@/lib/logger';

const log = logger('CodeLabDesktopAPI');

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.authorized) return auth.response;

  const body = await request.json();
  const { action, sessionId, url, command, x, y, text, key, direction } = body as {
    action: string;
    sessionId?: string;
    url?: string;
    command?: string;
    x?: number;
    y?: number;
    text?: string;
    key?: string;
    direction?: 'up' | 'down';
  };

  if (!action) {
    return NextResponse.json({ error: 'Missing action parameter' }, { status: 400 });
  }

  log.info('Desktop action', { action, sessionId, userId: auth.user.id });

  try {
    // Dynamically import the desktop sandbox tool to avoid bundling E2B in all routes
    const { executeDesktopSandbox, isDesktopSandboxAvailable } = await import(
      '@/lib/ai/tools/desktop-sandbox-tool'
    );

    const available = await isDesktopSandboxAvailable();
    if (!available) {
      return NextResponse.json(
        {
          error:
            'Desktop sandbox is not available. Ensure E2B_API_KEY is configured and @e2b/desktop is installed.',
        },
        { status: 503 }
      );
    }

    // Map panel actions to tool call format (UnifiedToolCall interface)
    const toolCall = {
      id: `desktop-${Date.now()}`,
      name: 'desktop_sandbox' as const,
      arguments: buildToolInput(action, { url, command, x, y, text, key, direction }),
      sessionId: sessionId || `desktop_${auth.user.id}`,
    };

    const result = await executeDesktopSandbox(toolCall);

    if (result.isError) {
      return NextResponse.json({ error: result.content }, { status: 500 });
    }

    // Parse the result to extract screenshot and output
    const parsed = parseDesktopResult(result.content);
    return NextResponse.json(parsed);
  } catch (err) {
    log.error('Desktop action failed', err as Error);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Desktop action failed' },
      { status: 500 }
    );
  }
}

function buildToolInput(
  action: string,
  params: {
    url?: string;
    command?: string;
    x?: number;
    y?: number;
    text?: string;
    key?: string;
    direction?: 'up' | 'down';
  }
): Record<string, unknown> {
  switch (action) {
    case 'start':
      return { action: 'screenshot' }; // Starting = take initial screenshot
    case 'screenshot':
      return { action: 'screenshot' };
    case 'open_url':
      return { action: 'open_url', url: params.url || '' };
    case 'run_command':
      return { action: 'run_command', text: params.command || '' };
    case 'click':
      return { action: 'click', x: params.x || 0, y: params.y || 0 };
    case 'type_text':
      return { action: 'type_text', text: params.text || '' };
    case 'press_key':
      return { action: 'press_key', key: params.key || '' };
    case 'scroll':
      return { action: 'scroll', direction: params.direction || 'down' };
    default:
      return { action };
  }
}

function parseDesktopResult(content: string): {
  screenshot?: string;
  output?: string;
  error?: string;
} {
  // The desktop tool returns base64 screenshots in its output
  const screenshotMatch = content.match(/\[Screenshot captured: ([\d]+x[\d]+)\]/);
  const base64Match = content.match(/data:image\/png;base64,([A-Za-z0-9+/=]+)/);
  const outputMatch = content.match(/Output:\s*(.+)/s);

  return {
    screenshot: base64Match?.[1] || undefined,
    output: outputMatch?.[1]?.trim() || (screenshotMatch ? 'Screenshot captured' : content),
  };
}
