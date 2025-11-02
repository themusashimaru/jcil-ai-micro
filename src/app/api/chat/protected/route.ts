// src/app/api/chat/protected/route.ts

import type { NextRequest } from 'next/server';
import { GET as baseGET, POST as basePOST } from '../route';

// declare locally – DO NOT re-export from another file
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// just forward to the main chat route
export async function GET(req: NextRequest) {
  return baseGET(req);
}

export async function POST(req: NextRequest) {
  return basePOST(req);
}
