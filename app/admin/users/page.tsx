/**
 * ADMIN USER MANAGEMENT
 * PURPOSE: User list with usage metrics, search, filtering, and analytics
 */

'use client';

import { useState, useEffect } from 'react';
import { logger } from '@/lib/logger';

interface User {
  id: string;
  email: string;
  full_name: string | null;
  subscription_tier: string;
  subscription_status: string | null;
  messages_used_today: number;
  images_generated_today: number;
  total_messages: number;
  total_images: number;
  last_message_date: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
  updated_at: string;
}

interface Stats {
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

export default function UsersPage() {
  const log = logger('AdminUsers');
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTier, setFilterTier] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'created' | 'usage' | 'name'>('created');

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      log.info('Fetching users from API...');
      const response = await fetch('/api/admin/users');

      log.info('API response status', { status: response.status });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        log.error('API error response', errorData);
        throw new Error(errorData.message || `Failed to fetch users (${response.status})`);
      }

      const data = await response.json();
      log.info('API response data', {
        userCount: data.users?.length || 0,
        hasStats: !!data.stats,
        timestamp: data.timestamp
      });

      setUsers(data.users || []);
      setStats(data.stats || null);
      setError(null);
    } catch (err) {
      log.error('Error fetching users', err instanceof Error ? err : { error: err });
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort users
  const filteredUsers = users
    .filter(user => {
      // Search filter
      const matchesSearch = searchTerm === '' ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()));

      // Tier filter
      const matchesTier = filterTier === 'all' ||
        (user.subscription_tier || 'free') === filterTier;

      // Status filter
      const matchesStatus = filterStatus === 'all' ||
        user.subscription_status === filterStatus;

      return matchesSearch && matchesTier && matchesStatus;
    })
    .sort((a, b) => {
      if (sortBy === 'created') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      } else if (sortBy === 'usage') {
        return (b.total_messages || 0) - (a.total_messages || 0);
      } else {
        return (a.full_name || a.email).localeCompare(b.full_name || b.email);
      }
    });

  const getTierColor = (tier: string) => {
    const colors = {
      free: 'bg-gray-500/20 text-gray-400',
      basic: 'bg-blue-500/20 text-blue-400',
      pro: 'bg-purple-500/20 text-purple-400',
      executive: 'bg-amber-500/20 text-amber-400',
    };
    return colors[tier as keyof typeof colors] || colors.free;
  };

  const getStatusColor = (status: string | null) => {
    const colors = {
      active: 'bg-green-500/20 text-green-400',
      trialing: 'bg-blue-500/20 text-blue-400',
      past_due: 'bg-orange-500/20 text-orange-400',
      canceled: 'bg-red-500/20 text-red-400',
    };
    return colors[status as keyof typeof colors] || 'bg-gray-500/20 text-gray-400';
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="min-h-screen p-8" style={{ backgroundColor: 'var(--background)' }}>
        <div className="flex h-64 items-center justify-center">
          <div className="text-xl" style={{ color: 'var(--text-muted)' }}>Loading users...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen p-8" style={{ backgroundColor: 'var(--background)' }}>
        <div className="glass-morphism rounded-2xl p-6">
          <div className="mb-4 text-xl font-bold text-red-500">Error Loading Admin Panel</div>
          <div className="mb-4 text-red-500">{error}</div>

          <div className="mb-6 rounded-lg bg-yellow-500/10 border border-yellow-500/30 p-4">
            <div className="mb-2 text-sm font-semibold text-yellow-600">Troubleshooting Steps:</div>
            <ul className="list-disc list-inside text-sm space-y-1" style={{ color: 'var(--text-secondary)' }}>
              <li>Verify SUPABASE_SERVICE_ROLE_KEY is set in Vercel environment variables</li>
              <li>Ensure the admin user SQL migration has been run in Supabase</li>
              <li>Check browser console (F12) for detailed error logs</li>
              <li>Try the diagnostic endpoint: <a href="/api/admin/diagnostic" target="_blank" style={{ color: 'var(--primary)' }} className="hover:underline">/api/admin/diagnostic</a></li>
            </ul>
          </div>

          <div className="flex gap-3">
            <button
              onClick={fetchUsers}
              className="rounded-lg px-4 py-2 text-white hover:opacity-90"
              style={{ backgroundColor: 'var(--primary)' }}
            >
              Retry
            </button>
            <button
              onClick={() => window.open('/api/admin/diagnostic', '_blank')}
              className="rounded-lg bg-purple-600 px-4 py-2 text-white hover:bg-purple-700"
            >
              Run Diagnostics
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8" style={{ backgroundColor: 'var(--background)', color: 'var(--text-primary)' }}>
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold">User Management</h1>
        <button
          onClick={fetchUsers}
          className="rounded-lg px-4 py-2 text-sm text-white hover:opacity-90"
          style={{ backgroundColor: 'var(--primary)' }}
        >
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {/* Total Users */}
          <div className="glass-morphism rounded-2xl p-6">
            <div className="mb-2 text-sm" style={{ color: 'var(--text-secondary)' }}>Total Users</div>
            <div className="text-3xl font-bold">{stats.totalUsers}</div>
            <div className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              Active: {stats.activeUsers.last7Days} (7d)
            </div>
          </div>

          {/* Messages Today */}
          <div className="glass-morphism rounded-2xl p-6">
            <div className="mb-2 text-sm" style={{ color: 'var(--text-secondary)' }}>Messages Today</div>
            <div className="text-3xl font-bold">{stats.usage.totalMessagesToday}</div>
            <div className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              All-time: {stats.usage.totalMessagesAllTime.toLocaleString()}
            </div>
          </div>

          {/* Paid Users */}
          <div className="glass-morphism rounded-2xl p-6">
            <div className="mb-2 text-sm" style={{ color: 'var(--text-secondary)' }}>Paid Subscriptions</div>
            <div className="text-3xl font-bold">
              {stats.usersByTier.basic + stats.usersByTier.pro + stats.usersByTier.executive}
            </div>
            <div className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              Active: {stats.usersByStatus.active}
            </div>
          </div>

          {/* Active Today */}
          <div className="glass-morphism rounded-2xl p-6">
            <div className="mb-2 text-sm" style={{ color: 'var(--text-secondary)' }}>Active Today</div>
            <div className="text-3xl font-bold">{stats.activeUsers.today}</div>
            <div className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              30d: {stats.activeUsers.last30Days}
            </div>
          </div>
        </div>
      )}

      {/* Tier Breakdown */}
      {stats && (
        <div className="mb-8 glass-morphism rounded-2xl p-6">
          <div className="mb-4 text-lg font-semibold">Subscription Tiers</div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <div className="text-2xl font-bold">{stats.usersByTier.free}</div>
              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Free</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-500">{stats.usersByTier.basic}</div>
              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Plus ($18/mo)</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-500">{stats.usersByTier.pro}</div>
              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Pro ($30/mo)</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-amber-500">{stats.usersByTier.executive}</div>
              <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Executive ($99/mo)</div>
            </div>
          </div>
        </div>
      )}

      {/* Filters and Search */}
      <div className="mb-6 glass-morphism rounded-2xl p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {/* Search */}
          <input
            type="text"
            placeholder="Search by email or name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="rounded-lg px-4 py-2 focus:outline-none"
            style={{
              backgroundColor: 'var(--glass-bg)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
          />

          {/* Tier Filter */}
          <select
            value={filterTier}
            onChange={(e) => setFilterTier(e.target.value)}
            className="rounded-lg px-4 py-2 focus:outline-none"
            style={{
              backgroundColor: 'var(--glass-bg)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
          >
            <option value="all">All Tiers</option>
            <option value="free">Free</option>
            <option value="plus">Plus</option>
            <option value="pro">Pro</option>
            <option value="executive">Executive</option>
          </select>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-lg px-4 py-2 focus:outline-none"
            style={{
              backgroundColor: 'var(--glass-bg)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="trialing">Trialing</option>
            <option value="past_due">Past Due</option>
            <option value="canceled">Canceled</option>
          </select>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'created' | 'usage' | 'name')}
            className="rounded-lg px-4 py-2 focus:outline-none"
            style={{
              backgroundColor: 'var(--glass-bg)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
          >
            <option value="created">Sort by Newest</option>
            <option value="usage">Sort by Usage</option>
            <option value="name">Sort by Name</option>
          </select>
        </div>
        <div className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Showing {filteredUsers.length} of {users.length} users
        </div>
      </div>

      {/* No Users Warning */}
      {users.length === 0 && !loading && !error && (
        <div className="mb-6 glass-morphism rounded-2xl p-6">
          <div className="mb-2 text-lg font-semibold text-yellow-600">No Users Found</div>
          <div style={{ color: 'var(--text-secondary)' }}>
            The API is working correctly, but there are no users in the database yet.
            This is normal for a new installation.
          </div>
        </div>
      )}

      {/* Mobile User Cards (visible on small screens) */}
      <div className="lg:hidden space-y-4">
        {filteredUsers.map((user) => (
          <div key={user.id} className="glass-morphism rounded-xl p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{user.full_name || 'No name'}</div>
                <div className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>{user.email}</div>
              </div>
              <div className="flex gap-2 ml-2">
                <span className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${getTierColor(user.subscription_tier || 'free')}`}>
                  {(user.subscription_tier || 'free').charAt(0).toUpperCase() + (user.subscription_tier || 'free').slice(1)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Messages:</span>
                <span className="ml-1 font-medium">{(user.total_messages || 0).toLocaleString()}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Images:</span>
                <span className="ml-1 font-medium">{(user.total_images || 0).toLocaleString()}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Last Active:</span>
                <span className="ml-1">{formatDate(user.last_message_date)}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Joined:</span>
                <span className="ml-1">{new Date(user.created_at).toLocaleDateString()}</span>
              </div>
            </div>

            <a
              href={`/admin/users/${user.id}`}
              className="block w-full text-center rounded-lg px-4 py-3 text-sm font-medium text-white hover:opacity-90 transition"
              style={{ backgroundColor: 'var(--primary)' }}
            >
              View Chats
            </a>
          </div>
        ))}

        {filteredUsers.length === 0 && users.length > 0 && (
          <div className="glass-morphism rounded-xl p-8 text-center" style={{ color: 'var(--text-muted)' }}>
            No users found matching your filters
          </div>
        )}
      </div>

      {/* Desktop Users Table (hidden on small screens) */}
      <div className="hidden lg:block glass-morphism rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--glass-bg)' }}>
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold">User</th>
                <th className="px-6 py-4 text-left text-sm font-semibold">Tier</th>
                <th className="px-6 py-4 text-left text-sm font-semibold">Status</th>
                <th className="px-6 py-4 text-right text-sm font-semibold">Messages</th>
                <th className="px-6 py-4 text-right text-sm font-semibold">Images</th>
                <th className="px-6 py-4 text-left text-sm font-semibold">Last Active</th>
                <th className="px-6 py-4 text-left text-sm font-semibold">Joined</th>
                <th className="px-6 py-4 text-center text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody style={{ borderTop: '1px solid var(--border)' }}>
              {filteredUsers.map((user, index) => (
                <tr
                  key={user.id}
                  className="hover:bg-black/5 dark:hover:bg-white/5"
                  style={{ borderBottom: index < filteredUsers.length - 1 ? '1px solid var(--border)' : undefined }}
                >
                  <td className="px-6 py-4">
                    <div className="font-medium">{user.full_name || 'No name'}</div>
                    <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>{user.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${getTierColor(user.subscription_tier || 'free')}`}>
                      {(user.subscription_tier || 'free').charAt(0).toUpperCase() + (user.subscription_tier || 'free').slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {user.subscription_status ? (
                      <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${getStatusColor(user.subscription_status)}`}>
                        {user.subscription_status.charAt(0).toUpperCase() + user.subscription_status.slice(1)}
                      </span>
                    ) : (
                      <span className="text-sm" style={{ color: 'var(--text-muted)' }}>-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="font-medium">{user.messages_used_today || 0} today</div>
                    <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>{(user.total_messages || 0).toLocaleString()} total</div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="font-medium">{user.images_generated_today || 0} today</div>
                    <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>{(user.total_images || 0).toLocaleString()} total</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm">{formatDate(user.last_message_date)}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm">{new Date(user.created_at).toLocaleDateString()}</div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <a
                      href={`/admin/users/${user.id}`}
                      className="inline-block rounded-lg px-4 py-2 text-sm text-white hover:opacity-90 transition"
                      style={{ backgroundColor: 'var(--primary)' }}
                    >
                      View Chats
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredUsers.length === 0 && users.length > 0 && (
            <div className="py-12 text-center" style={{ color: 'var(--text-muted)' }}>
              No users found matching your filters
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
