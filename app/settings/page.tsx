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

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';

const SectionLoading = () => (
  <div className="animate-pulse space-y-4 p-4" aria-busy="true" aria-label="Loading section">
    <div className="h-6 w-48 bg-border/20" />
    <div className="h-4 w-full bg-border/20 opacity-60" />
    <div className="h-4 w-3/4 bg-border/20 opacity-40" />
    <div className="h-32 bg-border/20 opacity-30" />
  </div>
);

/** Shown when a dynamic chunk fails to load (stale deployment, network error, etc.) */
function SectionLoadError({ name, onRetry }: { name: string; onRetry: () => void }) {
  return (
    <div className="border border-red-500/30 bg-red-500/5 p-6 text-center">
      <p className="font-mono text-xs text-red-400 mb-3">
        Failed to load {name}. This usually means the app was updated — try reloading.
      </p>
      <button
        onClick={onRetry}
        className="border border-accent bg-accent/10 px-4 py-2 font-mono text-xs uppercase tracking-widest text-accent hover:bg-accent/20 transition-all"
      >
        Reload Page
      </button>
    </div>
  );
}

/**
 * Safe dynamic import wrapper. If the chunk fails to load (e.g. stale deployment,
 * network error), render a fallback instead of crashing the React tree.
 */
function safeDynamic(
  importFn: () => Promise<{ default: React.ComponentType }>,
  name: string
) {
  return dynamic(
    () =>
      importFn().catch((err) => {
        console.error(`[Settings] Failed to load ${name}:`, err);
        return {
          default: () => (
            <SectionLoadError name={name} onRetry={() => window.location.reload()} />
          ),
        };
      }),
    { loading: SectionLoading, ssr: false }
  );
}

const MembershipSection = safeDynamic(
  () => import('@/app/components/MembershipSection'),
  'Membership'
);
const UsageMetricsSection = safeDynamic(
  () => import('@/app/components/UsageMetricsSection'),
  'Usage Metrics'
);
const AccountSection = safeDynamic(
  () => import('@/app/components/AccountSection'),
  'Account'
);
const SupportSection = safeDynamic(
  () => import('@/app/components/SupportSection'),
  'Support'
);
const ConnectorsSection = safeDynamic(
  () => import('@/app/components/ConnectorsSection'),
  'Connectors'
);
const BYOKSection = safeDynamic(
  () => import('@/app/components/BYOKSection'),
  'BYOK API Keys'
);
const MemoryFeedbackSection = safeDynamic(
  () => import('@/app/components/MemoryFeedbackSection'),
  'AI Memory'
);
const PreferencesSection = safeDynamic(
  () => import('@/app/components/PreferencesSection'),
  'Preferences'
);

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
  tag: string;
}

const TABS: Tab[] = [
  { id: 'membership', label: 'Membership', tag: 'PLAN' },
  { id: 'usage', label: 'Usage & Metrics', tag: 'DATA' },
  { id: 'account', label: 'Account', tag: 'USER' },
  { id: 'connectors', label: 'Connectors', tag: 'APPS' },
  { id: 'byok', label: 'BYOK API Keys', tag: 'KEYS' },
  { id: 'memory', label: 'AI Memory', tag: 'MEM' },
  { id: 'support', label: 'Support', tag: 'HELP' },
  { id: 'preferences', label: 'Preferences', tag: 'PREFS' },
  { id: 'privacy', label: 'Data & Privacy', tag: 'PRIV' },
];

/**
 * React class ErrorBoundary that catches render errors in tab content.
 * Prevents a single broken tab from crashing the entire settings page.
 */
