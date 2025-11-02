// src/app/api/chat/route.ts
// simple, multimodal-aware chat endpoint

import { NextRequest, NextResponse } from "next/server";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText } from "ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// if you later want to block weird files
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
];

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";

    let userMessage = "";
    // we'll store "what kind of image we got" in here
    // either { kind: "file", file: File }  OR  { kind: "url", url: string, mime?: string }
    let imageInput:
      | { kind: "file"; file: File }
      | { kind: "url"; url: string; mime?: string }
      | null = null;

    // ─────────────────────────────────────────
    // 1) multipart (browser sends real file)
    // ─────────────────────────────────────────
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();

      const msg = formData.get("message");
      if (typeof msg === "string") {
        userMessage = msg.trim();
      }

      const file = formData.get("file");
      if (file && typeof file !== "string") {
        // this is a real File/Blob
        if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
          return NextResponse.json(
            { ok: false, error: "Unsupported image type." },
            { status: 400 }
          );
        }

        imageInput = { kind: "file", file };
      }
    } else {
      // ─────────────────────────────────────────
      // 2) JSON (your current app flow)
      //     { message, fileUrl, fileMimeType }
      // ─────────────────────────────────────────
      const body = (await req.json().catch(() => ({}))) as any;

      if (typeof body.message === "string") {
        userMessage = body.message.trim();
      }

      // this is what your big chat page sends after uploading to Supabase
      if (body.fileUrl && typeof body.fileUrl === "string") {
        imageInput = {
          kind: "url",
          url: body.fileUrl,
          mime: typeof body.fileMimeType === "string" ? body.fileMimeType : undefined,
        };
      }
    }

    // safety: don't send empty text
    if (!userMessage) {
      userMessage = "Please analyze the image I sent.";
    }

    // ─────────────────────────────────────────
    // 3) init Gemini
    // ─────────────────────────────────────────
    const GEMINI_API_KEY =
      process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      process.env.NEXT_PUBLIC_GOOGLE_GENERATIVE_AI_API_KEY;

    if (!GEMINI_API_KEY) {
      console.error("Missing Gemini key on server");
      return NextResponse.json(
        { ok: false, error: "Gemini API key not configured." },
        { status: 500 }
      );
    }

    const google = createGoogleGenerativeAI({ apiKey: GEMINI_API_KEY });

    // ─────────────────────────────────────────
    // 4) build messages for AI
    //    if we have an image → send real multimodal
    // ─────────────────────────────────────────
    const systemPrompt =
      "You are a helpful AI assistant. If an image is provided, use it. Be concise.";

    let aiMessages: any[] = [];

    if (imageInput) {
      // CASE A: we got a real FILE (multipart)
      if (imageInput.kind === "file") {
        aiMessages = [
          {
            role: "user",
            content: [
              { type: "text", text: userMessage },
              // Vercel AI SDK (google) can accept a File/Blob here
              { type: "image", image: imageInput.file },
            ],
          },
        ];
      } else {
        // CASE B: we got a Supabase signed URL → pass as URL
        aiMessages = [
          {
            role: "user",
            content: [
              { type: "text", text: userMessage },
              { type: "image", image: new URL(imageInput.url) },
            ],
          },
        ];
      }
    } else {
      // text only
      aiMessages = [
        {
          role: "user",
          content: userMessage,
        },
      ];
    }

    // ─────────────────────────────────────────
    // 5) call Gemini
    // ─────────────────────────────────────────
    const result = await streamText({
      model: google("gemini-2.5-flash"),
      system: systemPrompt,
      messages: aiMessages,
    });

    const text = await result.text;

    return NextResponse.json(
      {
        ok: true,
        reply: text,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("[/api/chat] error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: "Sorry, there has been an error.",
        detail: err?.message ?? null,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { ok: true, route: "/api/chat", mode: "simple+multimodal" },
    { status: 200 }
  );
}
