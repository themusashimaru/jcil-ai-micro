'use client';

import { useState, useEffect } from 'react';

interface EarningsData {
  users: {
    byTier: {
      free: number;
      basic: number;
      pro: number;
      executive: number;
    };
    total: number;
  };
  revenue: {
    monthly: {
      free: number;
      basic: number;
      pro: number;
      executive: number;
      total: number;
    };
    daily: number;
  };
  costs: {
    byModel: Record<string, {
      inputTokens: number;
      cachedInputTokens: number;
      outputTokens: number;
      liveSearchCalls: number;
      totalCost: number;
      usageCount: number;
    }>;
    byTier: {
      free: number;
      basic: number;
      pro: number;
      executive: number;
    };
    news: {
      totalCalls: number;
      totalTokens: number;
      totalCost: number;
    };
    total: number;
    daily: number;
  };
  profit: {
    byTier: {
      free: number;
      basic: number;
      pro: number;
      executive: number;
      total: number;
    };
    daily: number;
    margin: string;
  };
  apiPricing: Array<{
    model_name: string;
    input_price_per_million: number;
    cached_input_price_per_million: number | null;
    output_price_per_million: number;
    live_search_price_per_thousand: number | null;
  }>;
  dateRange: {
    start: string;
    end: string;
    days: number;
  };
}

