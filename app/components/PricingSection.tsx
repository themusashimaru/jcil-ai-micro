/**
 * PRICING SECTION COMPONENT
 * PURPOSE: Display subscription tiers and handle Stripe checkout
 */

'use client';

import { useState } from 'react';

type PricingTier = 'basic' | 'pro' | 'executive';

interface PricingCardProps {
  tier: PricingTier;
  title: string;
  description: string;
  price: number;
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
  features,
  popular = false,
  onSubscribe,
  loading,
}: PricingCardProps) {
  return (
    <div
      className="glass-morphism rounded-2xl p-6 sm:p-8 relative"
      style={{
        border: popular ? '2px solid var(--primary)' : '1px solid var(--border)',
      }}
    >
      {popular && (
        <div
          className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-sm font-semibold"
          style={{ backgroundColor: 'var(--primary)', color: 'var(--background)' }}
        >
          POPULAR
        </div>
      )}
      <h3 className="mb-2 text-xl sm:text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
      <p className="mb-4 text-sm sm:text-base" style={{ color: 'var(--text-secondary)' }}>{description}</p>
      <div className="mb-6">
        <span className="text-4xl sm:text-5xl font-bold" style={{ color: 'var(--text-primary)' }}>${price}</span>
        <span style={{ color: 'var(--text-secondary)' }}>/month</span>
      </div>
      <ul className="mb-8 space-y-3 text-sm">
        {features.map((feature, index) => (
          <li key={index} className="flex items-center" style={{ color: 'var(--text-primary)' }}>
            <span className="mr-2" style={{ color: 'rgb(74, 222, 128)' }}>✓</span>
            {feature}
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
      tier: 'basic' as PricingTier,
      title: 'Basic',
      description: 'Essential tools for everyday faith and life',
      price: 12,
      features: [
        'Intelligent AI chat assistant',
        'Live web search & research',
        'Writing tools & Bible study',
        'Real-time news updates',
        'Daily devotional content',
        '25 image generations/month',
      ],
    },
    {
      tier: 'pro' as PricingTier,
      title: 'Pro',
      description: 'Advanced tools for working professionals',
      price: 30,
      features: [
        'Everything in Basic',
        '3x more usage capacity',
        'Enhanced live search & research',
        'Advanced writing & analysis tools',
        'Advanced coding assistance',
        '75 image generations/month',
      ],
      popular: true,
    },
    {
      tier: 'executive' as PricingTier,
      title: 'Executive',
      description: 'Highest intelligence AI for power users',
      price: 150,
      features: [
        'Everything in Pro',
        'Highest intelligence AI model',
        '5x more usage capacity',
        '100 image generations/month',
        'Premium coding & analysis tools',
        'Priority support',
      ],
    },
  ];

  return (
    <section className="container mx-auto px-4 py-12 sm:py-20" id="pricing">
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

    </section>
  );
}
