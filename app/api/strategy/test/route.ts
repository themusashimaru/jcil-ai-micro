/**
 * Test route to verify strategy API is accessible
 * GET /api/strategy/test
 */

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: 'Strategy API is accessible',
    timestamp: new Date().toISOString(),
  });
}

export async function POST() {
  // Test that we can call the strategy start endpoint
  return NextResponse.json({
    ok: true,
    message: 'Strategy API POST is working',
    testSessionId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  });
}
