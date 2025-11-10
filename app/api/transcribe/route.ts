/**
 * TRANSCRIBE API ROUTE - Whisper Speech-to-Text
 *
 * PURPOSE:
 * - Convert audio recordings to text using OpenAI Whisper
 * - Support microphone input from chat composer
 *
 * PUBLIC ROUTES:
 * - POST /api/transcribe
 *
 * DEPENDENCIES/ENVS:
 * - OPENAI_API_KEY (required for Whisper)
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

    // Check for OpenAI API key
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY not configured' },
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
      console.error('Whisper API error:', error);
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
    console.error('Transcription error:', error);
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
