/**
 * HERO SECTION
 *
 * Clean, professional hero inspired by Anthropic's approach.
 * One clear headline, one subtitle, one CTA. Generous whitespace.
 */

import Link from 'next/link';

export default function HeroSection() {
  return (
    <section className="relative flex min-h-[90vh] items-center justify-center overflow-hidden bg-black">
      {/* Subtle background glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/3 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-amber-600/[0.07] blur-[160px]" />
      </div>

      <div className="relative mx-auto max-w-4xl px-6 pb-20 pt-32 text-center lg:pt-40">
        {/* Headline */}
        <h1 className="text-4xl font-semibold leading-[1.15] tracking-tight text-white sm:text-5xl lg:text-6xl">
          AI built for people
          <br />
          <span className="text-slate-400">who build for the Kingdom</span>
        </h1>

        {/* Subtitle */}
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-400 sm:text-xl">
          Enterprise-grade intelligence with 51 real tools, a full coding IDE,
          and multi-model support — grounded in Christian values.
        </p>

        {/* CTA */}
        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/signup"
            className="w-full rounded-lg bg-white px-8 py-3.5 text-base font-semibold text-black transition-all hover:bg-slate-100 sm:w-auto"
          >
            Get started free
          </Link>
          <Link
            href="/code-lab/about"
            className="w-full rounded-lg border border-white/15 px-8 py-3.5 text-base font-medium text-slate-300 transition-all hover:border-white/30 hover:text-white sm:w-auto"
          >
            Explore Code Lab
          </Link>
        </div>

        {/* Trust line */}
        <p className="mt-12 text-sm text-slate-500">
          Powered by Claude Sonnet 4.6 &middot; No credit card required
        </p>
      </div>
    </section>
  );
}
