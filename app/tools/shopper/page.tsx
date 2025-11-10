/**
 * PERSONAL SHOPPER TOOL
 * PURPOSE: Amazon product search and recommendations
 */

'use client';

import { ToolLauncher, type ToolConfig } from '@/components/tools/ToolLauncher';

const SHOPPER_CONFIG: ToolConfig = {
  id: 'shopper',
  icon: '🛒',
  title: 'Personal Shopper',
  description: 'Find the perfect products on Amazon with AI-powered recommendations.',
  fields: [
    {
      name: 'product',
      label: 'What are you looking for?',
      type: 'textarea',
      placeholder: 'Describe what you want to buy...\ne.g., Wireless headphones with noise cancellation for working from home...',
      required: true,
      rows: 3,
    },
    {
      name: 'budget',
      label: 'Budget Range',
      type: 'select',
      required: true,
      options: [
        { value: 'under-25', label: 'Under $25' },
        { value: '25-50', label: '$25 - $50' },
        { value: '50-100', label: '$50 - $100' },
        { value: '100-250', label: '$100 - $250' },
        { value: '250-500', label: '$250 - $500' },
        { value: 'over-500', label: 'Over $500' },
        { value: 'any', label: 'Any budget' },
      ],
    },
    {
      name: 'priority',
      label: 'Priority',
      type: 'select',
      required: true,
      options: [
        { value: 'best-value', label: 'Best Value' },
        { value: 'top-rated', label: 'Top Rated' },
        { value: 'premium', label: 'Premium Quality' },
        { value: 'budget', label: 'Budget Friendly' },
        { value: 'eco-friendly', label: 'Eco-Friendly' },
      ],
    },
    {
      name: 'preferences',
      label: 'Additional Preferences',
      type: 'textarea',
      placeholder: 'Any specific features, brands, or requirements? (optional)\ne.g., Must be wireless, prefer Sony or Bose, need long battery life...',
      rows: 3,
    },
  ],
  examples: [
    'Gaming laptop under $1000',
    'Kitchen gadgets for home chef',
    'Office chair for comfort',
  ],
};

export default function ShopperPage() {
  return <ToolLauncher config={SHOPPER_CONFIG} />;
}
