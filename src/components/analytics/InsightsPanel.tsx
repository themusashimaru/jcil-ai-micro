/**
 * INSIGHTS PANEL COMPONENT
 *
 * Displays key statistics and insights from data analysis.
 * Shows metrics in a visually appealing grid layout.
 *
 * FEATURES:
 * - Stat cards with icons
 * - Trend indicators
 * - Responsive grid layout
 */

'use client';

import type { DataInsight } from '@/app/chat/types';

// Icon mapping for different insight types
const INSIGHT_ICONS: Record<string, string> = {
  stat: '📊',
  trend: '📈',
  outlier: '⚠️',
  correlation: '🔗',
  total: '💰',
  average: '📉',
  max: '🔝',
  min: '🔻',
  count: '#️⃣',
  percent: '%',
};

// Color classes for different insight types
const INSIGHT_COLORS: Record<string, { bg: string; border: string; icon: string }> = {
  stat: {
    bg: 'from-violet-500/10 to-violet-500/5',
    border: 'border-violet-500/20',
    icon: 'text-violet-400',
  },
  trend: {
    bg: 'from-cyan-500/10 to-cyan-500/5',
    border: 'border-cyan-500/20',
    icon: 'text-cyan-400',
  },
  outlier: {
    bg: 'from-amber-500/10 to-amber-500/5',
    border: 'border-amber-500/20',
    icon: 'text-amber-400',
  },
  correlation: {
    bg: 'from-emerald-500/10 to-emerald-500/5',
    border: 'border-emerald-500/20',
    icon: 'text-emerald-400',
  },
};

interface InsightsPanelProps {
  insights: DataInsight[];
  compact?: boolean;
}

export function InsightsPanel({ insights, compact = false }: InsightsPanelProps) {
  if (!insights || insights.length === 0) {
    return null;
  }

  return (
    <div className={`grid gap-3 ${compact ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-4'}`}>
      {insights.map((insight, index) => {
        const colors = INSIGHT_COLORS[insight.type] || INSIGHT_COLORS.stat;
        const icon = insight.icon || INSIGHT_ICONS[insight.type] || INSIGHT_ICONS.stat;

        return (
          <div
            key={`insight-${index}`}
            className={`relative rounded-xl border ${colors.border} bg-gradient-to-br ${colors.bg} p-4 transition-all hover:scale-[1.02]`}
          >
            {/* Icon */}
            <div className={`text-2xl mb-2 ${colors.icon}`}>{icon}</div>

            {/* Title */}
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">
              {insight.title}
            </div>

            {/* Value */}
            <div className="text-xl font-bold text-white truncate" title={insight.value}>
              {insight.value}
            </div>

            {/* Description */}
            {insight.description && !compact && (
              <div className="text-xs text-gray-400 mt-1 line-clamp-2">{insight.description}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default InsightsPanel;
