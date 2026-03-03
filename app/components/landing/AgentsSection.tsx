/**
 * AGENTS SECTION COMPONENT
 *
 * Showcases real AI agent capabilities
 * Only features that actually work in production
 */

import Link from 'next/link';
import Section, { SectionHeader } from './Section';
import { BrainIcon, DocumentIcon, ChatIcon, CodeIcon, GlobeIcon } from './Icons';

export default function AgentsSection() {
  return (
    <Section id="agents" padding="lg">
      <SectionHeader
        badge="AI Agents"
        badgeColor="purple"
        title="Intelligent agents that work for you"
        description="Autonomous task execution with plan-execute-observe loops. The AI doesn't just respond&mdash;it acts."
      />

      <div className="max-w-5xl mx-auto">
        {/* Memory Agent Feature */}
        <div className="relative bg-gradient-to-br from-purple-950/80 to-slate-950 rounded-3xl p-8 lg:p-12 border border-purple-500/20 overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />

          <div className="relative grid lg:grid-cols-2 gap-8 items-center">
            <div>
              <h3 className="text-2xl lg:text-3xl font-bold text-white mb-4">
                Persistent Memory Agent
              </h3>
              <p className="text-slate-300 text-base leading-relaxed mb-6">
                Context that survives sessions. The Memory Agent remembers your preferences, project
                details, and conversation history. It learns how you work and adapts to serve you
                better with each interaction.
              </p>

              <div className="grid sm:grid-cols-2 gap-4 mb-6">
                <div className="bg-black/30 rounded-xl p-4 border border-white/5">
                  <div className="text-purple-400 text-sm font-medium mb-1">Vector Storage</div>
                  <div className="text-slate-400 text-xs">
                    Semantic search across your conversation history
                  </div>
                </div>
                <div className="bg-black/30 rounded-xl p-4 border border-white/5">
                  <div className="text-purple-400 text-sm font-medium mb-1">Auto-Summarization</div>
                  <div className="text-slate-400 text-xs">
                    Key insights extracted and stored automatically
                  </div>
                </div>
                <div className="bg-black/30 rounded-xl p-4 border border-white/5">
                  <div className="text-purple-400 text-sm font-medium mb-1">Context Injection</div>
                  <div className="text-slate-400 text-xs">
                    Relevant memories surface when you need them
                  </div>
                </div>
                <div className="bg-black/30 rounded-xl p-4 border border-white/5">
                  <div className="text-purple-400 text-sm font-medium mb-1">Privacy-First</div>
                  <div className="text-slate-400 text-xs">
                    Your data stays yours, encrypted at rest
                  </div>
                </div>
              </div>

              <Link
                href="/chat"
                className="inline-flex items-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-500 px-6 py-3 text-white font-semibold transition-all"
              >
                Try Memory Agent
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </Link>
            </div>

            {/* Visual representation */}
            <div className="hidden lg:flex items-center justify-center">
              <div className="relative w-64 h-64">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-purple-500/30 to-purple-600/20 border border-purple-500/40 flex items-center justify-center">
                    <BrainIcon className="w-12 h-12 text-purple-400" />
                  </div>
                </div>
                <div
                  className="absolute w-full h-full animate-spin"
                  style={{ animationDuration: '20s' }}
                >
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
                    <DocumentIcon className="w-5 h-5 text-purple-300" />
                  </div>
                </div>
                <div
                  className="absolute w-full h-full animate-spin"
                  style={{ animationDuration: '25s', animationDirection: 'reverse' }}
                >
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-10 h-10 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
                    <ChatIcon className="w-5 h-5 text-purple-300" />
                  </div>
                </div>
                <div
                  className="absolute w-full h-full animate-spin"
                  style={{ animationDuration: '30s' }}
                >
                  <div className="absolute top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
                    <CodeIcon className="w-5 h-5 text-purple-300" />
                  </div>
                </div>
                <div className="absolute inset-0 rounded-full border border-purple-500/10" />
                <div className="absolute inset-8 rounded-full border border-purple-500/20" />
              </div>
            </div>
          </div>
        </div>

        {/* Available Agent - Research only (no fake "Coming Soon" items) */}
        <div className="mt-8">
          <div className="bg-blue-950/50 rounded-xl p-5 border border-blue-500/20 max-w-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <GlobeIcon className="w-4 h-4 text-blue-400" />
              </div>
              <span className="text-xs text-blue-400 uppercase tracking-wide font-semibold">
                Available
              </span>
            </div>
            <h4 className="text-white font-semibold mb-1">Research Agent</h4>
            <p className="text-slate-400 text-xs">
              Deep web research with source verification and citations.
            </p>
          </div>
        </div>
      </div>
    </Section>
  );
}
