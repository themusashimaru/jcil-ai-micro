// src/app/api/chat/route.ts
import { NextRequest, NextResponse } from "next/server";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.error("Missing OPENAI_API_KEY on server");
}

// Allowed image types
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
];

// Helper to call OpenAI API with image + text
async function callOpenAIWithImage({
  message,
  imageBase64,
  imageMime,
}: {
  message: string;
  imageBase64?: string;
  imageMime?: string;
}): Promise<string> {
  const url = "https://api.openai.com/v1/chat/completions";

  // Build content with text + image parts
  const content: any[] = [
    { type: "text", text: message },
  ];

  if (imageBase64 && imageMime) {
    content.push({
      type: "image_url",
      image_url: { url: `data:${imageMime};base64,${imageBase64}` },
    });
  }

  const body = {
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: "You are a technical assistant that can read and interpret images, screenshots, and text. If an image shows code, logs, or terminal output, read and explain what’s happening.",
      },
      {
        role: "user",
        content,
      },
    ],
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("OpenAI error:", err);
    throw new Error(`OpenAI API error: ${err}`);
  }

  const data = await res.json();
  const reply = data.choices?.[0]?.message?.content ?? "No reply received.";
  return reply;
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";

    let userMessage = "";
    let imageFile: File | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const msg = formData.get("message");
      if (typeof msg === "string") userMessage = msg.trim();

      const file = formData.get("file");
      if (file && typeof file !== "string") {
        if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
          return NextResponse.json({ ok: false, error: "Unsupported image type." }, { status: 400 });
        }
        imageFile = file;
      }
    } else {
      const body = await req.json().catch(() => ({} as any));
      if (typeof body.message === "string") userMessage = body.message.trim();
    }

    if (!userMessage && !imageFile) {
      return NextResponse.json({ ok: false, error: "No message provided." }, { status: 400 });
    }

    // Convert image to base64 if present
    let imageBase64: string | undefined;
    let imageMime: string | undefined;

    if (imageFile) {
      const arrayBuffer = await imageFile.arrayBuffer();
      imageBase64 = Buffer.from(arrayBuffer).toString("base64");
      imageMime = imageFile.type;
    }

    // Send to OpenAI
    const reply = await callOpenAIWithImage({
      message: userMessage,
      imageBase64,
      imageMime,
    });

    return NextResponse.json({ ok: true, reply }, { status: 200 });
  } catch (err: any) {
    console.error("[/api/chat] error:", err);
    return NextResponse.json({ ok: false, error: "Internal error occurred.", detail: err.message });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, route: "/api/chat (OpenAI GPT-4o base64)" }, { status: 200 });
}
