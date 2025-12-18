/**
 * CODING SHOWCASE PAGE
 *
 * PURPOSE:
 * - Dedicated page showcasing AI coding capabilities
 * - Multiple interactive demos
 * - Convert developers and technical users
 */

import Link from 'next/link';
import CodeShowcase from '../components/CodeShowcase';
import LandingLogo from '../components/LandingLogo';
import MobileMenu from '../components/MobileMenu';

export const metadata = {
  title: 'AI Coding Assistant | JCIL.AI',
  description: 'World-class AI coding assistant with live code execution, full-stack generation, intelligent debugging, and more. See what advanced AI can do for developers.',
};

export default function CodingPage() {
  return (
    <main className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-900/80 border-b border-slate-700/50">
        <div className="container mx-auto px-4 py-4">
          <nav className="flex items-center justify-between">
            <Link href="/">
              <LandingLogo />
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-6">
              <Link href="/#how-it-works" className="text-slate-400 hover:text-white font-medium transition">
                How It Works
              </Link>
              <Link href="/#pricing" className="text-slate-400 hover:text-white font-medium transition">
                Pricing
              </Link>
              <Link href="/about" className="text-slate-400 hover:text-white font-medium transition">
                About
              </Link>
            </div>

            {/* Desktop CTA */}
            <div className="hidden md:flex items-center space-x-4">
              <Link href="/login" className="px-4 py-2 text-slate-300 hover:text-white font-medium transition">
                Log In
              </Link>
              <Link
                href="/signup"
                className="rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-2 text-white font-semibold hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-300"
              >
                Start Coding Free
              </Link>
            </div>

            <MobileMenu />
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 sm:py-28">
        {/* Background Effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-cyan-500/5 rounded-full blur-3xl" />
        </div>

        <div className="container mx-auto px-4 relative">
          <div className="text-center max-w-4xl mx-auto mb-12">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium mb-6">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
              Powered by World-Class AI
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
              AI That Actually{' '}
              <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-purple-400 bg-clip-text text-transparent">
                Writes & Runs Code
              </span>
            </h1>

            <p className="text-xl text-slate-300 mb-8 max-w-2xl mx-auto">
              Not just code suggestions. Our AI generates complete applications, executes Python in real-time,
              debugs complex issues, and handles million-token codebases.
            </p>

            {/* Stats */}
            <div className="flex flex-wrap justify-center gap-8 mb-10">
              <div className="text-center">
                <div className="text-3xl font-bold text-white">1M+</div>
                <div className="text-sm text-slate-400">Token Context</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-white">30+</div>
                <div className="text-sm text-slate-400">Languages</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-white">Live</div>
                <div className="text-sm text-slate-400">Code Execution</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-white">64K</div>
                <div className="text-sm text-slate-400">Token Output</div>
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-4">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-8 py-4 text-lg font-semibold text-white hover:shadow-xl hover:shadow-blue-500/25 transition-all duration-300 hover:-translate-y-0.5"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                Start Coding Free
              </Link>
              <Link
                href="#demos"
                className="inline-flex items-center gap-2 rounded-xl bg-slate-700/50 border border-slate-600 px-8 py-4 text-lg font-semibold text-white hover:bg-slate-700 transition-all duration-300"
              >
                See Demos Below
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Capabilities Grid */}
      <section className="py-16 border-t border-slate-800">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl sm:text-3xl font-bold text-white text-center mb-12">
            What Makes Our AI Different
          </h2>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
            {[
              {
                icon: '⚡',
                title: 'Live Code Execution',
                desc: 'Actually runs Python code and returns real results. Calculate, analyze data, generate charts - all in real-time.',
              },
              {
                icon: '🧠',
                title: '1 Million Token Context',
                desc: 'Feed entire codebases, documentation, and complex requirements. No more truncated context.',
              },
              {
                icon: '🚀',
                title: 'Full-Stack Generation',
                desc: 'Describe what you want, get complete applications with frontend, backend, and database schemas.',
              },
              {
                icon: '🔍',
                title: 'Intelligent Debugging',
                desc: 'Paste error messages and code. Get root cause analysis and working fixes, not just suggestions.',
              },
              {
                icon: '📊',
                title: 'Data Analysis & Charts',
                desc: 'Upload CSVs, analyze data, generate matplotlib visualizations - all through natural conversation.',
              },
              {
                icon: '✨',
                title: 'Code Refactoring',
                desc: 'Transform messy code into clean, typed, well-documented implementations following best practices.',
              },
            ].map((feature, index) => (
              <div
                key={index}
                className="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50 hover:border-blue-500/30 transition-colors"
              >
                <div className="text-3xl mb-4">{feature.icon}</div>
                <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-slate-400 text-sm">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Interactive Demos Section */}
      <section id="demos" className="py-20 border-t border-slate-800">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">See It In Action</h2>
            <p className="text-lg text-slate-300 max-w-2xl mx-auto">
              Click through real examples of what our AI can do. This is actual AI output, not mockups.
            </p>
          </div>

          <CodeShowcase />
        </div>
      </section>

      {/* Use Cases Section */}
      <section className="py-20 border-t border-slate-800 bg-slate-800/30">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-white text-center mb-12">Built For Every Developer</h2>

          <div className="grid gap-8 md:grid-cols-2 max-w-4xl mx-auto">
            {[
              {
                title: 'Students & Learners',
                icon: '📚',
                points: [
                  'Get explanations that actually make sense',
                  'Step-by-step debugging with learning context',
                  'Practice problems with instant feedback',
                ],
              },
              {
                title: 'Professional Developers',
                icon: '💼',
                points: [
                  'Rapid prototyping and scaffolding',
                  'Code review and security analysis',
                  'API integration and documentation',
                ],
              },
              {
                title: 'Startup Founders',
                icon: '🚀',
                points: [
                  'MVP generation from descriptions',
                  'Full-stack architecture design',
                  'Database schema and API design',
                ],
              },
              {
                title: 'Data Scientists',
                icon: '📊',
                points: [
                  'Data cleaning and transformation',
                  'Statistical analysis and visualization',
                  'ML pipeline scaffolding',
                ],
              },
            ].map((useCase, index) => (
              <div key={index} className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700/50">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl">{useCase.icon}</span>
                  <h3 className="text-xl font-semibold text-white">{useCase.title}</h3>
                </div>
                <ul className="space-y-2">
                  {useCase.points.map((point, i) => (
                    <li key={i} className="flex items-start gap-2 text-slate-300 text-sm">
                      <span className="text-blue-400 mt-0.5">✓</span>
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 border-t border-slate-800">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Ready to Code Smarter?
          </h2>
          <p className="text-lg text-slate-300 mb-8 max-w-xl mx-auto">
            Join thousands of developers using AI to build faster, debug smarter, and ship better code.
          </p>

          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-8 py-4 text-lg font-semibold text-white hover:shadow-xl hover:shadow-blue-500/25 transition-all duration-300"
            >
              Start Free Trial
            </Link>
            <Link
              href="/#pricing"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-600 px-8 py-4 text-lg font-semibold text-white hover:bg-slate-800 transition-all duration-300"
            >
              View Pricing
            </Link>
          </div>

          <p className="text-slate-500 text-sm mt-6">
            No credit card required. Cancel anytime.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-slate-500 text-sm">
              &copy; {new Date().getFullYear()} JCIL.AI. All rights reserved.
            </div>
            <div className="flex gap-6 text-sm">
              <Link href="/terms" className="text-slate-500 hover:text-white transition">Terms</Link>
              <Link href="/privacy" className="text-slate-500 hover:text-white transition">Privacy</Link>
              <Link href="/contact" className="text-slate-500 hover:text-white transition">Contact</Link>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
