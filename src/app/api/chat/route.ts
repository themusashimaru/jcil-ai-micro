// src/app/api/chat/route.ts
import { NextRequest, NextResponse } from "next/server";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) console.error("Missing OPENAI_API_KEY on server");

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
    let message = "";
    let imageFile: File | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const msg = formData.get("message");
      if (typeof msg === "string") message = msg.trim();

      const file = formData.get("file");
      if (file && typeof file !== "string") {
        if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
          return NextResponse.json(
            { ok: false, error: "Unsupported image type." },
            { status: 400 }
          );
        }
        imageFile = file;
      }
    } else {
      const body = await req.json().catch(() => ({} as any));
      if (typeof body.message === "string") message = body.message.trim();
    }

    if (!message && !imageFile) {
      return NextResponse.json(
        { ok: false, error: "Message or image required." },
        { status: 400 }
      );
    }

    // ---- Convert image to base64 ----
    let imageBase64: string | undefined;
    let imageMime: string | undefined;
    if (imageFile) {
      const buffer = Buffer.from(await imageFile.arrayBuffer());
      imageBase64 = buffer.toString("base64");
      imageMime = imageFile.type;
    }

    // ---- Build multimodal content ----
    const content: any[] = [];
    if (message) content.push({ type: "text", text: message });
    if (imageBase64 && imageMime) {
      content.push({
        type: "image_url",
        image_url: {
          url: `data:${imageMime};base64,${imageBase64}`,
        },
      });
    }

    // ---- Send to GPT-4o ----
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content:
              "You are an assistant that can interpret screenshots, code, logs, and text. Extract any visible text (OCR) and then provide a detailed explanation of what’s happening.",
          },
          { role: "user", content },
        ],
        response_format: { type: "json_object" }, // ensures clean JSON output
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("OpenAI error:", err);
      return NextResponse.json({ ok: false, error: err }, { status: 500 });
    }

    const data = await response.json();

    // ---- Parse model output ----
    let replyText = "";
    let rawText = "";

    try {
      const parsed = JSON.parse(data.choices?.[0]?.message?.content || "{}");
      replyText = parsed.reply || parsed.explanation || "";
      rawText = parsed.raw_text || "";
    } catch {
      replyText = data.choices?.[0]?.message?.content || "No reply received.";
    }

    return NextResponse.json(
      {
        ok: true,
        reply: replyText,
        raw_text: rawText || "(no OCR text extracted)",
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("Error in /api/chat:", err);
    return NextResponse.json(
      { ok: false, error: err.message || "Internal error." },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "/api/chat (GPT-4o multimodal + OCR)",
  });
}
