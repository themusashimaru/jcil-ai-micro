/**
 * UBER CONNECTOR
 * ==============
 *
 * OAuth-based Uber integration for ride estimates and requests.
 * Handles token refresh automatically.
 */

import { logger } from '@/lib/logger';
import type { UberConnector } from './types';
import { CONNECTOR_CONFIGS } from './types';

const log = logger('UberConnector');

// ============================================================================
// CONFIGURATION
// ============================================================================

const UBER_CLIENT_ID = process.env.UBER_CLIENT_ID;
const UBER_CLIENT_SECRET = process.env.UBER_CLIENT_SECRET;
const UBER_REDIRECT_URI = process.env.UBER_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/connectors/uber/callback`;

const UBER_AUTH_URL = 'https://login.uber.com/oauth/v2/authorize';
const UBER_TOKEN_URL = 'https://login.uber.com/oauth/v2/token';
const UBER_API_BASE = 'https://api.uber.com/v1.2';

// Scopes for Uber access
// Note: 'request' and 'request_receipt' require special Uber business approval
// Using basic scopes available to all developer apps
const UBER_SCOPES = [
  'profile',
  'history',
].join(' ');

// ============================================================================
// CONFIGURATION CHECK
// ============================================================================

export function isUberConfigured(): boolean {
  return !!(UBER_CLIENT_ID && UBER_CLIENT_SECRET);
}

// ============================================================================
// OAUTH HELPERS
// ============================================================================

/**
 * Generate the Uber authorization URL
 */
export function getUberAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: UBER_CLIENT_ID!,
    response_type: 'code',
    redirect_uri: UBER_REDIRECT_URI,
    scope: UBER_SCOPES,
    state,
  });

  return `${UBER_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}> {
  const response = await fetch(UBER_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: UBER_CLIENT_ID!,
      client_secret: UBER_CLIENT_SECRET!,
      grant_type: 'authorization_code',
      code,
      redirect_uri: UBER_REDIRECT_URI,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    log.error('Token exchange failed', { status: response.status, error });
    throw new Error(`Failed to exchange code for tokens: ${error}`);
  }

  return response.json();
}

/**
 * Refresh an access token using a refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  refresh_token?: string;
}> {
  const response = await fetch(UBER_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: UBER_CLIENT_ID!,
      client_secret: UBER_CLIENT_SECRET!,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    log.error('Token refresh failed', { status: response.status, error });
    throw new Error(`Failed to refresh token: ${error}`);
  }

  return response.json();
}

// ============================================================================
// API HELPERS
// ============================================================================

/**
 * Make an authenticated request to Uber API
 */
async function uberRequest<T>(
  accessToken: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${UBER_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept-Language': 'en_US',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    log.error('Uber API request failed', { endpoint, status: response.status, error });
    throw new Error(`Uber API error: ${response.status} ${error}`);
  }

  return response.json();
}

// ============================================================================
// USER PROFILE
// ============================================================================

export interface UberUser {
  uuid: string;
  first_name: string;
  last_name: string;
  email: string;
  mobile_verified: boolean;
  picture: string;
  promo_code: string;
}

export async function getCurrentUser(accessToken: string): Promise<UberUser> {
  return uberRequest<UberUser>(accessToken, '/me');
}

/**
 * Get connection status for display
 */
export async function getUberConnectionStatus(accessToken: string): Promise<UberConnector> {
  try {
    const user = await getCurrentUser(accessToken);

    return {
      type: 'uber',
      displayName: CONNECTOR_CONFIGS.uber.displayName,
      icon: CONNECTOR_CONFIGS.uber.icon,
      description: CONNECTOR_CONFIGS.uber.description,
      status: 'connected',
      connectedAt: new Date().toISOString(),
      metadata: {
        userId: user.uuid,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
      },
    };
  } catch (error) {
    log.error('Failed to get Uber connection status', { error });
    return {
      type: 'uber',
      displayName: CONNECTOR_CONFIGS.uber.displayName,
      icon: CONNECTOR_CONFIGS.uber.icon,
      description: CONNECTOR_CONFIGS.uber.description,
      status: 'error',
    };
  }
}

// ============================================================================
// PRODUCTS (RIDE TYPES)
// ============================================================================

export interface UberProduct {
  product_id: string;
  description: string;
  display_name: string;
  capacity: number;
  image: string;
  cash_enabled: boolean;
  shared: boolean;
}

export interface UberProductsResponse {
  products: UberProduct[];
}

/**
 * Get available ride types at a location
 */
export async function getProducts(
  accessToken: string,
  latitude: number,
  longitude: number
): Promise<UberProduct[]> {
  const params = new URLSearchParams({
    latitude: latitude.toString(),
    longitude: longitude.toString(),
  });

  const response = await uberRequest<UberProductsResponse>(
    accessToken,
    `/products?${params}`
  );

  return response.products;
}

// ============================================================================
// PRICE ESTIMATES
// ============================================================================

export interface UberPriceEstimate {
  product_id: string;
  currency_code: string;
  display_name: string;
  estimate: string;
  low_estimate: number;
  high_estimate: number;
  surge_multiplier: number;
  duration: number; // seconds
  distance: number; // miles
}

export interface UberPricesResponse {
  prices: UberPriceEstimate[];
}

/**
 * Get price estimates for rides between two locations
 */
