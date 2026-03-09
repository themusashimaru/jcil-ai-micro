/**
 * PRODUCTS SECTION
 *
 * Two clean product cards — Chat and Code Lab.
 * Code Lab emphasized as "Claude Code for all models."
 */

import Link from 'next/link';

export default function ProductsSection() {
  return (
    <section id="products" className="bg-black py-24 lg:py-32">
      <div className="mx-auto max-w-6xl px-6">
        {/* Section header */}
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Two products, one mission
          </h2>
          <p className="mt-4 text-lg text-slate-400">
            Everyday AI assistance or a full autonomous development environment.
          </p>
        </div>

        {/* Product cards */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Chat */}
          <div className="group rounded-2xl border border-white/10 bg-white/[0.02] p-8 transition-colors hover:border-white/20 lg:p-10">
            <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
              <svg className="h-5 w-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white">Chat</h3>
            <p className="mt-1 text-sm text-amber-400/80">For everyone</p>
            <p className="mt-4 leading-relaxed text-slate-400">
              Multi-model AI with Biblical grounding. Theological Q&amp;A, sermon preparation,
              document generation, and parallel research agents — all aligned with Christian values.
            </p>
            <ul className="mt-6 space-y-2.5 text-sm text-slate-400">
              <ProductFeature>Scripture-grounded answers with references</ProductFeature>
              <ProductFeature>Document generation (Word, Excel, PDF)</ProductFeature>
              <ProductFeature>Mini-agent: 2-10 parallel research agents per query</ProductFeature>
              <ProductFeature>Persistent memory across sessions</ProductFeature>
            </ul>
            <Link
              href="/chat"
              className="mt-8 inline-flex items-center gap-1.5 text-sm font-medium text-white transition-colors hover:text-amber-400"
            >
              Start chatting
              <ArrowIcon />
            </Link>
          </div>

          {/* Code Lab */}
          <div className="group rounded-2xl border border-white/10 bg-white/[0.02] p-8 transition-colors hover:border-white/20 lg:p-10">
            <div className="mb-6 flex h-10 w-10 items-center justify-center rounded-lg bg-fuchsia-500/10">
              <svg className="h-5 w-5 text-fuchsia-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white">Code Lab</h3>
            <p className="mt-1 text-sm text-fuchsia-400/80">Full-service AI IDE &middot; Claude Code for every model</p>
            <p className="mt-4 leading-relaxed text-slate-400">
              A complete development environment in your browser. Switch between Claude, GPT,
              Gemini, Grok, and DeepSeek mid-conversation. File browser, git integration,
              visual debugging, terminal — zero installation.
            </p>
            <div className="mt-6 flex gap-6 text-sm">
              <Stat value="51" label="Tools" />
              <Stat value="5" label="Models" />
              <Stat value="67+" label="Integrations" />
              <Stat value="6" label="AI Agents" />
            </div>
            <ul className="mt-6 space-y-2.5 text-sm text-slate-400">
              <ProductFeature>Switch models with &#8984;M — use any provider, any time</ProductFeature>
              <ProductFeature>BYOK: Bring your own API keys for any provider</ProductFeature>
              <ProductFeature>E2B sandboxed execution (Python, JS, terminal)</ProductFeature>
              <ProductFeature>Git integration, file browser, visual debugging</ProductFeature>
              <ProductFeature>67+ app integrations via Composio (SOC 2)</ProductFeature>
            </ul>
            <Link
              href="/code-lab/about"
              className="mt-8 inline-flex items-center gap-1.5 text-sm font-medium text-white transition-colors hover:text-fuchsia-400"
            >
              View technical specs
              <ArrowIcon />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProductFeature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <svg className="mt-0.5 h-4 w-4 shrink-0 text-green-400/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
      <span>{children}</span>
    </li>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-lg font-semibold text-white">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}

function ArrowIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
    </svg>
  );
}
