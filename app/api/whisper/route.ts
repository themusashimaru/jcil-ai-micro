/**
 * WHISPER TRANSCRIPTION API
 *
 * Transcribes audio to text using OpenAI's Whisper API.
 * Used by the voice input feature in chat and Code Lab.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import OpenAI from 'openai';

// Lazy initialization to avoid build errors
let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the form data with audio file
    const formData = await request.formData();
    const audioFile = formData.get('file') as File;
    const language = formData.get('language') as string | null;
    const prompt = formData.get('prompt') as string | null;

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    // Check file size (max 25MB for Whisper)
    const MAX_SIZE = 25 * 1024 * 1024;
    if (audioFile.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Audio file too large (max 25MB)' }, { status: 400 });
    }

    // Call OpenAI Whisper API
    const openai = getOpenAI();
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: language || 'en',
      prompt: prompt || undefined,
      response_format: 'json',
    });

    return NextResponse.json({
      text: transcription.text,
    });

  } catch (error) {
    console.error('[Whisper API] Error:', error);

    if (error instanceof OpenAI.APIError) {
      return NextResponse.json(
        { error: `OpenAI error: ${error.message}` },
        { status: error.status || 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to transcribe audio' },
      { status: 500 }
    );
  }
}
