/**
 * AGENTS SECTION COMPONENT
 *
 * Showcases all 6 real AI agents (3 deep + 3 quick)
 * Plus the persistent Memory Agent
 * All verified as real implementations — no stubs
 */

import Link from 'next/link';
import Section, { SectionHeader } from './Section';
import { BrainIcon, DocumentIcon, ChatIcon } from './Icons';

const DEEP_AGENTS = [
  {
    name: 'Deep Strategy',
    description:
      'Up to 100 parallel research scouts, forensic intake, master architect, and quality control. Full strategic analysis with recommendations and action plans.',
    time: '2-5 min',
    cost: '$8-15',
    color: 'purple',
    icon: '🎯',
  },
  {
    name: 'Deep Research',
    description:
      'Comprehensive investigation across the web. Browser automation, PDF extraction, vision analysis. Produces detailed research reports with evidence and citations.',
    time: '2-5 min',
    cost: '$8-15',
    color: 'blue',
    icon: '🔬',
  },
  {
    name: 'Deep Writer',
    description:
      'Full publishing operation. Research scouts gather facts, Opus writers craft each section, editorial phase polishes voice and citations. Export as Markdown, PDF, or DOCX.',
    time: '5-15 min',
    cost: '$8-15',
    color: 'fuchsia',
    icon: '📝',
  },
];

const QUICK_AGENTS = [
  {
    name: 'Quick Research',
    description:
      'Focused research with 10-15 scouts. Fast competitive analysis, fact-checking, and market research.',
    time: '1-2 min',
    cost: '$2-3',
    icon: '⚡',
  },
  {
    name: 'Quick Strategy',
    description:
      'Rapid decision-making support. Technology choices, business decisions, and problem prioritization.',
    time: '1-2 min',
    cost: '$2-3',
    icon: '🧭',
  },
  {
    name: 'Quick Writer',
    description:
      'Fast content creation. Blog posts, emails, summaries, and marketing copy with research backing.',
    time: '2-3 min',
    cost: '$2-3',
    icon: '✍️',
  },
];

export default function AgentsSection() {
  return (
    <Section id="agents" padding="lg">
      <SectionHeader
        badge="6 AI Agents"
        badgeColor="purple"
        title="Autonomous agents that do the work"
        description="Three tiers of intelligence: Deep agents deploy up to 100 parallel scouts for comprehensive analysis. Quick agents deliver focused results in minutes. Memory persists across sessions."
      />

      <div className="max-w-6xl mx-auto">
        {/* Deep Agents — Hero Row */}
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-purple-400 uppercase tracking-wider mb-4">
            Deep Agents — Comprehensive Analysis
          </h3>
          <div className="grid md:grid-cols-3 gap-6">
            {DEEP_AGENTS.map((agent) => (
              <div
                key={agent.name}
                className={`relative bg-gradient-to-br from-${agent.color}-950/80 to-slate-950 rounded-2xl p-6 border border-${agent.color}-500/20 overflow-hidden`}
              >
                <div
                  className={`absolute top-0 right-0 w-32 h-32 bg-${agent.color}-500/10 rounded-full blur-[60px] -translate-y-1/2 translate-x-1/2`}
                />
                <div className="relative">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-2xl">{agent.icon}</span>
                    <div className="flex gap-2">
                      <span className="text-xs px-2 py-1 rounded-full bg-white/5 text-slate-400">
                        {agent.time}
                      </span>
                      <span className="text-xs px-2 py-1 rounded-full bg-white/5 text-slate-400">
                        {agent.cost}
                      </span>
                    </div>
                  </div>
                  <h4 className="text-lg font-bold text-white mb-2">{agent.name}</h4>
                  <p className="text-sm text-slate-400 leading-relaxed">{agent.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Agents */}
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-amber-400 uppercase tracking-wider mb-4">
            Quick Agents — Fast Results
          </h3>
          <div className="grid md:grid-cols-3 gap-4">
            {QUICK_AGENTS.map((agent) => (
              <div
                key={agent.name}
                className="bg-slate-900/50 rounded-xl p-5 border border-slate-800 hover:border-amber-500/20 transition-all"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xl">{agent.icon}</span>
                  <div className="flex gap-2">
                    <span className="text-xs px-2 py-1 rounded-full bg-amber-500/10 text-amber-400">
                      {agent.time}
                    </span>
                    <span className="text-xs px-2 py-1 rounded-full bg-white/5 text-slate-400">
                      {agent.cost}
                    </span>
                  </div>
                </div>
                <h4 className="text-base font-bold text-white mb-1">{agent.name}</h4>
                <p className="text-xs text-slate-400">{agent.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Memory Agent — Persistent Feature */}
        <div className="relative bg-gradient-to-br from-purple-950/60 to-slate-950 rounded-2xl p-6 lg:p-8 border border-purple-500/15 overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/5 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2" />

          <div className="relative grid lg:grid-cols-2 gap-8 items-center">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
                  <BrainIcon className="w-5 h-5 text-purple-400" />
                </div>
                <span className="text-xs text-purple-400 uppercase tracking-wide font-semibold">
                  Always Active
                </span>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Persistent Memory Agent</h3>
              <p className="text-sm text-slate-300 leading-relaxed mb-4">
                Context that survives sessions. Remembers your preferences, project details, and
                conversation history. Learns how you work and adapts to serve you better.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-black/30 rounded-lg p-3 border border-white/5">
                  <div className="text-purple-400 text-xs font-medium">Vector Storage</div>
                  <div className="text-slate-500 text-xs">Semantic search across history</div>
                </div>
                <div className="bg-black/30 rounded-lg p-3 border border-white/5">
                  <div className="text-purple-400 text-xs font-medium">Auto-Summarization</div>
                  <div className="text-slate-500 text-xs">Key insights extracted</div>
                </div>
              </div>
            </div>

            {/* Visual */}
            <div className="hidden lg:flex items-center justify-center">
              <div className="relative w-48 h-48">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500/30 to-purple-600/20 border border-purple-500/40 flex items-center justify-center">
                    <BrainIcon className="w-10 h-10 text-purple-400" />
                  </div>
                </div>
                <div
                  className="absolute w-full h-full animate-spin"
                  style={{ animationDuration: '20s' }}
                >
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
                    <DocumentIcon className="w-4 h-4 text-purple-300" />
                  </div>
                </div>
                <div
                  className="absolute w-full h-full animate-spin"
                  style={{ animationDuration: '25s', animationDirection: 'reverse' }}
                >
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
                    <ChatIcon className="w-4 h-4 text-purple-300" />
                  </div>
                </div>
                <div className="absolute inset-0 rounded-full border border-purple-500/10" />
                <div className="absolute inset-6 rounded-full border border-purple-500/20" />
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-8">
          <Link
            href="/chat"
            className="inline-flex items-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-500 px-8 py-3 text-white font-semibold transition-all"
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
