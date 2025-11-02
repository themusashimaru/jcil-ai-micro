// src/app/api/chat/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: Request) {
  try {
    // Clone request to safely read twice
    const clonedReq = req.clone();

    let message = "";
    let fileUrl: string | null = null;
    let fileMimeType: string | null = null;

    // Try JSON first
    try {
      const body = await req.json();
      message = body?.message || "";
      fileUrl = body?.fileUrl || null;
      fileMimeType = body?.fileMimeType || null;
    } catch {
      // Fallback for text/plain
      const text = await clonedReq.text();
      message = text.trim();
    }

    if (!message && !fileUrl) {
      return NextResponse.json(
        { ok: false, error: "Message or file required." },
        { status: 400 }
      );
    }

    // 🔹 Trim overly long inputs to avoid token overflow
    if (message.length > 4000) {
      message = message.slice(0, 4000) + " ...[truncated]";
    }

    // 🔹 Build multimodal chat message
    const messages: any[] = [
      {
        role: "user",
        content: [{ type: "text", text: message }],
      },
    ];

    if (fileUrl && fileMimeType?.startsWith("image/")) {
      messages[0].content.push({
        type: "image_url",
        image_url: { url: fileUrl },
      });
    }

    // 🔹 Send to OpenAI safely
    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages,
      temperature: 0.6,
      max_tokens: 500, // prevents massive output
    });

    const reply =
      response.choices?.[0]?.message?.content ||
      "I'm here — how can I assist you today?";

    return NextResponse.json({ ok: true, reply }, { status: 200 });
  } catch (error: any) {
    console.error("Error in /api/chat:", error);
    return NextResponse.json(
      {
        ok: false,
        error:
          error.message ||
          "An unexpected error occurred while processing your request.",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "/api/chat",
    model: "gpt-4o",
    status: "ready",
  });
}
