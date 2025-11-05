/**
 * Chat API — clean canonical version
 * Next.js 16 App Router, Node runtime (no Edge quirks)
 */

export const runtime = 'nodejs';
import { NextResponse } from 'next/server';

type ChatPart =
  | { type: 'text'; text: string }
  | { type: 'input_image'; image_url: { url: string } };

type ChatMessage =
  | { role: 'system' | 'user' | 'assistant'; content: string | ChatPart[] };

/* ---------- helpers ---------- */
function collectArray(v: unknown): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.filter(Boolean).map(String);
  if (typeof v === 'string' && v.trim()) return [v];
  return [];
}

const CHRISTIAN_SYSTEM_PROMPT = `
You are "Slingshot 2.0," an AI assistant developed by JCIL.AI. Your purpose is to serve as a helpful, faithful, and respectful resource for Christians and all users seeking information from a Christian worldview.
`;

/* ---------- handler ---------- */
export async function POST(req: Request) {
  // Parse JSON safely
  const body: any = await (async () => {
    try {
      return typeof (req as any)?.json === 'function' ? await req.json() : {};
    } catch {
      return {};
    }
  })();

  const {
    content,
    history,
    longMemory,
    images,
    imageUrls,
    attachments,
    files,
    model: userModel,
    temperature,
  } = body || {};

  // Build user content (text + optional images)
  const userText = String(
    body?.text ?? content ?? body?.message ?? body?.prompt ?? ''
  ).trim();

  const imageUrlsAll = [
    ...collectArray(images),
    ...collectArray(imageUrls),
    ...collectArray(attachments),
    ...collectArray(files),
  ];

  const imageParts: ChatPart[] = imageUrlsAll.map((url) => ({
    type: 'input_image',
    image_url: { url },
  }));

  const userContent: ChatPart[] | string =
    imageParts.length > 0
      ? [{ type: 'text', text: userText || '(no text)' }, ...imageParts]
      : userText || '(no text)';

  // History normalization
  const historyArr: ChatMessage[] = Array.isArray(history)
    ? history.map((m: any) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      }))
    : [];

  const longMemArr: ChatMessage[] = Array.isArray(longMemory)
    ? (longMemory as ChatMessage[])
    : [];

  // Final message list
  const messages: ChatMessage[] = [
    { role: 'system', content: CHRISTIAN_SYSTEM_PROMPT },
    ...historyArr,
    ...longMemArr,
    { role: 'user', content: userContent },
  ];

  const model = String(userModel || 'gpt-4o-mini');
  const temp = typeof temperature === 'number' ? temperature : 0.3;

  // Try OpenAI. If not available, echo back so builds never fail.
  try {
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion: any = await client.chat.completions.create({
      model,
      messages,
      temperature: temp,
    });

    const reply =
      completion?.choices?.[0]?.message?.content ??
      completion?.choices?.[0]?.message?.role === 'assistant'
        ? ''
        : '(no response)';

    return NextResponse.json({
      ok: true,
      reply,
      model,
      conversationId: body?.conversationId || null,
    });
  } catch (err: any) {
    // Fallback: echo so UI keeps working without OpenAI
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
        conversationId: body?.conversationId || null,
      },
      { status: 200 }
    );
  }
}
