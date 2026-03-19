/**
 * USE CASES SECTION
 *
 * Showcases different audience segments and use cases.
 * Composio-inspired unified glass card design.
 */

import Link from 'next/link';
import Section, { SectionHeader } from './Section';
import { BibleIcon, CodeIcon, ChurchIcon, UsersIcon, BuildingIcon, HeartIcon } from './Icons';

interface UseCase {
  icon: React.ReactNode;
  title: string;
  audience: string;
  description: string;
  features: string[];
  cta: string;
  href: string;
}

const useCases: UseCase[] = [
  {
    icon: <BibleIcon className="w-6 h-6" />,
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
  },
  {
    icon: <CodeIcon className="w-6 h-6" />,
    title: 'Christian Developers',
    audience: 'Full-stack development, DevOps, mobile apps',
    description:
      'Code Lab gives you a full AI development environment in your browser. Build apps for your church, ministry, or faith-based startup with an AI that shares your values.',
    features: [
      '91 real tools',
      'GitHub integration',
      'E2B sandboxed execution',
      'Project persistence',
    ],
    cta: 'Try Code Lab',
    href: '/code-lab/about',
  },
  {
    icon: <ChurchIcon className="w-6 h-6" />,
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
  },
  {
    icon: <UsersIcon className="w-6 h-6" />,
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
  },
  {
    icon: <BuildingIcon className="w-6 h-6" />,
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
  },
  {
    icon: <HeartIcon className="w-6 h-6" />,
    title: 'Individual Believers',
    audience: 'Personal devotions, prayer, spiritual growth',
    description:
      'Deepen your walk with Christ through AI-assisted Bible study, prayer journaling, and spiritual reflection. Get answers to faith questions from a Biblical perspective.',
    features: ['Daily devotionals', 'Prayer journaling', 'Scripture memorization', 'Faith Q&A'],
    cta: 'Start Free',
    href: '/signup',
  },
];

export default function UseCases() {
  return (
    <Section id="use-cases">
      <SectionHeader
        badge="Use Cases"
        title="Engineered for faith-driven work"
        description="Whether you're preaching on Sunday, coding on Monday, or leading a Bible study on Wednesday, JCIL is your faith-aligned AI companion."
      />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {useCases.map((useCase) => (
          <div
            key={useCase.title}
            className="group rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 lg:p-8 transition-all hover:border-white/[0.12] hover:bg-white/[0.04]"
          >
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] text-zinc-400 transition-colors group-hover:text-violet-400">
              {useCase.icon}
            </div>

            <h3 className="text-lg font-semibold text-white mb-1">{useCase.title}</h3>
            <p className="text-xs text-zinc-500 mb-4">{useCase.audience}</p>

            <p className="text-sm text-zinc-500 leading-relaxed mb-6">{useCase.description}</p>

            <div className="space-y-2 mb-6">
              {useCase.features.map((feature) => (
                <div key={feature} className="flex items-center gap-2 text-sm text-zinc-500">
                  <svg
                    className="w-4 h-4 text-violet-400/50 shrink-0"
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

            <Link
              href={useCase.href}
              className="inline-flex items-center justify-center w-full rounded-full border border-white/[0.08] bg-white/[0.03] px-6 py-2.5 text-sm font-medium text-zinc-300 transition-all hover:border-white/[0.15] hover:bg-white/[0.06] hover:text-white"
            >
              {useCase.cta}
              <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </Link>
          </div>
        ))}
      </div>
    </Section>
  );
}
