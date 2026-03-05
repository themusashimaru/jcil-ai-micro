/**
 * COMPOSIO ACCOUNTS API
 * =====================
 *
 * GET: List all connected accounts for current user
 * DELETE: Disconnect a specific account
 */

import { NextRequest } from 'next/server';
import { successResponse, errors } from '@/lib/api/utils';
import { requireUser } from '@/lib/auth/user-guard';

// Force dynamic for auth
export const dynamic = 'force-dynamic';
import {
  getConnectedAccounts,
  disconnectAccount,
  isComposioConfigured,
  getToolkitById,
} from '@/lib/composio';
import { logger } from '@/lib/logger';

const log = logger('ComposioAccountsAPI');

/**
 * GET - List all connected accounts
 */
export async function GET() {
  try {
    const auth = await requireUser();
    if (!auth.authorized) return auth.response;
    const { user } = auth;

    // Check Composio configured
    if (!isComposioConfigured()) {
      return successResponse({ accounts: [], configured: false });
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

    return successResponse({
      accounts: enrichedAccounts,
      configured: true,
    });
  } catch (error) {
    log.error('Failed to get connected accounts', { error });
    return errors.serverError('Failed to get accounts');
  }
}

/**
 * DELETE - Disconnect an account
 */
export async function DELETE(request: NextRequest) {
  try {
    // Auth + CSRF protection for DELETE
    const auth = await requireUser(request);
    if (!auth.authorized) return auth.response;
    const { user } = auth;

    // Get connectionId and toolkit from query params
    const searchParams = request.nextUrl.searchParams;
    const connectionId = searchParams.get('connectionId');
    const toolkit = searchParams.get('toolkit');

    if (!connectionId) {
      return errors.badRequest('connectionId is required');
    }

    // Disconnect - pass userId and toolkit to update local cache
    const success = await disconnectAccount(connectionId, user.id, toolkit || undefined);

    if (success) {
      log.info('Account disconnected', {
        userId: user.id,
        connectionId,
        toolkit,
      });
      return successResponse({ success: true });
    } else {
      return errors.serverError('Failed to disconnect');
    }
  } catch (error) {
    log.error('Failed to disconnect account', { error });
    return errors.serverError('Failed to disconnect');
  }
}
