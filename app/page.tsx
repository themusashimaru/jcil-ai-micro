/**
 * JCIL.AI LANDING PAGE
 *
 * PURPOSE:
 * - Public homepage for JCIL.AI
 * - Two clear product paths: Chat + Code Lab
 * - Mobile-first, tier-one presentation
 * - Enterprise-grade autonomous AI
 */

import Link from 'next/link';
import PricingSection from './components/PricingSection';
import LandingLogo from './components/LandingLogo';
import MobileMenu from './components/MobileMenu';
import DemoShowcase from './components/DemoShowcase';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-black text-white">
      {/* Header - Dark Glassmorphism */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-black/80 border-b border-white/10">
        <div className="container mx-auto px-4 py-4">
          <nav className="flex items-center justify-between">
            <LandingLogo />

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-6">
              <Link href="#products" className="text-slate-400 hover:text-white font-medium transition">
                Products
              </Link>
              <Link href="/code-lab" className="text-fuchsia-400 hover:text-fuchsia-300 font-medium transition">
                Code Lab
              </Link>
              <Link href="/docs" className="text-slate-400 hover:text-white font-medium transition">
                Docs
              </Link>
              <Link href="#pricing" className="text-slate-400 hover:text-white font-medium transition">
                Pricing
              </Link>
            </div>

            {/* Desktop CTA Buttons */}
            <div className="hidden md:flex items-center space-x-4">
              <Link href="/login" className="px-4 py-2 text-slate-400 hover:text-white font-medium transition">
                Log In
              </Link>
              <Link
                href="/signup"
                className="rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-2 text-white font-semibold hover:shadow-lg hover:shadow-purple-500/25 transition-all duration-300"
              >
                Get Started
              </Link>
            </div>

            {/* Mobile Menu */}
            <MobileMenu />
          </nav>
        </div>
      </header>

      {/* Hero Section - Clear Value Proposition */}
      <section className="relative overflow-hidden bg-black py-16 sm:py-24 lg:py-32">
        {/* Animated Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-[400px] sm:w-[600px] h-[400px] sm:h-[600px] bg-purple-600/15 rounded-full blur-[100px] sm:blur-[120px]" />
          <div className="absolute -bottom-40 -left-40 w-[400px] sm:w-[600px] h-[400px] sm:h-[600px] bg-blue-600/15 rounded-full blur-[100px] sm:blur-[120px]" />
        </div>

        <div className="container mx-auto px-4 relative">
          <div className="mx-auto max-w-5xl">
            {/* Anthropic Partnership Badge */}
            <div className="flex justify-center mb-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/30">
                <svg className="w-5 h-5 text-orange-400" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
                <span className="text-sm font-medium text-orange-300">Exclusively Powered by Anthropic Claude</span>
              </div>
            </div>

            {/* Headline */}
            <div className="text-center mb-12 sm:mb-16">
              <h1 className="mb-6 text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.1] tracking-tight">
                <span className="text-white">Two products.</span>
                <br />
                <span className="bg-gradient-to-r from-purple-400 via-fuchsia-400 to-blue-400 bg-clip-text text-transparent">
                  One intelligent platform.
                </span>
              </h1>
              <p className="mx-auto max-w-2xl text-lg sm:text-xl text-slate-400">
                Chat for everyday AI assistance. Code Lab for developers who build.
                <span className="block mt-2 text-slate-500 text-base">Founded on faith. Open to all.</span>
              </p>

              {/* Trust Indicators */}
              <div className="flex flex-wrap justify-center gap-4 sm:gap-6 mt-8">
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>SOC 2 Ready</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>685+ Tests</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>100% TypeScript</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <svg className="w-4 h-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>Zero Vulnerabilities</span>
                </div>
              </div>
            </div>

            {/* Two Product Cards - Mobile Stacked, Desktop Side by Side */}
            <div className="grid gap-6 md:grid-cols-2 max-w-4xl mx-auto">
              {/* Chat Product Card */}
              <div className="group relative bg-gradient-to-br from-blue-900/40 to-blue-900/20 rounded-2xl p-6 sm:p-8 border border-blue-500/30 hover:border-blue-400/50 transition-all duration-300">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl" />
                <div className="relative">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                      <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-xl sm:text-2xl font-bold text-white">Chat</h2>
                      <p className="text-sm text-blue-300">For everyone</p>
                    </div>
                  </div>

                  <p className="text-slate-300 mb-6 text-sm sm:text-base">
                    Same Claude intelligence, grounded in Biblical truth. Get answers that align with Scripture.
                  </p>

                  {/* Capabilities - Horizontal Scroll on Mobile */}
                  <div className="flex gap-2 overflow-x-auto pb-2 mb-6 -mx-2 px-2 scrollbar-hide">
                    <span className="shrink-0 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-xs text-blue-300">Biblical Truth</span>
                    <span className="shrink-0 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-xs text-blue-300">Claude Sonnet 4.5</span>
                    <span className="shrink-0 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-xs text-blue-300">Perplexity Search</span>
                    <span className="shrink-0 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-xs text-blue-300">Image Gen</span>
                  </div>

                  <Link
                    href="/chat"
                    className="block w-full text-center rounded-xl bg-blue-600 hover:bg-blue-500 px-6 py-3 text-white font-semibold transition-all duration-300"
                  >
                    Start Chatting
                  </Link>
                </div>
              </div>

              {/* Code Lab Product Card */}
              <div className="group relative bg-gradient-to-br from-fuchsia-900/40 to-fuchsia-900/20 rounded-2xl p-6 sm:p-8 border border-fuchsia-500/30 hover:border-fuchsia-400/50 transition-all duration-300">
                <div className="absolute top-0 right-0 w-32 h-32 bg-fuchsia-500/10 rounded-full blur-2xl" />
                <div className="relative">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-fuchsia-500/20 flex items-center justify-center">
                      <svg className="w-6 h-6 text-fuchsia-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-xl sm:text-2xl font-bold text-white">Code Lab</h2>
                      <p className="text-sm text-fuchsia-300">For developers</p>
                    </div>
                  </div>

                  <p className="text-slate-300 mb-6 text-sm sm:text-base">
                    Full dev environment with sandboxed execution, GitHub integration, and agentic workflows.
                  </p>

                  {/* Capabilities - Horizontal Scroll on Mobile */}
                  <div className="flex gap-2 overflow-x-auto pb-2 mb-6 -mx-2 px-2 scrollbar-hide">
                    <span className="shrink-0 px-3 py-1.5 rounded-full bg-fuchsia-500/10 border border-fuchsia-500/30 text-xs text-fuchsia-300">Claude Opus 4.5</span>
                    <span className="shrink-0 px-3 py-1.5 rounded-full bg-fuchsia-500/10 border border-fuchsia-500/30 text-xs text-fuchsia-300">E2B Sandbox</span>
                    <span className="shrink-0 px-3 py-1.5 rounded-full bg-fuchsia-500/10 border border-fuchsia-500/30 text-xs text-fuchsia-300">MCP Protocol</span>
                    <span className="shrink-0 px-3 py-1.5 rounded-full bg-fuchsia-500/10 border border-fuchsia-500/30 text-xs text-fuchsia-300">GitHub</span>
                    <span className="shrink-0 px-3 py-1.5 rounded-full bg-fuchsia-500/10 border border-fuchsia-500/30 text-xs text-fuchsia-300">Planning Mode</span>
                  </div>

                  <Link
                    href="/code-lab"
                    className="block w-full text-center rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 px-6 py-3 text-white font-semibold transition-all duration-300"
                  >
                    Open Code Lab
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* Demo Showcase - Consolidated Tabbed Demos */}
      <DemoShowcase />

      {/* Core Capabilities - Simplified, Mobile-First */}
      <section id="capabilities" className="relative bg-black py-16 sm:py-20 overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="text-center mb-10 sm:mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              What sets us apart
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto">
              Enterprise capabilities that actually matter.
            </p>
          </div>

          {/* Horizontal Scroll Cards on Mobile */}
          <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:overflow-visible scrollbar-hide">
            <div className="shrink-0 w-[280px] sm:w-auto bg-gradient-to-br from-purple-900/30 to-purple-900/10 rounded-2xl p-5 sm:p-6 border border-purple-500/20">
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center mb-4">
                <span className="text-2xl">🧬</span>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Agentic AI</h3>
              <p className="text-sm text-slate-400">Autonomous task execution with plan-execute-observe loops</p>
            </div>

            <div className="shrink-0 w-[280px] sm:w-auto bg-gradient-to-br from-blue-900/30 to-blue-900/10 rounded-2xl p-5 sm:p-6 border border-blue-500/20">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center mb-4">
                <span className="text-2xl">🔌</span>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">MCP Native</h3>
              <p className="text-sm text-slate-400">Connect to any tool through Model Context Protocol</p>
            </div>

            <div className="shrink-0 w-[280px] sm:w-auto bg-gradient-to-br from-pink-900/30 to-pink-900/10 rounded-2xl p-5 sm:p-6 border border-pink-500/20">
              <div className="w-12 h-12 rounded-xl bg-pink-500/20 flex items-center justify-center mb-4">
                <span className="text-2xl">🔄</span>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Self-Correcting</h3>
              <p className="text-sm text-slate-400">Auto-retry with intelligent error analysis</p>
            </div>

            <div className="shrink-0 w-[280px] sm:w-auto bg-gradient-to-br from-amber-900/30 to-amber-900/10 rounded-2xl p-5 sm:p-6 border border-amber-500/20">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center mb-4">
                <span className="text-2xl">🧠</span>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Persistent Memory</h3>
              <p className="text-sm text-slate-400">Context that survives sessions and learns you</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works - Simplified for Mobile */}
      <section className="relative bg-gradient-to-b from-black via-slate-900/50 to-black py-16 sm:py-20 overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="text-center mb-10 sm:mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              How it works
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto">
              Simple workflow. Powerful results.
            </p>
          </div>

          {/* Mobile: Vertical Stack, Desktop: Horizontal */}
          <div className="max-w-4xl mx-auto">
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { step: '1', title: 'Describe', desc: 'Tell the agent what you need in plain English', icon: '💬' },
                { step: '2', title: 'Execute', desc: 'Agent plans, codes, tests, and fixes automatically', icon: '⚡' },
                { step: '3', title: 'Ship', desc: 'Get working code pushed to GitHub, ready to deploy', icon: '🚀' },
              ].map((item, i) => (
                <div key={i} className="relative flex sm:flex-col items-start sm:items-center gap-4 sm:gap-3 p-4 sm:p-6 bg-slate-800/30 rounded-2xl border border-slate-700/50">
                  <div className="w-12 h-12 shrink-0 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center border border-purple-500/30">
                    <span className="text-xl">{item.icon}</span>
                  </div>
                  <div className="sm:text-center">
                    <h3 className="text-lg font-bold text-white mb-1">{item.title}</h3>
                    <p className="text-sm text-slate-400">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Identity Section - Why JCIL.AI */}
      <section className="relative bg-black py-12 sm:py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
              Why not just use Claude?
            </h2>
            <p className="text-slate-400 mb-4">
              Because Claude doesn&apos;t know the Word. We do.
            </p>
            <p className="text-slate-500 text-sm">
              JCIL.AI is built on Biblical principles. When you ask about faith, life, or truth — you get answers grounded in Scripture, not moral relativism. Same world-class AI. Different foundation.
            </p>
          </div>
        </div>
      </section>

      {/* Enterprise Security Section - Enhanced */}
      <section className="bg-gradient-to-r from-purple-900/50 to-blue-900/50 py-12 sm:py-16 border-y border-white/10">
        <div className="container mx-auto px-4">
          <h2 className="mb-3 text-center text-2xl sm:text-3xl font-bold text-white">Enterprise-Grade Security</h2>
          <p className="mb-4 text-center text-slate-300 text-sm sm:text-base">
            Your data protected with Fortune 500 standards. SOC 2 Type II compliant infrastructure.
          </p>

          {/* Compliance Badges */}
          <div className="flex flex-wrap justify-center gap-3 mb-8">
            <div className="px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/30 text-xs font-medium text-green-300">
              SOC 2 Type II Ready
            </div>
            <div className="px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-xs font-medium text-blue-300">
              GDPR Compliant
            </div>
            <div className="px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-xs font-medium text-purple-300">
              CCPA Compliant
            </div>
            <div className="px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/30 text-xs font-medium text-orange-300">
              Anthropic Exclusive
            </div>
          </div>

          <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:gap-4 sm:overflow-visible scrollbar-hide">
            <div className="shrink-0 w-[240px] sm:w-auto bg-white/5 backdrop-blur rounded-xl p-5 border border-white/10">
              <div className="mb-3 text-2xl">🇺🇸</div>
              <h3 className="mb-1.5 font-semibold text-white">US Data Centers</h3>
              <p className="text-xs text-slate-300">American servers only. No foreign data transfer.</p>
            </div>
            <div className="shrink-0 w-[240px] sm:w-auto bg-white/5 backdrop-blur rounded-xl p-5 border border-white/10">
              <div className="mb-3 text-2xl">🔒</div>
              <h3 className="mb-1.5 font-semibold text-white">E2E Encryption</h3>
              <p className="text-xs text-slate-300">AES-256 encryption. TLS 1.3 in transit.</p>
            </div>
            <div className="shrink-0 w-[240px] sm:w-auto bg-white/5 backdrop-blur rounded-xl p-5 border border-white/10">
              <div className="mb-3 text-2xl">🛡️</div>
              <h3 className="mb-1.5 font-semibold text-white">AI Safety</h3>
              <p className="text-xs text-slate-300">Anthropic&apos;s Constitutional AI. Industry-leading safety.</p>
            </div>
            <div className="shrink-0 w-[240px] sm:w-auto bg-white/5 backdrop-blur rounded-xl p-5 border border-white/10">
              <div className="mb-3 text-2xl">📋</div>
              <h3 className="mb-1.5 font-semibold text-white">Full Audit Trail</h3>
              <p className="text-xs text-slate-300">Complete logging. Data export on request.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Powered By Section */}
      <section className="bg-black py-12 sm:py-16">
        <div className="container mx-auto px-4">
          <p className="text-center text-sm text-slate-500 mb-8">Powered by industry-leading technology</p>
          <div className="flex flex-wrap justify-center items-center gap-8 sm:gap-12">
            {/* Anthropic */}
            <div className="flex flex-col items-center gap-2 opacity-70 hover:opacity-100 transition">
              <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <span className="text-orange-400 font-bold text-lg">A</span>
              </div>
              <span className="text-xs text-slate-400">Anthropic</span>
            </div>
            {/* Vercel */}
            <div className="flex flex-col items-center gap-2 opacity-70 hover:opacity-100 transition">
              <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2L2 19.5h20L12 2z" />
                </svg>
              </div>
              <span className="text-xs text-slate-400">Vercel</span>
            </div>
            {/* Supabase */}
            <div className="flex flex-col items-center gap-2 opacity-70 hover:opacity-100 transition">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <span className="text-green-400 font-bold text-lg">S</span>
              </div>
              <span className="text-xs text-slate-400">Supabase</span>
            </div>
            {/* Stripe */}
            <div className="flex flex-col items-center gap-2 opacity-70 hover:opacity-100 transition">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <span className="text-purple-400 font-bold text-lg">S</span>
              </div>
              <span className="text-xs text-slate-400">Stripe</span>
            </div>
            {/* E2B */}
            <div className="flex flex-col items-center gap-2 opacity-70 hover:opacity-100 transition">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <span className="text-blue-400 font-bold text-lg">E2B</span>
              </div>
              <span className="text-xs text-slate-400">E2B Sandbox</span>
            </div>
            {/* Upstash */}
            <div className="flex flex-col items-center gap-2 opacity-70 hover:opacity-100 transition">
              <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                <span className="text-red-400 font-bold text-lg">U</span>
              </div>
              <span className="text-xs text-slate-400">Upstash</span>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <div className="bg-black">
        <PricingSection />
      </div>

      {/* CTA Section */}
      <section className="bg-gradient-to-b from-black to-slate-900 py-16 sm:py-20">
        <div className="container mx-auto px-4 text-center">
          <div className="mx-auto max-w-3xl bg-gradient-to-br from-purple-900/50 to-blue-900/50 rounded-3xl p-8 sm:p-12 border border-purple-500/30">
            <h2 className="mb-4 text-3xl sm:text-4xl font-bold text-white">Ready to Build?</h2>
            <p className="mb-8 text-lg text-slate-300">
              Stop chatting. Start shipping. Your autonomous AI agent is waiting.
            </p>
            <Link
              href="/signup"
              className="inline-block rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 px-10 py-4 text-lg font-semibold text-white hover:shadow-xl hover:shadow-purple-500/25 transition-all duration-300"
            >
              Get Started Free
            </Link>
            <p className="mt-4 text-sm text-slate-500">No credit card required. Start building today.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black text-white py-12 border-t border-white/10">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            <div className="sm:col-span-2 md:col-span-1">
              <h3 className="mb-4 text-xl font-bold">JCIL.AI</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Autonomous AI agent built for people of faith. Real power, real values.
              </p>
            </div>

            <div>
              <h4 className="mb-4 font-semibold">Product</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>
                  <Link href="/code-lab" className="hover:text-fuchsia-400 transition">
                    Code Lab
                  </Link>
                </li>
                <li>
                  <Link href="/chat" className="hover:text-white transition">
                    Chat
                  </Link>
                </li>
                <li>
                  <Link href="#pricing" className="hover:text-white transition">
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link href="/api-info" className="hover:text-white transition">
                    API Access
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="mb-4 font-semibold">Developers</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>
                  <Link href="/docs" className="hover:text-white transition">
                    Documentation
                  </Link>
                </li>
                <li>
                  <Link href="/docs/code-lab" className="hover:text-white transition">
                    Code Lab Docs
                  </Link>
                </li>
                <li>
                  <Link href="/docs/api" className="hover:text-white transition">
                    API Reference
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="mb-4 font-semibold">Company</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>
                  <Link href="/about" className="hover:text-white transition">
                    About Us
                  </Link>
                </li>
                <li>
                  <Link href="/faq" className="hover:text-white transition">
                    FAQ
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="hover:text-white transition">
                    Contact Us
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="mb-4 font-semibold">Legal</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>
                  <Link href="/privacy" className="hover:text-white transition">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="hover:text-white transition">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link href="/cookies" className="hover:text-white transition">
                    Cookie Policy
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-12 border-t border-white/10 pt-8 text-center text-sm text-slate-500">
            <p>&copy; {new Date().getFullYear()} JCIL.AI. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
