/**
 * WHISPER TRANSCRIPTION API
 *
 * Transcribes audio to text using OpenAI's Whisper API.
 * Used by the voice input feature in chat and Code Lab.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import OpenAI from 'openai';

const log = logger('whisper');

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
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

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

    // Call OpenAI Whisper API with verbose_json to get no_speech_prob
    const openai = getOpenAI();
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: language || 'en',
      prompt: prompt || undefined,
      response_format: 'verbose_json',
    });

    // Check if Whisper detected mostly silence
    // If any segment has high no_speech_prob, the transcription is likely a hallucination
    const segments = transcription.segments || [];
    const avgNoSpeechProb =
      segments.length > 0
        ? segments.reduce((sum, seg) => sum + (seg.no_speech_prob || 0), 0) / segments.length
        : 0;

    // If average no_speech_prob > 0.5, Whisper thinks it's mostly silence
    if (avgNoSpeechProb > 0.5) {
      log.debug('Filtered likely hallucination', { avgNoSpeechProb });
      return NextResponse.json({
        text: '',
        filtered: true,
        reason: 'no_speech_detected',
      });
    }

    return NextResponse.json({
      text: transcription.text,
      no_speech_prob: avgNoSpeechProb,
    });
  } catch (error) {
    log.error('Transcription failed', {
      error: error instanceof Error ? error.message : 'Unknown',
    });

    if (error instanceof OpenAI.APIError) {
      return NextResponse.json(
        { error: 'Transcription service error' },
        { status: error.status || 500 }
      );
    }

    return NextResponse.json({ error: 'Failed to transcribe audio' }, { status: 500 });
  }
}
