export const runtime = 'nodejs';

import OpenAI from 'openai';
import { createClient } from '@/lib/supabase/server';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const CHRISTIAN_SYSTEM_PROMPT =
  `You are "Slingshot 2.0," an AI assistant developed by JCIL.AI. Your purpose is to serve as a helpful, faithful, and respectful resource for Christians and all users seeking information from a Christian worldview.`;

// Minimal message type so we avoid OpenAI type imports
type Msg = { role: 'system' | 'user' | 'assistant'; content: string };
type ChatPart = { type: 'text'; text: string } | { type: 'input_image'; image_url: { url: string } };

function toDataUrl(mime: string, buf: Buffer) {
  const b64 = buf.toString('base64');
  return `data:${mime};base64,${b64}`;
}

function mapRow(m: any): Msg {
  const raw = (m && typeof m.role === 'string') ? m.role : 'user';
  const role: 'system' | 'user' | 'assistant' = raw === 'assistant' ? 'assistant' : (raw === 'system' ? 'system' : 'user');
  const content = (typeof m?.content === 'string') ? m.content : JSON.stringify(m?.content ?? '');
  return { role, content };
}

async function readRequest(req: Request): Promise<{
  message: string;
  history: Msg[];
  imagePart: ChatPart | null;
  conversationId: string | null;
  userId: string | null;
}> {
  const ct = req.headers.get('content-type') || '';
  let message = '';
  let history: Msg[] = [];
  let imagePart: ChatPart | null = null;
  let conversationId: string | null = null;
  let userId: string | null = null;

  if (ct.includes('multipart/form-data')) {
    const form = await req.formData();

    const msg = form.get('message') ?? form.get('content') ?? '';
    message = String(msg || '').trim();

    const histRaw = form.get('history');
    if (histRaw) {
      try {
        const arr = JSON.parse(String(histRaw));
        if (Array.isArray(arr)) {
          history = arr
            .filter((m: any) => m && typeof m.role === 'string' && typeof m.content === 'string')
            .map(mapRow)
            .slice(-12);
        }
      } catch {}
    }

    const f = form.get('file') as File | null;
    if (f && f.size > 0 && f.type && f.type.startsWith('image/')) {
      const ab = await f.arrayBuffer();
      const dataUrl = toDataUrl(f.type, Buffer.from(ab));
      imagePart = { type: 'input_image', image_url: { url: dataUrl } };
    }

    conversationId = (form.get('conversationId') ?? '') ? String(form.get('conversationId')) : null;
    userId = (form.get('userId') ?? '') ? String(form.get('userId')) : null;

  } else {
    const body = await req.json().catch(() => ({} as any));
    const msg = body?.message ?? body?.content ?? '';
    message = String(msg || '').trim();

    if (Array.isArray(body?.history)) {
      history = (body.history as any[]).map(mapRow).slice(-12);
    }

    // Accept direct image URL(s) in JSON
    const one = typeof body?.imageUrl === 'string' ? body.imageUrl : '';
    const many = Array.isArray(body?.imageUrls) ? body.imageUrls : [];
    const firstUrl = (one && one.trim()) || (many.find((u: any) => typeof u === 'string' && u.trim()) || '');
    if (firstUrl) {
      imagePart = { type: 'input_image', image_url: { url: String(firstUrl) } };
    }

    conversationId = body?.conversationId ? String(body.conversationId) : null;
    userId = body?.userId ? String(body.userId) : null;
  }

  return { message, history, imagePart, conversationId, userId };
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

    // Build the "user" content with optional image part
    const userContent: any = imagePart
      ? [{ type: 'text', text: message || '(no text)' }, imagePart]
      : (message || '(no text)');

    // Pull durable memory from Supabase
    const supabase = createClient();
    let rows: any[] = [];

    if (conversationId) {
      const { data } = await supabase
        .from('messages')
        .select('role, content')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(200);
      rows = data || [];
    } else if (userId) {
      const { data } = await supabase
        .from('messages')
        .select('role, content')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);
      rows = data || [];
      rows.reverse();
    }

    // Assemble messages: system + db memory + thin client history + new user
    const messages: Msg[] = [
      { role: 'system', content: CHRISTIAN_SYSTEM_PROMPT },
      ...rows.map(mapRow),
      ...history.map(mapRow),
      { role: 'user', content: typeof userContent === 'string' ? userContent : JSON.stringify(userContent) },
    ];

    const model = process.env.OPENAI_MODEL || 'gpt-4o';
    const temperature = process.env.OPENAI_TEMPERATURE ? Number(process.env.OPENAI_TEMPERATURE) : 0.3;

    const completion = await client.chat.completions.create({
      model,
      messages: messages as any,
      temperature,
    });

    const reply = completion.choices?.[0]?.message?.content?.toString() || '(no response)';

    // Persist both sides to Supabase if we have at least one id
    if (conversationId || userId) {
      const conv = conversationId || crypto.randomUUID();
      const items = [
        { conversation_id: conv, user_id: userId || null, role: 'user', content: message || '(no text)' },
        { conversation_id: conv, user_id: userId || null, role: 'assistant', content: reply },
      ];
      await supabase.from('messages').insert(items);
      return new Response(JSON.stringify({ ok: true, reply, model, conversationId: conv }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true, reply, model, conversationId: null }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err?.message || 'Internal error' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }
}
