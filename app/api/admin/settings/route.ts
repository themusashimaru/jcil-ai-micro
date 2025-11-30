/**
 * ADMIN SETTINGS API
 * Handles saving and retrieving design settings using localStorage (client-side)
 * This API exists for compatibility but actual storage is client-side
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/admin-guard';

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

  return NextResponse.json(DEFAULT_SETTINGS);
}

// POST - Acknowledge save (actual save happens in localStorage on client)
export async function POST(request: NextRequest) {
  try {
    // Require admin authentication with CSRF check
    const auth = await requireAdmin(request);
    if (!auth.authorized) return auth.response;

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

    return NextResponse.json({
      success: true,
      settings,
    });
  } catch (error) {
    console.error('Error validating settings:', error);
    return NextResponse.json(
      { error: 'Failed to validate settings' },
      { status: 500 }
    );
  }
}
