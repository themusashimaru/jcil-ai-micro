/**
 * MISTRAL ACTION EXECUTION API
 * Execute Mistral AI API actions
 * POST: Execute a specific Mistral action
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server-auth';
import { getUserConnection } from '@/lib/connectors/helpers';

export const runtime = 'nodejs';

const MISTRAL_API = 'https://api.mistral.ai/v1';

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

    const connection = await getUserConnection(user.id, 'mistral');
    if (!connection) {
      return NextResponse.json({ error: 'Mistral not connected' }, { status: 400 });
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
      case 'complete': {
        const {
          prompt,
          model = 'mistral-large-latest',
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

        const messages: Array<{ role: string; content: string }> = [];
        if (systemPrompt) {
          messages.push({ role: 'system', content: systemPrompt });
        }
        messages.push({ role: 'user', content: prompt });

        const response = await fetch(`${MISTRAL_API}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages,
            max_tokens: maxTokens,
            temperature,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json(
            { error: error.message || 'Mistral API error' },
            { status: response.status }
          );
        }

        const data = await response.json();
        result = {
          response: data.choices?.[0]?.message?.content,
          model: data.model,
          usage: {
            promptTokens: data.usage?.prompt_tokens,
            completionTokens: data.usage?.completion_tokens,
            totalTokens: data.usage?.total_tokens,
          },
        };
        break;
      }

      case 'list_models': {
        const response = await fetch(`${MISTRAL_API}/models`, {
          headers: { Authorization: `Bearer ${apiKey}` },
        });

        if (!response.ok) {
          result = {
            models: [
              { id: 'mistral-large-latest', name: 'Mistral Large', description: 'Flagship model' },
              { id: 'mistral-medium-latest', name: 'Mistral Medium', description: 'Balanced' },
              { id: 'mistral-small-latest', name: 'Mistral Small', description: 'Fast and efficient' },
              { id: 'codestral-latest', name: 'Codestral', description: 'Optimized for code' },
              { id: 'open-mistral-nemo', name: 'Mistral Nemo', description: 'Open model' },
            ],
            count: 5,
          };
          break;
        }

        const data = await response.json();
        result = {
          models: data.data?.map((m: { id: string; created: number; owned_by: string }) => ({
            id: m.id,
            created: m.created ? new Date(m.created * 1000).toISOString() : null,
            ownedBy: m.owned_by,
          })) || [],
          count: data.data?.length || 0,
        };
        break;
      }

      case 'embeddings': {
        const { input, model = 'mistral-embed' } = params as {
          input: string | string[];
          model?: string;
        };

        if (!input) {
          return NextResponse.json({ error: 'input is required' }, { status: 400 });
        }

        const response = await fetch(`${MISTRAL_API}/embeddings`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            input: Array.isArray(input) ? input : [input],
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json(
            { error: error.message || 'Embeddings failed' },
            { status: response.status }
          );
        }

        const data = await response.json();
        result = {
          embeddings: data.data?.map((e: { index: number; embedding: number[] }) => ({
            index: e.index,
            dimensions: e.embedding?.length,
          })),
          model: data.model,
          usage: data.usage,
        };
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('[Mistral Execute API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
