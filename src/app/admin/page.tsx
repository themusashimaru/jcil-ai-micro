'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Users, DollarSign, TrendingUp, Zap,
  Calendar, ArrowLeft, RefreshCw, Activity,
  Search, UserCog, Mail, Clock, BarChart3, LineChart,
  FileText, Download, MessageSquare, Paperclip, X, ExternalLink
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  LineChart as RechartsLineChart,
  BarChart as RechartsBarChart,
  AreaChart,
  Line,
  Bar,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

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

type TabType = 'overview' | 'users' | 'notifications' | 'reports' | 'activity';

// Helper function to format time ago
function getTimeAgo(timestamp: string): string {
  const now = new Date();
  const then = new Date(timestamp);
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return then.toLocaleDateString();
}

export default function AdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
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
  const [isUpdatingTier, setIsUpdatingTier] = useState(false);

  // Notification state
  const [notificationTitle, setNotificationTitle] = useState('');
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationTier, setNotificationTier] = useState<string>('all');
  const [isSendingNotification, setIsSendingNotification] = useState(false);

  // Activity feed state
  const [activities, setActivities] = useState<any[]>([]);
  const [activityStats, setActivityStats] = useState({ activeNow: 0, totalActivities: 0 });
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);

  // Conversation viewer state
  const [conversations, setConversations] = useState<any[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<any>(null);
  const [conversationSearch, setConversationSearch] = useState('');
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [isLoadingConversationDetail, setIsLoadingConversationDetail] = useState(false);

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
      setIsUpdatingTier(true);
      const response = await fetch('/api/admin/update-tier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, tier: newTier }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Server error response:', errorData);
        const errorDetails = `${errorData.error}\nDetails: ${errorData.details || 'none'}\nCode: ${errorData.code || 'none'}\nHint: ${errorData.hint || 'none'}`;
        throw new Error(errorDetails);
      }

      const result = await response.json();
      console.log('Update result:', result);

      // Small delay to ensure DB has updated
      await new Promise(resolve => setTimeout(resolve, 500));

      // Refresh users list and stats
      await fetchUsers();
      await fetchStats();

      // Close the modal
      setManagingUser(null);
      setSelectedTier('');

      alert('✅ User tier updated successfully!');
    } catch (err: any) {
      console.error('Failed to update user tier:', err);
      // Try to get detailed error from response
      const errorMsg = err.message || 'Unknown error';
      alert(`❌ Failed to update user tier: ${errorMsg}\n\nCheck console for details.`);
    } finally {
      setIsUpdatingTier(false);
    }
  };

  const handleManageUser = (user: User) => {
    setManagingUser(user);
    setSelectedTier(user.subscription_tier);
  };

  const sendNotification = async () => {
    if (!notificationTitle.trim() || !notificationMessage.trim()) {
      alert('❌ Please fill in both title and message');
      return;
    }

    try {
      setIsSendingNotification(true);
      const response = await fetch('/api/admin/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: notificationTitle,
          message: notificationMessage,
          tierFilter: notificationTier,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send notification');
      }

      const result = await response.json();
      alert(`✅ Notification sent successfully to ${result.sentCount} users!`);

      // Clear form
      setNotificationTitle('');
      setNotificationMessage('');
      setNotificationTier('all');
    } catch (err: any) {
      console.error('Failed to send notification:', err);
      alert(`❌ Failed to send notification: ${err.message}`);
    } finally {
      setIsSendingNotification(false);
    }
  };

  const fetchActivity = async () => {
    try {
      setIsLoadingActivity(true);
      const response = await fetch('/api/admin/activity');

      if (!response.ok) {
        throw new Error('Failed to fetch activity');
      }

      const data = await response.json();
      setActivities(data.activities || []);
      setActivityStats(data.stats || { activeNow: 0, totalActivities: 0 });
    } catch (err: any) {
      console.error('Failed to fetch activity:', err);
    } finally {
      setIsLoadingActivity(false);
    }
  };

  const fetchConversations = async () => {
    try {
      setIsLoadingConversations(true);
      const url = `/api/admin/conversations${conversationSearch ? `?search=${encodeURIComponent(conversationSearch)}` : ''}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Failed to fetch conversations');
      }

      const data = await response.json();
      setConversations(data.conversations || []);
    } catch (err: any) {
      console.error('Failed to fetch conversations:', err);
    } finally {
      setIsLoadingConversations(false);
    }
  };

  const fetchConversationDetail = async (conversationId: string) => {
    try {
      setIsLoadingConversationDetail(true);
      const response = await fetch(`/api/admin/conversations/${conversationId}`);

      if (!response.ok) {
        throw new Error('Failed to fetch conversation details');
      }

      const data = await response.json();
      setSelectedConversation(data);
    } catch (err: any) {
      console.error('Failed to fetch conversation details:', err);
      alert(`Failed to load conversation: ${err.message}`);
    } finally {
      setIsLoadingConversationDetail(false);
    }
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

  // Fetch activity when activity tab is opened and set up auto-refresh
  useEffect(() => {
    if (activeTab === 'activity') {
      fetchConversations();
    }
  }, [activeTab]);

  // Fetch conversations when search changes
  useEffect(() => {
    if (activeTab === 'activity') {
      const timer = setTimeout(() => {
        fetchConversations();
      }, 300); // Debounce search
      return () => clearTimeout(timer);
    }
  }, [conversationSearch]);

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

          {/* Tab Navigation */}
          <div className="mt-6 border-b border-slate-200">
            <div className="flex space-x-8">
              {[
                { id: 'overview', label: 'Overview', icon: TrendingUp },
                { id: 'users', label: 'Users', icon: Users },
                { id: 'notifications', label: 'Notifications', icon: Mail },
                { id: 'reports', label: 'Reports', icon: BarChart3 },
                { id: 'activity', label: 'Activity', icon: Activity },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as TabType)}
                    className={`
                      flex items-center gap-2 pb-3 px-1 border-b-2 font-medium text-sm transition-colors
                      ${isActive
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                      }
                    `}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <>
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
            <div className="space-y-6">
              {stats.revenue.byTier.map((tier) => {
                const percentage = stats.revenue.monthlyRecurring > 0
                  ? (tier.monthlyRevenue / stats.revenue.monthlyRecurring) * 100
                  : 0;
                const showTextInside = percentage > 15; // Only show text inside if bar is wide enough
                const isFree = tier.monthlyRevenue === 0;

                return (
                  <div key={tier.tier}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-slate-900 capitalize w-24">
                          {tier.tier}
                        </span>
                        <span className="text-sm text-slate-600">
                          {tier.count} {tier.count === 1 ? 'user' : 'users'}
                        </span>
                      </div>
                      <span className={`font-bold text-lg ${isFree ? 'text-slate-500' : 'text-slate-900'}`}>
                        ${tier.monthlyRevenue.toLocaleString()}
                        {isFree && ' (Free)'}
                      </span>
                    </div>
                    <div className="relative h-10 bg-slate-100 rounded-lg overflow-hidden">
                      {isFree ? (
                        <div className="h-full flex items-center px-3">
                          <span className="text-slate-500 text-sm font-medium">
                            Free tier - no revenue
                          </span>
                        </div>
                      ) : (
                        <>
                          <div
                            className={`h-full bg-gradient-to-r ${tierColors[tier.tier]} transition-all duration-500 rounded-lg flex items-center ${showTextInside ? 'justify-end px-4' : ''}`}
                            style={{
                              width: `${Math.max(percentage, 2)}%`,
                            }}
                          >
                            {showTextInside && (
                              <span className="text-white text-sm font-semibold">
                                {percentage.toFixed(1)}%
                              </span>
                            )}
                          </div>
                          {!showTextInside && (
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-600 text-xs font-medium">
                              {percentage.toFixed(1)}%
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
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

        {/* Charts & Visualizations */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Revenue vs Costs Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-slate-900">
                <LineChart className="h-5 w-5 mr-2 text-green-600" />
                Revenue & Profit
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <RechartsLineChart data={[
                  { name: 'Free', revenue: 0, cost: 0 },
                  { name: 'Basic', revenue: stats.revenue.byTier.find(t => t.tier === 'basic')?.monthlyRevenue || 0, cost: 0 },
                  { name: 'Pro', revenue: stats.revenue.byTier.find(t => t.tier === 'pro')?.monthlyRevenue || 0, cost: 0 },
                  { name: 'Executive', revenue: stats.revenue.byTier.find(t => t.tier === 'executive')?.monthlyRevenue || 0, cost: 0 },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" stroke="#64748b" />
                  <YAxis stroke="#64748b" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} name="Revenue ($)" />
                </RechartsLineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* User Distribution Pie Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-slate-900">
                <BarChart3 className="h-5 w-5 mr-2 text-blue-600" />
                User Distribution by Tier
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={stats.revenue.byTier.filter(t => t.count > 0)}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ tier, count }) => `${tier}: ${count}`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {stats.revenue.byTier.map((entry, index) => {
                      const colors = ['#94a3b8', '#60a5fa', '#8b5cf6', '#f59e0b'];
                      return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                    })}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Token Usage Trend */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center text-slate-900">
                <Activity className="h-5 w-5 mr-2 text-purple-600" />
                Performance Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={[
                  { name: 'Messages', value: stats.usage.totalMessages },
                  { name: 'Tokens (K)', value: Math.round(stats.usage.totalTokens / 1000) },
                  { name: 'Revenue ($)', value: stats.revenue.monthlyRecurring },
                  { name: 'Costs ($)', value: stats.costs.totalApiCost },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" stroke="#64748b" />
                  <YAxis stroke="#64748b" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                  />
                  <Area type="monotone" dataKey="value" stroke="#8b5cf6" fill="#c4b5fd" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
          </>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="space-y-6">
          {/* User Count by Tier */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 mb-3">
                    <Users className="h-6 w-6 text-slate-600" />
                  </div>
                  <p className="text-2xl font-bold text-slate-900">
                    {users.filter(u => u.subscription_tier === 'free').length}
                  </p>
                  <p className="text-sm text-slate-600 mt-1">Free Tier</p>
                  <p className="text-xs text-slate-500 mt-1">$0/month</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 mb-3">
                    <Users className="h-6 w-6 text-blue-600" />
                  </div>
                  <p className="text-2xl font-bold text-blue-900">
                    {users.filter(u => u.subscription_tier === 'basic').length}
                  </p>
                  <p className="text-sm text-slate-600 mt-1">Basic Tier</p>
                  <p className="text-xs text-slate-500 mt-1">$12/month</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-yellow-100 mb-3">
                    <Users className="h-6 w-6 text-yellow-600" />
                  </div>
                  <p className="text-2xl font-bold text-yellow-900">
                    {users.filter(u => u.subscription_tier === 'pro').length}
                  </p>
                  <p className="text-sm text-slate-600 mt-1">Pro Tier</p>
                  <p className="text-xs text-slate-500 mt-1">$30/month</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-purple-100 mb-3">
                    <Users className="h-6 w-6 text-purple-600" />
                  </div>
                  <p className="text-2xl font-bold text-purple-900">
                    {users.filter(u => u.subscription_tier === 'executive').length}
                  </p>
                  <p className="text-sm text-slate-600 mt-1">Executive Tier</p>
                  <p className="text-xs text-slate-500 mt-1">$150/month</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* User Management Table */}
          <Card>
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
        </div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <div className="max-w-2xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-slate-900">
                  <Mail className="h-5 w-5 mr-2 text-blue-600" />
                  Send Notifications to Users
                </CardTitle>
                <p className="text-sm text-slate-600 mt-2">
                  Send announcements, updates, or messages to your users. Filter by subscription tier.
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Target Audience */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Target Audience
                  </label>
                  <select
                    value={notificationTier}
                    onChange={(e) => setNotificationTier(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white"
                  >
                    <option value="all">All Users ({users.length} users)</option>
                    <option value="free">Free Tier ({users.filter(u => u.subscription_tier === 'free').length} users)</option>
                    <option value="basic">Basic Tier ({users.filter(u => u.subscription_tier === 'basic').length} users)</option>
                    <option value="pro">Pro Tier ({users.filter(u => u.subscription_tier === 'pro').length} users)</option>
                    <option value="executive">Executive Tier ({users.filter(u => u.subscription_tier === 'executive').length} users)</option>
                  </select>
                </div>

                {/* Notification Title */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Notification Title
                  </label>
                  <Input
                    type="text"
                    value={notificationTitle}
                    onChange={(e) => setNotificationTitle(e.target.value)}
                    placeholder="e.g., New Features Released!"
                    className="w-full"
                    maxLength={100}
                  />
                  <p className="text-xs text-slate-500 mt-1">{notificationTitle.length}/100 characters</p>
                </div>

                {/* Notification Message */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Message
                  </label>
                  <textarea
                    value={notificationMessage}
                    onChange={(e) => setNotificationMessage(e.target.value)}
                    placeholder="Write your message here..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white min-h-[150px]"
                    maxLength={500}
                  />
                  <p className="text-xs text-slate-500 mt-1">{notificationMessage.length}/500 characters</p>
                </div>

                {/* Preview */}
                {(notificationTitle || notificationMessage) && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-xs font-semibold text-blue-900 mb-2">Preview:</p>
                    {notificationTitle && <p className="font-semibold text-blue-900 mb-1">{notificationTitle}</p>}
                    {notificationMessage && <p className="text-sm text-blue-800">{notificationMessage}</p>}
                  </div>
                )}

                {/* Send Button */}
                <div className="flex gap-3">
                  <Button
                    onClick={() => {
                      setNotificationTitle('');
                      setNotificationMessage('');
                      setNotificationTier('all');
                    }}
                    variant="outline"
                    className="flex-1"
                    disabled={isSendingNotification}
                  >
                    Clear
                  </Button>
                  <Button
                    onClick={sendNotification}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                    disabled={isSendingNotification || !notificationTitle.trim() || !notificationMessage.trim()}
                  >
                    {isSendingNotification ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Mail className="h-4 w-4 mr-2" />
                        Send Notification
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Reports Tab */}
        {activeTab === 'reports' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center text-slate-900">
                <BarChart3 className="h-5 w-5 mr-2 text-green-600" />
                Export Reports
              </CardTitle>
              <p className="text-sm text-slate-600 mt-2">
                Download comprehensive reports of your user data and statistics
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* CSV Export */}
              <div className="border border-slate-200 rounded-lg p-6 hover:border-blue-300 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <FileText className="h-6 w-6 text-green-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900">CSV Export</h3>
                        <p className="text-sm text-slate-500">Spreadsheet format</p>
                      </div>
                    </div>
                    <p className="text-sm text-slate-600 mb-4">
                      Download a CSV file containing all user data including emails, subscription tiers,
                      message counts, token usage, and activity dates. Perfect for importing into
                      Excel or Google Sheets.
                    </p>
                    <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                      <span className="px-2 py-1 bg-slate-100 rounded">Email addresses</span>
                      <span className="px-2 py-1 bg-slate-100 rounded">Subscription tiers</span>
                      <span className="px-2 py-1 bg-slate-100 rounded">Usage statistics</span>
                      <span className="px-2 py-1 bg-slate-100 rounded">Activity dates</span>
                    </div>
                  </div>
                  <Button
                    onClick={() => window.open('/api/admin/export/csv', '_blank')}
                    className="ml-4 bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download CSV
                  </Button>
                </div>
              </div>

              {/* PDF Export */}
              <div className="border border-slate-200 rounded-lg p-6 hover:border-blue-300 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 bg-red-100 rounded-lg">
                        <FileText className="h-6 w-6 text-red-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900">PDF Report</h3>
                        <p className="text-sm text-slate-500">Professional document</p>
                      </div>
                    </div>
                    <p className="text-sm text-slate-600 mb-4">
                      Generate a comprehensive PDF report with dashboard statistics, revenue breakdowns,
                      user distribution charts, and detailed user listings. Includes formatted tables
                      and professional styling ready for presentations or archiving.
                    </p>
                    <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                      <span className="px-2 py-1 bg-slate-100 rounded">Dashboard stats</span>
                      <span className="px-2 py-1 bg-slate-100 rounded">Revenue analysis</span>
                      <span className="px-2 py-1 bg-slate-100 rounded">User breakdown</span>
                      <span className="px-2 py-1 bg-slate-100 rounded">Print-ready</span>
                    </div>
                  </div>
                  <Button
                    onClick={() => window.open('/api/admin/export/pdf', '_blank')}
                    className="ml-4 bg-red-600 hover:bg-red-700 text-white"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Generate PDF
                  </Button>
                </div>
              </div>

              {/* Info Card */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-900 mb-1">Export Information</p>
                    <ul className="text-sm text-blue-800 space-y-1">
                      <li>• Exports include data for all {users.length} users in the system</li>
                      <li>• CSV files can be opened in Excel, Google Sheets, or any spreadsheet application</li>
                      <li>• PDF reports will automatically open in a new tab with a print dialog</li>
                      <li>• All exports reflect real-time data at the moment of generation</li>
                    </ul>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Activity Tab - Conversation Viewer */}
        {activeTab === 'activity' && (
          <div className="space-y-6">
            {/* Warning Banner */}
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <div className="p-2 bg-red-100 rounded-full">
                    <ExternalLink className="h-5 w-5 text-red-600" />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-red-900 mb-1">⚠️ Admin Conversation Viewer - Legal/Investigation Use Only</h3>
                  <p className="text-sm text-red-800">
                    This tool provides full access to all user conversations and attachments for legal compliance, investigations, and user support.
                    All access is logged. Use only when authorized.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Conversation List */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center text-slate-900">
                    <MessageSquare className="h-5 w-5 mr-2 text-purple-600" />
                    All Conversations
                  </CardTitle>
                  <div className="mt-4">
                    <div className="relative">
                      <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                      <Input
                        type="text"
                        placeholder="Search by email, title, or content..."
                        value={conversationSearch}
                        onChange={(e) => setConversationSearch(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      {conversations.length} conversation{conversations.length !== 1 ? 's' : ''} found
                    </p>
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoadingConversations ? (
                    <div className="text-center py-12">
                      <RefreshCw className="h-8 w-8 text-slate-400 animate-spin mx-auto mb-2" />
                      <p className="text-slate-600">Loading conversations...</p>
                    </div>
                  ) : conversations.length === 0 ? (
                    <div className="text-center py-12">
                      <MessageSquare className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                      <p className="text-slate-600 mb-2">No conversations found</p>
                      <p className="text-sm text-slate-500">
                        {conversationSearch ? 'Try a different search term' : 'No conversations in the system yet'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[600px] overflow-y-auto">
                      {conversations.map((conv) => {
                        const getTierColor = (tier: string) => {
                          switch (tier) {
                            case 'free': return 'bg-slate-100 text-slate-700';
                            case 'basic': return 'bg-blue-100 text-blue-700';
                            case 'pro': return 'bg-yellow-100 text-yellow-700';
                            case 'executive': return 'bg-purple-100 text-purple-700';
                            default: return 'bg-slate-100 text-slate-700';
                          }
                        };

                        return (
                          <div
                            key={conv.id}
                            onClick={() => fetchConversationDetail(conv.id)}
                            className={`p-4 border rounded-lg cursor-pointer transition-all hover:border-purple-300 hover:bg-purple-50 ${
                              selectedConversation?.conversation?.id === conv.id
                                ? 'border-purple-500 bg-purple-50'
                                : 'border-slate-200'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-slate-900 truncate">
                                  {conv.user_email}
                                </p>
                                <p className="text-xs text-slate-600 truncate">
                                  {conv.title || 'Untitled conversation'}
                                </p>
                              </div>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 ${getTierColor(conv.user_tier)}`}>
                                {conv.user_tier}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-slate-500">
                              <span className="flex items-center gap-1">
                                <MessageSquare className="h-3 w-3" />
                                {conv.message_count}
                              </span>
                              <span className="flex items-center gap-1">
                                <Paperclip className="h-3 w-3" />
                                {conv.attachment_count}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {new Date(conv.updated_at).toLocaleDateString()}
                              </span>
                            </div>
                            {conv.latest_message && (
                              <p className="text-xs text-slate-500 mt-2 line-clamp-2">
                                {conv.latest_message.content}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Conversation Detail Viewer */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center text-slate-900">
                      {selectedConversation ? (
                        <>
                          <MessageSquare className="h-5 w-5 mr-2 text-purple-600" />
                          Conversation Details
                        </>
                      ) : (
                        <>
                          <MessageSquare className="h-5 w-5 mr-2 text-slate-400" />
                          Select a Conversation
                        </>
                      )}
                    </CardTitle>
                    {selectedConversation && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(`/api/admin/conversations/${selectedConversation.conversation.id}/export`, '_blank')}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Export
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelectedConversation(null)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoadingConversationDetail ? (
                    <div className="text-center py-12">
                      <RefreshCw className="h-8 w-8 text-slate-400 animate-spin mx-auto mb-2" />
                      <p className="text-slate-600">Loading conversation...</p>
                    </div>
                  ) : !selectedConversation ? (
                    <div className="text-center py-12">
                      <MessageSquare className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                      <p className="text-slate-600 mb-2">No conversation selected</p>
                      <p className="text-sm text-slate-500">Click on a conversation to view full details</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Conversation Meta */}
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-slate-600 mb-1">User</p>
                            <p className="font-semibold text-slate-900">{selectedConversation.conversation.user_email}</p>
                          </div>
                          <div>
                            <p className="text-slate-600 mb-1">Tier</p>
                            <p className="font-semibold text-slate-900 capitalize">{selectedConversation.conversation.user_tier}</p>
                          </div>
                          <div>
                            <p className="text-slate-600 mb-1">Messages</p>
                            <p className="font-semibold text-slate-900">{selectedConversation.stats.total_messages}</p>
                          </div>
                          <div>
                            <p className="text-slate-600 mb-1">Attachments</p>
                            <p className="font-semibold text-slate-900">{selectedConversation.stats.total_attachments}</p>
                          </div>
                        </div>
                      </div>

                      {/* Messages */}
                      <div className="space-y-3 max-h-[500px] overflow-y-auto">
                        <h3 className="text-sm font-semibold text-slate-900 sticky top-0 bg-white pb-2">
                          Messages ({selectedConversation.stats.total_messages})
                        </h3>
                        {selectedConversation.messages.map((msg: any) => (
                          <div
                            key={msg.id}
                            className={`p-3 rounded-lg border ${
                              msg.role === 'user'
                                ? 'bg-blue-50 border-blue-200'
                                : msg.role === 'assistant'
                                ? 'bg-green-50 border-green-200'
                                : 'bg-slate-50 border-slate-200'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className={`text-xs font-semibold uppercase ${
                                msg.role === 'user' ? 'text-blue-700' :
                                msg.role === 'assistant' ? 'text-green-700' :
                                'text-slate-700'
                              }`}>
                                {msg.role}
                              </span>
                              <span className="text-xs text-slate-500">
                                {new Date(msg.created_at).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-sm text-slate-700 whitespace-pre-wrap break-words">
                              {msg.content || '[No content]'}
                            </p>
                          </div>
                        ))}
                      </div>

                      {/* Attachments */}
                      {selectedConversation.attachments.length > 0 && (
                        <div className="space-y-2">
                          <h3 className="text-sm font-semibold text-slate-900">
                            Attachments ({selectedConversation.stats.total_attachments})
                          </h3>
                          {selectedConversation.attachments.map((att: any) => (
                            <div key={att.id} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg">
                              <div className="flex items-center gap-2">
                                <Paperclip className="h-4 w-4 text-slate-600" />
                                <div>
                                  <p className="text-sm font-medium text-slate-900">{att.file_name || 'Unknown file'}</p>
                                  <p className="text-xs text-slate-500">
                                    {att.file_type} • {att.file_size ? (att.file_size / 1024).toFixed(2) + ' KB' : 'Unknown size'}
                                  </p>
                                </div>
                              </div>
                              <span className="text-xs text-slate-500">
                                {new Date(att.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Date Range Info - Only on Overview Tab */}
        {activeTab === 'overview' && (
          <div className="text-center mt-8">
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
        )}
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
                disabled={isUpdatingTier}
                className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white"
              >
                <option value="free" className="text-slate-900">Free - $0/month</option>
                <option value="basic" className="text-slate-900">Basic - $12/month</option>
                <option value="pro" className="text-slate-900">Pro - $30/month</option>
                <option value="executive" className="text-slate-900">Executive - $150/month</option>
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
                disabled={isUpdatingTier}
              >
                Cancel
              </Button>
              <Button
                onClick={() => updateUserTier(managingUser.id, selectedTier)}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                disabled={selectedTier === managingUser.subscription_tier || isUpdatingTier}
              >
                {isUpdatingTier ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Update Tier'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
