/**
 * VOICE SPEAK API - OpenAI Text-to-Speech for Voice Chat
 *
 * PURPOSE:
 * - Convert AI response text to audio using OpenAI TTS
 * - Returns audio stream for playback
 * - Uses dedicated API key for voice chat feature
 *
 * ENV:
 * - GPT_API_KEY_RETURN_VOICE (required)
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, voice = 'alloy' } = body;

    if (!text) {
      return NextResponse.json(
        { error: 'No text provided' },
        { status: 400 }
      );
    }

    // Check for text-to-voice API key
    const apiKey = process.env.GPT_API_KEY_RETURN_VOICE;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GPT_API_KEY_RETURN_VOICE not configured' },
        { status: 500 }
      );
    }

    // Truncate text if too long (TTS has a 4096 character limit)
    const truncatedText = text.length > 4000 ? text.substring(0, 4000) + '...' : text;

    // Call OpenAI TTS API
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: truncatedText,
        voice: voice, // alloy, echo, fable, onyx, nova, shimmer
        response_format: 'mp3',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Voice] TTS API error:', error);
      return NextResponse.json(
        { error: 'Text-to-speech failed', details: error },
        { status: response.status }
      );
    }

    // Return audio as stream
    const audioBuffer = await response.arrayBuffer();

    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error('[Voice] TTS error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export const runtime = 'edge';
