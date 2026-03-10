/**
 * ONE-CLICK DEPLOY API
 *
 * DEPRECATED: Custom deploy functions have been removed.
 * All deployment operations now go through Composio connectors:
 * - Vercel: composio_VERCEL_CREATE_DEPLOYMENT, composio_VERCEL_CREATE_PROJECT
 * - Cloudflare: composio_CLOUDFLARE_* tools
 *
 * Users should connect deployment platforms via the Connectors panel
 * (Composio OAuth) and use AI chat to trigger deployments.
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(_request: NextRequest) {
  return NextResponse.json(
    {
      error:
        'Direct deployment has been replaced by Composio connectors. ' +
        'Please connect your deployment platform in the Connectors panel and use the AI chat to deploy.',
      code: 'USE_COMPOSIO_CONNECTOR',
    },
    { status: 410 }
  );
}
