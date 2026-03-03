/**
 * PRODUCTS SECTION COMPONENT
 *
 * Chat + Code Lab product cards with accurate metrics
 * No unverified claims
 */

import Link from 'next/link';
import Section, { SectionHeader } from './Section';
import { ChatIcon, CodeIcon } from './Icons';

function CheckMark({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`w-4 h-4 shrink-0 ${className}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function ArrowRight() {
  return (
    <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

export default function ProductsSection() {
  return (
    <Section id="products" background="gradient" padding="lg">
      <SectionHeader
        badge="Our Products"
        badgeColor="purple"
        title="Pick your platform"
        description="Whether you need everyday AI assistance or full autonomous development capabilities, we have you covered."
      />

      <div className="grid gap-8 lg:grid-cols-2 max-w-5xl mx-auto">
        {/* Chat Product */}
        <div className="group relative bg-gradient-to-br from-amber-950/80 to-amber-950/40 rounded-3xl p-8 lg:p-10 border border-amber-500/20 hover:border-amber-500/40 transition-all duration-500">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-600/5 to-transparent rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/20 flex items-center justify-center">
                <ChatIcon className="w-7 h-7 text-amber-400" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white">Chat</h3>
                <p className="text-amber-300 text-sm">For everyone</p>
              </div>
            </div>

            <p className="text-slate-300 mb-8 text-base leading-relaxed">
              Multi-model AI intelligence with Biblical grounding. Get thoughtful answers, research
              assistance, and creative help&mdash;all aligned with Scripture and Christian values.
            </p>

            <div className="space-y-3 mb-8">
              {[
                'Theological Q&A with Scripture references',
                'Sermon & Bible study preparation',
                'Web search & real-time fact checking',
                'Document generation (Word, Excel, PDF)',
                'Image analysis & document processing',
              ].map((feature) => (
                <div key={feature} className="flex items-center gap-3 text-sm text-slate-300">
                  <CheckMark className="text-amber-400" />
                  {feature}
                </div>
              ))}
            </div>

            <Link
              href="/chat"
              className="inline-flex items-center justify-center w-full rounded-xl bg-amber-600 hover:bg-amber-500 px-6 py-3.5 text-white font-semibold transition-all"
            >
              Start Chatting
              <ArrowRight />
            </Link>
          </div>
        </div>

        {/* Code Lab Product */}
        <div className="group relative bg-gradient-to-br from-fuchsia-950/80 to-fuchsia-950/40 rounded-3xl p-8 lg:p-10 border border-fuchsia-500/20 hover:border-fuchsia-500/40 transition-all duration-500">
          <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-600/5 to-transparent rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity" />

          <div className="relative">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-2xl bg-fuchsia-500/20 flex items-center justify-center">
                <CodeIcon className="w-7 h-7 text-fuchsia-400" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white">Code Lab</h3>
                <p className="text-fuchsia-300 text-sm">Enterprise AI IDE</p>
              </div>
            </div>

            <p className="text-slate-300 mb-6 text-base leading-relaxed">
              A powerful AI development environment on the web. 51 real tools, E2B sandboxed
              execution, and multi-model support&mdash;with{' '}
              <span className="text-fuchsia-400 font-semibold">zero installation</span>.
            </p>

            <div className="grid grid-cols-4 gap-2 mb-6">
              <div className="bg-fuchsia-500/10 rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-fuchsia-300">51</div>
                <div className="text-[10px] text-slate-400">Tools</div>
              </div>
              <div className="bg-fuchsia-500/10 rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-fuchsia-300">5</div>
                <div className="text-[10px] text-slate-400">Models</div>
              </div>
              <div className="bg-fuchsia-500/10 rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-fuchsia-300">67+</div>
                <div className="text-[10px] text-slate-400">Integrations</div>
              </div>
              <div className="bg-fuchsia-500/10 rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-fuchsia-300">E2B</div>
                <div className="text-[10px] text-slate-400">Sandbox</div>
              </div>
            </div>

            <div className="space-y-2 mb-6">
              {[
                'Claude Opus 4.6, GPT-5.2, Gemini, Grok, DeepSeek',
                'E2B sandboxed code execution',
                'GitHub integration & project scaffolding',
                'Web search, scraping & research tools',
                'Composio: 67+ app integrations',
              ].map((feature) => (
                <div key={feature} className="flex items-center gap-2 text-sm text-slate-300">
                  <CheckMark className="text-fuchsia-400" />
                  {feature}
                </div>
              ))}
            </div>

            <Link
              href="/code-lab/about"
              className="inline-flex items-center justify-center w-full rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 px-6 py-3.5 text-white font-semibold transition-all"
            >
              View Technical Specs
              <ArrowRight />
            </Link>
          </div>
        </div>
      </div>
    </Section>
  );
}
