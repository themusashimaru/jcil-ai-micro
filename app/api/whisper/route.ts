/**
 * WHISPER TRANSCRIPTION API - OpenAI Whisper-1
 *
 * PURPOSE:
 * - Convert audio files to text using OpenAI Whisper
 * - Support multiple audio formats
 *
 * PUBLIC ROUTES:
 * - POST /api/whisper
 *
 * DEPENDENCIES/ENVS:
 * - OPENAI_API_KEY (required)
 *
 * MODEL: whisper-1
 * ENDPOINT: https://api.openai.com/v1/audio/transcriptions
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY not configured' },
        { status: 500 }
      );
    }

    // Get form data from request
    const formData = await request.formData();
    const audio = formData.get('file') as File | null;

    // Support both 'file' and 'audio' field names for compatibility
    const audioFile = audio || formData.get('audio') as File | null;

    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided. Use "file" or "audio" field.' },
        { status: 400 }
      );
    }

    // Optional parameters
    const language = formData.get('language') as string | null;
    const prompt = formData.get('prompt') as string | null;
    const responseFormat = formData.get('response_format') as string | null;
    const temperature = formData.get('temperature') as string | null;

    // Create form data for OpenAI Whisper API
    const whisperFormData = new FormData();
    whisperFormData.append('file', audioFile);
    whisperFormData.append('model', 'whisper-1');

    // Add optional parameters
    if (language) {
      whisperFormData.append('language', language);
    }
    if (prompt) {
      whisperFormData.append('prompt', prompt);
    }
    if (responseFormat) {
      whisperFormData.append('response_format', responseFormat);
    }
    if (temperature) {
      whisperFormData.append('temperature', temperature);
    }

    // Call OpenAI Whisper API
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: whisperFormData,
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Whisper API] Transcription error:', error);
      return NextResponse.json(
        { error: 'Transcription failed', details: error },
        { status: response.status }
      );
    }

    const result = await response.json();

    return NextResponse.json({
      text: result.text,
      model: 'whisper-1',
      ...(result.language && { language: result.language }),
      ...(result.duration && { duration: result.duration }),
      ...(result.segments && { segments: result.segments }),
    });

  } catch (error) {
    console.error('[Whisper API] Error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
