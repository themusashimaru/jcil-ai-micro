/**
 * ABOUT US PAGE
 *
 * The JCIL.AI story — faith-founded, enterprise-grade
 * Uses shared header/footer for consistency
 */

import Link from 'next/link';
import LandingHeader from '../components/landing/LandingHeader';
import LandingFooter from '../components/landing/LandingFooter';

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <LandingHeader />

      {/* Hero */}
      <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-28 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[100px]" />
          <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[100px]" />
        </div>

        <div className="container mx-auto px-4 relative">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="mb-6 text-5xl sm:text-6xl font-bold">
              <span className="text-white">About</span>{' '}
              <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                JCIL.AI
              </span>
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
                that don&apos;t share our values. That&apos;s not a criticism&mdash;it&apos;s just
                reality.
              </p>
              <p>
                So we built our own. Not a watered-down alternative. Not a &quot;safe&quot; version
                with fewer features. A full enterprise-grade AI platform with 51 real tools, E2B
                sandboxed execution, persistent memory, multi-model support, and 136+ Composio
                integrations.
              </p>
              <p className="text-slate-300">
                The only difference? We built it with intention. With values we trust. And we made
                it available to everyone.
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
              {[
                {
                  title: 'AI Should Augment, Not Replace',
                  desc: 'We build tools that make you more capable, not tools that do your thinking for you. The human stays in the loop. The human makes the decisions.',
                },
                {
                  title: 'Privacy Is Non-Negotiable',
                  desc: "Your data is yours. We don't train on your conversations. We don't sell your information. Everything is encrypted, auto-deleted after 6 months, and processed on American servers.",
                },
                {
                  title: 'Excellence Without Compromise',
                  desc: "Faith-founded doesn't mean feature-limited. We compete on capability. 51 real tools, multi-model support, full GitHub workflow, sandboxed execution\u2014everything you need from enterprise AI.",
                },
                {
                  title: 'Open to Everyone',
                  desc: "We built this for ourselves, but we made it for everyone. You don't have to share our beliefs to use our tools. You just have to want something that works.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="bg-black/50 rounded-2xl p-6 border border-white/10"
                >
                  <h3 className="mb-3 text-xl font-semibold text-white">{item.title}</h3>
                  <p className="text-slate-400">{item.desc}</p>
                </div>
              ))}
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
                { title: 'E2B Sandbox', desc: 'Isolated execution environments' },
                { title: 'US Servers', desc: 'All data on American soil' },
                { title: 'AES-256', desc: 'Enterprise encryption' },
                { title: 'Edge Deploy', desc: 'Global low-latency via Vercel' },
              ].map((item) => (
                <div
                  key={item.title}
                  className="bg-slate-800/50 rounded-xl p-6 border border-slate-700/50 text-center"
                >
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

      <LandingFooter />
    </main>
  );
}
