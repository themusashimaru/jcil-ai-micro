/**
 * ANALYTICS BLOCK COMPONENT
 *
 * Main wrapper for displaying data analytics in chat messages.
 * Combines insights panel and charts into a cohesive UI.
 *
 * FEATURES:
 * - Collapsible sections
 * - Multiple chart support
 * - Data preview table
 * - Follow-up query suggestions
 * - Export options
 */

'use client';

import { useState, lazy, Suspense } from 'react';
import type { AnalyticsResult } from '@/app/chat/types';
import { InsightsPanel } from './InsightsPanel';

// Lazy load chart component for better initial load
const AnalyticsChart = lazy(() => import('./AnalyticsChart'));

interface AnalyticsBlockProps {
  analytics: AnalyticsResult;
  onQuerySelect?: (query: string) => void;
}

export function AnalyticsBlock({ analytics, onQuerySelect }: AnalyticsBlockProps) {
  const [showData, setShowData] = useState(false);
  const [activeChartIndex, setActiveChartIndex] = useState(0);

  if (!analytics) {
    return null;
  }

  const {
    filename,
    summary,
    insights,
    charts,
    rawDataPreview,
    totalRows,
    totalColumns,
    columnNames,
    suggestedQueries,
  } = analytics;

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden max-w-2xl">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-emerald-500/10 via-cyan-500/10 to-violet-500/10 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">📊</span>
            <div>
              <div className="font-medium text-white text-sm">Data Analysis</div>
              <div className="text-xs text-gray-400">{filename}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2 py-0.5 rounded bg-white/10 text-gray-300">
              {totalRows.toLocaleString()} rows
            </span>
            <span className="px-2 py-0.5 rounded bg-white/10 text-gray-300">
              {totalColumns} columns
            </span>
          </div>
        </div>
      </div>

      {/* Summary */}
      {summary && (
        <div className="px-4 py-3 border-b border-white/10">
          <p className="text-sm text-gray-300">{summary}</p>
        </div>
      )}

      {/* Key Insights */}
      {insights && insights.length > 0 && (
        <div className="px-4 py-4 border-b border-white/10">
          <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">
            Key Insights
          </h4>
          <InsightsPanel insights={insights} compact />
        </div>
      )}

      {/* Charts Section */}
      {charts && charts.length > 0 && (
        <div className="px-4 py-4 border-b border-white/10">
          {/* Chart Tabs (if multiple charts) */}
          {charts.length > 1 && (
            <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
              {charts.map((chart, index) => (
                <button
                  key={`chart-tab-${index}`}
                  onClick={() => setActiveChartIndex(index)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                    activeChartIndex === index
                      ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                      : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
                  }`}
                >
                  {chart.title || `Chart ${index + 1}`}
                </button>
              ))}
            </div>
          )}

          {/* Active Chart */}
          <Suspense
            fallback={
              <div className="h-[300px] rounded-xl bg-white/5 animate-pulse flex items-center justify-center">
                <div className="text-sm text-gray-400">Loading chart...</div>
              </div>
            }
          >
            <AnalyticsChart config={charts[activeChartIndex]} height={280} />
          </Suspense>
        </div>
      )}

      {/* Data Preview Toggle */}
      {rawDataPreview && rawDataPreview.length > 0 && (
        <div className="border-b border-white/10">
          <button
            onClick={() => setShowData(!showData)}
            className="w-full flex items-center justify-between px-4 py-2 text-xs text-gray-400 hover:text-white transition-colors bg-black/20"
          >
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7c-2 0-3 1-3 3z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 12h16M12 4v16"
                />
              </svg>
              Data Preview
            </span>
            <svg
              className={`w-4 h-4 transition-transform ${showData ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {showData && (
            <div className="max-h-[300px] overflow-auto">
              <table className="w-full text-xs">
                <thead className="bg-white/5 sticky top-0">
                  <tr>
                    {columnNames.map((col, i) => (
                      <th
                        key={`col-${i}`}
                        className="px-3 py-2 text-left font-medium text-gray-300 border-b border-white/10"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rawDataPreview.map((row, rowIndex) => (
                    <tr
                      key={`row-${rowIndex}`}
                      className="border-b border-white/5 hover:bg-white/5"
                    >
                      {row.map((cell, cellIndex) => (
                        <td
                          key={`cell-${rowIndex}-${cellIndex}`}
                          className="px-3 py-2 text-gray-400 truncate max-w-[150px]"
                          title={String(cell)}
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {totalRows > rawDataPreview.length && (
                <div className="px-3 py-2 text-xs text-gray-500 text-center bg-white/5">
                  Showing {rawDataPreview.length} of {totalRows.toLocaleString()} rows
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Suggested Follow-up Queries */}
      {suggestedQueries && suggestedQueries.length > 0 && onQuerySelect && (
        <div className="px-4 py-3">
          <div className="text-xs text-gray-400 mb-2">Ask more about this data:</div>
          <div className="flex flex-wrap gap-2">
            {suggestedQueries.map((query, index) => (
              <button
                key={`query-${index}`}
                onClick={() => onQuerySelect(query)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10 hover:text-white transition-all"
              >
                {query}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default AnalyticsBlock;
