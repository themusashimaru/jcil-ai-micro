/**
 * TRANSCRIBE API ROUTE - Whisper Speech-to-Text
 *
 * PURPOSE:
 * - Convert audio recordings to text using OpenAI Whisper
 * - Support microphone input from chat composer
 * - Filter out hallucinations when no speech is detected
 *
 * PUBLIC ROUTES:
 * - POST /api/transcribe
 *
 * DEPENDENCIES/ENVS:
 * - OPENAI_API_KEY (required for Whisper)
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * Check if transcription appears to be a Whisper hallucination
 * Whisper often produces these when given silence or noise
 */
function isLikelyHallucination(text: string): boolean {
  if (!text || !text.trim()) return true;

  const trimmed = text.trim().toLowerCase();

  // Common Whisper hallucination phrases when there's silence/noise
  const hallucinationPhrases = [
    'thank you',
    'thanks for watching',
    'thanks for listening',
    'please subscribe',
    'see you next time',
    'bye',
    'goodbye',
    'you',
    'okay',
    'ok',
    'um',
    'uh',
    'hmm',
    '...',
    'the end',
    'music',
    'applause',
    'silence',
    'inaudible',
    '[music]',
    '[applause]',
    '♪',
  ];

  // Check for exact hallucination matches
  for (const phrase of hallucinationPhrases) {
    if (trimmed === phrase || trimmed === phrase + '.') {
      return true;
    }
  }

  // Check for very short nonsensical output (1-2 chars that aren't numbers)
  if (trimmed.length <= 2 && !/^\d+$/.test(trimmed)) {
    return true;
  }

  // Check for only punctuation or special characters
  if (/^[.,!?;:\-…\s]+$/.test(trimmed)) {
    return true;
  }

  return false;
}

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

    // Check audio file size - very small files likely have no speech
    // A 0.5 second webm file is typically at least 5KB
    const MIN_AUDIO_SIZE = 3000; // 3KB minimum
    if (audio.size < MIN_AUDIO_SIZE) {
      console.log('[Transcribe] Audio too short, likely no speech:', audio.size, 'bytes');
      return NextResponse.json({ text: '' });
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
    // Add language hint to improve accuracy and reduce hallucinations
    whisperFormData.append('language', 'en');
    // Add prompt to help Whisper understand context
    whisperFormData.append('prompt', 'User speaking to an AI assistant.');

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
    const transcribedText = result.text || '';

    // Check for hallucination and return empty if detected
    if (isLikelyHallucination(transcribedText)) {
      console.log('[Transcribe] Filtered hallucination:', transcribedText);
      return NextResponse.json({ text: '' });
    }

    return NextResponse.json({
      text: transcribedText,
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
