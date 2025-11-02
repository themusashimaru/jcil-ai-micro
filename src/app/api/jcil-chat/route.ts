// src/app/api/jcil-chat/route.ts
import type { NextRequest } from 'next/server';
import { POST as ChatPOST } from '../chat/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return new Response(
    JSON.stringify({ ok: true, route: '/api/jcil-chat' }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

export async function POST(req: NextRequest) {
  return ChatPOST(req);
}
