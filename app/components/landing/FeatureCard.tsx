/**
 * FEATURE CARD COMPONENT
 *
 * Reusable card for showcasing features
 * Multiple variants for different use cases
 */

import { ReactNode } from 'react';

interface FeatureCardProps {
  icon?: ReactNode;
  emoji?: string;
  title: string;
  description: string;
  variant?: 'default' | 'gradient' | 'outlined' | 'minimal';
  color?: 'purple' | 'blue' | 'fuchsia' | 'green' | 'amber' | 'pink' | 'cyan';
  className?: string;
}

const colorStyles = {
  purple: {
    gradient: 'from-purple-900/40 to-purple-900/10',
    border: 'border-purple-500/20 hover:border-purple-500/40',
    iconBg: 'bg-purple-500/20',
    iconText: 'text-purple-400',
    glow: 'bg-purple-500/10',
  },
  blue: {
    gradient: 'from-blue-900/40 to-blue-900/10',
    border: 'border-blue-500/20 hover:border-blue-500/40',
    iconBg: 'bg-blue-500/20',
    iconText: 'text-blue-400',
    glow: 'bg-blue-500/10',
  },
  fuchsia: {
    gradient: 'from-fuchsia-900/40 to-fuchsia-900/10',
    border: 'border-fuchsia-500/20 hover:border-fuchsia-500/40',
    iconBg: 'bg-fuchsia-500/20',
    iconText: 'text-fuchsia-400',
    glow: 'bg-fuchsia-500/10',
  },
  green: {
    gradient: 'from-green-900/40 to-green-900/10',
    border: 'border-green-500/20 hover:border-green-500/40',
    iconBg: 'bg-green-500/20',
    iconText: 'text-green-400',
    glow: 'bg-green-500/10',
  },
  amber: {
    gradient: 'from-amber-900/40 to-amber-900/10',
    border: 'border-amber-500/20 hover:border-amber-500/40',
    iconBg: 'bg-amber-500/20',
    iconText: 'text-amber-400',
    glow: 'bg-amber-500/10',
  },
  pink: {
    gradient: 'from-pink-900/40 to-pink-900/10',
    border: 'border-pink-500/20 hover:border-pink-500/40',
    iconBg: 'bg-pink-500/20',
    iconText: 'text-pink-400',
    glow: 'bg-pink-500/10',
  },
  cyan: {
    gradient: 'from-cyan-900/40 to-cyan-900/10',
    border: 'border-cyan-500/20 hover:border-cyan-500/40',
    iconBg: 'bg-cyan-500/20',
    iconText: 'text-cyan-400',
    glow: 'bg-cyan-500/10',
  },
};

export default function FeatureCard({
  icon,
  emoji,
  title,
  description,
  variant = 'default',
  color = 'purple',
  className = '',
}: FeatureCardProps) {
  const colors = colorStyles[color];

  if (variant === 'minimal') {
    return (
      <div className={`p-6 ${className}`}>
        <div
          className={`w-12 h-12 rounded-xl ${colors.iconBg} flex items-center justify-center mb-4`}
        >
          {emoji ? (
            <span className="text-2xl">{emoji}</span>
          ) : (
            <div className={colors.iconText}>{icon}</div>
          )}
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
        <p className="text-sm text-slate-400 leading-relaxed">{description}</p>
      </div>
    );
  }

  if (variant === 'outlined') {
    return (
      <div
        className={`group relative rounded-2xl p-6 border ${colors.border} bg-slate-900/30 transition-all duration-300 hover:bg-slate-900/50 ${className}`}
      >
        <div
          className={`w-12 h-12 rounded-xl ${colors.iconBg} flex items-center justify-center mb-4`}
        >
          {emoji ? (
            <span className="text-2xl">{emoji}</span>
          ) : (
            <div className={colors.iconText}>{icon}</div>
          )}
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
        <p className="text-sm text-slate-400 leading-relaxed">{description}</p>
      </div>
    );
  }

  if (variant === 'gradient') {
    return (
      <div
        className={`group relative bg-gradient-to-br ${colors.gradient} rounded-2xl p-6 border ${colors.border} transition-all duration-300 ${className}`}
      >
        <div
          className={`absolute top-0 right-0 w-32 h-32 ${colors.glow} rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity`}
        />
        <div className="relative">
          <div
            className={`w-12 h-12 rounded-xl ${colors.iconBg} flex items-center justify-center mb-4`}
          >
            {emoji ? (
              <span className="text-2xl">{emoji}</span>
            ) : (
              <div className={colors.iconText}>{icon}</div>
            )}
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
          <p className="text-sm text-slate-400 leading-relaxed">{description}</p>
        </div>
      </div>
    );
  }

  // Default variant
  return (
    <div
      className={`group relative bg-slate-900/50 rounded-2xl p-6 border border-slate-800 hover:border-slate-700 transition-all duration-300 ${className}`}
    >
      <div
        className={`w-12 h-12 rounded-xl ${colors.iconBg} flex items-center justify-center mb-4`}
      >
        {emoji ? (
          <span className="text-2xl">{emoji}</span>
        ) : (
          <div className={colors.iconText}>{icon}</div>
        )}
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-sm text-slate-400 leading-relaxed">{description}</p>
    </div>
  );
}

// Stat Card Sub-component
interface StatCardProps {
  value: string;
  label: string;
  color?: keyof typeof colorStyles;
}

export function StatCard({ value, label, color = 'fuchsia' }: StatCardProps) {
  const colors = colorStyles[color];
  return (
    <div className="text-center">
      <div className={`text-3xl lg:text-4xl font-bold ${colors.iconText}`}>{value}</div>
      <div className="text-sm text-slate-500 mt-1">{label}</div>
    </div>
  );
}

// Tech Badge Sub-component
interface TechBadgeProps {
  children: string;
  color?: keyof typeof colorStyles;
}

export function TechBadge({ children, color = 'fuchsia' }: TechBadgeProps) {
  const colors = colorStyles[color];
  return (
    <span
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${colors.iconBg} border border-${color}-500/30 text-sm text-slate-300`}
    >
      <span className={colors.iconText}>&#x2713;</span>
      {children}
    </span>
  );
}
