// src/app/api/chat/route.ts
// 👉 lightweight chat endpoint for the frontend
// - accepts JSON *and* multipart/form-data
// - does NOT require Supabase auth
// - does NOT require conversationId
// - still uses Gemini 2.5 Flash
// - returns JSON (easy for UI)

import { NextRequest, NextResponse } from "next/server";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText } from "ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// allowed image types if we ever want to pass them on
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
    let imageUrl: string | null = null;
    let imageMime: string | null = null;

    // 1) multipart (text + file from the browser)
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const msg = formData.get("message");
      if (typeof msg === "string") {
        userMessage = msg;
      }

      const file = formData.get("file");
      if (file && typeof file !== "string") {
        // NOTE: your old route expected a *URL* to an image in Supabase.
        // Here we only validate the file and mention it in the AI prompt.
        if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
          return NextResponse.json(
            {
              ok: false,
              error: "Unsupported image type.",
            },
            { status: 400 }
          );
        }

        // we won't upload here — just tell the model an image was sent
        imageUrl = "uploaded-file";
        imageMime = file.type;
      }
    } else {
      // 2) JSON (text-only or your older FE format)
      const body = await req.json().catch(() => ({} as any));

      // allow both { message: "hi" } and { messages: [...] }
      if (typeof body.message === "string") {
        userMessage = body.message;
      } else if (Array.isArray(body.messages) && body.messages.length > 0) {
        const last = body.messages[body.messages.length - 1];
        if (typeof last?.content === "string") {
          userMessage = last.content;
        } else if (Array.isArray(last?.content)) {
          const textPart = last.content.find((p: any) => p?.type === "text");
          if (textPart?.text) userMessage = textPart.text;
        }
      }

      // support old style: { fileUrl, fileMimeType }
      if (body.fileUrl && body.fileMimeType) {
        imageUrl = body.fileUrl;
        imageMime = body.fileMimeType;
      }
    }

    if (!userMessage && !imageUrl) {
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

    // build a simple prompt
    const systemPrompt =
      "You are a helpful AI assistant. Be concise, clear, and avoid extra formatting.";

    // if image present, just tell the model (we could do real multimodal if needed)
    const userText = imageUrl
      ? `${userMessage}\n\n(User also sent an image: ${imageMime ?? "image"})`
      : userMessage;

    const result = await streamText({
      model: google("gemini-2.5-flash"),
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: userText,
        },
      ],
    });

    // unlike your old route, we return JSON so the FE can parse it easily
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
