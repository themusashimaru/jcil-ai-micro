/**
 * TEXT-TO-SPEECH API - OpenAI TTS-1-HD
 *
 * PURPOSE:
 * - Convert text to high-quality speech audio
 * - Support multiple voices for varied output
 *
 * PUBLIC ROUTES:
 * - POST /api/speech
 *
 * DEPENDENCIES/ENVS:
 * - OPENAI_API_KEY (required)
 *
 * MODEL: tts-1-hd
 * ENDPOINT: https://api.openai.com/v1/audio/speech
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

// Available voices for TTS-1-HD
type TTSVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';

// Available output formats
type TTSFormat = 'mp3' | 'opus' | 'aac' | 'flac' | 'wav' | 'pcm';

interface SpeechRequest {
  text: string;
  voice?: TTSVoice;
  format?: TTSFormat;
  speed?: number; // 0.25 to 4.0
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY not configured' },
        { status: 500 }
      );
    }

    const body: SpeechRequest = await request.json();
    const {
      text,
      voice = 'alloy',
      format = 'mp3',
      speed = 1.0,
    } = body;

    // Validate input
    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Text is required and must be a string' },
        { status: 400 }
      );
    }

    if (text.length > 4096) {
      return NextResponse.json(
        { error: 'Text exceeds maximum length of 4096 characters' },
        { status: 400 }
      );
    }

    // Validate voice
    const validVoices: TTSVoice[] = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];
    if (!validVoices.includes(voice)) {
      return NextResponse.json(
        { error: `Invalid voice. Must be one of: ${validVoices.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate format
    const validFormats: TTSFormat[] = ['mp3', 'opus', 'aac', 'flac', 'wav', 'pcm'];
    if (!validFormats.includes(format)) {
      return NextResponse.json(
        { error: `Invalid format. Must be one of: ${validFormats.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate speed
    if (speed < 0.25 || speed > 4.0) {
      return NextResponse.json(
        { error: 'Speed must be between 0.25 and 4.0' },
        { status: 400 }
      );
    }

    // Call OpenAI TTS API
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'tts-1-hd',
        input: text,
        voice,
        response_format: format,
        speed,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Speech API] TTS error:', error);
      return NextResponse.json(
        { error: 'Text-to-speech conversion failed', details: error },
        { status: response.status }
      );
    }

    // Get the audio data
    const arrayBuffer = await response.arrayBuffer();

    // Determine content type based on format
    const contentTypes: Record<TTSFormat, string> = {
      mp3: 'audio/mpeg',
      opus: 'audio/opus',
      aac: 'audio/aac',
      flac: 'audio/flac',
      wav: 'audio/wav',
      pcm: 'audio/pcm',
    };

    // Return audio response
    return new Response(arrayBuffer, {
      headers: {
        'Content-Type': contentTypes[format],
        'Content-Length': String(arrayBuffer.byteLength),
        'X-TTS-Model': 'tts-1-hd',
        'X-TTS-Voice': voice,
      },
    });

  } catch (error) {
    console.error('[Speech API] Error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
