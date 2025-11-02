// src/app/api/chat/protected/route.ts
// thin wrapper around the main /api/chat route

import type { NextRequest } from 'next/server';
import { GET as ChatGET, POST as ChatPOST } from '../route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  return ChatGET();
}

export async function POST(req: NextRequest) {
  return ChatPOST(req);
}
