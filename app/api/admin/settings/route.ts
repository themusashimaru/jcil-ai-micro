/**
 * ADMIN SETTINGS API
 * Handles saving and retrieving design settings using localStorage (client-side)
 * This API exists for compatibility but actual storage is client-side
 */

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin-guard';
import { logger } from '@/lib/logger';
import {
  successResponse,
  errors,
  checkRequestRateLimit,
  rateLimits,
  captureAPIError,
} from '@/lib/api/utils';
import {
  designSettingsSchema,
  validateBody,
  validationErrorResponse,
} from '@/lib/validation/schemas';

const log = logger('AdminSettings');

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface DesignSettings {
  mainLogo: string;
  headerLogo: string;
  loginLogo: string;
  favicon: string;
  siteName: string;
  subtitle: string;
}

const DEFAULT_SETTINGS: DesignSettings = {
  mainLogo: '/images/logo.png',
  headerLogo: '',
  loginLogo: '',
  favicon: '/favicon.ico',
  siteName: 'JCIL.ai',
  subtitle: 'Faith-based AI tools for your everyday needs',
};

// GET - Return default settings (actual settings loaded from localStorage on client)
export async function GET() {
  // Require admin authentication
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.response;

  // Rate limit by admin
  const rateLimitResult = await checkRequestRateLimit(
    `admin:settings:get:${auth.user.id}`,
    rateLimits.admin
  );
  if (!rateLimitResult.allowed) return rateLimitResult.response;

  return successResponse(DEFAULT_SETTINGS);
}

// POST - Acknowledge save (actual save happens in localStorage on client)
export async function POST(request: NextRequest) {
  try {
    // Require admin authentication with CSRF check
    const auth = await requireAdmin(request);
    if (!auth.authorized) return auth.response;

    // Rate limit by admin
    const rateLimitResult = await checkRequestRateLimit(
      `admin:settings:post:${auth.user.id}`,
      rateLimits.admin
    );
    if (!rateLimitResult.allowed) return rateLimitResult.response;

    const body = await request.json();

    // Validate with Zod schema
    const validation = validateBody(designSettingsSchema, body);
    if (!validation.success) {
      return errors.badRequest(
        validationErrorResponse(validation.error, validation.details).message
      );
    }

    const settings: DesignSettings = {
      mainLogo: validation.data.mainLogo || DEFAULT_SETTINGS.mainLogo,
      headerLogo: validation.data.headerLogo || DEFAULT_SETTINGS.headerLogo,
      loginLogo: validation.data.loginLogo || DEFAULT_SETTINGS.loginLogo,
      favicon: validation.data.favicon || DEFAULT_SETTINGS.favicon,
      siteName: validation.data.siteName || DEFAULT_SETTINGS.siteName,
      subtitle: validation.data.subtitle || DEFAULT_SETTINGS.subtitle,
    };

    return successResponse({
      success: true,
      settings,
    });
  } catch (error) {
    log.error('Error validating settings:', error instanceof Error ? error : { error });
    captureAPIError(error, '/api/admin/settings');
    return errors.serverError();
  }
}
