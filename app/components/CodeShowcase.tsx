/**
 * CODE SHOWCASE COMPONENT
 *
 * PURPOSE:
 * - Show multiple coding capability demos
 * - Demonstrate AI coding features without revealing the underlying model
 * - Blue/dark theme matching the chat experience
 */

'use client';

import { useState, useEffect } from 'react';

interface CodeExample {
  id: string;
  title: string;
  icon: string;
  userPrompt: string;
  aiResponse: string;
  codeOutput?: string;
  language?: string;
}

const CODE_EXAMPLES: CodeExample[] = [
  {
    id: 'execution',
    title: 'Live Code Execution',
    icon: '⚡',
    userPrompt:
      'Calculate the compound interest on a $10,000 investment at 7% annual rate over 30 years with monthly compounding. Show me the growth chart.',
    aiResponse: `I'll calculate this using Python and show you exactly how your investment grows:`,
    language: 'python',
    codeOutput: `# Compound Interest Calculator with Visualization
import numpy as np

def compound_interest(principal, rate, years, compounds_per_year=12):
    """Calculate compound interest with monthly compounding."""
    months = years * compounds_per_year
    monthly_rate = rate / compounds_per_year

    balances = []
    balance = principal

    for month in range(months + 1):
        balances.append(balance)
        balance = balance * (1 + monthly_rate)

    return balances

# Calculate growth
principal = 10000
annual_rate = 0.07
years = 30

balances = compound_interest(principal, annual_rate, years)

# Display results
print("Investment Growth Summary")
print("=" * 40)
print("Initial Investment: $10,000.00")
print("Interest Rate: 7.0% annually")
print("Compounding: Monthly")
print()
print("Milestone Values:")
print("  Year 5:  $   14,176.25")
print("  Year 10: $   20,096.61")
print("  Year 20: $   40,387.39")
print("  Year 30: $   81,164.97")
print()
print("Total Growth: $71,164.97")
print("Return: 711.6%")

# >>> Output:
# Investment Growth Summary
# ========================================
# Initial Investment: $10,000.00
# Interest Rate: 7.0% annually
# Compounding: Monthly
#
# Milestone Values:
#   Year 5:  $   14,176.25
#   Year 10: $   20,096.61
#   Year 20: $   40,387.39
#   Year 30: $   81,164.97
#
# Total Growth: $71,164.97
# Return: 711.6%`,
  },
  {
    id: 'fullstack',
    title: 'Full-Stack App Generation',
    icon: '🚀',
    userPrompt:
      'Build me a React dashboard with a dark theme that shows sales metrics, has animated charts, and a sidebar navigation',
    aiResponse: `I'll create a complete React dashboard for you with all those features. Here's the implementation:`,
    language: 'tsx',
    codeOutput: `// Dashboard.tsx
import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';
import { motion } from 'framer-motion';

const salesData = [
  { month: 'Jan', sales: 4000, revenue: 2400 },
  { month: 'Feb', sales: 3000, revenue: 1398 },
  { month: 'Mar', sales: 5000, revenue: 9800 },
  { month: 'Apr', sales: 2780, revenue: 3908 },
];

export default function Dashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex min-h-screen bg-slate-900">
      {/* Animated Sidebar */}
      <motion.aside
        initial={{ width: 240 }}
        animate={{ width: sidebarOpen ? 240 : 80 }}
        className="bg-slate-800 border-r border-slate-700"
      >
        <nav className="p-4 space-y-2">
          <NavItem icon="📊" label="Dashboard" active />
          <NavItem icon="💰" label="Sales" />
          <NavItem icon="👥" label="Customers" />
          <NavItem icon="⚙️" label="Settings" />
        </nav>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 p-8">
        <h1 className="text-2xl font-bold text-white mb-8">
          Sales Dashboard
        </h1>

        {/* Metrics Grid */}
        <div className="grid grid-cols-3 gap-6 mb-8">
          <MetricCard
            title="Total Revenue"
            value="$124,592"
            change="+12.5%"
            positive
          />
          <MetricCard
            title="Active Users"
            value="8,492"
            change="+8.2%"
            positive
          />
          <MetricCard
            title="Conversion"
            value="3.24%"
            change="-0.4%"
          />
        </div>

        {/* Animated Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-800 rounded-xl p-6"
        >
          <LineChart width={800} height={300} data={salesData}>
            <XAxis dataKey="month" stroke="#94a3b8" />
            <YAxis stroke="#94a3b8" />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="sales"
              stroke="#3b82f6"
              strokeWidth={2}
            />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke="#10b981"
              strokeWidth={2}
            />
          </LineChart>
        </motion.div>
      </main>
    </div>
  );
}`,
  },
  {
    id: 'debug',
    title: 'Intelligent Debugging',
    icon: '🔍',
    userPrompt:
      "My React app crashes when I click the submit button. Here's the error: \"Cannot read property 'map' of undefined\" in UserList.jsx line 12",
    aiResponse: `I can see the issue! The error occurs because \`users\` is undefined when the component first renders. Here's the fix:

**Problem:** You're trying to map over \`users\` before the data loads.

**Solution:** Add a loading state and null check:`,
    language: 'jsx',
    codeOutput: `// ❌ Before (Broken)
function UserList() {
  const [users, setUsers] = useState(); // undefined!

  useEffect(() => {
    fetchUsers().then(setUsers);
  }, []);

  return (
    <ul>
      {users.map(user => ( // 💥 Crashes here!
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}

// ✅ After (Fixed)
function UserList() {
  const [users, setUsers] = useState([]); // Initialize as empty array
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers()
      .then(setUsers)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (users.length === 0) return <EmptyState />;

  return (
    <ul>
      {users.map(user => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}`,
  },
  {
    id: 'api',
    title: 'API Integration',
    icon: '🔌',
    userPrompt:
      'Create a TypeScript function that fetches weather data, handles errors gracefully, implements caching, and has proper types',
    aiResponse: `Here's a production-ready weather API client with caching, error handling, and full TypeScript types:`,
    language: 'typescript',
    codeOutput: `// weather-client.ts
interface WeatherData {
  temperature: number;
  humidity: number;
  description: string;
  icon: string;
  location: string;
  timestamp: Date;
}

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

class WeatherError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'WeatherError';
  }
}

const cache = new Map<string, CacheEntry<WeatherData>>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export async function getWeather(
  city: string,
  options?: { bypassCache?: boolean }
): Promise<WeatherData> {
  const cacheKey = city.toLowerCase();

  // Check cache first
  if (!options?.bypassCache) {
    const cached = cache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }
  }

  try {
    const response = await fetch(
      \`https://api.weather.com/v1/\${encodeURIComponent(city)}\`,
      {
        headers: {
          'Authorization': \`Bearer \${process.env.WEATHER_API_KEY}\`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new WeatherError(
        \`Weather API error: \${response.statusText}\`,
        response.status,
        response.status >= 500
      );
    }

    const data: WeatherData = await response.json();

    // Update cache
    cache.set(cacheKey, {
      data,
      expiry: Date.now() + CACHE_TTL,
    });

    return data;
  } catch (error) {
    if (error instanceof WeatherError) throw error;
    throw new WeatherError('Network error', undefined, true);
  }
}`,
  },
  {
    id: 'refactor',
    title: 'Code Refactoring',
    icon: '✨',
    userPrompt:
      'Refactor this messy function to be cleaner and more maintainable:\n\nfunction processOrder(o) { if(o.items.length>0){let t=0;for(let i=0;i<o.items.length;i++){t+=o.items[i].price*o.items[i].qty}if(o.coupon){if(o.coupon.type=="percent"){t=t-(t*o.coupon.value/100)}else{t=t-o.coupon.value}}if(t<0)t=0;return{total:t,items:o.items.length}} return null}',
    aiResponse: `Here's the refactored version with proper typing, separation of concerns, and clear logic:`,
    language: 'typescript',
    codeOutput: `// types.ts
interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface Coupon {
  code: string;
  type: 'percent' | 'fixed';
  value: number;
}

interface Order {
  items: OrderItem[];
  coupon?: Coupon;
}

interface OrderSummary {
  subtotal: number;
  discount: number;
  total: number;
  itemCount: number;
}

// order-processor.ts
function calculateSubtotal(items: OrderItem[]): number {
  return items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
}

function calculateDiscount(subtotal: number, coupon?: Coupon): number {
  if (!coupon) return 0;

  return coupon.type === 'percent'
    ? subtotal * (coupon.value / 100)
    : coupon.value;
}

export function processOrder(order: Order): OrderSummary | null {
  if (order.items.length === 0) {
    return null;
  }

  const subtotal = calculateSubtotal(order.items);
  const discount = calculateDiscount(subtotal, order.coupon);
  const total = Math.max(0, subtotal - discount);

  return {
    subtotal,
    discount,
    total,
    itemCount: order.items.length,
  };
}

// Usage
const result = processOrder({
  items: [
    { id: '1', name: 'Widget', price: 29.99, quantity: 2 },
    { id: '2', name: 'Gadget', price: 49.99, quantity: 1 },
  ],
  coupon: { code: 'SAVE20', type: 'percent', value: 20 },
});
// { subtotal: 109.97, discount: 21.99, total: 87.98, itemCount: 2 }`,
  },
  {
    id: 'database',
    title: 'Database Schema Design',
    icon: '🗃️',
    userPrompt:
      'Design a database schema for a SaaS app with multi-tenant support, subscription billing, and user roles',
    aiResponse: `Here's a complete PostgreSQL schema with multi-tenancy, RLS policies, and Stripe integration:`,
    language: 'sql',
    codeOutput: `-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Organizations (Tenants)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  stripe_customer_id VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subscription Plans
CREATE TABLE plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  stripe_price_id VARCHAR(255) NOT NULL,
  features JSONB DEFAULT '{}',
  max_users INT DEFAULT 5,
  price_monthly DECIMAL(10,2) NOT NULL,
  is_active BOOLEAN DEFAULT true
);

-- Subscriptions
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES plans(id),
  stripe_subscription_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'active',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  UNIQUE(organization_id)
);

-- User Roles Enum
CREATE TYPE user_role AS ENUM ('owner', 'admin', 'member', 'viewer');

-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  encrypted_password VARCHAR(255),
  name VARCHAR(255),
  avatar_url TEXT,
  email_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organization Memberships (Many-to-Many with Roles)
CREATE TABLE memberships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  role user_role DEFAULT 'member',
  invited_by UUID REFERENCES users(id),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, organization_id)
);

-- Row Level Security for Multi-Tenancy
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their organizations"
  ON organizations FOR SELECT
  USING (
    id IN (
      SELECT organization_id FROM memberships
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can update organization"
  ON organizations FOR UPDATE
  USING (
    id IN (
      SELECT organization_id FROM memberships
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- Indexes for Performance
CREATE INDEX idx_memberships_user ON memberships(user_id);
CREATE INDEX idx_memberships_org ON memberships(organization_id);
CREATE INDEX idx_subscriptions_org ON subscriptions(organization_id);`,
  },
];

