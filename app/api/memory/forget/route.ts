/**
 * MEMORY FORGET API
 *
 * Targeted deletion of specific memory items (GDPR right to targeted erasure).
 * Allows users to selectively forget specific facts without clearing all memory.
 *
 * POST /api/memory/forget - Forget specific topics, preferences, or clear summary
 *
 * @module api/memory/forget
 * @version 1.0.0
 */

import { createServerClient } from '@supabase/ssr';
import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { validateCSRF } from '@/lib/security/csrf';
import { logger } from '@/lib/logger';
import {
  successResponse,
  errors,
  validateBody,
  checkRequestRateLimit,
  rateLimits,
} from '@/lib/api/utils';
import { forgetFromMemory } from '@/lib/memory';
import { z } from 'zod';

const log = logger('MemoryForgetAPI');

export const runtime = 'nodejs';
export const maxDuration = 30;

// Schema for forget request
const forgetSchema = z
  .object({
    topics: z.array(z.string().max(100)).max(50).optional(),
    preference_keys: z.array(z.string().max(100)).max(20).optional(),
    clear_summary: z.boolean().optional(),
  })
  .refine((data) => data.topics?.length || data.preference_keys?.length || data.clear_summary, {
    message: 'At least one of topics, preference_keys, or clear_summary must be specified',
  });

// Get authenticated Supabase client
async function getSupabaseClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Silently handle cookie errors
          }
        },
      },
    }
  );
}

/**
 * POST /api/memory/forget
 * Forget specific items from memory
 *
 * Request body:
 * - topics: string[] - Topics to remove from memory
 * - preference_keys: string[] - Preference keys to remove (e.g., "name", "occupation")
 * - clear_summary: boolean - Whether to clear conversation history summary
 *
 * At least one of these must be specified.
 */
export async function POST(request: NextRequest) {
  // CSRF Protection
  const csrfCheck = validateCSRF(request);
  if (!csrfCheck.valid) return csrfCheck.response!;

  try {
    const supabase = await getSupabaseClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return errors.unauthorized();
    }

    // Rate limiting (moderate limit for targeted deletion)
    const rateLimitResult = checkRequestRateLimit(`memory-forget:${user.id}`, {
      ...rateLimits.standard,
      limit: 30,
    });
    if (!rateLimitResult.allowed) return rateLimitResult.response;

    // Validate request body
    const validation = await validateBody(request, forgetSchema);
    if (!validation.success) return validation.response;

    const { topics, preference_keys, clear_summary } = validation.data;

    // Perform targeted deletion
    const result = await forgetFromMemory(user.id, {
      topics,
      preferenceKeys: preference_keys,
      clearSummary: clear_summary,
    });

    if (!result.success) {
      log.error('Failed to forget from memory', { error: result.error });
      return errors.serverError();
    }

    if (result.removed.length > 0) {
      log.info('User forgot specific memory items', {
        userId: user.id,
        removed: result.removed,
      });
    }

    return successResponse({
      success: true,
      removed: result.removed,
      message:
        result.removed.length > 0
          ? `Successfully removed: ${result.removed.join(', ')}`
          : 'No matching items found to remove',
    });
  } catch (error) {
    log.error('Error in forget endpoint', error as Error);
    return errors.serverError();
  }
}
