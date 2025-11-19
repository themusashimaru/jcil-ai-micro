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

type SubscriptionTier = 'free' | 'basic' | 'pro' | 'executive';
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
    description: 'For exploration & those who cannot afford paid plans',
    features: [
      '10 messages per day',
      'Basic AI responses',
      'Perfect for trying out the platform',
    ],
  },
  basic: {
    name: 'Basic',
    price: 12,
    description: 'For moderate daily users',
    features: [
      'Writing tools & research',
      'Daily news updates',
      'Bible study & devotional',
      'Study & tutor assistance',
      'No image/video creation',
    ],
  },
  pro: {
    name: 'Pro',
    price: 30,
    description: 'For working professionals & serious students',
    features: [
      'Advanced research & writing',
      'Email & research papers',
      'Live search with 30-min news refresh',
      'Increased intelligence & coding',
      'Priority support',
    ],
  },
  executive: {
    name: 'Executive',
    price: 150,
    description: 'For heavy users with premium needs',
    features: [
      'Deep research & analysis',
      'Advanced email & writing',
      'Full personalization',
      'Coding assistance',
      'Image & video generation',
      'Dedicated support',
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
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  if (error && !subscription) {
    return (
      <div className="rounded-xl bg-red-900/20 border border-red-500 p-4 text-red-400">
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
        <div className="rounded-xl bg-yellow-900/20 border border-yellow-500 p-4">
          <div className="flex items-start gap-3">
            <svg
              className="h-6 w-6 text-yellow-400 flex-shrink-0"
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
              <h3 className="font-semibold text-yellow-400">Payment Issue</h3>
              <p className="text-sm text-yellow-200 mt-1">
                Your payment failed. Please update your payment method to continue your subscription.
              </p>
              <button
                onClick={handleManageSubscription}
                className="mt-3 text-sm font-medium text-yellow-400 hover:text-yellow-300 underline"
              >
                Update Payment Method
              </button>
            </div>
          </div>
        </div>
      )}

      {isCanceled && (
        <div className="rounded-xl bg-gray-900/20 border border-gray-500 p-4">
          <div className="flex items-start gap-3">
            <svg
              className="h-6 w-6 text-gray-400 flex-shrink-0"
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
              <h3 className="font-semibold text-gray-300">Subscription Canceled</h3>
              <p className="text-sm text-gray-400 mt-1">
                Your subscription has been canceled. You can continue using your current plan until the end of the billing period.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Current Plan Card */}
      <div className="glass-morphism rounded-2xl p-6 border-2 border-blue-500/50">
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-3">
              <h3 className="text-2xl font-bold">{currentTier.name}</h3>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                Current Plan
              </span>
            </div>
            <p className="text-gray-400 mt-2">{currentTier.description}</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">${currentTier.price}</div>
            <div className="text-sm text-gray-400">/month</div>
          </div>
        </div>

        {/* Features */}
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-gray-300 mb-3">What&apos;s included:</h4>
          <ul className="space-y-2">
            {currentTier.features.map((feature, index) => (
              <li key={index} className="flex items-start gap-2 text-sm">
                <svg
                  className="h-5 w-5 text-green-400 flex-shrink-0"
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
                <span className="text-gray-300">{feature}</span>
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
              className="flex-1 rounded-lg bg-white/10 px-4 py-3 font-semibold hover:bg-white/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {actionLoading ? 'Loading...' : 'Manage Subscription'}
            </button>
          )}
          {isFree && (
            <button
              onClick={handleUpgrade}
              className="flex-1 rounded-lg bg-blue-500 px-4 py-3 font-semibold hover:bg-blue-600 transition"
            >
              Upgrade Plan
            </button>
          )}
          {!isFree && (
            <button
              onClick={handleUpgrade}
              className="flex-1 rounded-lg bg-blue-500 px-4 py-3 font-semibold hover:bg-blue-600 transition"
            >
              {subscription.tier === 'executive' ? 'View All Plans' : 'Upgrade Plan'}
            </button>
          )}
        </div>
      </div>

      {/* Other Available Plans */}
      <div>
        <h3 className="text-xl font-semibold mb-4">Other Available Plans</h3>
        <div className="grid gap-4 md:grid-cols-2">
          {(Object.entries(TIER_INFO) as [SubscriptionTier, typeof TIER_INFO[SubscriptionTier]][])
            .filter(([tier]) => tier !== subscription.tier)
            .map(([tier, info]) => (
              <div
                key={tier}
                className="glass-morphism rounded-xl p-4 border border-gray-700 hover:border-gray-600 transition"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-bold text-lg">{info.name}</h4>
                    <p className="text-xs text-gray-400 mt-1">{info.description}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold">${info.price}</div>
                    <div className="text-xs text-gray-400">/mo</div>
                  </div>
                </div>
                <ul className="space-y-1 mb-4">
                  {info.features.slice(0, 3).map((feature, index) => (
                    <li key={index} className="flex items-start gap-2 text-xs">
                      <span className="text-green-400 mt-0.5">✓</span>
                      <span className="text-gray-400">{feature}</span>
                    </li>
                  ))}
                  {info.features.length > 3 && (
                    <li className="text-xs text-gray-500 ml-5">
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
        <div className="rounded-xl bg-red-900/20 border border-red-500 p-4 text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}
