/**
 * User Settings API
 *
 * GET - Get current user's settings
 * PUT - Update current user's settings
 */

import { NextRequest } from 'next/server';
import { requireUser } from '@/lib/auth/user-guard';
import { logger } from '@/lib/logger';
import {
  successResponse,
  errors,
  validateBody,
  checkRequestRateLimit,
  rateLimits,
} from '@/lib/api/utils';
import { userSettingsSchema } from '@/lib/validation/schemas';

const log = logger('UserSettings');

export async function GET() {
  const auth = await requireUser();
  if (!auth.authorized) return auth.response;

  // Rate limiting by user
  const rateLimitCheck = await checkRequestRateLimit(
    `settings:get:${auth.user.id}`,
    rateLimits.standard
  );
  if (!rateLimitCheck.allowed) return rateLimitCheck.response;

  // Get user settings
  const { data: settings, error } = await auth.supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', auth.user.id)
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = no rows found
    log.error(
      '[User Settings] Error fetching settings:',
      error instanceof Error ? error : { error }
    );
    return errors.serverError();
  }

  // Return settings or defaults
  return successResponse({
    settings: settings || {
      theme: 'dark',
    },
  });
}

export async function PUT(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.authorized) return auth.response;

  // Rate limiting by user
  const rateLimitCheck = await checkRequestRateLimit(
    `settings:put:${auth.user.id}`,
    rateLimits.standard
  );
  if (!rateLimitCheck.allowed) return rateLimitCheck.response;

  // Validate request body
  const bodyValidation = await validateBody(request, userSettingsSchema);
  if (!bodyValidation.success) return bodyValidation.response;

  const { theme, custom_instructions } = bodyValidation.data;

  // Validate theme - light mode is admin only for now
  if (theme === 'light') {
    // Check if user is admin (using admin_users table)
    const { data: adminUser } = await auth.supabase
      .from('admin_users')
      .select('id')
      .eq('user_id', auth.user.id)
      .single();

    if (!adminUser) {
      return errors.forbidden('Light mode is currently only available for admins');
    }
  }

  // Build upsert payload (only include fields that were provided)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const upsertData: Record<string, any> = {
    user_id: auth.user.id,
    theme: theme || 'dark',
    updated_at: new Date().toISOString(),
  };
  if (custom_instructions !== undefined) {
    upsertData.custom_instructions = custom_instructions;
  }

  // Upsert settings
  const { data: settings, error } = await auth.supabase
    .from('user_settings')
    .upsert(upsertData, {
      onConflict: 'user_id',
    })
    .select()
    .single();

  if (error) {
    log.error(
      '[User Settings] Error updating settings:',
      error instanceof Error ? error : { error }
    );
    return errors.serverError();
  }

  return successResponse({ settings });
}
