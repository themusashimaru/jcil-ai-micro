/**
 * JCIL.AI LANDING PAGE
 *
 * PURPOSE:
 * - Public homepage for JCIL.AI
 * - Showcase agentic AI capabilities
 * - Position as Manus AI competitor
 * - Enterprise-grade autonomous AI assistant
 */

import Link from 'next/link';
import PricingSection from './components/PricingSection';
import LandingLogo from './components/LandingLogo';
import MobileMenu from './components/MobileMenu';
import ChatDemo from './components/ChatDemo';
import TechDemo from './components/TechDemo';
import LivePreviewDemo from './components/LivePreviewDemo';
import DeployDemo from './components/DeployDemo';
import MultiAgentDemo from './components/MultiAgentDemo';
import AutoTestDemo from './components/AutoTestDemo';
import DatabaseDemo from './components/DatabaseDemo';
import ApiBuilderDemo from './components/ApiBuilderDemo';
import ImageGenDemo from './components/ImageGenDemo';
import WebsiteBuilderDemo from './components/WebsiteBuilderDemo';
import CodeLabDemo from './components/CodeLabDemo';

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
              <Link href="#capabilities" className="text-slate-400 hover:text-white font-medium transition">
                Capabilities
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
              <Link href="/api-info" className="text-slate-400 hover:text-white font-medium transition">
                API
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

      {/* Hero Section - Agentic Focus */}
      <section className="relative overflow-hidden bg-black py-20 sm:py-32">
        {/* Animated Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[100px] animate-pulse" />
          <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-full blur-[100px]" />
          {/* Grid pattern */}
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAgTSAwIDIwIEwgNDAgMjAgTSAyMCAwIEwgMjAgNDAgTSAwIDMwIEwgNDAgMzAgTSAzMCAwIEwgMzAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-40" />
        </div>

        <div className="container mx-auto px-4 text-center relative">
          <div className="mx-auto max-w-5xl">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 backdrop-blur-sm border border-purple-500/30 mb-8">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
              </span>
              <span className="text-sm font-medium text-purple-300">Autonomous AI Agent</span>
            </div>

            <h1 className="mb-6 text-5xl sm:text-6xl md:text-7xl font-bold leading-tight tracking-tight">
              <span className="bg-gradient-to-r from-white via-purple-200 to-blue-200 bg-clip-text text-transparent">
                Your AI Agent
              </span>
              <br />
              <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
                That Actually Gets Things Done
              </span>
            </h1>

            <p className="mx-auto mb-10 max-w-3xl text-xl sm:text-2xl text-slate-400 leading-relaxed">
              Not just a chatbot. An <span className="text-purple-400 font-semibold">autonomous agent</span> that builds projects,
              pushes to GitHub, fixes its own errors, and remembers everything about you.
            </p>

            {/* Key Features Pills */}
            <div className="flex flex-wrap items-center justify-center gap-3 mb-10">
              {[
                { icon: '🌐', label: 'AI Website Builder' },
                { icon: '🚀', label: 'Project Scaffolding' },
                { icon: '👁️', label: 'Live Code Preview' },
                { icon: '☁️', label: 'One-Click Deploy' },
                { icon: '🤖', label: 'Multi-Agent System' },
                { icon: '📦', label: 'GitHub Integration' },
              ].map((feature, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-slate-300"
                >
                  <span>{feature.icon}</span>
                  <span>{feature.label}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/signup"
                className="w-full sm:w-auto rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 px-10 py-4 text-lg font-semibold text-white hover:shadow-xl hover:shadow-purple-500/25 transition-all duration-300 hover:-translate-y-0.5"
              >
                Start Building Free
              </Link>
              <Link
                href="#capabilities"
                className="w-full sm:w-auto rounded-xl border-2 border-white/20 bg-white/5 backdrop-blur-sm px-10 py-4 text-lg font-semibold text-white hover:bg-white/10 hover:border-white/30 transition-all duration-300"
              >
                See Capabilities
              </Link>
            </div>

            {/* Social Proof */}
            <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-sm text-slate-500">
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 border-2 border-black flex items-center justify-center text-white text-xs font-bold">J</div>
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 border-2 border-black flex items-center justify-center text-white text-xs font-bold">M</div>
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-pink-600 border-2 border-black flex items-center justify-center text-white text-xs font-bold">S</div>
                </div>
                <span>Trusted by developers</span>
              </div>
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-4 h-4 text-yellow-400 fill-current" viewBox="0 0 20 20">
                    <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                  </svg>
                ))}
                <span className="ml-1 text-slate-400">4.9/5 rating</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison Banner */}
      <section className="bg-gradient-to-r from-purple-900/50 to-blue-900/50 py-6 border-y border-white/10">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap items-center justify-center gap-8 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-green-400">✓</span>
              <span className="text-slate-300">22+ Website Templates</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-400">✓</span>
              <span className="text-slate-300">One-Click Vercel Deploy</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-400">✓</span>
              <span className="text-slate-300">Supabase Integration</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-400">✓</span>
              <span className="text-slate-300">AI Logo Generation</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-green-400">✓</span>
              <span className="text-slate-300">Full GitHub Workflow</span>
            </div>
          </div>
        </div>
      </section>

      {/* Agentic Capabilities Section */}
      <section id="capabilities" className="relative bg-black py-24 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[100px]" />
          <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px]" />
        </div>

        <div className="container mx-auto px-4 relative">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/30 mb-6">
              <span className="text-blue-400">⚡</span>
              <span className="text-sm font-medium text-blue-300">Agentic Capabilities</span>
            </div>
            <h2 className="text-4xl sm:text-5xl font-bold mb-6">
              <span className="text-white">More Than a Chatbot.</span>
              <br />
              <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                A Full Autonomous Agent.
              </span>
            </h2>
            <p className="text-xl text-slate-400 max-w-3xl mx-auto">
              While others chat, JCIL.AI executes. Build entire projects, deploy to GitHub,
              and watch your AI fix its own mistakes in real-time.
            </p>
          </div>

          {/* Feature Grid */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-7xl mx-auto">
            {/* Project Scaffolding */}
            <div className="group relative bg-gradient-to-br from-purple-900/30 to-purple-900/10 rounded-2xl p-8 border border-purple-500/20 hover:border-purple-500/50 transition-all duration-300 hover:-translate-y-1">
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-colors" />
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-purple-500/20 flex items-center justify-center mb-6">
                  <span className="text-3xl">🏗️</span>
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">Project Scaffolding</h3>
                <p className="text-slate-400 mb-4 leading-relaxed">
                  Say &quot;Build me a landing page&quot; and watch. The agent plans the file structure,
                  generates all files in parallel, creates a GitHub repo, and pushes your complete project.
                </p>
                <ul className="space-y-2 text-sm text-slate-300">
                  <li className="flex items-center gap-2">
                    <span className="text-purple-400">→</span>
                    AI-powered structure planning
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-purple-400">→</span>
                    Parallel file generation
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-purple-400">→</span>
                    Auto-push to GitHub
                  </li>
                </ul>
              </div>
            </div>

            {/* Self-Correcting Code */}
            <div className="group relative bg-gradient-to-br from-blue-900/30 to-blue-900/10 rounded-2xl p-8 border border-blue-500/20 hover:border-blue-500/50 transition-all duration-300 hover:-translate-y-1">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-colors" />
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-blue-500/20 flex items-center justify-center mb-6">
                  <span className="text-3xl">🔄</span>
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">Self-Correcting Execution</h3>
                <p className="text-slate-400 mb-4 leading-relaxed">
                  Code fails? No problem. The agent detects the error, analyzes the traceback,
                  generates a fix, and retries automatically. Up to 3 attempts with intelligent debugging.
                </p>
                <ul className="space-y-2 text-sm text-slate-300">
                  <li className="flex items-center gap-2">
                    <span className="text-blue-400">→</span>
                    Run → Error → Fix → Retry loop
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-blue-400">→</span>
                    10+ error types detected
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-blue-400">→</span>
                    Type-specific debugging guidance
                  </li>
                </ul>
              </div>
            </div>

            {/* Persistent Memory */}
            <div className="group relative bg-gradient-to-br from-pink-900/30 to-pink-900/10 rounded-2xl p-8 border border-pink-500/20 hover:border-pink-500/50 transition-all duration-300 hover:-translate-y-1">
              <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/10 rounded-full blur-2xl group-hover:bg-pink-500/20 transition-colors" />
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-pink-500/20 flex items-center justify-center mb-6">
                  <span className="text-3xl">🧠</span>
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">Persistent Memory</h3>
                <p className="text-slate-400 mb-4 leading-relaxed">
                  Tell me your name, your projects, your preferences - once. I remember across sessions.
                  Say &quot;remember that I prefer TypeScript&quot; and I&apos;ll never forget.
                </p>
                <ul className="space-y-2 text-sm text-slate-300">
                  <li className="flex items-center gap-2">
                    <span className="text-pink-400">→</span>
                    Cross-session memory
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-pink-400">→</span>
                    Personal info, projects, preferences
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-pink-400">→</span>
                    &quot;What do you remember?&quot; command
                  </li>
                </ul>
              </div>
            </div>

            {/* Autonomous Mode */}
            <div className="group relative bg-gradient-to-br from-amber-900/30 to-amber-900/10 rounded-2xl p-8 border border-amber-500/20 hover:border-amber-500/50 transition-all duration-300 hover:-translate-y-1">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-colors" />
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/20 flex items-center justify-center mb-6">
                  <span className="text-3xl">🤖</span>
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">Autonomous Agent Mode</h3>
                <p className="text-slate-400 mb-4 leading-relaxed">
                  Let the agent run completely autonomously. Skip checkpoints,
                  auto-retry with adaptive queries, and self-correct when things go wrong.
                </p>
                <ul className="space-y-2 text-sm text-slate-300">
                  <li className="flex items-center gap-2">
                    <span className="text-amber-400">→</span>
                    Hands-off execution
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-amber-400">→</span>
                    Adaptive error recovery
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-amber-400">→</span>
                    AI-powered self-correction
                  </li>
                </ul>
              </div>
            </div>

            {/* GitHub Integration */}
            <div className="group relative bg-gradient-to-br from-green-900/30 to-green-900/10 rounded-2xl p-8 border border-green-500/20 hover:border-green-500/50 transition-all duration-300 hover:-translate-y-1">
              <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-full blur-2xl group-hover:bg-green-500/20 transition-colors" />
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-green-500/20 flex items-center justify-center mb-6">
                  <svg className="w-8 h-8 text-green-400" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">Full GitHub Workflow</h3>
                <p className="text-slate-400 mb-4 leading-relaxed">
                  Not just code generation - full Git operations. Create branches,
                  open PRs, compare diffs, push code. Select your repo and go.
                </p>
                <ul className="space-y-2 text-sm text-slate-300">
                  <li className="flex items-center gap-2">
                    <span className="text-green-400">→</span>
                    Create PRs with one command
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-400">→</span>
                    Branch management
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-400">→</span>
                    Repo-aware code review
                  </li>
                </ul>
              </div>
            </div>

            {/* Deep Research */}
            <div className="group relative bg-gradient-to-br from-cyan-900/30 to-cyan-900/10 rounded-2xl p-8 border border-cyan-500/20 hover:border-cyan-500/50 transition-all duration-300 hover:-translate-y-1">
              <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl group-hover:bg-cyan-500/20 transition-colors" />
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 flex items-center justify-center mb-6">
                  <span className="text-3xl">🔬</span>
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">Deep Research Mode</h3>
                <p className="text-slate-400 mb-4 leading-relaxed">
                  Need thorough research? The agent decomposes your query into 3-5 parallel searches,
                  runs them concurrently, then synthesizes a comprehensive report.
                </p>
                <ul className="space-y-2 text-sm text-slate-300">
                  <li className="flex items-center gap-2">
                    <span className="text-cyan-400">→</span>
                    Parallel multi-angle research
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-cyan-400">→</span>
                    Auto-synthesized reports
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-cyan-400">→</span>
                    Market &amp; competitor analysis
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Agent Workflow Visualization */}
      <section id="agent" className="relative bg-gradient-to-b from-black via-slate-900 to-black py-24 overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/30 mb-6">
              <span className="text-amber-400">🤖</span>
              <span className="text-sm font-medium text-amber-300">Agent Architecture</span>
            </div>
            <h2 className="text-4xl sm:text-5xl font-bold mb-6 text-white">
              How the Agent Works
            </h2>
            <p className="text-xl text-slate-400 max-w-3xl mx-auto">
              A linear execution engine that flows through Researcher → Analyst → Writer,
              with intelligent error recovery at each step.
            </p>
          </div>

          {/* Workflow Steps */}
          <div className="max-w-5xl mx-auto">
            <div className="relative">
              {/* Connection Line */}
              <div className="hidden md:block absolute left-1/2 top-8 bottom-8 w-0.5 bg-gradient-to-b from-purple-500 via-blue-500 to-green-500" />

              <div className="space-y-8">
                {/* Step 1: Task Detection */}
                <div className="relative flex flex-col md:flex-row items-center gap-6">
                  <div className="md:w-1/2 md:text-right md:pr-12">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-purple-500/20 border border-purple-500/50 mb-4 md:hidden">
                      <span className="text-purple-400 font-bold">1</span>
                    </div>
                    <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-6 border border-slate-700/50">
                      <h3 className="text-xl font-bold text-white mb-2">📋 Task Classification</h3>
                      <p className="text-slate-400 text-sm">
                        AI analyzes your request and classifies it: research, code-review, project-scaffold,
                        git-workflow, or deep-research. Complex multi-step tasks get a structured plan.
                      </p>
                    </div>
                  </div>
                  <div className="hidden md:flex w-12 h-12 shrink-0 items-center justify-center rounded-full bg-purple-500/20 border border-purple-500/50 z-10">
                    <span className="text-purple-400 font-bold">1</span>
                  </div>
                  <div className="hidden md:block md:w-1/2" />
                </div>

                {/* Step 2: Tool Selection */}
                <div className="relative flex flex-col md:flex-row items-center gap-6">
                  <div className="hidden md:block md:w-1/2" />
                  <div className="hidden md:flex w-12 h-12 shrink-0 items-center justify-center rounded-full bg-blue-500/20 border border-blue-500/50 z-10">
                    <span className="text-blue-400 font-bold">2</span>
                  </div>
                  <div className="md:w-1/2 md:pl-12">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-500/20 border border-blue-500/50 mb-4 md:hidden">
                      <span className="text-blue-400 font-bold">2</span>
                    </div>
                    <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-6 border border-slate-700/50">
                      <h3 className="text-xl font-bold text-white mb-2">🔧 Tool Selection</h3>
                      <p className="text-slate-400 text-sm">
                        The agent picks the right tool: Web Search, Deep Research, Code Execution,
                        Project Scaffolding, GitHub Review, or Git Workflow. Each tool is specialized.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Step 3: Execution with Retry */}
                <div className="relative flex flex-col md:flex-row items-center gap-6">
                  <div className="md:w-1/2 md:text-right md:pr-12">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-500/20 border border-amber-500/50 mb-4 md:hidden">
                      <span className="text-amber-400 font-bold">3</span>
                    </div>
                    <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-6 border border-slate-700/50">
                      <h3 className="text-xl font-bold text-white mb-2">⚡ Execute with Auto-Retry</h3>
                      <p className="text-slate-400 text-sm">
                        Run → Error → Fix → Retry. If code fails, the agent detects the error type,
                        applies debugging guidance, and retries with a corrected approach. Up to 3 attempts.
                      </p>
                    </div>
                  </div>
                  <div className="hidden md:flex w-12 h-12 shrink-0 items-center justify-center rounded-full bg-amber-500/20 border border-amber-500/50 z-10">
                    <span className="text-amber-400 font-bold">3</span>
                  </div>
                  <div className="hidden md:block md:w-1/2" />
                </div>

                {/* Step 4: Memory & Context */}
                <div className="relative flex flex-col md:flex-row items-center gap-6">
                  <div className="hidden md:block md:w-1/2" />
                  <div className="hidden md:flex w-12 h-12 shrink-0 items-center justify-center rounded-full bg-pink-500/20 border border-pink-500/50 z-10">
                    <span className="text-pink-400 font-bold">4</span>
                  </div>
                  <div className="md:w-1/2 md:pl-12">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-pink-500/20 border border-pink-500/50 mb-4 md:hidden">
                      <span className="text-pink-400 font-bold">4</span>
                    </div>
                    <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-6 border border-slate-700/50">
                      <h3 className="text-xl font-bold text-white mb-2">🧠 Memory Injection</h3>
                      <p className="text-slate-400 text-sm">
                        Your preferences, projects, and explicit memories are injected into every conversation.
                        The agent knows who you are, what you&apos;re working on, and how you like things done.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Step 5: Delivery */}
                <div className="relative flex flex-col md:flex-row items-center gap-6">
                  <div className="md:w-1/2 md:text-right md:pr-12">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-500/20 border border-green-500/50 mb-4 md:hidden">
                      <span className="text-green-400 font-bold">5</span>
                    </div>
                    <div className="bg-slate-800/50 backdrop-blur rounded-2xl p-6 border border-slate-700/50">
                      <h3 className="text-xl font-bold text-white mb-2">✅ Deliver Results</h3>
                      <p className="text-slate-400 text-sm">
                        Complete projects pushed to GitHub, comprehensive research reports, working code,
                        or intelligent analysis. Plus proactive suggestions for what to do next.
                      </p>
                    </div>
                  </div>
                  <div className="hidden md:flex w-12 h-12 shrink-0 items-center justify-center rounded-full bg-green-500/20 border border-green-500/50 z-10">
                    <span className="text-green-400 font-bold">5</span>
                  </div>
                  <div className="hidden md:block md:w-1/2" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Built for Christian Developers Section */}
      <section className="relative bg-gradient-to-b from-black via-slate-900/50 to-black py-20 overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/30 mb-6">
              <span className="text-amber-400">✝️</span>
              <span className="text-sm font-medium text-amber-300">Built by Christians, for Christians</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
              Real AI Power.<br />
              <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                Unwavering Values.
              </span>
            </h2>
            <p className="text-lg text-slate-400 mb-8 max-w-2xl mx-auto">
              We&apos;re not Silicon Valley. We&apos;re Christian developers who got tired of AI tools
              that compromise our values. JCIL.AI is built with the same technical firepower as
              the big players — project scaffolding, autonomous agents, GitHub integration — but
              anchored to Biblical truth. No drift. No compromise.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-500">
              <div className="flex items-center gap-2">
                <span className="text-green-400">✓</span>
                <span>Faith-aligned from the ground up</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-400">✓</span>
                <span>Full agentic capabilities</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-400">✓</span>
                <span>Built by developers, for developers</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tech Demo - Project Scaffolding */}
      <section className="relative bg-black py-16 sm:py-24 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-green-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        </div>

        <div className="container mx-auto px-4 relative">
          <TechDemo />

          <div className="text-center mt-10">
            <Link
              href="/signup"
              className="inline-block rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 px-8 py-4 text-lg font-semibold text-white hover:shadow-xl hover:shadow-green-500/25 transition-all duration-300 hover:-translate-y-0.5"
            >
              Start Building Free
            </Link>
          </div>
        </div>
      </section>

      {/* Live Code Preview Demo */}
      <section className="relative bg-gradient-to-b from-black via-purple-900/20 to-black py-16 sm:py-24 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        </div>

        <div className="container mx-auto px-4 relative">
          <LivePreviewDemo />

          <div className="text-center mt-10">
            <Link
              href="/signup"
              className="inline-block rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 px-8 py-4 text-lg font-semibold text-white hover:shadow-xl hover:shadow-purple-500/25 transition-all duration-300 hover:-translate-y-0.5"
            >
              Try Live Preview
            </Link>
          </div>
        </div>
      </section>

      {/* One-Click Deploy Demo */}
      <section className="relative bg-gradient-to-b from-black via-green-900/10 to-black py-16 sm:py-24 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-green-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl" />
        </div>

        <div className="container mx-auto px-4 relative">
          <DeployDemo />

          <div className="text-center mt-10">
            <Link
              href="/signup"
              className="inline-block rounded-xl bg-gradient-to-r from-green-600 to-teal-600 px-8 py-4 text-lg font-semibold text-white hover:shadow-xl hover:shadow-green-500/25 transition-all duration-300 hover:-translate-y-0.5"
            >
              Deploy Your First Project
            </Link>
          </div>
        </div>
      </section>

      {/* Multi-Agent Orchestration Demo */}
      <section className="relative bg-gradient-to-b from-black via-amber-900/10 to-black py-16 sm:py-24 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        </div>

        <div className="container mx-auto px-4 relative">
          <MultiAgentDemo />

          <div className="text-center mt-10">
            <Link
              href="/signup"
              className="inline-block rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 px-8 py-4 text-lg font-semibold text-white hover:shadow-xl hover:shadow-amber-500/25 transition-all duration-300 hover:-translate-y-0.5"
            >
              Try Multi-Agent Mode
            </Link>
          </div>
        </div>
      </section>

      {/* Auto-Testing Demo */}
      <section className="relative bg-gradient-to-b from-black via-cyan-900/10 to-black py-16 sm:py-24 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        </div>

        <div className="container mx-auto px-4 relative">
          <AutoTestDemo />

          <div className="text-center mt-10">
            <Link
              href="/signup"
              className="inline-block rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-8 py-4 text-lg font-semibold text-white hover:shadow-xl hover:shadow-cyan-500/25 transition-all duration-300 hover:-translate-y-0.5"
            >
              Build with Confidence
            </Link>
          </div>
        </div>
      </section>

      {/* Database Designer Demo */}
      <section className="relative bg-gradient-to-b from-black via-emerald-900/10 to-black py-16 sm:py-24 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl" />
        </div>

        <div className="container mx-auto px-4 relative">
          <DatabaseDemo />

          <div className="text-center mt-10">
            <Link
              href="/signup"
              className="inline-block rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-8 py-4 text-lg font-semibold text-white hover:shadow-xl hover:shadow-emerald-500/25 transition-all duration-300 hover:-translate-y-0.5"
            >
              Design Your Database
            </Link>
          </div>
        </div>
      </section>

      {/* API Builder Demo */}
      <section className="relative bg-gradient-to-b from-black via-blue-900/10 to-black py-16 sm:py-24 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
        </div>

        <div className="container mx-auto px-4 relative">
          <ApiBuilderDemo />

          <div className="text-center mt-10">
            <Link
              href="/signup"
              className="inline-block rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-4 text-lg font-semibold text-white hover:shadow-xl hover:shadow-blue-500/25 transition-all duration-300 hover:-translate-y-0.5"
            >
              Build Your API
            </Link>
          </div>
        </div>
      </section>

      {/* Image Generation Demo */}
      <section className="relative bg-gradient-to-b from-black via-pink-900/10 to-black py-16 sm:py-24 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        </div>

        <div className="container mx-auto px-4 relative">
          <ImageGenDemo />

          <div className="text-center mt-10">
            <Link
              href="/signup"
              className="inline-block rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 px-8 py-4 text-lg font-semibold text-white hover:shadow-xl hover:shadow-pink-500/25 transition-all duration-300 hover:-translate-y-0.5"
            >
              Create Images with AI
            </Link>
          </div>
        </div>
      </section>

      {/* AI Website Builder Demo - NEW */}
      <section className="relative bg-gradient-to-b from-black via-orange-900/10 to-black py-16 sm:py-24 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-red-500/10 rounded-full blur-3xl" />
        </div>

        <div className="container mx-auto px-4 relative">
          <WebsiteBuilderDemo />

          <div className="text-center mt-10">
            <Link
              href="/signup"
              className="inline-block rounded-xl bg-gradient-to-r from-orange-600 to-red-600 px-8 py-4 text-lg font-semibold text-white hover:shadow-xl hover:shadow-orange-500/25 transition-all duration-300 hover:-translate-y-0.5"
            >
              Build Your Website Free
            </Link>
          </div>
        </div>
      </section>

      {/* Code Lab IDE Demo - NEW */}
      <section id="code-lab" className="relative bg-gradient-to-b from-black via-fuchsia-900/10 to-black py-16 sm:py-24 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-fuchsia-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        </div>

        <div className="container mx-auto px-4 relative">
          <CodeLabDemo />
        </div>
      </section>

      {/* Faith Demo - Chat */}
      <section className="relative bg-gradient-to-b from-black to-slate-900 py-16 sm:py-24 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        </div>

        <div className="container mx-auto px-4 relative">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/30 mb-4">
              <span className="text-blue-400">📖</span>
              <span className="text-sm font-medium text-blue-300">Faith-Grounded Responses</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Questions About Faith? We&apos;ve Got You.
            </h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              Beyond code, JCIL.AI is grounded in Biblical truth. Ask about Scripture,
              theology, or life — get answers anchored to the Word of God.
            </p>
          </div>

          <ChatDemo />
        </div>
      </section>

      {/* Why We're Different */}
      <section className="bg-gradient-to-b from-black to-slate-900 py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold mb-6 text-white">
              Why JCIL.AI?
            </h2>
            <p className="text-xl text-slate-400 max-w-3xl mx-auto">
              Built for people of faith who need real AI power, not watered-down chatbots.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Other AI */}
            <div className="bg-slate-800/30 backdrop-blur-sm rounded-2xl p-8 border border-slate-700/50">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-full bg-slate-600/50 flex items-center justify-center">
                  <span className="text-slate-400 text-xl">🤖</span>
                </div>
                <h3 className="text-xl font-semibold text-slate-400">Typical AI Assistants</h3>
              </div>
              <ul className="space-y-4">
                {[
                  'Just a chat interface',
                  'No memory between sessions',
                  'Can\'t execute code or deploy',
                  'No GitHub integration',
                  'Single-step responses only',
                  'No autonomous capabilities',
                  'Values drift with trends',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-slate-400 text-sm">
                    <span className="text-red-400 mt-0.5">✕</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* JCIL.AI */}
            <div className="bg-gradient-to-br from-purple-900/40 to-blue-900/40 backdrop-blur-sm rounded-2xl p-8 border border-purple-500/30 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl" />
              <div className="relative">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-full bg-purple-500/30 flex items-center justify-center">
                    <span className="text-purple-300 text-xl">✝️</span>
                  </div>
                  <h3 className="text-xl font-semibold text-white">JCIL.AI Agent</h3>
                </div>
                <ul className="space-y-4">
                  {[
                    'Full autonomous agent capabilities',
                    'Persistent cross-session memory',
                    'Self-correcting code execution',
                    'Complete GitHub workflow integration',
                    'Multi-step task planning & execution',
                    'Project scaffolding & deployment',
                    'Anchored to Christian values - always',
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
        </div>
      </section>

      {/* All Tools Section */}
      <section className="relative bg-slate-900 py-24 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 right-10 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-20 left-10 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl" />
        </div>

        <div className="container mx-auto px-4 relative">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">All Your Tools, One Agent</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Everything you need to research, write, code, and create.
            </p>
          </div>

          <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto">
            {[
              { icon: '🌐', title: 'Website Builder', desc: '22+ templates, AI-generated sites' },
              { icon: '🚀', title: 'Project Builder', desc: 'Full app generation + GitHub push' },
              { icon: '👁️', title: 'Live Preview', desc: 'See generated code render instantly' },
              { icon: '☁️', title: 'One-Click Deploy', desc: 'Vercel & Netlify integration' },
              { icon: '🤖', title: 'Multi-Agent', desc: '5 specialized agents working together' },
              { icon: '🧪', title: 'Auto-Testing', desc: 'AI-generated tests with coverage' },
              { icon: '🗄️', title: 'Database Designer', desc: 'Supabase schema auto-generation' },
              { icon: '🔌', title: 'API Builder', desc: 'REST APIs with Zod validation' },
              { icon: '🎨', title: 'Image & Logo Gen', desc: 'AI-powered brand asset creation' },
              { icon: '💻', title: 'Code Execution', desc: 'Run Python with auto-fix on errors' },
              { icon: '📦', title: 'GitHub Workflow', desc: 'Branches, PRs, diffs, push' },
              { icon: '🧠', title: 'Persistent Memory', desc: 'Remembers you across sessions' },
            ].map((tool, index) => (
              <div
                key={index}
                className="group flex items-start gap-4 rounded-2xl bg-slate-800/50 backdrop-blur-sm p-5 border border-slate-700/50 hover:border-purple-500/30 hover:bg-slate-800/80 transition-all duration-300"
              >
                <div className="text-2xl group-hover:scale-110 transition-transform duration-300">{tool.icon}</div>
                <div>
                  <h3 className="font-semibold mb-1 text-white">{tool.title}</h3>
                  <p className="text-sm text-slate-400">{tool.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Enterprise Security Section */}
      <section className="bg-gradient-to-r from-purple-900/50 to-blue-900/50 py-16 sm:py-20 border-y border-white/10">
        <div className="container mx-auto px-4">
          <h2 className="mb-4 text-center text-3xl sm:text-4xl font-bold text-white">Enterprise-Grade Security</h2>
          <p className="mb-12 text-center text-slate-300 max-w-2xl mx-auto">
            Your data is protected with the same security standards trusted by Fortune 500 companies.
          </p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto">
            <div className="bg-white/5 backdrop-blur rounded-2xl p-6 border border-white/10">
              <div className="mb-4 text-3xl">🇺🇸</div>
              <h3 className="mb-2 text-lg font-semibold text-white">American Data Centers</h3>
              <p className="text-sm text-slate-300">
                All data processed and stored exclusively on American servers.
              </p>
            </div>

            <div className="bg-white/5 backdrop-blur rounded-2xl p-6 border border-white/10">
              <div className="mb-4 text-3xl">🔒</div>
              <h3 className="mb-2 text-lg font-semibold text-white">End-to-End Encryption</h3>
              <p className="text-sm text-slate-300">
                AES-256 encryption for all conversations in transit and at rest.
              </p>
            </div>

            <div className="bg-white/5 backdrop-blur rounded-2xl p-6 border border-white/10">
              <div className="mb-4 text-3xl">🛡️</div>
              <h3 className="mb-2 text-lg font-semibold text-white">Content Moderation</h3>
              <p className="text-sm text-slate-300">
                Enterprise-grade moderation filters inappropriate content.
              </p>
            </div>

            <div className="bg-white/5 backdrop-blur rounded-2xl p-6 border border-white/10">
              <div className="mb-4 text-3xl">🗑️</div>
              <h3 className="mb-2 text-lg font-semibold text-white">Auto-Delete Policy</h3>
              <p className="text-sm text-slate-300">
                Conversations auto-deleted after 6 months. Never sold for ads.
              </p>
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
