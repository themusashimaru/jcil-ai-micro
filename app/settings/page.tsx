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

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import MembershipSection from '@/app/components/MembershipSection';
import UsageMetricsSection from '@/app/components/UsageMetricsSection';
import AccountSection from '@/app/components/AccountSection';
import SupportSection from '@/app/components/SupportSection';
import ConnectorsSection from '@/app/components/ConnectorsSection';
import BYOKSection from '@/app/components/BYOKSection';
import MemoryFeedbackSection from '@/app/components/MemoryFeedbackSection';

type TabId =
  | 'membership'
  | 'usage'
  | 'account'
  | 'support'
  | 'preferences'
  | 'privacy'
  | 'connectors'
  | 'byok'
  | 'memory';

interface Tab {
  id: TabId;
  label: string;
  icon: string;
}

const TABS: Tab[] = [
  { id: 'membership', label: 'Membership', icon: '💳' },
  { id: 'usage', label: 'Usage & Metrics', icon: '📊' },
  { id: 'account', label: 'Account', icon: '👤' },
  { id: 'connectors', label: 'Connectors', icon: '🔗' },
  { id: 'byok', label: 'BYOK API Keys', icon: '🔑' },
  { id: 'memory', label: 'AI Memory', icon: '🧠' },
  { id: 'support', label: 'Support', icon: '💬' },
  { id: 'preferences', label: 'Preferences', icon: '⚙️' },
  { id: 'privacy', label: 'Data & Privacy', icon: '🔒' },
];

// Wrapper component to handle suspense for useSearchParams
function SettingsContent() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabId>('membership');
  const [exporting, setExporting] = useState(false);

  // Handle tab from URL query param (e.g., /settings?tab=connectors)
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && TABS.some((t) => t.id === tabParam)) {
      setActiveTab(tabParam as TabId);
    }
  }, [searchParams]);

  const handleExportData = async () => {
    try {
      setExporting(true);
      const response = await fetch('/api/user/export');

      if (!response.ok) {
        throw new Error('Failed to export data');
      }

      // Get the blob and create download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `jcil-ai-data-export-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export data. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8" style={{ backgroundColor: 'var(--background)' }}>
      <div className="mx-auto max-w-6xl">
        {/* Header with navigation buttons */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Settings
          </h1>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/code-lab"
              className="flex items-center gap-2 px-3 sm:px-4 py-2 border rounded-lg font-medium transition-colors text-sm sm:text-base"
              style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              Code Lab
            </Link>
            <Link
              href="/chat"
              className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg font-medium transition-colors text-sm sm:text-base btn-primary"
              style={{ backgroundColor: 'var(--primary)', color: 'var(--background)' }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              Chat
            </Link>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div
          className="mb-8 flex flex-wrap gap-2"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-2 px-6 py-3 font-semibold transition relative"
              style={{
                color: activeTab === tab.id ? 'var(--primary)' : 'var(--text-primary)',
                opacity: activeTab === tab.id ? 1 : 0.85,
              }}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {activeTab === tab.id && (
                <div
                  className="absolute bottom-0 left-0 right-0 h-0.5"
                  style={{ backgroundColor: 'var(--primary)' }}
                ></div>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {activeTab === 'membership' && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                  Membership & Billing
                </h2>
                <p style={{ color: 'var(--text-secondary)' }}>
                  Manage your subscription, view current plan, and upgrade or downgrade.
                </p>
              </div>
              <MembershipSection />
            </div>
          )}

          {activeTab === 'usage' && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                  Usage & Metrics
                </h2>
                <p style={{ color: 'var(--text-secondary)' }}>
                  Track your daily message and image usage across all features.
                </p>
              </div>
              <UsageMetricsSection />
            </div>
          )}

          {activeTab === 'account' && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                  Account Settings
                </h2>
                <p style={{ color: 'var(--text-secondary)' }}>
                  Manage your email address and password.
                </p>
              </div>
              <AccountSection />
            </div>
          )}

          {activeTab === 'connectors' && <ConnectorsSection />}

          {activeTab === 'support' && <SupportSection />}

          {activeTab === 'byok' && <BYOKSection />}

          {activeTab === 'memory' && <MemoryFeedbackSection />}

          {activeTab === 'preferences' && (
            <section className="glass-morphism rounded-2xl p-6">
              <h2 className="mb-4 text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                Preferences
              </h2>
              <p style={{ color: 'var(--text-secondary)' }}>
                Model and safety preferences coming soon
              </p>
              <div className="mt-4 space-y-3 text-sm" style={{ color: 'var(--text-muted)' }}>
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
              <h2 className="mb-4 text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                Data & Privacy
              </h2>
              <p className="mb-6" style={{ color: 'var(--text-secondary)' }}>
                Export all your conversations and account data.
              </p>
              <div className="space-y-4">
                <div>
                  <button
                    onClick={handleExportData}
                    disabled={exporting}
                    className="rounded-lg px-6 py-3 font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 btn-primary"
                    style={{ backgroundColor: 'var(--primary)', color: 'var(--background)' }}
                  >
                    {exporting ? 'Exporting...' : 'Export My Data'}
                  </button>
                  <p className="text-xs text-gray-500 mt-2">
                    Download all your conversations, messages, and account info as a CSV file (opens
                    in Excel)
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

// Main page component with Suspense boundary for useSearchParams
export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen p-4 md:p-8 flex items-center justify-center"
          style={{ backgroundColor: 'var(--background)' }}
        >
          <div className="text-center">
            <div
              className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-4"
              style={{ borderColor: 'var(--primary)' }}
            ></div>
            <p style={{ color: 'var(--text-secondary)' }}>Loading settings...</p>
          </div>
        </div>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}
