/**
 * ADMIN SETTINGS API
 * Handles saving and retrieving design settings using localStorage (client-side)
 * This API exists for compatibility but actual storage is client-side
 */

import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin-guard';
import { logger } from '@/lib/logger';
import { successResponse, errors, checkRequestRateLimit, rateLimits } from '@/lib/api/utils';

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

    // Just validate the structure
    const settings: DesignSettings = {
      mainLogo: body.mainLogo || DEFAULT_SETTINGS.mainLogo,
      headerLogo: body.headerLogo || DEFAULT_SETTINGS.headerLogo,
      loginLogo: body.loginLogo || DEFAULT_SETTINGS.loginLogo,
      favicon: body.favicon || DEFAULT_SETTINGS.favicon,
      siteName: body.siteName || DEFAULT_SETTINGS.siteName,
      subtitle: body.subtitle || DEFAULT_SETTINGS.subtitle,
    };

    return successResponse({
      success: true,
      settings,
    });
  } catch (error) {
    log.error('Error validating settings:', error instanceof Error ? error : { error });
    return errors.serverError();
  }
}
