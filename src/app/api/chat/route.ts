// src/app/api/chat/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: Request) {
  try {
    // Clone the request so we can safely read it twice if needed
    const clonedReq = req.clone();

    let message = "";
    let fileUrl: string | null = null;
    let fileMimeType: string | null = null;

    // Try to parse JSON first
    try {
      const body = await req.json();
      message = body?.message || "";
      fileUrl = body?.fileUrl || null;
      fileMimeType = body?.fileMimeType || null;
    } catch {
      // If JSON parsing fails, try reading plain text
      const text = await clonedReq.text();
      message = text.trim();
    }

    if (!message && !fileUrl) {
      return NextResponse.json(
        { ok: false, error: "Message or file required." },
        { status: 400 }
      );
    }

    // Build multimodal message for GPT-4o
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

    // Send to OpenAI
    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages,
      temperature: 0.6,
    });

    const reply =
      response.choices?.[0]?.message?.content ||
      "I'm here — how can I assist you today?";

    // Respond to frontend
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
    status: "ready",
  });
}
