'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Users, DollarSign, TrendingUp, Zap,
  Calendar, ArrowLeft, RefreshCw, Activity
} from 'lucide-react';

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
  const [period, setPeriod] = useState<'daily' | 'monthly' | 'quarterly' | 'half' | 'yearly'>('monthly');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    fetchStats();
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
              variant="outline"
              onClick={() => router.push('/')}
              className="border-slate-300 text-slate-700 hover:bg-slate-50"
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
            <CardTitle>Revenue by Tier</CardTitle>
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
              <CardTitle className="flex items-center">
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
              <CardTitle className="flex items-center">
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
    </div>
  );
}
