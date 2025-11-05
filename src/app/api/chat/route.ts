export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserIdOrGuest } from "@/lib/auth";

// NOTE: Your existing OpenAI call + prompt/moderation should still be here.
// If your file previously contained the OpenAI client/logic, keep it the same.
// We’re only ensuring user_id flows into DB writes.

type Role = "user" | "assistant" | "system";

function json(status: number, body: any) {
  return new NextResponse(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// Helper: save a single message
async function saveMsg(conversation_id: string, user_id: string, role: Role, content: string) {
  const { error } = await supabaseAdmin
    .from("messages")
    .insert({ conversation_id, user_id, role, content });
  if (error) throw error;
}

/**
 * POST /api/chat
 * body:
 *   { conversation_id?: string, title?: string, text|content|message|prompt: string, image?: string }
 * returns:
 *   { ok: true, reply, model, conversationId }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    // Accept a few common keys for the user text
    const userText = String(
      body?.text ?? body?.content ?? body?.message ?? body?.prompt ?? ""
    ).trim();
    if (!userText) return json(400, { ok: false, error: "text required" });

    // Current user (guest if not signed in)
    const user_id = await getUserIdOrGuest();

    // Conversation id (create if missing)
    let conversation_id = String(body?.conversation_id || "");
    if (!conversation_id) {
      const title = String(body?.title || "New Chat").slice(0, 120);
      const { data: conv, error: convErr } = await supabaseAdmin
        .from("conversations")
        .insert({ title, user_id })
        .select("id")
        .single();
      if (convErr) return json(500, { ok: false, error: convErr.message });
      conversation_id = conv!.id;
    }

    // Save the user's message
    await saveMsg(conversation_id, user_id, "user", userText);

    // === Your existing OpenAI call goes here ===
    // Example skeleton (replace with your exact code; we’re not changing your prompt):
    //
    // const data = await openai.chat.completions.create({...});
    // const reply =
    //   data?.choices?.[0]?.message?.content ??
    //   data?.error?.message ??
    //   "(no response)";
    //
    // For safety, keep your real logic. Here we just stub a reply if your code is elsewhere.
    const reply = "(reply goes here from your existing OpenAI code)";

    // Save assistant reply
    await saveMsg(conversation_id, user_id, "assistant", reply);

    return json(200, {
      ok: true,
      reply,
      model: "gpt-4o",
      conversationId: conversation_id,
    });
  } catch (err: any) {
    return json(500, { ok: false, error: err?.message || "Internal error" });
  }
}
