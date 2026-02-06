/**
 * COMPOSIO ACCOUNTS API
 * =====================
 *
 * GET: List all connected accounts for current user
 * DELETE: Disconnect a specific account
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Force dynamic for auth
export const dynamic = 'force-dynamic';
import { createServerClient } from '@supabase/ssr';
import {
  getConnectedAccounts,
  disconnectAccount,
  isComposioConfigured,
  getToolkitById,
} from '@/lib/composio';
import { logger } from '@/lib/logger';

const log = logger('ComposioAccountsAPI');

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
 * GET - List all connected accounts
 */
export async function GET() {
  try {
    // Check auth
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check Composio configured
    if (!isComposioConfigured()) {
      return NextResponse.json({ accounts: [], configured: false });
    }

    // Get accounts
    const accounts = await getConnectedAccounts(user.id);

    // Enrich with toolkit info
    const enrichedAccounts = accounts.map((account) => {
      const toolkitConfig = getToolkitById(account.toolkit);
      return {
        ...account,
        displayName: toolkitConfig?.displayName || account.toolkit,
        icon: toolkitConfig?.icon || '🔌',
        description: toolkitConfig?.description || '',
      };
    });

    return NextResponse.json({
      accounts: enrichedAccounts,
      configured: true,
    });
  } catch (error) {
    log.error('Failed to get connected accounts', { error });
    return NextResponse.json(
      { error: 'Failed to get accounts' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Disconnect an account
 */
export async function DELETE(request: NextRequest) {
  try {
    // Check auth
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get connectionId from query params
    const searchParams = request.nextUrl.searchParams;
    const connectionId = searchParams.get('connectionId');

    if (!connectionId) {
      return NextResponse.json(
        { error: 'connectionId is required' },
        { status: 400 }
      );
    }

    // Disconnect
    const success = await disconnectAccount(connectionId);

    if (success) {
      log.info('Account disconnected', {
        userId: user.id,
        connectionId
      });
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { error: 'Failed to disconnect' },
        { status: 500 }
      );
    }
  } catch (error) {
    log.error('Failed to disconnect account', { error });
    return NextResponse.json(
      { error: 'Failed to disconnect' },
      { status: 500 }
    );
  }
}
