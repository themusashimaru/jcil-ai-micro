// src/app/api/chat/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let message = "";
    let file: File | null = null;

    // Handle both multipart (file uploads) and JSON
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      message = (formData.get("message") as string) || "";
      const maybeFile = formData.get("file");
      if (maybeFile && typeof maybeFile !== "string") file = maybeFile;
    } else {
      const body = await req.json().catch(() => ({}));
      message = body.message || "";
    }

    if (!message && !file) {
      return NextResponse.json(
        { ok: false, error: "Message or image required." },
        { status: 400 }
      );
    }

    // Limit overly long text
    if (message.length > 4000) {
      message = message.slice(0, 4000) + " ...[truncated]";
    }

    // Convert image to base64 if provided
    let imageBase64: string | undefined;
    let mimeType: string | undefined;
    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer());
      imageBase64 = buffer.toString("base64");
      mimeType = file.type;
    }

    // Construct multimodal message for GPT-4o
    const content: any[] = [];
    if (message) content.push({ type: "text", text: message });
    if (imageBase64 && mimeType) {
      content.push({
        type: "image_url",
        image_url: { url: `data:${mimeType};base64,${imageBase64}` },
      });
    }

    const response = await client.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.3,
      max_tokens: 500,
      messages: [
        {
          role: "system",
          content:
            "You are an assistant that interprets screenshots, logs, or code. Always respond in plain English with an explanation of what’s happening and what the user should do next.",
        },
        { role: "user", content },
      ],
    });

    const reply =
      response.choices?.[0]?.message?.content ||
      "I'm here — how can I assist you today?";

    return NextResponse.json({ ok: true, reply }, { status: 200 });
  } catch (error: any) {
    console.error("Error in /api/chat:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "/api/chat",
    model: "gpt-4o",
    status: "ready for image + text interpretation",
  });
}
