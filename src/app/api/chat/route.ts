// src/app/api/chat/route.ts
import { NextRequest, NextResponse } from "next/server";

const XAI_API_KEY = process.env.XAI_API_KEY;
if (!XAI_API_KEY) console.error("Missing XAI_API_KEY on server.");

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let message = "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const msg = formData.get("message");
      if (typeof msg === "string") message = msg.trim();
    } else {
      const body = await req.json().catch(() => ({} as any));
      if (typeof body.message === "string") message = body.message.trim();
    }

    if (!message) {
      return NextResponse.json(
        { ok: false, error: "Message required." },
        { status: 400 }
      );
    }

    const payload = {
      model: "grok-4",
      messages: [
        {
          role: "system",
          content:
            "You are Grok 4, a highly intelligent and helpful AI assistant. Respond clearly and accurately.",
        },
        {
          role: "user",
          content: message,
        },
      ],
      temperature: 0.3,
      stream: false,
      max_output_tokens: 1024,
    };

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
    route: "/api/chat (xAI Grok 4)",
  });
}
