/**
 * ADMIN DASHBOARD PAGE
 * PURPOSE: Display analytics and metrics for admin users
 */

'use client';

import { useEffect, useState } from 'react';

interface Analytics {
  totalUsers: number;
  onlineUsers: number;
  totalMessages: number;
  usersByTier: {
    free: number;
    basic: number;
    pro: number;
    executive: number;
  };
  tokensByTier: {
    free: number;
    basic: number;
    pro: number;
    executive: number;
  };
  totalTokens: number;
}

export default function AdminDashboard() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadAnalytics();
    // Refresh every 30 seconds
    const interval = setInterval(loadAnalytics, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadAnalytics = async (isManualRefresh = false) => {
    try {
      if (isManualRefresh) setRefreshing(true);
      const response = await fetch('/api/admin/analytics', {
        cache: 'no-store', // Ensure fresh data
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setAnalytics(data.analytics);
          setError(''); // Clear any previous errors
        }
      } else {
        setError('Failed to load analytics');
      }
    } catch (err) {
      setError('Failed to load analytics');
      console.error(err);
    } finally {
      setLoading(false);
      if (isManualRefresh) setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-gray-400">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-500/20 border border-red-500/50 rounded-lg">
        <p className="text-red-200">{error}</p>
      </div>
    );
  }

  if (!analytics) return null;

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold">Admin Dashboard</h2>
          <p className="text-gray-400 mt-2">Real-time analytics and metrics</p>
        </div>
        <button
          onClick={() => loadAnalytics(true)}
          disabled={refreshing}
          className={`px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition ${refreshing ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <span className={refreshing ? 'inline-block animate-spin' : ''}>🔄</span> {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Total Users */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-400">Total Users</h3>
            <span className="text-2xl">👥</span>
          </div>
          <p className="text-3xl font-bold text-white">{formatNumber(analytics.totalUsers)}</p>
        </div>

        {/* Online Users */}
        <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-400">Online Now</h3>
            <span className="text-2xl">🟢</span>
          </div>
          <p className="text-3xl font-bold text-green-400">{formatNumber(analytics.onlineUsers)}</p>
          <p className="text-xs text-gray-500 mt-1">Active in last 15 min</p>
        </div>

        {/* Total Messages */}
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-400">Total Messages</h3>
            <span className="text-2xl">💬</span>
          </div>
          <p className="text-3xl font-bold text-blue-400">{formatNumber(analytics.totalMessages)}</p>
        </div>

        {/* Total Tokens */}
        <div className="rounded-xl border border-purple-500/20 bg-purple-500/10 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-400">Total Tokens</h3>
            <span className="text-2xl">🔢</span>
          </div>
          <p className="text-3xl font-bold text-purple-400">{formatNumber(analytics.totalTokens)}</p>
          <p className="text-xs text-gray-500 mt-1">Estimated usage</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Users by Tier */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          <h3 className="text-xl font-bold mb-6">Users by Subscription Tier</h3>
          <div className="space-y-4">
            {/* Free */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-300">Free</span>
                <span className="text-white font-bold">{formatNumber(analytics.usersByTier.free)}</span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gray-400"
                  style={{
                    width: `${(analytics.usersByTier.free / analytics.totalUsers) * 100}%`,
                  }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {((analytics.usersByTier.free / analytics.totalUsers) * 100).toFixed(1)}%
              </p>
            </div>

            {/* Basic */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-300">Basic ($12/mo)</span>
                <span className="text-white font-bold">{formatNumber(analytics.usersByTier.basic)}</span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-400"
                  style={{
                    width: `${(analytics.usersByTier.basic / analytics.totalUsers) * 100}%`,
                  }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {((analytics.usersByTier.basic / analytics.totalUsers) * 100).toFixed(1)}%
              </p>
            </div>

            {/* Pro */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-300">Pro ($30/mo)</span>
                <span className="text-white font-bold">{formatNumber(analytics.usersByTier.pro)}</span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-400"
                  style={{
                    width: `${(analytics.usersByTier.pro / analytics.totalUsers) * 100}%`,
                  }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {((analytics.usersByTier.pro / analytics.totalUsers) * 100).toFixed(1)}%
              </p>
            </div>

            {/* Executive */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-300">Executive ($60/mo)</span>
                <span className="text-white font-bold">{formatNumber(analytics.usersByTier.executive)}</span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-yellow-400"
                  style={{
                    width: `${(analytics.usersByTier.executive / analytics.totalUsers) * 100}%`,
                  }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {((analytics.usersByTier.executive / analytics.totalUsers) * 100).toFixed(1)}%
              </p>
            </div>
          </div>
        </div>

        {/* Token Usage by Tier */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-6">
          <h3 className="text-xl font-bold mb-6">Token Usage by Tier</h3>
          <div className="space-y-4">
            {/* Free */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-300">Free</span>
                <span className="text-white font-bold">{formatNumber(analytics.tokensByTier.free)}</span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gray-400"
                  style={{
                    width: `${(analytics.tokensByTier.free / analytics.totalTokens) * 100}%`,
                  }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {((analytics.tokensByTier.free / analytics.totalTokens) * 100).toFixed(1)}%
              </p>
            </div>

            {/* Basic */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-300">Basic</span>
                <span className="text-white font-bold">{formatNumber(analytics.tokensByTier.basic)}</span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-400"
                  style={{
                    width: `${(analytics.tokensByTier.basic / analytics.totalTokens) * 100}%`,
                  }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {((analytics.tokensByTier.basic / analytics.totalTokens) * 100).toFixed(1)}%
              </p>
            </div>

            {/* Pro */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-300">Pro</span>
                <span className="text-white font-bold">{formatNumber(analytics.tokensByTier.pro)}</span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-400"
                  style={{
                    width: `${(analytics.tokensByTier.pro / analytics.totalTokens) * 100}%`,
                  }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {((analytics.tokensByTier.pro / analytics.totalTokens) * 100).toFixed(1)}%
              </p>
            </div>

            {/* Executive */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-300">Executive</span>
                <span className="text-white font-bold">{formatNumber(analytics.tokensByTier.executive)}</span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-yellow-400"
                  style={{
                    width: `${(analytics.tokensByTier.executive / analytics.totalTokens) * 100}%`,
                  }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {((analytics.tokensByTier.executive / analytics.totalTokens) * 100).toFixed(1)}%
              </p>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-white/10">
            <p className="text-sm text-gray-400">
              Estimated based on ~100 tokens per message
            </p>
          </div>
        </div>
      </div>

      {/* Revenue Estimate */}
      <div className="mt-6 rounded-xl border border-green-500/20 bg-green-500/10 p-6">
        <h3 className="text-xl font-bold mb-4">💰 Monthly Recurring Revenue (MRR)</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-400">Basic ($12/mo)</p>
            <p className="text-2xl font-bold text-white">
              ${formatNumber(analytics.usersByTier.basic * 12)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-400">Pro ($30/mo)</p>
            <p className="text-2xl font-bold text-white">
              ${formatNumber(analytics.usersByTier.pro * 30)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-400">Executive ($60/mo)</p>
            <p className="text-2xl font-bold text-white">
              ${formatNumber(analytics.usersByTier.executive * 60)}
            </p>
          </div>
          <div className="border-l border-white/20 pl-4">
            <p className="text-sm text-gray-400">Total MRR</p>
            <p className="text-3xl font-bold text-green-400">
              $
              {formatNumber(
                analytics.usersByTier.basic * 12 +
                  analytics.usersByTier.pro * 30 +
                  analytics.usersByTier.executive * 60
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
