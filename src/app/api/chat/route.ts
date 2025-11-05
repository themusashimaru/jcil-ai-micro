/**
 * Chat API — Next.js 16 (Node runtime)
 * Multimodal via OpenAI Chat Completions (gpt-4o/mini)
 */

export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

function collectArray(v: unknown): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.filter(Boolean).map(String);
  if (typeof v === 'string' && v.trim()) return [v];
  return [];
}

const CHRISTIAN_SYSTEM_PROMPT = `
You are "Slingshot 2.0," an AI assistant developed by JCIL.AI. Your purpose is to serve as a helpful, faithful, and respectful resource for Christians and all users seeking information from a Christian worldview.
`;

export async function POST(req: Request) {
  // ---- parse body safely ----
  const body: any = await (async () => {
    try {
      return typeof (req as any)?.json === 'function' ? await req.json() : {};
    } catch {
      return {};
    }
  })();

  const {
    content,
    text,
    message,
    prompt,
    history,
    longMemory,
    images,
    imageUrls,
    attachments,
    files,
    model: userModel,
    temperature,
    conversationId,
  } = body || {};

  // ---- user text ----
  const userText = String(text ?? content ?? message ?? prompt ?? '').trim();

  // ---- image parts (correct OpenAI shape: { type:'image_url', image_url:{url} }) ----
  const allImageUrls = [
    ...collectArray(images),
    ...collectArray(imageUrls),
    ...collectArray(attachments),
    ...collectArray(files),
  ];
  const imageParts: { type: 'image_url'; image_url: { url: string } }[] =
    allImageUrls.map((url) => ({ type: 'image_url', image_url: { url } }));

  const userContent: string | Array<
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string } }
  > =
    imageParts.length > 0
      ? [{ type: 'text', text: userText || '(no text)' }, ...imageParts]
      : (userText || '(no text)');

  // ---- history & long memory (strings only for non-user roles) ----
  const historyArr: ChatCompletionMessageParam[] = Array.isArray(history)
    ? history.map((m: any) => ({
        role: (m.role === 'assistant' ? 'assistant' : 'user') as
          | 'assistant'
          | 'user',
        content: typeof m?.content === 'string' ? m.content : String(m?.content ?? ''),
      }))
    : [];

  const longMemArr: ChatCompletionMessageParam[] = Array.isArray(longMemory)
    ? longMemory.map((m: any) => ({
        role: (m?.role === 'assistant' ? 'assistant' : 'user') as
          | 'assistant'
          | 'user',
        content: typeof m?.content === 'string' ? m.content : String(m?.content ?? ''),
      }))
    : [];

  // ---- final messages typed for Chat Completions ----
  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: CHRISTIAN_SYSTEM_PROMPT },
    ...historyArr,
    ...longMemArr,
    { role: 'user', content: userContent },
  ];

  const model = String(userModel || 'gpt-4o-mini');
  const temp = typeof temperature === 'number' ? temperature : 0.3;

  // ---- call OpenAI with fallback ----
  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await client.chat.completions.create({
      model,
      messages,
      temperature: temp,
    });

    const reply =
      completion?.choices?.[0]?.message?.content ?? '(no response)';

    return NextResponse.json({
      ok: true,
      reply,
      model,
      conversationId: conversationId ?? null,
    });
  } catch (err: any) {
    const fallback =
      typeof userContent === 'string'
        ? userContent
        : userText || '(no text)';
    return NextResponse.json(
      {
        ok: true,
        reply:
          `[fallback] OpenAI not available. Echo:\n\n` +
          fallback.slice(0, 4000),
        model,
        conversationId: conversationId ?? null,
      },
      { status: 200 }
    );
  }
}
