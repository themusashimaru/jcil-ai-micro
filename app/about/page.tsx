/**
 * ABOUT US PAGE
 *
 * PURPOSE:
 * - Tell the JCIL.AI story with confidence
 * - Dark theme, tier-one presentation
 * - Faith foundation, open to all
 */

import Link from 'next/link';
import LandingLogo from '../components/LandingLogo';
import MobileMenu from '../components/MobileMenu';

export default function AboutPage() {
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
              <Link href="/#capabilities" className="text-slate-400 hover:text-white font-medium transition">
                Capabilities
              </Link>
              <Link href="/code-lab" className="text-slate-400 hover:text-white font-medium transition">
                Code Lab
              </Link>
              <Link href="/docs" className="text-slate-400 hover:text-white font-medium transition">
                Docs
              </Link>
              <Link href="/#pricing" className="text-slate-400 hover:text-white font-medium transition">
                Pricing
              </Link>
            </div>

            <div className="hidden md:flex items-center space-x-4">
              <Link href="/login" className="px-4 py-2 text-slate-400 hover:text-white font-medium transition">
                Log In
              </Link>
              <Link
                href="/signup"
                className="rounded-xl bg-white px-6 py-2 text-black font-semibold hover:bg-slate-100 transition-all duration-300"
              >
                Get Started
              </Link>
            </div>

            <MobileMenu />
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative py-24 sm:py-32 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[100px]" />
          <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[100px]" />
        </div>

        <div className="container mx-auto px-4 relative">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="mb-6 text-5xl sm:text-6xl font-bold">
              <span className="text-white">About</span>{' '}
              <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">JCIL.AI</span>
            </h1>
            <p className="text-xl text-slate-400">
              Enterprise AI infrastructure. Founded on faith, open to all.
            </p>
          </div>
        </div>
      </section>

      {/* Our Story */}
      <section className="py-20 border-t border-white/10">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl">
            <h2 className="mb-8 text-3xl font-bold text-white">The Origin</h2>
            <div className="space-y-6 text-lg text-slate-400 leading-relaxed">
              <p>
                We started with a simple observation: the most powerful AI tools are built by teams
                that don&apos;t share our values. That&apos;s not a criticism — it&apos;s just reality.
              </p>
              <p>
                So we built our own. Not a watered-down alternative. Not a &quot;safe&quot; version with
                fewer features. A full enterprise-grade AI platform with agentic execution, persistent
                memory, MCP integration, and everything else you&apos;d expect from a tier-one solution.
              </p>
              <p className="text-slate-300">
                The only difference? We built it with intention. With values we trust.
                And we made it available to everyone.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* What We Believe */}
      <section className="py-20 bg-slate-900/50 border-y border-white/10">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl">
            <h2 className="mb-8 text-3xl font-bold text-white">What We Believe</h2>
            <div className="space-y-6">
              <div className="bg-black/50 rounded-2xl p-6 border border-white/10">
                <h3 className="mb-3 text-xl font-semibold text-white">AI Should Augment, Not Replace</h3>
                <p className="text-slate-400">
                  We build tools that make you more capable, not tools that do your thinking for you.
                  The human stays in the loop. The human makes the decisions.
                </p>
              </div>

              <div className="bg-black/50 rounded-2xl p-6 border border-white/10">
                <h3 className="mb-3 text-xl font-semibold text-white">Privacy Is Non-Negotiable</h3>
                <p className="text-slate-400">
                  Your data is yours. We don&apos;t train on your conversations. We don&apos;t sell your information.
                  Everything is encrypted, auto-deleted after 6 months, and processed on American servers.
                </p>
              </div>

              <div className="bg-black/50 rounded-2xl p-6 border border-white/10">
                <h3 className="mb-3 text-xl font-semibold text-white">Excellence Without Compromise</h3>
                <p className="text-slate-400">
                  Faith-founded doesn&apos;t mean feature-limited. We compete on capability.
                  Dynamic agents, MCP connectivity, full GitHub workflow, sandboxed execution —
                  everything you need from enterprise AI.
                </p>
              </div>

              <div className="bg-black/50 rounded-2xl p-6 border border-white/10">
                <h3 className="mb-3 text-xl font-semibold text-white">Open to Everyone</h3>
                <p className="text-slate-400">
                  We built this for ourselves, but we made it for everyone. You don&apos;t have to share
                  our beliefs to use our tools. You just have to want something that works.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Technical Foundation */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-4xl">
            <h2 className="mb-8 text-3xl font-bold text-white text-center">Technical Foundation</h2>
            <p className="text-center text-slate-400 mb-12 max-w-2xl mx-auto">
              Built on proven infrastructure. No compromises on capability.
            </p>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { icon: '🔒', title: 'E2B Sandbox', desc: 'Isolated execution environments' },
                { icon: '🇺🇸', title: 'US Servers', desc: 'All data on American soil' },
                { icon: '🔐', title: 'AES-256', desc: 'Enterprise encryption' },
                { icon: '⚡', title: 'Edge Deploy', desc: 'Global low-latency' },
              ].map((item, i) => (
                <div key={i} className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50 text-center">
                  <div className="text-3xl mb-3">{item.icon}</div>
                  <h4 className="font-semibold text-white mb-1">{item.title}</h4>
                  <p className="text-sm text-slate-400">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 border-t border-white/10">
        <div className="container mx-auto px-4 text-center">
          <div className="mx-auto max-w-2xl">
            <h2 className="mb-4 text-3xl font-bold text-white">Ready to Build?</h2>
            <p className="mb-8 text-lg text-slate-400">
              Enterprise AI that works the way you think.
            </p>
            <Link
              href="/signup"
              className="inline-block rounded-xl bg-white px-10 py-4 text-lg font-semibold text-black hover:bg-slate-100 transition-all duration-300"
            >
              Get Started
            </Link>
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
              <Link href="/privacy" className="text-slate-500 hover:text-white transition">Privacy</Link>
              <Link href="/terms" className="text-slate-500 hover:text-white transition">Terms</Link>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
