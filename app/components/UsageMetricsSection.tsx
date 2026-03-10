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
  tier: 'free' | 'plus' | 'basic' | 'pro' | 'executive';
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
  plus: 'Plus',
  basic: 'Plus', // Legacy alias
  pro: 'Pro',
  executive: 'Executive',
};

const TIER_PRICES = {
  free: 0,
  plus: 18,
  basic: 18, // Legacy alias
  pro: 30,
  executive: 99,
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

      const responseData = await response.json();
      // API returns { ok: true, data: { ... } }
      const data = responseData.data || responseData;
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
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (error || !usage) {
    return (
      <div className="rounded-xl p-6 bg-red-500/10 border border-red-500 text-red-400">
        {error || 'Failed to load usage data'}
      </div>
    );
  }

  const tokenPercentage = usage.tokens.percentage;

  const isTokenNearLimit = usage.tokenWarning;
  const isTokenAtLimit = usage.hasReachedTokenLimit;

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
            <h3 className="text-xl font-bold text-text-primary">{TIER_NAMES[usage.tier]} Plan</h3>
            <p className="text-sm mt-1 text-text-secondary">
              ${TIER_PRICES[usage.tier]}/month • Monthly usage limits
            </p>
          </div>
          <button
            onClick={() => (window.location.href = '/settings?tab=membership')}
            className="text-sm font-medium transition text-primary"
          >
            Manage Plan →
          </button>
        </div>

        {/* Token Usage */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-text-secondary">
              Token Usage This Month
            </span>
            <span
              className={`text-sm font-bold ${isTokenAtLimit ? 'text-red-500' : isTokenNearLimit ? 'text-yellow-500' : 'text-text-primary'}`}
            >
              {usage.tokens.usedFormatted} / {usage.tokens.limitFormatted}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="h-3 overflow-hidden rounded-full bg-glass">
            <div
              className={`h-full transition-all duration-300 ${isTokenAtLimit ? 'bg-red-500' : isTokenNearLimit ? 'bg-yellow-500' : 'bg-primary'}`}
              style={{ width: `${Math.min(tokenPercentage, 100)}%` }}
            />
          </div>

          <p className="text-xs mt-2 text-text-muted">
            {usage.tokens.remaining > 0
              ? `${usage.tokens.remainingFormatted} tokens remaining this month`
              : 'Monthly limit reached - resets next month'}
          </p>
        </div>

        {/* Image generation has been discontinued */}
      </div>

      {/* Upgrade Prompt */}
      {(isTokenNearLimit || isTokenAtLimit) && usage.planInfo.nextTier && (
        <div className="glass-morphism rounded-xl p-6 border-l-4 border-l-yellow-500">
          <div className="flex items-start gap-4">
            <svg
              className="h-6 w-6 flex-shrink-0 mt-0.5 text-yellow-400"
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
              <h4 className="font-semibold mb-1 text-yellow-400">
                {isTokenAtLimit ? 'Monthly Limit Reached' : 'Approaching Monthly Limit'}
              </h4>
              <p className="text-sm mb-3 text-text-secondary">
                Upgrade to {TIER_NAMES[usage.planInfo.nextTier as keyof typeof TIER_NAMES]} for{' '}
                {formatTokenLimit(usage.planInfo.nextTierTokenLimit)} tokens per month and enhanced
                features.
              </p>
              <button
                onClick={() => (window.location.href = '/#pricing')}
                className="rounded-lg px-4 py-2 text-sm font-semibold transition hover:opacity-90 bg-yellow-500 text-black"
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
          <div className="text-sm mb-1 text-text-secondary">Tokens Used</div>
          <div className="text-2xl font-bold text-text-primary">{usage.tokens.usedFormatted}</div>
          <div className="text-xs mt-1 text-text-muted">This Month</div>
        </div>

        <div className="glass-morphism rounded-xl p-4">
          <div className="text-sm mb-1 text-text-secondary">Tokens Remaining</div>
          <div className="text-2xl font-bold text-text-primary">
            {usage.tokens.remainingFormatted}
          </div>
          <div className="text-xs mt-1 text-text-muted">This Month</div>
        </div>

        <div className="glass-morphism rounded-xl p-4">
          <div className="text-sm mb-1 text-text-secondary">Usage Level</div>
          <div className="text-2xl font-bold text-text-primary">{usage.tokens.percentage}%</div>
          <div className="text-xs mt-1 text-text-muted">Of Monthly Limit</div>
        </div>
      </div>

      {/* Reset Info */}
      <div className="rounded-xl p-4 bg-primary-hover border border-primary">
        <div className="flex items-start gap-3">
          <svg
            className="h-5 w-5 flex-shrink-0 mt-0.5 text-primary"
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
          <div className="text-sm text-text-primary">
            <p className="font-medium mb-1">Monthly Usage Resets</p>
            <p className="text-text-secondary">
              Your token limits automatically reset at the beginning of each month.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
