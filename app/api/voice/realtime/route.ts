/**
 * REALTIME VOICE API - OpenAI GPT-4o Realtime (GA)
 *
 * PURPOSE:
 * - Bridge WebSocket connections to OpenAI's realtime voice API
 * - Enable real-time conversational AI with voice input/output
 *
 * PUBLIC ROUTES:
 * - GET /api/voice/realtime - WebSocket upgrade endpoint
 * - POST /api/voice/realtime - Get ephemeral client secret
 *
 * DEPENDENCIES/ENVS:
 * - OPENAI_API_KEY (required)
 *
 * MODEL: gpt-4o-realtime-preview
 * ENDPOINT: wss://api.openai.com/v1/realtime
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

// OpenAI Realtime API endpoint
const OPENAI_REALTIME_URL = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview';

/**
 * GET handler - Returns connection info for realtime voice
 * The actual WebSocket connection should be initiated client-side
 * with the provided session configuration
 */
export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY not configured' },
        { status: 500 }
      );
    }

    // Check for upgrade header (WebSocket request)
    const upgradeHeader = request.headers.get('upgrade');

    if (upgradeHeader !== 'websocket') {
      // Return connection configuration for client-side WebSocket
      return NextResponse.json({
        endpoint: OPENAI_REALTIME_URL,
        model: 'gpt-4o-realtime-preview',
        instructions: 'Client should establish WebSocket connection directly to OpenAI with proper authentication',
        config: {
          voice: 'alloy',
          input_audio_format: 'pcm16',
          output_audio_format: 'pcm16',
          sample_rate: 24000,
        },
      });
    }

    // For WebSocket upgrade requests, return info about the setup
    // Note: In a production environment, you would use a WebSocket server
    // or a service like Vercel's Edge Functions with WebSocket support
    return NextResponse.json({
      error: 'Direct WebSocket connections not supported in this endpoint',
      message: 'Use client-side WebSocket connection to OpenAI Realtime API',
      hint: 'Create WebSocket on client with proper OpenAI API key authentication',
    }, { status: 400 });

  } catch (error) {
    console.error('[Voice Realtime API] Error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST handler - Create a realtime client secret (ephemeral token)
 * Returns a temporary token for client-side WebSocket connection
 * Uses the GA endpoint: /v1/realtime/client_secrets
 */
export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY not configured' },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { voice = 'alloy' } = body;

    // Use the GA model: gpt-realtime (released Dec 2024)
    const gaModel = 'gpt-realtime';

    console.log('[Voice Realtime API] Creating client secret for GA model:', gaModel);

    // Use /v1/realtime/client_secrets for GA API (not /v1/realtime/sessions which is beta)
    const response = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: gaModel,
        voice,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Voice Realtime API] Client secret creation error:', response.status, errorText);

      return NextResponse.json(
        {
          error: 'Failed to create client secret',
          details: errorText,
          status: response.status,
          model: gaModel,
        },
        { status: response.status }
      );
    }

    const clientSecret = await response.json();
    console.log('[Voice Realtime API] Client secret created successfully:', clientSecret.id);

    // Response format for client_secrets endpoint:
    // { id, object: "realtime.client_secret", value: "ek_...", expires_at: timestamp }
    return NextResponse.json({
      success: true,
      session: {
        id: clientSecret.id,
        token: clientSecret.value,
        expires_at: clientSecret.expires_at,
        model: gaModel,
        voice,
      },
      endpoint: `wss://api.openai.com/v1/realtime?model=${gaModel}`,
    });

  } catch (error) {
    console.error('[Voice Realtime API] Error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
