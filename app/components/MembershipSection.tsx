/**
 * MEMBERSHIP SECTION COMPONENT
 *
 * PURPOSE:
 * - Display current subscription tier
 * - Show plan features and benefits
 * - Allow users to upgrade/downgrade via Stripe billing portal
 * - Handle subscription management
 */

'use client';

import { useState, useEffect } from 'react';

type SubscriptionTier = 'free' | 'plus' | 'basic' | 'pro' | 'executive';
type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'trialing';

interface SubscriptionData {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  hasStripeCustomer: boolean;
  hasActiveSubscription: boolean;
}

const TIER_INFO = {
  free: {
    name: 'Free',
    price: 0,
    description: 'Limited access for exploration',
    features: [
      'Basic AI chat access',
      'Limited monthly usage',
      'Perfect for trying out the platform',
    ],
  },
  plus: {
    name: 'Plus',
    price: 18,
    description: 'Essential tools for everyday faith and life',
    features: [
      'Intelligent AI chat assistant',
      'Real-time fact-checking with Perplexity',
      'Resume & cover letter writing',
      'Live web search & research',
      'Writing tools & Bible study',
    ],
  },
  basic: {
    name: 'Plus',
    price: 18,
    description: 'Essential tools for everyday faith and life',
    features: [
      'Intelligent AI chat assistant',
      'Real-time fact-checking with Perplexity',
      'Resume & cover letter writing',
      'Live web search & research',
      'Writing tools & Bible study',
    ],
  },
  pro: {
    name: 'Pro',
    price: 30,
    description: 'Advanced tools for working professionals',
    features: [
      'Everything in Plus',
      '3M token context window',
      'Enhanced fact-checking & research',
      'Advanced document generation',
      'Advanced coding assistance',
    ],
  },
  executive: {
    name: 'Executive',
    price: 99,
    description: 'Highest intelligence AI for power users',
    features: [
      'Everything in Pro',
      'Highest intelligence AI model',
      '5x more usage capacity',
      'Executive-level document tools',
      'Priority support',
    ],
  },
};

