/**
 * ELEVENLABS ACTION EXECUTION API
 * Execute ElevenLabs API actions for text-to-speech
 * POST: Execute a specific ElevenLabs action
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server-auth';
import { getUserConnection } from '@/lib/connectors/helpers';

export const runtime = 'nodejs';

const ELEVENLABS_API = 'https://api.elevenlabs.io/v1';

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

    const connection = await getUserConnection(user.id, 'elevenlabs');
    if (!connection) {
      return NextResponse.json({ error: 'ElevenLabs not connected' }, { status: 400 });
    }

    const body: ExecuteRequest = await request.json();
    const { action, params } = body;

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    const apiKey = connection.token;
    let result: unknown;

    switch (action) {
      case 'list_voices': {
        const response = await fetch(`${ELEVENLABS_API}/voices`, {
          headers: { 'xi-api-key': apiKey },
        });

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json(
            { error: error.detail?.message || 'Failed to list voices' },
            { status: response.status }
          );
        }

        const data = await response.json();
        result = {
          voices: data.voices?.map((v: {
            voice_id: string;
            name: string;
            category: string;
            labels: Record<string, string>;
            preview_url: string;
          }) => ({
            id: v.voice_id,
            name: v.name,
            category: v.category,
            labels: v.labels,
            previewUrl: v.preview_url,
          })) || [],
          count: data.voices?.length || 0,
        };
        break;
      }

      case 'get_voice': {
        const { voiceId } = params as { voiceId: string };
        if (!voiceId) {
          return NextResponse.json({ error: 'voiceId is required' }, { status: 400 });
        }

        const response = await fetch(`${ELEVENLABS_API}/voices/${voiceId}`, {
          headers: { 'xi-api-key': apiKey },
        });

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json(
            { error: error.detail?.message || 'Failed to get voice' },
            { status: response.status }
          );
        }

        const v = await response.json();
        result = {
          id: v.voice_id,
          name: v.name,
          category: v.category,
          description: v.description,
          labels: v.labels,
          previewUrl: v.preview_url,
          settings: v.settings,
        };
        break;
      }

      case 'text_to_speech':
      case 'generate_speech': {
        const {
          text,
          voiceId = 'EXAVITQu4vr4xnSDxMaL', // Default: Sarah
          modelId = 'eleven_multilingual_v2',
          stability = 0.5,
          similarityBoost = 0.75,
        } = params as {
          text: string;
          voiceId?: string;
          modelId?: string;
          stability?: number;
          similarityBoost?: number;
        };

        if (!text) {
          return NextResponse.json({ error: 'text is required' }, { status: 400 });
        }

        if (text.length > 5000) {
          return NextResponse.json({ error: 'Text too long (max 5000 characters)' }, { status: 400 });
        }

        const response = await fetch(`${ELEVENLABS_API}/text-to-speech/${voiceId}`, {
          method: 'POST',
          headers: {
            'xi-api-key': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text,
            model_id: modelId,
            voice_settings: {
              stability,
              similarity_boost: similarityBoost,
            },
          }),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({ detail: { message: 'TTS failed' } }));
          return NextResponse.json(
            { error: error.detail?.message || 'Text-to-speech failed' },
            { status: response.status }
          );
        }

        // Audio is returned as binary - we'll return info about the response
        const audioBuffer = await response.arrayBuffer();
        const base64Audio = Buffer.from(audioBuffer).toString('base64');

        result = {
          audioBase64: base64Audio,
          contentType: response.headers.get('content-type') || 'audio/mpeg',
          characterCount: text.length,
          message: 'Audio generated successfully. Use the audioBase64 field to play or save.',
        };
        break;
      }

      case 'get_user': {
        const response = await fetch(`${ELEVENLABS_API}/user`, {
          headers: { 'xi-api-key': apiKey },
        });

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json(
            { error: error.detail?.message || 'Failed to get user info' },
            { status: response.status }
          );
        }

        const data = await response.json();
        result = {
          subscription: {
            tier: data.subscription?.tier,
            characterCount: data.subscription?.character_count,
            characterLimit: data.subscription?.character_limit,
            voiceLimit: data.subscription?.voice_limit,
          },
        };
        break;
      }

      case 'list_models': {
        const response = await fetch(`${ELEVENLABS_API}/models`, {
          headers: { 'xi-api-key': apiKey },
        });

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json(
            { error: error.detail?.message || 'Failed to list models' },
            { status: response.status }
          );
        }

        const data = await response.json();
        result = {
          models: data.map((m: {
            model_id: string;
            name: string;
            description: string;
            can_do_text_to_speech: boolean;
            can_do_voice_conversion: boolean;
            languages: Array<{ language_id: string; name: string }>;
          }) => ({
            id: m.model_id,
            name: m.name,
            description: m.description,
            canDoTTS: m.can_do_text_to_speech,
            canDoVoiceConversion: m.can_do_voice_conversion,
            languages: m.languages?.slice(0, 5).map(l => l.name),
          })),
          count: data.length,
        };
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('[ElevenLabs Execute API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
