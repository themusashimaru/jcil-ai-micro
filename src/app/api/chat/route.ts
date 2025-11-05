export const runtime = 'nodejs';

import OpenAI from 'openai';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const CHRISTIAN_SYSTEM_PROMPT = `
You are "Slingshot 2.0," an AI assistant developed by JCIL.AI. Your purpose is to serve as a helpful, faithful, and respectful resource for Christians and all users seeking information from a Christian worldview.
`;

type VisionPart = { type: 'image_url'; image_url: { url: string } };

function toDataUrl(mime: string, buf: Buffer) {
  const b64 = buf.toString('base64');
  return `data:${mime};base64,${b64}`;
}

async function readRequest(req: Request): Promise<{
  message: string;
  history: Array<{ role: 'system' | 'user' | 'assistant'; content: any }>;
  imagePart: VisionPart | null;
}> {
  const ct = req.headers.get('content-type') || '';
  let message = '';
  let history: Array<{ role: 'system' | 'user' | 'assistant'; content: any }> = [];
  let imagePart: VisionPart | null = null;

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
            .filter((m: any) => m && typeof m.role === 'string' && m.content != null)
            .map((m: any) => ({ role: m.role, content: m.content }));
        }
      } catch {}
    }

    const file = form.get('file') as File | null;
    if (file && file.size > 0 && file.type.startsWith('image/')) {
      const ab = await file.arrayBuffer();
      const dataUrl = toDataUrl(file.type, Buffer.from(ab));
      imagePart = { type: 'image_url', image_url: { url: dataUrl } };
    }
  } else {
    const body = await req.json().catch(() => ({} as any));

    const msg = body?.message ?? body?.content ?? '';
    message = String(msg || '').trim();

    if (Array.isArray(body?.history)) {
      history = body.history
        .filter((m: any) => m && typeof m.role === 'string' && m.content != null)
        .map((m: any) => ({ role: m.role, content: m.content }));
    }

    const one = typeof body?.imageUrl === 'string' ? body.imageUrl : '';
    const many = Array.isArray(body?.imageUrls) ? body.imageUrls : [];
    const firstUrl =
      (one && one.trim()) ||
      (many.find((u: any) => typeof u === 'string' && u.trim()) || '');
    if (firstUrl) {
      imagePart = { type: 'image_url', image_url: { url: String(firstUrl) } };
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

    const userContent: any = imagePart
      ? [{ type: 'text', text: message || '(no text)' }, imagePart]
      : (message || '(no text)');

    const messages: any[] = [
      { role: 'system', content: CHRISTIAN_SYSTEM_PROMPT },
      ...history,
      { role: 'user', content: userContent },
    ];

    const model = process.env.OPENAI_MODEL || 'gpt-4o';
    const temperature = process.env.OPENAI_TEMPERATURE ? Number(process.env.OPENAI_TEMPERATURE) : 0.3;

    const completion = await client.chat.completions.create({
      model,
      messages,
      temperature,
    } as any);

    const reply = (completion as any)?.choices?.[0]?.message?.content ?? '(no response)';

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
