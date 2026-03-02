/**
 * COMPOSIO CONNECT API
 * ====================
 *
 * POST: Initiate OAuth connection for a toolkit
 * Returns redirect URL for user to complete auth
 * Stores connectionId in cookie for callback to use
 */

import { NextRequest } from 'next/server';
import { successResponse, errors } from '@/lib/api/utils';
import { cookies } from 'next/headers';

// Force dynamic for auth
export const dynamic = 'force-dynamic';
import { createServerClient } from '@supabase/ssr';
import {
  initiateConnection,
  connectWithApiKey,
  isComposioConfigured,
  getToolkitById,
} from '@/lib/composio';
import { logger } from '@/lib/logger';

const log = logger('ComposioConnectAPI');

export async function POST(request: NextRequest) {
  try {
    // Get user from Supabase auth
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

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return errors.unauthorized();
    }

    // Check Composio configured
    if (!isComposioConfigured()) {
      return errors.serviceUnavailable('Composio is not configured');
    }

    // Parse request
    const body = await request.json();
    const { toolkit, redirectUrl, apiKey } = body;

    if (!toolkit) {
      return errors.badRequest('Toolkit is required');
    }

    // Validate toolkit exists
    const toolkitConfig = getToolkitById(toolkit.toUpperCase());
    if (!toolkitConfig) {
      log.warn('Unknown toolkit requested', { toolkit });
      // Still allow - Composio may have more than we've configured
    }

    // Use user's ID as the entity ID
    const userId = user.id;

    // Check if this is an API key connection
    if (apiKey) {
      // Validate that this toolkit actually uses API key auth
      if (toolkitConfig && toolkitConfig.authType !== 'api_key') {
        return errors.badRequest(
          `${toolkitConfig.displayName} uses OAuth, not API key authentication`
        );
      }

      log.info('Connecting with API key', { userId, toolkit });

      const result = await connectWithApiKey(userId, toolkit, apiKey);

      if (!result.success) {
        return errors.serverError(result.error || 'Failed to connect with API key');
      }

      log.info('API key connection successful', {
        userId,
        toolkit,
        connectionId: result.connectionId,
      });

      return successResponse({
        success: true,
        connectionId: result.connectionId,
        toolkit: toolkit.toUpperCase(),
        toolkitName: toolkitConfig?.displayName || toolkit,
        authType: 'api_key',
      });
    }

    // OAuth flow - check if this toolkit requires API key instead
    if (toolkitConfig && toolkitConfig.authType === 'api_key') {
      return errors.badRequest(`${toolkitConfig.displayName} requires an API key`);
    }

    // Build callback URL - validate it's a proper URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) {
      log.error('NEXT_PUBLIC_APP_URL not configured');
      return errors.serverError('Server configuration error - callback URL not available');
    }

    // SEC-011: Validate redirectUrl against app origin to prevent open redirect
    let callbackUrl: string;
    if (redirectUrl) {
      try {
        const redirectParsed = new URL(redirectUrl);
        const appParsed = new URL(appUrl);
        if (redirectParsed.origin !== appParsed.origin) {
          log.warn('Rejected cross-origin redirect URL', { redirectUrl, appUrl });
          return errors.badRequest('Invalid redirect URL');
        }
        callbackUrl = redirectUrl;
      } catch {
        return errors.badRequest('Invalid redirect URL format');
      }
    } else {
      callbackUrl = `${appUrl}/api/composio/callback?toolkit=${toolkit}`;
    }

    // Validate URL format before sending to Composio
    try {
      new URL(callbackUrl);
    } catch {
      log.error('Invalid callback URL', { callbackUrl, appUrl });
      return errors.serverError('Invalid callback URL configuration');
    }

    log.info('Initiating OAuth connection with callback URL', { callbackUrl, toolkit });

    // Initiate OAuth connection
    const connectionRequest = await initiateConnection(userId, toolkit, callbackUrl);

    log.info('OAuth connection initiated', {
      userId,
      toolkit,
      connectionId: connectionRequest.id,
    });

    // Store connectionId in cookie so callback can wait for it (reuse cookieStore from above)
    cookieStore.set('composio_connection_id', connectionRequest.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 300, // 5 minutes - should be enough for OAuth flow
      path: '/',
    });
    cookieStore.set('composio_connection_toolkit', toolkit.toUpperCase(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 300,
      path: '/',
    });

    return successResponse({
      success: true,
      connectionId: connectionRequest.id,
      redirectUrl: connectionRequest.redirectUrl,
      toolkit: toolkit.toUpperCase(),
      toolkitName: toolkitConfig?.displayName || toolkit,
      authType: 'oauth2',
    });
  } catch (error) {
    log.error('Failed to initiate connection', { error });
    return errors.serverError('Failed to initiate connection');
  }
}
