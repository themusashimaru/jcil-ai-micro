/**
 * COMPOSIO EXECUTE API
 * ====================
 *
 * POST: Execute a Composio tool action
 * Used by AI agents to perform actions on behalf of users
 */

import { NextRequest } from 'next/server';
import { successResponse, errors } from '@/lib/api/utils';
import { executeTool, isComposioConfigured } from '@/lib/composio';
import { requireUser } from '@/lib/auth/user-guard';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const log = logger('ComposioExecuteAPI');

export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser(request);
    if (!auth.authorized) return auth.response;
    const user = auth.user;

    // Check Composio configured
    if (!isComposioConfigured()) {
      return errors.serviceUnavailable('Composio is not configured');
    }

    // Parse request
    const body = await request.json();
    const { action, params } = body;

    if (!action) {
      return errors.badRequest('action is required');
    }

    // Execute tool
    const result = await executeTool(user.id, action, params || {});

    if (result.success) {
      log.info('Tool executed', {
        userId: user.id,
        action,
      });
      return successResponse({
        success: true,
        data: result.data,
      });
    } else {
      log.warn('Tool execution failed', {
        userId: user.id,
        action,
        error: result.error,
      });
      return errors.serverError('Execution failed');
    }
  } catch (error) {
    log.error('Execute API error', { error });
    return errors.serverError('Execution failed');
  }
}
