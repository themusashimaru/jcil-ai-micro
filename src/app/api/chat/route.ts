export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

const CHRISTIAN_SYSTEM_PROMPT = `You are "Slingshot 2.0," an AI assistant developed by JCIL.AI. Keep replies concise, helpful, and respectful.`;

function toArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter(Boolean).map(String);
  if (typeof v === 'string' && v.trim()) return [v.trim()];
  return [];
}

export async function POST(req: Request) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const body = await req.json().catch(() => ({} as any));

  const content = body?.content;
  const history = Array.isArray(body?.history) ? body.history : [];
  const longMemory = Array.isArray(body?.longMemory) ? body.longMemory : [];

  const rawImageUrls: string[] = [
    ...toArray(body?.images),
    ...toArray(body?.imageUrls),
    ...toArray(body?.attachments),
    ...toArray(body?.files),
  ];

  const imageParts = rawImageUrls.map((u) => ({
    type: 'input_image' as const,
    image_url: { url: String(u) },
  }));

  const historyArr: ChatCompletionMessageParam[] = history.map((m: any) => ({
    role: m?.role === 'assistant' ? 'assistant' : m?.role === 'system' ? 'system' : 'user',
    content: typeof m?.content === 'string' ? m.content : String(m?.content ?? ''),
  }));

  const longMemArr: ChatCompletionMessageParam[] = longMemory
    .filter((x: any) => typeof x === 'string' && x.trim())
    .map((text: string) => ({ role: 'system', content: text }));

  const userText = typeof content === 'string' ? content : String(content ?? '');
  const userContent =
    imageParts.length > 0
      ? ([{ type: 'text', text: userText || '(no text)' }, ...imageParts] as any)
      : userText || '(no text)';

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: CHRISTIAN_SYSTEM_PROMPT },
    ...historyArr,
    ...longMemArr,
    { role: 'user', content: userContent },
  ];

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const temperature = 0.3;

  const completion = await client.chat.completions.create({
    model,
    messages,
    temperature,
  });

  const reply =
    completion?.choices?.[0]?.message?.content ??
    '';

  return NextResponse.json({
    ok: true,
    reply,
    model,
  });
}
