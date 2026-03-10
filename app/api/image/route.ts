/**
 * IMAGE GENERATION API - DISCONTINUED
 *
 * This feature has been removed from the platform.
 * Returns 410 Gone for all requests.
 */

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST() {
  return NextResponse.json(
    {
      error: 'Feature discontinued',
      message: 'Image generation has been discontinued. Please use our AI chat, fact-checking, and document creation features instead.',
    },
    { status: 410 }
  );
}

export async function GET() {
  return NextResponse.json(
    {
      error: 'Feature discontinued',
      message: 'Image generation has been discontinued.',
    },
    { status: 410 }
  );
}