export default function MembershipSection() {
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSubscription();
  }, []);

  const fetchSubscription = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/user/subscription');

      if (!response.ok) {
        throw new Error('Failed to fetch subscription');
      }

      const data = await response.json();
      setSubscription(data);
    } catch (err) {
      console.error('[Membership] Error fetching subscription:', err);
      setError('Failed to load subscription information');
    } finally {
      setLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    try {
      setActionLoading(true);
      setError(null);

      // Redirect to Stripe billing portal
      const response = await fetch('/api/stripe/portal', {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to open billing portal');
      }

      const { url } = await response.json();
      if (url) {
        window.location.href = url;
      }
    } catch (err) {
      console.error('[Membership] Error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      setActionLoading(false);
    }
  };

  const handleUpgrade = async () => {
    // Redirect to home page pricing section
    window.location.href = '/#pricing';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" style={{ borderColor: 'var(--primary)', borderTopColor: 'transparent' }}></div>
      </div>
    );
  }

  if (error && !subscription) {
    return (
      <div className="rounded-xl p-4" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgb(239, 68, 68)', color: 'rgb(248, 113, 113)' }}>
        {error}
      </div>
    );
  }

  if (!subscription) return null;

  const currentTier = TIER_INFO[subscription.tier];
  const isFree = subscription.tier === 'free';
  const isPastDue = subscription.status === 'past_due';
  const isCanceled = subscription.status === 'canceled';

  return (
    <div className="space-y-6">
      {/* Status Alert */}
      {isPastDue && (
        <div className="rounded-xl p-4" style={{ backgroundColor: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgb(234, 179, 8)' }}>
          <div className="flex items-start gap-3">
            <svg
              className="h-6 w-6 flex-shrink-0"
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
            <div>
              <h3 className="font-semibold" style={{ color: 'rgb(250, 204, 21)' }}>Payment Issue</h3>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                Your payment failed. Please update your payment method to continue your subscription.
              </p>
              <button
                onClick={handleManageSubscription}
                className="mt-3 text-sm font-medium underline hover:opacity-80 transition"
                style={{ color: 'rgb(250, 204, 21)' }}
              >
                Update Payment Method
              </button>
            </div>
          </div>
        </div>
      )}

      {isCanceled && (
        <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--glass-bg)', border: '1px solid var(--border)' }}>
          <div className="flex items-start gap-3">
            <svg
              className="h-6 w-6 flex-shrink-0"
              style={{ color: 'var(--text-muted)' }}
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
            <div>
              <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Subscription Canceled</h3>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                Your subscription has been canceled. You can continue using your current plan until the end of the billing period.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Current Plan Card */}
      <div className="glass-morphism rounded-2xl p-6" style={{ border: '2px solid var(--primary)' }}>
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-3">
              <h3 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{currentTier.name}</h3>
              <span className="px-3 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: 'var(--primary-hover)', color: 'var(--primary)', border: '1px solid var(--primary)' }}>
                Current Plan
              </span>
            </div>
            <p className="mt-2" style={{ color: 'var(--text-secondary)' }}>{currentTier.description}</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>${currentTier.price}</div>
            <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>/month</div>
          </div>
        </div>

        {/* Features */}
        <div className="mb-6">
          <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>What&apos;s included:</h4>
          <ul className="space-y-2">
            {currentTier.features.map((feature, index) => (
              <li key={index} className="flex items-start gap-2 text-sm">
                <svg
                  className="h-5 w-5 text-green-500 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span style={{ color: 'var(--text-primary)' }}>{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          {!isFree && subscription.hasStripeCustomer && (
            <button
              onClick={handleManageSubscription}
              disabled={actionLoading}
              className="flex-1 rounded-lg px-4 py-3 font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: 'var(--glass-bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            >
              {actionLoading ? 'Loading...' : 'Manage Subscription'}
            </button>
          )}
          {isFree && (
            <button
              onClick={handleUpgrade}
              className="flex-1 rounded-lg px-4 py-3 font-semibold hover:opacity-90 transition"
              style={{ backgroundColor: 'var(--primary)', color: 'var(--background)' }}
            >
              Upgrade Plan
            </button>
          )}
          {!isFree && (
            <button
              onClick={handleUpgrade}
              className="flex-1 rounded-lg px-4 py-3 font-semibold hover:opacity-90 transition"
              style={{ backgroundColor: 'var(--primary)', color: 'var(--background)' }}
            >
              {subscription.tier === 'executive' ? 'View All Plans' : 'Upgrade Plan'}
            </button>
          )}
        </div>
      </div>

      {/* Other Available Plans */}
      <div>
        <h3 className="text-xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Other Available Plans</h3>
        <div className="grid gap-4 md:grid-cols-2">
          {(Object.entries(TIER_INFO) as [SubscriptionTier, typeof TIER_INFO[SubscriptionTier]][])
            .filter(([tier]) => tier !== subscription.tier && tier !== 'free')
            .map(([tier, info]) => (
              <div
                key={tier}
                className="glass-morphism rounded-xl p-4 transition"
                style={{ border: '1px solid var(--border)' }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>{info.name}</h4>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{info.description}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>${info.price}</div>
                    <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>/mo</div>
                  </div>
                </div>
                <ul className="space-y-1 mb-4">
                  {info.features.slice(0, 3).map((feature, index) => (
                    <li key={index} className="flex items-start gap-2 text-xs">
                      <span className="text-green-500 mt-0.5">✓</span>
                      <span style={{ color: 'var(--text-secondary)' }}>{feature}</span>
                    </li>
                  ))}
                  {info.features.length > 3 && (
                    <li className="text-xs ml-5" style={{ color: 'var(--text-muted)' }}>
                      +{info.features.length - 3} more features
                    </li>
                  )}
                </ul>
              </div>
            ))}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="rounded-xl p-4" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgb(239, 68, 68)', color: 'rgb(248, 113, 113)' }}>
          {error}
        </div>
      )}
    </div>
  );
}
