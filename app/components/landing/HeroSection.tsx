/**
 * HERO SECTION
 *
 * Composio-inspired hero with deep gradient background,
 * layered glow effects, CSS animations, and a single clear message.
 */

import Link from 'next/link';

export default function HeroSection() {
  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden">
      {/* Deep gradient background */}
      <div className="pointer-events-none absolute inset-0 bg-[#08010f]" />

      {/* Animated gradient orbs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/4 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 animate-[pulse_8s_ease-in-out_infinite] rounded-full bg-violet-600/20 blur-[160px]" />
        <div className="absolute right-1/4 top-1/3 h-[400px] w-[400px] animate-[pulse_6s_ease-in-out_infinite_1s] rounded-full bg-amber-500/8 blur-[120px]" />
        <div className="absolute bottom-1/4 left-1/4 h-[500px] w-[500px] animate-[pulse_10s_ease-in-out_infinite_2s] rounded-full bg-fuchsia-500/10 blur-[140px]" />
      </div>

      {/* Subtle dot grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      <div className="relative z-10 mx-auto max-w-4xl px-6 py-32 text-center lg:py-40">
        {/* Badge — fade in */}
        <div className="mb-8 animate-[fadeIn_0.8s_ease-out] inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-4 py-2 backdrop-blur-sm">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400" />
          </span>
          <span className="text-sm text-zinc-400">Powered by Claude Sonnet 4.6</span>
        </div>

        {/* Headline — slide up */}
        <h1 className="animate-[fadeInUp_0.8s_ease-out_0.1s_both] text-5xl font-bold leading-[1.1] tracking-tight text-white sm:text-6xl lg:text-7xl">
          AI that shares
          <br />
          <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-amber-400 bg-clip-text text-transparent">
            your values
          </span>
        </h1>

        {/* Subtitle — slide up delayed */}
        <p className="mx-auto mt-8 max-w-2xl animate-[fadeInUp_0.8s_ease-out_0.3s_both] text-lg leading-relaxed text-zinc-400 sm:text-xl">
          91 real tools. 67+ integrations. Full IDE. Sandboxed execution. Enterprise
          security. All grounded in Scripture.
        </p>

        {/* CTAs — slide up delayed */}
        <div className="mt-10 flex animate-[fadeInUp_0.8s_ease-out_0.5s_both] flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/signup"
            className="group w-full rounded-full bg-white px-8 py-3.5 text-base font-semibold text-zinc-900 transition-all duration-300 hover:shadow-[0_0_30px_rgba(255,255,255,0.15)] sm:w-auto"
            style={{ color: '#18181b' }}
          >
            Get started free
          </Link>
          <Link
            href="/code-lab/about"
            className="w-full rounded-full border border-white/20 px-8 py-3.5 text-base font-medium text-zinc-300 transition-all duration-300 hover:border-white/30 hover:text-white sm:w-auto"
          >
            Explore Code Lab
          </Link>
        </div>

        {/* Trust line */}
        <p className="mt-14 animate-[fadeIn_0.8s_ease-out_0.7s_both] text-sm text-zinc-500">
          Switch models mid-conversation &middot; No credit card required &middot; BYOK supported
        </p>
      </div>

      {/* Bottom gradient fade into next section */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#09090b] to-transparent" />
    </section>
  );
}
