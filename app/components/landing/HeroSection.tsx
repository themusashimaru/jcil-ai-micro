/**
 * HERO SECTION
 *
 * Full-viewport hero with strong value prop.
 * Scripture-grounded AI is the lead message — that's the differentiator.
 */

import Link from 'next/link';

export default function HeroSection() {
  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden">
      {/* Deep gradient background */}
      <div className="pointer-events-none absolute inset-0 bg-[#050208]" />

      {/* Animated gradient orbs — larger, more dramatic */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/3 h-[1000px] w-[1000px] -translate-x-1/2 -translate-y-1/2 animate-[pulse_8s_ease-in-out_infinite] rounded-full bg-violet-600/15 blur-[200px]" />
        <div className="absolute right-1/3 top-1/4 h-[600px] w-[600px] animate-[pulse_6s_ease-in-out_infinite_1s] rounded-full bg-amber-500/8 blur-[160px]" />
        <div className="absolute bottom-1/3 left-1/3 h-[500px] w-[500px] animate-[pulse_10s_ease-in-out_infinite_2s] rounded-full bg-fuchsia-500/8 blur-[180px]" />
      </div>

      {/* Subtle grid pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative z-10 mx-auto max-w-5xl px-6 py-32 text-center lg:py-40">
        {/* Badge */}
        <div className="mb-10 animate-[fadeIn_0.8s_ease-out] inline-flex items-center gap-2.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-5 py-2.5 backdrop-blur-sm">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
          </span>
          <span className="text-sm text-zinc-400">Powered by Claude Sonnet 4.6</span>
        </div>

        {/* Headline — the differentiator leads */}
        <h1 className="animate-[fadeInUp_0.8s_ease-out_0.1s_both] text-5xl font-bold leading-[1.08] tracking-tight text-white sm:text-6xl lg:text-8xl">
          AI grounded in
          <br />
          <span className="bg-gradient-to-r from-amber-300 via-amber-400 to-violet-400 bg-clip-text text-transparent">
            Scripture
          </span>
        </h1>

        {/* Subtitle — what it actually does */}
        <p className="mx-auto mt-8 max-w-2xl animate-[fadeInUp_0.8s_ease-out_0.3s_both] text-lg leading-relaxed text-zinc-400 sm:text-xl lg:text-2xl lg:leading-relaxed">
          A full AI platform built for Christians. Chat, code, research, and create — with an AI
          that shares your values.
        </p>

        {/* Key stats inline */}
        <div className="mx-auto mt-10 flex animate-[fadeInUp_0.8s_ease-out_0.4s_both] items-center justify-center gap-8 text-sm text-zinc-500 sm:gap-12">
          <span>
            <strong className="text-white">51</strong> real tools
          </span>
          <span className="h-3 w-px bg-zinc-700" />
          <span>
            <strong className="text-white">6</strong> AI agents
          </span>
          <span className="h-3 w-px bg-zinc-700" />
          <span>
            <strong className="text-white">5</strong> LLM providers
          </span>
          <span className="h-3 w-px bg-zinc-700" />
          <span>
            <strong className="text-white">Full</strong> IDE
          </span>
        </div>

        {/* CTAs */}
        <div className="mt-12 flex animate-[fadeInUp_0.8s_ease-out_0.5s_both] flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/signup"
            className="group relative w-full overflow-hidden rounded-full bg-white px-10 py-4 text-base font-semibold text-zinc-900 transition-all duration-300 hover:shadow-[0_0_40px_rgba(255,255,255,0.15)] sm:w-auto"
            style={{ color: '#18181b' }}
          >
            Get started free
          </Link>
          <Link
            href="/code-lab/about"
            className="w-full rounded-full border border-white/15 bg-white/[0.03] px-10 py-4 text-base font-medium text-zinc-300 backdrop-blur-sm transition-all duration-300 hover:border-white/25 hover:bg-white/[0.06] hover:text-white sm:w-auto"
          >
            Explore Code Lab
          </Link>
        </div>

        {/* Trust line */}
        <p className="mt-16 animate-[fadeIn_0.8s_ease-out_0.7s_both] text-sm text-zinc-600">
          No credit card required &middot; BYOK supported &middot; Switch models mid-conversation
        </p>
      </div>

      {/* Bottom gradient fade */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-zinc-950 to-transparent" />
    </section>
  );
}
