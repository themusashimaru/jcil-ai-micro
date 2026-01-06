/**
 * API ACCESS COMING SOON PAGE
 *
 * Placeholder page for API access with signup form
 */

import Link from 'next/link';
import LandingLogo from '../components/LandingLogo';

export const metadata = {
  title: 'API Access Coming Soon | JCIL.AI',
  description: 'Programmatic access to JCIL.AI capabilities. Join the waitlist for early access.',
};

export default function APIPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-black/80 border-b border-white/10">
        <div className="container mx-auto px-4 py-4">
          <nav className="flex items-center justify-between">
            <Link href="/">
              <LandingLogo />
            </Link>

            <div className="hidden md:flex items-center space-x-6">
              <Link href="/" className="text-slate-400 hover:text-white font-medium transition">
                Home
              </Link>
              <Link href="/code-lab" className="text-slate-400 hover:text-white font-medium transition">
                Code Lab
              </Link>
              <Link href="/docs" className="text-slate-400 hover:text-white font-medium transition">
                Docs
              </Link>
            </div>

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
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-32">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-full blur-[100px]" />
        </div>

        <div className="container mx-auto px-4 text-center relative">
          <div className="mx-auto max-w-3xl">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 backdrop-blur-sm border border-blue-500/30 mb-8">
              <span className="text-blue-400">🔌</span>
              <span className="text-sm font-medium text-blue-300">Coming Soon</span>
            </div>

            <h1 className="mb-6 text-5xl sm:text-6xl font-bold leading-tight tracking-tight">
              <span className="text-white">JCIL.AI</span>
              <br />
              <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                API Access
              </span>
            </h1>

            <p className="mx-auto mb-10 max-w-2xl text-xl text-slate-400 leading-relaxed">
              Programmatic access to all JCIL.AI capabilities. Build custom integrations,
              automate workflows, and extend your applications with AI power.
            </p>

            {/* Planned Features */}
            <div className="flex flex-wrap items-center justify-center gap-3 mb-12">
              {['REST API', 'WebSocket Streaming', 'Code Execution', 'GitHub Integration', 'Rate Limiting', 'Usage Analytics'].map((feature, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-slate-300"
                >
                  <span className="text-blue-400">◦</span>
                  <span>{feature}</span>
                </div>
              ))}
            </div>

            {/* Waitlist Form */}
            <div className="max-w-md mx-auto">
              <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl p-8 border border-slate-800">
                <h3 className="text-xl font-semibold mb-4">Join the Waitlist</h3>
                <p className="text-slate-400 text-sm mb-6">
                  Be the first to know when API access is available. Early adopters get priority access and special pricing.
                </p>
                <form className="space-y-4">
                  <input
                    type="email"
                    placeholder="Enter your email"
                    className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
                  />
                  <button
                    type="submit"
                    className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-3 text-white font-semibold hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-300"
                  >
                    Notify Me
                  </button>
                </form>
                <p className="text-xs text-slate-500 mt-4">
                  No spam. We&apos;ll only email you about API access.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What to Expect */}
      <section className="py-24 border-t border-white/10">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white mb-4">What to Expect</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">
              We&apos;re building a comprehensive API that gives you full access to JCIL.AI capabilities.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3 max-w-5xl mx-auto">
            {[
              {
                icon: '🚀',
                title: 'REST API',
                desc: 'Simple HTTP endpoints for chat completions, code execution, and more. Easy to integrate with any language.',
              },
              {
                icon: '⚡',
                title: 'Streaming',
                desc: 'WebSocket support for real-time streaming responses. Perfect for chat interfaces and live updates.',
              },
              {
                icon: '📊',
                title: 'Dashboard',
                desc: 'Monitor usage, manage API keys, and view analytics. Full visibility into your API consumption.',
              },
            ].map((feature, i) => (
              <div key={i} className="text-center">
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className="text-xl font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-slate-400">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-24 bg-slate-900/50 border-y border-white/10">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-white mb-4">Use Cases</h2>
            <p className="text-slate-400">Build powerful applications with JCIL.AI API</p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto">
            {[
              { icon: '💬', title: 'Custom Chatbots', desc: 'Build AI assistants for your platform' },
              { icon: '🔄', title: 'Automation', desc: 'Automate code reviews and analysis' },
              { icon: '📱', title: 'Mobile Apps', desc: 'Add AI features to mobile applications' },
              { icon: '🔧', title: 'Developer Tools', desc: 'Create IDE plugins and extensions' },
            ].map((item, i) => (
              <div key={i} className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50">
                <div className="text-3xl mb-3">{item.icon}</div>
                <h3 className="font-semibold text-white mb-2">{item.title}</h3>
                <p className="text-slate-400 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Preview */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-white mb-4">Fair, Usage-Based Pricing</h2>
            <p className="text-slate-400 mb-8">
              Pay only for what you use. No minimum commitments.
            </p>
            <div className="bg-slate-900/50 rounded-2xl p-8 border border-slate-800">
              <div className="text-5xl font-bold text-white mb-2">$0.01</div>
              <div className="text-slate-400 mb-6">per 1,000 tokens (estimated)</div>
              <ul className="space-y-3 text-left max-w-sm mx-auto">
                {[
                  'Generous free tier for testing',
                  'Volume discounts available',
                  'No rate limiting on paid plans',
                  'Enterprise plans for high volume',
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-slate-300">
                    <span className="text-green-400">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black py-12 border-t border-white/10">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-slate-500 text-sm">
              &copy; {new Date().getFullYear()} JCIL.AI. All rights reserved.
            </div>
            <div className="flex gap-6 text-sm">
              <Link href="/" className="text-slate-500 hover:text-white transition">Home</Link>
              <Link href="/docs" className="text-slate-500 hover:text-white transition">Docs</Link>
              <Link href="/contact" className="text-slate-500 hover:text-white transition">Contact</Link>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
