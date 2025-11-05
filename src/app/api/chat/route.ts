export const runtime = 'nodejs';

import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { supabaseServer } from '@/lib/supabase/server';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const CHRISTIAN_SYSTEM_PROMPT = `
You are "Slingshot 2.0," an AI assistant developed by JCIL.AI. Your purpose is to serve as a helpful, faithful, and respectful resource for Christians and all users seeking information from a Christian worldview.
`;

type ChatPart =
  | { type: 'text'; text: string }
  | { type: 'input_image'; image_url: { url: string } };

function toDataUrl(mime: string, buf: Buffer) {
  const b64 = buf.toString('base64');
  return `data:${mime};base64,${b64}`;
}

async function readRequest(req: Request): Promise<{
  message: string;
  history: ChatCompletionMessageParam[];
  imagePart: { type: 'input_image'; image_url: { url: string } } | null;
  conversationId: string | null;
  userId: string | null;
}> {
  const ct = req.headers.get('content-type') || '';
  let message = '';
  let history: ChatCompletionMessageParam[] = [];
  let imagePart: { type: 'input_image'; image_url: { url: string } } | null = null;
  let conversationId: string | null = null;
  let userId: string | null = null;

  if (ct.includes('multipart/form-data')) {
    const form = await req.formData();
    const msg = (form.get('message') ?? form.get('content') ?? '') as string;
    message = String(msg || '').trim();

    const histRaw = form.get('history');
    if (histRaw) {
      try {
        const arr = JSON.parse(String(histRaw));
        if (Array.isArray(arr)) {
          history = arr
            .filter((m: any) => m && typeof m.role === 'string' && typeof m.content === 'string')
            .map((m: any) => ({ role: m.role, content: m.content } as ChatCompletionMessageParam));
        }
      } catch {}
    }

    conversationId = (form.get('conversationId') as string) || null;
    userId = (form.get('userId') as string) || null;

    const file = form.get('file') as File | null;
    if (file && file.size > 0 && file.type.startsWith('image/')) {
      const ab = await file.arrayBuffer();
      const dataUrl = toDataUrl(file.type, Buffer.from(ab));
      imagePart = { type: 'input_image', image_url: { url: dataUrl } };
    }
  } else {
    const body = await req.json().catch(() => ({} as any));
    const msg = body?.message ?? body?.content ?? '';
    message = String(msg || '').trim();

    if (Array.isArray(body?.history)) {
      history = body.history
        .filter((m: any) => m && typeof m.role === 'string' && typeof m.content === 'string')
        .map((m: any) => ({ role: m.role, content: m.content } as ChatCompletionMessageParam));
    }

    conversationId = typeof body?.conversationId === 'string' ? body.conversationId : null;
    userId = typeof body?.userId === 'string' ? body.userId : null;

    // Optional: accept imageUrl/imageUrls in JSON
    const one = typeof body?.imageUrl === 'string' ? body.imageUrl : '';
    const many = Array.isArray(body?.imageUrls) ? body.imageUrls : [];
    const firstUrl =
      (one && one.trim()) ||
      (many.find((u: any) => typeof u === 'string' && u.trim()) || '');
    if (firstUrl) {
      imagePart = { type: 'input_image', image_url: { url: String(firstUrl) } };
    }
  }

  return { message, history, imagePart, conversationId, userId };
}

async function loadDbHistory(opts: { conversationId: string | null; userId: string | null }) {
  const { conversationId, userId } = opts;
  let rows: { role: string; content: string }[] = [];

  if (conversationId) {
    const { data } = await supabaseServer
      .from('messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(200);
    rows = data || [];
  } else if (userId) {
    // Fallback: last 50 messages across user when no conversationId
    const { data } = await supabaseServer
      .from('messages')
      .select('role, content')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(50);
    rows = data || [];
  }

  const mapped: ChatCompletionMessageParam[] = rows
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant'))
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  return mapped;
}

export async function POST(req: Request) {
  try {
    const { message, history, imagePart, conversationId, userId } = await readRequest(req);
    if (!message && !imagePart) {
      return new Response(JSON.stringify({ ok: false, error: 'No text or file provided.' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    }

    // Load durable history from Supabase
    const dbHistory = await loadDbHistory({ conversationId, userId });

    // Avoid duplicating the just-inserted user line if UI already saved it
    const lastDb = dbHistory[dbHistory.length - 1];
    const shouldAppendUser =
      !(lastDb && lastDb.role === 'user' && typeof lastDb.content === 'string' && message && lastDb.content.trim() === message.trim());

    const userContent: ChatPart[] | string = imagePart
      ? [{ type: 'text', text: message || '(no text)' }, imagePart]
      : (message || '(no text)');

    const messages: any[] = [
  { role: "system", content: CHRISTIAN_SYSTEM_PROMPT },
  ...(dbHistory as any[]).map(mapRow),
  ...(Array.isArray(history) ? (history as any[]).map(mapRow) : []),
  ...(shouldAppendUser ? [{ role: "user", content: userContent as any }] : []),
];

    const model = process.env.OPENAI_MODEL || 'gpt-4o';
    const temperature = process.env.OPENAI_TEMPERATURE ? Number(process.env.OPENAI_TEMPERATURE) : 0.3;

    const completion = await client.chat.completions.create({
      model,
      messages,
      temperature,
    });

    const reply = completion.choices?.[0]?.message?.content?.toString() || '(no response)';

    // Optional: write assistant reply (skip if your UI already writes it to avoid duplicates)
    // if (conversationId && userId && reply) {
    //   await supabaseServer.from('messages').insert({
    //     user_id: userId,
    //     conversation_id: conversationId,
    //     role: 'assistant',
    //     content: reply,
    //   });
    // }

    return new Response(JSON.stringify({ ok: true, reply, model, conversationId }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ ok: false, error: err?.message || 'Internal error' }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
}
function mapRow(m:any) {
  const raw = (m && typeof m.role === "string") ? m.role : "user";
  const role = raw === "assistant" ? "assistant" : (raw === "system" ? "system" : "user");
  const content = (typeof m?.content === "string") ? m.content : JSON.stringify(m?.content ?? "");
  return { role, content };
} as import("openai").ChatCompletionAssistantMessageParam;
  if (role === 'system')   return { role: 'system',   content } as import("openai").ChatCompletionSystemMessageParam;
  return { role: 'user', content } as import("openai").ChatCompletionUserMessageParam;
}
