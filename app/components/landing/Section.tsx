/**
 * LANDING SECTION COMPONENT
 *
 * Unified section wrapper with consistent Composio-inspired spacing and styling.
 * One design language across the entire page.
 */

import { ReactNode } from 'react';

interface SectionProps {
  children: ReactNode;
  className?: string;
  id?: string;
}

export default function Section({ children, className = '', id }: SectionProps) {
  return (
    <section id={id} className={`relative py-24 lg:py-32 ${className}`}>
      <div className="mx-auto max-w-6xl px-6">{children}</div>
    </section>
  );
}

interface SectionHeaderProps {
  badge?: string;
  title: string;
  description?: string;
}

export function SectionHeader({ badge, title, description }: SectionHeaderProps) {
  return (
    <div className="mx-auto mb-16 max-w-3xl text-center">
      {badge && (
        <div className="mb-6 inline-flex items-center rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-1.5 text-xs font-medium text-zinc-400">
          {badge}
        </div>
      )}
      <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
        {title}
      </h2>
      {description && (
        <p className="mt-5 text-lg leading-relaxed text-zinc-400">{description}</p>
      )}
    </div>
  );
}