function CodeBlock({ code, language }: { code: string; language: string }) {
  return (
    <div className="relative">
      <div className="absolute top-2 right-2 px-2 py-1 rounded text-xs font-mono bg-slate-600 text-slate-300">
        {language}
      </div>
      <pre className="bg-slate-900 rounded-lg p-4 overflow-x-auto text-sm">
        <code className="text-slate-300 font-mono whitespace-pre">{code}</code>
      </pre>
    </div>
  );
}

export default function CodeShowcase() {
  const [activeExample, setActiveExample] = useState(0);
  const [isTyping, setIsTyping] = useState(true);
  const [displayedCode, setDisplayedCode] = useState('');

  const example = CODE_EXAMPLES[activeExample];

  useEffect(() => {
    // Reset and start typing animation when example changes
    setIsTyping(true);
    setDisplayedCode('');

    const code = example.codeOutput || '';
    let currentIndex = 0;

    const typingInterval = setInterval(() => {
      if (currentIndex <= code.length) {
        setDisplayedCode(code.slice(0, currentIndex));
        currentIndex += 8; // Type faster for code
      } else {
        setIsTyping(false);
        clearInterval(typingInterval);
      }
    }, 5);

    return () => clearInterval(typingInterval);
  }, [activeExample, example.codeOutput]);

  return (
    <div className="w-full">
      {/* Example Selector Tabs */}
      <div className="flex flex-wrap gap-2 mb-6 justify-center">
        {CODE_EXAMPLES.map((ex, index) => (
          <button
            key={ex.id}
            onClick={() => setActiveExample(index)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeExample === index
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <span className="mr-2">{ex.icon}</span>
            {ex.title}
          </button>
        ))}
      </div>

      {/* Chat Demo Window */}
      <div className="max-w-4xl mx-auto">
        <div className="rounded-2xl overflow-hidden shadow-2xl shadow-blue-900/20 border border-slate-700/50">
          {/* Header */}
          <div className="bg-slate-800 px-4 py-3 flex items-center justify-between border-b border-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <svg
                  className="w-4 h-4 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                  />
                </svg>
              </div>
              <div>
                <p className="text-white font-medium text-sm">JCIL.AI Code Assistant</p>
                <p className="text-slate-400 text-xs">Powered by advanced AI</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 rounded-full bg-green-500/20 text-green-400 text-xs font-medium">
                Online
              </span>
            </div>
          </div>

          {/* Chat Content */}
          <div className="bg-gradient-to-b from-slate-900 to-slate-800 p-4 min-h-[500px] max-h-[700px] overflow-y-auto">
            {/* User Message */}
            <div className="flex justify-end mb-4">
              <div className="bg-blue-600 text-white px-4 py-3 rounded-2xl rounded-br-md max-w-[85%] shadow-lg">
                <p className="text-sm whitespace-pre-wrap">{example.userPrompt}</p>
              </div>
            </div>

            {/* AI Response */}
            <div className="flex justify-start">
              <div className="flex items-start gap-3 max-w-[95%]">
                {/* AI Avatar */}
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex-shrink-0 flex items-center justify-center shadow-lg">
                  <span className="text-white text-xs font-bold">AI</span>
                </div>

                {/* Message Bubble */}
                <div className="bg-slate-700/50 backdrop-blur-sm text-slate-200 px-4 py-3 rounded-2xl rounded-tl-md shadow-lg border border-slate-600/30 flex-1">
                  <p className="text-sm mb-4">{example.aiResponse}</p>

                  {/* Code Output */}
                  {example.codeOutput && (
                    <CodeBlock
                      code={displayedCode + (isTyping ? '▊' : '')}
                      language={example.language || 'code'}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Input Bar */}
          <div className="bg-slate-800 px-4 py-3 border-t border-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-slate-700/50 rounded-xl px-4 py-2.5 text-slate-400 text-sm">
                Describe what you want to build...
              </div>
              <button
                className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white hover:bg-blue-500 transition"
                aria-label="Send message"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
