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

interface OpenAIMessage {
  role: "user" | "assistant" | "system";
  content?: string;
  name?: string;
  // if image input support: content can be array of text + image link or base64?
}

// Helper to call OpenAI Chat Completions with image / text
async function callOpenAIWithImage({
  messages,
  model = "gpt-4o", // adjust if your model name differs
}: {
  messages: OpenAIMessage[];
  model?: string;
}): Promise<string> {
  const url = "https://api.openai.com/v1/chat/completions";
  const body: any = {
    model,
    messages,
  };

  // The API may support `files` or `image` property if base64 or url: you'll need to adjust based on docs.
  // If your model supports sending image URLs in message.content, you can embed the URL inline.

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
  const reply = data.choices?.[0]?.message?.content;
  return reply || "";
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";

    let userMessage = "";
    let imageUrl: string | null = null;
    let imageMime: string | null = null;
    let imageFile: File | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const msg = formData.get("message");
      if (typeof msg === "string") {
        userMessage = msg.trim();
      }

      const file = formData.get("file");
      if (file && typeof file !== "string") {
        if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
          return NextResponse.json({ ok: false, error: "Unsupported image type." }, { status: 400 });
        }
        imageFile = file;
        imageMime = file.type;
      }
    } else {
      // JSON body
      const body = await req.json().catch(() => ({} as any));
      if (typeof body.message === "string") {
        userMessage = body.message.trim();
      }
      if (body.fileUrl && typeof body.fileUrl === "string" && typeof body.fileMimeType === "string") {
        imageUrl = body.fileUrl;
        imageMime = body.fileMimeType;
      }
    }

    if (!userMessage && !imageFile && !imageUrl) {
      return NextResponse.json({ ok: false, error: "No message provided." }, { status: 400 });
    }

    // Build messages for OpenAI
    const systemPrompt = `
You are a technical assistant. If the user sends an image (screenshot of code, terminal, logs, etc.), you should interpret it, extract text, and explain the issues clearly.
If only text is sent, answer using your best knowledge.
`;
    const messages: OpenAIMessage[] = [
      { role: "system", content: systemPrompt },
    ];

    let userContent = userMessage;
    if (imageFile) {
      // if your OpenAI model allows base64 or file upload, you'd embed it. Otherwise upload to URL and refer.
      // Simplifying: we'll ask user to refer to imageFile name.
      userContent += `\n\nUser uploaded an image (type: ${imageMime}). Please interpret it.`;
    } else if (imageUrl) {
      userContent += `\n\nUser uploaded an image URL: ${imageUrl}. Please interpret it.`;
    }

    messages.push({ role: "user", content: userContent });

    // Call OpenAI
    const reply = await callOpenAIWithImage({ messages, model: "gpt-4o" });

    return NextResponse.json({ ok: true, reply }, { status: 200 });
  } catch (err: any) {
    console.error("[/api/chat] error:", err);
    return NextResponse.json({ ok: false, error: "Internal error occurred.", detail: err.message });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, route: "/api/chat (OpenAI)", version: "gpt-4o" }, { status: 200 });
}
