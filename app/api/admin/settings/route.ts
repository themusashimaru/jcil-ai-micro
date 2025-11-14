/**
 * ADMIN SETTINGS API
 * PURPOSE: Save and load branding/design settings from Supabase
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

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

// GET - Load current branding settings (PUBLIC - no auth required)
export async function GET() {
  try {
    const supabase = await getSupabaseClient();

    // Fetch branding settings (should only be one row)
    // No auth required - everyone can see the branding
    const { data: settings, error } = await supabase
      .from('branding_settings')
      .select('*')
      .limit(1)
      .single();

    if (error) {
      console.error('[Admin Settings] Error fetching settings:', error);
      // Return default settings if database fetch fails
      return NextResponse.json({
        success: true,
        settings: {
          main_logo: '/images/logo.png',
          header_logo: '',
          login_logo: '',
          favicon: '',
          site_name: 'JCIL.AI',
          subtitle: 'Faith-based AI tools for your everyday needs',
        },
      });
    }

    return NextResponse.json({
      success: true,
      settings: settings || {
        main_logo: '/images/logo.png',
        header_logo: '',
        login_logo: '',
        favicon: '',
        site_name: 'JCIL.AI',
        subtitle: 'Faith-based AI tools for your everyday needs',
      },
    });
  } catch (error) {
    console.error('[Admin Settings] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Save branding settings
export async function POST(request: NextRequest) {
  try {
    const supabase = await getSupabaseClient();

    // Check authentication and admin status
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const { data: userData } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (!userData?.is_admin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get settings from request body
    const body = await request.json();
    const { mainLogo, headerLogo, loginLogo, favicon, siteName, subtitle } = body;

    // Fetch the existing row (there should only be one)
    const { data: existing } = await supabase
      .from('branding_settings')
      .select('id')
      .limit(1)
      .single();

    let result;

    if (existing) {
      // Update existing row
      result = await supabase
        .from('branding_settings')
        .update({
          main_logo: mainLogo,
          header_logo: headerLogo,
          login_logo: loginLogo,
          favicon: favicon,
          site_name: siteName,
          subtitle: subtitle,
          updated_by: user.id,
        })
        .eq('id', existing.id);
    } else {
      // Insert new row (shouldn't normally happen, but handle it)
      result = await supabase.from('branding_settings').insert({
        main_logo: mainLogo,
        header_logo: headerLogo,
        login_logo: loginLogo,
        favicon: favicon,
        site_name: siteName,
        subtitle: subtitle,
        updated_by: user.id,
      });
    }

    if (result.error) {
      console.error('[Admin Settings] Error saving settings:', result.error);
      return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Settings saved successfully',
    });
  } catch (error) {
    console.error('[Admin Settings] POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
