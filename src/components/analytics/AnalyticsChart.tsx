/**
 * ANALYTICS CHART COMPONENT
 *
 * Renders interactive charts using Recharts library.
 * Supports bar, line, pie, area, and scatter charts.
 *
 * SAFETY:
 * - Client-side only (uses browser APIs)
 * - Graceful error handling
 * - Null-safe data access
 */

'use client';

import { useState } from 'react';
import type { ChartConfig } from '@/app/chat/types';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';

// Default color palette - accessible and visually distinct
const DEFAULT_COLORS = [
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#ec4899', // pink
  '#6366f1', // indigo
  '#14b8a6', // teal
];

interface AnalyticsChartProps {
  config: ChartConfig;
  height?: number;
}

export function AnalyticsChart({ config, height = 300 }: AnalyticsChartProps) {
  const [error, setError] = useState<string | null>(null);

  // Validate data before rendering
  if (!config || !config.data || config.data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[200px] bg-white/5 rounded-lg border border-white/10">
        <span className="text-sm text-gray-400">No data available for chart</span>
      </div>
    );
  }

  const colors = config.colors || DEFAULT_COLORS;
  const { type, title, data, xKey, yKeys } = config;

  // Error boundary wrapper
  const renderChart = () => {
    try {
      switch (type) {
        case 'bar':
          return (
            <ResponsiveContainer width="100%" height={height}>
              <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis
                  dataKey={xKey}
                  tick={{ fill: '#9ca3af', fontSize: 12 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.2)' }}
                />
                <YAxis
                  tick={{ fill: '#9ca3af', fontSize: 12 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.2)' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(17, 24, 39, 0.95)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    color: '#fff',
                  }}
                />
                <Legend wrapperStyle={{ color: '#9ca3af' }} />
                {yKeys.map((key, index) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    fill={colors[index % colors.length]}
                    radius={[4, 4, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          );

        case 'line':
          return (
            <ResponsiveContainer width="100%" height={height}>
              <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis
                  dataKey={xKey}
                  tick={{ fill: '#9ca3af', fontSize: 12 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.2)' }}
                />
                <YAxis
                  tick={{ fill: '#9ca3af', fontSize: 12 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.2)' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(17, 24, 39, 0.95)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    color: '#fff',
                  }}
                />
                <Legend wrapperStyle={{ color: '#9ca3af' }} />
                {yKeys.map((key, index) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={colors[index % colors.length]}
                    strokeWidth={2}
                    dot={{ fill: colors[index % colors.length], strokeWidth: 2 }}
                    activeDot={{ r: 6 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          );

        case 'area':
          return (
            <ResponsiveContainer width="100%" height={height}>
              <AreaChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis
                  dataKey={xKey}
                  tick={{ fill: '#9ca3af', fontSize: 12 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.2)' }}
                />
                <YAxis
                  tick={{ fill: '#9ca3af', fontSize: 12 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.2)' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(17, 24, 39, 0.95)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    color: '#fff',
                  }}
                />
                <Legend wrapperStyle={{ color: '#9ca3af' }} />
                {yKeys.map((key, index) => (
                  <Area
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={colors[index % colors.length]}
                    fill={colors[index % colors.length]}
                    fillOpacity={0.3}
                    strokeWidth={2}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          );

        case 'pie':
          return (
            <ResponsiveContainer width="100%" height={height}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                  outerRadius={Math.min(height * 0.35, 120)}
                  dataKey={yKeys[0] || 'value'}
                  nameKey={xKey}
                >
                  {data.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(17, 24, 39, 0.95)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    color: '#fff',
                  }}
                />
                <Legend wrapperStyle={{ color: '#9ca3af' }} />
              </PieChart>
            </ResponsiveContainer>
          );

        case 'scatter':
          return (
            <ResponsiveContainer width="100%" height={height}>
              <ScatterChart margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis
                  dataKey={xKey}
                  type="number"
                  name={xKey}
                  tick={{ fill: '#9ca3af', fontSize: 12 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.2)' }}
                />
                <YAxis
                  dataKey={yKeys[0]}
                  type="number"
                  name={yKeys[0]}
                  tick={{ fill: '#9ca3af', fontSize: 12 }}
                  axisLine={{ stroke: 'rgba(255,255,255,0.2)' }}
                />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  contentStyle={{
                    backgroundColor: 'rgba(17, 24, 39, 0.95)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    color: '#fff',
                  }}
                />
                <Legend wrapperStyle={{ color: '#9ca3af' }} />
                <Scatter name={yKeys[0]} data={data} fill={colors[0]} />
              </ScatterChart>
            </ResponsiveContainer>
          );

        default:
          return (
            <div className="flex items-center justify-center h-[200px] bg-white/5 rounded-lg border border-white/10">
              <span className="text-sm text-gray-400">Unsupported chart type: {type}</span>
            </div>
          );
      }
    } catch (err) {
      console.error('Chart rendering error:', err);
      setError(err instanceof Error ? err.message : 'Failed to render chart');
      return null;
    }
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[200px] bg-red-500/10 rounded-lg border border-red-500/20 p-4">
        <span className="text-sm text-red-400 mb-2">Chart Error</span>
        <span className="text-xs text-gray-400">{error}</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
      {/* Chart Header */}
      {title && (
        <div className="px-4 py-3 border-b border-white/10 bg-gradient-to-r from-violet-500/10 to-cyan-500/10">
          <h4 className="text-sm font-medium text-white">{title}</h4>
        </div>
      )}
      {/* Chart Body */}
      <div className="p-4">{renderChart()}</div>
    </div>
  );
}

export default AnalyticsChart;
