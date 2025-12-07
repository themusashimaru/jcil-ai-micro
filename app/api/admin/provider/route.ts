/**
 * PROVIDER SETTINGS API
 *
 * GET - Get current provider settings (any authenticated user)
 * PUT - Update provider settings (admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server-auth';
import { requireAdmin } from '@/lib/auth/admin-guard';
import { clearProviderSettingsCache } from '@/lib/provider/settings';

export const dynamic = 'force-dynamic';

// Type for provider settings from database
interface ProviderSettingsRow {
  id: string;
  active_provider: string;
  provider_config: {
    openai?: { model: string };
    anthropic?: { model: string };
  };
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

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
    const { data, error } = await supabase
      .from('provider_settings')
      .select('*')
      .single();

    // Handle errors gracefully - return defaults if table doesn't exist or is empty
    if (error) {
      // PGRST116 = no rows found, 42P01 = table doesn't exist
      if (error.code === 'PGRST116' || error.code === '42P01' || error.message?.includes('does not exist')) {
        console.log('[Provider API] No settings found, returning defaults');
        return NextResponse.json({
          activeProvider: DEFAULT_SETTINGS.active_provider,
          providerConfig: DEFAULT_SETTINGS.provider_config,
          updatedAt: null,
        });
      }
      console.error('[Provider API] Error fetching settings:', error);
      return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
    }

    // Cast to proper type
    const settings = data as ProviderSettingsRow | null;

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
    const { data: existingData, error: checkError } = await supabase
      .from('provider_settings')
      .select('id')
      .single();

    // If table doesn't exist, return helpful error
    if (checkError && (checkError.code === '42P01' || checkError.message?.includes('does not exist'))) {
      console.error('[Provider API] Table does not exist - run migration');
      return NextResponse.json({
        error: 'Provider settings table not found. Please run the database migration: supabase/migrations/add_provider_settings_table.sql'
      }, { status: 500 });
    }

    const existing = existingData as { id: string } | null;
    let settings: ProviderSettingsRow | null = null;

    if (existing) {
      // Update existing row
      const { data, error } = await (supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from('provider_settings') as any)
        .update(updateData)
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        console.error('[Provider API] Error updating settings:', error);
        return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
      }
      settings = data as ProviderSettingsRow;
    } else {
      // Insert new row
      const { data, error } = await (supabase
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from('provider_settings') as any)
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
      settings = data as ProviderSettingsRow;
    }

    if (!settings) {
      return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
    }

    // Clear the settings cache so new requests use the updated settings immediately
    clearProviderSettingsCache();

    console.log('[Provider API] Settings updated:', {
      provider: settings.active_provider,
      config: settings.provider_config,
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
