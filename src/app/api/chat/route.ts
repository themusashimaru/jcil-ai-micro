export const runtime = 'nodejs';

import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

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
}> {
  const ct = req.headers.get('content-type') || '';
  let message = '';
  let history: ChatCompletionMessageParam[] = [];
  let imagePart: { type: 'input_image'; image_url: { url: string } } | null = null;

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
  }

  return { message, history, imagePart };
}

export async function POST(req: Request) {
  try {
    const { message, history, imagePart } = await readRequest(req);
    if (!message && !imagePart) {
      return new Response(JSON.stringify({ ok: false, error: 'No text or file provided.' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      });
    }

    const userContent: ChatPart[] | string = imagePart
      ? [{ type: 'text', text: message || '(no text)' }, imagePart]
      : (message || '(no text)');

    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: CHRISTIAN_SYSTEM_PROMPT },
      ...history,
      { role: 'user', content: userContent as any },
    ];

    const model = process.env.OPENAI_MODEL || 'gpt-4o';
    const temperature = process.env.OPENAI_TEMPERATURE
      ? Number(process.env.OPENAI_TEMPERATURE)
      : 0.3;

    const completion = await client.chat.completions.create({
      model,
      messages,
      temperature,
    });

    const reply =
      completion.choices?.[0]?.message?.content?.toString() || '(no response)';

    return new Response(JSON.stringify({ ok: true, reply, model }), {
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
