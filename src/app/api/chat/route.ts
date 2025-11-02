// src/app/api/chat2/route.ts
// minimal public chat endpoint (now with optional image support)

import { NextRequest, NextResponse } from "next/server";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText, type CoreMessage } from "ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY!,
});

// allow only image types we actually handle
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const messages = (body?.messages || []) as CoreMessage[];
    const fileUrl = body?.fileUrl as string | null;
    const fileMimeType = body?.fileMimeType as string | null;

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "messages array required" },
        { status: 400 }
      );
    }

    // we’ll mutate a copy
    const messagesForAI: CoreMessage[] = [...messages];
    const lastIndex = messagesForAI.length - 1;

    // if user sent an image too, make last message multimodal
    if (fileUrl && fileMimeType) {
      // very light validation – this endpoint is public, so we don’t overdo it
      if (ALLOWED_IMAGE_TYPES.includes(fileMimeType.toLowerCase())) {
        // get the text part (Gemini still needs text even with an image)
        let userText = "";
        const lastMsg = messagesForAI[lastIndex];

        if (typeof lastMsg.content === "string") {
          userText = lastMsg.content;
        } else if (Array.isArray(lastMsg.content)) {
          const textPart = lastMsg.content.find((p: any) => p.type === "text");
          userText = textPart?.text || "";
        }

        // rebuild as multimodal
        messagesForAI[lastIndex] = {
          ...lastMsg,
          content: [
            { type: "text", text: userText || "Describe this image." },
            // IMPORTANT: pass string URL
            { type: "image", image: fileUrl },
          ],
        } as any;
      }
    }

    const result = await streamText({
      model: google("gemini-2.5-flash"),
      system: "You are JCIL.AI. Be short, friendly, and helpful.",
      messages: messagesForAI,
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
