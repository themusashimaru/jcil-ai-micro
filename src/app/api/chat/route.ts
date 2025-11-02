// src/app/api/chat2/route.ts
// minimal public chat endpoint (no Supabase auth)

import { NextRequest, NextResponse } from "next/server";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText, type CoreMessage } from "ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY!,
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const messages = (body?.messages || []) as CoreMessage[];

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "messages array required" }, { status: 400 });
    }

    const result = await streamText({
      model: google("gemini-2.5-flash"),
      system: "You are JCIL.AI. Be short, friendly, and helpful.",
      messages,
    });

    return new Response(result.textStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  } catch (err: any) {
    console.error("chat2 error:", err);
    return NextResponse.json(
      { error: err?.message || "internal error" },
      { status: 500 }
    );
  }
}

// so we can test /api/chat2 in the browser
export async function GET() {
  return NextResponse.json({ ok: true, route: "/api/chat2" });
}
