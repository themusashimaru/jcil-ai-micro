/**
 * USAGE METRICS SECTION COMPONENT
 *
 * PURPOSE:
 * - Display detailed token usage statistics for all tiers
 * - Show token and image usage with progress bars
 * - Display monthly usage
 * - Provide upgrade option when near limits
 */

'use client';

import { useState, useEffect } from 'react';

interface UsageData {
  tier: 'free' | 'basic' | 'pro' | 'executive';
  tokens: {
    used: number;
    limit: number;
    remaining: number;
    percentage: number;
    usedFormatted: string;
    limitFormatted: string;
    remainingFormatted: string;
  };
  images: {
    used: number;
    limit: number;
    remaining: number;
    percentage: number;
  };
  features: {
    realtime_voice: boolean;
    image_generation: boolean;
  };
  hasReachedTokenLimit: boolean;
  hasReachedImageLimit: boolean;
  tokenWarning: boolean;
  imageWarning: boolean;
  planInfo: {
    tokenLimit: number;
    imageLimit: number;
    nextTier: string | null;
    nextTierTokenLimit: number | null;
  };
}

const TIER_NAMES = {
  free: 'Free',
  basic: 'Basic',
  pro: 'Pro',
  executive: 'Executive',
};

const TIER_PRICES = {
  free: 0,
  basic: 12,
  pro: 30,
  executive: 150,
};

