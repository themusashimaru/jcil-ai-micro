export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getLongTermMemory, saveMemoryExtract } from "@/lib/memory";
import OpenAI from "openai";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getUserIdOrGuest } from "@/lib/auth";

type Role = "user" | "assistant" | "system";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function json(status: number, body: any) {
  return new NextResponse(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const CHRISTIAN_SYSTEM_PROMPT = `
You are "Slingshot 2.0," an AI assistant developed by JCIL.AI. Your purpose is to serve as a helpful, faithful, and respectful resource for Christians and all users seeking information from a Christian worldview.
(…prompt unchanged…)
`;

async function loadMessages(conversation_id: string) {
  const { data, error } = await supabaseAdmin
    .from("messages")
    .select("role, content, created_at")
    .eq("conversation_id", conversation_id)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []) as Array<{ role: Role; content: string; created_at: string }>;
}

async function saveMsg(conversation_id: string, role: Role, content: string, user_id: string) {
  const { error } = await supabaseAdmin
    .from("messages")
    .insert({ conversation_id, role, content, user_id });
  if (error) throw error;
}

async function reuseOrCreateConversation(user_id: string, incomingId: string, title: string) {
  // 1) If client sent an id, use it
  if (incomingId) return incomingId;

  // 2) Try to reuse the most recent conversation for this user within the last 60 minutes
  const { data: recent, error: recentErr } = await supabaseAdmin
    .from("conversations")
    .select("id, created_at")
    .eq("user_id", user_id)
    .order("created_at", { ascending: false })
    .limit(1);

  if (!recentErr && recent && recent.length > 0) {
    const last = recent[0];
    const createdAt = new Date(last.created_at);
    const ageMinutes = (Date.now() - createdAt.getTime()) / 60000;
    if (ageMinutes <= 60) {
      return last.id as string;
    }
  }

  // 3) Otherwise create a new conversation
  const { data: conv, error: convErr } = await supabaseAdmin
    .from("conversations")
    .insert({ title, user_id })
    .select("id")
    .single();
  if (convErr) throw convErr;
  return conv.id as string;
}

/** POST /api/chat
 * body: { conversation_id?: string, title?: string, text|content|message|prompt: string }
 * returns: { ok, reply, model, conversationId }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));

    const userText = String(
      body?.text ?? body?.content ?? body?.message ?? body?.prompt ?? ""
    ).trim();
    
/* BEGIN IMAGE SUPPORT */
type ImgPart = { type: 'input_image'; image_url: { url: string } };

function collectArray(v: unknown): string[] {
  return Array.isArray(v) ? v : (typeof v === 'string' && v.trim()) ? [v] : [];
}

const rawImages: string[] = [
  ...collectArray((body || {}).images),
  ...collectArray((body || {}).imageUrls),
  ...collectArray((body || {}).attachments),
  ...collectArray((body || {}).files),
  ...collectArray((body || {}).imageUrl),
  ...collectArray((body || {}).image_url),
];

    // --- build messages for OpenAI ---
const longMemArr: any[] =
  (typeof longMemory !== 'undefined' && Array.isArray(longMemory)) ? longMemory : [];

const historyArr: any[] =
  (typeof history !== 'undefined' && Array.isArray(history))
    ? history.map((m: any) => ({
        role: (m.role === "assistant" ? "assistant" : "user"),
        content: m.content
      }))
    : [];

// imageParts should already be prepared earlier (ImgPart[]).
// Fallbacks ensure we always provide content.
const userContent: any =
  (Array.isArray(imageParts) && imageParts.length)
    ? [{ type: "text", text: userText || "(no text)" }, ...imageParts]
    : (userText || "(no text)");

// Keep types loose to avoid TS issues with union message content.

// build once to keep types loose and support text or vision content
const longMemArr = Array.isArray(longMemory) ? (longMemory as any[]) : [];

const messages: any[] = [
  { role: "system", content: CHRISTIAN_SYSTEM_PROMPT },
  ...longMemArr,
  ...(Array.isArray(history)
      ? history.map((m: any) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content
        }))
      : []),
  ...(userContent ? [{ role: "user", content: userContent }] : [])
];= [
  { role: "system", content: CHRISTIAN_SYSTEM_PROMPT },
  ...(Array.isArray(history)
      ? history.map((m: any) => ({
          role: m?.role === "assistant" ? "assistant" : "user",
          content: m?.content ?? ""
        }))
      : []),
  ...(Array.isArray(imageParts) && imageParts.length > 0
      ? [{
          role: "user",
          content: [
            { type: "text", text: String(userText ?? "") },
            ...imageParts
          ]
        }]
      : [{
          role: "user",
          content: String(userText ?? "")
        }])
];
// --- end messages ---
const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      temperature: 0.3,
    });

    const reply = completion.choices?.[0]?.message?.content || "(no response)";

    // Save assistant reply
    await saveMsg(conversation_id, "assistant", reply, user_id);

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
