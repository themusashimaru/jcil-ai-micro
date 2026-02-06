/**
 * COMPOSIO TOOLKITS API
 * =====================
 *
 * GET: List all available toolkits (500+)
 * Supports search, category filtering, and pagination
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Force dynamic for search params and auth
export const dynamic = 'force-dynamic';
import { createServerClient } from '@supabase/ssr';
import {
  ALL_TOOLKITS,
  POPULAR_TOOLKITS,
  getToolkitsByCategory,
  isComposioConfigured,
  getConnectedAccounts,
} from '@/lib/composio';
import type { ToolkitCategory } from '@/lib/composio';

// Helper to get Supabase client and user
async function getAuthenticatedUser() {
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
            /* ignore */
          }
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/**
 * GET - List toolkits with optional filters
 *
 * Query params:
 * - search: Search by name/description
 * - category: Filter by category
 * - popular: true to only show popular
 * - connected: true to show connection status
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search')?.toLowerCase();
    const category = searchParams.get('category') as ToolkitCategory | null;
    const popularOnly = searchParams.get('popular') === 'true';
    const showConnected = searchParams.get('connected') === 'true';

    // Start with all toolkits
    let toolkits = popularOnly ? POPULAR_TOOLKITS : ALL_TOOLKITS;

    // Filter by category
    if (category) {
      toolkits = getToolkitsByCategory(category);
    }

    // Filter by search
    if (search) {
      toolkits = toolkits.filter(
        (t) =>
          t.displayName.toLowerCase().includes(search) ||
          t.description.toLowerCase().includes(search) ||
          t.id.toLowerCase().includes(search)
      );
    }

    // Enrich with connection status if requested
    let enrichedToolkits = toolkits.map((t) => ({
      ...t,
      connected: false,
      connectionId: null as string | null,
    }));

    if (showConnected && isComposioConfigured()) {
      const user = await getAuthenticatedUser();
      if (user) {
        const connectedAccounts = await getConnectedAccounts(user.id);
        const connectedMap = new Map(
          connectedAccounts.map((a) => [a.toolkit.toUpperCase(), a])
        );

        enrichedToolkits = enrichedToolkits.map((t) => {
          const connection = connectedMap.get(t.id.toUpperCase());
          return {
            ...t,
            connected: connection?.status === 'connected',
            connectionId: connection?.id || null,
          };
        });
      }
    }

    // Group by category for UI
    const grouped = {
      popular: enrichedToolkits.filter((t) => t.popular),
      communication: enrichedToolkits.filter((t) => t.category === 'communication'),
      productivity: enrichedToolkits.filter((t) => t.category === 'productivity'),
      social: enrichedToolkits.filter((t) => t.category === 'social'),
      development: enrichedToolkits.filter((t) => t.category === 'development'),
      crm: enrichedToolkits.filter((t) => t.category === 'crm'),
      finance: enrichedToolkits.filter((t) => t.category === 'finance'),
      calendar: enrichedToolkits.filter((t) => t.category === 'calendar'),
      storage: enrichedToolkits.filter((t) => t.category === 'storage'),
    };

    return NextResponse.json({
      toolkits: enrichedToolkits,
      grouped,
      total: enrichedToolkits.length,
      configured: isComposioConfigured(),
    });
  } catch (error) {
    console.error('Failed to get toolkits:', error);
    return NextResponse.json(
      { error: 'Failed to get toolkits' },
      { status: 500 }
    );
  }
}