export default function UsageMetricsSection() {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUsage();
  }, []);

  const fetchUsage = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/user/usage');

      if (!response.ok) {
        throw new Error('Failed to fetch usage data');
      }

      const data = await response.json();
      setUsage(data);
    } catch (err) {
      console.error('[UsageMetrics] Error fetching usage:', err);
      setError('Failed to load usage statistics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }}></div>
      </div>
    );
  }

  if (error || !usage) {
    return (
      <div className="rounded-xl p-6" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgb(239, 68, 68)', color: 'rgb(248, 113, 113)' }}>
        {error || 'Failed to load usage data'}
      </div>
    );
  }

  const tokenPercentage = usage.tokens.percentage;
  const imagePercentage = usage.images.percentage;

  const isTokenNearLimit = usage.tokenWarning;
  const isTokenAtLimit = usage.hasReachedTokenLimit;
  const isImageNearLimit = usage.imageWarning;
  const isImageAtLimit = usage.hasReachedImageLimit;

  // Format next tier token limit for display
  const formatTokenLimit = (tokens: number | null): string => {
    if (!tokens) return '';
    if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(0)}M`;
    if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(0)}K`;
    return tokens.toString();
  };

  return (
    <div className="space-y-6">
      {/* Current Tier Info */}
      <div className="glass-morphism rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{TIER_NAMES[usage.tier]} Plan</h3>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              ${TIER_PRICES[usage.tier]}/month • Monthly usage limits
            </p>
          </div>
          <button
            onClick={() => window.location.href = '/settings?tab=membership'}
            className="text-sm font-medium transition"
            style={{ color: 'var(--primary)' }}
          >
            Manage Plan →
          </button>
        </div>

        {/* Token Usage */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>Token Usage This Month</span>
            <span className="text-sm font-bold" style={{
              color: isTokenAtLimit ? 'rgb(239, 68, 68)' :
                     isTokenNearLimit ? 'rgb(234, 179, 8)' :
                     'var(--text-primary)'
            }}>
              {usage.tokens.usedFormatted} / {usage.tokens.limitFormatted}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="h-3 overflow-hidden rounded-full" style={{ backgroundColor: 'var(--glass-bg)' }}>
            <div
              className="h-full transition-all duration-300"
              style={{
                width: `${Math.min(tokenPercentage, 100)}%`,
                backgroundColor: isTokenAtLimit ? 'rgb(239, 68, 68)' :
                                 isTokenNearLimit ? 'rgb(234, 179, 8)' :
                                 'var(--primary)'
              }}
            />
          </div>

          <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
            {usage.tokens.remaining > 0
              ? `${usage.tokens.remainingFormatted} tokens remaining this month`
              : 'Monthly limit reached - resets next month'}
          </p>
        </div>

        {/* Images Usage */}
        {usage.images.limit > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>Image Generations This Month</span>
              <span className="text-sm font-bold" style={{
                color: isImageAtLimit ? 'rgb(239, 68, 68)' :
                       isImageNearLimit ? 'rgb(234, 179, 8)' :
                       'var(--text-primary)'
              }}>
                {usage.images.used} / {usage.images.limit}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="h-3 overflow-hidden rounded-full" style={{ backgroundColor: 'var(--glass-bg)' }}>
              <div
                className="h-full transition-all duration-300"
                style={{
                  width: `${Math.min(imagePercentage, 100)}%`,
                  backgroundColor: isImageAtLimit ? 'rgb(239, 68, 68)' :
                                   isImageNearLimit ? 'rgb(234, 179, 8)' :
                                   'rgb(168, 85, 247)' // Purple for images
                }}
              />
            </div>

            <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
              {usage.images.remaining > 0
                ? `${usage.images.remaining} image generations remaining this month`
                : 'Monthly image limit reached - resets next month'}
            </p>
          </div>
        )}

        {/* No image generation message for free tier */}
        {usage.images.limit === 0 && (
          <div className="mt-4 p-3 rounded-lg" style={{ backgroundColor: 'var(--glass-bg)' }}>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Image generation is available on Basic plan and above.
            </p>
          </div>
        )}
      </div>

      {/* Upgrade Prompt */}
      {(isTokenNearLimit || isTokenAtLimit) && usage.planInfo.nextTier && (
        <div className="glass-morphism rounded-xl p-6" style={{ borderLeft: '4px solid rgb(234, 179, 8)' }}>
          <div className="flex items-start gap-4">
            <svg
              className="h-6 w-6 flex-shrink-0 mt-0.5"
              style={{ color: 'rgb(250, 204, 21)' }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div className="flex-1">
              <h4 className="font-semibold mb-1" style={{ color: 'rgb(250, 204, 21)' }}>
                {isTokenAtLimit ? 'Monthly Limit Reached' : 'Approaching Monthly Limit'}
              </h4>
              <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
                Upgrade to {TIER_NAMES[usage.planInfo.nextTier as keyof typeof TIER_NAMES]} for {formatTokenLimit(usage.planInfo.nextTierTokenLimit)} tokens per month and enhanced features.
              </p>
              <button
                onClick={() => window.location.href = '/#pricing'}
                className="rounded-lg px-4 py-2 text-sm font-semibold transition hover:opacity-90"
                style={{ backgroundColor: 'rgb(234, 179, 8)', color: '#000' }}
              >
                View Upgrade Options
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Usage Stats Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="glass-morphism rounded-xl p-4">
          <div className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Tokens Used</div>
          <div className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{usage.tokens.usedFormatted}</div>
          <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>This Month</div>
        </div>

        <div className="glass-morphism rounded-xl p-4">
          <div className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Tokens Remaining</div>
          <div className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{usage.tokens.remainingFormatted}</div>
          <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>This Month</div>
        </div>

        <div className="glass-morphism rounded-xl p-4">
          <div className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Images Generated</div>
          <div className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{usage.images.used}</div>
          <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>This Month</div>
        </div>
      </div>

      {/* Reset Info */}
      <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--primary-hover)', border: '1px solid var(--primary)' }}>
        <div className="flex items-start gap-3">
          <svg
            className="h-5 w-5 flex-shrink-0 mt-0.5"
            style={{ color: 'var(--primary)' }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div className="text-sm" style={{ color: 'var(--text-primary)' }}>
            <p className="font-medium mb-1">Monthly Usage Resets</p>
            <p style={{ color: 'var(--text-secondary)' }}>Your token and image limits automatically reset at the beginning of each month.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
