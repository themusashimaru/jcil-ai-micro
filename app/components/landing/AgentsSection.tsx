/**
 * AGENTS SECTION
 *
 * Showcases all 6 real AI agents (3 deep + 3 quick)
 * Plus the persistent Memory Agent.
 * Composio-inspired unified glass card design. No emojis.
 */

import Link from 'next/link';
import Section, { SectionHeader } from './Section';
import { BrainIcon } from './Icons';

interface Agent {
  name: string;
  description: string;
  time: string;
  cost: string;
  icon: React.ReactNode;
}

const DEEP_AGENTS: Agent[] = [
  {
    name: 'Deep Strategy',
    description:
      'Up to 100 parallel research scouts, forensic intake, master architect, and quality control. Full strategic analysis with recommendations and action plans.',
    time: '2-5 min',
    cost: '$8-15',
    icon: <TargetIcon />,
  },
  {
    name: 'Deep Research',
    description:
      'Comprehensive investigation across the web. Browser automation, PDF extraction, vision analysis. Produces detailed research reports with evidence and citations.',
    time: '2-5 min',
    cost: '$8-15',
    icon: <MicroscopeIcon />,
  },
  {
    name: 'Deep Writer',
    description:
      'Full publishing operation. Research scouts gather facts, Opus writers craft each section, editorial phase polishes voice and citations. Export as Markdown, PDF, or DOCX.',
    time: '5-15 min',
    cost: '$8-15',
    icon: <PenIcon />,
  },
];

const QUICK_AGENTS: Agent[] = [
  {
    name: 'Quick Research',
    description:
      'Focused research with 10-15 scouts. Fast competitive analysis, fact-checking, and market research.',
    time: '1-2 min',
    cost: '$2-3',
    icon: <BoltIcon />,
  },
  {
    name: 'Quick Strategy',
    description:
      'Rapid decision-making support. Technology choices, business decisions, and problem prioritization.',
    time: '1-2 min',
    cost: '$2-3',
    icon: <CompassIcon />,
  },
  {
    name: 'Quick Writer',
    description:
      'Fast content creation. Blog posts, emails, summaries, and marketing copy with research backing.',
    time: '2-3 min',
    cost: '$2-3',
    icon: <EditIcon />,
  },
];

export default function AgentsSection() {
  return (
    <Section id="agents">
      <SectionHeader
        badge="6 AI Agents"
        title="Autonomous agents that do the work"
        description="Three tiers of intelligence: Deep agents deploy up to 100 parallel scouts for comprehensive analysis. Quick agents deliver focused results in minutes. Memory persists across sessions."
      />

      <div className="space-y-8">
        {/* Deep Agents */}
        <div>
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">
            Deep Agents — Comprehensive Analysis
          </h3>
          <div className="grid md:grid-cols-3 gap-6">
            {DEEP_AGENTS.map((agent) => (
              <div
                key={agent.name}
                className="group rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 transition-all hover:border-violet-500/20 hover:bg-white/[0.04]"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] text-zinc-400 group-hover:text-violet-400 transition-colors">
                    {agent.icon}
                  </div>
                  <div className="flex gap-2">
                    <span className="text-[10px] px-2 py-1 rounded-full border border-white/[0.06] bg-white/[0.02] text-zinc-500">
                      {agent.time}
                    </span>
                    <span className="text-[10px] px-2 py-1 rounded-full border border-white/[0.06] bg-white/[0.02] text-zinc-500">
                      {agent.cost}
                    </span>
                  </div>
                </div>
                <h4 className="text-base font-semibold text-white mb-2">{agent.name}</h4>
                <p className="text-sm text-zinc-500 leading-relaxed">{agent.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Agents */}
        <div>
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">
            Quick Agents — Fast Results
          </h3>
          <div className="grid md:grid-cols-3 gap-4">
            {QUICK_AGENTS.map((agent) => (
              <div
                key={agent.name}
                className="group rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 transition-all hover:border-white/[0.12] hover:bg-white/[0.04]"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03] text-zinc-400 group-hover:text-violet-400 transition-colors">
                    {agent.icon}
                  </div>
                  <div className="flex gap-2">
                    <span className="text-[10px] px-2 py-0.5 rounded-full border border-white/[0.06] bg-white/[0.02] text-zinc-500">
                      {agent.time}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full border border-white/[0.06] bg-white/[0.02] text-zinc-500">
                      {agent.cost}
                    </span>
                  </div>
                </div>
                <h4 className="text-sm font-semibold text-white mb-1">{agent.name}</h4>
                <p className="text-xs text-zinc-500">{agent.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Memory Agent */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 lg:p-8">
          <div className="grid lg:grid-cols-2 gap-8 items-center">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-violet-500/20 bg-violet-500/10 text-violet-400">
                  <BrainIcon className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-violet-400">
                  Always Active
                </span>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Persistent Memory Agent</h3>
              <p className="text-sm text-zinc-400 leading-relaxed mb-4">
                Context that survives sessions. Remembers your preferences, project details, and
                conversation history. Learns how you work and adapts to serve you better.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <div className="text-violet-400 text-xs font-medium">Vector Storage</div>
                  <div className="text-zinc-600 text-xs">Semantic search across history</div>
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                  <div className="text-violet-400 text-xs font-medium">Auto-Summarization</div>
                  <div className="text-zinc-600 text-xs">Key insights extracted</div>
                </div>
              </div>
            </div>

            <div className="hidden lg:flex items-center justify-center">
              <div className="relative w-48 h-48">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-20 h-20 rounded-2xl border border-violet-500/20 bg-violet-500/10 flex items-center justify-center">
                    <BrainIcon className="w-10 h-10 text-violet-400" />
                  </div>
                </div>
                <div className="absolute inset-0 rounded-full border border-white/[0.04]" />
                <div className="absolute inset-6 rounded-full border border-white/[0.06]" />
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <Link
            href="/chat"
            className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-3 text-sm font-semibold text-black transition-all hover:bg-zinc-200"
          >
            Try the Agents
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </Section>
  );
}

/* --- Icons --- */

function TargetIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 100-18 9 9 0 000 18z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
    </svg>
  );
}

function MicroscopeIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  );
}

function PenIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  );
}

function CompassIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 100-18 9 9 0 000 18z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z" />
    </svg>
  );
}
