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
import SocialProof from './components/landing/Testimonials';
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
  SpreadsheetIcon,
  FormulaIcon,
  PdfIcon,
  WordIcon,
  CheckCircleIcon,
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

            {/* Trust Indicators - Only TRUE claims */}
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-sm text-slate-500">
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
                <span>1,482 Automated Tests</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>E2B Sandboxed Execution</span>
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
          title="AI that supports our community"
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
            description="Built on Anthropic's Claude, the most capable, honest, and safe AI model available. Enterprise-grade power with faith-first values."
            variant="gradient"
            color="blue"
          />
        </div>

        {/* Philosophy Statement */}
        <div className="mt-12 max-w-3xl mx-auto">
          <div className="bg-slate-900/50 rounded-2xl p-6 lg:p-8 border border-amber-500/20 text-center">
            <p className="text-slate-300 leading-relaxed">
              <span className="text-amber-400 font-semibold">AI is a tool, not a replacement.</span>{' '}
              JCIL does not replace God, pastors, teachers, or mentors. We build technology that
              supplements your work, helping you stay ahead without compromising your values or your
              relationships.
            </p>
          </div>
        </div>
      </Section>

      {/* Products Section */}
      <Section id="products" background="gradient" padding="lg">
        <SectionHeader
          badge="Our Products"
          badgeColor="purple"
          title="Pick your platform"
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
                assistance, and creative help, all aligned with Scripture and Christian values.
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
                100% Claude Code Parity
              </span>
            </div>

            <div className="relative">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-2xl bg-fuchsia-500/20 flex items-center justify-center">
                  <CodeIcon className="w-7 h-7 text-fuchsia-400" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white">Code Lab</h3>
                  <p className="text-fuchsia-300 text-sm">Enterprise AI IDE</p>
                </div>
              </div>

              <p className="text-slate-300 mb-6 text-base leading-relaxed">
                The most powerful AI development environment on the web. 55+ autonomous tools, 5 MCP
                servers, visual debugging for 32 languages—all with{' '}
                <span className="text-fuchsia-400 font-semibold">zero installation</span>.
              </p>

              <div className="grid grid-cols-4 gap-2 mb-6">
                <div className="bg-fuchsia-500/10 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-fuchsia-300">55+</div>
                  <div className="text-[10px] text-slate-400">Tools</div>
                </div>
                <div className="bg-fuchsia-500/10 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-fuchsia-300">5</div>
                  <div className="text-[10px] text-slate-400">MCP</div>
                </div>
                <div className="bg-fuchsia-500/10 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-fuchsia-300">32</div>
                  <div className="text-[10px] text-slate-400">Debug</div>
                </div>
                <div className="bg-fuchsia-500/10 rounded-lg p-2 text-center">
                  <div className="text-lg font-bold text-fuchsia-300">E2B</div>
                  <div className="text-[10px] text-slate-400">Sandbox</div>
                </div>
              </div>

              <div className="space-y-2 mb-6">
                {[
                  'Claude Opus 4.5 with 200K context',
                  'Visual debugging & breakpoints',
                  'One-click deployment (Vercel, Netlify)',
                  'Real-time collaboration',
                  'Checkpoint & rewind system',
                ].map((feature, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm text-slate-300">
                    <svg
                      className="w-4 h-4 text-fuchsia-400 shrink-0"
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
                View Technical Specs
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
            description="Autonomous task execution with plan-execute-observe loops. The AI doesn't just respond, it acts."
            variant="outlined"
            color="purple"
          />
          <FeatureCard
            icon={<PlugIcon className="w-6 h-6" />}
            title="MCP Native"
            description="Connect to any tool through Model Context Protocol. Databases, browsers, and APIs, all accessible."
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

      {/* Document Generation Section */}
      <Section id="documents" padding="lg">
        <SectionHeader
          badge="Document Generation"
          badgeColor="green"
          title="Professional documents in seconds"
          description="Create publication-ready Word docs, Excel spreadsheets, and PDFs with proper formatting, margins, and advanced formulas. Better than the competition."
        />

        <div className="max-w-5xl mx-auto">
          {/* Main Feature Card */}
          <div className="relative bg-gradient-to-br from-emerald-950/80 to-slate-950 rounded-3xl p-8 lg:p-12 border border-emerald-500/20 overflow-hidden mb-8">
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />

            <div className="relative grid lg:grid-cols-2 gap-8 items-center">
              {/* Left: Content */}
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 mb-4">
                  <span className="text-xs font-semibold text-emerald-300">ENHANCED</span>
                </div>
                <h3 className="text-2xl lg:text-3xl font-bold text-white mb-4">
                  Enterprise-Grade Documents
                </h3>
                <p className="text-slate-300 text-base leading-relaxed mb-6">
                  Our document engine generates professional output that rivals dedicated office
                  suites. Perfect spacing, proper margins, and intelligent formatting that just
                  works—whether you&apos;re creating a research report or financial spreadsheet.
                </p>

                {/* Stats */}
                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="bg-black/30 rounded-xl p-4 border border-white/5 text-center">
                    <div className="text-3xl font-bold text-emerald-400 mb-1">50+</div>
                    <div className="text-slate-400 text-xs">Excel Formulas</div>
                  </div>
                  <div className="bg-black/30 rounded-xl p-4 border border-white/5 text-center">
                    <div className="text-3xl font-bold text-emerald-400 mb-1">100%</div>
                    <div className="text-slate-400 text-xs">Type-Safe</div>
                  </div>
                  <div className="bg-black/30 rounded-xl p-4 border border-white/5 text-center">
                    <div className="text-3xl font-bold text-emerald-400 mb-1">Pro</div>
                    <div className="text-slate-400 text-xs">Typography</div>
                  </div>
                </div>
              </div>

              {/* Right: Feature list */}
              <div className="space-y-4">
                <div className="flex items-start gap-3 bg-black/20 rounded-xl p-4 border border-white/5">
                  <CheckCircleIcon className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-white font-medium mb-1">Smart Table Formatting</div>
                    <div className="text-slate-400 text-sm">
                      Auto-calculated column widths, alternating row colors, and proper cell padding
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3 bg-black/20 rounded-xl p-4 border border-white/5">
                  <CheckCircleIcon className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-white font-medium mb-1">Financial Formulas</div>
                    <div className="text-slate-400 text-sm">
                      PMT, NPV, IRR, FV—all the formulas accountants and analysts actually use
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-3 bg-black/20 rounded-xl p-4 border border-white/5">
                  <CheckCircleIcon className="w-5 h-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-white font-medium mb-1">Professional Typography</div>
                    <div className="text-slate-400 text-sm">
                      1.15 line spacing, proper margins, heading hierarchy—document standards built
                      in
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Document Types Grid */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <FeatureCard
              icon={<WordIcon className="w-6 h-6" />}
              title="Word Documents"
              description="Reports, letters, and proposals with proper heading styles and professional formatting."
              variant="outlined"
              color="blue"
            />
            <FeatureCard
              icon={<SpreadsheetIcon className="w-6 h-6" />}
              title="Excel Spreadsheets"
              description="Budgets, analyses, and data with SUM, VLOOKUP, SUMIF, and 50+ more formulas."
              variant="outlined"
              color="green"
            />
            <FeatureCard
              icon={<PdfIcon className="w-6 h-6" />}
              title="PDF Reports"
              description="Print-ready documents with headers, footers, and consistent page layout."
              variant="outlined"
              color="pink"
            />
            <FeatureCard
              icon={<FormulaIcon className="w-6 h-6" />}
              title="Smart Formulas"
              description="Type-safe formula builder prevents errors. INDEX/MATCH, IFERROR, financial functions."
              variant="outlined"
              color="purple"
            />
          </div>
        </div>
      </Section>

      {/* AI Agents Section */}
      <Section id="agents" padding="lg">
        <SectionHeader
          badge="AI Agents"
          badgeColor="purple"
          title="Intelligent agents that work for you"
          description="Our specialized agents handle complex tasks autonomously, learning from your context to deliver better results over time."
        />

        <div className="max-w-5xl mx-auto">
          {/* Memory Agent Feature */}
          <div className="relative bg-gradient-to-br from-purple-950/80 to-slate-950 rounded-3xl p-8 lg:p-12 border border-purple-500/20 overflow-hidden">
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />

            <div className="relative grid lg:grid-cols-2 gap-8 items-center">
              {/* Left: Content */}
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/30 mb-4">
                  <span className="text-xs font-semibold text-purple-300">NEW</span>
                </div>
                <h3 className="text-2xl lg:text-3xl font-bold text-white mb-4">
                  Persistent Memory Agent
                </h3>
                <p className="text-slate-300 text-base leading-relaxed mb-6">
                  Our Memory Agent maintains context across sessions, remembering your preferences,
                  project details, and conversation history. It learns how you work and adapts to
                  serve you better with each interaction.
                </p>

                {/* Technical specs */}
                <div className="grid sm:grid-cols-2 gap-4 mb-6">
                  <div className="bg-black/30 rounded-xl p-4 border border-white/5">
                    <div className="text-purple-400 text-sm font-medium mb-1">Vector Storage</div>
                    <div className="text-slate-400 text-xs">
                      Semantic search across your conversation history
                    </div>
                  </div>
                  <div className="bg-black/30 rounded-xl p-4 border border-white/5">
                    <div className="text-purple-400 text-sm font-medium mb-1">
                      Auto-Summarization
                    </div>
                    <div className="text-slate-400 text-xs">
                      Key insights extracted and stored automatically
                    </div>
                  </div>
                  <div className="bg-black/30 rounded-xl p-4 border border-white/5">
                    <div className="text-purple-400 text-sm font-medium mb-1">
                      Context Injection
                    </div>
                    <div className="text-slate-400 text-xs">
                      Relevant memories surface when you need them
                    </div>
                  </div>
                  <div className="bg-black/30 rounded-xl p-4 border border-white/5">
                    <div className="text-purple-400 text-sm font-medium mb-1">Privacy-First</div>
                    <div className="text-slate-400 text-xs">
                      Your data stays yours, encrypted at rest
                    </div>
                  </div>
                </div>

                <Link
                  href="/chat"
                  className="inline-flex items-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-500 px-6 py-3 text-white font-semibold transition-all"
                >
                  Try Memory Agent
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </Link>
              </div>

              {/* Right: Visual representation */}
              <div className="hidden lg:flex items-center justify-center">
                <div className="relative w-64 h-64">
                  {/* Central brain icon */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-purple-500/30 to-purple-600/20 border border-purple-500/40 flex items-center justify-center">
                      <BrainIcon className="w-12 h-12 text-purple-400" />
                    </div>
                  </div>

                  {/* Orbiting memory nodes */}
                  <div
                    className="absolute w-full h-full animate-spin"
                    style={{ animationDuration: '20s' }}
                  >
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
                      <DocumentIcon className="w-5 h-5 text-purple-300" />
                    </div>
                  </div>
                  <div
                    className="absolute w-full h-full animate-spin"
                    style={{ animationDuration: '25s', animationDirection: 'reverse' }}
                  >
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-10 h-10 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
                      <ChatIcon className="w-5 h-5 text-purple-300" />
                    </div>
                  </div>
                  <div
                    className="absolute w-full h-full animate-spin"
                    style={{ animationDuration: '30s' }}
                  >
                    <div className="absolute top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
                      <CodeIcon className="w-5 h-5 text-purple-300" />
                    </div>
                  </div>

                  {/* Connecting lines effect */}
                  <div className="absolute inset-0 rounded-full border border-purple-500/10" />
                  <div className="absolute inset-8 rounded-full border border-purple-500/20" />
                </div>
              </div>
            </div>
          </div>

          {/* Other Available Agents */}
          <div className="mt-8 grid sm:grid-cols-3 gap-4">
            <div className="bg-blue-950/50 rounded-xl p-5 border border-blue-500/20">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <GlobeIcon className="w-4 h-4 text-blue-400" />
                </div>
                <span className="text-xs text-blue-400 uppercase tracking-wide font-semibold">
                  Available
                </span>
              </div>
              <h4 className="text-white font-semibold mb-1">Research Agent</h4>
              <p className="text-slate-400 text-xs">
                Deep web research with source verification and citations.
              </p>
            </div>
            <div className="bg-slate-900/50 rounded-xl p-5 border border-white/10">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                  <BibleIcon className="w-4 h-4 text-amber-400" />
                </div>
                <span className="text-xs text-slate-500 uppercase tracking-wide">Coming Soon</span>
              </div>
              <h4 className="text-white font-semibold mb-1">Scripture Agent</h4>
              <p className="text-slate-400 text-xs">
                Cross-reference search and theological context analysis.
              </p>
            </div>
            <div className="bg-slate-900/50 rounded-xl p-5 border border-white/10">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-fuchsia-500/20 flex items-center justify-center">
                  <CodeIcon className="w-4 h-4 text-fuchsia-400" />
                </div>
                <span className="text-xs text-slate-500 uppercase tracking-wide">Coming Soon</span>
              </div>
              <h4 className="text-white font-semibold mb-1">Code Review Agent</h4>
              <p className="text-slate-400 text-xs">
                Automated PR reviews with security and best practice checks.
              </p>
            </div>
          </div>
        </div>
      </Section>

      {/* Social Proof Section */}
      <SocialProof />

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
                  'The agent plans, writes code, runs tests, and fixes errors automatically. All in a secure sandbox with your values intact.',
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

        {/* Security Features - Only TRUE claims */}
        <div className="flex flex-wrap justify-center gap-3 mb-12">
          <span className="px-4 py-2 rounded-full bg-green-500/10 border border-green-500/30 text-sm font-medium text-green-300">
            AES-256 Encryption
          </span>
          <span className="px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/30 text-sm font-medium text-blue-300">
            US Data Centers
          </span>
          <span className="px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/30 text-sm font-medium text-purple-300">
            No Training on Your Data
          </span>
          <span className="px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/30 text-sm font-medium text-amber-300">
            Powered by Claude
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
            description="Get updates on new features, faith-based AI insights, and early access to upcoming tools."
            buttonText="Get Updates"
          />
        </div>
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
              Be an early adopter of faith-aligned AI. Help us build something meaningful for the
              Kingdom. Start free, grow with us.
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