export async function getPriceEstimates(
  accessToken: string,
  startLatitude: number,
  startLongitude: number,
  endLatitude: number,
  endLongitude: number
): Promise<UberPriceEstimate[]> {
  const params = new URLSearchParams({
    start_latitude: startLatitude.toString(),
    start_longitude: startLongitude.toString(),
    end_latitude: endLatitude.toString(),
    end_longitude: endLongitude.toString(),
  });

  const response = await uberRequest<UberPricesResponse>(
    accessToken,
    `/estimates/price?${params}`
  );

  return response.prices;
}

// ============================================================================
// TIME ESTIMATES
// ============================================================================

export interface UberTimeEstimate {
  product_id: string;
  display_name: string;
  estimate: number; // seconds
}

export interface UberTimesResponse {
  times: UberTimeEstimate[];
}

/**
 * Get ETA estimates for rides at a location
 */
export async function getTimeEstimates(
  accessToken: string,
  startLatitude: number,
  startLongitude: number,
  productId?: string
): Promise<UberTimeEstimate[]> {
  const params = new URLSearchParams({
    start_latitude: startLatitude.toString(),
    start_longitude: startLongitude.toString(),
  });

  if (productId) {
    params.set('product_id', productId);
  }

  const response = await uberRequest<UberTimesResponse>(
    accessToken,
    `/estimates/time?${params}`
  );

  return response.times;
}

// ============================================================================
// RIDE REQUESTS
// ============================================================================

export interface UberRideRequest {
  request_id: string;
  status: string;
  product_id: string;
  surge_multiplier: number;
  driver?: {
    phone_number: string;
    rating: number;
    picture_url: string;
    name: string;
  };
  vehicle?: {
    make: string;
    model: string;
    license_plate: string;
    picture_url: string;
  };
  location?: {
    latitude: number;
    longitude: number;
    bearing: number;
  };
  eta?: number;
  pickup?: {
    latitude: number;
    longitude: number;
    eta: number;
  };
  destination?: {
    latitude: number;
    longitude: number;
    eta: number;
  };
}

/**
 * Request a ride
 */
export async function requestRide(
  accessToken: string,
  productId: string,
  startLatitude: number,
  startLongitude: number,
  endLatitude: number,
  endLongitude: number,
  fareId?: string
): Promise<UberRideRequest> {
  const body: Record<string, unknown> = {
    product_id: productId,
    start_latitude: startLatitude,
    start_longitude: startLongitude,
    end_latitude: endLatitude,
    end_longitude: endLongitude,
  };

  if (fareId) {
    body.fare_id = fareId;
  }

  return uberRequest<UberRideRequest>(accessToken, '/requests', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * Get current ride status
 */
export async function getCurrentRide(accessToken: string): Promise<UberRideRequest | null> {
  try {
    return await uberRequest<UberRideRequest>(accessToken, '/requests/current');
  } catch {
    return null; // No active ride
  }
}

/**
 * Cancel a ride
 */
export async function cancelRide(accessToken: string, requestId?: string): Promise<void> {
  const endpoint = requestId ? `/requests/${requestId}` : '/requests/current';
  await uberRequest(accessToken, endpoint, { method: 'DELETE' });
}

/**
 * Get ride details
 */
export async function getRideDetails(
  accessToken: string,
  requestId: string
): Promise<UberRideRequest> {
  return uberRequest<UberRideRequest>(accessToken, `/requests/${requestId}`);
}

// ============================================================================
// RIDE RECEIPT
// ============================================================================

export interface UberReceipt {
  request_id: string;
  charges: {
    name: string;
    amount: number;
    type: string;
  }[];
  surge_charge: {
    name: string;
    amount: number;
    type: string;
  };
  charge_adjustments: {
    name: string;
    amount: number;
    type: string;
  }[];
  normal_fare: string;
  subtotal: string;
  total_charged: string;
  total_owed: number | null;
  currency_code: string;
  duration: string;
  distance: string;
  distance_label: string;
}

/**
 * Get receipt for a completed ride
 */
export async function getRideReceipt(
  accessToken: string,
  requestId: string
): Promise<UberReceipt> {
  return uberRequest<UberReceipt>(accessToken, `/requests/${requestId}/receipt`);
}

// ============================================================================
// RIDE HISTORY
// ============================================================================

export interface UberRideHistory {
  offset: number;
  limit: number;
  count: number;
  history: {
    request_id: string;
    request_time: number;
    product_id: string;
    status: string;
    distance: number;
    start_time: number;
    end_time: number;
  }[];
}

/**
 * Get user's ride history
 */
export async function getRideHistory(
  accessToken: string,
  offset: number = 0,
  limit: number = 10
): Promise<UberRideHistory> {
  const params = new URLSearchParams({
    offset: offset.toString(),
    limit: limit.toString(),
  });

  return uberRequest<UberRideHistory>(accessToken, `/history?${params}`);
}

// ============================================================================
// PLACES (SAVED LOCATIONS)
// ============================================================================

export interface UberPlace {
  address: string;
}

/**
 * Get a saved place (home or work)
 */
export async function getPlace(
  accessToken: string,
  placeId: 'home' | 'work'
): Promise<UberPlace | null> {
  try {
    return await uberRequest<UberPlace>(accessToken, `/places/${placeId}`);
  } catch {
    return null;
  }
}

/**
 * Update a saved place
 */
export async function updatePlace(
  accessToken: string,
  placeId: 'home' | 'work',
  address: string
): Promise<UberPlace> {
  return uberRequest<UberPlace>(accessToken, `/places/${placeId}`, {
    method: 'PUT',
    body: JSON.stringify({ address }),
  });
}
