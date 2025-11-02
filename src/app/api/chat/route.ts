import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: Request) {
  try {
    const { message, fileUrl, fileMimeType } = await req.json();

    if (!message && !fileUrl) {
      return NextResponse.json({ ok: false, error: 'Message or file required' }, { status: 400 });
    }

    let input: any[] = [{ role: 'user', content: [{ type: 'text', text: message || '' }] }];

    // if an image was attached, include it as a multimodal input
    if (fileUrl && fileMimeType?.startsWith('image/')) {
      input[0].content.push({
        type: 'image_url',
        image_url: { url: fileUrl },
      });
    }

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini', // or gpt-4o
      messages: input,
    });

    const reply = response.choices[0]?.message?.content || "I'm here — how can I help?";
    return NextResponse.json({ ok: true, reply });
  } catch (error: any) {
    console.error('chat route error:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
