'use client';

/**
 * COMPOSIO TOOLKITS SECTION
 *
 * Browse and connect to approved app integrations via Composio.
 * Supports search, category filtering, OAuth connections, and API key auth.
 */

import { useState, useEffect, useCallback } from 'react';
import BrandLogo from '@/components/ui/BrandLogo';
import ApiKeyModal from './ApiKeyModal';

interface Toolkit {
  id: string;
  displayName: string;
  description: string;
  icon: string;
  category: string;
  authType: string;
  popular?: boolean;
  connected: boolean;
  connectionId: string | null;
}

interface GroupedToolkits {
  popular: Toolkit[];
  communication: Toolkit[];
  productivity: Toolkit[];
  social: Toolkit[];
  development: Toolkit[];
  crm: Toolkit[];
  finance: Toolkit[];
  calendar: Toolkit[];
  storage: Toolkit[];
}

interface ToolkitsResponse {
  toolkits: Toolkit[];
  grouped: GroupedToolkits;
  total: number;
  configured: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  popular: 'Popular',
  communication: 'Communication',
  productivity: 'Productivity',
  social: 'Social Media',
  development: 'Development',
  crm: 'CRM',
  finance: 'Finance',
  calendar: 'Calendar',
  storage: 'Storage',
  analytics: 'Analytics',
  marketing: 'Marketing',
  ecommerce: 'E-commerce',
  hr: 'HR',
  support: 'Support',
  automation: 'Automation',
  media: 'Media',
  education: 'Education',
  travel: 'Travel',
};

// Featured apps to showcase at the top
const FEATURED_APP_IDS = [
  // Google Suite
  'GMAIL',
  'GOOGLE_CALENDAR',
  'GOOGLE_DRIVE',
  'GOOGLE_SHEETS',
  'GOOGLE_DOCS',
  // Social Media
  'TWITTER',
  'INSTAGRAM',
  'LINKEDIN',
  'YOUTUBE',
  // Workplace
  'SLACK',
  'DISCORD',
  'MICROSOFT_TEAMS',
  // Development & Business
  'GITHUB',
  'VERCEL',
  'STRIPE',
];

