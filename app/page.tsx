/**
 * JCIL.AI HOMEPAGE
 *
 * Faith-first enterprise AI platform
 * The first AI chat ensuring Biblical truth at the forefront
 * Built for Christian developers, pastors, and ministries
 */

import Link from 'next/link';
import LandingHeader from './components/landing/LandingHeader';
import LandingFooter from './components/landing/LandingFooter';
import Section, { SectionHeader } from './components/landing/Section';
import FeatureCard from './components/landing/FeatureCard';
import Testimonials from './components/landing/Testimonials';
import UseCases from './components/landing/UseCases';
import EmailCapture from './components/landing/EmailCapture';
import LogoCarousel from './components/landing/LogoCarousel';
import PricingSection from './components/PricingSection';
import {
  BibleIcon,
  ShieldIcon,
  BrainIcon,
  CodeIcon,
  ChatIcon,
  CrossIcon,
  AgentIcon,
  PlugIcon,
  RefreshIcon,
  LockIcon,
  GlobeIcon,
  DocumentIcon,
} from './components/landing/Icons';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <LandingHeader transparent />

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Cross-shaped light beam */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[2px] h-[600px] bg-gradient-to-b from-transparent via-amber-500/20 to-transparent" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[2px] bg-gradient-to-r from-transparent via-amber-500/20 to-transparent" />

          {/* Ambient glows */}
          <div className="absolute top-1/4 -right-32 w-[600px] h-[600px] bg-amber-600/10 rounded-full blur-[120px]" />
          <div className="absolute bottom-1/4 -left-32 w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[120px]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-amber-500/5 rounded-full blur-[150px]" />
        </div>

        {/* Grid Pattern Overlay */}
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
              The first enterprise-grade AI platform built for Christians. Claude&apos;s
              intelligence, grounded in Scripture. For pastors, developers, and ministries who
              refuse to compromise.
            </p>

            {/* Scripture Reference */}
            <p className="text-amber-500/80 text-sm italic mb-8">
              &ldquo;All Scripture is God-breathed and is useful for teaching, rebuking, correcting
              and training in righteousness.&rdquo;
              <span className="not-italic ml-2 text-amber-400/60">— 2 Timothy 3:16</span>
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
                <span>Powered by Anthropic Claude</span>
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
                <span>2,500+ Active Users</span>
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

      {/* Logo Carousel - Tech Partners */}
      <Section background="muted" padding="md" className="border-y border-white/5">
        <LogoCarousel
          variant="tech"
          title="Powered by industry-leading technology"
          speed="normal"
        />
      </Section>

      {/* Why JCIL Section */}
      <Section id="why-jcil" padding="lg">
        <SectionHeader
          badge="Why JCIL"
          badgeColor="amber"
          title="AI that honors God"
          description="Other AI platforms prioritize neutrality. We prioritize truth. JCIL is built from the ground up for believers who want AI assistance without compromising their values."
        />

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
          <FeatureCard
            icon={<BibleIcon className="w-6 h-6" />}
            title="Scripture-Grounded"
            description="Every response is informed by Biblical truth. Ask theological questions with confidence that the answers align with Scripture."
            variant="gradient"
            color="amber"
          />
          <FeatureCard
            icon={<ShieldIcon className="w-6 h-6" />}
            title="Values-Aligned"
            description="No moral relativism. JCIL understands Christian ethics and provides guidance that respects your worldview."
            variant="gradient"
            color="purple"
          />
          <FeatureCard
            icon={<BrainIcon className="w-6 h-6" />}
            title="Claude Intelligence"
            description="Built on Anthropic's Claude—the most capable, honest, and safe AI model available. Enterprise-grade power with faith-first values."
            variant="gradient"
            color="blue"
          />
        </div>
      </Section>

      {/* Products Section */}
      <Section id="products" background="gradient" padding="lg">
        <SectionHeader
          badge="Our Products"
          badgeColor="purple"
          title="Two ways to serve the Kingdom"
          description="Whether you need everyday AI assistance or full autonomous development capabilities, we have you covered."
        />

        <div className="grid gap-8 lg:grid-cols-2 max-w-5xl mx-auto">
          {/* Chat Product */}
          <div className="group relative bg-gradient-to-br from-amber-950/80 to-amber-950/40 rounded-3xl p-8 lg:p-10 border border-amber-500/20 hover:border-amber-500/40 transition-all duration-500">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-600/5 to-transparent rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/20 flex items-center justify-center">
                  <ChatIcon className="w-7 h-7 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white">Chat</h3>
                  <p className="text-amber-300 text-sm">For everyone</p>
                </div>
              </div>

              <p className="text-slate-300 mb-8 text-base leading-relaxed">
                Claude&apos;s intelligence with Biblical grounding. Get thoughtful answers, research
                assistance, and creative help—all aligned with Scripture and Christian values.
              </p>

              <div className="space-y-3 mb-8">
                {[
                  'Theological Q&A with Scripture references',
                  'Sermon & Bible study preparation',
                  'Web search & fact checking',
                  'Research agent with citations',
                  'Image generation & document analysis',
                ].map((feature, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm text-slate-300">
                    <svg
                      className="w-5 h-5 text-amber-400 shrink-0"
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
                className="inline-flex items-center justify-center w-full rounded-xl bg-amber-600 hover:bg-amber-500 px-6 py-3.5 text-white font-semibold transition-all"
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

            {/* Badge */}
            <div className="absolute -top-3 right-8">
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-fuchsia-500 text-xs font-semibold text-white">
                Claude Code Alternative
              </span>
            </div>

            <div className="relative">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-2xl bg-fuchsia-500/20 flex items-center justify-center">
                  <CodeIcon className="w-7 h-7 text-fuchsia-400" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white">Code Lab</h3>
                  <p className="text-fuchsia-300 text-sm">For developers</p>
                </div>
              </div>

              <p className="text-slate-300 mb-8 text-base leading-relaxed">
                Full autonomous development environment in your browser. Christian developers
                deserve world-class tools—30+ dev tools, sandboxed execution, and GitHub
                integration.
              </p>

              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-fuchsia-500/10 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-fuchsia-300">30+</div>
                  <div className="text-xs text-slate-400">Dev Tools</div>
                </div>
                <div className="bg-fuchsia-500/10 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-fuchsia-300">E2B</div>
                  <div className="text-xs text-slate-400">Cloud Sandbox</div>
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

      {/* Use Cases Section */}
      <UseCases />

      {/* Capabilities Section */}
      <Section
        id="capabilities"
        padding="lg"
        background="muted"
        className="border-y border-white/5"
      >
        <SectionHeader
          badge="Capabilities"
          badgeColor="blue"
          title="Enterprise-grade features"
          description="Built for serious work. Whether you're preparing a sermon or shipping production code, JCIL has the tools you need."
        />

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <FeatureCard
            icon={<AgentIcon className="w-6 h-6" />}
            title="Agentic AI"
            description="Autonomous task execution with plan-execute-observe loops. The AI doesn't just respond—it acts."
            variant="outlined"
            color="purple"
          />
          <FeatureCard
            icon={<PlugIcon className="w-6 h-6" />}
            title="MCP Native"
            description="Connect to any tool through Model Context Protocol. Databases, browsers, APIs—all accessible."
            variant="outlined"
            color="blue"
          />
          <FeatureCard
            icon={<RefreshIcon className="w-6 h-6" />}
            title="Self-Correcting"
            description="Automatic error detection and retry with intelligent analysis. Broken builds get fixed automatically."
            variant="outlined"
            color="pink"
          />
          <FeatureCard
            icon={<BrainIcon className="w-6 h-6" />}
            title="Persistent Memory"
            description="Context that survives sessions. The AI remembers your codebase, preferences, and project history."
            variant="outlined"
            color="amber"
          />
        </div>
      </Section>

      {/* Testimonials Section */}
      <Testimonials />

      {/* How It Works Section */}
      <Section background="muted" padding="lg" className="border-y border-white/5">
        <SectionHeader
          badge="How it works"
          badgeColor="green"
          title="From idea to impact in minutes"
          description="Simple workflow. Powerful results. More time for what matters."
        />

        <div className="max-w-4xl mx-auto">
          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                step: '01',
                title: 'Describe',
                description:
                  'Tell the AI what you need in plain English. "Help me prepare a sermon on grace" or "Build me a church management app."',
                icon: <ChatIcon className="w-6 h-6" />,
              },
              {
                step: '02',
                title: 'Execute',
                description:
                  'The agent plans, writes code, runs tests, and fixes errors automatically—all in a secure sandbox with your values intact.',
                icon: <AgentIcon className="w-6 h-6" />,
              },
              {
                step: '03',
                title: 'Deploy',
                description:
                  'Get working code pushed to GitHub, sermon outlines ready to preach, or research compiled and cited. Ready to serve.',
                icon: <CrossIcon className="w-6 h-6" />,
              },
            ].map((item) => (
              <div key={item.step} className="relative">
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center mb-6">
                    <span className="text-amber-400">{item.icon}</span>
                  </div>
                  <span className="text-xs font-bold text-amber-400 mb-2">{item.step}</span>
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
          description="Fortune 500-grade security infrastructure. Ministry data deserves the highest protection."
        />

        {/* Compliance Badges */}
        <div className="flex flex-wrap justify-center gap-3 mb-12">
          <span className="px-4 py-2 rounded-full bg-green-500/10 border border-green-500/30 text-sm font-medium text-green-300">
            SOC 2 Type II
          </span>
          <span className="px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/30 text-sm font-medium text-blue-300">
            GDPR Compliant
          </span>
          <span className="px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/30 text-sm font-medium text-purple-300">
            CCPA Compliant
          </span>
          <span className="px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/30 text-sm font-medium text-amber-300">
            Anthropic Exclusive
          </span>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <FeatureCard
            icon={<GlobeIcon className="w-6 h-6" />}
            title="US Data Centers"
            description="All data stored on American servers. No foreign data transfer."
            variant="outlined"
            color="blue"
          />
          <FeatureCard
            icon={<LockIcon className="w-6 h-6" />}
            title="E2E Encryption"
            description="AES-256 encryption at rest. TLS 1.3 in transit. Zero-access architecture."
            variant="outlined"
            color="green"
          />
          <FeatureCard
            icon={<ShieldIcon className="w-6 h-6" />}
            title="AI Safety"
            description="Anthropic's Constitutional AI with industry-leading safety measures."
            variant="outlined"
            color="purple"
          />
          <FeatureCard
            icon={<DocumentIcon className="w-6 h-6" />}
            title="Full Audit Trail"
            description="Complete logging with correlation IDs. Data export available on request."
            variant="outlined"
            color="amber"
          />
        </div>
      </Section>

      {/* Pricing Section */}
      <div id="pricing" className="bg-black">
        <PricingSection />
      </div>

      {/* Email Capture Section */}
      <Section padding="lg" background="muted" className="border-y border-white/5">
        <div className="max-w-2xl mx-auto">
          <EmailCapture
            title="Stay in the Word, stay in the loop"
            description="Get updates on new features, faith-based AI insights, and early access to upcoming tools. Join 2,500+ believers already using JCIL."
            buttonText="Join the Community"
          />
        </div>
      </Section>

      {/* Churches Logo Carousel */}
      <Section padding="md">
        <LogoCarousel
          variant="churches"
          title="Trusted by churches and ministries worldwide"
          speed="slow"
        />
      </Section>

      {/* Final CTA */}
      <Section padding="xl">
        <div className="relative mx-auto max-w-4xl">
          {/* Background Glow */}
          <div className="absolute inset-0 bg-gradient-to-r from-amber-600/20 via-orange-600/20 to-amber-600/20 rounded-3xl blur-xl" />

          <div className="relative bg-gradient-to-br from-slate-900 to-slate-950 rounded-3xl p-8 lg:p-16 border border-white/10 text-center">
            <CrossIcon className="w-10 h-10 text-amber-400 mx-auto mb-6" />
            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">
              Ready to build with faith-aligned AI?
            </h2>
            <p className="text-lg text-slate-400 mb-8 max-w-xl mx-auto">
              Join thousands of pastors, developers, and ministry leaders using JCIL to advance the
              Kingdom. Start free, scale as you grow.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/signup"
                className="w-full sm:w-auto rounded-xl bg-amber-600 hover:bg-amber-500 px-10 py-4 text-base font-semibold text-white transition-all shadow-lg shadow-amber-500/20"
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
