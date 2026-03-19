/**
 * PRODUCTS SECTION — Two clean product cards: Chat and Code Lab.
 * Unified glass card design system.
 */

import Link from 'next/link';

export default function ProductsSection() {
  return (
    <section id="products" className="py-24 lg:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
            Two products, one mission
          </h2>
          <p className="mt-5 text-lg text-zinc-400">
            Everyday AI assistance or a full autonomous development environment.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Chat */}
          <div className="group rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 transition-all duration-300 hover:border-amber-500/20 hover:bg-white/[0.04] lg:p-10">
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 transition-colors group-hover:bg-amber-500/15">
              <svg className="h-6 w-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white">Chat</h3>
            <p className="mt-1 text-sm font-medium text-amber-400/80">For everyone</p>
            <p className="mt-4 leading-relaxed text-zinc-400">
              Multi-model AI with Biblical grounding. Theological Q&amp;A, sermon preparation,
              document generation, and parallel research agents — all aligned with Christian values.
            </p>
            <ul className="mt-6 space-y-2.5 text-sm text-zinc-400">
              <Feature>Scripture-grounded answers with references</Feature>
              <Feature>Document generation (Word, Excel, PDF)</Feature>
              <Feature>Mini-agent: 2-10 parallel research agents</Feature>
              <Feature>Persistent memory across sessions</Feature>
            </ul>
            <Link href="/chat" className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-white transition-colors hover:text-amber-400">
              Start chatting <Arrow />
            </Link>
          </div>

          {/* Code Lab */}
          <div className="group rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 transition-all duration-300 hover:border-violet-500/20 hover:bg-white/[0.04] lg:p-10">
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10 transition-colors group-hover:bg-violet-500/15">
              <svg className="h-6 w-6 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white">Code Lab</h3>
            <p className="mt-1 text-sm font-medium text-violet-400/80">Full-service AI IDE</p>
            <p className="mt-4 leading-relaxed text-zinc-400">
              A complete development environment in your browser. Switch between Claude, GPT,
              Gemini, Grok, and DeepSeek mid-conversation. File browser, git, terminal — zero installation.
            </p>
            <div className="mt-6 flex gap-6 text-sm">
              <Stat value="91" label="Tools" />
              <Stat value="5" label="Models" />
              <Stat value="67+" label="Integrations" />
              <Stat value="E2B" label="Sandbox" />
            </div>
            <ul className="mt-6 space-y-2.5 text-sm text-zinc-400">
              <Feature>BYOK: Bring your own API keys for any provider</Feature>
              <Feature>E2B sandboxed execution (Python, JS, terminal)</Feature>
              <Feature>Git integration, file browser, visual debugging</Feature>
              <Feature>67+ app integrations via Composio (SOC 2)</Feature>
            </ul>
            <Link href="/code-lab/about" className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-white transition-colors hover:text-violet-400">
              View technical specs <Arrow />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function Feature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <svg className="mt-0.5 h-4 w-4 shrink-0 text-green-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
      <span>{children}</span>
    </li>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-lg font-bold text-white">{value}</div>
      <div className="text-xs text-zinc-500">{label}</div>
    </div>
  );
}

function Arrow() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
    </svg>
  );
}
