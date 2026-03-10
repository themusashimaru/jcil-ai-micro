/**
 * PRODUCTS SECTION
 *
 * Two product cards with visual UI previews.
 * Shows what the products actually look like, not just descriptions.
 */

import Link from 'next/link';

export default function ProductsSection() {
  return (
    <section id="products" className="py-28 lg:py-36">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto mb-20 max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
            Two products, one mission
          </h2>
          <p className="mt-5 text-lg text-zinc-400">
            Everyday AI assistance or a full autonomous development environment.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Chat Product */}
          <div className="group relative overflow-hidden rounded-3xl border border-white/[0.06] bg-white/[0.02] transition-all duration-500 hover:border-amber-500/20">
            {/* Glow effect */}
            <div className="absolute -right-20 -top-20 h-60 w-60 rounded-full bg-amber-500/[0.06] blur-[80px] transition-all group-hover:bg-amber-500/[0.1]" />

            {/* Content */}
            <div className="relative p-8 lg:p-10">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 ring-1 ring-amber-500/20">
                  <svg
                    className="h-6 w-6 text-amber-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Chat</h3>
                  <p className="text-sm text-amber-400/80">For everyone</p>
                </div>
              </div>

              <p className="leading-relaxed text-zinc-400">
                Multi-model AI with Biblical grounding. Theological Q&amp;A, sermon preparation,
                document generation, and parallel research agents.
              </p>

              <ul className="mt-6 space-y-2.5 text-sm text-zinc-400">
                <Feature>Scripture-grounded answers with references</Feature>
                <Feature>Document generation (Word, Excel, PDF)</Feature>
                <Feature>Mini-agent: 2-10 parallel research agents</Feature>
                <Feature>Persistent memory across sessions</Feature>
              </ul>

              <Link
                href="/chat"
                className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-white transition-colors hover:text-amber-400"
              >
                Start chatting <Arrow />
              </Link>
            </div>

            {/* Mock UI Preview */}
            <div className="mx-6 mb-6 overflow-hidden rounded-xl border border-white/[0.06] bg-zinc-900/80 lg:mx-8 lg:mb-8">
              <div className="flex items-center gap-1.5 border-b border-white/[0.04] px-4 py-2.5">
                <div className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
                <div className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
                <div className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
                <span className="ml-3 text-[10px] text-zinc-500">JCIL Chat</span>
              </div>
              <div className="space-y-3 p-4">
                <div className="flex gap-3">
                  <div className="h-6 w-6 shrink-0 rounded-full bg-amber-500/20" />
                  <div className="max-w-[75%] rounded-2xl rounded-tl-sm bg-zinc-800 px-4 py-2.5">
                    <p className="text-xs text-zinc-300">
                      What does Romans 8:28 teach about God&apos;s sovereignty?
                    </p>
                  </div>
                </div>
                <div className="flex justify-end gap-3">
                  <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-amber-500/10 px-4 py-2.5">
                    <p className="text-xs text-zinc-300">
                      Romans 8:28 teaches that God works all things for the good of those who love
                      Him. The Greek <em className="text-amber-300">synergei</em> means &ldquo;works
                      together&rdquo; &mdash; even suffering serves His redemptive purpose...
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Code Lab Product */}
          <div className="group relative overflow-hidden rounded-3xl border border-white/[0.06] bg-white/[0.02] transition-all duration-500 hover:border-violet-500/20">
            {/* Glow effect */}
            <div className="absolute -right-20 -top-20 h-60 w-60 rounded-full bg-violet-500/[0.06] blur-[80px] transition-all group-hover:bg-violet-500/[0.1]" />

            {/* Content */}
            <div className="relative p-8 lg:p-10">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/10 ring-1 ring-violet-500/20">
                  <svg
                    className="h-6 w-6 text-violet-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Code Lab</h3>
                  <p className="text-sm text-violet-400/80">Full-service AI IDE</p>
                </div>
              </div>

              <p className="leading-relaxed text-zinc-400">
                A complete development environment in your browser. Switch between Claude, GPT,
                Gemini, Grok, and DeepSeek mid-conversation. Zero installation.
              </p>

              <div className="mt-6 flex gap-8 text-sm">
                <Stat value="51" label="Tools" />
                <Stat value="5" label="Models" />
                <Stat value="67+" label="Integrations" />
                <Stat value="6" label="Agents" />
              </div>

              <Link
                href="/code-lab/about"
                className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-white transition-colors hover:text-violet-400"
              >
                View technical specs <Arrow />
              </Link>
            </div>

            {/* Mock IDE Preview */}
            <div className="mx-6 mb-6 overflow-hidden rounded-xl border border-white/[0.06] bg-zinc-900/80 lg:mx-8 lg:mb-8">
              <div className="flex items-center gap-1.5 border-b border-white/[0.04] px-4 py-2.5">
                <div className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
                <div className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
                <div className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
                <span className="ml-3 text-[10px] text-zinc-500">
                  Code Lab &mdash; project/src/app.tsx
                </span>
              </div>
              <div className="flex">
                {/* Sidebar */}
                <div className="hidden w-36 shrink-0 border-r border-white/[0.04] p-3 sm:block">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                      <span className="text-zinc-600">&#9660;</span> src
                    </div>
                    <div className="ml-3 flex items-center gap-1.5 text-[10px] text-violet-400">
                      <span className="text-violet-500">&#9654;</span> app.tsx
                    </div>
                    <div className="ml-3 flex items-center gap-1.5 text-[10px] text-zinc-600">
                      <span>&#9654;</span> utils.ts
                    </div>
                    <div className="ml-3 flex items-center gap-1.5 text-[10px] text-zinc-600">
                      <span>&#9654;</span> api.ts
                    </div>
                  </div>
                </div>
                {/* Code area */}
                <div className="flex-1 p-3 font-mono">
                  <div className="space-y-0.5 text-[10px] leading-relaxed">
                    <div>
                      <span className="text-zinc-600 mr-2">1</span>
                      <span className="text-violet-400">import</span>{' '}
                      <span className="text-zinc-300">React</span>{' '}
                      <span className="text-violet-400">from</span>{' '}
                      <span className="text-amber-300">&apos;react&apos;</span>
                    </div>
                    <div>
                      <span className="text-zinc-600 mr-2">2</span>
                    </div>
                    <div>
                      <span className="text-zinc-600 mr-2">3</span>
                      <span className="text-violet-400">export default function</span>{' '}
                      <span className="text-amber-300">App</span>
                      <span className="text-zinc-300">() {'{'}</span>
                    </div>
                    <div>
                      <span className="text-zinc-600 mr-2">4</span>{' '}
                      <span className="text-violet-400">return</span>{' '}
                      <span className="text-zinc-300">&lt;</span>
                      <span className="text-emerald-400">div</span>
                      <span className="text-zinc-300">&gt;Hello&lt;/</span>
                      <span className="text-emerald-400">div</span>
                      <span className="text-zinc-300">&gt;</span>
                    </div>
                    <div>
                      <span className="text-zinc-600 mr-2">5</span>
                      <span className="text-zinc-300">{'}'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Feature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <svg
        className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400/60"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
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
