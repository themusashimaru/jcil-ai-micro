/**
 * USE CASES SECTION
 *
 * Showcases different audience segments and use cases
 * Faith-based focus with specific examples
 */

import Link from 'next/link';
import { BibleIcon, CodeIcon, ChurchIcon, UsersIcon, BuildingIcon, HeartIcon } from './Icons';

interface UseCase {
  icon: React.ReactNode;
  title: string;
  audience: string;
  description: string;
  features: string[];
  cta: string;
  href: string;
  color: 'amber' | 'blue' | 'purple' | 'green' | 'fuchsia' | 'pink';
}

const useCases: UseCase[] = [
  {
    icon: <BibleIcon className="w-7 h-7" />,
    title: 'Pastors & Ministry Leaders',
    audience: 'Sermon prep, counseling support, Bible study',
    description:
      'Research Scripture with AI that understands theological context. Generate sermon outlines, find cross-references, and prepare Bible studies, all grounded in Biblical truth.',
    features: [
      'Scripture cross-referencing',
      'Sermon outline generation',
      'Theological research',
      'Counseling talking points',
    ],
    cta: 'Start Free',
    href: '/signup?role=pastor',
    color: 'amber',
  },
  {
    icon: <CodeIcon className="w-7 h-7" />,
    title: 'Christian Developers',
    audience: 'Full-stack development, DevOps, mobile apps',
    description:
      'Code Lab gives you Claude Code capabilities in your browser. Build apps for your church, ministry, or faith-based startup with an AI that shares your values.',
    features: ['30+ dev tools', 'GitHub integration', 'Sandboxed execution', 'Project persistence'],
    cta: 'Try Code Lab',
    href: '/code-lab/about',
    color: 'fuchsia',
  },
  {
    icon: <ChurchIcon className="w-7 h-7" />,
    title: 'Churches & Organizations',
    audience: 'Communications, operations, volunteer management',
    description:
      'Streamline church operations with AI assistance. Draft newsletters, plan events, manage volunteer schedules, and create engaging content for your congregation.',
    features: [
      'Newsletter drafting',
      'Event planning',
      'Volunteer coordination',
      'Social media content',
    ],
    cta: 'Contact Sales',
    href: '/contact?type=church',
    color: 'blue',
  },
  {
    icon: <UsersIcon className="w-7 h-7" />,
    title: 'Small Groups & Bible Studies',
    audience: 'Discussion guides, study materials, prayer lists',
    description:
      'Enhance your small group experience with AI-generated discussion questions, study guides, and prayer resources. Deepen your fellowship with thoughtful preparation.',
    features: [
      'Discussion questions',
      'Study guide creation',
      'Prayer point summaries',
      'Devotional content',
    ],
    cta: 'Start Free',
    href: '/signup?role=smallgroup',
    color: 'green',
  },
  {
    icon: <BuildingIcon className="w-7 h-7" />,
    title: 'Christian Schools & Seminaries',
    audience: 'Curriculum development, research, administration',
    description:
      'Educational institutions trust JCIL for curriculum planning, theological research, and administrative tasks, with confidence that AI responses align with Biblical standards.',
    features: [
      'Curriculum planning',
      'Research assistance',
      'Student support tools',
      'Administrative automation',
    ],
    cta: 'Education Pricing',
    href: '/pricing?tier=education',
    color: 'purple',
  },
  {
    icon: <HeartIcon className="w-7 h-7" />,
    title: 'Individual Believers',
    audience: 'Personal devotions, prayer, spiritual growth',
    description:
      'Deepen your walk with Christ through AI-assisted Bible study, prayer journaling, and spiritual reflection. Get answers to faith questions from a Biblical perspective.',
    features: ['Daily devotionals', 'Prayer journaling', 'Scripture memorization', 'Faith Q&A'],
    cta: 'Start Free',
    href: '/signup',
    color: 'pink',
  },
];

const colorStyles = {
  amber: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20 hover:border-amber-500/40',
    icon: 'text-amber-400',
    button: 'bg-amber-600 hover:bg-amber-500',
    glow: 'from-amber-500/20',
  },
  blue: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20 hover:border-blue-500/40',
    icon: 'text-blue-400',
    button: 'bg-blue-600 hover:bg-blue-500',
    glow: 'from-blue-500/20',
  },
  purple: {
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20 hover:border-purple-500/40',
    icon: 'text-purple-400',
    button: 'bg-purple-600 hover:bg-purple-500',
    glow: 'from-purple-500/20',
  },
  green: {
    bg: 'bg-green-500/10',
    border: 'border-green-500/20 hover:border-green-500/40',
    icon: 'text-green-400',
    button: 'bg-green-600 hover:bg-green-500',
    glow: 'from-green-500/20',
  },
  fuchsia: {
    bg: 'bg-fuchsia-500/10',
    border: 'border-fuchsia-500/20 hover:border-fuchsia-500/40',
    icon: 'text-fuchsia-400',
    button: 'bg-fuchsia-600 hover:bg-fuchsia-500',
    glow: 'from-fuchsia-500/20',
  },
  pink: {
    bg: 'bg-pink-500/10',
    border: 'border-pink-500/20 hover:border-pink-500/40',
    icon: 'text-pink-400',
    button: 'bg-pink-600 hover:bg-pink-500',
    glow: 'from-pink-500/20',
  },
};

function UseCaseCard({ useCase }: { useCase: UseCase }) {
  const colors = colorStyles[useCase.color];

  return (
    <div
      className={`group relative bg-slate-900/50 rounded-2xl p-6 lg:p-8 border ${colors.border} transition-all duration-300 hover:bg-slate-900/70`}
    >
      {/* Glow effect */}
      <div
        className={`absolute inset-0 bg-gradient-to-br ${colors.glow} to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity`}
      />

      <div className="relative">
        {/* Icon */}
        <div className={`w-14 h-14 rounded-2xl ${colors.bg} flex items-center justify-center mb-5`}>
          <span className={colors.icon}>{useCase.icon}</span>
        </div>

        {/* Title */}
        <h3 className="text-xl font-bold text-white mb-1">{useCase.title}</h3>
        <p className="text-sm text-slate-500 mb-4">{useCase.audience}</p>

        {/* Description */}
        <p className="text-slate-300 text-sm leading-relaxed mb-6">{useCase.description}</p>

        {/* Features */}
        <div className="space-y-2 mb-6">
          {useCase.features.map((feature, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-slate-400">
              <svg
                className={`w-4 h-4 ${colors.icon} shrink-0`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              {feature}
            </div>
          ))}
        </div>

        {/* CTA */}
        <Link
          href={useCase.href}
          className={`inline-flex items-center justify-center w-full rounded-xl ${colors.button} px-6 py-3 text-sm font-semibold text-white transition-all`}
        >
          {useCase.cta}
          <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </div>
  );
}

export default function UseCases() {
  return (
    <section className="py-20 lg:py-28 bg-gradient-to-b from-black to-slate-950">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12 lg:mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/30 mb-6">
            <span className="text-sm font-medium text-purple-300">Use Cases</span>
          </div>
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">
            Engineered for faith-driven work
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            Whether you&apos;re preaching on Sunday, coding on Monday, or leading a Bible study on
            Wednesday, JCIL is your faith-aligned AI companion.
          </p>
        </div>

        {/* Use cases grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {useCases.map((useCase, i) => (
            <UseCaseCard key={i} useCase={useCase} />
          ))}
        </div>
      </div>
    </section>
  );
}
