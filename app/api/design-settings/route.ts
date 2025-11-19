/**
 * DESIGN SETTINGS API
 * Get and save site-wide branding settings
 * GET: Public (anyone can read branding)
 * POST: Admin only (requires admin authentication)
 */

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET - Public endpoint to fetch current design settings
export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Fetch the single design settings row
    const { data, error } = await supabase
      .from('design_settings')
      .select('*')
      .limit(1)
      .single();

    if (error) {
      console.error('[Design Settings API] Error fetching settings:', error.code, error.message);

      // Return defaults for any error (table doesn't exist, no rows, etc.)
      return NextResponse.json({
        main_logo: '/images/logo.png',
        header_logo: '',
        login_logo: '',
        favicon: '',
        site_name: 'JCIL.ai',
        subtitle: 'Your AI Assistant',
        model_name: 'Slingshot 2.0',
      });
    }

    return NextResponse.json(data || {
      main_logo: '/images/logo.png',
      header_logo: '',
      login_logo: '',
      favicon: '',
      site_name: 'JCIL.ai',
      subtitle: 'Your AI Assistant',
      model_name: 'Slingshot 2.0',
    });
  } catch (error) {
    console.error('[Design Settings API] Error:', error);
    // Return defaults on any error
    return NextResponse.json({
      main_logo: '/images/logo.png',
      header_logo: '',
      login_logo: '',
      favicon: '',
      site_name: 'JCIL.ai',
      subtitle: 'Your AI Assistant',
      model_name: 'Slingshot 2.0',
    });
  }
}

// POST - Admin only endpoint to update design settings
export async function POST(request: NextRequest) {
  try {
    // Check admin authentication
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check if user is admin
    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!adminUser) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Parse request body
    const settings = await request.json();

    // Use service role key for update (admin operation)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Check if settings row exists
    const { data: existing } = await adminClient
      .from('design_settings')
      .select('id')
      .limit(1)
      .single();

    let result;

    if (existing) {
      // Update existing row
      result = await adminClient
        .from('design_settings')
        .update({
          main_logo: settings.mainLogo,
          header_logo: settings.headerLogo,
          login_logo: settings.loginLogo,
          favicon: settings.favicon,
          site_name: settings.siteName,
          subtitle: settings.subtitle,
          model_name: settings.modelName,
        })
        .eq('id', existing.id)
        .select()
        .single();
    } else {
      // Insert new row
      result = await adminClient
        .from('design_settings')
        .insert({
          main_logo: settings.mainLogo,
          header_logo: settings.headerLogo,
          login_logo: settings.loginLogo,
          favicon: settings.favicon,
          site_name: settings.siteName,
          subtitle: settings.subtitle,
          model_name: settings.modelName,
        })
        .select()
        .single();
    }

    if (result.error) {
      console.error('[Design Settings API] Error saving settings:', result.error);
      return NextResponse.json(
        { error: 'Failed to save settings', details: result.error.message },
        { status: 500 }
      );
    }

    console.log('[Admin Audit] Design settings updated by admin');

    return NextResponse.json({
      success: true,
      settings: result.data,
    });
  } catch (error) {
    console.error('[Design Settings API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
