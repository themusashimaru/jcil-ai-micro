/**
 * UBER TOOL
 * =========
 *
 * AI tool for getting Uber ride estimates, requesting rides,
 * and managing trips.
 */

import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logger';
import { decrypt as decryptToken, encrypt as encryptToken } from '@/lib/security/crypto';
import {
  getPriceEstimates,
  getTimeEstimates,
  requestRide,
  getCurrentRide,
  cancelRide,
  getRideHistory,
  getCurrentUser,
  refreshAccessToken,
  isUberConfigured,
} from '@/lib/connectors/uber';
import type { UnifiedTool, UnifiedToolCall, UnifiedToolResult } from '@/lib/ai/providers/types';

const log = logger('UberTool');

// ============================================================================
// TOOL DEFINITION
// ============================================================================

export const uberTool: UnifiedTool = {
  name: 'uber',
  description: `Get Uber ride estimates and request rides. Use this tool when the user wants to:
- Get ride price estimates between two locations
- See estimated arrival times for nearby drivers
- Request an Uber ride
- Check on their current ride status
- Cancel a ride
- View ride history

IMPORTANT: This tool requires the user to have connected their Uber account in Settings > Connectors.
For safety, always confirm ride requests with the user before executing.`,
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: [
          'price_estimate',
          'time_estimate',
          'request_ride',
          'current_ride',
          'cancel_ride',
          'ride_history',
          'account_info',
        ],
        description: 'The action to perform',
      },
      start_latitude: {
        type: 'number',
        description: 'Starting point latitude',
      },
      start_longitude: {
        type: 'number',
        description: 'Starting point longitude',
      },
      end_latitude: {
        type: 'number',
        description: 'Destination latitude (required for price_estimate and request_ride)',
      },
      end_longitude: {
        type: 'number',
        description: 'Destination longitude (required for price_estimate and request_ride)',
      },
      product_id: {
        type: 'string',
        description: 'Uber product/service ID (e.g., UberX, UberXL) - required for request_ride',
      },
      fare_id: {
        type: 'string',
        description: 'Fare ID from price estimate (required for upfront pricing)',
      },
      limit: {
        type: 'number',
        description: 'Number of results to return (default: 10, for ride_history)',
      },
    },
    required: ['action'],
  },
};

// ============================================================================
// TOOL EXECUTION
// ============================================================================

interface UberToolArgs {
  action: string;
  start_latitude?: number;
  start_longitude?: number;
  end_latitude?: number;
  end_longitude?: number;
  product_id?: string;
  fare_id?: string;
  limit?: number;
}

/**
 * Get a valid Uber access token for a user, refreshing if needed
 */
async function getValidAccessToken(userId: string): Promise<string | null> {
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: userData, error } = await adminClient
    .from('users')
    .select('uber_access_token, uber_refresh_token, uber_token_expires_at')
    .eq('id', userId)
    .single();

  if (error || !userData?.uber_access_token || !userData?.uber_refresh_token) {
    return null;
  }

  let accessToken: string;
  let refreshToken: string;

  try {
    accessToken = decryptToken(userData.uber_access_token);
    refreshToken = decryptToken(userData.uber_refresh_token);
  } catch {
    return null;
  }

  // Check if token needs refresh
  const expiresAt = new Date(userData.uber_token_expires_at);
  const now = new Date();

  if (now >= expiresAt || (expiresAt.getTime() - now.getTime()) < 5 * 60 * 1000) {
    try {
      const newTokens = await refreshAccessToken(refreshToken);
      const newExpiresAt = new Date(Date.now() + newTokens.expires_in * 1000).toISOString();

      await adminClient
        .from('users')
        .update({
          uber_access_token: encryptToken(newTokens.access_token),
          uber_refresh_token: newTokens.refresh_token
            ? encryptToken(newTokens.refresh_token)
            : userData.uber_refresh_token,
          uber_token_expires_at: newExpiresAt,
        })
        .eq('id', userId);

      return newTokens.access_token;
    } catch (err) {
      log.error('Token refresh failed', { error: err });
      return null;
    }
  }

  return accessToken;
}

