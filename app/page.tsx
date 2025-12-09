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

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="container mx-auto px-4 py-4">
          <nav className="flex items-center justify-between">
            <div className="text-2xl font-bold text-slate-900">JCIL.AI</div>
            <div className="flex items-center space-x-2 sm:space-x-4">
              <Link href="/login" className="px-3 py-2 text-slate-700 hover:text-slate-900 text-sm sm:text-base font-medium">
                Log In
              </Link>
              <Link
                href="/signup"
                className="rounded-lg bg-blue-900 px-4 py-2 sm:px-6 text-white font-semibold hover:bg-blue-800 text-sm sm:text-base transition"
              >
                Sign Up
              </Link>
            </div>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-b from-slate-50 to-white py-16 sm:py-24">
        <div className="container mx-auto px-4 text-center">
          <div className="mx-auto max-w-4xl">
            <h1 className="mb-6 text-4xl sm:text-5xl md:text-6xl font-bold leading-tight tracking-tight text-slate-900">
              AI-Powered Tools
              <br />
              <span className="text-blue-800">Built for People of Faith</span>
            </h1>
            <p className="mx-auto mb-10 max-w-2xl text-lg sm:text-xl text-slate-600 leading-relaxed">
              Intelligent assistance that respects your values. Get answers, conduct research,
              and create content with an AI designed to serve your needs without compromising your beliefs.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/signup"
                className="w-full sm:w-auto rounded-lg bg-blue-900 px-8 py-4 text-lg font-semibold text-white hover:bg-blue-800 transition shadow-lg"
              >
                Get Started
              </Link>
              <Link
                href="#how-it-works"
                className="w-full sm:w-auto rounded-lg border-2 border-slate-300 px-8 py-4 text-lg font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Learn More
              </Link>
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
              <span className="px-4 py-2 rounded-full bg-white/10 border border-white/20">SOC 2 Type II Standards</span>
              <span className="px-4 py-2 rounded-full bg-white/10 border border-white/20">GDPR Compliant</span>
              <span className="px-4 py-2 rounded-full bg-white/10 border border-white/20">CCPA Compliant</span>
              <span className="px-4 py-2 rounded-full bg-white/10 border border-white/20">99.9% Uptime SLA</span>
            </div>
          </div>
        </div>
      </section>

      {/* Tools Section */}
      <section className="bg-white py-16 sm:py-20">
        <div className="container mx-auto px-4">
          <h2 className="mb-4 text-center text-3xl sm:text-4xl font-bold text-slate-900">Powerful Tools at Your Fingertips</h2>
          <p className="mb-12 text-center text-slate-600 max-w-2xl mx-auto">
            Everything you need to research, write, study, and create.
          </p>
          <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
            {[
              { icon: '💬', title: 'AI Chat', desc: 'Intelligent conversation for any topic' },
              { icon: '🔍', title: 'Real-Time Fact-Checking', desc: 'Perplexity-powered accurate research' },
              { icon: '📰', title: 'Breaking News', desc: 'Curated news updated every 30 minutes' },
              { icon: '📖', title: 'Bible Study', desc: 'Scripture exploration and study aids' },
              { icon: '✍️', title: 'Writing Tools', desc: 'Essays, emails, and content creation' },
              { icon: '📄', title: 'Resume Builder', desc: 'Professional resumes and cover letters' },
              { icon: '📊', title: 'Data Analysis', desc: 'Upload and analyze spreadsheets' },
              { icon: '💻', title: 'Code Assistant', desc: 'Programming help and debugging' },
              { icon: '🙏', title: 'Daily Devotional', desc: 'Fresh spiritual content every day' },
            ].map((tool, index) => (
              <div key={index} className="flex items-start gap-4 rounded-xl bg-slate-50 p-4 sm:p-5 border border-slate-200">
                <div className="text-2xl">{tool.icon}</div>
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
