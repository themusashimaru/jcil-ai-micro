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
  console.log('[Whisper API] Received transcription request');

  try {
    // Auth check
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.log('[Whisper API] Unauthorized request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Whisper API] User authenticated:', user.id);

    // Get the form data with audio file
    const formData = await request.formData();
    const audioFile = formData.get('file') as File;
    const language = formData.get('language') as string | null;
    const prompt = formData.get('prompt') as string | null;

    console.log('[Whisper API] Received file:', {
      name: audioFile?.name,
      type: audioFile?.type,
      size: audioFile?.size,
    });

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    // Check file size (max 25MB for Whisper)
    const MAX_SIZE = 25 * 1024 * 1024;
    if (audioFile.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Audio file too large (max 25MB)' }, { status: 400 });
    }

    // Call OpenAI Whisper API
    console.log('[Whisper API] Calling OpenAI Whisper...');
    const openai = getOpenAI();
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: language || 'en',
      prompt: prompt || undefined,
      response_format: 'json',
    });

    console.log('[Whisper API] Transcription result:', transcription.text);

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
