// src/app/api/chat/route.ts
// ✅ simple, public-ish chat endpoint
// - accepts JSON OR multipart/form-data
// - returns { ok: true, reply: "..." }

import { NextRequest, NextResponse } from "next/server";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText } from "ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    let imageInfo: string | null = null;

    if (contentType.includes("multipart/form-data")) {
      // browser sent text + file
      const formData = await req.formData();
      const msg = formData.get("message");
      if (typeof msg === "string") {
        userMessage = msg;
      }

      const file = formData.get("file");
      if (file && typeof file !== "string") {
        if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
          return NextResponse.json(
            { ok: false, error: "Unsupported image type." },
            { status: 400 }
          );
        }
        // we’re not actually using the raw file with Gemini here
        imageInfo = `User also sent an image (${file.type})`;
      }
    } else {
      // JSON body
      const body = await req.json().catch(() => ({} as any));
      if (typeof body.message === "string") {
        userMessage = body.message;
      }

      // support legacy shape
      if (body.fileUrl && body.fileMimeType) {
        imageInfo = `User also sent an image URL (${body.fileMimeType})`;
      }
    }

    if (!userMessage && !imageInfo) {
      return NextResponse.json(
        { ok: false, error: "No message provided." },
        { status: 400 }
      );
    }

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

    const finalUserText = imageInfo
      ? `${userMessage}\n\n${imageInfo}`
      : userMessage;

    const result = await streamText({
      model: google("gemini-2.5-flash"),
      system:
        "You are a helpful AI assistant. Be concise, clear, and avoid extra formatting.",
      messages: [
        {
          role: "user",
          content: finalUserText,
        },
      ],
    });

    const fullText = await result.text;

    return NextResponse.json(
      {
        ok: true,
        reply: fullText,
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
    { ok: true, route: "/api/chat", mode: "simple" },
    { status: 200 }
  );
}