export async function executeUber(toolCall: UnifiedToolCall): Promise<UnifiedToolResult> {
  const args = (typeof toolCall.arguments === 'string'
    ? JSON.parse(toolCall.arguments)
    : toolCall.arguments) as UberToolArgs;

  // Check if Uber is configured
  if (!isUberConfigured()) {
    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({
        error: 'Uber integration is not configured on this server.',
        suggestion: 'Please contact the administrator to set up Uber integration.',
      }),
      isError: true,
    };
  }

  // Get user ID from session
  const userId = toolCall.sessionId;
  if (!userId) {
    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({
        error: 'Could not identify user session.',
        suggestion: 'Please try again or refresh the page.',
      }),
      isError: true,
    };
  }

  // Get valid access token
  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) {
    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({
        error: 'Uber is not connected.',
        suggestion: 'Please connect your Uber account in Settings > Connectors.',
        action_required: 'connect_uber',
      }),
      isError: true,
    };
  }

  try {
    switch (args.action) {
      case 'price_estimate': {
        if (
          args.start_latitude === undefined ||
          args.start_longitude === undefined ||
          args.end_latitude === undefined ||
          args.end_longitude === undefined
        ) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({
              error: 'Start and end coordinates are required for price estimates.',
              required: ['start_latitude', 'start_longitude', 'end_latitude', 'end_longitude'],
            }),
            isError: true,
          };
        }

        const estimates = await getPriceEstimates(
          accessToken,
          args.start_latitude,
          args.start_longitude,
          args.end_latitude,
          args.end_longitude
        );

        return {
          toolCallId: toolCall.id,
          content: JSON.stringify({
            estimates: estimates.map((e) => ({
              product: e.display_name,
              product_id: e.product_id,
              price: e.estimate,
              low_estimate: e.low_estimate,
              high_estimate: e.high_estimate,
              currency: e.currency_code,
              duration: `${Math.round(e.duration / 60)} min`,
              distance: `${e.distance.toFixed(1)} miles`,
              surge: e.surge_multiplier > 1 ? `${e.surge_multiplier}x surge` : null,
            })),
            note: 'Use request_ride with a product_id to book a ride.',
          }),
        };
      }

      case 'time_estimate': {
        if (args.start_latitude === undefined || args.start_longitude === undefined) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({
              error: 'Start coordinates are required for time estimates.',
              required: ['start_latitude', 'start_longitude'],
            }),
            isError: true,
          };
        }

        const times = await getTimeEstimates(
          accessToken,
          args.start_latitude,
          args.start_longitude
        );

        return {
          toolCallId: toolCall.id,
          content: JSON.stringify({
            estimates: times.map((t) => ({
              product: t.display_name,
              product_id: t.product_id,
              eta: `${Math.round(t.estimate / 60)} min`,
            })),
          }),
        };
      }

      case 'request_ride': {
        if (
          args.start_latitude === undefined ||
          args.start_longitude === undefined ||
          args.end_latitude === undefined ||
          args.end_longitude === undefined
        ) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({
              error: 'Start and end coordinates are required to request a ride.',
              required: ['start_latitude', 'start_longitude', 'end_latitude', 'end_longitude'],
            }),
            isError: true,
          };
        }

        if (!args.product_id) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({
              error: 'Product ID is required to request a ride.',
              suggestion: 'First use price_estimate to get available products and their IDs.',
            }),
            isError: true,
          };
        }

        const ride = await requestRide(
          accessToken,
          args.product_id,
          args.start_latitude,
          args.start_longitude,
          args.end_latitude,
          args.end_longitude,
          args.fare_id
        );

        return {
          toolCallId: toolCall.id,
          content: JSON.stringify({
            success: true,
            ride: {
              request_id: ride.request_id,
              status: ride.status,
              product_id: ride.product_id,
              eta: ride.eta ? `${ride.eta} min` : null,
              driver: ride.driver ? {
                name: ride.driver.name,
                rating: ride.driver.rating,
                phone: ride.driver.phone_number,
              } : null,
              vehicle: ride.vehicle ? {
                make: ride.vehicle.make,
                model: ride.vehicle.model,
                license: ride.vehicle.license_plate,
              } : null,
            },
            message: 'Ride requested! Check current_ride for updates.',
          }),
        };
      }

      case 'current_ride': {
        const ride = await getCurrentRide(accessToken);

        if (!ride) {
          return {
            toolCallId: toolCall.id,
            content: JSON.stringify({
              active_ride: false,
              message: 'No active ride found.',
            }),
          };
        }

        return {
          toolCallId: toolCall.id,
          content: JSON.stringify({
            active_ride: true,
            ride: {
              request_id: ride.request_id,
              status: ride.status,
              product_id: ride.product_id,
              eta: ride.eta ? `${ride.eta} min` : null,
              driver: ride.driver ? {
                name: ride.driver.name,
                rating: ride.driver.rating,
                phone: ride.driver.phone_number,
              } : null,
              vehicle: ride.vehicle ? {
                make: ride.vehicle.make,
                model: ride.vehicle.model,
                license: ride.vehicle.license_plate,
              } : null,
              location: ride.location ? {
                latitude: ride.location.latitude,
                longitude: ride.location.longitude,
                bearing: ride.location.bearing,
              } : null,
            },
          }),
        };
      }

      case 'cancel_ride': {
        await cancelRide(accessToken);

        return {
          toolCallId: toolCall.id,
          content: JSON.stringify({
            success: true,
            message: 'Ride cancelled successfully.',
          }),
        };
      }

      case 'ride_history': {
        const limit = args.limit || 10;
        const historyData = await getRideHistory(accessToken, 0, limit);

        return {
          toolCallId: toolCall.id,
          content: JSON.stringify({
            rides: historyData.history.map((r) => ({
              request_id: r.request_id,
              status: r.status,
              start_time: new Date(r.start_time * 1000).toISOString(),
              end_time: new Date(r.end_time * 1000).toISOString(),
              product_id: r.product_id,
              distance: r.distance ? `${r.distance.toFixed(1)} miles` : null,
            })),
            count: historyData.count,
          }),
        };
      }

      case 'account_info': {
        const user = await getCurrentUser(accessToken);

        return {
          toolCallId: toolCall.id,
          content: JSON.stringify({
            user: {
              first_name: user.first_name,
              last_name: user.last_name,
              email: user.email,
              uuid: user.uuid,
            },
          }),
        };
      }

      default:
        return {
          toolCallId: toolCall.id,
          content: JSON.stringify({ error: `Unknown action: ${args.action}` }),
          isError: true,
        };
    }
  } catch (error) {
    log.error('Uber tool error', { action: args.action, error });

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Check for common errors
    if (errorMessage.includes('401') || errorMessage.includes('unauthorized')) {
      return {
        toolCallId: toolCall.id,
        content: JSON.stringify({
          error: 'Uber authorization expired.',
          suggestion: 'Please reconnect your Uber account in Settings > Connectors.',
          action_required: 'reconnect_uber',
        }),
        isError: true,
      };
    }

    if (errorMessage.includes('NO_DRIVERS_AVAILABLE') || errorMessage.includes('409')) {
      return {
        toolCallId: toolCall.id,
        content: JSON.stringify({
          error: 'No drivers available in your area right now.',
          suggestion: 'Please try again in a few minutes.',
        }),
        isError: true,
      };
    }

    return {
      toolCallId: toolCall.id,
      content: JSON.stringify({ error: errorMessage }),
      isError: true,
    };
  }
}

/**
 * Check if Uber tool is available
 */
export function isUberToolAvailable(): boolean {
  return isUberConfigured();
}
