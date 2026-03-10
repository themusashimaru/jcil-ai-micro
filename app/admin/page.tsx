/**
 * ADMIN DASHBOARD
 * Main admin panel overview with real-time metrics
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface UserStats {
  totalUsers: number;
  usersByTier: {
    free: number;
    basic: number;
    pro: number;
    executive: number;
  };
  usersByStatus: {
    active: number;
    trialing: number;
    past_due: number;
    canceled: number;
  };
  usage: {
    totalMessagesToday: number;
    totalMessagesAllTime: number;
    totalImagesToday: number;
    totalImagesAllTime: number;
  };
  activeUsers: {
    today: number;
    last7Days: number;
    last30Days: number;
  };
}

interface User {
  id: string;
  email: string;
  full_name: string | null;
  subscription_tier: string | null;
  created_at: string;
  total_messages: number;
  total_images: number;
  last_message_date: string | null;
}

interface DashboardData {
  users: User[];
  stats: UserStats;
  timestamp: string;
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/users');

      if (!response.ok) {
        throw new Error(`Failed to fetch dashboard data (${response.status})`);
      }

      const responseData = await response.json();
      // API returns { ok: true, data: { users, stats, ... } }
      const dashboardData = responseData.data || responseData;
      setData(dashboardData);
      setError(null);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  // Calculate estimated MRR based on subscription tiers
  const calculateMRR = () => {
    if (!data) return 0;
    const { usersByTier } = data.stats;
    // Rough estimates based on typical pricing
    return usersByTier.basic * 10 + usersByTier.pro * 25 + usersByTier.executive * 100;
  };

  // Get recent signups (last 7 days)
  const getRecentSignups = () => {
    if (!data) return [];
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    return data.users
      .filter((u) => new Date(u.created_at) >= sevenDaysAgo)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5);
  };

  // Get most active users
  const getMostActiveUsers = () => {
    if (!data) return [];
    return [...data.users]
      .sort((a, b) => (b.total_messages || 0) - (a.total_messages || 0))
      .slice(0, 5);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-morphism rounded-2xl p-6">
        <div className="text-red-400 mb-4">Error: {error}</div>
        <button
          onClick={fetchDashboardData}
          className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const stats = data.stats;
  const recentSignups = getRecentSignups();
  const topUsers = getMostActiveUsers();
  const mrr = calculateMRR();

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <h2 className="text-3xl font-bold">Dashboard</h2>
        <button
          onClick={fetchDashboardData}
          className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/20 transition"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Total Users */}
        <div className="glass-morphism rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">👥</span>
            <h3 className="text-sm font-medium text-gray-400">Total Users</h3>
          </div>
          <p className="text-3xl font-bold">{stats.totalUsers.toLocaleString()}</p>
          <p className="text-xs text-blue-400 mt-1">
            {stats.activeUsers.last7Days} active in last 7 days
          </p>
        </div>

        {/* Messages Today */}
        <div className="glass-morphism rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">💬</span>
            <h3 className="text-sm font-medium text-gray-400">Messages Today</h3>
          </div>
          <p className="text-3xl font-bold">{stats.usage.totalMessagesToday.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1">
            {stats.usage.totalMessagesAllTime.toLocaleString()} all time
          </p>
        </div>

        {/* Images Today */}
        <div className="glass-morphism rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">🖼️</span>
            <h3 className="text-sm font-medium text-gray-400">Images Today</h3>
          </div>
          <p className="text-3xl font-bold">{stats.usage.totalImagesToday.toLocaleString()}</p>
          <p className="text-xs text-gray-400 mt-1">
            {stats.usage.totalImagesAllTime.toLocaleString()} all time
          </p>
        </div>

        {/* Estimated MRR */}
        <div className="glass-morphism rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">💰</span>
            <h3 className="text-sm font-medium text-gray-400">Est. MRR</h3>
          </div>
          <p className="text-3xl font-bold">${mrr.toLocaleString()}</p>
          <p className="text-xs text-green-400 mt-1">
            {stats.usersByTier.basic + stats.usersByTier.pro + stats.usersByTier.executive} paid
            users
          </p>
        </div>
      </div>

      {/* Subscription Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Subscription Tiers */}
        <div className="glass-morphism rounded-xl p-6">
          <h3 className="text-xl font-bold mb-4">Subscription Tiers</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-gray-500"></div>
                <span className="text-sm">Free</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">{stats.usersByTier.free}</span>
                <span className="text-xs text-gray-400">
                  ({((stats.usersByTier.free / stats.totalUsers) * 100).toFixed(1)}%)
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <span className="text-sm">Basic</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">{stats.usersByTier.basic}</span>
                <span className="text-xs text-gray-400">
                  ({((stats.usersByTier.basic / stats.totalUsers) * 100).toFixed(1)}%)
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                <span className="text-sm">Pro</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">{stats.usersByTier.pro}</span>
                <span className="text-xs text-gray-400">
                  ({((stats.usersByTier.pro / stats.totalUsers) * 100).toFixed(1)}%)
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                <span className="text-sm">Executive</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">{stats.usersByTier.executive}</span>
                <span className="text-xs text-gray-400">
                  ({((stats.usersByTier.executive / stats.totalUsers) * 100).toFixed(1)}%)
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Active Users */}
        <div className="glass-morphism rounded-xl p-6">
          <h3 className="text-xl font-bold mb-4">User Activity</h3>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">Active Today</span>
                <span className="text-lg font-bold">{stats.activeUsers.today}</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500"
                  style={{ width: `${(stats.activeUsers.today / stats.totalUsers) * 100}%` }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">Last 7 Days</span>
                <span className="text-lg font-bold">{stats.activeUsers.last7Days}</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500"
                  style={{ width: `${(stats.activeUsers.last7Days / stats.totalUsers) * 100}%` }}
                ></div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">Last 30 Days</span>
                <span className="text-lg font-bold">{stats.activeUsers.last30Days}</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-500"
                  style={{ width: `${(stats.activeUsers.last30Days / stats.totalUsers) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Recent Signups */}
        <div className="glass-morphism rounded-xl p-6">
          <h3 className="text-xl font-bold mb-4">Recent Signups</h3>
          {recentSignups.length > 0 ? (
            <div className="space-y-3">
              {recentSignups.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between py-2 border-b border-white/5 last:border-0"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{user.full_name || user.email}</div>
                    <div className="text-xs text-gray-400">
                      {new Date(user.created_at).toLocaleDateString()} •{' '}
                      {user.subscription_tier || 'free'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No recent signups</p>
          )}
        </div>

        {/* Top Users by Activity */}
        <div className="glass-morphism rounded-xl p-6">
          <h3 className="text-xl font-bold mb-4">Most Active Users</h3>
          {topUsers.length > 0 ? (
            <div className="space-y-3">
              {topUsers.map((user, index) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between py-2 border-b border-white/5 last:border-0"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="text-lg font-bold text-gray-500">#{index + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{user.full_name || user.email}</div>
                      <div className="text-xs text-gray-400">
                        {user.total_messages.toLocaleString()} messages
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No user activity yet</p>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h3 className="text-xl font-bold mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/admin/users"
            className="glass-morphism rounded-xl p-6 hover:bg-white/10 transition group"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">👥</span>
              <h4 className="text-lg font-medium group-hover:text-blue-400 transition">
                Manage Users
              </h4>
            </div>
            <p className="text-sm text-gray-400">View and manage all user accounts</p>
          </Link>

          <Link
            href="/admin/design"
            className="glass-morphism rounded-xl p-6 hover:bg-white/10 transition group"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">🎨</span>
              <h4 className="text-lg font-medium group-hover:text-blue-400 transition">
                Design Settings
              </h4>
            </div>
            <p className="text-sm text-gray-400">Upload logos, customize branding</p>
          </Link>

          <button
            onClick={fetchDashboardData}
            className="glass-morphism rounded-xl p-6 hover:bg-white/10 transition group text-left"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">🔄</span>
              <h4 className="text-lg font-medium group-hover:text-blue-400 transition">
                Refresh Data
              </h4>
            </div>
            <p className="text-sm text-gray-400">Update dashboard with latest metrics</p>
          </button>
        </div>
      </div>

      {/* Last Updated */}
      <div className="mt-8 text-center text-xs text-gray-500">
        Last updated: {new Date(data.timestamp).toLocaleString()}
      </div>
    </div>
  );
}
