/**
 * PROVIDER SETTINGS API
 *
 * GET - Get current provider settings (any authenticated user)
 * PUT - Update provider settings (admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server-auth';
import { requireAdmin } from '@/lib/auth/admin-guard';

export const dynamic = 'force-dynamic';

// Default provider settings
const DEFAULT_SETTINGS = {
  active_provider: 'openai',
  provider_config: {
    openai: { model: 'gpt-5-mini' },
    anthropic: { model: 'claude-sonnet-4-5-20250929' },
  },
};

/**
 * GET - Get current provider settings
 * Returns provider settings for the chat client
 */
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();

    // Check if user is authenticated
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get provider settings from database
    const { data: settings, error } = await supabase
      .from('provider_settings')
      .select('*')
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('[Provider API] Error fetching settings:', error);
      return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
    }

    // Return settings or defaults
    return NextResponse.json({
      activeProvider: settings?.active_provider || DEFAULT_SETTINGS.active_provider,
      providerConfig: settings?.provider_config || DEFAULT_SETTINGS.provider_config,
      updatedAt: settings?.updated_at,
    });
  } catch (error) {
    console.error('[Provider API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT - Update provider settings (admin only)
 */
export async function PUT(request: NextRequest) {
  try {
    // Require admin authentication with CSRF check
    const auth = await requireAdmin(request);
    if (!auth.authorized) return auth.response;

    const supabase = await createServerSupabaseClient();
    const body = await request.json();

    const { activeProvider, providerConfig } = body;

    // Validate provider
    if (activeProvider && !['openai', 'anthropic'].includes(activeProvider)) {
      return NextResponse.json(
        { error: 'Invalid provider. Must be "openai" or "anthropic"' },
        { status: 400 }
      );
    }

    // Build update object
    const updateData: {
      active_provider?: string;
      provider_config?: object;
      updated_by: string;
      updated_at: string;
    } = {
      updated_by: auth.user.id,
      updated_at: new Date().toISOString(),
    };

    if (activeProvider) {
      updateData.active_provider = activeProvider;
    }

    if (providerConfig) {
      updateData.provider_config = providerConfig;
    }

    // First, check if a row exists
    const { data: existing } = await supabase
      .from('provider_settings')
      .select('id')
      .single();

    let settings;
    if (existing) {
      // Update existing row
      const { data, error } = await supabase
        .from('provider_settings')
        .update(updateData)
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        console.error('[Provider API] Error updating settings:', error);
        return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
      }
      settings = data;
    } else {
      // Insert new row
      const { data, error } = await supabase
        .from('provider_settings')
        .insert({
          ...updateData,
          active_provider: activeProvider || DEFAULT_SETTINGS.active_provider,
          provider_config: providerConfig || DEFAULT_SETTINGS.provider_config,
        })
        .select()
        .single();

      if (error) {
        console.error('[Provider API] Error inserting settings:', error);
        return NextResponse.json({ error: 'Failed to create settings' }, { status: 500 });
      }
      settings = data;
    }

    console.log('[Provider API] Settings updated:', {
      provider: settings.active_provider,
      by: auth.user.email,
    });

    return NextResponse.json({
      success: true,
      activeProvider: settings.active_provider,
      providerConfig: settings.provider_config,
      updatedAt: settings.updated_at,
    });
  } catch (error) {
    console.error('[Provider API] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
