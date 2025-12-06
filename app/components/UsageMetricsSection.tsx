/**
 * USAGE METRICS SECTION COMPONENT
 *
 * PURPOSE:
 * - Display detailed usage statistics for all tiers
 * - Show message and image usage with progress bars
 * - Display total usage history
 * - Provide upgrade option when near limits
 */

'use client';

import { useState, useEffect } from 'react';

interface UsageData {
  tier: 'free' | 'basic' | 'pro' | 'executive';
  messages: {
    used: number;
    limit: number;
    remaining: number;
  };
  images: {
    used: number;
    limit: number;
    remaining: number;
  };
  hasReachedLimit: boolean;
}

const TIER_NAMES = {
  free: 'Free',
  basic: 'Basic',
  pro: 'Pro',
  executive: 'Executive',
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
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  if (error || !usage) {
    return (
      <div className="rounded-xl bg-red-900/20 border border-red-500 p-6 text-red-400">
        {error || 'Failed to load usage data'}
      </div>
    );
  }

  const messagePercentage = (usage.messages.used / usage.messages.limit) * 100;
  const imagePercentage = usage.images.limit > 0 ? (usage.images.used / usage.images.limit) * 100 : 0;

  const isMessageNearLimit = messagePercentage >= 80;
  const isMessageAtLimit = usage.hasReachedLimit;

  return (
    <div className="space-y-6">
      {/* Current Tier Info */}
      <div className="glass-morphism rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{TIER_NAMES[usage.tier]} Plan</h3>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Current daily usage limits</p>
          </div>
          <button
            onClick={() => window.location.href = '/settings?tab=membership'}
            className="text-sm font-medium transition"
            style={{ color: 'var(--primary)' }}
          >
            Manage Plan →
          </button>
        </div>

        {/* Messages Usage */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>Messages Today</span>
            <span className={`text-sm font-bold ${
              isMessageAtLimit ? 'text-red-500' :
              isMessageNearLimit ? 'text-yellow-500' :
              ''
            }`} style={!isMessageAtLimit && !isMessageNearLimit ? { color: 'var(--text-primary)' } : {}}>
              {usage.messages.used} / {usage.messages.limit}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="h-3 overflow-hidden rounded-full" style={{ backgroundColor: 'var(--glass-bg)' }}>
            <div
              className={`h-full transition-all duration-300 ${
                isMessageAtLimit ? 'bg-red-500' :
                isMessageNearLimit ? 'bg-yellow-500' :
                'bg-blue-500'
              }`}
              style={{ width: `${Math.min(messagePercentage, 100)}%` }}
            />
          </div>

          <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
            {usage.messages.remaining > 0
              ? `${usage.messages.remaining} messages remaining today`
              : 'Daily limit reached - resets at midnight'}
          </p>
        </div>

        {/* Images Usage (only for Pro and Executive) */}
        {usage.images.limit > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>Image Generations Today</span>
              <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                {usage.images.used} / {usage.images.limit}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="h-3 overflow-hidden rounded-full" style={{ backgroundColor: 'var(--glass-bg)' }}>
              <div
                className="h-full bg-purple-500 transition-all duration-300"
                style={{ width: `${Math.min(imagePercentage, 100)}%` }}
              />
            </div>

            <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
              {usage.images.remaining > 0
                ? `${usage.images.remaining} image generations remaining today`
                : 'Daily image limit reached - resets at midnight'}
            </p>
          </div>
        )}
      </div>

      {/* Upgrade Prompt (for Free and Basic tiers) */}
      {(usage.tier === 'free' || usage.tier === 'basic') && isMessageNearLimit && (
        <div className="glass-morphism rounded-xl p-6 border-l-4 border-yellow-500">
          <div className="flex items-start gap-4">
            <svg
              className="h-6 w-6 text-yellow-400 flex-shrink-0 mt-0.5"
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
              <h4 className="font-semibold text-yellow-400 mb-1">
                {isMessageAtLimit ? 'Daily Limit Reached' : 'Approaching Daily Limit'}
              </h4>
              <p className="text-sm text-gray-300 mb-3">
                {usage.tier === 'free'
                  ? 'Upgrade to Basic for 100 messages per day and enhanced features.'
                  : 'Upgrade to Pro for 200 messages per day, image generation, and priority support.'}
              </p>
              <button
                onClick={() => window.location.href = '/#pricing'}
                className="rounded-lg bg-yellow-500 px-4 py-2 text-sm font-semibold text-black hover:bg-yellow-400 transition"
              >
                View Upgrade Options
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Usage Info */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="glass-morphism rounded-xl p-4">
          <div className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Messages Used</div>
          <div className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{usage.messages.used}</div>
          <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Today</div>
        </div>

        <div className="glass-morphism rounded-xl p-4">
          <div className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Messages Remaining</div>
          <div className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{usage.messages.remaining}</div>
          <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Today</div>
        </div>

        {usage.images.limit > 0 && (
          <div className="glass-morphism rounded-xl p-4">
            <div className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Images Generated</div>
            <div className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{usage.images.used}</div>
            <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Today</div>
          </div>
        )}
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
            <p className="font-medium mb-1">Daily Usage Resets</p>
            <p style={{ color: 'var(--text-secondary)' }}>Your daily message and image limits automatically reset at midnight (your local time).</p>
          </div>
        </div>
      </div>
    </div>
  );
}
