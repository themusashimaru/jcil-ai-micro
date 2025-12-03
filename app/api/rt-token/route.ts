import { NextRequest, NextResponse } from 'next/server';

const RT_ENDPOINT = 'https://api.openai.com/v1/realtime?model=gpt-4o-realtime';

export async function POST(req: NextRequest) {
  try {
    const { sdp } = await req.json();

    const r = await fetch(RT_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/sdp',
        'OpenAI-Beta': 'realtime=v1',
      },
      body: sdp,
    });

    if (!r.ok) {
      const txt = await r.text();
      console.error('[rt-token] OpenAI error:', r.status, txt);
      return NextResponse.json({ error: txt }, { status: 500 });
    }

    const answer = await r.text();
    return NextResponse.json({ sdp: answer });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'rt-token failed';
    console.error('[rt-token] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
