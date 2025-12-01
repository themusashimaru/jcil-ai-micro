/**
 * ANTHROPIC ACTION EXECUTION API
 * Execute Anthropic Claude API actions using user's own API key
 * POST: Execute a specific Anthropic action
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server-auth';
import { getUserConnection } from '@/lib/connectors/helpers';

export const runtime = 'nodejs';

const ANTHROPIC_API = 'https://api.anthropic.com/v1';

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

    const connection = await getUserConnection(user.id, 'anthropic');
    if (!connection) {
      return NextResponse.json({ error: 'Anthropic not connected' }, { status: 400 });
    }

    const body: ExecuteRequest = await request.json();
    const { action, params } = body;

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    const apiKey = connection.token;
    let result: unknown;

    switch (action) {
      case 'chat':
      case 'complete':
      case 'message': {
        const {
          prompt,
          model = 'claude-sonnet-4-20250514',
          maxTokens = 1000,
          temperature = 0.7,
          systemPrompt,
        } = params as {
          prompt: string;
          model?: string;
          maxTokens?: number;
          temperature?: number;
          systemPrompt?: string;
        };

        if (!prompt) {
          return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
        }

        const requestBody: Record<string, unknown> = {
          model,
          max_tokens: maxTokens,
          temperature,
          messages: [{ role: 'user', content: prompt }],
        };

        if (systemPrompt) {
          requestBody.system = systemPrompt;
        }

        const response = await fetch(`${ANTHROPIC_API}/messages`, {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json(
            { error: error.error?.message || 'Anthropic API error' },
            { status: response.status }
          );
        }

        const data = await response.json();
        result = {
          response: data.content?.[0]?.text,
          model: data.model,
          stopReason: data.stop_reason,
          usage: {
            inputTokens: data.usage?.input_tokens,
            outputTokens: data.usage?.output_tokens,
          },
        };
        break;
      }

      case 'list_models': {
        // Anthropic doesn't have a models endpoint, so we return known models
        result = {
          models: [
            { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', description: 'Best for most tasks' },
            { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', description: 'Most capable model' },
            { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: 'Previous generation balanced' },
            { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', description: 'Fast and efficient' },
            { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', description: 'Previous flagship' },
          ],
          count: 5,
        };
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('[Anthropic Execute API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
