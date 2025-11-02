// src/app/api/chat/protected/route.ts
// thin wrapper around the main /api/chat route

import { NextRequest } from 'next/server';
import { GET as ChatGET, POST as ChatPOST } from '../route';

// Next 16 wants these declared in THIS file (not re-exported)
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  // parent /api/chat GET doesn’t take args
  return ChatGET();
}

export async function POST(req: NextRequest) {
  // parent /api/chat POST DOES take the request
  return ChatPOST(req);
}
