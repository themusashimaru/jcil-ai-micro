/**
 * PRICING SECTION COMPONENT
 * PURPOSE: Display subscription tiers and handle Stripe checkout
 */

'use client';

import { useState } from 'react';

type PricingTier = 'free' | 'basic' | 'pro' | 'executive';

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
  const isFree = tier === 'free';
  const borderClass = popular
    ? 'border-2 border-blue-500 relative'
    : 'border border-gray-700';

  return (
    <div className={`glass-morphism rounded-2xl p-8 ${borderClass}`}>
      {popular && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-500 px-4 py-1 rounded-full text-sm font-semibold">
          POPULAR
        </div>
      )}
      <h3 className="mb-2 text-2xl font-bold">{title}</h3>
      <p className="mb-4 text-gray-400">{description}</p>
      <div className="mb-6">
        <span className="text-5xl font-bold">${price}</span>
        <span className="text-gray-400">/month</span>
      </div>
      <ul className="mb-8 space-y-3 text-sm">
        {features.map((feature, index) => (
          <li key={index} className="flex items-center">
            <span className="mr-2 text-green-400">✓</span>
            {feature}
          </li>
        ))}
      </ul>
      <button
        onClick={() => onSubscribe(tier)}
        disabled={loading}
        className={`block w-full rounded-lg py-3 text-center font-semibold transition ${
          isFree
            ? 'bg-gray-700 hover:bg-gray-600'
            : popular
              ? 'bg-blue-500 hover:bg-blue-400'
              : 'bg-blue-600 hover:bg-blue-500'
        } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {loading ? 'Processing...' : isFree ? 'Start Free' : 'Get Started'}
      </button>
    </div>
  );
}

export default function PricingSection() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubscribe = async (tier: PricingTier) => {
    console.log('[PricingSection] Button clicked, tier:', tier);

    if (tier === 'free') {
      // Redirect to signup for free tier
      console.log('[PricingSection] Redirecting to signup...');
      window.location.href = '/signup';
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log('[PricingSection] Creating checkout session for tier:', tier);

      // Create checkout session
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tier }),
      });

      console.log('[PricingSection] Checkout response status:', response.status);

      if (!response.ok) {
        const data = await response.json();
        if (response.status === 401) {
          // User not logged in, redirect to signup
          console.log('[PricingSection] Not authenticated, redirecting to signup...');
          window.location.href = '/signup';
          return;
        }
        throw new Error(data.error || 'Failed to create checkout session');
      }

      const { url } = await response.json();
      console.log('[PricingSection] Checkout URL:', url);

      if (url) {
        // Redirect to Stripe Checkout
        console.log('[PricingSection] Redirecting to Stripe...');
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
      tier: 'free' as PricingTier,
      title: 'Free',
      description: 'Get started with basic access',
      price: 0,
      features: ['10 messages per day', 'Basic AI responses', '6-month data retention'],
    },
    {
      tier: 'basic' as PricingTier,
      title: 'Basic',
      description: 'For regular users',
      price: 12,
      features: ['100 messages per day', 'Enhanced AI responses', 'Priority support'],
    },
    {
      tier: 'pro' as PricingTier,
      title: 'Pro',
      description: 'For power users',
      price: 20,
      features: [
        '200 messages per day',
        'Premium AI responses',
        '5 image generations/day',
        'Priority support',
      ],
      popular: true,
    },
    {
      tier: 'executive' as PricingTier,
      title: 'Executive',
      description: 'Unlimited access',
      price: 150,
      features: [
        '1,000 messages per day',
        'Premium AI responses',
        '10 image generations/day',
        'Dedicated support',
      ],
    },
  ];

  return (
    <section className="container mx-auto px-4 py-20" id="pricing">
      <h2 className="mb-4 text-center text-4xl font-bold">Simple, Transparent Pricing</h2>
      <p className="mb-12 text-center text-gray-300">Choose the plan that fits your needs</p>

      {error && (
        <div className="mb-8 mx-auto max-w-2xl rounded-lg bg-red-900/20 border border-red-500 p-4 text-red-400">
          {error}
        </div>
      )}

      <div className="grid gap-8 md:grid-cols-4 max-w-7xl mx-auto">
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
