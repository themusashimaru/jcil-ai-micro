export const runtime = 'nodejs';

import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { createClient } from "@/lib/supabase/server";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `
You are "Slingshot 2.0," an AI assistant. You remember the user's past conversations and always respond clearly and helpfully.
`;

export async function POST(req: Request) {
  const supabase = createClient();

  // Identify user (if logged in)
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth?.user?.id || null;

  let conversationId: string | null = null;
  let message = "";
  let history: ChatCompletionMessageParam[] = [];

  // Multipart (file upload) OR JSON
  if (req.headers.get("content-type")?.includes("multipart/form-data")) {
    const form = await req.formData();
    message = String(form.get("message") || "");
    history = JSON.parse(String(form.get("history") || "[]"));
    conversationId = String(form.get("conversationId") || "") || null;
  } else {
    const body = await req.json();
    message = body.message || "";
    history = body.history || [];
    conversationId = body.conversationId || null;
  }

  // Load previous context — GLOBAL MEMORY (last 50 messages by user)
  let rows: any[] = [];

  if (conversationId) {
    const { data } = await supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(200);
    rows = data || [];
  } else if (userId) {
    const { data } = await supabase
      .from("messages")
      .select("role, content")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    rows = data?.reverse() || [];
  }

  const fullHistory: ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...rows.map((m) => ({ role: m.role, content: m.content })),
    ...history,
    { role: "user", content: message },
  ];

  const completion = await client.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: fullHistory,
  });

  const reply = completion.choices[0].message.content || "";

  // Ensure a conversation ID exists
  if (!conversationId) {
    conversationId = crypto.randomUUID();
  }

  await supabase.from("messages").insert([
    { user_id: userId, role: "user", content: message, conversation_id: conversationId },
    { user_id: userId, role: "assistant", content: reply, conversation_id: conversationId },
  ]);

  return new Response(
    JSON.stringify({ ok: true, reply, conversationId }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
}
