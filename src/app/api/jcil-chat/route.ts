// src/app/api/jcil-chat/route.ts
// this is just a thin wrapper around the main /api/chat logic

import type { NextRequest } from 'next/server';
import { POST as ChatPOST } from '../chat/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// keep GET super simple so we can test from the browser
export async function GET() {
  return new Response(
    JSON.stringify({ ok: true, route: '/api/jcil-chat' }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

// forward POST to the real chat handler
export async function POST(req: NextRequest) {
  return ChatPOST(req);
}
