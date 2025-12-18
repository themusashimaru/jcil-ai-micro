/**
 * PRICING SECTION COMPONENT
 * PURPOSE: Display subscription tiers and handle Stripe checkout
 */

'use client';

import { useState, useEffect } from 'react';

type PricingTier = 'plus' | 'pro' | 'executive';

interface PricingCardProps {
  tier: PricingTier;
  title: string;
  description: string;
  price: number;
  firstMonthPrice: number;
  features: string[];
  popular?: boolean;
  onSubscribe: (tier: PricingTier) => void;
  loading: boolean;
}

function PricingCard({
  tier,
  title,
  description,
  price,
  firstMonthPrice,
  features,
  popular = false,
  onSubscribe,
  loading,
}: PricingCardProps) {
  // Landing page colors - consistent navy blue branding
  const navyBlue = '#1e3a5f';
  const navyBlueLight = '#2d4a6f';

  return (
    <div
      className="rounded-2xl p-6 sm:p-8 relative flex flex-col bg-white shadow-lg"
      style={{
        border: popular ? `2px solid ${navyBlue}` : '1px solid #e2e8f0',
      }}
    >
      {/* Popular Badge */}
      {popular && (
        <div
          className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-sm font-semibold text-white"
          style={{ background: `linear-gradient(to right, ${navyBlue}, ${navyBlueLight})` }}
        >
          MOST POPULAR
        </div>
      )}

      {/* 50% Off First Month Badge */}
      <div className="mb-4 -mt-2">
        <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-sm">
          50% OFF FIRST MONTH
        </span>
      </div>

      <h3 className="mb-2 text-xl sm:text-2xl font-bold text-slate-900">{title}</h3>
      <p className="mb-4 text-sm sm:text-base text-slate-600">{description}</p>
      <div className="mb-2">
        <span className="text-4xl sm:text-5xl font-bold text-slate-900">${firstMonthPrice}</span>
        <span className="text-slate-600"> first month</span>
      </div>
      <div className="mb-6">
        <span className="text-sm line-through text-slate-400">${price}/mo</span>
        <span className="text-sm ml-2 text-slate-600">then ${price}/mo</span>
      </div>
      <ul className="mb-8 space-y-3 text-sm flex-1">
        {features.map((feature, index) => (
          <li key={index} className="flex items-start text-slate-700">
            <span className="mr-2 mt-0.5 flex-shrink-0 text-green-500">✓</span>
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <button
        onClick={() => onSubscribe(tier)}
        disabled={loading}
        className="block w-full rounded-lg py-3 text-center font-semibold text-white transition hover:shadow-lg hover:shadow-blue-900/25"
        style={{
          background: `linear-gradient(to right, ${navyBlue}, ${navyBlueLight})`,
          opacity: loading ? 0.5 : 1,
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? 'Processing...' : 'Get Started'}
      </button>
    </div>
  );
}

export default function PricingSection() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset loading state when user navigates back (browser back button)
  useEffect(() => {
    const handlePageShow = (event: PageTransitionEvent) => {
      // If page was restored from bfcache, reset loading state
      if (event.persisted) {
        setLoading(false);
        setError(null);
      }
    };

    // Also reset on visibility change (tab switching)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setLoading(false);
      }
    };

    window.addEventListener('pageshow', handlePageShow);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('pageshow', handlePageShow);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const handleSubscribe = async (tier: PricingTier) => {
    try {
      setLoading(true);
      setError(null);

      // Create checkout session
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tier }),
      });

      if (!response.ok) {
        const data = await response.json();
        if (response.status === 401) {
          // User not logged in, redirect to signup
          window.location.href = '/signup';
          return;
        }
        throw new Error(data.error || 'Failed to create checkout session');
      }

      const { url } = await response.json();
      if (url) {
        // Redirect to Stripe Checkout
        window.location.href = url;
      }
    } catch (err) {
      console.error('[Pricing] Error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  };

  const pricingTiers = [
    {
      tier: 'plus' as PricingTier,
      title: 'Plus',
      description: 'Essential tools for everyday faith and life',
      price: 18,
      firstMonthPrice: 9,
      features: [
        'Intelligent AI chat assistant',
        'Real-time web search with citations',
        'Code execution & data analysis',
        'Resume & cover letter writing',
        'Writing tools & Bible study',
        'Daily devotional content',
      ],
    },
    {
      tier: 'pro' as PricingTier,
      title: 'Pro',
      description: 'Advanced tools for working professionals',
      price: 30,
      firstMonthPrice: 15,
      features: [
        'Everything in Plus',
        '3M token context window',
        'Enhanced fact-checking & research',
        'Advanced document generation',
        'Advanced coding assistance',
        'Priority processing',
      ],
      popular: true,
    },
    {
      tier: 'executive' as PricingTier,
      title: 'Executive',
      description: 'Highest intelligence AI for power users',
      price: 99,
      firstMonthPrice: 49,
      features: [
        'Everything in Pro',
        'Highest intelligence AI model',
        '5x more usage capacity',
        'Early access to experimental models',
        'New feature previews',
        'Priority support',
      ],
    },
  ];

  return (
    <section className="container mx-auto px-4 py-12 sm:py-20" id="pricing">
      {/* Limited Time Offer Banner */}
      <div className="mb-8 mx-auto max-w-2xl">
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl p-4 text-center text-white shadow-lg">
          <p className="text-sm font-medium mb-1">LIMITED TIME OFFER</p>
          <p className="text-lg font-bold">50% OFF Your First Month - All Plans!</p>
        </div>
      </div>

      <h2 className="mb-4 text-center text-3xl sm:text-4xl font-bold text-slate-900">Simple, Transparent Pricing</h2>
      <p className="mb-2 text-center text-sm sm:text-base text-slate-600">Choose the plan that fits your needs</p>
      <p className="mb-8 sm:mb-12 text-center text-sm text-slate-500">Cancel anytime. No hidden fees.</p>

      {error && (
        <div className="mb-8 mx-auto max-w-2xl rounded-lg p-4 bg-red-50 border border-red-200 text-red-600">
          {error}
        </div>
      )}

      <div className="grid gap-8 md:grid-cols-3 max-w-5xl mx-auto">
        {pricingTiers.map((tierData) => (
          <PricingCard
            key={tierData.tier}
            {...tierData}
            onSubscribe={handleSubscribe}
            loading={loading}
          />
        ))}
      </div>

      {/* Trust Note */}
      <div className="mt-12 text-center">
        <p className="text-sm text-slate-500">
          Secure payment powered by Stripe. Your payment information is never stored on our servers.
        </p>
      </div>
    </section>
  );
}