class TabErrorBoundary extends React.Component<
  { children: React.ReactNode; tabName: string },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode; tabName: string }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[Settings] ${this.props.tabName} tab crashed:`, error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="border border-red-500/30 bg-red-500/5 p-6 text-center">
          <p className="font-mono text-xs text-red-400 mb-2">
            {this.props.tabName} failed to load.
          </p>
          <p className="font-mono text-[10px] text-muted-foreground mb-4">
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="border border-accent bg-accent/10 px-4 py-2 font-mono text-xs uppercase tracking-widest text-accent hover:bg-accent/20 transition-all"
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function SettingsContent() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabId>('membership');
  const [exporting, setExporting] = useState(false);

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
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-8">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent">Account</span>
            <h1 className="mt-2 font-bebas text-3xl md:text-5xl tracking-tight text-foreground">SETTINGS</h1>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/code-lab"
              className="flex items-center gap-2 border border-border/40 px-4 py-2 font-mono text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-all"
            >
              Code Lab
            </Link>
            <Link
              href="/chat"
              className="flex items-center gap-2 border border-accent bg-accent/10 px-4 py-2 font-mono text-xs uppercase tracking-widest text-accent hover:bg-accent/20 transition-all"
            >
              Chat
            </Link>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="mb-8 flex flex-wrap gap-1 border-b border-border/30">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex items-center gap-2 px-4 py-3 font-mono text-xs uppercase tracking-widest transition-all ${
                activeTab === tab.id
                  ? 'text-accent'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span className="text-[9px] opacity-60">{tab.tag}</span>
              <span className="hidden sm:inline">{tab.label}</span>
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-px bg-accent" />
              )}
            </button>
          ))}
        </div>

        {/* Tab Content — each wrapped in ErrorBoundary */}
        <div className="space-y-6">
          {activeTab === 'membership' && (
            <TabErrorBoundary tabName="Membership">
              <div>
                <div className="mb-6">
                  <h2 className="font-bebas text-2xl tracking-tight text-foreground mb-2">MEMBERSHIP & BILLING</h2>
                  <p className="font-mono text-xs text-muted-foreground">
                    Manage your subscription, view current plan, and upgrade or downgrade.
                  </p>
                </div>
                <MembershipSection />
              </div>
            </TabErrorBoundary>
          )}

          {activeTab === 'usage' && (
            <TabErrorBoundary tabName="Usage & Metrics">
              <div>
                <div className="mb-6">
                  <h2 className="font-bebas text-2xl tracking-tight text-foreground mb-2">USAGE & METRICS</h2>
                  <p className="font-mono text-xs text-muted-foreground">
                    Track your daily message and image usage across all features.
                  </p>
                </div>
                <UsageMetricsSection />
              </div>
            </TabErrorBoundary>
          )}

          {activeTab === 'account' && (
            <TabErrorBoundary tabName="Account">
              <div>
                <div className="mb-6">
                  <h2 className="font-bebas text-2xl tracking-tight text-foreground mb-2">ACCOUNT</h2>
                  <p className="font-mono text-xs text-muted-foreground">Manage your email address and password.</p>
                </div>
                <AccountSection />
              </div>
            </TabErrorBoundary>
          )}

          {activeTab === 'connectors' && (
            <TabErrorBoundary tabName="Connectors">
              <ConnectorsSection />
            </TabErrorBoundary>
          )}

          {activeTab === 'support' && (
            <TabErrorBoundary tabName="Support">
              <SupportSection />
            </TabErrorBoundary>
          )}

          {activeTab === 'byok' && (
            <TabErrorBoundary tabName="BYOK API Keys">
              <BYOKSection />
            </TabErrorBoundary>
          )}

          {activeTab === 'memory' && (
            <TabErrorBoundary tabName="AI Memory">
              <MemoryFeedbackSection />
            </TabErrorBoundary>
          )}

          {activeTab === 'preferences' && (
            <TabErrorBoundary tabName="Preferences">
              <div>
                <div className="mb-6">
                  <h2 className="font-bebas text-2xl tracking-tight text-foreground mb-2">PREFERENCES</h2>
                  <p className="font-mono text-xs text-muted-foreground">
                    Customize your AI experience — theme, tone, document styling, and custom
                    instructions.
                  </p>
                </div>
                <PreferencesSection />
              </div>
            </TabErrorBoundary>
          )}

          {activeTab === 'privacy' && (
            <section className="border border-border/40 bg-card/50 p-6 md:p-8">
              <h2 className="font-bebas text-2xl tracking-tight text-foreground mb-2">DATA & PRIVACY</h2>
              <p className="font-mono text-xs text-muted-foreground mb-6">
                Export all your conversations and account data.
              </p>
              <div className="space-y-4">
                <div>
                  <button
                    onClick={handleExportData}
                    disabled={exporting}
                    className="border border-accent bg-accent/10 px-6 py-3 font-mono text-xs uppercase tracking-widest text-accent hover:bg-accent/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {exporting ? 'Exporting...' : 'Export My Data'}
                  </button>
                  <p className="font-mono text-[10px] text-muted-foreground mt-2">
                    Download all your conversations, messages, and account info as a CSV file
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

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen p-4 md:p-8 flex items-center justify-center bg-background"
          aria-busy="true"
        >
          <div className="text-center" role="status" aria-label="Loading settings">
            <div className="animate-spin h-6 w-6 border-b border-accent mx-auto mb-4" />
            <p className="font-mono text-xs text-muted-foreground">Loading settings...</p>
          </div>
        </div>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}
