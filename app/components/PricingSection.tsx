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
  return (
    <div
      className="glass-morphism rounded-2xl p-6 sm:p-8 relative flex flex-col"
      style={{
        border: popular ? '2px solid var(--primary)' : '1px solid var(--border)',
      }}
    >
      {/* Popular Badge */}
      {popular && (
        <div
          className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-sm font-semibold"
          style={{ backgroundColor: 'var(--primary)', color: 'var(--background)' }}
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

      <h3 className="mb-2 text-xl sm:text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
      <p className="mb-4 text-sm sm:text-base" style={{ color: 'var(--text-secondary)' }}>{description}</p>
      <div className="mb-2">
        <span className="text-4xl sm:text-5xl font-bold" style={{ color: 'var(--text-primary)' }}>${firstMonthPrice}</span>
        <span style={{ color: 'var(--text-secondary)' }}> first month</span>
      </div>
      <div className="mb-6">
        <span className="text-sm line-through" style={{ color: 'var(--text-muted)' }}>${price}/mo</span>
        <span className="text-sm ml-2" style={{ color: 'var(--text-secondary)' }}>then ${price}/mo</span>
      </div>
      <ul className="mb-8 space-y-3 text-sm flex-1">
        {features.map((feature, index) => (
          <li key={index} className="flex items-start" style={{ color: 'var(--text-primary)' }}>
            <span className="mr-2 mt-0.5 flex-shrink-0" style={{ color: 'rgb(74, 222, 128)' }}>✓</span>
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <button
        onClick={() => onSubscribe(tier)}
        disabled={loading}
        className="block w-full rounded-lg py-3 text-center font-semibold transition hover:opacity-90"
        style={{
          backgroundColor: 'var(--primary)',
          color: 'var(--background)',
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
        'Real-time fact-checking with Perplexity',
        'Resume & cover letter writing',
        'Live web search & research',
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

      <h2 className="mb-4 text-center text-3xl sm:text-4xl font-bold" style={{ color: 'var(--text-primary)' }}>Simple, Transparent Pricing</h2>
      <p className="mb-2 text-center text-sm sm:text-base" style={{ color: 'var(--text-secondary)' }}>Choose the plan that fits your needs</p>
      <p className="mb-8 sm:mb-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Cancel anytime. No hidden fees.</p>

      {error && (
        <div className="mb-8 mx-auto max-w-2xl rounded-lg p-4" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgb(239, 68, 68)', color: 'rgb(248, 113, 113)' }}>
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
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Secure payment powered by Stripe. Your payment information is never stored on our servers.
        </p>
      </div>
    </section>
  );
}
