// src/app/api/chat/route.ts
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  return NextResponse.json(
    {
      ok: true,
      got: body,
      at: new Date().toISOString(),
    },
    { status: 200 }
  );
}

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      method: 'GET',
      at: new Date().toISOString(),
    },
    { status: 200 }
  );
}
