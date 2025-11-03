// src/app/api/chat/route.ts
import { NextRequest, NextResponse } from "next/server";

// Expect the xAI API key in Vercel/Env as XAI_API_KEY
const XAI_API_KEY = process.env.XAI_API_KEY;
if (!XAI_API_KEY) console.error("Missing XAI_API_KEY on server.");

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

    // ---- Handle multipart (text + optional image) ----
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

    // ---- Convert image (if any) ----
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
        image_url: { url: `data:${imageMime};base64,${imageBase64}` },
      });
    }

    // ---- Construct xAI (Grok) request ----
    const payload = {
      model: "grok-4-fast-reasoning",
      messages: [
        {
          role: "system",
          content:
            "You are Grok 4 Fast Reasoning, a helpful and accurate assistant. When an image is provided, analyze it carefully and explain or extract relevant information clearly. Keep your answers concise and structured.",
        },
        {
          role: "user",
          content,
        },
      ],
      temperature: 0.3,
      max_output_tokens: 1200, // xAI uses 'max_output_tokens'
      stream: false,
    };

    // ---- Send to xAI API ----
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${XAI_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("xAI API error:", errText);
      return NextResponse.json(
        { ok: false, error: "xAI API error", detail: errText },
        { status: response.status }
      );
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "";

    return NextResponse.json({ ok: true, reply }, { status: 200 });
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
    route: "/api/chat (xAI Grok 4 Fast Reasoning)",
  });
}
