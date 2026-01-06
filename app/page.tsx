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

      {/* Hero Section - Confident, Tier-One */}
      <section className="relative overflow-hidden bg-black py-24 sm:py-36">
        {/* Animated Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-[600px] h-[600px] bg-purple-600/15 rounded-full blur-[120px]" />
          <div className="absolute -bottom-40 -left-40 w-[600px] h-[600px] bg-blue-600/15 rounded-full blur-[120px]" />
          {/* Subtle grid pattern */}
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAgTSAwIDIwIEwgNDAgMjAgTSAyMCAwIEwgMjAgNDAgTSAwIDMwIEwgNDAgMzAgTSAzMCAwIEwgMzAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAyKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-50" />
        </div>

        <div className="container mx-auto px-4 text-center relative">
          <div className="mx-auto max-w-4xl">
            {/* Simple, confident headline */}
            <h1 className="mb-8 text-5xl sm:text-6xl md:text-7xl font-bold leading-[1.1] tracking-tight">
              <span className="text-white">
                AI that works
              </span>
              <br />
              <span className="bg-gradient-to-r from-purple-400 via-fuchsia-400 to-blue-400 bg-clip-text text-transparent">
                the way you think
              </span>
            </h1>

            <p className="mx-auto mb-12 max-w-2xl text-xl text-slate-400 leading-relaxed">
              Enterprise-grade AI infrastructure. Agentic execution.
              <span className="text-slate-300"> Built on faith, open to all.</span>
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/signup"
                className="w-full sm:w-auto rounded-xl bg-white px-10 py-4 text-lg font-semibold text-black hover:bg-slate-100 transition-all duration-300"
              >
                Get Started
              </Link>
              <Link
                href="/code-lab"
                className="w-full sm:w-auto rounded-xl border border-white/20 bg-white/5 backdrop-blur-sm px-10 py-4 text-lg font-semibold text-white hover:bg-white/10 hover:border-white/30 transition-all duration-300"
              >
                Open Code Lab
              </Link>
            </div>

            {/* Simple capability indicators - no specific numbers */}
            <div className="mt-16 flex flex-wrap items-center justify-center gap-8 text-sm text-slate-500">
              <span>Agentic Execution</span>
              <span className="hidden sm:inline">•</span>
              <span>Persistent Memory</span>
              <span className="hidden sm:inline">•</span>
              <span>Full Dev Environment</span>
              <span className="hidden sm:inline">•</span>
              <span>GitHub Native</span>
            </div>
          </div>
        </div>
      </section>


      {/* Dynamic Agents Section */}
      <section id="capabilities" className="relative bg-black py-24 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[100px]" />
          <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px]" />
        </div>

        <div className="container mx-auto px-4 relative">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold mb-6">
              <span className="text-white">Dynamic Agents.</span>
              <br />
              <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                Adaptive Intelligence.
              </span>
            </h2>
            <p className="text-xl text-slate-400 max-w-3xl mx-auto">
              Agents that understand context, adapt to your workflow, and execute autonomously.
              Connect to any tool through MCP. Extend capabilities infinitely.
            </p>
          </div>

          {/* Feature Grid */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-7xl mx-auto">
            {/* Dynamic Agent Architecture */}
            <div className="group relative bg-gradient-to-br from-purple-900/30 to-purple-900/10 rounded-2xl p-8 border border-purple-500/20 hover:border-purple-500/50 transition-all duration-300 hover:-translate-y-1">
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-colors" />
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-purple-500/20 flex items-center justify-center mb-6">
                  <span className="text-3xl">🧬</span>
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">Dynamic Agent Architecture</h3>
                <p className="text-slate-400 mb-4 leading-relaxed">
                  Agents that adapt to your task in real-time. They plan, execute, observe results,
                  and adjust strategy dynamically. Not scripted. Intelligent.
                </p>
                <ul className="space-y-2 text-sm text-slate-300">
                  <li className="flex items-center gap-2">
                    <span className="text-purple-400">→</span>
                    Context-aware decision making
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-purple-400">→</span>
                    Adaptive task decomposition
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-purple-400">→</span>
                    Real-time strategy adjustment
                  </li>
                </ul>
              </div>
            </div>

            {/* MCP Integration */}
            <div className="group relative bg-gradient-to-br from-blue-900/30 to-blue-900/10 rounded-2xl p-8 border border-blue-500/20 hover:border-blue-500/50 transition-all duration-300 hover:-translate-y-1">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-colors" />
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-blue-500/20 flex items-center justify-center mb-6">
                  <span className="text-3xl">🔌</span>
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">MCP Protocol Native</h3>
                <p className="text-slate-400 mb-4 leading-relaxed">
                  Connect to any tool through Model Context Protocol. Databases, browsers, APIs,
                  custom services. Your agents speak to the entire ecosystem.
                </p>
                <ul className="space-y-2 text-sm text-slate-300">
                  <li className="flex items-center gap-2">
                    <span className="text-blue-400">→</span>
                    Universal tool connectivity
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-blue-400">→</span>
                    Custom MCP server support
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-blue-400">→</span>
                    Infinite extensibility
                  </li>
                </ul>
              </div>
            </div>

            {/* Self-Correcting Execution */}
            <div className="group relative bg-gradient-to-br from-pink-900/30 to-pink-900/10 rounded-2xl p-8 border border-pink-500/20 hover:border-pink-500/50 transition-all duration-300 hover:-translate-y-1">
              <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/10 rounded-full blur-2xl group-hover:bg-pink-500/20 transition-colors" />
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-pink-500/20 flex items-center justify-center mb-6">
                  <span className="text-3xl">🔄</span>
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">Self-Correcting Execution</h3>
                <p className="text-slate-400 mb-4 leading-relaxed">
                  Errors are data, not failures. Agents detect issues, analyze root causes,
                  generate fixes, and retry autonomously until the task succeeds.
                </p>
                <ul className="space-y-2 text-sm text-slate-300">
                  <li className="flex items-center gap-2">
                    <span className="text-pink-400">→</span>
                    Intelligent error analysis
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-pink-400">→</span>
                    Automatic fix generation
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-pink-400">→</span>
                    Persistent until success
                  </li>
                </ul>
              </div>
            </div>

            {/* Persistent Memory */}
            <div className="group relative bg-gradient-to-br from-amber-900/30 to-amber-900/10 rounded-2xl p-8 border border-amber-500/20 hover:border-amber-500/50 transition-all duration-300 hover:-translate-y-1">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-colors" />
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/20 flex items-center justify-center mb-6">
                  <span className="text-3xl">🧠</span>
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">Persistent Memory</h3>
                <p className="text-slate-400 mb-4 leading-relaxed">
                  Context that survives sessions. Your preferences, your projects, your patterns.
                  The agent learns you and gets better over time.
                </p>
                <ul className="space-y-2 text-sm text-slate-300">
                  <li className="flex items-center gap-2">
                    <span className="text-amber-400">→</span>
                    Cross-session continuity
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-amber-400">→</span>
                    Project-aware context
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-amber-400">→</span>
                    Preference learning
                  </li>
                </ul>
              </div>
            </div>

            {/* GitHub Native */}
            <div className="group relative bg-gradient-to-br from-green-900/30 to-green-900/10 rounded-2xl p-8 border border-green-500/20 hover:border-green-500/50 transition-all duration-300 hover:-translate-y-1">
              <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-full blur-2xl group-hover:bg-green-500/20 transition-colors" />
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-green-500/20 flex items-center justify-center mb-6">
                  <svg className="w-8 h-8 text-green-400" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">GitHub Native</h3>
                <p className="text-slate-400 mb-4 leading-relaxed">
                  Full version control workflow built in. Clone, branch, commit, push, PR.
                  Your code goes where it belongs with zero friction.
                </p>
                <ul className="space-y-2 text-sm text-slate-300">
                  <li className="flex items-center gap-2">
                    <span className="text-green-400">→</span>
                    Complete Git operations
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-400">→</span>
                    PR automation
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-green-400">→</span>
                    Repository intelligence
                  </li>
                </ul>
              </div>
            </div>

            {/* Sandboxed Execution */}
            <div className="group relative bg-gradient-to-br from-cyan-900/30 to-cyan-900/10 rounded-2xl p-8 border border-cyan-500/20 hover:border-cyan-500/50 transition-all duration-300 hover:-translate-y-1">
              <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl group-hover:bg-cyan-500/20 transition-colors" />
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 flex items-center justify-center mb-6">
                  <span className="text-3xl">🔒</span>
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">Sandboxed Execution</h3>
                <p className="text-slate-400 mb-4 leading-relaxed">
                  Full Linux environment, completely isolated. Run anything with zero risk
                  to your machine. Enterprise-grade security by default.
                </p>
                <ul className="space-y-2 text-sm text-slate-300">
                  <li className="flex items-center gap-2">
                    <span className="text-cyan-400">→</span>
                    Isolated cloud environments
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-cyan-400">→</span>
                    Full shell access
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-cyan-400">→</span>
                    Zero local risk
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

      {/* Identity Section - Subtle, Confident */}
      <section className="relative bg-gradient-to-b from-black via-slate-900/50 to-black py-20 overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
              Founded on faith.<br />
              <span className="text-slate-400">Open to all.</span>
            </h2>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto">
              We&apos;re engineers who happen to believe in something bigger. We built what we wanted to use —
              enterprise AI infrastructure with values we trust. You&apos;re welcome to use it too.
            </p>
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


      {/* Capabilities Grid */}
      <section className="relative bg-slate-900 py-24 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 right-10 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-20 left-10 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl" />
        </div>

        <div className="container mx-auto px-4 relative">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">Full-Stack AI Infrastructure</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              Everything you need. Nothing you don&apos;t.
            </p>
          </div>

          <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto">
            {[
              { icon: '🌐', title: 'Website Builder', desc: 'AI-generated sites from description' },
              { icon: '🚀', title: 'Project Scaffolding', desc: 'Full applications, ready to deploy' },
              { icon: '👁️', title: 'Live Preview', desc: 'See code render in real-time' },
              { icon: '☁️', title: 'One-Click Deploy', desc: 'Straight to production' },
              { icon: '🤖', title: 'Agentic Execution', desc: 'Autonomous task completion' },
              { icon: '🧪', title: 'Automated Testing', desc: 'AI-generated test coverage' },
              { icon: '🗄️', title: 'Database Design', desc: 'Schema generation and migrations' },
              { icon: '🔌', title: 'API Builder', desc: 'Type-safe endpoints' },
              { icon: '🎨', title: 'Asset Generation', desc: 'Logos, images, brand assets' },
              { icon: '💻', title: 'Code Execution', desc: 'Sandboxed with auto-fix' },
              { icon: '📦', title: 'GitHub Native', desc: 'Full workflow integration' },
              { icon: '🧠', title: 'Persistent Memory', desc: 'Context that carries over' },
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
