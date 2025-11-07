// src/app/api/transcribe/route.ts
import { NextRequest, NextResponse } from "next/server";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export async function POST(req: NextRequest) {
  try {
    console.log('🎤 [Server] Transcription request received');

    if (!OPENAI_API_KEY) {
      console.error('🎤 [Server] Missing OPENAI_API_KEY');
      return NextResponse.json(
        {
          ok: false,
          error: "Transcription service unavailable. Please contact support.",
        },
        { status: 500 }
      );
    }

    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      console.error('🎤 [Server] Invalid content type:', contentType);
      return NextResponse.json(
        { ok: false, error: "Expected multipart/form-data with a file field." },
        { status: 400 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      console.error('🎤 [Server] No file in form data');
      return NextResponse.json(
        { ok: false, error: "Audio file is required." },
        { status: 400 }
      );
    }

    // convert to blob/buffer for OpenAI
    const fileArrayBuffer = await file.arrayBuffer();
    const fileType = file.type || "audio/webm";
    const fileBlob = new Blob([fileArrayBuffer], { type: fileType });

    console.log('🎤 [Server] Received audio file:');
    console.log('  - Size:', fileBlob.size, 'bytes');
    console.log('  - Type:', fileBlob.type);
    console.log('  - Original type:', file.type);

    if (fileBlob.size === 0) {
      console.error('🎤 [Server] Empty audio file received');
      return NextResponse.json(
        { ok: false, error: "Empty audio file received." },
        { status: 400 }
      );
    }

    // Determine correct file extension based on mime type (critical for mobile!)
    let filename = "audio.webm";
    if (fileType.includes("mp4") || fileType.includes("m4a")) {
      filename = "audio.m4a";
    } else if (fileType.includes("ogg")) {
      filename = "audio.ogg";
    } else if (fileType.includes("wav")) {
      filename = "audio.wav";
    }

    console.log('🎤 [Server] Using filename:', filename);

    // now build form-data for OpenAI
    const openaiForm = new FormData();
    openaiForm.append("file", fileBlob, filename);
    openaiForm.append("model", "whisper-1");
    openaiForm.append("language", "en"); // Force English for better accuracy
    openaiForm.append("temperature", "0"); // Maximum accuracy setting
    openaiForm.append("prompt", "The user is speaking clearly in English. Transcribe exactly what they say."); // Help guide transcription

    console.log('🎤 [Server] Sending to transcription service...');

    const openaiRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: openaiForm,
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      console.error("🎤 [Server] Transcription service error:", errText);
      return NextResponse.json(
        { ok: false, error: "Transcription failed. Please try again.", details: errText },
        { status: 500 }
      );
    }

    const data = (await openaiRes.json()) as { text?: string };
    const text = data.text || "";

    console.log('🎤 [Server] Transcription successful:');
    console.log('  - Text:', text);
    console.log('  - Length:', text.length, 'characters');

    // IMPORTANT: your frontend expects { text: "..." }
    return NextResponse.json({ ok: true, text }, { status: 200 });
  } catch (err: any) {
    console.error("❌ [Server] /api/transcribe error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Internal error." },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "/api/transcribe",
    status: "Transcription service ready",
  });
}
