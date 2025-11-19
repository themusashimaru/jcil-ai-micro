/**
 * SETTINGS PAGE
 *
 * PURPOSE:
 * - User profile and preferences management
 * - Membership/subscription management
 * - Profile enrichment (education, tone, goals, websites/socials)
 * - Model preferences, safety level, data export/delete
 * - Device/session management with revoke capability
 *
 * PUBLIC ROUTES:
 * - /settings (requires authentication)
 *
 * SERVER ACTIONS:
 * - Update user profile
 * - Update preferences
 * - Export user data
 * - Delete user account
 * - Revoke sessions
 *
 * SECURITY/RLS NOTES:
 * - Protected route: auth required
 * - RLS: users can only update their own profile
 * - Data export includes all user chats, settings
 * - Account deletion cascades to all user data
 *
 * RATE LIMITS:
 * - Data export: 1/hour per user
 * - Profile updates: 10/hour per user
 *
 * DEPENDENCIES/ENVS:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import MembershipSection from '@/app/components/MembershipSection';
import UsageMetricsSection from '@/app/components/UsageMetricsSection';

type TabId = 'membership' | 'usage' | 'preferences' | 'privacy';

interface Tab {
  id: TabId;
  label: string;
  icon: string;
}

const TABS: Tab[] = [
  { id: 'membership', label: 'Membership', icon: '💳' },
  { id: 'usage', label: 'Usage & Metrics', icon: '📊' },
  { id: 'preferences', label: 'Preferences', icon: '⚙️' },
  { id: 'privacy', label: 'Data & Privacy', icon: '🔒' },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('membership');

  return (
    <div className="min-h-screen bg-black p-4 md:p-8">
      <div className="mx-auto max-w-6xl">
        {/* Header with Back to Chat button */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Settings</h1>
          <Link
            href="/chat"
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Chat
          </Link>
        </div>

        {/* Tabs Navigation */}
        <div className="mb-8 flex flex-wrap gap-2 border-b border-white/10">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-3 font-semibold transition relative ${
                activeTab === tab.id
                  ? 'text-blue-400'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"></div>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {activeTab === 'membership' && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold mb-2">Membership & Billing</h2>
                <p className="text-gray-400">
                  Manage your subscription, view current plan, and upgrade or downgrade.
                </p>
              </div>
              <MembershipSection />
            </div>
          )}

          {activeTab === 'usage' && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold mb-2">Usage & Metrics</h2>
                <p className="text-gray-400">
                  Track your daily message and image usage across all features.
                </p>
              </div>
              <UsageMetricsSection />
            </div>
          )}

          {activeTab === 'preferences' && (
            <section className="glass-morphism rounded-2xl p-6">
              <h2 className="mb-4 text-xl font-semibold">Preferences</h2>
              <p className="text-gray-400">Model and safety preferences coming soon</p>
              <div className="mt-4 space-y-3 text-sm text-gray-500">
                <p>Future features will include:</p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>AI model selection</li>
                  <li>Response tone preferences</li>
                  <li>Safety and content filtering levels</li>
                  <li>Language preferences</li>
                  <li>Notification settings</li>
                </ul>
              </div>
            </section>
          )}

          {activeTab === 'privacy' && (
            <section className="glass-morphism rounded-2xl p-6">
              <h2 className="mb-4 text-xl font-semibold">Data & Privacy</h2>
              <p className="text-gray-400 mb-6">
                Manage your data, export conversations, or delete your account.
              </p>
              <div className="space-y-4">
                <div>
                  <button className="rounded-lg bg-white/10 px-6 py-3 font-semibold hover:bg-white/20 transition">
                    Export My Data
                  </button>
                  <p className="text-xs text-gray-500 mt-2">
                    Download all your conversations and settings as a JSON file
                  </p>
                </div>
                <div>
                  <button className="rounded-lg bg-red-600/20 px-6 py-3 font-semibold text-red-400 hover:bg-red-600/30 transition">
                    Delete Account
                  </button>
                  <p className="text-xs text-gray-500 mt-2">
                    Permanently delete your account and all associated data
                  </p>
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
