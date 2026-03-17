/**
 * STRATEGY AGENT API — DEPRECATED
 *
 * Agent orchestration has been replaced by the skills system.
 * This route returns deprecation notices for any residual callers.
 *
 * Deprecated: 2026-03-17
 * Replacement: Skills system via /forensic-intake, /deep-research, /deep-strategy
 */

import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

const DEPRECATION_RESPONSE = JSON.stringify({
  error:
    'Agent system deprecated — use skills instead (/deep-research, /deep-strategy, /forensic-intake)',
  code: 'DEPRECATED',
  migration:
    'Skills replace agents with direct Opus tool calling. See CTO_AGENT_TO_SKILLS_STRATEGY.md.',
});

const HEADERS = { 'Content-Type': 'application/json' };

export async function POST(_request: NextRequest) {
  return new Response(DEPRECATION_RESPONSE, { status: 410, headers: HEADERS });
}

export async function DELETE(_request: NextRequest) {
  return new Response(DEPRECATION_RESPONSE, { status: 410, headers: HEADERS });
}

export async function GET(_request: NextRequest) {
  return new Response(DEPRECATION_RESPONSE, { status: 410, headers: HEADERS });
}
