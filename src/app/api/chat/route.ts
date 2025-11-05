export const runtime = 'nodejs';

import OpenAI from 'openai';
import { createClient } from '@/lib/supabase/server';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type UIHistoryRow = { role: string; content: any };

function toDataUrl(mime: string, buf: Buffer) {
  const b64 = buf.toString('base64');
  return `data:${mime};base64,${b64}`;
}

// Parse either JSON body or multipart form-data, and normalize fields
async function readInbound(req: Request) {
  let message = '';
  let history: UIHistoryRow[] = [];
  let imagePart: any = null;
  let conversationId: string | null = null;
  let userId: string | null = null;

  const ct = req.headers.get('content-type') || '';

  if (ct.includes('multipart/form-data')) {
    const form = await req.formData();
    message = String(form.get('message') || '');
    conversationId = (form.get('conversationId') as string) || null;
    userId = (form.get('userId') as string) || null;

    try {
      const raw = form.get('history');
      if (raw) history = JSON.parse(String(raw));
    } catch {}

    // optional image file
    const f = form.get('file') as File | null;
    if (f && typeof (f as any).arrayBuffer === 'function') {
      const ab = await f.arrayBuffer();
      const buf = Buffer.from(ab);
      imagePart = {
        type: 'input_image',
        image_url: { url: toDataUrl(f.type || 'image/png', buf) },
      };
    }
  } else {
    const body = await req.json().catch(() => ({} as any));
    message = String(body?.message || '');
    history = Array.isArray(body?.history) ? body.history : [];
    conversationId = (body?.conversationId && String(body.conversationId)) || null;
    userId = (body?.userId && String(body.userId)) || null;

    // accept imageUrl or imageUrls on JSON branch
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

// Load durable memory from Supabase
async function loadMemory(opts: { conversationId: string | null; userId: string | null }) {
  const { conversationId, userId } = opts;
  const supabase = createClient();
  let rows: { role: string; content: any }[] = [];

  if (conversationId) {
    const { data } = await supabase
      .from('messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(200);
    rows = data || [];
  } else if (userId) {
    // Global memory across **all** chats for this user
    const { data } = await supabase
      .from('messages')
      .select('role, content')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(200);
    rows = data || [];
  }

  // Normalize to OpenAI message format (simple)
  return rows.map((m) => {
    const role = m?.role === 'assistant' ? 'assistant' : m?.role === 'system' ? 'system' : 'user';
    const content = typeof m?.content === 'string' ? m.content : JSON.stringify(m?.content ?? '');
    return { role, content } as any;
  });
}

// Save user + assistant messages to Supabase
async function saveMessages(payload: {
  conversationId: string;
  userId: string | null;
  userContent: any;
  assistantContent: any;
}) {
  const { conversationId, userId, userContent, assistantContent } = payload;
  const supabase = createClient();

  const rows = [
    {
      conversation_id: conversationId,
      user_id: userId,
      role: 'user',
      content: typeof userContent === 'string' ? userContent : JSON.stringify(userContent),
    },
    {
      conversation_id: conversationId,
      user_id: userId,
      role: 'assistant',
      content:
        typeof assistantContent === 'string' ? assistantContent : JSON.stringify(assistantContent),
    },
  ];

  await supabase.from('messages').insert(rows as any);
}

const SYSTEM = `You are Slingshot 2.0 (JCIL.AI). Keep answers crisp. If user asks about prior chats, try to recall from memory loaded by the server. If nothing is found, say you don't have stored context yet.`;

// Main handler
export async function POST(req: Request) {
  try {
    const { message, history, imagePart, conversationId: convIn, userId } = await readInbound(req);

    if (!message && !imagePart) {
      return new Response(JSON.stringify({ ok: false, error: 'No message provided' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    }

    const conversationId = convIn || crypto.randomUUID();

    // Load durable memory (conversation-scoped first; otherwise global per user)
    const dbHistory = await loadMemory({ conversationId: convIn || null, userId: userId || null });

    // Build messages for OpenAI
    const msgParts: any[] = [{ role: 'system', content: SYSTEM }];

    dbHistory.forEach((m) => msgParts.push(m)); // durable memory
    if (Array.isArray(history)) {
      history.forEach((m: any) => {
        const role = m?.role === 'assistant' ? 'assistant' : m?.role === 'system' ? 'system' : 'user';
        const content = typeof m?.content === 'string' ? m.content : JSON.stringify(m?.content ?? '');
        msgParts.push({ role, content });
      });
    }

    // Assemble the current user message (text + optional image)
    let userContent: any =
      typeof message === 'string' ? message : JSON.stringify(message ?? '');

    if (imagePart) {
      userContent = [
        { type: 'text', text: String(message || '') },
        imagePart,
      ];
    }

    msgParts.push({ role: 'user', content: userContent });

    // Call OpenAI
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: msgParts as any,
      temperature: 0.2,
    });

    const reply = completion.choices?.[0]?.message?.content || 'OK';

    // Save both sides to DB
    await saveMessages({
      conversationId,
      userId: userId || null,
      userContent,
      assistantContent: reply,
    });

    return new Response(
      JSON.stringify({ ok: true, reply, model: completion.model, conversationId }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ ok: false, error: err?.message || 'Internal error' }),
      { status: 500, headers: { 'content-type': 'application/json' } }
    );
  }
}
