/**
 * DEDICATED API KEYS MONITORING PAGE
 *
 * Comprehensive monitoring dashboard for API key load balancing system
 * with multiple tabs for different views:
 * - Overview: High-level stats and health
 * - Key Groups: Detailed per-key breakdown
 * - Analytics: Charts and trends
 * - Settings: Configuration and management
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  RefreshCw,
  Key,
  Activity,
  TrendingUp,
  Users,
  Zap,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  Settings,
  Download,
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface KeyGroupStat {
  key_group: number;
  user_count: number;
  total_requests: number;
  total_tokens: number;
  last_request_at: string | null;
}

interface HealthStatus {
  healthy: boolean;
  totalKeys: number;
  status: string;
  message: string;
  estimatedCapacity: {
    dailyUsers: number;
    concurrentUsers: number;
    requestsPerDay: number;
  };
}

interface ApiKeyHealthData {
  ok: boolean;
  health: HealthStatus;
  stats: {
    totalKeys: number;
    keyGroups: number[];
    estimatedCapacity: {
      dailyUsers: number;
      concurrentUsers: number;
      requestsPerDay: number;
    };
  };
  keyGroupStats: KeyGroupStat[];
  timestamp: string;
}

type TabType = 'overview' | 'key-groups' | 'analytics' | 'settings';

const CHART_COLORS = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981',
  '#06b6d4', '#6366f1', '#a855f7', '#ef4444', '#f97316',
];

export default function ApiKeysMonitoringPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [healthData, setHealthData] = useState<ApiKeyHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchHealthData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/admin/api-keys/health');
      const data = await response.json();

      if (!data.ok) {
        throw new Error(data.error || 'Failed to fetch health data');
      }

      setHealthData(data);
    } catch (err: any) {
      setError(err.message || 'Unknown error');
      console.error('Error fetching API key health:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthData();

    // Auto-refresh every 10 seconds if enabled
    if (autoRefresh) {
      const interval = setInterval(fetchHealthData, 10000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  if (loading && !healthData) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <div className="flex items-center justify-center">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-900" />
        </div>
      </div>
    );
  }

  if (error && !healthData) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-900 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Error Loading API Key Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-700">{error}</p>
            <Button onClick={fetchHealthData} variant="outline" className="mt-4">
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!healthData) {
    return null;
  }

  const { health, stats, keyGroupStats } = healthData;

  // Calculate totals
  const totalUsers = keyGroupStats.reduce((sum, stat) => sum + stat.user_count, 0);
  const totalRequests = keyGroupStats.reduce((sum, stat) => sum + stat.total_requests, 0);
  const totalTokens = keyGroupStats.reduce((sum, stat) => sum + stat.total_tokens, 0);

  // Get status color
  const statusColors = {
    EXCELLENT: 'text-green-600 bg-green-50 border-green-200',
    GOOD: 'text-blue-600 bg-blue-50 border-blue-200',
    WARNING: 'text-yellow-600 bg-yellow-50 border-yellow-200',
    ERROR: 'text-red-600 bg-red-50 border-red-200',
  };

  const statusIcons = {
    EXCELLENT: <CheckCircle className="h-5 w-5" />,
    GOOD: <Activity className="h-5 w-5" />,
    WARNING: <AlertTriangle className="h-5 w-5" />,
    ERROR: <AlertTriangle className="h-5 w-5" />,
  };

  // Prepare data for charts
  const distributionData = keyGroupStats.map((stat) => ({
    name: `Key ${stat.key_group}`,
    users: stat.user_count,
    requests: stat.total_requests,
    tokens: stat.total_tokens,
  }));

  const pieData = keyGroupStats.slice(0, 10).map((stat, idx) => ({
    name: `Key ${stat.key_group}`,
    value: stat.user_count,
    fill: CHART_COLORS[idx % CHART_COLORS.length],
  }));

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto p-6 md:p-8">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => router.push('/admin')}
            className="mb-4 text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Admin Dashboard
          </Button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">API Key Load Balancing</h1>
              <p className="text-sm text-slate-600 mt-2">
                Monitoring {stats.totalKeys} API keys handling {totalUsers.toLocaleString()} users
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600">Auto-refresh</span>
                <button
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    autoRefresh ? 'bg-blue-600' : 'bg-slate-300'
                  }`}
                >
                  <div
                    className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                      autoRefresh ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <Button onClick={fetchHealthData} variant="outline" disabled={loading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </div>

        {/* Health Status Banner */}
        <Card className={`border-2 mb-6 ${statusColors[health.status as keyof typeof statusColors]}`}>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {statusIcons[health.status as keyof typeof statusIcons]}
                <div>
                  <h3 className="font-semibold">System Status: {health.status}</h3>
                  <p className="text-sm opacity-90">{health.message}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs opacity-75">Last Updated</p>
                <p className="text-sm font-medium">
                  {new Date(healthData.timestamp).toLocaleTimeString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tab Navigation */}
        <div className="border-b border-slate-200 mb-6">
          <div className="flex space-x-8">
            {[
              { id: 'overview', label: 'Overview', icon: TrendingUp },
              { id: 'key-groups', label: 'Key Groups', icon: Key },
              { id: 'analytics', label: 'Analytics', icon: BarChart3 },
              { id: 'settings', label: 'Settings', icon: Settings },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`flex items-center gap-2 pb-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                    isActive
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <>
              {/* Capacity Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Key className="h-4 w-4 text-blue-600" />
                      Active Keys
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">{stats.totalKeys}</p>
                    <p className="text-xs text-slate-500 mt-1">API keys detected</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Users className="h-4 w-4 text-green-600" />
                      Total Users
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">{totalUsers.toLocaleString()}</p>
                    <p className="text-xs text-slate-500 mt-1">Across all keys</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Activity className="h-4 w-4 text-purple-600" />
                      Total Requests
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">{totalRequests.toLocaleString()}</p>
                    <p className="text-xs text-slate-500 mt-1">All-time requests</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Zap className="h-4 w-4 text-yellow-600" />
                      Total Tokens
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">{(totalTokens / 1000000).toFixed(2)}M</p>
                    <p className="text-xs text-slate-500 mt-1">Tokens processed</p>
                  </CardContent>
                </Card>
              </div>

              {/* Capacity Overview */}
              <Card>
                <CardHeader>
                  <CardTitle>System Capacity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <p className="text-xs text-slate-600 uppercase tracking-wide mb-2">
                        Daily Capacity
                      </p>
                      <p className="text-4xl font-bold text-blue-600">
                        {(health.estimatedCapacity.dailyUsers / 1000).toFixed(0)}K
                      </p>
                      <p className="text-sm text-slate-500 mt-1">users per day</p>
                      <div className="mt-3 bg-blue-50 rounded-lg p-3">
                        <p className="text-xs text-blue-900">
                          Current usage: {totalUsers.toLocaleString()} users (
                          {((totalUsers / health.estimatedCapacity.dailyUsers) * 100).toFixed(1)}%
                          )
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-slate-600 uppercase tracking-wide mb-2">
                        Concurrent Users
                      </p>
                      <p className="text-4xl font-bold text-green-600">
                        {(health.estimatedCapacity.concurrentUsers / 1000).toFixed(0)}K
                      </p>
                      <p className="text-sm text-slate-500 mt-1">simultaneous users</p>
                      <div className="mt-3 bg-green-50 rounded-lg p-3">
                        <p className="text-xs text-green-900">
                          ~{(health.estimatedCapacity.concurrentUsers / stats.totalKeys).toFixed(0)}{' '}
                          concurrent per key
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="text-xs text-slate-600 uppercase tracking-wide mb-2">
                        Request Capacity
                      </p>
                      <p className="text-4xl font-bold text-purple-600">
                        {(health.estimatedCapacity.requestsPerDay / 1000000).toFixed(1)}M
                      </p>
                      <p className="text-sm text-slate-500 mt-1">requests per day</p>
                      <div className="mt-3 bg-purple-50 rounded-lg p-3">
                        <p className="text-xs text-purple-900">
                          ~{(health.estimatedCapacity.requestsPerDay / stats.totalKeys / 1000).toFixed(0)}K requests per key
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* User Distribution Pie Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>User Distribution (Top 10 Keys)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={(props: any) =>
                          `${props.name}: ${(props.percent * 100).toFixed(0)}%`
                        }
                        outerRadius={100}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </>
          )}

          {/* KEY GROUPS TAB */}
          {activeTab === 'key-groups' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  Key Group Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200">
                        <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase">
                          Key Group
                        </th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase">
                          Users
                        </th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase">
                          Requests
                        </th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase">
                          Tokens
                        </th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase">
                          Avg Tokens/Request
                        </th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase">
                          Last Activity
                        </th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 uppercase">
                          Load %
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {keyGroupStats.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-500">
                            No key group stats available yet
                          </td>
                        </tr>
                      ) : (
                        keyGroupStats
                          .sort((a, b) => a.key_group - b.key_group)
                          .map((stat) => {
                            const loadPercent =
                              totalUsers > 0 ? (stat.user_count / totalUsers) * 100 : 0;
                            const avgTokens =
                              stat.total_requests > 0
                                ? stat.total_tokens / stat.total_requests
                                : 0;
                            const isBalanced = loadPercent >= 2 && loadPercent <= 5;

                            return (
                              <tr key={stat.key_group} className="hover:bg-slate-50">
                                <td className="py-3 px-4">
                                  <span className="font-mono font-semibold text-blue-600">
                                    Key #{stat.key_group}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-slate-900">{stat.user_count.toLocaleString()}</td>
                                <td className="py-3 px-4 text-slate-900">{stat.total_requests.toLocaleString()}</td>
                                <td className="py-3 px-4 text-slate-900">{(stat.total_tokens / 1000).toFixed(1)}K</td>
                                <td className="py-3 px-4 text-slate-900">{avgTokens.toFixed(0)}</td>
                                <td className="py-3 px-4 text-sm text-slate-600">
                                  {stat.last_request_at
                                    ? new Date(stat.last_request_at).toLocaleString()
                                    : 'Never'}
                                </td>
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-2">
                                    <div className="flex-1 bg-slate-200 rounded-full h-2 max-w-[100px]">
                                      <div
                                        className={`h-2 rounded-full ${
                                          isBalanced ? 'bg-green-500' : 'bg-yellow-500'
                                        }`}
                                        style={{ width: `${Math.min(loadPercent, 100)}%` }}
                                      />
                                    </div>
                                    <span className="text-xs font-medium w-12 text-right">
                                      {loadPercent.toFixed(1)}%
                                    </span>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ANALYTICS TAB */}
          {activeTab === 'analytics' && (
            <>
              {/* Requests by Key */}
              <Card>
                <CardHeader>
                  <CardTitle>Requests by Key Group</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={distributionData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="requests" fill="#3b82f6" name="Total Requests" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Tokens by Key */}
              <Card>
                <CardHeader>
                  <CardTitle>Token Usage by Key Group</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={distributionData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="tokens" fill="#8b5cf6" name="Total Tokens" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </>
          )}

          {/* SETTINGS TAB */}
          {activeTab === 'settings' && (
            <Card>
              <CardHeader>
                <CardTitle>System Configuration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-2">Detected API Keys</h3>
                  <div className="bg-slate-50 rounded-lg p-4">
                    <p className="text-sm text-slate-700">
                      <strong>{stats.totalKeys}</strong> API keys detected
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Key groups: {stats.keyGroups.join(', ')}
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Auto-Refresh Settings</h3>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-600">
                      Automatically refresh data every 10 seconds
                    </span>
                    <button
                      onClick={() => setAutoRefresh(!autoRefresh)}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        autoRefresh ? 'bg-blue-600' : 'bg-slate-300'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${
                          autoRefresh ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">System Information</h3>
                  <div className="bg-slate-50 rounded-lg p-4 space-y-2 font-mono text-xs">
                    <p>
                      <span className="text-slate-600">Total Keys:</span>{' '}
                      <span className="font-semibold text-slate-900">{stats.totalKeys}</span>
                    </p>
                    <p>
                      <span className="text-slate-600">Total Users:</span>{' '}
                      <span className="font-semibold text-slate-900">{totalUsers.toLocaleString()}</span>
                    </p>
                    <p>
                      <span className="text-slate-600">Total Requests:</span>{' '}
                      <span className="font-semibold text-slate-900">{totalRequests.toLocaleString()}</span>
                    </p>
                    <p>
                      <span className="text-slate-600">Total Tokens:</span>{' '}
                      <span className="font-semibold text-slate-900">{totalTokens.toLocaleString()}</span>
                    </p>
                    <p>
                      <span className="text-slate-600">Last Updated:</span>{' '}
                      <span className="font-semibold text-slate-900">
                        {new Date(healthData.timestamp).toLocaleString()}
                      </span>
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Export Data</h3>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const dataStr = JSON.stringify(healthData, null, 2);
                      const blob = new Blob([dataStr], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = `api-key-stats-${new Date().toISOString()}.json`;
                      link.click();
                    }}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Export as JSON
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
