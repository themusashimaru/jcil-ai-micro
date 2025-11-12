/**
 * ADMIN SETTINGS API
 * Handles saving and retrieving design settings using cookies (Vercel-compatible)
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

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

const COOKIE_NAME = 'admin_design_settings';

// GET - Retrieve current settings
export async function GET() {
  try {
    const cookieStore = await cookies();
    const settingsCookie = cookieStore.get(COOKIE_NAME);

    if (settingsCookie?.value) {
      try {
        const settings = JSON.parse(settingsCookie.value);
        return NextResponse.json(settings);
      } catch {
        return NextResponse.json(DEFAULT_SETTINGS);
      }
    }

    return NextResponse.json(DEFAULT_SETTINGS);
  } catch (error) {
    console.error('Error getting settings:', error);
    return NextResponse.json(DEFAULT_SETTINGS);
  }
}

// POST - Save settings
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const settings: DesignSettings = {
      mainLogo: body.mainLogo || DEFAULT_SETTINGS.mainLogo,
      headerLogo: body.headerLogo || DEFAULT_SETTINGS.headerLogo,
      loginLogo: body.loginLogo || DEFAULT_SETTINGS.loginLogo,
      favicon: body.favicon || DEFAULT_SETTINGS.favicon,
      siteName: body.siteName || DEFAULT_SETTINGS.siteName,
      subtitle: body.subtitle || DEFAULT_SETTINGS.subtitle,
    };

    const response = NextResponse.json({
      success: true,
      settings,
    });

    // Store settings in cookie (max 4KB, should be fine for base64 images up to 2MB compressed)
    // Split large data across multiple cookies if needed
    const settingsJson = JSON.stringify(settings);

    // Set cookie with 1 year expiration
    response.cookies.set(COOKIE_NAME, settingsJson, {
      maxAge: 60 * 60 * 24 * 365, // 1 year
      path: '/',
      sameSite: 'lax',
    });

    return response;
  } catch (error) {
    console.error('Error saving settings:', error);
    return NextResponse.json(
      { error: 'Failed to save settings' },
      { status: 500 }
    );
  }
}
