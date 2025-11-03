// src/app/api/transcribe/route.ts
import { NextRequest, NextResponse } from "next/server";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export async function POST(req: NextRequest) {
  try {
    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing OPENAI_API_KEY. Add it in Vercel to use the mic / transcription.",
        },
        { status: 500 }
      );
    }

    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { ok: false, error: "Expected multipart/form-data with a file field." },
        { status: 400 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json(
        { ok: false, error: "Audio file is required." },
        { status: 400 }
      );
    }

    // convert to blob/buffer for OpenAI
    const fileArrayBuffer = await file.arrayBuffer();
    const fileBlob = new Blob([fileArrayBuffer], { type: file.type || "audio/webm" });

    // now build form-data for OpenAI
    const openaiForm = new FormData();
    openaiForm.append("file", fileBlob, "audio.webm");
    openaiForm.append("model", "whisper-1");
    // optional: openaiForm.append("language", "en");

    const openaiRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: openaiForm,
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      console.error("OpenAI whisper error:", errText);
      return NextResponse.json(
        { ok: false, error: "OpenAI transcription failed.", details: errText },
        { status: 500 }
      );
    }

    const data = (await openaiRes.json()) as { text?: string };
    const text = data.text || "";

    // IMPORTANT: your frontend expects { text: "..." }
    return NextResponse.json({ ok: true, text }, { status: 200 });
  } catch (err: any) {
    console.error("❌ /api/transcribe error:", err);
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
    needs: "OPENAI_API_KEY",
  });
}
