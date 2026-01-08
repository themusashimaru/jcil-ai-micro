/**
 * JCIL.AI HOMEPAGE
 *
 * Professional landing page inspired by tier-one AI companies
 * Clean design, comprehensive information, fully responsive
 */

import Link from 'next/link';
import LandingHeader from './components/landing/LandingHeader';
import LandingFooter from './components/landing/LandingFooter';
import Section, { SectionHeader } from './components/landing/Section';
import FeatureCard from './components/landing/FeatureCard';
import PricingSection from './components/PricingSection';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <LandingHeader transparent />

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 -right-32 w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-1/4 -left-32 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[120px]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-fuchsia-600/5 rounded-full blur-[150px]" />
        </div>

        {/* Grid Pattern Overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,black_40%,transparent_100%)]" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-32 pb-20 lg:pt-40 lg:pb-32">
          <div className="text-center">
            {/* Partnership Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 mb-8">
              <div className="w-5 h-5 rounded bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                <span className="text-white text-xs font-bold">A</span>
              </div>
              <span className="text-sm font-medium text-amber-200/90">
                Exclusively powered by Anthropic Claude
              </span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
              <span className="text-white">Enterprise AI that</span>
              <br />
              <span className="bg-gradient-to-r from-purple-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">
                ships production code
              </span>
            </h1>

            {/* Subheadline */}
            <p className="mx-auto max-w-2xl text-lg sm:text-xl text-slate-400 leading-relaxed mb-8">
              Two products, one platform. Chat for everyday AI assistance. Code Lab for autonomous
              development with 30+ tools, sandboxed execution, and GitHub integration.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
              <Link
                href="/signup"
                className="w-full sm:w-auto rounded-lg bg-white px-8 py-4 text-base font-semibold text-black hover:bg-slate-100 transition-all shadow-lg shadow-white/10"
              >
                Start building free
              </Link>
              <Link
                href="/code-lab/about"
                className="w-full sm:w-auto rounded-lg border border-white/20 bg-white/5 backdrop-blur-sm px-8 py-4 text-base font-semibold text-white hover:bg-white/10 hover:border-white/30 transition-all"
              >
                Explore Code Lab
              </Link>
            </div>

            {/* Trust Indicators */}
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-sm text-slate-500">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>SOC 2 Type II Ready</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>721 Tests</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>100% TypeScript</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>Zero Vulnerabilities</span>
              </div>
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

      {/* Products Section */}
      <Section id="products" background="gradient" padding="lg">
        <SectionHeader
          badge="Our Products"
          badgeColor="purple"
          title="Two ways to work with Claude"
          description="Whether you need everyday AI assistance or full autonomous development capabilities, we have you covered."
        />

        <div className="grid gap-8 lg:grid-cols-2 max-w-5xl mx-auto">
          {/* Chat Product */}
          <div className="group relative bg-gradient-to-br from-blue-950/80 to-blue-950/40 rounded-3xl p-8 lg:p-10 border border-blue-500/20 hover:border-blue-500/40 transition-all duration-500">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 to-transparent rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-2xl bg-blue-500/20 flex items-center justify-center">
                  <svg
                    className="w-7 h-7 text-blue-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white">Chat</h3>
                  <p className="text-blue-300 text-sm">For everyone</p>
                </div>
              </div>

              <p className="text-slate-300 mb-8 text-base leading-relaxed">
                Claude&apos;s intelligence with Biblical grounding. Get thoughtful answers, research
                assistance, and creative help—all aligned with Scripture.
              </p>

              <div className="space-y-3 mb-8">
                {[
                  'Claude Sonnet 4.5 model',
                  'Web search & fact checking',
                  'Research agent with citations',
                  'Image generation',
                  'Document analysis',
                ].map((feature, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm text-slate-300">
                    <svg
                      className="w-5 h-5 text-blue-400 shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    {feature}
                  </div>
                ))}
              </div>

              <Link
                href="/chat"
                className="inline-flex items-center justify-center w-full rounded-xl bg-blue-600 hover:bg-blue-500 px-6 py-3.5 text-white font-semibold transition-all"
              >
                Start Chatting
                <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </Link>
            </div>
          </div>

          {/* Code Lab Product */}
          <div className="group relative bg-gradient-to-br from-fuchsia-950/80 to-fuchsia-950/40 rounded-3xl p-8 lg:p-10 border border-fuchsia-500/20 hover:border-fuchsia-500/40 transition-all duration-500">
            <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-600/5 to-transparent rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity" />

            {/* Popular Badge */}
            <div className="absolute -top-3 right-8">
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-fuchsia-500 text-xs font-semibold text-white">
                Claude Code Alternative
              </span>
            </div>

            <div className="relative">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-2xl bg-fuchsia-500/20 flex items-center justify-center">
                  <svg
                    className="w-7 h-7 text-fuchsia-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white">Code Lab</h3>
                  <p className="text-fuchsia-300 text-sm">For developers</p>
                </div>
              </div>

              <p className="text-slate-300 mb-8 text-base leading-relaxed">
                Full autonomous development environment in your browser. 30+ tools, sandboxed
                execution, and direct GitHub integration.
              </p>

              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-fuchsia-500/10 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-fuchsia-300">30+</div>
                  <div className="text-xs text-slate-400">Dev Tools</div>
                </div>
                <div className="bg-fuchsia-500/10 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-fuchsia-300">90%</div>
                  <div className="text-xs text-slate-400">Claude Code Parity</div>
                </div>
              </div>

              <div className="space-y-3 mb-8">
                {[
                  'Claude Opus 4.5 model',
                  'E2B sandboxed execution',
                  'Planning mode for complex tasks',
                  'MCP server integration',
                  'Persistent workspaces',
                ].map((feature, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm text-slate-300">
                    <svg
                      className="w-5 h-5 text-fuchsia-400 shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    {feature}
                  </div>
                ))}
              </div>

              <Link
                href="/code-lab/about"
                className="inline-flex items-center justify-center w-full rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 px-6 py-3.5 text-white font-semibold transition-all"
              >
                Explore Code Lab
                <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </Section>

      {/* Capabilities Section */}
      <Section id="capabilities" padding="lg">
        <SectionHeader
          badge="Capabilities"
          badgeColor="blue"
          title="Built for serious work"
          description="Enterprise-grade features that set us apart from basic chat interfaces."
        />

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <FeatureCard
            emoji="🧬"
            title="Agentic AI"
            description="Autonomous task execution with plan-execute-observe loops. The AI doesn't just respond—it acts."
            variant="gradient"
            color="purple"
          />
          <FeatureCard
            emoji="🔌"
            title="MCP Native"
            description="Connect to any tool through Model Context Protocol. Databases, browsers, APIs—all accessible."
            variant="gradient"
            color="blue"
          />
          <FeatureCard
            emoji="🔄"
            title="Self-Correcting"
            description="Automatic error detection and retry with intelligent analysis. Broken builds get fixed automatically."
            variant="gradient"
            color="pink"
          />
          <FeatureCard
            emoji="🧠"
            title="Persistent Memory"
            description="Context that survives sessions. The AI remembers your codebase, preferences, and project history."
            variant="gradient"
            color="amber"
          />
        </div>
      </Section>

      {/* How It Works Section */}
      <Section background="muted" padding="lg" className="border-y border-white/5">
        <SectionHeader
          badge="How it works"
          badgeColor="green"
          title="From idea to production in minutes"
          description="Simple workflow. Powerful results. No complex setup required."
        />

        <div className="max-w-4xl mx-auto">
          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                step: '01',
                title: 'Describe',
                description:
                  'Tell the AI what you need in plain English. No special syntax or commands required.',
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                ),
              },
              {
                step: '02',
                title: 'Execute',
                description:
                  'The agent plans, writes code, runs tests, and fixes errors automatically in a secure sandbox.',
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                ),
              },
              {
                step: '03',
                title: 'Ship',
                description:
                  'Get working code pushed to GitHub, ready to deploy. Your CI/CD takes it from there.',
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                    />
                  </svg>
                ),
              },
            ].map((item) => (
              <div key={item.step} className="relative">
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/30 flex items-center justify-center mb-6">
                    <span className="text-purple-400">{item.icon}</span>
                  </div>
                  <span className="text-xs font-bold text-purple-400 mb-2">{item.step}</span>
                  <h3 className="text-xl font-semibold text-white mb-3">{item.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* Security Section */}
      <Section padding="lg">
        <SectionHeader
          badge="Enterprise Security"
          badgeColor="green"
          title="Your data, protected"
          description="Fortune 500-grade security infrastructure. SOC 2 Type II compliant with zero compromises."
        />

        {/* Compliance Badges */}
        <div className="flex flex-wrap justify-center gap-3 mb-12">
          {[
            { label: 'SOC 2 Type II', color: 'green' },
            { label: 'GDPR Compliant', color: 'blue' },
            { label: 'CCPA Compliant', color: 'purple' },
            { label: 'Anthropic Exclusive', color: 'amber' },
          ].map((badge) => (
            <span
              key={badge.label}
              className={`px-4 py-2 rounded-full bg-${badge.color}-500/10 border border-${badge.color}-500/30 text-sm font-medium text-${badge.color}-300`}
            >
              {badge.label}
            </span>
          ))}
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <FeatureCard
            emoji="🇺🇸"
            title="US Data Centers"
            description="All data stored on American servers. No foreign data transfer."
            variant="outlined"
            color="blue"
          />
          <FeatureCard
            emoji="🔐"
            title="E2E Encryption"
            description="AES-256 encryption at rest. TLS 1.3 in transit. Zero-access architecture."
            variant="outlined"
            color="green"
          />
          <FeatureCard
            emoji="🛡️"
            title="AI Safety"
            description="Anthropic's Constitutional AI with industry-leading safety measures."
            variant="outlined"
            color="purple"
          />
          <FeatureCard
            emoji="📋"
            title="Full Audit Trail"
            description="Complete logging with correlation IDs. Data export available on request."
            variant="outlined"
            color="amber"
          />
        </div>
      </Section>

      {/* Tech Stack Section */}
      <Section background="muted" padding="md" className="border-y border-white/5">
        <p className="text-center text-sm text-slate-500 mb-8">
          Powered by industry-leading technology
        </p>
        <div className="flex flex-wrap justify-center items-center gap-8 lg:gap-16">
          {[
            { name: 'Anthropic', letter: 'A', color: 'orange' },
            { name: 'Vercel', letter: '▲', color: 'white' },
            { name: 'Supabase', letter: 'S', color: 'green' },
            { name: 'Stripe', letter: 'S', color: 'purple' },
            { name: 'E2B', letter: 'E', color: 'blue' },
            { name: 'Upstash', letter: 'U', color: 'red' },
          ].map((tech) => (
            <div
              key={tech.name}
              className="flex flex-col items-center gap-2 opacity-60 hover:opacity-100 transition"
            >
              <div
                className={`w-12 h-12 rounded-xl bg-${tech.color}-500/10 flex items-center justify-center`}
              >
                <span className={`text-${tech.color}-400 font-bold text-lg`}>{tech.letter}</span>
              </div>
              <span className="text-xs text-slate-400">{tech.name}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* Pricing Section */}
      <div id="pricing" className="bg-black">
        <PricingSection />
      </div>

      {/* Final CTA */}
      <Section padding="xl">
        <div className="relative mx-auto max-w-4xl">
          {/* Background Glow */}
          <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 via-fuchsia-600/20 to-blue-600/20 rounded-3xl blur-xl" />

          <div className="relative bg-gradient-to-br from-slate-900 to-slate-950 rounded-3xl p-8 lg:p-16 border border-white/10 text-center">
            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">
              Ready to build with AI?
            </h2>
            <p className="text-lg text-slate-400 mb-8 max-w-xl mx-auto">
              Join developers shipping production code faster than ever. Start free, scale as you
              grow.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/signup"
                className="w-full sm:w-auto rounded-xl bg-white px-10 py-4 text-base font-semibold text-black hover:bg-slate-100 transition-all"
              >
                Get Started Free
              </Link>
              <Link
                href="/contact"
                className="w-full sm:w-auto rounded-xl border border-white/20 bg-white/5 px-10 py-4 text-base font-semibold text-white hover:bg-white/10 transition-all"
              >
                Contact Sales
              </Link>
            </div>
            <p className="mt-6 text-sm text-slate-500">
              No credit card required. Start building in minutes.
            </p>
          </div>
        </div>
      </Section>

      <LandingFooter />
    </main>
  );
}
