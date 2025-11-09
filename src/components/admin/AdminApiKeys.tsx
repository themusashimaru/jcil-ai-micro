/**
 * API KEY MONITORING COMPONENT (SUMMARY)
 *
 * Admin dashboard component showing quick overview of API key health
 * Links to full monitoring page at /admin/api-keys
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, Key, Activity, TrendingUp, Users, Zap, AlertTriangle, CheckCircle, ExternalLink } from 'lucide-react';

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

export default function AdminApiKeys() {
  const router = useRouter();
  const [healthData, setHealthData] = useState<ApiKeyHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    // Refresh every 30 seconds
    const interval = setInterval(fetchHealthData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !healthData) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-900" />
      </div>
    );
  }

  if (error) {
    return (
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
    );
  }

  if (!healthData) {
    return null;
  }

  const { health, stats, keyGroupStats } = healthData;

  // Calculate total stats
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">API Key Load Balancing</h2>
          <p className="text-sm text-slate-600 mt-1">
            Monitor API key pool health and distribution across {stats.totalKeys} keys
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => router.push('/admin/api-keys')} variant="default">
            <ExternalLink className="mr-2 h-4 w-4" />
            View Full Dashboard
          </Button>
          <Button onClick={fetchHealthData} variant="outline" disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Health Status Card */}
      <Card className={`border-2 ${statusColors[health.status as keyof typeof statusColors]}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {statusIcons[health.status as keyof typeof statusIcons]}
            System Status: {health.status}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm mb-4">{health.message}</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-slate-600 uppercase tracking-wide">Total Keys</p>
              <p className="text-2xl font-bold mt-1">{stats.totalKeys}</p>
            </div>
            <div>
              <p className="text-xs text-slate-600 uppercase tracking-wide">Daily Capacity</p>
              <p className="text-2xl font-bold mt-1">{(health.estimatedCapacity.dailyUsers / 1000).toFixed(0)}K</p>
              <p className="text-xs text-slate-500">users/day</p>
            </div>
            <div>
              <p className="text-xs text-slate-600 uppercase tracking-wide">Concurrent</p>
              <p className="text-2xl font-bold mt-1">{(health.estimatedCapacity.concurrentUsers / 1000).toFixed(0)}K</p>
              <p className="text-xs text-slate-500">users</p>
            </div>
            <div>
              <p className="text-xs text-slate-600 uppercase tracking-wide">Requests/Day</p>
              <p className="text-2xl font-bold mt-1">{(health.estimatedCapacity.requestsPerDay / 1000000).toFixed(1)}M</p>
              <p className="text-xs text-slate-500">capacity</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" />
              Total Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalUsers.toLocaleString()}</p>
            <p className="text-xs text-slate-500 mt-1">
              Across {keyGroupStats.length} active key groups
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4 text-green-600" />
              Total Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalRequests.toLocaleString()}</p>
            <p className="text-xs text-slate-500 mt-1">All-time API requests</p>
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

      {/* Key Group Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Key Group Distribution
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
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      No key group stats available yet
                    </td>
                  </tr>
                ) : (
                  keyGroupStats
                    .sort((a, b) => a.key_group - b.key_group)
                    .map((stat) => {
                      const loadPercent = totalUsers > 0 ? (stat.user_count / totalUsers) * 100 : 0;
                      const isBalanced = loadPercent >= 2 && loadPercent <= 5; // Good if between 2-5% for 31 keys

                      return (
                        <tr key={stat.key_group} className="hover:bg-slate-50">
                          <td className="py-3 px-4">
                            <span className="font-mono font-semibold">Key #{stat.key_group}</span>
                          </td>
                          <td className="py-3 px-4">{stat.user_count.toLocaleString()}</td>
                          <td className="py-3 px-4">{stat.total_requests.toLocaleString()}</td>
                          <td className="py-3 px-4">{(stat.total_tokens / 1000).toFixed(1)}K</td>
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
    </div>
  );
}
