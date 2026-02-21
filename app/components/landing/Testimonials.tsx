/**
 * SOCIAL PROOF SECTION
 *
 * Honest social proof without fake testimonials
 * Shows real technical metrics and value propositions
 */

'use client';

import Link from 'next/link';
import { CrossIcon } from './Icons';

export default function SocialProof() {
  return (
    <section className="py-20 lg:py-28 bg-black">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12 lg:mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/30 mb-6">
            <span className="text-sm font-medium text-amber-300">Why Choose JCIL</span>
          </div>
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">
            Built different. Built for believers.
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            We&apos;re not just another AI wrapper. JCIL is purpose-built for the Christian
            community with features you won&apos;t find anywhere else.
          </p>
        </div>

        {/* Value Props Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-16">
          {/* Value Prop 1 */}
          <div className="bg-gradient-to-br from-amber-950/50 to-amber-900/20 rounded-2xl p-8 border border-amber-500/20">
            <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center mb-6">
              <CrossIcon className="w-6 h-6 text-amber-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Scripture-First Responses</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              When you ask theological questions, JCIL prioritizes Biblical accuracy. No moral
              relativism, no secular philosophy masquerading as wisdom.
            </p>
          </div>

          {/* Value Prop 2 */}
          <div className="bg-gradient-to-br from-purple-950/50 to-purple-900/20 rounded-2xl p-8 border border-purple-500/20">
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center mb-6">
              <svg
                className="w-6 h-6 text-purple-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white mb-3">Security-First Architecture</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Built with enterprise security patterns from day one. Your data is encrypted, your
              conversations are private, and we never train on your data.
            </p>
          </div>

          {/* Value Prop 3 */}
          <div className="bg-gradient-to-br from-fuchsia-950/50 to-fuchsia-900/20 rounded-2xl p-8 border border-fuchsia-500/20">
            <div className="w-12 h-12 rounded-xl bg-fuchsia-500/20 flex items-center justify-center mb-6">
              <svg
                className="w-6 h-6 text-fuchsia-400"
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
            <h3 className="text-xl font-bold text-white mb-3">Real Development Tools</h3>
            <p className="text-slate-400 text-sm leading-relaxed">
              Code Lab isn&apos;t a toy. 30+ tools, E2B sandboxed execution, GitHub integration, and
              planning mode. Build real apps for your church or ministry.
            </p>
          </div>
        </div>

        {/* Technical Proof Points - These are REAL and verifiable */}
        <div className="bg-slate-900/50 rounded-2xl p-8 lg:p-12 border border-slate-800">
          <h3 className="text-xl font-bold text-white mb-8 text-center">
            Built with integrity. Verified by engineering.
          </h3>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="text-center">
              <div className="text-3xl lg:text-4xl font-bold text-amber-400 mb-2">2,128</div>
              <div className="text-sm text-slate-400">Automated Tests</div>
              <div className="text-xs text-slate-500 mt-1">100% passing</div>
            </div>
            <div className="text-center">
              <div className="text-3xl lg:text-4xl font-bold text-amber-400 mb-2">100%</div>
              <div className="text-sm text-slate-400">TypeScript</div>
              <div className="text-xs text-slate-500 mt-1">Type-safe codebase</div>
            </div>
            <div className="text-center">
              <div className="text-3xl lg:text-4xl font-bold text-amber-400 mb-2">55+</div>
              <div className="text-sm text-slate-400">Dev Tools</div>
              <div className="text-xs text-slate-500 mt-1">In Code Lab</div>
            </div>
            <div className="text-center">
              <div className="text-3xl lg:text-4xl font-bold text-amber-400 mb-2">Opus 4.6</div>
              <div className="text-sm text-slate-400">Claude Model</div>
              <div className="text-xs text-slate-500 mt-1">Latest & most capable</div>
            </div>
          </div>
        </div>

        {/* Early Adopter CTA */}
        <div className="mt-12 text-center">
          <p className="text-slate-400 mb-6">
            We&apos;re early and growing. Be part of building something meaningful for the Kingdom.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="w-full sm:w-auto rounded-xl bg-amber-600 hover:bg-amber-500 px-8 py-4 text-base font-semibold text-white transition-all shadow-lg shadow-amber-500/20"
            >
              Try JCIL Free
            </Link>
            <Link
              href="/contact"
              className="w-full sm:w-auto rounded-xl border border-white/20 bg-white/5 px-8 py-4 text-base font-semibold text-white hover:bg-white/10 transition-all"
            >
              Share Your Feedback
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
