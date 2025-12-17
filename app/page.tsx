/**
 * JCIL.AI LANDING PAGE
 *
 * PURPOSE:
 * - Public homepage for JCIL.AI
 * - Professional SaaS landing page
 * - Faith-based AI chat assistant
 * - Enterprise-grade security and compliance
 */

import Link from 'next/link';
import PricingSection from './components/PricingSection';
import LandingLogo from './components/LandingLogo';
import MobileMenu from './components/MobileMenu';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white">
      {/* Header - Glassmorphism */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 border-b border-slate-200/50">
        <div className="container mx-auto px-4 py-4">
          <nav className="flex items-center justify-between">
            <LandingLogo />

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-6">
              <Link href="#how-it-works" className="text-slate-600 hover:text-slate-900 font-medium transition">
                How It Works
              </Link>
              <Link href="#pricing" className="text-slate-600 hover:text-slate-900 font-medium transition">
                Pricing
              </Link>
              <Link href="/about" className="text-slate-600 hover:text-slate-900 font-medium transition">
                About
              </Link>
              <Link href="/faq" className="text-slate-600 hover:text-slate-900 font-medium transition">
                FAQ
              </Link>
            </div>

            {/* Desktop CTA Buttons */}
            <div className="hidden md:flex items-center space-x-4">
              <Link href="/login" className="px-4 py-2 text-slate-700 hover:text-slate-900 font-medium transition">
                Log In
              </Link>
              <Link
                href="/signup"
                className="rounded-xl bg-gradient-to-r from-blue-900 to-blue-700 px-6 py-2 text-white font-semibold hover:shadow-lg hover:shadow-blue-900/25 transition-all duration-300"
              >
                Sign Up
              </Link>
            </div>

            {/* Mobile Menu */}
            <MobileMenu />
          </nav>
        </div>
      </header>

      {/* Hero Section - Enhanced with Glassmorphism */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50/30 to-white py-20 sm:py-32">
        {/* Decorative Background Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-200/30 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-200/20 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-blue-100/20 to-purple-100/20 rounded-full blur-3xl" />
        </div>

        <div className="container mx-auto px-4 text-center relative">
          <div className="mx-auto max-w-4xl">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-100/80 backdrop-blur-sm border border-blue-200/50 mb-8">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
              </span>
              <span className="text-sm font-medium text-blue-800">AI Designed for Your Values</span>
            </div>

            <h1 className="mb-6 text-4xl sm:text-5xl md:text-6xl font-bold leading-tight tracking-tight text-slate-900">
              AI-Powered Tools
              <br />
              <span className="bg-gradient-to-r from-blue-800 to-blue-600 bg-clip-text text-transparent">Built for People of Faith</span>
            </h1>
            <p className="mx-auto mb-10 max-w-2xl text-lg sm:text-xl text-slate-600 leading-relaxed">
              Intelligent assistance that respects your values. Get answers, conduct research,
              and create content with an AI designed to serve your needs without compromising your beliefs.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/signup"
                className="w-full sm:w-auto rounded-xl bg-gradient-to-r from-blue-900 to-blue-700 px-8 py-4 text-lg font-semibold text-white hover:shadow-xl hover:shadow-blue-900/25 transition-all duration-300 hover:-translate-y-0.5"
              >
                Get Started Free
              </Link>
              <Link
                href="#how-it-works"
                className="w-full sm:w-auto rounded-xl border-2 border-slate-200 bg-white/50 backdrop-blur-sm px-8 py-4 text-lg font-semibold text-slate-700 hover:bg-white hover:border-slate-300 hover:shadow-lg transition-all duration-300"
              >
                Learn More
              </Link>
            </div>

            {/* Social Proof */}
            <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-sm text-slate-500">
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 border-2 border-white flex items-center justify-center text-white text-xs font-bold">J</div>
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 border-2 border-white flex items-center justify-center text-white text-xs font-bold">M</div>
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-green-600 border-2 border-white flex items-center justify-center text-white text-xs font-bold">S</div>
                </div>
                <span>Trusted by thousands</span>
              </div>
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-4 h-4 text-yellow-400 fill-current" viewBox="0 0 20 20">
                    <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                  </svg>
                ))}
                <span className="ml-1">4.9/5 rating</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Badges */}
      <section className="bg-white py-8 border-y border-slate-200">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap items-center justify-center gap-8 text-slate-500 text-sm">
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span>Enterprise-Grade Security</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>100% American Servers</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>End-to-End Encryption</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <span>Faith-Based Values</span>
            </div>
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="bg-white py-16 sm:py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="mb-6 text-3xl sm:text-4xl font-bold text-slate-900">Why JCIL.AI Exists</h2>
            <p className="text-lg sm:text-xl text-slate-600 leading-relaxed mb-8">
              The most powerful AI tools are built in Silicon Valley, often reflecting values that
              do not align with millions of Americans who hold traditional, faith-based beliefs.
              As AI becomes more influential in how we learn, work, and communicate, people of
              faith deserve tools that respect and reinforce their values.
            </p>
            <p className="text-lg sm:text-xl text-slate-600 leading-relaxed">
              JCIL.AI is built on world-class AI infrastructure, wrapped in a protective layer
              designed to serve people of faith. We believe AI should empower you, not replace
              your thinking, compromise your values, or expose you to content that conflicts
              with your beliefs.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="bg-slate-50 py-16 sm:py-20">
        <div className="container mx-auto px-4">
          <h2 className="mb-4 text-center text-3xl sm:text-4xl font-bold text-slate-900">Our Approach</h2>
          <p className="mb-12 text-center text-slate-600 max-w-2xl mx-auto">
            We built JCIL.AI with a clear philosophy: AI should assist and empower, never replace or undermine.
          </p>
          <div className="grid gap-6 md:gap-8 md:grid-cols-3 max-w-6xl mx-auto">
            <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-200">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                <svg className="h-6 w-6 text-blue-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <h3 className="mb-3 text-xl sm:text-2xl font-semibold text-slate-900">AI That Assists, Not Replaces</h3>
              <p className="text-slate-600 leading-relaxed">
                We help pastors outline sermons, but believe sermons should be Spirit-led.
                We help students study and identify weaknesses, but will not write their papers.
                Human development and growth matter.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-200">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                <svg className="h-6 w-6 text-blue-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="mb-3 text-xl sm:text-2xl font-semibold text-slate-900">Values-Aligned Guardrails</h3>
              <p className="text-slate-600 leading-relaxed">
                Built-in content moderation ensures a safe environment for you and your family.
                No adult content. No profane language. Clear community guidelines that reflect
                the values you hold.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-200">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                <svg className="h-6 w-6 text-blue-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h3 className="mb-3 text-xl sm:text-2xl font-semibold text-slate-900">Scripture-Informed Foundation</h3>
              <p className="text-slate-600 leading-relaxed">
                We believe Scripture is the written Word of God. Use JCIL.AI as a study aid,
                develop Bible studies, explore theological questions, and deepen your faith
                with an assistant that shares your reverence.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Watchmen on the Digital Walls - Technical Architecture */}
      <section className="relative bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 py-20 sm:py-28 overflow-hidden">
        {/* Dramatic Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-r from-blue-500/5 to-purple-500/5 rounded-full blur-3xl" />
          {/* Grid pattern overlay */}
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAgTSAwIDIwIEwgNDAgMjAgTSAyMCAwIEwgMjAgNDAgTSAwIDMwIEwgNDAgMzAgTSAzMCAwIEwgMzAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-40" />
        </div>

        <div className="container mx-auto px-4 relative">
          {/* Section Header */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 mb-6">
              <span className="text-amber-400 text-lg">⚔️</span>
              <span className="text-sm font-medium text-amber-400">Standing Guard in the Digital Age</span>
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-6">
              Watchmen on the Digital Walls
            </h2>
            <p className="text-lg sm:text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed">
              In an age where AI shapes how we think, learn, and believe, JCIL.AI stands as a guardian.
              We do not merely filter content. We architect a fortress of faith around every conversation.
            </p>
          </div>

          {/* The 5-Layer Codex Architecture */}
          <div className="max-w-5xl mx-auto mb-20">
            <h3 className="text-center text-2xl font-bold text-white mb-4">The 5-Layer Codex</h3>
            <p className="text-center text-slate-400 mb-10 max-w-2xl mx-auto">
              Every message passes through our proprietary protection system, a digital fortress designed to guard your soul.
            </p>

            {/* Architecture Visualization */}
            <div className="relative">
              {/* Connection Lines (visible on md+) */}
              <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-blue-500/0 via-blue-500/50 to-blue-500/0" />

              <div className="space-y-4 md:space-y-0 md:grid md:grid-rows-5 md:gap-4">
                {/* Layer 1: Content Moderation */}
                <div className="group relative">
                  <div className="md:grid md:grid-cols-2 md:gap-8 items-center">
                    <div className="md:text-right order-1 md:pr-12">
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-red-500/20 border border-red-500/30 mb-3 md:mb-0 md:absolute md:left-1/2 md:-translate-x-1/2 md:top-1/2 md:-translate-y-1/2 z-10">
                        <span className="text-red-400 font-bold">1</span>
                      </div>
                      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50 hover:border-red-500/30 transition-colors">
                        <h4 className="text-lg font-semibold text-white mb-2 flex items-center md:justify-end gap-2">
                          <span>🛡️</span> Content Moderation Gateway
                        </h4>
                        <p className="text-slate-400 text-sm">
                          Enterprise-grade AI moderation intercepts harmful content before it enters our system.
                          Protects against explicit material, hate speech, and manipulation attempts.
                        </p>
                      </div>
                    </div>
                    <div className="hidden md:block order-2" />
                  </div>
                </div>

                {/* Layer 2: The Codex System Prompt */}
                <div className="group relative">
                  <div className="md:grid md:grid-cols-2 md:gap-8 items-center">
                    <div className="hidden md:block order-1" />
                    <div className="order-2 md:pl-12">
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/30 mb-3 md:mb-0 md:absolute md:left-1/2 md:-translate-x-1/2 md:top-1/2 md:-translate-y-1/2 z-10">
                        <span className="text-amber-400 font-bold">2</span>
                      </div>
                      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50 hover:border-amber-500/30 transition-colors">
                        <h4 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                          <span>📜</span> The Codex (System Prompt)
                        </h4>
                        <p className="text-slate-400 text-sm">
                          Our theological framework: 50 core Christian beliefs, 100 apologetic defenses,
                          pastoral care protocols, and evangelism methods. The framework that draws the line.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Layer 3: AI Processing */}
                <div className="group relative">
                  <div className="md:grid md:grid-cols-2 md:gap-8 items-center">
                    <div className="md:text-right order-1 md:pr-12">
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-500/20 border border-blue-500/30 mb-3 md:mb-0 md:absolute md:left-1/2 md:-translate-x-1/2 md:top-1/2 md:-translate-y-1/2 z-10">
                        <span className="text-blue-400 font-bold">3</span>
                      </div>
                      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50 hover:border-blue-500/30 transition-colors">
                        <h4 className="text-lg font-semibold text-white mb-2 flex items-center md:justify-end gap-2">
                          <span>🧠</span> AI Processing Core
                        </h4>
                        <p className="text-slate-400 text-sm">
                          World-class AI models from leading providers process your request within
                          the theological boundaries we&apos;ve established. Multiple providers, one mission.
                        </p>
                      </div>
                    </div>
                    <div className="hidden md:block order-2" />
                  </div>
                </div>

                {/* Layer 4: Response Validation */}
                <div className="group relative">
                  <div className="md:grid md:grid-cols-2 md:gap-8 items-center">
                    <div className="hidden md:block order-1" />
                    <div className="order-2 md:pl-12">
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-green-500/20 border border-green-500/30 mb-3 md:mb-0 md:absolute md:left-1/2 md:-translate-x-1/2 md:top-1/2 md:-translate-y-1/2 z-10">
                        <span className="text-green-400 font-bold">4</span>
                      </div>
                      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50 hover:border-green-500/30 transition-colors">
                        <h4 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                          <span>✅</span> Response Validation
                        </h4>
                        <p className="text-slate-400 text-sm">
                          Every AI response is verified for theological accuracy and appropriateness
                          before delivery. Double-checking our own work, every single time.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Layer 5: Secure Delivery */}
                <div className="group relative">
                  <div className="md:grid md:grid-cols-2 md:gap-8 items-center">
                    <div className="md:text-right order-1 md:pr-12">
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-purple-500/20 border border-purple-500/30 mb-3 md:mb-0 md:absolute md:left-1/2 md:-translate-x-1/2 md:top-1/2 md:-translate-y-1/2 z-10">
                        <span className="text-purple-400 font-bold">5</span>
                      </div>
                      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50 hover:border-purple-500/30 transition-colors">
                        <h4 className="text-lg font-semibold text-white mb-2 flex items-center md:justify-end gap-2">
                          <span>🔐</span> Encrypted Delivery
                        </h4>
                        <p className="text-slate-400 text-sm">
                          AES-256 encryption ensures your conversation remains private.
                          Your faith journey is between you, God, and JCIL.AI. No one else.
                        </p>
                      </div>
                    </div>
                    <div className="hidden md:block order-2" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Why We're Different Comparison */}
          <div className="max-w-5xl mx-auto">
            <h3 className="text-center text-2xl font-bold text-white mb-4">Why We&apos;re Different</h3>
            <p className="text-center text-slate-400 mb-10 max-w-2xl mx-auto">
              This is not just another AI wrapper. It is cyber security for the soul.
            </p>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Other AI */}
              <div className="bg-slate-800/30 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-full bg-slate-600/50 flex items-center justify-center">
                    <span className="text-slate-400">🤖</span>
                  </div>
                  <h4 className="text-lg font-semibold text-slate-400">Typical AI Platforms</h4>
                </div>
                <ul className="space-y-4">
                  {[
                    'Values determined by Silicon Valley',
                    'No theological framework or foundation',
                    'May undermine traditional beliefs',
                    'Data sold to advertisers',
                    'No protection for children',
                    'Answers drift with cultural trends',
                    'Just a chatbot with no mission',
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-slate-400 text-sm">
                      <span className="text-red-400 mt-0.5">✕</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* JCIL.AI */}
              <div className="bg-gradient-to-br from-blue-900/40 to-purple-900/40 backdrop-blur-sm rounded-2xl p-6 border border-blue-500/30 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl" />
                <div className="relative">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-full bg-blue-500/30 flex items-center justify-center">
                      <span className="text-blue-300">✝️</span>
                    </div>
                    <h4 className="text-lg font-semibold text-white">JCIL.AI</h4>
                  </div>
                  <ul className="space-y-4">
                    {[
                      'Built on Biblical truth and Christian values',
                      '50 core beliefs + 100 apologetic defenses',
                      'Strengthens and defends the faith',
                      'We never sell your data. Ever.',
                      'Family-safe by design',
                      'Anchored to eternal, unchanging truth',
                      'Mission: strengthen the brethren, reach the lost',
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-3 text-slate-200 text-sm">
                        <span className="text-green-400 mt-0.5">✓</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Mission Statement */}
            <div className="mt-12 text-center">
              <blockquote className="text-lg sm:text-xl font-light text-slate-300 italic max-w-4xl mx-auto leading-relaxed">
                &quot;AI is not God, it is a tool for efficiency and productivity, and it does not replace the pastor or the teacher.
                While the world chases infinitely expanding knowledge and wealth, we aim to strengthen the brethren and comfort
                the brokenhearted through the teachings of our Lord Jesus. We point to the scriptures and speak the truth that
                Jesus Christ of Nazareth is the King of Kings and the Lord of Lords, unapologetically. We hold the line. Christians
                are programmers too and our community is at risk. We will not sit idle seeing the incoming challenges ahead.
                As digital Watchmen, we will forge a path for our people and stand firm in our beliefs.&quot;
              </blockquote>
              <p className="mt-4 text-slate-500">- The JCIL.AI Mission</p>
            </div>
          </div>
        </div>
      </section>

      {/* Enterprise Security Section */}
      <section className="bg-blue-900 py-16 sm:py-20 text-white">
        <div className="container mx-auto px-4">
          <h2 className="mb-4 text-center text-3xl sm:text-4xl font-bold">Enterprise-Grade Security</h2>
          <p className="mb-12 text-center text-blue-200 max-w-2xl mx-auto">
            Built with the same security standards trusted by Fortune 500 companies.
          </p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto">
            <div className="bg-white/10 backdrop-blur rounded-2xl p-6 border border-white/20">
              <div className="mb-4 text-3xl">🇺🇸</div>
              <h3 className="mb-2 text-lg font-semibold">American Data Centers</h3>
              <p className="text-sm text-blue-200">
                All data processed and stored exclusively on American servers. Your information never leaves US soil.
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur rounded-2xl p-6 border border-white/20">
              <div className="mb-4 text-3xl">🔒</div>
              <h3 className="mb-2 text-lg font-semibold">End-to-End Encryption</h3>
              <p className="text-sm text-blue-200">
                Your conversations are encrypted in transit and at rest using industry-standard AES-256 encryption.
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur rounded-2xl p-6 border border-white/20">
              <div className="mb-4 text-3xl">🛡️</div>
              <h3 className="mb-2 text-lg font-semibold">Multi-Layer Moderation</h3>
              <p className="text-sm text-blue-200">
                Enterprise-grade content moderation filters inappropriate content before it ever reaches you or your family.
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur rounded-2xl p-6 border border-white/20">
              <div className="mb-4 text-3xl">🗑️</div>
              <h3 className="mb-2 text-lg font-semibold">Auto-Delete Policy</h3>
              <p className="text-sm text-blue-200">
                Conversations automatically deleted after 6 months. We do not sell your data or use it for advertising.
              </p>
            </div>
          </div>

          {/* Compliance Badges */}
          <div className="mt-12 text-center">
            <p className="text-blue-200 text-sm mb-4">Committed to Industry Best Practices</p>
            <div className="flex flex-wrap items-center justify-center gap-6 text-white/80 text-sm">
              <span className="px-4 py-2 rounded-full bg-white/10 border border-white/20">Enterprise Security Standards</span>
              <span className="px-4 py-2 rounded-full bg-white/10 border border-white/20">Privacy-First Design</span>
              <span className="px-4 py-2 rounded-full bg-white/10 border border-white/20">California Privacy Act Ready</span>
              <span className="px-4 py-2 rounded-full bg-white/10 border border-white/20">99.9% Uptime SLA</span>
            </div>
          </div>
        </div>
      </section>

      {/* Tools Section */}
      <section className="relative bg-gradient-to-b from-white to-slate-50 py-16 sm:py-20 overflow-hidden">
        {/* Decorative Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 right-10 w-64 h-64 bg-blue-100/30 rounded-full blur-3xl" />
          <div className="absolute bottom-20 left-10 w-64 h-64 bg-purple-100/20 rounded-full blur-3xl" />
        </div>

        <div className="container mx-auto px-4 relative">
          <h2 className="mb-4 text-center text-3xl sm:text-4xl font-bold text-slate-900">Powerful Tools at Your Fingertips</h2>
          <p className="mb-12 text-center text-slate-600 max-w-2xl mx-auto">
            Everything you need to research, write, study, and create.
          </p>
          <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
            {[
              { icon: '💬', title: 'AI Chat', desc: 'Intelligent conversation for any topic' },
              { icon: '🔍', title: 'Real-Time Search', desc: 'Live web search with source citations' },
              { icon: '📰', title: 'Breaking News', desc: 'Curated news updated every 30 minutes' },
              { icon: '📖', title: 'Bible Study', desc: 'Scripture exploration and study aids' },
              { icon: '✍️', title: 'Writing Tools', desc: 'Essays, emails, and content creation' },
              { icon: '📄', title: 'Resume Builder', desc: 'Professional resumes and cover letters' },
              { icon: '📊', title: 'Data Analysis', desc: 'Upload and analyze spreadsheets' },
              { icon: '💻', title: 'Code Assistant', desc: 'Programming help and debugging' },
              { icon: '🙏', title: 'Daily Devotional', desc: 'Fresh spiritual content every day' },
            ].map((tool, index) => (
              <div
                key={index}
                className="group flex items-start gap-4 rounded-2xl bg-white/70 backdrop-blur-sm p-5 border border-slate-200/80 shadow-sm hover:shadow-lg hover:bg-white hover:-translate-y-1 transition-all duration-300"
              >
                <div className="text-2xl group-hover:scale-110 transition-transform duration-300">{tool.icon}</div>
                <div>
                  <h3 className="font-semibold mb-1 text-slate-900">{tool.title}</h3>
                  <p className="text-sm text-slate-600">{tool.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What's Coming Section */}
      <section className="bg-slate-50 py-16 sm:py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <span className="inline-block px-4 py-1.5 rounded-full bg-blue-100 text-blue-800 text-sm font-medium mb-4">
              Coming Early 2026
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-slate-900">Protecting Our Community&apos;s Future</h2>
            <p className="text-slate-600 max-w-2xl mx-auto">
              We&apos;re building technology that ensures our faith community has access to AI that can never be
              censored, shut down, or used against our values. True digital independence is coming.
            </p>
          </div>

          {/* Main Products */}
          <div className="grid gap-6 md:grid-cols-2 max-w-5xl mx-auto mb-8">
            {/* Isolate */}
            <div className="bg-white rounded-2xl p-6 sm:p-8 relative overflow-hidden shadow-sm border border-slate-200">
              <div className="absolute top-4 right-4">
                <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                  January 2026
                </span>
              </div>
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-purple-100">
                <svg className="h-7 w-7 text-purple-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold mb-2 text-slate-900">JCIL.AI Isolate</h3>
              <p className="text-blue-800 text-sm font-medium mb-3">Offline Privacy Model</p>
              <p className="text-slate-600 leading-relaxed mb-4">
                A lightweight AI model that runs entirely on your device. Your queries never leave your phone
                or computer. Works without internet - if the power goes out and you have a backup battery,
                you still have AI. Complete privacy, absolute reliability.
              </p>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  100% offline - no internet required
                </li>
                <li className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Data never leaves your device
                </li>
                <li className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Faith-aligned moderation built in
                </li>
              </ul>
            </div>

            {/* Slingshot 3.0 */}
            <div className="bg-white rounded-2xl p-6 sm:p-8 relative overflow-hidden shadow-sm border border-slate-200">
              <div className="absolute top-4 right-4">
                <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
                  February 2026
                </span>
              </div>
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
                <svg className="h-7 w-7 text-amber-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold mb-2 text-slate-900">Slingshot 3.0</h3>
              <p className="text-blue-800 text-sm font-medium mb-3">Independent AI - No Killswitch</p>
              <p className="text-slate-600 leading-relaxed mb-4">
                Our own standalone AI model, built from the ground up. Complete independence from third-party
                providers means no one can censor, restrict, or shut down our service. Religious freedom
                that can never be switched off.
              </p>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Zero third-party dependencies
                </li>
                <li className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Can never be censored or shut down
                </li>
                <li className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Built for Christians worldwide
                </li>
              </ul>
            </div>
          </div>

          {/* In Development */}
          <div className="max-w-5xl mx-auto">
            <h3 className="text-center text-lg font-semibold text-slate-500 mb-6">Also In Development</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Education Program */}
              <div className="flex items-start gap-4 rounded-xl bg-white p-5 shadow-sm border border-slate-200">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                  <svg className="h-6 w-6 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <div>
                  <h4 className="font-semibold mb-1 text-slate-900">Education Program</h4>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Open source curriculum with AI tutoring for grades 1 through Bachelor&apos;s level.
                    Safe learning environment for homeschoolers, supplemental tutoring, and students
                    without educational access worldwide. Learning that never stops.
                  </p>
                </div>
              </div>

              {/* Safe Gameplay */}
              <div className="flex items-start gap-4 rounded-xl bg-white p-5 shadow-sm border border-slate-200">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-pink-100">
                  <svg className="h-6 w-6 text-pink-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h4 className="font-semibold mb-1 text-slate-900">Safe Gameplay</h4>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Isolated gaming environments that protect players from outside cyber risks.
                    Popular games rebuilt with security and safety in mind for kids, teens, and families.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <PricingSection />

      {/* CTA Section */}
      <section className="bg-slate-50 py-16 sm:py-20">
        <div className="container mx-auto px-4 text-center">
          <div className="mx-auto max-w-3xl bg-white rounded-3xl p-8 sm:p-12 shadow-lg border border-slate-200">
            <h2 className="mb-4 text-3xl sm:text-4xl font-bold text-slate-900">Ready to Get Started?</h2>
            <p className="mb-8 text-lg text-slate-600">
              Join thousands of people of faith who trust JCIL.AI for intelligent, values-aligned assistance.
            </p>
            <Link
              href="/signup"
              className="inline-block rounded-lg bg-blue-900 px-8 py-4 text-lg font-semibold text-white hover:bg-blue-800 transition shadow-lg"
            >
              Create Your Account
            </Link>
            <p className="mt-4 text-sm text-slate-500">Start with any plan. Cancel anytime.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-4">
            <div className="sm:col-span-2 md:col-span-1">
              <h3 className="mb-4 text-xl font-bold">JCIL.AI</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                AI-powered tools built for people of faith. Intelligent assistance that respects your values.
              </p>
            </div>

            <div>
              <h4 className="mb-4 font-semibold">Product</h4>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>
                  <Link href="#how-it-works" className="hover:text-white transition">
                    How It Works
                  </Link>
                </li>
                <li>
                  <Link href="#pricing" className="hover:text-white transition">
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link href="/chat" className="hover:text-white transition">
                    Chat
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
                  <a href="mailto:info@jcil.ai" className="hover:text-white transition">
                    info@jcil.ai
                  </a>
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

          <div className="mt-12 border-t border-slate-800 pt-8 text-center text-sm text-slate-500">
            <p>&copy; {new Date().getFullYear()} JCIL.AI. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
