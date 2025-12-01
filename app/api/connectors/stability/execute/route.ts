/**
 * STABILITY AI ACTION EXECUTION API
 * Execute Stability AI API actions for image generation
 * POST: Execute a specific Stability action
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server-auth';
import { getUserConnection } from '@/lib/connectors/helpers';

export const runtime = 'nodejs';

const STABILITY_API = 'https://api.stability.ai/v1';

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

    const connection = await getUserConnection(user.id, 'stability');
    if (!connection) {
      return NextResponse.json({ error: 'Stability AI not connected' }, { status: 400 });
    }

    const body: ExecuteRequest = await request.json();
    const { action, params } = body;

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    const apiKey = connection.token;
    let result: unknown;

    switch (action) {
      case 'generate_image':
      case 'text_to_image': {
        const {
          prompt,
          negativePrompt,
          width = 1024,
          height = 1024,
          samples = 1,
          steps = 30,
          cfgScale = 7,
          engine = 'stable-diffusion-xl-1024-v1-0',
        } = params as {
          prompt: string;
          negativePrompt?: string;
          width?: number;
          height?: number;
          samples?: number;
          steps?: number;
          cfgScale?: number;
          engine?: string;
        };

        if (!prompt) {
          return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
        }

        const textPrompts = [{ text: prompt, weight: 1 }];
        if (negativePrompt) {
          textPrompts.push({ text: negativePrompt, weight: -1 });
        }

        const response = await fetch(`${STABILITY_API}/generation/${engine}/text-to-image`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            text_prompts: textPrompts,
            width,
            height,
            samples,
            steps,
            cfg_scale: cfgScale,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json(
            { error: error.message || 'Image generation failed' },
            { status: response.status }
          );
        }

        const data = await response.json();
        result = {
          images: data.artifacts?.map((img: { base64: string; seed: number; finishReason: string }, index: number) => ({
            index,
            base64: img.base64,
            seed: img.seed,
            finishReason: img.finishReason,
          })) || [],
          count: data.artifacts?.length || 0,
        };
        break;
      }

      case 'list_engines': {
        const response = await fetch(`${STABILITY_API}/engines/list`, {
          headers: { Authorization: `Bearer ${apiKey}` },
        });

        if (!response.ok) {
          result = {
            engines: [
              { id: 'stable-diffusion-xl-1024-v1-0', name: 'SDXL 1.0', description: 'Latest Stable Diffusion XL' },
              { id: 'stable-diffusion-v1-6', name: 'SD 1.6', description: 'Stable Diffusion 1.6' },
              { id: 'stable-diffusion-xl-beta-v2-2-2', name: 'SDXL Beta', description: 'SDXL Beta version' },
            ],
            count: 3,
          };
          break;
        }

        const data = await response.json();
        result = {
          engines: data.map((e: { id: string; name: string; description: string; type: string }) => ({
            id: e.id,
            name: e.name,
            description: e.description,
            type: e.type,
          })),
          count: data.length,
        };
        break;
      }

      case 'get_balance': {
        const response = await fetch(`${STABILITY_API}/user/balance`, {
          headers: { Authorization: `Bearer ${apiKey}` },
        });

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json(
            { error: error.message || 'Failed to get balance' },
            { status: response.status }
          );
        }

        const data = await response.json();
        result = {
          credits: data.credits,
        };
        break;
      }

      case 'upscale': {
        // Note: Upscaling requires image input which is complex
        result = {
          message: 'Image upscaling requires file upload. Provide an image file to upscale.',
          supportedEngines: ['esrgan-v1-x2plus', 'stable-diffusion-x4-latent-upscaler'],
        };
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('[Stability Execute API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
