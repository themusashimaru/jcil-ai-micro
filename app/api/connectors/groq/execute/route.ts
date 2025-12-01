/**
 * GROQ ACTION EXECUTION API
 * Execute Groq API actions for ultra-fast inference
 * POST: Execute a specific Groq action
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server-auth';
import { getUserConnection } from '@/lib/connectors/helpers';

export const runtime = 'nodejs';

const GROQ_API = 'https://api.groq.com/openai/v1';

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

    const connection = await getUserConnection(user.id, 'groq');
    if (!connection) {
      return NextResponse.json({ error: 'Groq not connected' }, { status: 400 });
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
          model = 'llama-3.3-70b-versatile',
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

        const response = await fetch(`${GROQ_API}/chat/completions`, {
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
            { error: error.error?.message || 'Groq API error' },
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
            // Groq provides timing info
            totalTime: data.usage?.total_time,
          },
        };
        break;
      }

      case 'list_models': {
        const response = await fetch(`${GROQ_API}/models`, {
          headers: { Authorization: `Bearer ${apiKey}` },
        });

        if (!response.ok) {
          result = {
            models: [
              { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', description: 'Most capable' },
              { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', description: 'Fastest' },
              { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', description: 'MoE model' },
              { id: 'gemma2-9b-it', name: 'Gemma 2 9B', description: 'Google model' },
            ],
            count: 4,
          };
          break;
        }

        const data = await response.json();
        result = {
          models: data.data?.map((m: { id: string; owned_by: string; created: number }) => ({
            id: m.id,
            ownedBy: m.owned_by,
            created: m.created ? new Date(m.created * 1000).toISOString() : null,
          })) || [],
          count: data.data?.length || 0,
        };
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('[Groq Execute API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
