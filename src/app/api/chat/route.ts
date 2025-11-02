// src/app/api/chat/route.ts
// clean version: auth + supabase + optional image + tools

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText, type CoreMessage } from "ai";
import { rateLimit } from "@/lib/rate-limit";
import { sanitizeInput, containsSuspiciousContent } from "@/lib/sanitize";
import { moderateUserMessage } from "@/lib/moderation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY!,
});

const regularChatPrompt = `You are a helpful and neutral AI assistant. Be clear, direct, and natural.`;
const textMessageToolPrompt = `You write only the final text message. No explanations.`;
const emailWriterPrompt = `You write only the final email, plain text.`;
const recipeExtractorPrompt = `You extract ingredients and return only the list.`;

const MAX_MESSAGE_LENGTH = 10_000;
const MAX_MESSAGES_IN_CONVERSATION = 100;

const VALID_TOOLS = [
  "none",
  "textMessageTool",
  "emailWriter",
  "recipeExtractor",
] as const;

type AllowedTool = (typeof VALID_TOOLS)[number];

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();

  // supabase server client
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set(name, value, options);
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: "", ...options });
        },
      },
    }
  );

  try {
    // 1. auth
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. rate limit
    const rl = rateLimit(user.id, {
      maxRequests: 20,
      windowMs: 60_000,
    });
    if (!rl.success) {
      const retryAfter = Math.ceil((rl.reset - Date.now()) / 1000);
      return NextResponse.json(
        {
          error: "Too many requests",
          retryAfter,
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": rl.limit.toString(),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": rl.reset.toString(),
            "Retry-After": retryAfter.toString(),
          },
        }
      );
    }

    // 3. parse body
    const {
      messages: rawMessages,
      conversationId,
      tool,
      fileUrl,
      fileMimeType,
    } = (await req.json()) as {
      messages: CoreMessage[];
      conversationId: string;
      tool?: AllowedTool | string;
      fileUrl?: string | null;
      fileMimeType?: string | null;
    };

    if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
      return NextResponse.json(
        { error: "messages array required" },
        { status: 400 }
      );
    }
    if (!conversationId) {
      return NextResponse.json(
        { error: "conversationId required" },
        { status: 400 }
      );
    }
    if (rawMessages.length > MAX_MESSAGES_IN_CONVERSATION) {
      return NextResponse.json(
        { error: "too many messages" },
        { status: 400 }
      );
    }

    // 4. verify conversation belongs to user
    const { data: convoRow, error: convoErr } = await supabase
      .from("conversations")
      .select("user_id")
      .eq("id", conversationId)
      .single();

    if (convoErr || !convoRow) {
      return NextResponse.json(
        { error: "conversation not found" },
        { status: 404 }
      );
    }
    if (convoRow.user_id !== user.id) {
      return NextResponse.json(
        { error: "forbidden: not your conversation" },
        { status: 403 }
      );
    }

    // 5. extract last user message text
    const lastMsg = rawMessages[rawMessages.length - 1] as any;
    let userText = "";

    if (typeof lastMsg?.content === "string") {
      userText = lastMsg.content;
    } else if (Array.isArray(lastMsg?.content)) {
      const textPart = lastMsg.content.find(
        (p: any) => p && p.type === "text" && typeof p.text === "string"
      );
      userText = textPart ? textPart.text : "";
    }

    if (!userText) {
      return NextResponse.json(
        { error: "last message must have text" },
        { status: 400 }
      );
    }

    if (userText.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        { error: "message too long" },
        { status: 400 }
      );
    }

    if (containsSuspiciousContent(userText)) {
      return NextResponse.json(
        { error: "message contains invalid content" },
        { status: 400 }
      );
    }

    const cleanText = sanitizeInput(userText);

    // 6. text moderation
    const mod = await moderateUserMessage(user.id, cleanText);
    if (!mod.allowed) {
      return NextResponse.json(
        {
          error: mod.reason,
          violationType: mod.violationType,
        },
        { status: 403 }
      );
    }

    // 7. save user message (fire and forget)
    void supabase.from("messages").insert({
      conversation_id: conversationId,
      user_id: user.id,
      role: "user",
      content: cleanText,
      file_url: fileUrl ?? null,
      file_type: fileMimeType ?? null,
    });

    // 8. pick system prompt
    let systemPrompt = regularChatPrompt;
    if (tool === "textMessageTool") systemPrompt = textMessageToolPrompt;
    else if (tool === "emailWriter") systemPrompt = emailWriterPrompt;
    else if (tool === "recipeExtractor") systemPrompt = recipeExtractorPrompt;

    // 9. build messages for AI (add image if present)
    const messagesForAI: CoreMessage[] = [...rawMessages];
    const lastIndex = messagesForAI.length - 1;
    const lastForAI: any = messagesForAI[lastIndex];

    if (fileUrl) {
      // make it multimodal
      const mm: any[] = [];
      if (cleanText) {
        mm.push({ type: "text", text: cleanText });
      }
      mm.push({
        type: "image",
        image: new URL(fileUrl),
      });
      messagesForAI[lastIndex] = {
        ...lastForAI,
        content: mm as any,
      };
    }

    // 10. call Gemini
    const result = await streamText({
      model: google("gemini-2.5-flash"),
      system: systemPrompt,
      messages: messagesForAI,
      onFinish: async ({ text }) => {
        if (!text) return;
        const clean = sanitizeInput(text);
        await supabase.from("messages").insert({
          conversation_id: conversationId,
          user_id: user.id,
          role: "assistant",
          content: clean,
        });
      },
    });

    // 11. return stream
    return new Response(result.textStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-RateLimit-Limit": rl.limit.toString(),
        "X-RateLimit-Remaining": rl.remaining.toString(),
        "X-RateLimit-Reset": rl.reset.toString(),
      },
    });
  } catch (err) {
    console.error("chat route error:", err);
    return NextResponse.json(
      { error: "internal error", detail: String(err) },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, route: "/api/chat" });
}