export default function ComposioToolkitsSection() {
  const [toolkits, setToolkits] = useState<Toolkit[]>([]);
  const [groupedToolkits, setGroupedToolkits] = useState<GroupedToolkits | null>(null);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // API Key modal state
  const [apiKeyModal, setApiKeyModal] = useState<{
    isOpen: boolean;
    toolkit: Toolkit | null;
    error: string | null;
    isSubmitting: boolean;
  }>({
    isOpen: false,
    toolkit: null,
    error: null,
    isSubmitting: false,
  });

  // Fetch toolkits
  const fetchToolkits = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (selectedCategory && selectedCategory !== 'popular') {
        params.append('category', selectedCategory);
      }
      params.append('connected', 'true');

      const response = await fetch(`/api/composio/toolkits?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch toolkits');

      const data: ToolkitsResponse = await response.json();
      setToolkits(data.toolkits);
      setGroupedToolkits(data.grouped);
      setConfigured(data.configured);
    } catch (err) {
      console.error('Failed to fetch toolkits:', err);
      setError('Failed to load integrations');
    } finally {
      setLoading(false);
    }
  }, [search, selectedCategory]);

  useEffect(() => {
    fetchToolkits();
  }, [fetchToolkits]);

  // Check for callback params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const successParam = params.get('success');
    const errorParam = params.get('error');
    const pendingParam = params.get('pending');

    if (successParam) {
      setSuccess(successParam);
      window.history.replaceState({}, '', '/settings?tab=connectors');

      // Fetch immediately, then retry after delays to handle Composio API indexing lag
      fetchToolkits();

      // Retry fetches to catch newly connected apps that may not appear immediately
      const retryDelays = [1000, 3000, 5000];
      retryDelays.forEach((delay) => {
        setTimeout(() => {
          console.log(`[ComposioToolkits] Retry fetch after ${delay}ms`);
          fetchToolkits();
        }, delay);
      });
    }
    if (errorParam) {
      setError(errorParam);
      window.history.replaceState({}, '', '/settings?tab=connectors');
    }
    if (pendingParam) {
      setSuccess(`${pendingParam} connection is pending. Please check back shortly.`);
      window.history.replaceState({}, '', '/settings?tab=connectors');
      // Also retry for pending connections
      setTimeout(() => fetchToolkits(), 3000);
      setTimeout(() => fetchToolkits(), 8000);
    }
  }, [fetchToolkits]);

  const handleConnect = async (toolkit: Toolkit) => {
    // Check if this toolkit requires an API key
    if (toolkit.authType === 'api_key') {
      setApiKeyModal({
        isOpen: true,
        toolkit,
        error: null,
        isSubmitting: false,
      });
      return;
    }

    // OAuth flow
    try {
      setConnecting(toolkit.id);
      setError(null);

      const response = await fetch('/api/composio/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolkit: toolkit.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Check if the backend says this requires an API key
        if (data.requiresApiKey) {
          setConnecting(null);
          setApiKeyModal({
            isOpen: true,
            toolkit,
            error: null,
            isSubmitting: false,
          });
          return;
        }
        throw new Error(data.error || 'Failed to initiate connection');
      }

      // Redirect to OAuth
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      }
    } catch (err) {
      console.error('Failed to connect:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect');
      setConnecting(null);
    }
  };

  const handleApiKeySubmit = async (apiKey: string) => {
    if (!apiKeyModal.toolkit) return;

    setApiKeyModal((prev) => ({ ...prev, isSubmitting: true, error: null }));

    try {
      const response = await fetch('/api/composio/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolkit: apiKeyModal.toolkit.id,
          apiKey,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to connect');
      }

      // Success! Close modal and show success message
      const toolkitName = apiKeyModal.toolkit.displayName;
      setApiKeyModal({ isOpen: false, toolkit: null, error: null, isSubmitting: false });
      setSuccess(`${toolkitName} connected successfully!`);
      fetchToolkits(); // Refresh the list
    } catch (err) {
      console.error('Failed to connect with API key:', err);
      setApiKeyModal((prev) => ({
        ...prev,
        isSubmitting: false,
        error: err instanceof Error ? err.message : 'Failed to connect',
      }));
    }
  };

  const handleApiKeyModalClose = () => {
    if (!apiKeyModal.isSubmitting) {
      setApiKeyModal({ isOpen: false, toolkit: null, error: null, isSubmitting: false });
    }
  };

  const handleDisconnect = async (toolkit: Toolkit) => {
    if (!toolkit.connectionId) return;
    if (!confirm(`Are you sure you want to disconnect ${toolkit.displayName}?`)) return;

    try {
      setDisconnecting(toolkit.id);
      setError(null);

      const response = await fetch(`/api/composio/accounts?connectionId=${toolkit.connectionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to disconnect');
      }

      setSuccess(`${toolkit.displayName} disconnected`);
      fetchToolkits(); // Refresh list
    } catch (err) {
      console.error('Failed to disconnect:', err);
      setError('Failed to disconnect');
    } finally {
      setDisconnecting(null);
    }
  };

  // Get featured apps for showcase
  const featuredToolkits = toolkits.filter((t) => FEATURED_APP_IDS.includes(t.id.toUpperCase()));

  // Filter toolkits for display (excluding featured when showing all)
  const displayToolkits =
    selectedCategory === 'popular'
      ? groupedToolkits?.popular || []
      : selectedCategory
        ? toolkits.filter((t) => t.category === selectedCategory)
        : search
          ? toolkits
          : toolkits.filter((t) => !FEATURED_APP_IDS.includes(t.id.toUpperCase()));

  // Show featured section only when not searching and no category selected
  const showFeatured = !search && !selectedCategory;

  // Count connected apps for display
  const connectedCount = toolkits.filter((t) => t.connected).length;

  // Don't block rendering if not configured - still show the apps

  return (
    <div className="mt-8 pt-8 border-t border-theme">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <div>
          <h3 className="text-lg font-semibold text-text-primary">
            App Integrations{' '}
            {connectedCount > 0 && (
              <span className="text-sm font-normal px-2 py-0.5 rounded-full ml-2 bg-green-500 text-white">
                {connectedCount} Connected
              </span>
            )}
          </h3>
          <p className="text-sm text-text-secondary">
            Connect your favorite apps to enable AI-powered automation
          </p>
        </div>
      </div>

      {/* Tip Banner */}
      <div
        className="mb-6 p-4 rounded-xl border-2 border-dashed border-primary flex items-center gap-3"
        style={{
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05), rgba(139, 92, 246, 0.05))',
        }}
      >
        <span className="text-2xl">💡</span>
        <div>
          <p className="font-medium text-sm text-text-primary">
            Connect your apps to supercharge your AI!
          </p>
          <p className="text-xs text-text-secondary">
            Try connecting Twitter, Instagram, or Slack to let AI help manage your accounts, post
            updates, and automate workflows.
          </p>
        </div>
      </div>

      {/* Messages */}
      {success && (
        <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">
          {success}
          <button onClick={() => setSuccess(null)} className="ml-2 text-green-800 hover:underline">
            Dismiss
          </button>
        </div>
      )}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-800 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Search Bar - Prominent */}
      <div className="mb-6">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <svg
              className="w-5 h-5 text-text-muted"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search apps... (Twitter, Slack, Gmail, etc.)"
            aria-label="Search integrations"
            className="w-full pl-12 pr-4 py-3 rounded-xl border-2 text-base transition-all focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-background border-theme text-text-primary"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute inset-y-0 right-0 pr-4 flex items-center text-text-muted"
              aria-label="Clear search"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Featured Apps - Mobile-friendly grid */}
      {showFeatured && featuredToolkits.length > 0 && (
        <div className="mb-6">
          <h4 className="text-xs font-semibold mb-3 flex items-center gap-2 text-text-secondary">
            Featured Apps
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gradient-to-r from-purple-500 to-pink-500 text-white">
              HOT
            </span>
          </h4>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-8 gap-3">
            {featuredToolkits.map((toolkit) => (
              <button
                key={toolkit.id}
                onClick={() => {
                  if (!configured) {
                    setError('App integrations are being set up. Please check back soon!');
                    return;
                  }
                  if (toolkit.connected) {
                    handleDisconnect(toolkit);
                  } else {
                    handleConnect(toolkit);
                  }
                }}
                disabled={connecting === toolkit.id || disconnecting === toolkit.id}
                className={`p-3 rounded-xl border-2 transition-all hover:shadow-md hover:scale-[1.02] active:scale-[0.98] flex flex-col items-center justify-center min-h-[88px] disabled:opacity-50 ${toolkit.connected ? 'ring-1 ring-green-500/30 border-green-500 bg-green-500/10' : 'border-theme bg-background'}`}
              >
                <div className="w-10 h-10 flex items-center justify-center relative mb-2">
                  <BrandLogo toolkitId={toolkit.id} displayName={toolkit.displayName} size="md" />
                  {toolkit.connected && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center shadow-sm">
                      <svg
                        className="w-2.5 h-2.5 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                  )}
                </div>
                <p className="text-[11px] font-medium truncate w-full text-center leading-tight text-text-primary">
                  {toolkit.displayName}
                </p>
                <p
                  className={`text-[10px] font-medium mt-0.5 ${toolkit.connected ? 'text-green-600' : 'text-text-muted'}`}
                >
                  {connecting === toolkit.id || disconnecting === toolkit.id
                    ? '...'
                    : toolkit.connected
                      ? 'Connected'
                      : 'Connect'}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Category Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`px-3 py-1.5 text-sm rounded-lg border transition-colors border-theme ${
            !selectedCategory
              ? 'ring-2 ring-blue-500 ring-offset-1 text-primary'
              : 'text-text-secondary'
          }`}
        >
          All
        </button>
        {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setSelectedCategory(key)}
            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors border-theme ${
              selectedCategory === key
                ? 'ring-2 ring-blue-500 ring-offset-1 text-primary'
                : 'text-text-secondary'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Section Header */}
      {showFeatured && displayToolkits.length > 0 && (
        <h4 className="text-sm font-semibold mb-3 text-text-primary">All Apps</h4>
      )}

      {/* Toolkits Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="p-4 rounded-xl border animate-pulse border-theme">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gray-200" />
                <div className="flex-1">
                  <div className="h-4 w-24 bg-gray-200 rounded mb-2" />
                  <div className="h-3 w-32 bg-gray-200 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : displayToolkits.length === 0 ? (
        <div className="text-center py-12 border rounded-xl border-theme">
          <p className="text-text-muted">
            {search ? `No integrations found for "${search}"` : 'No integrations available'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayToolkits.map((toolkit) => (
            <div
              key={toolkit.id}
              className={`p-4 rounded-xl border-2 transition-all hover:shadow-md ${toolkit.connected ? 'ring-1 ring-green-500/30 border-green-500 bg-green-500/[0.08]' : 'border-theme bg-background'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex-shrink-0 relative">
                    <BrandLogo toolkitId={toolkit.id} displayName={toolkit.displayName} size="md" />
                    {toolkit.connected && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                        <svg
                          className="w-2.5 h-2.5 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={3}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-medium text-sm truncate text-text-primary">
                      {toolkit.displayName}
                    </h4>
                    <p className="text-xs line-clamp-2 text-text-secondary">
                      {toolkit.description}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${toolkit.connected ? 'bg-green-500/[0.15] text-green-600' : 'bg-[var(--background-secondary)] text-text-muted'}`}
                  >
                    {toolkit.connected ? 'Connected' : toolkit.category}
                  </span>
                  {toolkit.authType === 'api_key' && !toolkit.connected && (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5 bg-orange-400/[0.15] text-orange-600"
                      title="Requires API key"
                    >
                      <svg
                        className="w-2.5 h-2.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                        />
                      </svg>
                      API Key
                    </span>
                  )}
                </div>

                {toolkit.connected ? (
                  <button
                    onClick={() => handleDisconnect(toolkit)}
                    disabled={disconnecting === toolkit.id || !configured}
                    className="px-3 py-1 text-xs font-medium rounded-lg border border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400 transition-colors disabled:opacity-50"
                  >
                    {disconnecting === toolkit.id ? 'Disconnecting...' : 'Disconnect'}
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      if (!configured) {
                        setError('App integrations are being set up. Please check back soon!');
                        return;
                      }
                      handleConnect(toolkit);
                    }}
                    disabled={connecting === toolkit.id}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg text-white transition-colors disabled:opacity-50 ${configured ? 'bg-primary' : 'bg-gray-400'}`}
                  >
                    {connecting === toolkit.id ? 'Connecting...' : 'Connect'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stats */}
      {!loading && toolkits.length > 0 && (
        <div className="mt-6 text-center">
          <p className="text-sm text-text-muted">
            {connectedCount} of {toolkits.length} apps connected
          </p>
        </div>
      )}

      {/* API Key Modal */}
      {apiKeyModal.toolkit && (
        <ApiKeyModal
          isOpen={apiKeyModal.isOpen}
          onClose={handleApiKeyModalClose}
          onSubmit={handleApiKeySubmit}
          toolkit={{
            id: apiKeyModal.toolkit.id,
            displayName: apiKeyModal.toolkit.displayName,
            description: apiKeyModal.toolkit.description,
            icon: apiKeyModal.toolkit.icon,
          }}
          isSubmitting={apiKeyModal.isSubmitting}
          error={apiKeyModal.error}
        />
      )}
    </div>
  );
}
