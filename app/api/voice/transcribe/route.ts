/**
 * VOICE TRANSCRIBE API - Whisper Speech-to-Text for Voice Chat
 *
 * PURPOSE:
 * - Convert audio from voice chat mode to text using OpenAI Whisper
 * - Uses dedicated API key for voice chat feature
 *
 * ENV:
 * - GPT_API_KEY_VOICE2TEXT (required)
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audio = formData.get('audio') as File;

    if (!audio) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }

    // Check for voice-to-text API key
    const apiKey = process.env.GPT_API_KEY_VOICE2TEXT;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GPT_API_KEY_VOICE2TEXT not configured' },
        { status: 500 }
      );
    }

    // Create form data for OpenAI Whisper API
    const whisperFormData = new FormData();
    whisperFormData.append('file', audio);
    whisperFormData.append('model', 'whisper-1');

    // Call OpenAI Whisper API
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: whisperFormData,
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Voice] Whisper API error:', error);
      return NextResponse.json(
        { error: 'Transcription failed', details: error },
        { status: response.status }
      );
    }

    const result = await response.json();

    return NextResponse.json({
      text: result.text,
    });
  } catch (error) {
    console.error('[Voice] Transcription error:', error);
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
