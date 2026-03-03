/**
 * HERO SECTION COMPONENT
 *
 * Professional hero with accurate metrics
 * Dark-mode-first, TrustClaw-inspired design
 */

import Link from 'next/link';
import { CrossIcon } from './Icons';

export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[2px] h-[600px] bg-gradient-to-b from-transparent via-amber-500/20 to-transparent" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[2px] bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />
        <div className="absolute top-1/4 -right-32 w-[600px] h-[600px] bg-amber-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 -left-32 w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-amber-500/5 rounded-full blur-[150px]" />
      </div>

      {/* Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,black_40%,transparent_100%)]" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-32 pb-20 lg:pt-40 lg:pb-32">
        <div className="text-center">
          {/* Faith Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 mb-8">
            <CrossIcon className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-medium text-amber-200/90">Faith-First AI Platform</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
            <span className="text-white">Enterprise AI with</span>
            <br />
            <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 bg-clip-text text-transparent">
              Biblical Truth
            </span>
          </h1>

          {/* Subheadline */}
          <p className="mx-auto max-w-2xl text-lg sm:text-xl text-slate-400 leading-relaxed mb-4">
            The first enterprise-grade AI platform built for Christians. 51 real tools, multi-model
            intelligence, and E2B sandboxed execution&mdash;grounded in Scripture.
          </p>

          {/* Scripture Reference */}
          <p className="text-amber-500/80 text-sm italic mb-8">
            &ldquo;All Scripture is God-breathed and is useful for teaching, rebuking, correcting
            and training in righteousness.&rdquo;
            <span className="not-italic ml-2 text-amber-400/60">(2 Timothy 3:16)</span>
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <Link
              href="/signup"
              className="w-full sm:w-auto rounded-lg bg-amber-600 hover:bg-amber-500 px-8 py-4 text-base font-semibold text-white transition-all shadow-lg shadow-amber-500/20"
            >
              Start Building Free
            </Link>
            <Link
              href="/code-lab/about"
              className="w-full sm:w-auto rounded-lg border border-white/20 bg-white/5 backdrop-blur-sm px-8 py-4 text-base font-semibold text-white hover:bg-white/10 hover:border-white/30 transition-all"
            >
              Explore Code Lab
            </Link>
          </div>

          {/* Trust Indicators - Verified claims only */}
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-sm text-slate-500">
            <TrustBadge>Powered by Anthropic Claude</TrustBadge>
            <TrustBadge>51 Real AI Tools</TrustBadge>
            <TrustBadge>17,500+ Automated Tests</TrustBadge>
            <TrustBadge>E2B Sandboxed Execution</TrustBadge>
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
        <div className="w-6 h-10 rounded-full border-2 border-white/20 flex items-start justify-center p-2">
          <div className="w-1 h-2 rounded-full bg-white/40 animate-bounce" />
        </div>
      </div>
    </section>
  );
}

function TrustBadge({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
          clipRule="evenodd"
        />
      </svg>
      <span>{children}</span>
    </div>
  );
}
