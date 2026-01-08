/**
 * LANDING SECTION COMPONENT
 *
 * Reusable section wrapper with consistent spacing and styling
 * Supports various background patterns and layouts
 */

import { ReactNode } from 'react';

interface SectionProps {
  children: ReactNode;
  className?: string;
  background?: 'default' | 'gradient' | 'muted' | 'dark';
  padding?: 'sm' | 'md' | 'lg' | 'xl';
  id?: string;
}

const backgroundStyles = {
  default: 'bg-black',
  gradient: 'bg-gradient-to-b from-black via-slate-950 to-black',
  muted: 'bg-slate-950/50',
  dark: 'bg-slate-950',
};

const paddingStyles = {
  sm: 'py-12 lg:py-16',
  md: 'py-16 lg:py-24',
  lg: 'py-20 lg:py-32',
  xl: 'py-24 lg:py-40',
};

export default function Section({
  children,
  className = '',
  background = 'default',
  padding = 'md',
  id,
}: SectionProps) {
  return (
    <section
      id={id}
      className={`relative ${backgroundStyles[background]} ${paddingStyles[padding]} ${className}`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">{children}</div>
    </section>
  );
}

// Section Header Sub-component
interface SectionHeaderProps {
  badge?: string;
  badgeColor?: 'purple' | 'blue' | 'fuchsia' | 'green' | 'amber';
  title: string;
  titleGradient?: boolean;
  description?: string;
  centered?: boolean;
}

const badgeColors = {
  purple: 'bg-purple-500/10 border-purple-500/30 text-purple-300',
  blue: 'bg-blue-500/10 border-blue-500/30 text-blue-300',
  fuchsia: 'bg-fuchsia-500/10 border-fuchsia-500/30 text-fuchsia-300',
  green: 'bg-green-500/10 border-green-500/30 text-green-300',
  amber: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
};

export function SectionHeader({
  badge,
  badgeColor = 'purple',
  title,
  titleGradient = false,
  description,
  centered = true,
}: SectionHeaderProps) {
  return (
    <div className={`mb-12 lg:mb-16 ${centered ? 'text-center mx-auto max-w-3xl' : ''}`}>
      {badge && (
        <div
          className={`inline-flex items-center px-3 py-1 rounded-full border text-xs font-medium mb-4 ${badgeColors[badgeColor]}`}
        >
          {badge}
        </div>
      )}
      <h2
        className={`text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight ${
          titleGradient
            ? 'bg-gradient-to-r from-purple-400 via-fuchsia-400 to-blue-400 bg-clip-text text-transparent'
            : 'text-white'
        }`}
      >
        {title}
      </h2>
      {description && <p className="mt-4 text-lg text-slate-400 leading-relaxed">{description}</p>}
    </div>
  );
}
