/**
 * Test route to verify strategy API is accessible
 * GET /api/strategy/test
 *
 * PROTECTED: Requires admin authentication
 */

import { NextRequest } from 'next/server';
import { successResponse } from '@/lib/api/utils';
import { requireAdmin } from '@/lib/auth/admin-guard';

export async function GET() {
  // Require admin auth
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.response;

  return successResponse({
    ok: true,
    message: 'Strategy API is accessible',
    timestamp: new Date().toISOString(),
    authenticatedAs: auth.user.email,
  });
}

export async function POST(request: NextRequest) {
  // Require admin auth with CSRF protection
  const auth = await requireAdmin(request);
  if (!auth.authorized) return auth.response;

  return successResponse({
    ok: true,
    message: 'Strategy API POST is working',
    testSessionId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    authenticatedAs: auth.user.email,
  });
}
