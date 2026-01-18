/**
 * Dismiss Passkey Prompt API
 * POST /api/user/dismiss-passkey-prompt
 */

import { createClient } from '@supabase/supabase-js';
import { getServerSession } from '@/lib/supabase/server-auth';
import { logger } from '@/lib/logger';
import { successResponse, errors, checkRequestRateLimit, rateLimits } from '@/lib/api/utils';

const log = logger('DismissPasskeyPrompt');

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Create Supabase client inside functions to avoid build-time initialization
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase configuration');
  }

  return createClient(supabaseUrl, supabaseServiceKey);
}

export async function POST() {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return errors.unauthorized();
    }

    // Rate limit by user
    const rateLimitResult = await checkRequestRateLimit(
      `passkey:dismiss:${session.user.id}`,
      rateLimits.standard
    );
    if (!rateLimitResult.allowed) return rateLimitResult.response;

    const supabase = getSupabaseAdmin();
    // Update user's passkey prompt dismissed flag
    await supabase
      .from('users')
      .update({ passkey_prompt_dismissed: true })
      .eq('id', session.user.id);

    return successResponse({ success: true });
  } catch (error) {
    log.error('Failed to dismiss passkey prompt:', error instanceof Error ? error : { error });
    return errors.serverError();
  }
}
