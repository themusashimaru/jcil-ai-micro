/**
 * HERO SECTION
 *
 * Full-viewport hero with animated gradient mesh, floating UI preview,
 * gradient-bordered buttons, and rich visual depth.
 */

import Link from 'next/link';

export default function HeroSection() {
  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden">
      {/* Base background */}
      <div className="pointer-events-none absolute inset-0 bg-[#050208]" />

      {/* Animated gradient mesh — multiple layers for depth */}
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute left-1/2 top-1/4 h-[900px] w-[900px] -translate-x-1/2 -translate-y-1/3 rounded-full opacity-70"
          style={{
            background:
              'radial-gradient(circle, rgba(139,92,246,0.15) 0%, rgba(245,158,11,0.08) 40%, transparent 70%)',
            animation: 'gradient-shift 15s ease-in-out infinite',
          }}
        />
        <div
          className="absolute right-1/4 top-1/3 h-[600px] w-[600px] rounded-full opacity-60"
          style={{
            background: 'radial-gradient(circle, rgba(251,191,36,0.12) 0%, transparent 60%)',
            animation: 'gradient-shift 12s ease-in-out infinite reverse',
          }}
        />
        <div
          className="absolute bottom-1/4 left-1/4 h-[500px] w-[500px] rounded-full opacity-50"
          style={{
            background: 'radial-gradient(circle, rgba(168,85,247,0.1) 0%, transparent 60%)',
            animation: 'gradient-shift 18s ease-in-out infinite 3s',
          }}
        />
      </div>

      {/* Noise texture overlay for premium feel */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Dot grid pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      {/* Main content */}
      <div className="relative z-10 mx-auto max-w-6xl px-6 py-32 lg:py-40">
        <div className="grid items-center gap-16 lg:grid-cols-[1fr,auto] lg:gap-20">
          {/* Left — text content */}
          <div className="text-center lg:text-left">
            {/* Badge */}
            <div
              className="mb-8 inline-flex items-center gap-2.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-5 py-2.5 backdrop-blur-sm"
              style={{ animation: 'fadeInUp 0.6s ease-out both' }}
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              <span className="text-sm text-zinc-400">Powered by Claude Sonnet 4.6</span>
            </div>

            {/* Headline */}
            <h1
              className="text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-7xl"
              style={{ animation: 'fadeInUp 0.7s ease-out 0.1s both' }}
            >
              AI grounded in
              <br />
              <span className="bg-gradient-to-r from-amber-300 via-amber-400 to-violet-400 bg-clip-text text-transparent">
                Scripture
              </span>
            </h1>

            {/* Subtitle */}
            <p
              className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-zinc-400 sm:text-lg lg:mx-0 lg:text-xl lg:leading-relaxed"
              style={{ animation: 'fadeInUp 0.7s ease-out 0.25s both' }}
            >
              A full AI platform built for Christians. Chat, code, research, and create &mdash; with
              an AI that shares your values.
            </p>

            {/* Stats */}
            <div
              className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-zinc-500 lg:justify-start sm:gap-8"
              style={{ animation: 'fadeInUp 0.7s ease-out 0.35s both' }}
            >
              <StatPill value="51" label="tools" />
              <StatPill value="6" label="agents" />
              <StatPill value="5" label="LLMs" />
              <StatPill value="67+" label="integrations" />
            </div>

            {/* CTAs */}
            <div
              className="mt-10 flex flex-col items-center gap-4 sm:flex-row lg:justify-start"
              style={{ animation: 'fadeInUp 0.7s ease-out 0.45s both' }}
            >
              {/* Primary CTA — gradient with glow */}
              <Link
                href="/signup"
                className="group relative w-full overflow-hidden rounded-2xl sm:rounded-full sm:w-auto"
              >
                {/* Gradient border glow */}
                <div className="absolute -inset-[1px] rounded-2xl sm:rounded-full bg-gradient-to-r from-amber-400 via-amber-500 to-violet-500 opacity-80 blur-[1px] transition-all group-hover:opacity-100 group-hover:blur-[2px]" />
                <div
                  className="relative flex items-center justify-center gap-2 rounded-2xl sm:rounded-full bg-gradient-to-r from-amber-400 to-amber-500 px-8 py-4 text-base font-semibold text-zinc-900 shadow-[0_0_40px_rgba(251,191,36,0.2)] transition-all group-hover:shadow-[0_0_60px_rgba(251,191,36,0.35)]"
                  style={{ color: '#18181b' }}
                >
                  Get started free
                  <svg
                    className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                    />
                  </svg>
                </div>
              </Link>

              {/* Secondary CTA — glass with gradient border */}
              <Link
                href="/code-lab/about"
                className="group relative w-full overflow-hidden rounded-2xl sm:rounded-full sm:w-auto"
              >
                <div className="absolute -inset-[1px] rounded-2xl sm:rounded-full bg-gradient-to-r from-white/20 to-white/5 opacity-50 transition-all group-hover:opacity-80" />
                <div className="relative flex items-center justify-center gap-2 rounded-2xl sm:rounded-full border border-white/[0.08] bg-zinc-950/80 px-8 py-4 text-base font-medium text-zinc-300 backdrop-blur-sm transition-all group-hover:text-white">
                  Explore Code Lab
                </div>
              </Link>
            </div>

            {/* Trust line */}
            <p
              className="mt-8 text-xs text-zinc-600"
              style={{ animation: 'fadeInUp 0.7s ease-out 0.55s both' }}
            >
              No credit card required &middot; BYOK supported &middot; Your data never trains AI
            </p>
          </div>

          {/* Right — floating UI preview card (desktop + tablet) */}
          <div
            className="hidden md:block"
            style={{ animation: 'fadeInUp 0.8s ease-out 0.4s both' }}
          >
            <div className="relative" style={{ animation: 'float 6s ease-in-out infinite' }}>
              {/* Glow behind card */}
              <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-amber-500/10 via-violet-500/10 to-transparent blur-2xl" />

              {/* Chat preview card */}
              <div className="relative w-[340px] overflow-hidden rounded-2xl border border-white/[0.08] bg-zinc-900/90 shadow-[0_20px_60px_rgba(0,0,0,0.5)] backdrop-blur-xl">
                {/* Window chrome */}
                <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
                  <div className="flex gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
                    <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/60" />
                    <div className="h-2.5 w-2.5 rounded-full bg-green-500/60" />
                  </div>
                  <div className="ml-2 flex items-center gap-1.5 rounded-lg bg-white/[0.04] px-3 py-1">
                    <div className="h-3 w-3 rounded-sm bg-amber-500/30" />
                    <span className="text-[11px] font-medium text-zinc-400">JCIL Chat</span>
                  </div>
                </div>

                {/* Chat messages */}
                <div className="space-y-3 p-4">
                  {/* User message */}
                  <div className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-white/[0.06] px-4 py-3">
                      <p className="text-[13px] leading-relaxed text-zinc-200">
                        What does Romans 8:28 teach about God&apos;s sovereignty?
                      </p>
                    </div>
                  </div>

                  {/* AI response */}
                  <div className="flex gap-2.5">
                    <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-amber-500">
                      <svg
                        viewBox="0 0 24 24"
                        className="h-3 w-3 text-zinc-900"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2.5}
                        strokeLinecap="round"
                      >
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="7" y1="10" x2="17" y2="10" />
                      </svg>
                    </div>
                    <div className="max-w-[90%] rounded-2xl rounded-tl-md bg-gradient-to-br from-amber-500/[0.08] to-violet-500/[0.04] px-4 py-3 ring-1 ring-white/[0.04]">
                      <p className="text-[13px] leading-relaxed text-zinc-200">
                        Romans 8:28 affirms that God <em className="text-amber-300">synergei</em>{' '}
                        &mdash; &ldquo;works together&rdquo; all things for the good of those called
                        according to His purpose...
                      </p>
                      <div className="mt-2 flex items-center gap-1.5 text-[10px] text-amber-400/70">
                        <svg
                          className="h-3 w-3"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
                          />
                        </svg>
                        Romans 8:28 (ESV)
                      </div>
                    </div>
                  </div>

                  {/* Typing indicator */}
                  <div className="flex gap-2.5">
                    <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-amber-500">
                      <svg
                        viewBox="0 0 24 24"
                        className="h-3 w-3 text-zinc-900"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2.5}
                        strokeLinecap="round"
                      >
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="7" y1="10" x2="17" y2="10" />
                      </svg>
                    </div>
                    <div className="flex items-center gap-1 rounded-2xl rounded-tl-md bg-white/[0.03] px-4 py-3">
                      <div className="h-1.5 w-1.5 rounded-full bg-zinc-500 animate-pulse" />
                      <div className="h-1.5 w-1.5 rounded-full bg-zinc-500 animate-pulse [animation-delay:0.2s]" />
                      <div className="h-1.5 w-1.5 rounded-full bg-zinc-500 animate-pulse [animation-delay:0.4s]" />
                    </div>
                  </div>
                </div>

                {/* Input bar */}
                <div className="border-t border-white/[0.06] p-3">
                  <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2.5">
                    <span className="flex-1 text-[12px] text-zinc-500">Ask anything...</span>
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400">
                      <svg
                        className="h-3.5 w-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-zinc-950 to-transparent" />
    </section>
  );
}

function StatPill({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-sm font-bold text-white">{value}</span>
      <span className="text-sm text-zinc-500">{label}</span>
    </div>
  );
}
