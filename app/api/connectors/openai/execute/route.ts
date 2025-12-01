/**
 * OPENAI ACTION EXECUTION API
 * Execute OpenAI API actions using user's own API key
 * POST: Execute a specific OpenAI action
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server-auth';
import { getUserConnection } from '@/lib/connectors/helpers';

export const runtime = 'nodejs';

const OPENAI_API = 'https://api.openai.com/v1';

interface ExecuteRequest {
  action: string;
  params: Record<string, unknown>;
}

// Helper for OpenAI API requests
async function openaiRequest(
  apiKey: string,
  endpoint: string,
  body: Record<string, unknown>
): Promise<Response> {
  return fetch(`${OPENAI_API}${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const connection = await getUserConnection(user.id, 'openai');
    if (!connection) {
      return NextResponse.json({ error: 'OpenAI not connected' }, { status: 400 });
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
          model = 'gpt-4o-mini',
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

        const response = await openaiRequest(apiKey, '/chat/completions', {
          model,
          messages,
          max_tokens: maxTokens,
          temperature,
        });

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json(
            { error: error.error?.message || 'OpenAI API error' },
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

      case 'generate_image': {
        const {
          prompt,
          model = 'dall-e-3',
          size = '1024x1024',
          quality = 'standard',
          n = 1,
        } = params as {
          prompt: string;
          model?: string;
          size?: string;
          quality?: string;
          n?: number;
        };

        if (!prompt) {
          return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
        }

        const response = await openaiRequest(apiKey, '/images/generations', {
          model,
          prompt,
          size,
          quality,
          n,
        });

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json(
            { error: error.error?.message || 'Image generation failed' },
            { status: response.status }
          );
        }

        const data = await response.json();
        result = {
          images: data.data?.map((img: { url: string; revised_prompt?: string }) => ({
            url: img.url,
            revisedPrompt: img.revised_prompt,
          })),
        };
        break;
      }

      case 'transcribe': {
        // Note: This action requires audio file handling which is complex
        // For now, return info about the capability
        result = {
          message: 'Audio transcription requires file upload. Use the Whisper API directly for audio files.',
          endpoint: '/v1/audio/transcriptions',
          supportedFormats: ['mp3', 'mp4', 'mpeg', 'mpga', 'm4a', 'wav', 'webm'],
        };
        break;
      }

      case 'list_models': {
        const response = await fetch(`${OPENAI_API}/models`, {
          headers: { Authorization: `Bearer ${apiKey}` },
        });

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json(
            { error: error.error?.message || 'Failed to list models' },
            { status: response.status }
          );
        }

        const data = await response.json();
        const models = data.data || [];

        // Filter to show most useful models
        const relevantModels = models
          .filter((m: { id: string }) =>
            m.id.includes('gpt') ||
            m.id.includes('dall-e') ||
            m.id.includes('whisper') ||
            m.id.includes('tts')
          )
          .map((m: { id: string; created: number }) => ({
            id: m.id,
            created: new Date(m.created * 1000).toISOString(),
          }))
          .sort((a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id));

        result = {
          models: relevantModels,
          count: relevantModels.length,
        };
        break;
      }

      case 'embeddings': {
        const { input, model = 'text-embedding-3-small' } = params as {
          input: string | string[];
          model?: string;
        };

        if (!input) {
          return NextResponse.json({ error: 'input is required' }, { status: 400 });
        }

        const response = await openaiRequest(apiKey, '/embeddings', {
          model,
          input,
        });

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json(
            { error: error.error?.message || 'Embeddings failed' },
            { status: response.status }
          );
        }

        const data = await response.json();
        result = {
          embeddings: data.data?.map((e: { embedding: number[]; index: number }) => ({
            index: e.index,
            dimensions: e.embedding?.length,
            // Don't return full embeddings as they're large - just metadata
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
    console.error('[OpenAI Execute API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
