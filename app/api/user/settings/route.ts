/**
 * User Settings API
 *
 * GET - Get current user's settings
 * PUT - Update current user's settings
 */

import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
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
import { userSettingsSchema } from '@/lib/validation/schemas';

const log = logger('UserSettings');

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
      },
    }
  );
}

export async function GET(_request: NextRequest) {
  const supabase = await getSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return errors.unauthorized();
  }

  // Rate limiting by user
  const rateLimitCheck = await checkRequestRateLimit(
    `settings:get:${user.id}`,
    rateLimits.standard
  );
  if (!rateLimitCheck.allowed) return rateLimitCheck.response;

  // Get user settings
  const { data: settings, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', user.id)
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
  // CSRF Protection
  const csrfCheck = validateCSRF(request);
  if (!csrfCheck.valid) return csrfCheck.response!;

  const supabase = await getSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return errors.unauthorized();
  }

  // Rate limiting by user
  const rateLimitCheck = await checkRequestRateLimit(
    `settings:put:${user.id}`,
    rateLimits.standard
  );
  if (!rateLimitCheck.allowed) return rateLimitCheck.response;

  // Validate request body
  const bodyValidation = await validateBody(request, userSettingsSchema);
  if (!bodyValidation.success) return bodyValidation.response;

  const { theme } = bodyValidation.data;

  // Validate theme - light mode is admin only for now
  if (theme === 'light') {
    // Check if user is admin (using admin_users table)
    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!adminUser) {
      return errors.forbidden('Light mode is currently only available for admins');
    }
  }

  // Upsert settings
  const { data: settings, error } = await supabase
    .from('user_settings')
    .upsert(
      {
        user_id: user.id,
        theme: theme || 'dark',
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id',
      }
    )
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
