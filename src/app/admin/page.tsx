'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Users, DollarSign, TrendingUp, Zap,
  Calendar, ArrowLeft, RefreshCw, Activity,
  Search, UserCog, Mail, Clock
} from 'lucide-react';
import { Input } from '@/components/ui/input';

interface User {
  id: string;
  email: string;
  subscription_tier: string;
  daily_message_count: number;
  daily_message_limit: number;
  daily_token_count: number;
  last_active: string;
  created_at: string;
}

interface AdminStats {
  period: string;
  dateRange: { start: string; end: string };
  users: {
    total: number;
    byTier: Record<string, number>;
    newSignups: number;
  };
  revenue: {
    monthlyRecurring: number;
    byTier: Array<{ tier: string; count: number; monthlyRevenue: number }>;
    annualProjection: number;
  };
  usage: {
    totalMessages: number;
    totalTokens: number;
    estimatedInputTokens: number;
    estimatedOutputTokens: number;
  };
  costs: {
    totalApiCost: number;
    inputCost: number;
    outputCost: number;
    avgCostPerMessage: number;
  };
  profit: {
    gross: number;
    margin: number;
  };
}

export default function AdminDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [period, setPeriod] = useState<'daily' | 'monthly' | 'quarterly' | 'half' | 'yearly'>('monthly');
  const [loading, setLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [managingUser, setManagingUser] = useState<User | null>(null);
  const [selectedTier, setSelectedTier] = useState<string>('');

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/admin/stats?period=${period}`);

      if (response.status === 403) {
        setError('Access denied - Admin privileges required');
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }

      const data = await response.json();
      setStats(data);
    } catch (err: any) {
      setError(err.message);
      console.error('Failed to load admin stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      setUsersLoading(true);
      setUsersError(null);
      const response = await fetch('/api/admin/users');

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || 'Failed to fetch users');
      }

      const data = await response.json();
      setUsers(data.users);
      setFilteredUsers(data.users);
    } catch (err: any) {
      console.error('Failed to load users:', err);
      setUsersError(err.message);
    } finally {
      setUsersLoading(false);
    }
  };

  const updateUserTier = async (userId: string, newTier: string) => {
    try {
      const response = await fetch('/api/admin/update-tier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, tier: newTier }),
      });

      if (!response.ok) {
        throw new Error('Failed to update user tier');
      }

      // Refresh users list
      await fetchUsers();
      await fetchStats();

      // Close the modal
      setManagingUser(null);
      setSelectedTier('');
    } catch (err: any) {
      console.error('Failed to update user tier:', err);
      alert('Failed to update user tier: ' + err.message);
    }
  };

  const handleManageUser = (user: User) => {
    setManagingUser(user);
    setSelectedTier(user.subscription_tier);
  };

  // Filter users based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredUsers(users);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredUsers(
        users.filter(
          (user) =>
            user.email.toLowerCase().includes(query) ||
            user.subscription_tier.toLowerCase().includes(query)
        )
      );
    }
  }, [searchQuery, users]);

  useEffect(() => {
    fetchStats();
    fetchUsers();
  }, [period]);

  if (loading && !stats) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-12 w-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-red-600">Access Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-600 mb-4">{error}</p>
            <Button onClick={() => router.push('/')} className="w-full">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Chat
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!stats) return null;

  const tierColors: Record<string, string> = {
    free: 'from-slate-500 to-slate-600',
    basic: 'from-blue-500 to-blue-600',
    pro: 'from-blue-600 to-blue-700',
    premium: 'from-purple-500 to-purple-600',
    executive: 'from-amber-500 to-amber-600',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Admin Dashboard</h1>
              <p className="text-slate-600 mt-1">JCIL.AI Command Center</p>
            </div>
            <Button
              onClick={() => router.push('/')}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Chat
            </Button>
          </div>

          {/* Period Selector */}
          <div className="flex gap-2 mt-6 flex-wrap">
            {([
              { key: 'daily', label: 'Today' },
              { key: 'monthly', label: 'This Month' },
              { key: 'quarterly', label: 'This Quarter' },
              { key: 'half', label: 'This Half' },
              { key: 'yearly', label: 'This Year' }
            ] as const).map((p) => (
              <Button
                key={p.key}
                variant={period === p.key ? 'default' : 'outline'}
                size="sm"
                onClick={() => setPeriod(p.key)}
                className={period === p.key ? 'bg-blue-600 hover:bg-blue-700' : ''}
              >
                {p.label}
              </Button>
            ))}
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchStats}
              disabled={loading}
              className="ml-auto"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Top Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Users */}
          <Card className="border-l-4 border-l-blue-600">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Total Users</CardTitle>
              <Users className="h-5 w-5 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">{stats.users.total}</div>
              <p className="text-xs text-slate-500 mt-1">
                +{stats.users.newSignups} new this period
              </p>
            </CardContent>
          </Card>

          {/* Monthly Revenue */}
          <Card className="border-l-4 border-l-green-600">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Monthly Revenue</CardTitle>
              <DollarSign className="h-5 w-5 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">
                ${stats.revenue.monthlyRecurring.toLocaleString()}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                ${stats.revenue.annualProjection.toLocaleString()} annual projection
              </p>
            </CardContent>
          </Card>

          {/* Total Messages */}
          <Card className="border-l-4 border-l-purple-600">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Messages</CardTitle>
              <Activity className="h-5 w-5 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">
                {stats.usage.totalMessages.toLocaleString()}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {stats.usage.totalTokens.toLocaleString()} tokens
              </p>
            </CardContent>
          </Card>

          {/* Gross Profit */}
          <Card className="border-l-4 border-l-amber-600">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Gross Profit</CardTitle>
              <TrendingUp className="h-5 w-5 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">
                ${stats.profit.gross.toLocaleString()}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {stats.profit.margin}% margin
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Revenue Breakdown */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-slate-900">Revenue by Tier</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.revenue.byTier.map((tier) => (
                <div key={tier.tier} className="flex items-center">
                  <div className="w-32 font-medium text-slate-700 capitalize">
                    {tier.tier}
                  </div>
                  <div className="flex-1 mx-4">
                    <div className="h-8 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full bg-gradient-to-r ${tierColors[tier.tier]} flex items-center justify-end px-3 text-white text-sm font-semibold transition-all duration-500`}
                        style={{
                          width: `${(tier.monthlyRevenue / stats.revenue.monthlyRecurring) * 100}%`,
                        }}
                      >
                        {tier.count > 0 && `${tier.count} users`}
                      </div>
                    </div>
                  </div>
                  <div className="w-24 text-right font-bold text-slate-900">
                    ${tier.monthlyRevenue.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Cost Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* API Costs */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-slate-900">
                <Zap className="h-5 w-5 mr-2 text-orange-500" />
                API Costs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center pb-3 border-b">
                  <span className="text-slate-600">Total API Cost</span>
                  <span className="text-2xl font-bold text-slate-900">
                    ${stats.costs.totalApiCost.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Input Tokens</span>
                  <span className="font-semibold text-slate-900">
                    ${stats.costs.inputCost.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Output Tokens</span>
                  <span className="font-semibold text-slate-900">
                    ${stats.costs.outputCost.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-3 border-t">
                  <span className="text-sm text-slate-600">Avg Cost/Message</span>
                  <span className="font-semibold text-slate-900">
                    ${stats.costs.avgCostPerMessage.toFixed(4)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Token Usage */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-slate-900">
                <Activity className="h-5 w-5 mr-2 text-purple-500" />
                Token Usage
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center pb-3 border-b">
                  <span className="text-slate-600">Total Tokens</span>
                  <span className="text-2xl font-bold text-slate-900">
                    {(stats.usage.totalTokens / 1_000_000).toFixed(2)}M
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Input Tokens (est.)</span>
                  <span className="font-semibold text-slate-900">
                    {(stats.usage.estimatedInputTokens / 1_000_000).toFixed(2)}M
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Output Tokens (est.)</span>
                  <span className="font-semibold text-slate-900">
                    {(stats.usage.estimatedOutputTokens / 1_000_000).toFixed(2)}M
                  </span>
                </div>
                <div className="flex justify-between items-center pt-3 border-t">
                  <span className="text-sm text-slate-600">Total Messages</span>
                  <span className="font-semibold text-slate-900">
                    {stats.usage.totalMessages.toLocaleString()}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* User Management Table */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <CardTitle className="flex items-center text-slate-900">
                <UserCog className="h-5 w-5 mr-2 text-blue-600" />
                User Management
              </CardTitle>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:flex-initial">
                  <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                  <Input
                    type="text"
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 w-full sm:w-64"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={fetchUsers}
                  disabled={usersLoading}
                  className="flex-shrink-0"
                >
                  <RefreshCw className={`h-4 w-4 ${usersLoading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {usersError ? (
              <div className="text-center py-8">
                <div className="text-red-600 font-semibold mb-2">Error loading users</div>
                <div className="text-sm text-slate-600 mb-4">{usersError}</div>
                <div className="text-xs text-slate-500 bg-slate-50 p-4 rounded-lg max-w-2xl mx-auto text-left">
                  <p className="font-semibold mb-2">💡 Did you run the SQL setup?</p>
                  <p>Make sure you ran the <code className="bg-white px-2 py-1 rounded">add-admin-user-management.sql</code> file in your Supabase SQL Editor.</p>
                  <p className="mt-2">This creates the <code className="bg-white px-2 py-1 rounded">get_all_users_for_admin()</code> function needed to fetch user data.</p>
                </div>
                <Button
                  onClick={fetchUsers}
                  className="mt-4 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
              </div>
            ) : usersLoading ? (
              <div className="text-center py-8 text-slate-500">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
                Loading users...
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                {searchQuery ? 'No users found matching your search' : 'No users yet'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">
                        <Mail className="h-4 w-4 inline mr-1" />
                        Email
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Tier</th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-slate-700">Today's Usage</th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-slate-700">Tokens</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">
                        <Clock className="h-4 w-4 inline mr-1" />
                        Last Active
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700">Joined</th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-slate-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => {
                      const tierColorMap: Record<string, string> = {
                        free: 'bg-slate-100 text-slate-700',
                        basic: 'bg-blue-100 text-blue-700',
                        pro: 'bg-blue-200 text-blue-800',
                        premium: 'bg-purple-100 text-purple-700',
                        executive: 'bg-amber-100 text-amber-700',
                      };

                      return (
                        <tr key={user.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="py-3 px-4 text-sm text-slate-900">{user.email}</td>
                          <td className="py-3 px-4">
                            <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold uppercase ${tierColorMap[user.subscription_tier] || tierColorMap.free}`}>
                              {user.subscription_tier}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center text-sm text-slate-700">
                            {user.daily_message_count} / {user.daily_message_limit}
                          </td>
                          <td className="py-3 px-4 text-center text-sm text-slate-700">
                            {user.daily_token_count.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-sm text-slate-600">
                            {new Date(user.last_active).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4 text-sm text-slate-600">
                            {new Date(user.created_at).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs"
                              onClick={() => handleManageUser(user)}
                            >
                              Manage
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-4 text-sm text-slate-500 text-center">
              Showing {filteredUsers.length} of {users.length} users
            </div>
          </CardContent>
        </Card>

        {/* Date Range Info */}
        <div className="text-center">
          <div className="text-sm text-slate-500">
            <Calendar className="h-4 w-4 inline mr-2" />
            Showing data from {new Date(stats.dateRange.start).toLocaleDateString()} to{' '}
            {new Date(stats.dateRange.end).toLocaleDateString()}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Usage stats (messages, tokens, costs) are filtered by fiscal period. User counts and revenue show current totals.
            <br />
            Fiscal year: January 1 - December 31
          </div>
        </div>
      </div>

      {/* Tier Management Modal */}
      {managingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Manage User Subscription</h3>

            <div className="mb-4">
              <p className="text-sm text-slate-600 mb-1">User Email:</p>
              <p className="font-semibold text-slate-900">{managingUser.email}</p>
            </div>

            <div className="mb-4">
              <p className="text-sm text-slate-600 mb-1">Current Tier:</p>
              <p className="font-semibold text-slate-900 capitalize">{managingUser.subscription_tier}</p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                New Subscription Tier:
              </label>
              <select
                value={selectedTier}
                onChange={(e) => setSelectedTier(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="free">Free - $0/month</option>
                <option value="basic">Basic - $12/month</option>
                <option value="pro">Pro - $12/month</option>
                <option value="premium">Premium - $30/month</option>
                <option value="executive">Executive - $150/month</option>
              </select>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => {
                  setManagingUser(null);
                  setSelectedTier('');
                }}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={() => updateUserTier(managingUser.id, selectedTier)}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                disabled={selectedTier === managingUser.subscription_tier}
              >
                Update Tier
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
