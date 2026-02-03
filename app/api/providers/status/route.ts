/**
 * PROVIDER STATUS API
 *
 * Returns which AI providers are configured (have API keys set).
 * This allows the frontend to show which providers are available to users.
 *
 * GET /api/providers/status
 * Response: { configured: ['claude', 'xai', ...], default: 'claude' }
 */

import { NextResponse } from 'next/server';
import { getAvailableProviderIds } from '@/lib/ai/providers/registry';

export async function GET() {
  try {
    // Get all providers that have API keys configured
    const configuredProviders = getAvailableProviderIds();

    // Default provider is Claude (or first available if Claude not configured)
    const defaultProvider = configuredProviders.includes('claude')
      ? 'claude'
      : configuredProviders[0] || 'claude';

    return NextResponse.json({
      ok: true,
      configured: configuredProviders,
      default: defaultProvider,
    });
  } catch (error) {
    console.error('Error fetching provider status:', error);
    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to fetch provider status',
        configured: ['claude'], // Fallback to Claude
        default: 'claude',
      },
      { status: 500 }
    );
  }
}
