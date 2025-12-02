/**
 * REALTIME VOICE API - OpenAI GPT-4o Realtime Preview
 *
 * PURPOSE:
 * - Bridge WebSocket connections to OpenAI's realtime voice API
 * - Enable real-time conversational AI with voice input/output
 *
 * PUBLIC ROUTES:
 * - GET /api/voice/realtime - WebSocket upgrade endpoint
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
 * POST handler - Create a realtime session token
 * Returns a temporary session token for client-side WebSocket connection
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

    // Create a realtime session via OpenAI API
    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-realtime-preview',
        voice,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Voice Realtime API] Session creation error:', error);
      return NextResponse.json(
        { error: 'Failed to create realtime session', details: error },
        { status: response.status }
      );
    }

    const session = await response.json();

    return NextResponse.json({
      success: true,
      session: {
        id: session.id,
        token: session.client_secret?.value,
        expires_at: session.client_secret?.expires_at,
        model: 'gpt-4o-realtime-preview',
        voice,
      },
      endpoint: OPENAI_REALTIME_URL,
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