export default function AdminEarningsPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<EarningsData | null>(null);
  const [error, setError] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [generatingReport, setGeneratingReport] = useState(false);
  const [reportType, setReportType] = useState<'daily' | 'monthly' | 'quarterly' | 'half-yearly' | 'yearly'>('monthly');
  const [generatedReport, setGeneratedReport] = useState<{ reportId: string; report: string } | null>(null);

  const fetchEarnings = async () => {
    try {
      setLoading(true);
      setError('');

      let url = '/api/admin/earnings';
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (params.toString()) url += `?${params.toString()}`;

      const response = await fetch(url);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch earnings data');
      }

      setData(result.data);
    } catch (err) {
      console.error('Error fetching earnings:', err);
      setError(err instanceof Error ? err.message : 'Failed to load earnings data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEarnings();
  }, []);

  const handleExportExcel = async () => {
    try {
      let url = '/api/admin/earnings/export/excel';
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (params.toString()) url += `?${params.toString()}`;

      window.open(url, '_blank');
    } catch (err) {
      console.error('Error exporting to Excel:', err);
      alert('Failed to export to Excel');
    }
  };

  const handleGenerateReport = async () => {
    try {
      setGeneratingReport(true);
      setGeneratedReport(null);

      const response = await fetch('/api/admin/earnings/generate-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportType,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to generate report');
      }

      setGeneratedReport({
        reportId: result.data.reportId,
        report: result.data.report,
      });

    } catch (err) {
      console.error('Error generating report:', err);
      alert(err instanceof Error ? err.message : 'Failed to generate report');
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleExportReportPDF = () => {
    if (generatedReport) {
      window.open(`/api/admin/earnings/export/pdf?reportId=${generatedReport.reportId}`, '_blank');
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(value);
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-red-900 mb-2">Error Loading Earnings</h2>
          <p className="text-red-700">{error}</p>
          <button
            onClick={fetchEarnings}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-100 mb-2">Financial Analytics</h1>
        <p className="text-gray-300">Track revenue, costs, and profitability across all user tiers and AI models</p>
      </div>

      {/* Date Filter */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Date Range Filter</h2>
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={fetchEarnings}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            Apply Filter
          </button>
          <button
            onClick={() => {
              setStartDate('');
              setEndDate('');
              fetchEarnings();
            }}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
          >
            Clear
          </button>
        </div>
        <p className="text-sm text-gray-500 mt-2">
          Showing data for: {data.dateRange.start} to {data.dateRange.end} ({data.dateRange.days} days)
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-sm font-medium text-gray-500 mb-1">Total Revenue</div>
          <div className="text-3xl font-bold text-green-600">{formatCurrency(data.revenue.monthly.total)}</div>
          <div className="text-xs text-gray-500 mt-1">
            {formatCurrency(data.revenue.daily)}/day avg
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-sm font-medium text-gray-500 mb-1">Total Costs</div>
          <div className="text-3xl font-bold text-red-600">{formatCurrency(data.costs.total)}</div>
          <div className="text-xs text-gray-500 mt-1">
            {formatCurrency(data.costs.daily)}/day avg
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-sm font-medium text-gray-500 mb-1">Net Profit</div>
          <div className="text-3xl font-bold text-blue-600">{formatCurrency(data.profit.byTier.total)}</div>
          <div className="text-xs text-gray-500 mt-1">
            {formatCurrency(data.profit.daily)}/day avg
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="text-sm font-medium text-gray-500 mb-1">Profit Margin</div>
          <div className="text-3xl font-bold text-purple-600">{data.profit.margin}</div>
          <div className="text-xs text-gray-500 mt-1">
            {data.users.total} active users
          </div>
        </div>
      </div>

      {/* Revenue by Tier */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Revenue by Subscription Tier</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Tier</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">Users</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">Monthly Revenue</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">Costs</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">Profit</th>
              </tr>
            </thead>
            <tbody>
              {(['free', 'basic', 'pro', 'executive'] as const).map((tier) => (
                <tr key={tier} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 capitalize">
                      {tier}
                    </span>
                  </td>
                  <td className="text-right py-3 px-4 text-gray-900">{formatNumber(data.users.byTier[tier])}</td>
                  <td className="text-right py-3 px-4 text-gray-900">{formatCurrency(data.revenue.monthly[tier])}</td>
                  <td className="text-right py-3 px-4 text-red-600">{formatCurrency(data.costs.byTier[tier])}</td>
                  <td className="text-right py-3 px-4 font-semibold text-green-600">{formatCurrency(data.profit.byTier[tier])}</td>
                </tr>
              ))}
              <tr className="bg-gray-50 font-semibold">
                <td className="py-3 px-4">Total</td>
                <td className="text-right py-3 px-4">{formatNumber(data.users.total)}</td>
                <td className="text-right py-3 px-4">{formatCurrency(data.revenue.monthly.total)}</td>
                <td className="text-right py-3 px-4 text-red-600">{formatCurrency(data.costs.total)}</td>
                <td className="text-right py-3 px-4 text-green-600">{formatCurrency(data.profit.byTier.total)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Costs by Model */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">API Costs by Model</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Model</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">Usage Count</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">Input Tokens</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">Cached Input</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">Output Tokens</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">Live Search</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">Total Cost</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(data.costs.byModel).map(([model, stats]) => (
                <tr key={model} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <span className="text-sm font-medium text-gray-900">{model}</span>
                  </td>
                  <td className="text-right py-3 px-4 text-gray-900">{formatNumber(stats.usageCount)}</td>
                  <td className="text-right py-3 px-4 text-gray-600">{formatNumber(stats.inputTokens)}</td>
                  <td className="text-right py-3 px-4 text-gray-600">{formatNumber(stats.cachedInputTokens)}</td>
                  <td className="text-right py-3 px-4 text-gray-600">{formatNumber(stats.outputTokens)}</td>
                  <td className="text-right py-3 px-4 text-gray-600">{formatNumber(stats.liveSearchCalls)}</td>
                  <td className="text-right py-3 px-4 font-semibold text-red-600">{formatCurrency(stats.totalCost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* News Page Costs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">News Page Costs (Every 30 min)</h2>
        <div className="grid grid-cols-3 gap-6">
          <div>
            <div className="text-sm font-medium text-gray-500 mb-1">Total API Calls</div>
            <div className="text-2xl font-bold text-gray-900">{formatNumber(data.costs.news.totalCalls)}</div>
          </div>
          <div>
            <div className="text-sm font-medium text-gray-500 mb-1">Total Tokens</div>
            <div className="text-2xl font-bold text-gray-900">{formatNumber(data.costs.news.totalTokens)}</div>
          </div>
          <div>
            <div className="text-sm font-medium text-gray-500 mb-1">Total Cost</div>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(data.costs.news.totalCost)}</div>
          </div>
        </div>
      </div>

      {/* API Pricing Reference */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">XAI API Pricing Reference</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Model</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">Input (per 1M)</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">Cached Input</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">Output (per 1M)</th>
                <th className="text-right py-3 px-4 font-semibold text-gray-700">Live Search (per 1K)</th>
              </tr>
            </thead>
            <tbody>
              {data.apiPricing.map((pricing) => (
                <tr key={pricing.model_name} className="border-b border-gray-100">
                  <td className="py-3 px-4 font-medium text-gray-900">{pricing.model_name}</td>
                  <td className="text-right py-3 px-4 text-gray-600">{formatCurrency(pricing.input_price_per_million)}</td>
                  <td className="text-right py-3 px-4 text-gray-600">
                    {pricing.cached_input_price_per_million ? formatCurrency(pricing.cached_input_price_per_million) : 'N/A'}
                  </td>
                  <td className="text-right py-3 px-4 text-gray-600">{formatCurrency(pricing.output_price_per_million)}</td>
                  <td className="text-right py-3 px-4 text-gray-600">
                    {pricing.live_search_price_per_thousand ? formatCurrency(pricing.live_search_price_per_thousand) : 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI Business Reports */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">AI-Generated Business Reports</h2>
        <p className="text-gray-600 mb-6">Generate comprehensive business reports with insights and recommendations powered by Grok-4 AI</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Report Type Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Report Type
            </label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as 'daily' | 'monthly' | 'quarterly' | 'half-yearly' | 'yearly')}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
              disabled={generatingReport}
            >
              <option value="daily">Daily Report</option>
              <option value="monthly">Monthly Report</option>
              <option value="quarterly">Quarterly Report</option>
              <option value="half-yearly">Half-Yearly Report</option>
              <option value="yearly">Yearly Report</option>
            </select>
          </div>

          {/* Generate Button */}
          <div className="flex items-end">
            <button
              onClick={handleGenerateReport}
              disabled={generatingReport}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center justify-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {generatingReport ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generating Report...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Generate Report with Grok-4
                </>
              )}
            </button>
          </div>
        </div>

        {/* Generated Report Display */}
        {generatedReport && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Generated Report</h3>
              <button
                onClick={handleExportReportPDF}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export to PDF
              </button>
            </div>
            <div className="bg-gray-50 rounded-lg p-6 border border-gray-200 max-h-96 overflow-y-auto">
              <div className="prose max-w-none">
                <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans leading-relaxed">
                  {generatedReport.report}
                </pre>
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Report Features:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Comprehensive financial analysis with executive summary</li>
                <li>Revenue and cost breakdowns with insights</li>
                <li>Strategic recommendations and action items</li>
                <li>Export to PDF for sharing with stakeholders</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Export Actions */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Export Financial Data</h2>
        <div className="flex gap-4">
          <button
            onClick={handleExportExcel}
            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export to Excel
          </button>
        </div>
      </div>
    </div>
  );
}
