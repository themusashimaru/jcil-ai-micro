/**
 * CODE LAB DEPLOY API
 *
 * DEPRECATED: Custom deploy functions have been removed.
 * All deployment operations now go through Composio connectors:
 * - Vercel: composio_VERCEL_CREATE_DEPLOYMENT, composio_VERCEL_CREATE_PROJECT, etc.
 * - Cloudflare: composio_CLOUDFLARE_* tools
 *
 * Users should connect their deployment platforms via the Connectors panel
 * (Composio OAuth) and use AI chat to trigger deployments.
 *
 * For Netlify and Railway: connect via Composio when available,
 * or use their respective CLI tools in the terminal.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { validateCSRF } from '@/lib/security/csrf';
import { logger } from '@/lib/logger';
import { errors } from '@/lib/api/utils';

const log = logger('DeployAPI');

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const csrfCheck = validateCSRF(request);
  if (!csrfCheck.valid) return csrfCheck.response!;

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return errors.unauthorized();
  }

  const { platform } = (await request.json()) as { platform?: string };

  log.info('Deploy API called - redirecting to Composio connectors', { platform, userId: user.id });

  return NextResponse.json(
    {
      success: false,
      error:
        `Direct ${platform || 'platform'} deployment has been replaced by Composio connectors. ` +
        `Please connect your ${platform || 'deployment platform'} account in the Connectors panel and use the AI chat to deploy. ` +
        `For example, ask: "Deploy my project to ${platform || 'Vercel'}"`,
      code: 'USE_COMPOSIO_CONNECTOR',
      migration: {
        vercel: 'Connect Vercel in Connectors panel → use composio_VERCEL_CREATE_DEPLOYMENT',
        cloudflare: 'Connect Cloudflare in Connectors panel → use composio_CLOUDFLARE_* tools',
        netlify: 'Use Netlify CLI in the terminal, or connect via Composio when available',
        railway: 'Use Railway CLI in the terminal, or connect via Composio when available',
      },
    },
    { status: 410 }
  );
}

export async function GET(request: NextRequest) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return errors.unauthorized();
  }

  const { searchParams } = new URL(request.url);
  const platform = searchParams.get('platform');

  return NextResponse.json(
    {
      error:
        `Deployment status checks now use Composio connectors. ` +
        `Connect your ${platform || 'platform'} account in the Connectors panel.`,
      code: 'USE_COMPOSIO_CONNECTOR',
    },
    { status: 410 }
  );
}
