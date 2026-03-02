/**
 * PROVIDER STATUS API
 *
 * Returns which AI providers are configured (have API keys set).
 * This allows the frontend to show which providers are available to users.
 *
 * Checks both:
 * 1. Platform-configured providers (from environment variables)
 * 2. User-configured providers (BYOK - from database)
 *
 * GET /api/providers/status
 * Response: {
 *   configured: ['claude', 'xai', ...],
 *   userConfigured: ['openai', 'deepseek'],
 *   default: 'claude'
 * }
 */

import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { getAvailableProviderIds } from '@/lib/ai/providers/registry';
import { logger } from '@/lib/logger';
import { successResponse, errors } from '@/lib/api/utils';

const log = logger('ProviderStatusAPI');

export async function GET() {
  try {
    // Get platform-configured providers (from env vars)
    const platformConfigured = getAvailableProviderIds();

    // Try to get user-configured providers (BYOK)
    let userConfigured: string[] = [];

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
                // Ignore errors in read-only contexts
              }
            },
          },
        }
      );

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const adminClient = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { autoRefreshToken: false, persistSession: false } }
        );

        const { data: prefs } = await adminClient
          .from('user_provider_preferences')
          .select('provider_api_keys')
          .eq('user_id', user.id)
          .single();

        if (prefs?.provider_api_keys) {
          const keys = prefs.provider_api_keys as Record<string, string>;
          userConfigured = Object.keys(keys).filter((k) => !!keys[k]);
        }
      }
    } catch {
      // If user lookup fails, just continue with platform providers
    }

    // Combine platform and user configured (deduplicated)
    const allConfigured = [...new Set([...platformConfigured, ...userConfigured])];

    // Default provider is Claude (or first available if Claude not configured)
    const defaultProvider = allConfigured.includes('claude')
      ? 'claude'
      : allConfigured[0] || 'claude';

    return successResponse({
      configured: allConfigured,
      platformConfigured,
      userConfigured,
      default: defaultProvider,
    });
  } catch (error) {
    log.error('Error fetching provider status:', error instanceof Error ? error : { error });
    return errors.serverError('Failed to fetch provider status');
  }
}
