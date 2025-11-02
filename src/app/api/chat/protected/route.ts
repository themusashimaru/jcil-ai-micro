// src/app/api/chat/protected/route.ts
// thin wrapper around the main /api/chat route
// Next 16 doesn't like re-exporting config, so we re-declare it here

import { NextRequest } from 'next/server';
import { GET as ChatGET, POST as ChatPOST } from '../route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  // main GET has no args
  return ChatGET();
}

export async function POST(req: NextRequest) {
  // main POST does take req
  return ChatPOST(req);
}
