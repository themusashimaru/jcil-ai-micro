/**
 * ADMIN SETTINGS API
 * Handles saving and retrieving design settings from Supabase database
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
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

// GET - Fetch settings from Supabase
export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
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
              // Cookie operations may fail
            }
          },
        },
      }
    );

    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .single();

    if (error) {
      console.error('Error fetching settings:', error);
      return NextResponse.json(DEFAULT_SETTINGS);
    }

    // Map database fields to frontend format
    const settings: DesignSettings = {
      mainLogo: data.sidebar_logo || DEFAULT_SETTINGS.mainLogo,
      headerLogo: data.header_logo || DEFAULT_SETTINGS.headerLogo,
      loginLogo: data.login_logo || DEFAULT_SETTINGS.loginLogo,
      favicon: data.favicon || DEFAULT_SETTINGS.favicon,
      siteName: data.site_name || DEFAULT_SETTINGS.siteName,
      subtitle: data.site_tagline || DEFAULT_SETTINGS.subtitle,
    };

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error in GET /api/admin/settings:', error);
    return NextResponse.json(DEFAULT_SETTINGS);
  }
}

// POST - Save settings to Supabase
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
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
              // Cookie operations may fail
            }
          },
        },
      }
    );
    const body = await request.json();

    // Map frontend format to database fields
    const { error } = await supabase
      .from('settings')
      .update({
        header_logo: body.headerLogo,
        sidebar_logo: body.mainLogo,
        login_logo: body.loginLogo,
        favicon: body.favicon,
        site_name: body.siteName,
        site_tagline: body.subtitle,
      })
      .eq('id', '00000000-0000-0000-0000-000000000001');

    if (error) {
      console.error('Error saving settings:', error);
      return NextResponse.json(
        { error: 'Failed to save settings to database' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Settings saved successfully',
    });
  } catch (error) {
    console.error('Error in POST /api/admin/settings:', error);
    return NextResponse.json(
      { error: 'Failed to save settings' },
      { status: 500 }
    );
  }
}
