// src/app/api/transcribe/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs'; // Necessary for processing file uploads

export async function POST(req: NextRequest) {
  // 1. Get the audio file from the FormData
  const formData = await req.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'No audio file provided.' }, { status: 400 });
  }

  // 2. Create new FormData to send to OpenAI
  // We can't forward the original FormData directly
  const openAIFormData = new FormData();
  openAIFormData.append('file', file);
  openAIFormData.append('model', 'whisper-1');
  // You can add language support here if needed, e.g.:
  // openAIFormData.append('language', 'en'); 
  // But Whisper's auto-detection is excellent.

  // 3. Call the OpenAI Whisper API
  try {
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        // 'Content-Type' is set automatically by fetch() when using FormData
      },
      body: openAIFormData,
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Whisper API Error:', data.error);
      return NextResponse.json({ error: data.error?.message || 'Whisper API error' }, { status: response.status });
    }

    // 4. Return the transcribed text
    return NextResponse.json({ text: data.text });

  } catch (error) {
    let errorMessage = 'Internal server error.';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    console.error('Error transcribing audio:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}