/**
 * JCIL.AI LANDING PAGE
 *
 * PURPOSE:
 * - Public homepage for JCIL.AI
 * - Professional SaaS landing page
 * - Faith-based AI chat assistant
 */

import Link from 'next/link';
import PricingSection from './components/PricingSection';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <nav className="flex items-center justify-between">
          <div className="text-2xl font-bold">JCIL.AI</div>
          <div className="flex items-center space-x-2 sm:space-x-4">
            <Link href="/login" className="px-3 py-2 hover:text-gray-300 text-sm sm:text-base">
              Log In
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-white px-4 py-2 sm:px-6 text-black font-semibold hover:bg-gray-200 text-sm sm:text-base"
            >
              Sign Up
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 sm:py-24 text-center">
        <div className="mx-auto max-w-4xl">
          <h1 className="mb-6 text-4xl sm:text-5xl md:text-6xl font-bold leading-tight tracking-tight">
            AI-Powered Tools
            <br />
            <span className="text-blue-400">Built for People of Faith</span>
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-lg sm:text-xl text-gray-300 leading-relaxed">
            Intelligent assistance that respects your values. Get answers, conduct research,
            and create content with an AI designed to serve your needs without compromising your beliefs.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="w-full sm:w-auto rounded-lg bg-blue-500 px-8 py-4 text-lg font-semibold hover:bg-blue-600 transition"
            >
              Get Started Free
            </Link>
            <Link
              href="#how-it-works"
              className="w-full sm:w-auto rounded-lg border border-gray-600 px-8 py-4 text-lg font-semibold hover:bg-white/5 transition"
            >
              Learn More
            </Link>
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="container mx-auto px-4 py-16 sm:py-20">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="mb-6 text-3xl sm:text-4xl font-bold">Why JCIL.AI Exists</h2>
          <p className="text-lg sm:text-xl text-gray-300 leading-relaxed mb-8">
            The most powerful AI tools are built in Silicon Valley, often reflecting values that
            do not align with millions of Americans who hold traditional, faith-based beliefs.
            As AI becomes more influential in how we learn, work, and communicate, people of
            faith deserve tools that respect and reinforce their values.
          </p>
          <p className="text-lg sm:text-xl text-gray-300 leading-relaxed">
            JCIL.AI is built on world-class AI infrastructure, wrapped in a protective layer
            designed to serve people of faith. We believe AI should empower you, not replace
            your thinking, compromise your values, or expose you to content that conflicts
            with your beliefs.
          </p>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="container mx-auto px-4 py-16 sm:py-20">
        <h2 className="mb-4 text-center text-3xl sm:text-4xl font-bold">Our Approach</h2>
        <p className="mb-12 text-center text-gray-400 max-w-2xl mx-auto">
          We built JCIL.AI with a clear philosophy: AI should assist and empower, never replace or undermine.
        </p>
        <div className="grid gap-6 md:gap-8 md:grid-cols-3 max-w-6xl mx-auto">
          <div className="glass-morphism rounded-2xl p-6 sm:p-8">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/20">
              <svg className="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h3 className="mb-3 text-xl sm:text-2xl font-semibold">AI That Assists, Not Replaces</h3>
            <p className="text-gray-300 leading-relaxed">
              We help pastors outline sermons, but believe sermons should be Spirit-led.
              We help students study and identify weaknesses, but will not write their papers.
              Human development and growth matter.
            </p>
          </div>

          <div className="glass-morphism rounded-2xl p-6 sm:p-8">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/20">
              <svg className="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="mb-3 text-xl sm:text-2xl font-semibold">Values-Aligned Guardrails</h3>
            <p className="text-gray-300 leading-relaxed">
              Built-in content moderation ensures a safe environment for you and your family.
              No adult content. No profane language. Clear community guidelines that reflect
              the values you hold.
            </p>
          </div>

          <div className="glass-morphism rounded-2xl p-6 sm:p-8">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/20">
              <svg className="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h3 className="mb-3 text-xl sm:text-2xl font-semibold">Scripture-Informed Foundation</h3>
            <p className="text-gray-300 leading-relaxed">
              We believe Scripture is the written Word of God. Use JCIL.AI as a study aid,
              develop Bible studies, explore theological questions, and deepen your faith
              with an assistant that shares your reverence.
            </p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-16 sm:py-20">
        <h2 className="mb-4 text-center text-3xl sm:text-4xl font-bold">Enterprise-Grade Platform</h2>
        <p className="mb-12 text-center text-gray-400 max-w-2xl mx-auto">
          Built with the same standards used by Fortune 500 companies.
        </p>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto">
          <div className="glass-morphism rounded-2xl p-6">
            <div className="mb-4 text-3xl">🔒</div>
            <h3 className="mb-2 text-lg font-semibold">End-to-End Encryption</h3>
            <p className="text-sm text-gray-400">
              Your conversations are encrypted in transit and at rest. We take data security seriously.
            </p>
          </div>

          <div className="glass-morphism rounded-2xl p-6">
            <div className="mb-4 text-3xl">🗑️</div>
            <h3 className="mb-2 text-lg font-semibold">Auto-Delete Policy</h3>
            <p className="text-sm text-gray-400">
              Conversations are automatically deleted after 6 months. Your data is not stored indefinitely.
            </p>
          </div>

          <div className="glass-morphism rounded-2xl p-6">
            <div className="mb-4 text-3xl">🛡️</div>
            <h3 className="mb-2 text-lg font-semibold">Content Moderation</h3>
            <p className="text-sm text-gray-400">
              Multi-layer moderation system filters inappropriate content before it reaches you.
            </p>
          </div>

          <div className="glass-morphism rounded-2xl p-6">
            <div className="mb-4 text-3xl">⚡</div>
            <h3 className="mb-2 text-lg font-semibold">99.9% Uptime</h3>
            <p className="text-sm text-gray-400">
              Enterprise infrastructure ensures JCIL.AI is available when you need it.
            </p>
          </div>
        </div>
      </section>

      {/* Tools Section */}
      <section className="container mx-auto px-4 py-16 sm:py-20">
        <h2 className="mb-4 text-center text-3xl sm:text-4xl font-bold">Powerful Tools at Your Fingertips</h2>
        <p className="mb-12 text-center text-gray-400 max-w-2xl mx-auto">
          Everything you need to research, write, study, and create.
        </p>
        <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
          {[
            { icon: '💬', title: 'AI Chat', desc: 'Intelligent conversation for any topic' },
            { icon: '🔍', title: 'Live Research', desc: 'Real-time web search and analysis' },
            { icon: '📰', title: 'Breaking News', desc: 'Curated news updated every 30 minutes' },
            { icon: '📖', title: 'Bible Study', desc: 'Scripture exploration and study aids' },
            { icon: '✍️', title: 'Writing Tools', desc: 'Essays, emails, and content creation' },
            { icon: '🖼️', title: 'Image Generation', desc: 'Create images from text descriptions' },
            { icon: '📊', title: 'Data Analysis', desc: 'Upload and analyze spreadsheets' },
            { icon: '💻', title: 'Code Assistant', desc: 'Programming help and debugging' },
            { icon: '🙏', title: 'Daily Devotional', desc: 'Fresh spiritual content every day' },
          ].map((tool, index) => (
            <div key={index} className="flex items-start gap-4 rounded-xl bg-white/5 p-4 sm:p-5">
              <div className="text-2xl">{tool.icon}</div>
              <div>
                <h3 className="font-semibold mb-1">{tool.title}</h3>
                <p className="text-sm text-gray-400">{tool.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing Section */}
      <PricingSection />

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-16 sm:py-20 text-center">
        <div className="glass-morphism mx-auto max-w-3xl rounded-3xl p-8 sm:p-12">
          <h2 className="mb-4 text-3xl sm:text-4xl font-bold">Ready to Get Started?</h2>
          <p className="mb-8 text-lg text-gray-300">
            Join thousands of people of faith who trust JCIL.AI for intelligent, values-aligned assistance.
          </p>
          <Link
            href="/signup"
            className="inline-block rounded-lg bg-blue-500 px-8 py-4 text-lg font-semibold hover:bg-blue-600 transition"
          >
            Create Your Free Account
          </Link>
          <p className="mt-4 text-sm text-gray-500">No credit card required. Start with 10 free chats per day.</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-12">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-4">
            <div className="sm:col-span-2 md:col-span-1">
              <h3 className="mb-4 text-xl font-bold">JCIL.AI</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                AI-powered tools built for people of faith. Intelligent assistance that respects your values.
              </p>
            </div>

            <div>
              <h4 className="mb-4 font-semibold">Product</h4>
              <ul className="space-y-2 text-sm text-gray-400">
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
              <ul className="space-y-2 text-sm text-gray-400">
                <li>
                  <Link href="/about" className="hover:text-white transition">
                    About Us
                  </Link>
                </li>
                <li>
                  <a href="mailto:support@jcil.ai" className="hover:text-white transition">
                    Support
                  </a>
                </li>
                <li>
                  <a href="mailto:info@jcil.ai" className="hover:text-white transition">
                    Contact
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="mb-4 font-semibold">Legal</h4>
              <ul className="space-y-2 text-sm text-gray-400">
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

          <div className="mt-12 border-t border-gray-800 pt-8 text-center text-sm text-gray-500">
            <p>&copy; {new Date().getFullYear()} JCIL.AI. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
