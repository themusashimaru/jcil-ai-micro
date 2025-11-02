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

// ---- Core OpenAI call ----
async function callOpenAI({
  message,
  imageBase64,
  imageMime,
}: {
  message: string;
  imageBase64?: string;
  imageMime?: string;
}): Promise<string> {
  const url = "https://api.openai.com/v1/chat/completions";

  const userContent: any[] = [{ type: "text", text: message }];
  if (imageBase64 && imageMime) {
    userContent.push({
      type: "image_url",
      image_url: { url: `data:${imageMime};base64,${imageBase64}` },
    });
  }

  const body = {
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content:
          "You are a technical assistant that can read and interpret screenshots, code, logs, or terminal outputs. Provide clear explanations of what’s visible in the image.",
      },
      {
        role: "user",
        content: userContent,
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
    console.error("OpenAI API error:", err);
    throw new Error(err);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "No reply.";
}

// ---- Route handlers ----
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

    // Convert image to base64 if attached
    let imageBase64: string | undefined;
    let imageMime: string | undefined;
    if (imageFile) {
      const buffer = Buffer.from(await imageFile.arrayBuffer());
      imageBase64 = buffer.toString("base64");
      imageMime = imageFile.type;
    }

    const reply = await callOpenAI({ message, imageBase64, imageMime });

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
  return NextResponse.json(
    { ok: true, route: "/api/chat (GPT-4o multimodal)" },
    { status: 200 }
  );
}
