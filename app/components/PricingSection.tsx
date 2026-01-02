/**
 * PRICING SECTION COMPONENT
 * PURPOSE: Display subscription tiers and handle Stripe checkout
 * UPDATED: Dark theme compatible for agentic landing page
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
  return (
    <div
      className={`rounded-2xl p-6 sm:p-8 relative flex flex-col transition-all duration-300 hover:-translate-y-1 ${
        popular
          ? 'bg-gradient-to-br from-purple-900/80 to-blue-900/80 border-2 border-purple-500/50 shadow-xl shadow-purple-500/20'
          : 'bg-slate-800/80 border border-slate-700/50 hover:border-slate-600/50'
      }`}
    >
      {/* Popular Badge */}
      {popular && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-sm font-semibold text-white bg-gradient-to-r from-purple-600 to-blue-600 shadow-lg">
          MOST POPULAR
        </div>
      )}

      {/* 50% Off First Month Badge */}
      <div className="mb-4 -mt-2">
        <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-sm">
          50% OFF FIRST MONTH
        </span>
      </div>

      <h3 className="mb-2 text-xl sm:text-2xl font-bold text-white">{title}</h3>
      <p className="mb-4 text-sm sm:text-base text-slate-400">{description}</p>
      <div className="mb-2">
        <span className="text-4xl sm:text-5xl font-bold text-white">${firstMonthPrice}</span>
        <span className="text-slate-400"> first month</span>
      </div>
      <div className="mb-6">
        <span className="text-sm line-through text-slate-500">${price}/mo</span>
        <span className="text-sm ml-2 text-slate-400">then ${price}/mo</span>
      </div>
      <ul className="mb-8 space-y-3 text-sm flex-1">
        {features.map((feature, index) => (
          <li key={index} className="flex items-start text-slate-300">
            <span className="mr-2 mt-0.5 flex-shrink-0 text-green-400">✓</span>
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <button
        onClick={() => onSubscribe(tier)}
        disabled={loading}
        className={`block w-full rounded-xl py-3 text-center font-semibold text-white transition-all duration-300 ${
          popular
            ? 'bg-gradient-to-r from-purple-600 to-blue-600 hover:shadow-lg hover:shadow-purple-500/25'
            : 'bg-gradient-to-r from-slate-700 to-slate-600 hover:from-slate-600 hover:to-slate-500'
        } ${loading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
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
      if (event.persisted) {
        setLoading(false);
        setError(null);
      }
    };

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

      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      });

      if (!response.ok) {
        const data = await response.json();
        if (response.status === 401) {
          window.location.href = '/signup';
          return;
        }
        throw new Error(data.error || 'Failed to create checkout session');
      }

      const { url } = await response.json();
      if (url) {
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
      description: 'Essential AI tools for everyday development',
      price: 18,
      firstMonthPrice: 9,
      features: [
        'Intelligent AI chat assistant',
        'Real-time web search with citations',
        'Code execution & debugging',
        'GitHub repository integration',
        'Writing tools & documentation',
        'Persistent memory across sessions',
      ],
    },
    {
      tier: 'pro' as PricingTier,
      title: 'Pro',
      description: 'Full agent capabilities for serious developers',
      price: 30,
      firstMonthPrice: 15,
      features: [
        'Everything in Plus',
        'Project scaffolding & deployment',
        'Self-correcting code execution',
        'Full GitHub workflow (PRs, branches)',
        'Deep research & analysis mode',
        'Autonomous agent mode',
      ],
      popular: true,
    },
    {
      tier: 'executive' as PricingTier,
      title: 'Executive',
      description: 'Maximum power for enterprise & teams',
      price: 99,
      firstMonthPrice: 49,
      features: [
        'Everything in Pro',
        'Highest intelligence AI model',
        '5x more usage capacity',
        'Priority processing & support',
        'Early access to new features',
        'Custom integrations',
      ],
    },
  ];

  return (
    <section className="py-16 sm:py-24" id="pricing">
      <div className="container mx-auto px-4">
        {/* Limited Time Offer Banner */}
        <div className="mb-10 mx-auto max-w-2xl">
          <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl p-4 text-center text-white shadow-lg shadow-green-500/20">
            <p className="text-sm font-medium mb-1 text-green-100">LIMITED TIME OFFER</p>
            <p className="text-lg font-bold">50% OFF Your First Month - All Plans!</p>
          </div>
        </div>

        <h2 className="mb-4 text-center text-3xl sm:text-4xl font-bold text-white">
          Simple, Transparent Pricing
        </h2>
        <p className="mb-2 text-center text-slate-400">
          Choose the plan that fits your workflow
        </p>
        <p className="mb-10 sm:mb-14 text-center text-sm text-slate-500">
          Cancel anytime. No hidden fees. Start building today.
        </p>

        {error && (
          <div className="mb-8 mx-auto max-w-2xl rounded-lg p-4 bg-red-900/50 border border-red-500/50 text-red-200">
            {error}
          </div>
        )}

        <div className="grid gap-8 md:grid-cols-3 max-w-6xl mx-auto">
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
      </div>
    </section>
  );
}
