'use client';

/**
 * COMPOSIO TOOLKITS SECTION
 *
 * Browse and connect to 500+ app integrations via Composio.
 * Supports search, category filtering, and OAuth connections.
 */

import { useState, useEffect, useCallback } from 'react';

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

// Featured apps to showcase at the top (the coolest ones)
const FEATURED_APP_IDS = [
  'TWITTER',
  'INSTAGRAM',
  'FACEBOOK',
  'TIKTOK',
  'YOUTUBE',
  'LINKEDIN',
  'SPOTIFY',
  'NOTION',
  'SLACK',
  'DISCORD',
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
      fetchToolkits(); // Refresh to show new connection
    }
    if (errorParam) {
      setError(errorParam);
      window.history.replaceState({}, '', '/settings?tab=connectors');
    }
    if (pendingParam) {
      setSuccess(`${pendingParam} connection is pending. Please check back shortly.`);
      window.history.replaceState({}, '', '/settings?tab=connectors');
    }
  }, [fetchToolkits]);

  const handleConnect = async (toolkit: Toolkit) => {
    try {
      setConnecting(toolkit.id);
      setError(null);

      const response = await fetch('/api/composio/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolkit: toolkit.id }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to initiate connection');
      }

      const data = await response.json();

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

  // Don't block rendering if not configured - still show the apps

  return (
    <div className="mt-8 pt-8 border-t" style={{ borderColor: 'var(--border)' }}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <div>
          <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            App Integrations{' '}
            <span
              className="text-sm font-normal px-2 py-0.5 rounded-full ml-2"
              style={{ backgroundColor: 'var(--primary)', color: 'white' }}
            >
              150+ Apps
            </span>
          </h3>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Connect your favorite apps to enable AI-powered automation
          </p>
        </div>
      </div>

      {/* Tip Banner */}
      <div
        className="mb-6 p-4 rounded-xl border-2 border-dashed flex items-center gap-3"
        style={{
          borderColor: 'var(--primary)',
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.05), rgba(139, 92, 246, 0.05))',
        }}
      >
        <span className="text-2xl">💡</span>
        <div>
          <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
            Connect your apps to supercharge your AI!
          </p>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
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
              className="w-5 h-5"
              style={{ color: 'var(--text-muted)' }}
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
            placeholder="Search 150+ apps... (Twitter, Slack, Notion, etc.)"
            className="w-full pl-12 pr-4 py-3 rounded-xl border-2 text-base transition-all focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            style={{
              backgroundColor: 'var(--background)',
              borderColor: 'var(--border)',
              color: 'var(--text-primary)',
            }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute inset-y-0 right-0 pr-4 flex items-center"
              style={{ color: 'var(--text-muted)' }}
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

      {/* Featured Apps - The Coolest Ones */}
      {showFeatured && featuredToolkits.length > 0 && (
        <div className="mb-8">
          <h4
            className="text-sm font-semibold mb-3 flex items-center gap-2"
            style={{ color: 'var(--text-primary)' }}
          >
            <span>Featured Apps</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white">
              HOT
            </span>
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {featuredToolkits.map((toolkit) => (
              <div
                key={toolkit.id}
                className="p-4 rounded-xl border-2 transition-all hover:shadow-lg hover:scale-105 cursor-pointer text-center"
                style={{
                  borderColor: toolkit.connected ? '#22c55e' : 'var(--border)',
                  background: toolkit.connected
                    ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(34, 197, 94, 0.05))'
                    : 'var(--background)',
                }}
                onClick={() => {
                  if (!configured) {
                    setError('App integrations are being set up. Please check back soon!');
                    return;
                  }
                  if (!toolkit.connected) {
                    handleConnect(toolkit);
                  }
                }}
              >
                <div
                  className="w-12 h-12 mx-auto rounded-xl flex items-center justify-center text-2xl mb-2"
                  style={{ backgroundColor: 'var(--background-secondary)' }}
                >
                  {toolkit.icon}
                </div>
                <h5
                  className="font-medium text-sm truncate"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {toolkit.displayName}
                </h5>
                {toolkit.connected ? (
                  <span className="text-xs text-green-600 font-medium">Connected</span>
                ) : (
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {connecting === toolkit.id ? 'Connecting...' : 'Click to connect'}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
            !selectedCategory ? 'ring-2 ring-blue-500 ring-offset-1' : ''
          }`}
          style={{
            borderColor: 'var(--border)',
            color: !selectedCategory ? 'var(--primary)' : 'var(--text-secondary)',
          }}
        >
          All
        </button>
        {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setSelectedCategory(key)}
            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
              selectedCategory === key ? 'ring-2 ring-blue-500 ring-offset-1' : ''
            }`}
            style={{
              borderColor: 'var(--border)',
              color: selectedCategory === key ? 'var(--primary)' : 'var(--text-secondary)',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Section Header */}
      {showFeatured && displayToolkits.length > 0 && (
        <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
          All Apps
        </h4>
      )}

      {/* Toolkits Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="p-4 rounded-xl border animate-pulse"
              style={{ borderColor: 'var(--border)' }}
            >
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
        <div
          className="text-center py-12 border rounded-xl"
          style={{ borderColor: 'var(--border)' }}
        >
          <p style={{ color: 'var(--text-muted)' }}>
            {search ? `No integrations found for "${search}"` : 'No integrations available'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayToolkits.map((toolkit) => (
            <div
              key={toolkit.id}
              className="p-4 rounded-xl border transition-all hover:shadow-md"
              style={{ borderColor: toolkit.connected ? '#22c55e' : 'var(--border)' }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-xl flex-shrink-0"
                    style={{ backgroundColor: 'var(--background-secondary)' }}
                  >
                    {toolkit.icon}
                  </div>
                  <div className="min-w-0">
                    <h4
                      className="font-medium text-sm truncate"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {toolkit.displayName}
                    </h4>
                    <p className="text-xs line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
                      {toolkit.description}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <span
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: 'var(--background-secondary)',
                    color: 'var(--text-muted)',
                  }}
                >
                  {toolkit.category}
                </span>

                {toolkit.connected ? (
                  <button
                    onClick={() => handleDisconnect(toolkit)}
                    disabled={disconnecting === toolkit.id || !configured}
                    className="px-3 py-1 text-xs font-medium rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
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
                    className="px-3 py-1 text-xs font-semibold rounded-lg text-white transition-colors disabled:opacity-50"
                    style={{ backgroundColor: configured ? 'var(--primary)' : '#9ca3af' }}
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
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {toolkits.filter((t) => t.connected).length} of {toolkits.length} integrations connected
          </p>
        </div>
      )}
    </div>
  );
}
