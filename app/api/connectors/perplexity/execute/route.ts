/**
 * PERPLEXITY ACTION EXECUTION API
 * Execute Perplexity AI API actions (AI + Search)
 * POST: Execute a specific Perplexity action
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server-auth';
import { getUserConnection } from '@/lib/connectors/helpers';

export const runtime = 'nodejs';

const PERPLEXITY_API = 'https://api.perplexity.ai';

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

    const connection = await getUserConnection(user.id, 'perplexity');
    if (!connection) {
      return NextResponse.json({ error: 'Perplexity not connected' }, { status: 400 });
    }

    const body: ExecuteRequest = await request.json();
    const { action, params } = body;

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    const apiKey = connection.token;
    let result: unknown;

    switch (action) {
      case 'search':
      case 'chat':
      case 'complete': {
        const {
          prompt,
          model = 'sonar',
          maxTokens = 1000,
          temperature = 0.2,
          systemPrompt,
          returnCitations = true,
          returnImages = false,
        } = params as {
          prompt: string;
          model?: string;
          maxTokens?: number;
          temperature?: number;
          systemPrompt?: string;
          returnCitations?: boolean;
          returnImages?: boolean;
        };

        if (!prompt) {
          return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
        }

        const messages: Array<{ role: string; content: string }> = [];
        if (systemPrompt) {
          messages.push({ role: 'system', content: systemPrompt });
        }
        messages.push({ role: 'user', content: prompt });

        const response = await fetch(`${PERPLEXITY_API}/chat/completions`, {
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
            return_citations: returnCitations,
            return_images: returnImages,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json(
            { error: error.error?.message || 'Perplexity API error' },
            { status: response.status }
          );
        }

        const data = await response.json();
        result = {
          response: data.choices?.[0]?.message?.content,
          model: data.model,
          citations: data.citations || [],
          images: data.images || [],
          usage: {
            promptTokens: data.usage?.prompt_tokens,
            completionTokens: data.usage?.completion_tokens,
            totalTokens: data.usage?.total_tokens,
          },
        };
        break;
      }

      case 'list_models': {
        // Perplexity doesn't have a models endpoint
        result = {
          models: [
            { id: 'sonar', name: 'Sonar', description: 'Default search-augmented model' },
            { id: 'sonar-pro', name: 'Sonar Pro', description: 'Advanced search model' },
            { id: 'sonar-reasoning', name: 'Sonar Reasoning', description: 'Complex reasoning' },
          ],
          count: 3,
        };
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('[Perplexity Execute API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
