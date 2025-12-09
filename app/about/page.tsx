/**
 * ABOUT US PAGE
 *
 * PURPOSE:
 * - Tell the JCIL.AI story
 * - Build trust and credibility
 * - Explain mission and values
 */

import Link from 'next/link';

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="container mx-auto px-4 py-4">
          <nav className="flex items-center justify-between">
            <Link href="/" className="text-2xl font-bold text-slate-900">
              JCIL.AI
            </Link>
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

      {/* Hero */}
      <section className="bg-gradient-to-b from-slate-50 to-white py-16 sm:py-24">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-4xl text-center">
            <h1 className="mb-6 text-4xl sm:text-5xl font-bold text-slate-900">About JCIL.AI</h1>
            <p className="text-xl text-slate-600">
              Building AI tools that serve people of faith.
            </p>
          </div>
        </div>
      </section>

      {/* Our Story */}
      <section className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-6 text-3xl font-bold text-slate-900">Our Story</h2>
          <div className="space-y-6 text-lg text-slate-600 leading-relaxed">
            <p>
              JCIL.AI was founded with a simple observation: the most powerful AI tools in the world
              are built in Silicon Valley, often reflecting values that do not align with millions
              of Americans who hold traditional, faith-based beliefs.
            </p>
            <p>
              As artificial intelligence becomes more influential in how we learn, work, and
              communicate, we saw a growing need for tools that respect and reinforce the values
              of people of faith rather than challenge them.
            </p>
            <p>
              Our founder, a computer programmer specializing in tool development, deep research,
              and security systems engineering, set out to build something different: an AI platform
              built on world-class infrastructure, wrapped in a protective layer designed specifically
              to serve Christians and people of faith.
            </p>
          </div>
        </div>
      </section>

      {/* Our Mission */}
      <section className="bg-slate-50 py-12">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl">
            <h2 className="mb-6 text-3xl font-bold text-slate-900">Our Mission</h2>
            <div className="space-y-6 text-lg text-slate-600 leading-relaxed">
              <p>
                We believe that if people of faith do not build their own tools, others will build
                them for us. And those tools will not share our values.
              </p>
              <p>
                JCIL.AI exists to ensure that Christians and people of faith have access to powerful,
                modern AI technology that they can trust. Technology that empowers without replacing
                human thinking. Technology that serves without compromising beliefs.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Our Values */}
      <section className="container mx-auto px-4 py-12">
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-8 text-3xl font-bold text-slate-900">Our Values</h2>
          <div className="space-y-6">
            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
              <h3 className="mb-3 text-xl font-semibold text-slate-900">Human Development Matters</h3>
              <p className="text-slate-600">
                We will help a pastor outline a sermon, but we believe sermons should be Spirit-led.
                We will help a student study and identify weaknesses, but we will not write their
                papers for them. AI should assist human growth, not replace it.
              </p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
              <h3 className="mb-3 text-xl font-semibold text-slate-900">Safe for Families</h3>
              <p className="text-slate-600">
                Our platform includes enterprise-grade content moderation. No adult content. No profane language.
                Clear community guidelines. JCIL.AI is a place where families can use AI without
                worrying about what they might encounter.
              </p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
              <h3 className="mb-3 text-xl font-semibold text-slate-900">Privacy as Stewardship</h3>
              <p className="text-slate-600">
                We take the stewardship of your data seriously. Your conversations are encrypted
                and automatically deleted after 6 months. All data is processed on American servers.
                We do not sell your data or use it for purposes beyond providing you with the service you paid for.
              </p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
              <h3 className="mb-3 text-xl font-semibold text-slate-900">Scripture as Foundation</h3>
              <p className="text-slate-600">
                We believe Scripture is the written Word of God. JCIL.AI is designed to be a
                study aid that helps users explore the Bible, develop Bible studies, and deepen
                their faith with an assistant that shares their reverence for God&apos;s Word.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Enterprise Security */}
      <section className="bg-blue-900 py-12 text-white">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="mb-6 text-3xl font-bold">Enterprise-Grade Security</h2>
            <p className="text-lg text-blue-200 mb-8">
              Your trust is our priority. We&apos;ve built JCIL.AI with the same security standards
              used by Fortune 500 companies.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="bg-white/10 rounded-xl p-4 border border-white/20">
                <div className="text-2xl mb-2">🇺🇸</div>
                <h4 className="font-semibold mb-1">American Servers</h4>
                <p className="text-sm text-blue-200">All data processed exclusively on US soil</p>
              </div>
              <div className="bg-white/10 rounded-xl p-4 border border-white/20">
                <div className="text-2xl mb-2">🔒</div>
                <h4 className="font-semibold mb-1">AES-256 Encryption</h4>
                <p className="text-sm text-blue-200">Industry-standard encryption at rest and in transit</p>
              </div>
              <div className="bg-white/10 rounded-xl p-4 border border-white/20">
                <div className="text-2xl mb-2">🛡️</div>
                <h4 className="font-semibold mb-1">Content Moderation</h4>
                <p className="text-sm text-blue-200">Multi-layer enterprise moderation system</p>
              </div>
              <div className="bg-white/10 rounded-xl p-4 border border-white/20">
                <div className="text-2xl mb-2">⚡</div>
                <h4 className="font-semibold mb-1">99.9% Uptime</h4>
                <p className="text-sm text-blue-200">Reliable service when you need it</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-slate-50 py-16">
        <div className="container mx-auto px-4 text-center">
          <div className="mx-auto max-w-2xl bg-white rounded-3xl p-8 sm:p-12 shadow-lg border border-slate-200">
            <h2 className="mb-4 text-3xl font-bold text-slate-900">Join Our Community</h2>
            <p className="mb-8 text-lg text-slate-600">
              Experience AI that was built with your values in mind.
            </p>
            <Link
              href="/signup"
              className="inline-block rounded-lg bg-blue-900 px-8 py-4 text-lg font-semibold text-white hover:bg-blue-800 transition"
            >
              Get Started
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-12">
        <div className="container mx-auto px-4 text-center text-sm text-slate-400">
          <p>&copy; {new Date().getFullYear()} JCIL.AI. All rights reserved.</p>
          <div className="mt-4 space-x-4">
            <Link href="/privacy" className="hover:text-white transition">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-white transition">Terms of Service</Link>
            <Link href="/" className="hover:text-white transition">Home</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
